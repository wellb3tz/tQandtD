import {
  ECONOMY_CONTRACT_TEMPLATES,
  ECONOMY_BUILDINGS,
  ECONOMY_EVENTS,
  ECONOMY_FACTIONS,
  ECONOMY_ITEMS,
  ECONOMY_PRODUCTION,
} from './economyData';
import type {
  ActiveEconomyEvent,
  BuildingDefinition,
  Contract,
  ContractDefinition,
  EconomySnapshot,
  EconomyLogEntry,
  FactionDefinition,
  ItemDefinition,
  PlayerEconomy,
  PlayerAutoRoute,
  PriceHistoryEntry,
  ProductionDefinition,
  Settlement,
  TradeRoute,
  Trader,
  WorldEconomyContext,
} from './types';

const HISTORY_LIMIT = 360;
const ECONOMY_LOG_LIMIT = 80;
const AUTO_ROUTE_SETUP_COST = 150;
const COLONY_SETUP_COST = 900;
const INTEL_NETWORK_COST = 120;
const BUILDING_COSTS: Record<string, number> = {
  warehouse: 350,
  sawmill: 520,
  foundry: 760,
  clinic: 430,
};

export class EconomySimulation {
  private readonly items: ItemDefinition[];
  private readonly factions: FactionDefinition[];
  private readonly eventDefinitions = ECONOMY_EVENTS;
  private readonly contractDefinitions: ContractDefinition[];
  private readonly buildingDefinitions: BuildingDefinition[];
  private readonly productionDefinitions: ProductionDefinition[];
  private settlements: Settlement[] = [];
  private tradeRoutes: TradeRoute[] = [];
  private traders: Trader[] = [];
  private activeEvents: ActiveEconomyEvent[] = [];
  private contracts: Contract[] = [];
  private priceHistory: PriceHistoryEntry[] = [];
  private economyLog: EconomyLogEntry[] = [];
  private player: PlayerEconomy;
  private worldContext: WorldEconomyContext;
  private lastWorldContextSignature = '';
  private hour = 0;
  private seed: number;

  constructor(seed = 12345) {
    this.seed = seed;
    this.items = ECONOMY_ITEMS;
    this.factions = ECONOMY_FACTIONS.map(cloneFaction);
    this.contractDefinitions = ECONOMY_CONTRACT_TEMPLATES;
    this.buildingDefinitions = ECONOMY_BUILDINGS;
    this.productionDefinitions = ECONOMY_PRODUCTION;
    this.player = this.createPlayer();
    this.worldContext = this.createEmptyWorldContext();
    this.reset(seed);
  }

  reset(seed = this.seed): void {
    this.seed = seed;
    this.hour = 0;
    this.player = this.createPlayer();
    this.activeEvents = [];
    this.priceHistory = [];
    this.economyLog = [];
    this.worldContext = this.createEmptyWorldContext();
    this.lastWorldContextSignature = '';
    this.settlements = this.createSettlements(seed);
    this.updatePrices();
    this.tradeRoutes = this.createTradeRoutes();
    this.traders = this.createTraders();
    this.contracts = this.createContracts(8);
  }

  tick(hours = 1): EconomySnapshot {
    const wholeHours = Math.max(1, Math.floor(hours));
    for (let i = 0; i < wholeHours; i++) {
      this.hour += 1;
      this.runProduction();
      this.runConsumption();
      this.runNpcTrade();
      this.runPlayerAutoRoutes();
      this.runPlayerColony();
      this.runWorldContextPulse();
      this.advanceAcceptedContracts();
      this.checkDeficits();
      this.checkEvents();
      this.updatePrices();
      this.refreshTradeRoutes();
      this.updateContracts();
    }

    return this.getSnapshot();
  }

  buy(settlementId: string, itemId: string, quantity: number): boolean {
    const settlement = this.findSettlement(settlementId);
    const amount = Math.max(1, Math.floor(quantity));
    const available = settlement.stockpiles[itemId] ?? 0;
    const price = settlement.prices[itemId] ?? this.getItem(itemId).basePrice;
    const cost = Math.ceil(price * amount);
    if (available < amount || this.player.money < cost) {
      return false;
    }

    settlement.stockpiles[itemId] = available - amount;
    this.player.inventory[itemId] = (this.player.inventory[itemId] ?? 0) + amount;
    this.player.money -= cost;
    settlement.wealth += cost;
    this.adjustReputation(settlement.factionId, 1);
    this.updatePrices();
    return true;
  }

  sell(settlementId: string, itemId: string, quantity: number): boolean {
    const settlement = this.findSettlement(settlementId);
    const amount = Math.max(1, Math.floor(quantity));
    const owned = this.player.inventory[itemId] ?? 0;
    const price = settlement.prices[itemId] ?? this.getItem(itemId).basePrice;
    const corporation = this.getCorporationSnapshot();
    const influenceBonus = 1 + Math.min(0.08, (corporation.marketShare[settlement.factionId] ?? 0) / 1000);
    const revenue = Math.floor(price * amount * 0.94 * influenceBonus);
    if (owned < amount || settlement.wealth < revenue) {
      return false;
    }

    this.player.inventory[itemId] = owned - amount;
    settlement.stockpiles[itemId] = (settlement.stockpiles[itemId] ?? 0) + amount;
    this.player.money += revenue;
    settlement.wealth -= revenue;
    this.adjustReputation(settlement.factionId, 1);
    this.updatePrices();
    return true;
  }

  depositToWarehouse(itemId: string, quantity: number): boolean {
    const amount = Math.max(1, Math.floor(quantity));
    const cargoAmount = this.player.inventory[itemId] ?? 0;
    if (cargoAmount < amount || this.getWarehouseUsed() + amount > this.getWarehouseCapacity()) {
      return false;
    }

    this.player.inventory[itemId] = cargoAmount - amount;
    this.player.warehouse[itemId] = (this.player.warehouse[itemId] ?? 0) + amount;
    return true;
  }

  foundColony(settlementId: string): boolean {
    const settlement = this.findSettlement(settlementId);
    if (this.player.colony || this.player.money < COLONY_SETUP_COST) {
      return false;
    }

    this.player.money -= COLONY_SETUP_COST;
    this.player.colony = {
      id: `colony-${this.seed}-${this.hour}`,
      name: `${settlement.name} Charter`,
      linkedSettlementId: settlement.id,
      population: 60,
      buildings: ['warehouse'],
      stockpiles: { ...this.player.warehouse },
      routes: [],
      taxes: 0.08,
      reputation: { ...this.player.reputation },
      foundedHour: this.hour,
      lastBalance: -COLONY_SETUP_COST,
    };
    this.adjustReputation(settlement.factionId, 4);
    this.pushLog('colony', `Founded ${this.player.colony.name}`);
    return true;
  }

  buildColonyBuilding(buildingId: string): boolean {
    const colony = this.player.colony;
    const building = this.buildingDefinitions.find(item => item.id === buildingId);
    const cost = BUILDING_COSTS[buildingId] ?? 500;
    if (!colony || !building || colony.buildings.includes(buildingId) || this.player.money < cost) {
      return false;
    }

    this.player.money -= cost;
    colony.buildings.push(building.id);
    colony.lastBalance -= cost;
    this.pushLog('colony', `Built ${building.name} in ${colony.name}`);
    return true;
  }

  investInFaction(factionId: string, amount = 250): boolean {
    const faction = this.findFaction(factionId);
    const investment = Math.max(50, Math.floor(amount));
    if (this.player.money < investment) {
      return false;
    }

    this.player.money -= investment;
    faction.wealth += investment;
    faction.influence = clamp(0, 100, faction.influence + investment / 500);
    this.adjustReputation(faction.id, Math.max(1, Math.floor(investment / 200)));
    this.pushLog('faction', `Invested ${investment} in ${faction.name}`);
    return true;
  }

  fundIntelNetwork(): boolean {
    if (this.player.money < INTEL_NETWORK_COST || this.player.intelNetwork >= 100) {
      return false;
    }

    this.player.money -= INTEL_NETWORK_COST;
    this.player.intelNetwork = clamp(0, 100, this.player.intelNetwork + 8);
    this.pushLog('market', `Funded market reports: intel network ${Math.round(this.player.intelNetwork)}`);
    return true;
  }

  syncWorldContext(context: WorldEconomyContext): EconomySnapshot {
    const linkedSettlementId = this.getWorldLinkedSettlementId(context);
    const normalizedContext = {
      ...context,
      nearbyResources: { ...context.nearbyResources },
      nearbyStructures: { ...context.nearbyStructures },
      linkedSettlementId,
    };
    const signature = this.getWorldContextSignature(normalizedContext);
    this.worldContext = normalizedContext;
    if (signature !== this.lastWorldContextSignature) {
      this.lastWorldContextSignature = signature;
      const settlement = this.findSettlement(linkedSettlementId);
      this.pushLog('market', `World link: ${settlement.name} / ${normalizedContext.localBiome ?? 'unknown terrain'}`);
    }
    this.updatePrices();
    return this.getSnapshot();
  }

  withdrawFromWarehouse(itemId: string, quantity: number): boolean {
    const amount = Math.max(1, Math.floor(quantity));
    const storedAmount = this.player.warehouse[itemId] ?? 0;
    if (storedAmount < amount) {
      return false;
    }

    this.player.warehouse[itemId] = storedAmount - amount;
    this.player.inventory[itemId] = (this.player.inventory[itemId] ?? 0) + amount;
    return true;
  }

  charterAutoRoute(originId: string, itemId: string, quantity: number): boolean {
    const origin = this.findSettlement(originId);
    const destination = this.findBestDestination(origin, itemId);
    if (!destination || this.player.money < AUTO_ROUTE_SETUP_COST) {
      return false;
    }

    const amount = Math.max(1, Math.floor(quantity));
    const risk = clamp01(0.12 + (1 - origin.security + 1 - destination.security) * 0.18);
    const route: PlayerAutoRoute = {
      id: `player-route-${this.hour}-${this.player.autoRoutes.length + 1}`,
      originId: origin.id,
      destinationId: destination.id,
      itemId,
      quantity: amount,
      active: true,
      risk,
      profit: 0,
      completedRuns: 0,
    };

    this.player.money -= AUTO_ROUTE_SETUP_COST;
    this.player.autoRoutes.push(route);
    this.pushLog('route', `Chartered ${this.getItem(itemId).name}: ${origin.name} -> ${destination.name}`);
    return true;
  }

  toggleAutoRoute(routeId: string): boolean {
    const route = this.player.autoRoutes.find(item => item.id === routeId);
    if (!route) {
      return false;
    }

    route.active = !route.active;
    return true;
  }

  acceptContract(contractId: string): boolean {
    const contract = this.contracts.find(item => item.id === contractId);
    if (!contract || contract.accepted || contract.completed || contract.failed) {
      return false;
    }

    contract.accepted = true;
    this.player.acceptedContracts.push(contract.id);
    return true;
  }

  completeContract(contractId: string): boolean {
    const contract = this.contracts.find(item => item.id === contractId);
    if (!contract || !contract.accepted || contract.completed || contract.failed || this.hour > contract.deadlineHour) {
      return false;
    }

    if (!this.canCompleteContract(contract)) {
      return false;
    }

    this.consumeContractRequirements(contract);
    this.player.money += contract.reward;
    contract.completed = true;
    contract.failed = false;
    this.adjustReputation(this.findSettlement(contract.issuer).factionId, 6);
    this.applyContractOutcome(contract);
    this.pushLog('contract', `${contract.type} completed: ${this.getItem(contract.itemId).name} x${contract.quantity}`);
    return true;
  }

  restore(snapshot: EconomySnapshot): EconomySnapshot {
    this.seed = snapshot.seed ?? this.seed;
    this.hour = snapshot.hour;
    this.settlements = snapshot.settlements.map(cloneSettlement);
    this.tradeRoutes = snapshot.tradeRoutes.map(route => ({ ...route, goods: [...route.goods] }));
    this.traders = snapshot.traders.map(trader => ({
      ...trader,
      inventory: { ...trader.inventory },
      reputation: { ...trader.reputation },
      routeHistory: [...trader.routeHistory],
    }));
    this.activeEvents = snapshot.activeEvents.map(event => ({
      ...event,
      trigger: event.trigger ?? event.type,
      actor: event.actor ?? this.findSettlement(event.targetSettlementId).factionId,
      location: event.location ?? event.targetRegion,
      modifier: event.modifier ?? 'volatile',
      outcome: event.outcome ?? event.name,
      causes: [...event.causes],
      effects: { ...event.effects },
    }));
    this.contracts = snapshot.contracts.map(contract => ({
      ...contract,
      requirements: [...contract.requirements],
      failed: contract.failed ?? false,
      progressHours: contract.progressHours ?? 0,
      requiredHours: contract.requiredHours ?? this.getContractRequiredHours(contract.type),
    }));
    this.player = {
      money: snapshot.player.money,
      inventory: { ...snapshot.player.inventory },
      warehouse: { ...snapshot.player.warehouse },
      reputation: { ...snapshot.player.reputation },
      intelNetwork: snapshot.player.intelNetwork ?? 0,
      acceptedContracts: [...snapshot.player.acceptedContracts],
      autoRoutes: (snapshot.player.autoRoutes ?? []).map(route => ({ ...route })),
      colony: snapshot.player.colony ? cloneColony(snapshot.player.colony) : null,
      corporationName: snapshot.player.corporationName ?? 'Frontier Office',
    };
    this.priceHistory = snapshot.priceHistory.map(entry => ({ ...entry }));
    this.economyLog = (snapshot.economyLog ?? []).map(entry => ({ ...entry }));
    return this.getSnapshot();
  }

  getSnapshot(): EconomySnapshot {
    return {
      seed: this.seed,
      hour: this.hour,
      items: this.items.map(item => ({ ...item })),
      factions: this.factions.map(cloneFaction),
      buildings: this.buildingDefinitions.map(building => ({
        ...building,
        consumes: building.consumes ? [...building.consumes] : undefined,
      })),
      contractTemplates: this.contractDefinitions.map(template => ({ ...template })),
      production: this.productionDefinitions.map(definition => ({
        ...definition,
        inputs: definition.inputs.map(input => ({ ...input })),
        outputs: definition.outputs.map(output => ({ ...output })),
      })),
      eventDefinitions: this.eventDefinitions.map(definition => ({
        ...definition,
        targetGoods: [...definition.targetGoods],
        effects: { ...definition.effects },
      })),
      settlements: this.settlements.map(cloneSettlement),
      tradeRoutes: this.tradeRoutes.map(route => ({ ...route, goods: [...route.goods] })),
      traders: this.traders.map(trader => ({
        ...trader,
        inventory: { ...trader.inventory },
        reputation: { ...trader.reputation },
        routeHistory: [...trader.routeHistory],
      })),
      activeEvents: this.activeEvents.map(event => ({
        ...event,
        causes: [...event.causes],
        effects: { ...event.effects },
      })),
      crisis: this.getCrisisSnapshot(),
      contracts: this.contracts.map(contract => ({
        ...contract,
        requirements: [...contract.requirements],
      })),
      player: {
        money: this.player.money,
        inventory: { ...this.player.inventory },
        warehouse: { ...this.player.warehouse },
        reputation: { ...this.player.reputation },
        intelNetwork: this.player.intelNetwork,
        acceptedContracts: [...this.player.acceptedContracts],
        autoRoutes: this.player.autoRoutes.map(route => ({ ...route })),
        colony: this.player.colony ? cloneColony(this.player.colony) : null,
        corporationName: this.player.corporationName,
      },
      intel: this.getIntelSnapshot(),
      corporation: this.getCorporationSnapshot(),
      world: this.cloneWorldContext(),
      priceHistory: this.priceHistory.map(entry => ({ ...entry })),
      economyLog: this.economyLog.map(entry => ({ ...entry })),
    };
  }

  private createPlayer(): PlayerEconomy {
    return {
      money: 1500,
      inventory: {},
      warehouse: {},
      reputation: Object.fromEntries(ECONOMY_FACTIONS.map(faction => [faction.id, 0])),
      intelNetwork: 0,
      acceptedContracts: [],
      autoRoutes: [],
      colony: null,
      corporationName: 'Frontier Office',
    };
  }

  private createSettlements(seed: number): Settlement[] {
    const names = ['Harrow Gate', 'Copperfen', 'North Quay', 'Stoneford', 'Red Mesa', 'Lumen Post'];
    return names.map((name, index) => {
      const faction = this.factions[index % this.factions.length];
      const settlementSeed = hashNumber(seed + index * 9973);
      const traits = this.pickSettlementTraits(settlementSeed, index);
      const stockpiles = this.createInitialStockpiles(settlementSeed, index, traits);
      const productionIds = this.productionDefinitions
        .filter((definition, productionIndex) => this.shouldSettlementProduce(definition.id, productionIndex, index, traits))
        .map(definition => definition.id);
      const settlement: Settlement = {
        id: `settlement-${index + 1}`,
        name,
        seed: settlementSeed,
        traits,
        population: 320 + Math.floor(random01(settlementSeed, 1) * 1800),
        wealth: 2800 + Math.floor(random01(settlementSeed, 2) * 9000),
        stability: 0.52 + random01(settlementSeed, 3) * 0.42,
        security: 0.45 + random01(settlementSeed, 4) * 0.5,
        factionId: faction.id,
        stockpiles,
        production: productionIds,
        consumption: this.pickConsumption(index, traits),
        activeEvents: [],
        reputationMap: Object.fromEntries(this.factions.map(entry => [entry.id, entry.id === faction.id ? 20 : 0])),
        prices: {},
      };
      return settlement;
    });
  }

  private pickSettlementTraits(seed: number, index: number): string[] {
    const traitPool = ['ore_basin', 'river_port', 'timberland', 'frontier_camp', 'guild_town', 'luxury_crossroad'];
    const primary = traitPool[index % traitPool.length];
    const secondary = traitPool[Math.floor(random01(seed, 31) * traitPool.length)];
    return Array.from(new Set([primary, secondary]));
  }

  private createInitialStockpiles(seed: number, settlementIndex: number, traits: string[]): Record<string, number> {
    const stockpiles: Record<string, number> = {};
    for (const [index, item] of this.items.entries()) {
      const categoryBias = item.category === 'raw' ? 90 : item.category === 'industrial' ? 46 : 20;
      const localBias = (index + settlementIndex) % 4 === 0 ? 70 : 0;
      const traitBias = this.getTraitStockBias(traits, item.id);
      stockpiles[item.id] = Math.floor(categoryBias + localBias + traitBias + random01(seed, index) * 140);
    }
    return stockpiles;
  }

  private getTraitStockBias(traits: string[], itemId: string): number {
    let bias = 0;
    if (traits.includes('ore_basin') && ['iron_ore', 'coal', 'stone'].includes(itemId)) bias += 90;
    if (traits.includes('river_port') && ['fish', 'fuel', 'salt'].includes(itemId)) bias += 70;
    if (traits.includes('timberland') && ['timber', 'hides'].includes(itemId)) bias += 80;
    if (traits.includes('frontier_camp') && ['tools', 'medicine', 'grain'].includes(itemId)) bias += 35;
    if (traits.includes('guild_town') && ['tools', 'textiles', 'books'].includes(itemId)) bias += 55;
    if (traits.includes('luxury_crossroad') && ['spices', 'jewelry', 'contracts'].includes(itemId)) bias += 65;
    return bias;
  }

  private shouldSettlementProduce(productionId: string, productionIndex: number, settlementIndex: number, traits: string[]): boolean {
    if (traits.includes('timberland') && productionId === 'planks') return true;
    if (traits.includes('ore_basin') && productionId === 'steel') return true;
    if (traits.includes('guild_town') && ['tools', 'machinery'].includes(productionId)) return true;
    return (productionIndex + settlementIndex) % 2 === 0;
  }

  private pickConsumption(index: number, traits: string[]): string[] {
    const mandatory = ['grain', 'tools', 'medicine', 'fuel'];
    const rotating = ['spices', 'textiles', 'books', 'bricks', 'planks', 'salt'];
    const traitDemand = traits.includes('frontier_camp') ? ['bricks', 'planks']
      : traits.includes('luxury_crossroad') ? ['jewelry', 'spices']
        : traits.includes('guild_town') ? ['books', 'contracts']
          : [];
    return Array.from(new Set([...mandatory, rotating[index % rotating.length], rotating[(index + 2) % rotating.length], ...traitDemand]));
  }

  private createTradeRoutes(): TradeRoute[] {
    const routes: TradeRoute[] = [];
    for (let i = 0; i < this.settlements.length; i++) {
      const origin = this.settlements[i];
      const destination = this.settlements[(i + 1) % this.settlements.length];
      routes.push(this.createTradeRoute(origin, destination, i));
    }
    return routes;
  }

  private createTradeRoute(origin: Settlement, destination: Settlement, index: number): TradeRoute {
    const goods = this.findProfitableGoods(origin, destination).slice(0, 4);
    const distance = 20 + Math.floor(random01(this.seed, index + 70) * 130);
    const risk = clamp01(0.12 + (1 - origin.security + 1 - destination.security) * 0.18);
    return {
      id: `route-${origin.id}-${destination.id}`,
      originId: origin.id,
      destinationId: destination.id,
      goods,
      risk,
      distance,
      profit: 0,
      traffic: 0.4 + random01(this.seed, index + 80) * 0.5,
    };
  }

  private createTraders(): Trader[] {
    return Array.from({ length: 7 }, (_, index) => ({
      id: `trader-${index + 1}`,
      name: `Trader ${index + 1}`,
      money: 800 + Math.floor(random01(this.seed, index + 110) * 2400),
      inventory: {},
      reputation: Object.fromEntries(this.factions.map(faction => [faction.id, Math.floor(random01(this.seed, index + faction.influence) * 20)])),
      routeHistory: [],
      goal: index % 2 === 0 ? 'arbitrage' : 'contract_support',
    }));
  }

  private createContracts(count: number): Contract[] {
    const contracts: Contract[] = [];
    for (let index = 0; index < count; index++) {
      contracts.push(this.createContract(index));
    }
    return contracts;
  }

  private createContract(index: number): Contract {
    const shortage = this.getShortageSignals(6)[index % 6];
    const shortageTemplate = shortage
      ? this.contractDefinitions.find(definition => definition.type === (index % 2 === 0 ? 'Delivery' : 'Procurement'))
      : undefined;
    const template = shortageTemplate ?? this.contractDefinitions[index % this.contractDefinitions.length];
    const target = shortage ? this.findSettlement(shortage.settlementId) : this.settlements[(index + 2) % this.settlements.length];
    const origin = shortage ? this.findBestStockedSettlement(shortage.itemId, target.id) : this.settlements[index % this.settlements.length];
    const item = shortage ? this.getItem(shortage.itemId) : this.items[(index * 3 + this.hour) % this.items.length];
    const quantity = 8 + Math.floor(random01(this.seed + this.hour, index + 200) * 26);
    const targetPrice = target.prices[item.id] ?? item.basePrice;
    const requiredHours = this.getContractRequiredHours(template.type);
    return {
      id: `contract-${this.hour}-${index}-${template.id}`,
      type: template.type,
      issuer: origin.id,
      originId: origin.id,
      targetId: target.id,
      itemId: item.id,
      quantity,
      reward: Math.ceil(quantity * targetPrice * template.rewardMultiplier),
      deadlineHour: this.hour + template.deadlineHours,
      risks: template.risk,
      requirements: this.createContractRequirements(template.type, quantity, item.name, requiredHours, this.hour + template.deadlineHours),
      progressHours: 0,
      requiredHours,
      accepted: false,
      completed: false,
      failed: false,
    };
  }

  private getShortageSignals(limit: number): Array<{ settlementId: string; itemId: string; severity: number }> {
    const shortages: Array<{ settlementId: string; itemId: string; severity: number }> = [];
    for (const settlement of this.settlements) {
      for (const itemId of settlement.consumption) {
        const desired = Math.max(16, this.getDesiredStock(settlement, itemId) * 0.3);
        const stock = settlement.stockpiles[itemId] ?? 0;
        if (stock < desired) {
          shortages.push({
            settlementId: settlement.id,
            itemId,
            severity: round2(clamp(0, 1, (desired - stock) / desired)),
          });
        }
      }
    }

    return shortages
      .sort((a, b) => b.severity - a.severity)
      .slice(0, limit);
  }

  private findBestStockedSettlement(itemId: string, excludedSettlementId: string): Settlement {
    return this.settlements
      .filter(settlement => settlement.id !== excludedSettlementId)
      .sort((a, b) => (b.stockpiles[itemId] ?? 0) - (a.stockpiles[itemId] ?? 0))[0]
      ?? this.settlements[0];
  }

  private createContractRequirements(
    type: Contract['type'],
    quantity: number,
    itemName: string,
    requiredHours: number,
    deadlineHour: number
  ): string[] {
    if (type === 'Delivery' || type === 'Procurement') {
      return [`Cargo ${quantity} ${itemName}`, `Deadline hour ${deadlineHour}`];
    }
    if (type === 'Construction') {
      return [`Warehouse ${quantity} ${itemName}`, `Work ${requiredHours}h`, `Deadline hour ${deadlineHour}`];
    }
    return [`Field work ${requiredHours}h`, `Deadline hour ${deadlineHour}`];
  }

  private getContractRequiredHours(type: Contract['type']): number {
    switch (type) {
      case 'Escort':
        return 8;
      case 'Construction':
        return 12;
      case 'Exploration':
        return 10;
      default:
        return 0;
    }
  }

  private advanceAcceptedContracts(): void {
    for (const contract of this.contracts) {
      if (!contract.accepted || contract.completed || contract.failed || contract.requiredHours <= 0) {
        continue;
      }

      contract.progressHours = Math.min(contract.requiredHours, contract.progressHours + 1);
    }
  }

  private canCompleteContract(contract: Contract): boolean {
    if (contract.progressHours < contract.requiredHours) {
      return false;
    }

    if (contract.type === 'Delivery' || contract.type === 'Procurement') {
      return (this.player.inventory[contract.itemId] ?? 0) >= contract.quantity;
    }

    if (contract.type === 'Construction') {
      return (this.player.warehouse[contract.itemId] ?? 0) >= contract.quantity;
    }

    return true;
  }

  private consumeContractRequirements(contract: Contract): void {
    if (contract.type === 'Delivery' || contract.type === 'Procurement') {
      this.player.inventory[contract.itemId] = (this.player.inventory[contract.itemId] ?? 0) - contract.quantity;
      return;
    }

    if (contract.type === 'Construction') {
      this.player.warehouse[contract.itemId] = (this.player.warehouse[contract.itemId] ?? 0) - contract.quantity;
    }
  }

  private applyContractOutcome(contract: Contract): void {
    const origin = this.findSettlement(contract.originId);
    const target = this.findSettlement(contract.targetId);
    const targetFaction = this.findFaction(target.factionId);
    const itemName = this.getItem(contract.itemId).name;

    switch (contract.type) {
      case 'Delivery':
      case 'Procurement':
        target.stockpiles[contract.itemId] = (target.stockpiles[contract.itemId] ?? 0) + contract.quantity;
        target.wealth = Math.max(0, target.wealth - Math.floor(contract.reward * 0.18));
        target.stability = clamp01(target.stability + 0.018);
        this.pushLog('market', `${target.name} received ${itemName}; shortage pressure eased`);
        break;
      case 'Construction':
        target.wealth += Math.floor(contract.reward * 0.35);
        target.stability = clamp01(target.stability + 0.035);
        target.security = clamp01(target.security + 0.012);
        targetFaction.influence = clamp(0, 100, targetFaction.influence + 0.7);
        this.pushLog('colony', `${target.name} infrastructure improved by ${itemName}`);
        break;
      case 'Escort':
        origin.security = clamp01(origin.security + 0.018);
        target.security = clamp01(target.security + 0.026);
        this.lowerRouteRisk(origin.id, target.id, 0.035);
        targetFaction.militaryPower = clamp(0, 100, targetFaction.militaryPower + 0.5);
        this.pushLog('route', `${origin.name} -> ${target.name} corridor secured`);
        break;
      case 'Exploration':
        target.stability = clamp01(target.stability + 0.012);
        target.stockpiles[contract.itemId] = (target.stockpiles[contract.itemId] ?? 0) + Math.ceil(contract.quantity * 0.4);
        targetFaction.influence = clamp(0, 100, targetFaction.influence + 1);
        this.adjustReputation(target.factionId, 3);
        this.pushLog('faction', `${targetFaction.name} gained frontier intelligence near ${target.name}`);
        break;
    }

    this.updatePrices();
  }

  private applyContractFailure(contract: Contract): void {
    const origin = this.findSettlement(contract.originId);
    const target = this.findSettlement(contract.targetId);
    const targetFaction = this.findFaction(target.factionId);
    const itemName = this.getItem(contract.itemId).name;

    switch (contract.type) {
      case 'Delivery':
      case 'Procurement':
        target.stability = clamp01(target.stability - 0.026);
        target.wealth = Math.max(0, target.wealth - Math.floor(contract.reward * 0.12));
        targetFaction.influence = clamp(0, 100, targetFaction.influence - 0.45);
        this.pushLog('market', `${target.name} missed ${itemName}; shortage pressure rose`);
        break;
      case 'Construction':
        target.stability = clamp01(target.stability - 0.018);
        target.wealth = Math.max(0, target.wealth - Math.floor(contract.reward * 0.08));
        targetFaction.influence = clamp(0, 100, targetFaction.influence - 0.35);
        this.pushLog('colony', `${target.name} delayed infrastructure for ${itemName}`);
        break;
      case 'Escort':
        origin.security = clamp01(origin.security - 0.012);
        target.security = clamp01(target.security - 0.022);
        this.raiseRouteRisk(origin.id, target.id, 0.028);
        targetFaction.militaryPower = clamp(0, 100, targetFaction.militaryPower - 0.35);
        this.pushLog('route', `${origin.name} -> ${target.name} corridor grew dangerous`);
        break;
      case 'Exploration':
        target.stability = clamp01(target.stability - 0.01);
        targetFaction.influence = clamp(0, 100, targetFaction.influence - 0.3);
        this.pushLog('faction', `${targetFaction.name} lost frontier intelligence near ${target.name}`);
        break;
    }

    this.updatePrices();
  }

  private lowerRouteRisk(originId: string, targetId: string, amount: number): void {
    for (const route of this.tradeRoutes) {
      const matchesDirection = route.originId === originId && route.destinationId === targetId;
      const matchesReverse = route.originId === targetId && route.destinationId === originId;
      if (matchesDirection || matchesReverse) {
        route.risk = clamp01(route.risk - amount);
        route.profit = round2(route.profit * (1 + amount));
      }
    }

    for (const route of this.player.autoRoutes) {
      const matchesDirection = route.originId === originId && route.destinationId === targetId;
      const matchesReverse = route.originId === targetId && route.destinationId === originId;
      if (matchesDirection || matchesReverse) {
        route.risk = clamp01(route.risk - amount);
      }
    }
  }

  private raiseRouteRisk(originId: string, targetId: string, amount: number): void {
    for (const route of this.tradeRoutes) {
      const matchesDirection = route.originId === originId && route.destinationId === targetId;
      const matchesReverse = route.originId === targetId && route.destinationId === originId;
      if (matchesDirection || matchesReverse) {
        route.risk = clamp01(route.risk + amount);
        route.profit = round2(route.profit * (1 - amount * 0.5));
      }
    }

    for (const route of this.player.autoRoutes) {
      const matchesDirection = route.originId === originId && route.destinationId === targetId;
      const matchesReverse = route.originId === targetId && route.destinationId === originId;
      if (matchesDirection || matchesReverse) {
        route.risk = clamp01(route.risk + amount);
      }
    }
  }

  private runProduction(): void {
    for (const settlement of this.settlements) {
      for (const productionId of settlement.production) {
        const production = this.productionDefinitions.find(definition => definition.id === productionId);
        if (!production || !hasQuantities(settlement.stockpiles, production.inputs)) {
          continue;
        }

        for (const input of production.inputs) {
          settlement.stockpiles[input.itemId] -= input.quantity;
        }
        for (const output of production.outputs) {
          settlement.stockpiles[output.itemId] = (settlement.stockpiles[output.itemId] ?? 0) + output.quantity * production.efficiency;
        }
      }
    }
  }

  private runConsumption(): void {
    for (const settlement of this.settlements) {
      const populationScale = Math.max(1, settlement.population / 800);
      for (const itemId of settlement.consumption) {
        settlement.stockpiles[itemId] = Math.max(0, (settlement.stockpiles[itemId] ?? 0) - populationScale * 0.55);
      }
      settlement.wealth = Math.max(200, settlement.wealth + Math.floor(settlement.population * 0.012 * settlement.stability));
    }
  }

  private runNpcTrade(): void {
    for (const [index, trader] of this.traders.entries()) {
      const route = this.tradeRoutes[(this.hour + index) % this.tradeRoutes.length];
      const origin = this.findSettlement(route.originId);
      const destination = this.findSettlement(route.destinationId);
      const goods = this.findProfitableGoods(origin, destination);
      const itemId = goods[0];
      if (!itemId) continue;

      const buyPrice = origin.prices[itemId] ?? this.getItem(itemId).basePrice;
      const sellPrice = destination.prices[itemId] ?? this.getItem(itemId).basePrice;
      const quantity = Math.max(1, Math.floor(Math.min(origin.stockpiles[itemId] ?? 0, trader.money / buyPrice, 6)));
      if (quantity <= 0 || sellPrice <= buyPrice) continue;

      const cost = Math.ceil(buyPrice * quantity);
      const revenue = Math.floor(sellPrice * quantity * (1 - route.risk * 0.12));
      origin.stockpiles[itemId] -= quantity;
      destination.stockpiles[itemId] = (destination.stockpiles[itemId] ?? 0) + quantity;
      trader.money += revenue - cost;
      trader.routeHistory.push(route.id);
      route.profit = Math.max(0, revenue - cost);
      route.traffic = clamp01(route.traffic + 0.02);
      if (trader.routeHistory.length > 10) trader.routeHistory.shift();
    }
  }

  private runPlayerAutoRoutes(): void {
    for (const route of this.player.autoRoutes) {
      if (!route.active) continue;

      const origin = this.findSettlement(route.originId);
      const destination = this.findSettlement(route.destinationId);
      const buyPrice = origin.prices[route.itemId] ?? this.getItem(route.itemId).basePrice;
      const sellPrice = destination.prices[route.itemId] ?? this.getItem(route.itemId).basePrice;
      const quantity = Math.max(1, Math.floor(Math.min(route.quantity, origin.stockpiles[route.itemId] ?? 0, this.player.money / buyPrice)));
      if (quantity <= 0 || sellPrice <= buyPrice) {
        route.profit = 0;
        continue;
      }

      const cost = Math.ceil(buyPrice * quantity);
      const revenue = Math.floor(sellPrice * quantity * (1 - route.risk * 0.1));
      const profit = revenue - cost;
      if (profit <= 0 || this.player.money < cost) {
        route.profit = 0;
        continue;
      }

      origin.stockpiles[route.itemId] -= quantity;
      destination.stockpiles[route.itemId] = (destination.stockpiles[route.itemId] ?? 0) + quantity;
      this.player.money += profit;
      route.profit = profit;
      route.completedRuns += 1;
      this.adjustReputation(destination.factionId, 1);
    }
  }

  private runPlayerColony(): void {
    const colony = this.player.colony;
    if (!colony) return;

    let balance = 0;
    const linkedSettlement = this.findSettlement(colony.linkedSettlementId);
    const taxIncome = Math.floor(colony.population * colony.taxes);
    balance += taxIncome;
    this.player.money += taxIncome;

    for (const buildingId of colony.buildings) {
      const building = this.buildingDefinitions.find(item => item.id === buildingId);
      if (!building) continue;

      balance -= building.taxCost;
      this.player.money = Math.max(0, this.player.money - building.taxCost);

      if (building.productionId) {
        const production = this.productionDefinitions.find(item => item.id === building.productionId);
        if (production && hasQuantities(this.player.warehouse, production.inputs)) {
          for (const input of production.inputs) {
            this.player.warehouse[input.itemId] -= input.quantity;
          }
          for (const output of production.outputs) {
            this.player.warehouse[output.itemId] = (this.player.warehouse[output.itemId] ?? 0) + output.quantity * production.efficiency;
          }
          balance += Math.ceil(production.outputs.reduce((sum, output) => {
            return sum + (this.getItem(output.itemId).basePrice * output.quantity * production.efficiency);
          }, 0) * 0.15);
        }
      }

      if (building.consumes) {
        for (const itemId of building.consumes) {
          if ((this.player.warehouse[itemId] ?? 0) >= 1) {
            this.player.warehouse[itemId] -= 1;
            colony.population += 0.05;
          }
        }
      }
    }

    const hasFood = (this.player.warehouse.grain ?? 0) > 0;
    if (hasFood) {
      this.player.warehouse.grain -= Math.min(this.player.warehouse.grain, colony.population / 500);
      colony.population += 0.03;
    } else {
      colony.population = Math.max(20, colony.population - 0.02);
    }

    colony.stockpiles = { ...this.player.warehouse };
    colony.routes = this.player.autoRoutes.map(route => route.id);
    colony.reputation = { ...this.player.reputation };
    colony.lastBalance = balance;
    linkedSettlement.wealth += Math.max(0, Math.floor(balance * 0.25));
  }

  private runWorldContextPulse(): void {
    if (this.hour % 6 !== 0 || !this.worldContext.linkedSettlementId) return;

    const settlement = this.findSettlement(this.worldContext.linkedSettlementId);
    const resourceOutputs: Record<string, string[]> = {
      WOOD: ['timber'],
      IRON: ['iron_ore'],
      COAL: ['coal'],
      STONE: ['stone'],
      GOLD: ['jewelry'],
    };

    let added = 0;
    for (const [resourceName, itemIds] of Object.entries(resourceOutputs)) {
      const amount = this.worldContext.nearbyResources[resourceName] ?? 0;
      if (amount <= 0) continue;

      for (const itemId of itemIds) {
        const yieldAmount = Math.max(1, Math.floor(amount * 0.4));
        settlement.stockpiles[itemId] = (settlement.stockpiles[itemId] ?? 0) + yieldAmount;
        added += yieldAmount;
      }
    }

    const structures = this.worldContext.nearbyStructures;
    if ((structures.VILLAGE ?? 0) > 0) {
      settlement.stability = clamp01(settlement.stability + 0.004);
      settlement.wealth += 8 * structures.VILLAGE;
    }
    if ((structures.TOWER ?? 0) > 0) {
      settlement.security = clamp01(settlement.security + 0.004);
    }
    if ((structures.RUINS ?? 0) > 0) {
      settlement.stability = clamp01(settlement.stability - 0.003);
      settlement.stockpiles.contracts = (settlement.stockpiles.contracts ?? 0) + structures.RUINS;
    }

    if (added > 0 || Object.keys(structures).length > 0) {
      this.pushLog('market', `${settlement.name} absorbed nearby world finds`);
      this.updatePrices();
    }
  }

  private checkDeficits(): void {
    for (const settlement of this.settlements) {
      const deficitPressure = settlement.consumption.reduce((pressure, itemId) => {
        const desired = Math.max(16, this.getDesiredStock(settlement, itemId) * 0.3);
        const stock = settlement.stockpiles[itemId] ?? 0;
        return stock < desired ? pressure + (desired - stock) / desired : pressure;
      }, 0);
      if (deficitPressure > 0) {
        settlement.stability = clamp01(settlement.stability - deficitPressure * 0.004);
      } else {
        settlement.stability = clamp01(settlement.stability + 0.002);
      }
    }
  }

  private getCrisisSnapshot(): EconomySnapshot['crisis'] {
    const shortages = this.getShortageSignals(8);
    const eventPressure = this.activeEvents.reduce((sum, event) => sum + event.severity, 0);
    const shortagePressure = shortages.reduce((sum, shortage) => sum + shortage.severity, 0);
    const level = round2(clamp(0, 100, eventPressure * 18 + shortagePressure * 7));
    const label = level >= 70 ? 'Collapse Risk' : level >= 45 ? 'Crisis' : level >= 20 ? 'Stressed' : 'Stable';
    return { level, label, shortages };
  }

  private getIntelSnapshot(): EconomySnapshot['intel'] {
    const factionIntel: Record<string, number> = {};
    for (const faction of this.factions) {
      const reputation = this.player.reputation[faction.id] ?? 0;
      const acceptedContracts = this.contracts.filter(contract => {
        return contract.accepted && !contract.completed && !contract.failed && this.findSettlement(contract.issuer).factionId === faction.id;
      }).length;
      const colonyBonus = this.player.colony && this.findSettlement(this.player.colony.linkedSettlementId).factionId === faction.id ? 12 : 0;
      factionIntel[faction.id] = clamp(0, 100, 18 + reputation * 0.7 + faction.influence * 0.18 + acceptedContracts * 6 + colonyBonus + this.player.intelNetwork * 0.26);
    }

    const routeBonus = this.player.autoRoutes.length * 4;
    const average = Object.values(factionIntel).reduce((sum, value) => sum + value, 0) / Math.max(1, this.factions.length);
    const level = round2(clamp(0, 100, average + routeBonus + this.player.intelNetwork * 0.42));
    const label = level >= 72 ? 'Regional Ledger' : level >= 48 ? 'Broker Network' : level >= 24 ? 'Market Notes' : 'Rumors';
    return { level, label, network: round2(this.player.intelNetwork), factionIntel };
  }

  private getWorldLinkedSettlementId(context: WorldEconomyContext): string {
    if (this.settlements.length === 0) return '';
    const index = Math.abs(hashNumber(this.seed + context.chunk.x * 73856093 + context.chunk.y * 19349663)) % this.settlements.length;
    return this.settlements[index].id;
  }

  private getWorldContextSignature(context: WorldEconomyContext): string {
    const resourceSignature = Object.entries(context.nearbyResources)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}:${Math.round(value)}`)
      .join(',');
    const structureSignature = Object.entries(context.nearbyStructures)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}:${Math.round(value)}`)
      .join(',');
    return `${context.chunk.x},${context.chunk.y}|${context.localBiome ?? ''}|${resourceSignature}|${structureSignature}`;
  }

  private createEmptyWorldContext(): WorldEconomyContext {
    return {
      position: { x: 0, z: 0 },
      chunk: { x: 0, y: 0 },
      loadedChunkCount: 0,
      exploredChunkCount: 0,
      nearbyResources: {},
      nearbyStructures: {},
    };
  }

  private cloneWorldContext(): WorldEconomyContext {
    return {
      ...this.worldContext,
      position: { ...this.worldContext.position },
      chunk: { ...this.worldContext.chunk },
      nearbyResources: { ...this.worldContext.nearbyResources },
      nearbyStructures: { ...this.worldContext.nearbyStructures },
    };
  }

  private matchesBiome(biome: string, names: string[]): boolean {
    return names.some(name => biome.toUpperCase().includes(name));
  }

  private getCorporationSnapshot(): EconomySnapshot['corporation'] {
    const routeValue = this.player.autoRoutes.reduce((sum, route) => sum + route.completedRuns * Math.max(1, route.quantity), 0);
    const colonyValue = this.player.colony ? this.player.colony.population * 2 + this.player.colony.buildings.length * 75 : 0;
    const capitalValue = this.player.money / 25;
    const influence = round2(clamp(0, 100, capitalValue + routeValue / 10 + colonyValue / 10));
    const tier = influence >= 75 ? 'Regional Power' : influence >= 45 ? 'Consortium' : influence >= 20 ? 'Company' : 'Operator';
    const marketShare: Record<string, number> = {};

    for (const faction of this.factions) {
      const factionSettlements = this.settlements.filter(settlement => settlement.factionId === faction.id);
      const linkedColony = this.player.colony && factionSettlements.some(settlement => settlement.id === this.player.colony?.linkedSettlementId) ? 8 : 0;
      const routeShare = this.player.autoRoutes.filter(route => {
        return factionSettlements.some(settlement => settlement.id === route.originId || settlement.id === route.destinationId);
      }).length * 4;
      marketShare[faction.id] = round2(clamp(0, 100, linkedColony + routeShare + (this.player.reputation[faction.id] ?? 0) * 0.2));
    }

    return { tier, influence, marketShare };
  }

  private checkEvents(): void {
    this.activeEvents = this.activeEvents
      .map(event => ({ ...event, remainingHours: event.remainingHours - 1 }))
      .filter(event => event.remainingHours > 0);

    if (this.hour % 12 !== 0 || this.activeEvents.length >= 4) {
      this.syncSettlementEvents();
      return;
    }

    const roll = random01(this.seed + this.hour, 301);
    if (roll > 0.52) {
      const definition = this.eventDefinitions[Math.floor(random01(this.seed + this.hour, 302) * this.eventDefinitions.length)];
      const settlement = this.settlements[Math.floor(random01(this.seed + this.hour, 303) * this.settlements.length)];
      this.activeEvents.push({
        id: `event-${this.hour}-${definition.id}`,
        definitionId: definition.id,
        type: definition.type,
        name: definition.name,
        targetSettlementId: settlement.id,
        targetRegion: settlement.name,
        trigger: this.getEventTrigger(definition.type),
        actor: this.findFaction(settlement.factionId).name,
        location: settlement.name,
        modifier: this.getEventModifier(definition.severity),
        outcome: this.getEventOutcome(definition),
        remainingHours: definition.durationHours,
        severity: definition.severity,
        causes: [definition.type, settlement.factionId],
        effects: { ...definition.effects },
      });
      this.pushLog('event', `${definition.name} at ${settlement.name}`);
    }
    this.syncSettlementEvents();
  }

  private syncSettlementEvents(): void {
    for (const settlement of this.settlements) {
      settlement.activeEvents = this.activeEvents
        .filter(event => event.targetSettlementId === settlement.id)
        .map(event => event.id);
    }
  }

  private updatePrices(): void {
    for (const settlement of this.settlements) {
      for (const item of this.items) {
        const stock = settlement.stockpiles[item.id] ?? 0;
        const desired = this.getDesiredStock(settlement, item.id);
        const faction = this.findFaction(settlement.factionId);
        const demandFactor = (settlement.consumption.includes(item.id) ? 1.18 : 0.95)
          * this.getEventEffectFactor(settlement.id, item.id, 'demand')
          * this.getWorldDemandFactor(settlement.id, item.id);
        const supplyFactor = this.getEventEffectFactor(settlement.id, item.id, 'supply')
          * this.getWorldSupplyFactor(settlement.id, item.id);
        const scarcityFactor = clamp(0.65, 2.4, desired / Math.max(1, stock * supplyFactor));
        const riskFactor = (1 + (1 - settlement.security) * 0.18)
          * this.getEventEffectFactor(settlement.id, item.id, 'risk')
          * this.getFactionRiskFactor(faction);
        const seasonFactor = 1 + Math.sin((this.hour / 24 + item.id.length) * Math.PI / 18) * 0.04;
        const eventFactor = this.getEventEffectFactor(settlement.id, item.id, 'price');
        const lawFactor = this.getFactionPriceFactor(faction, item);
        settlement.prices[item.id] = round2(item.basePrice * demandFactor * scarcityFactor * riskFactor * seasonFactor * eventFactor * lawFactor);
        this.priceHistory.push({
          hour: this.hour,
          settlementId: settlement.id,
          itemId: item.id,
          price: settlement.prices[item.id],
        });
      }
    }
    if (this.priceHistory.length > HISTORY_LIMIT) {
      this.priceHistory.splice(0, this.priceHistory.length - HISTORY_LIMIT);
    }
  }

  private refreshTradeRoutes(): void {
    for (const route of this.tradeRoutes) {
      const origin = this.findSettlement(route.originId);
      const destination = this.findSettlement(route.destinationId);
      route.goods = this.findProfitableGoods(origin, destination).slice(0, 4);
      const routeEventTraffic = Math.max(
        this.getSettlementTrafficFactor(origin.id),
        this.getSettlementTrafficFactor(destination.id)
      );
      route.traffic = clamp01(route.traffic * 0.96 + 0.02 * routeEventTraffic);
    }
  }

  private updateContracts(): void {
    for (const contract of this.contracts) {
      if (contract.accepted && !contract.completed && !contract.failed && contract.deadlineHour < this.hour) {
        contract.failed = true;
        const issuerFactionId = this.findSettlement(contract.issuer).factionId;
        this.adjustReputation(issuerFactionId, -5);
        this.applyContractFailure(contract);
        this.pushLog('contract', `${contract.type} failed: ${this.getItem(contract.itemId).name} x${contract.quantity}`);
      }
    }

    this.contracts = this.contracts.filter(contract => {
      return contract.completed || contract.failed || contract.accepted || contract.deadlineHour >= this.hour;
    });
    const openCount = this.contracts.filter(contract => !contract.accepted && !contract.completed && !contract.failed).length;
    for (let index = openCount; index < 8; index++) {
      this.contracts.push(this.createContract(index + this.hour));
    }
  }

  private getDesiredStock(settlement: Settlement, itemId: string): number {
    const item = this.getItem(itemId);
    const base = item.category === 'raw' ? 80 : item.category === 'industrial' ? 48 : 24;
    return base + settlement.population / 25 + (settlement.consumption.includes(itemId) ? 55 : 0);
  }

  private getEventEffectFactor(
    settlementId: string,
    itemId: string,
    effect: 'demand' | 'supply' | 'risk' | 'price'
  ): number {
    return this.activeEvents
      .filter(event => event.targetSettlementId === settlementId && this.eventDefinitions.find(definition => definition.id === event.definitionId)?.targetGoods.includes(itemId))
      .reduce((factor, event) => factor * (event.effects[effect] ?? 1), 1);
  }

  private getWorldSupplyFactor(settlementId: string, itemId: string): number {
    if (settlementId !== this.worldContext.linkedSettlementId) return 1;

    let factor = 1;
    const resources = this.worldContext.nearbyResources;
    const biome = this.worldContext.localBiome ?? this.worldContext.dominantBiome ?? '';
    if ((resources.WOOD ?? 0) > 0 && ['timber', 'planks'].includes(itemId)) factor *= 1.22;
    if ((resources.IRON ?? 0) > 0 && ['iron_ore', 'steel', 'tools'].includes(itemId)) factor *= 1.2;
    if ((resources.COAL ?? 0) > 0 && ['coal', 'fuel', 'steel'].includes(itemId)) factor *= 1.18;
    if ((resources.STONE ?? 0) > 0 && ['stone', 'bricks'].includes(itemId)) factor *= 1.16;
    if ((resources.GOLD ?? 0) > 0 && ['jewelry', 'contracts'].includes(itemId)) factor *= 1.12;
    if (this.matchesBiome(biome, ['FOREST', 'TAIGA', 'RAINFOREST']) && ['timber', 'hides'].includes(itemId)) factor *= 1.1;
    if (this.matchesBiome(biome, ['MOUNTAIN', 'POLAR']) && ['iron_ore', 'coal', 'stone'].includes(itemId)) factor *= 1.1;
    if (this.matchesBiome(biome, ['OCEAN', 'BEACH', 'SWAMP']) && ['fish', 'salt'].includes(itemId)) factor *= 1.1;
    if (this.matchesBiome(biome, ['PLAINS', 'STEPPE', 'SAVANNA']) && ['grain', 'hides'].includes(itemId)) factor *= 1.08;
    return factor;
  }

  private getWorldDemandFactor(settlementId: string, itemId: string): number {
    if (settlementId !== this.worldContext.linkedSettlementId) return 1;

    let factor = 1;
    const structures = this.worldContext.nearbyStructures;
    if ((structures.VILLAGE ?? 0) > 0 && ['grain', 'tools', 'textiles', 'medicine'].includes(itemId)) factor *= 1.1;
    if ((structures.RUINS ?? 0) > 0 && ['books', 'medicine', 'contracts'].includes(itemId)) factor *= 1.08;
    if ((structures.TOWER ?? 0) > 0 && ['tools', 'fuel', 'contracts'].includes(itemId)) factor *= 1.08;
    return factor;
  }

  private getSettlementTrafficFactor(settlementId: string): number {
    return this.activeEvents
      .filter(event => event.targetSettlementId === settlementId)
      .reduce((factor, event) => factor * (event.effects.traffic ?? 1), 1);
  }

  private getEventTrigger(type: ActiveEconomyEvent['type']): string {
    switch (type) {
      case 'Economic':
        return 'market pressure';
      case 'Social':
        return 'public unrest';
      case 'Political':
        return 'policy shift';
      case 'Trade':
        return 'route disruption';
      case 'Rare':
        return 'frontier shock';
    }
  }

  private getEventModifier(severity: number): string {
    if (severity >= 0.45) return 'severe';
    if (severity >= 0.3) return 'volatile';
    return 'localized';
  }

  private getEventOutcome(definition: ActiveEconomyEvent | { effects: ActiveEconomyEvent['effects']; name: string }): string {
    if ((definition.effects.price ?? 1) > 1.05) return 'prices rising';
    if ((definition.effects.price ?? 1) < 0.98) return 'prices easing';
    if ((definition.effects.risk ?? 1) > 1.05) return 'risk climbing';
    if ((definition.effects.traffic ?? 1) > 1.05) return 'traffic surging';
    return definition.name;
  }

  private getFactionPriceFactor(faction: FactionDefinition, item: ItemDefinition): number {
    let factor = 1;
    if (faction.laws.includes('open_trade')) factor *= 0.96;
    if (faction.laws.includes('ore_tariffs') && ['iron_ore', 'coal', 'steel'].includes(item.id)) factor *= 1.12;
    if (faction.laws.includes('harbor_dues') && ['fish', 'timber', 'fuel'].includes(item.id)) factor *= 1.08;
    if (faction.laws.includes('settler_grants') && ['bricks', 'planks', 'tools'].includes(item.id)) factor *= 0.94;
    return factor;
  }

  private getFactionRiskFactor(faction: FactionDefinition): number {
    const relationAverage = Object.values(faction.relationships ?? {}).reduce((sum, value) => sum + value, 0)
      / Math.max(1, Object.values(faction.relationships ?? {}).length);
    const militaryStability = clamp(0.88, 1.08, 1 - faction.militaryPower / 1000);
    return clamp(0.85, 1.25, (1 - relationAverage / 400) * militaryStability);
  }

  private findProfitableGoods(origin: Settlement, destination: Settlement): string[] {
    return this.items
      .map(item => ({
        id: item.id,
        margin: (destination.prices[item.id] ?? item.basePrice) - (origin.prices[item.id] ?? item.basePrice),
      }))
      .filter(item => item.margin > 0)
      .sort((a, b) => b.margin - a.margin)
      .map(item => item.id);
  }

  private findBestDestination(origin: Settlement, itemId: string): Settlement | null {
    const originPrice = origin.prices[itemId] ?? this.getItem(itemId).basePrice;
    return this.settlements
      .filter(settlement => settlement.id !== origin.id)
      .map(settlement => ({
        settlement,
        margin: (settlement.prices[itemId] ?? this.getItem(itemId).basePrice) - originPrice,
      }))
      .filter(candidate => candidate.margin > 0)
      .sort((a, b) => b.margin - a.margin)[0]?.settlement ?? null;
  }

  private findSettlement(id: string): Settlement {
    const settlement = this.settlements.find(item => item.id === id);
    if (!settlement) throw new Error(`Unknown settlement: ${id}`);
    return settlement;
  }

  private getItem(id: string): ItemDefinition {
    const item = this.items.find(entry => entry.id === id);
    if (!item) throw new Error(`Unknown item: ${id}`);
    return item;
  }

  private findFaction(id: string): FactionDefinition {
    const faction = this.factions.find(entry => entry.id === id);
    if (!faction) throw new Error(`Unknown faction: ${id}`);
    return faction;
  }

  private adjustReputation(factionId: string, amount: number): void {
    const before = this.player.reputation[factionId] ?? 0;
    const after = clamp(-100, 100, before + amount);
    this.player.reputation[factionId] = after;
    if (Math.abs(after - before) >= 4) {
      this.pushLog('faction', `${this.findFaction(factionId).name} reputation ${after >= before ? '+' : ''}${Math.round(after - before)}`);
    }
  }

  private getWarehouseUsed(): number {
    return Object.values(this.player.warehouse).reduce((sum, quantity) => sum + quantity, 0);
  }

  private getWarehouseCapacity(): number {
    const colony = this.player.colony;
    if (!colony) return 600;

    return colony.buildings.reduce((capacity, buildingId) => {
      const building = this.buildingDefinitions.find(item => item.id === buildingId);
      return capacity + (building?.storageBonus ?? 0);
    }, 600);
  }

  private pushLog(type: EconomyLogEntry['type'], message: string): void {
    this.economyLog.push({ hour: this.hour, type, message });
    if (this.economyLog.length > ECONOMY_LOG_LIMIT) {
      this.economyLog.splice(0, this.economyLog.length - ECONOMY_LOG_LIMIT);
    }
  }
}

function cloneSettlement(settlement: Settlement): Settlement {
  return {
    ...settlement,
    traits: [...(settlement.traits ?? [])],
    stockpiles: { ...settlement.stockpiles },
    production: [...settlement.production],
    consumption: [...settlement.consumption],
    activeEvents: [...settlement.activeEvents],
    reputationMap: { ...settlement.reputationMap },
    prices: { ...settlement.prices },
  };
}

function cloneFaction(faction: FactionDefinition): FactionDefinition {
  return {
    ...faction,
    territory: [...(faction.territory ?? [])],
    laws: [...faction.laws],
    relationships: { ...(faction.relationships ?? {}) },
  };
}

function cloneColony(colony: NonNullable<PlayerEconomy['colony']>): NonNullable<PlayerEconomy['colony']> {
  return {
    ...colony,
    buildings: [...colony.buildings],
    stockpiles: { ...colony.stockpiles },
    routes: [...colony.routes],
    reputation: { ...colony.reputation },
  };
}

function hasQuantities(stockpiles: Record<string, number>, quantities: Array<{ itemId: string; quantity: number }>): boolean {
  return quantities.every(quantity => (stockpiles[quantity.itemId] ?? 0) >= quantity.quantity);
}

function hashNumber(value: number): number {
  let result = value | 0;
  result ^= result << 13;
  result ^= result >>> 17;
  result ^= result << 5;
  return Math.abs(result);
}

function random01(seed: number, salt: number): number {
  const value = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function clamp01(value: number): number {
  return clamp(0, 1, value);
}

function clamp(min: number, max: number, value: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
