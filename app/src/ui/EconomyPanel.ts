import type { WorldApp, AppState, Unsubscribe } from '../core/WorldApp';
import type { Contract, EconomySnapshot, ItemDefinition, Settlement } from '../economy';

const ECONOMY_STORAGE_KEY = 'tqandtd.journeyEconomy.v1';
const ECONOMY_AUTOSAVE_KEY = 'tqandtd.journeyEconomy.autosave.v1';
const BUILDING_COSTS: Record<string, number> = {
  warehouse: 350,
  sawmill: 520,
  foundry: 760,
  clinic: 430,
};

export class EconomyPanel {
  private app: WorldApp | null = null;
  private container: HTMLElement | null = null;
  private readout: HTMLElement | null = null;
  private unsubscribe: Unsubscribe | null = null;
  private selectedSettlementId = '';
  private selectedItemId = '';
  private quantity = 5;
  private lastSnapshot: EconomySnapshot | null = null;
  private lastAutosaveHour = -1;

  initialize(container: HTMLElement, app: WorldApp): void {
    this.container = container;
    this.readout = document.getElementById('journey-economy-readout');
    this.app = app;
    const snapshot = app.getEconomySnapshot();
    this.selectedSettlementId = snapshot.settlements[0]?.id ?? '';
    this.selectedItemId = snapshot.items[0]?.id ?? '';
    this.render(snapshot);
    this.unsubscribe = app.subscribeToState((state: AppState) => {
      if (state.economy === this.lastSnapshot) {
        return;
      }
      if (this.hasFocusedControl()) {
        this.updateReadout(state.economy);
        this.lastSnapshot = state.economy;
        return;
      }
      this.render(state.economy);
    });
  }

  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.container = null;
    this.readout = null;
    this.app = null;
    this.lastSnapshot = null;
    this.lastAutosaveHour = -1;
  }

  private render(snapshot: EconomySnapshot): void {
    if (!this.container) return;

    const settlement = snapshot.settlements.find(item => item.id === this.selectedSettlementId) ?? snapshot.settlements[0];
    const item = snapshot.items.find(entry => entry.id === this.selectedItemId) ?? snapshot.items[0];
    if (!settlement || !item) return;

    this.selectedSettlementId = settlement.id;
    this.selectedItemId = item.id;
    this.lastSnapshot = snapshot;

    this.container.innerHTML = '';
    this.updateReadout(snapshot);
    this.autosaveEconomy(snapshot);
    this.container.appendChild(this.createSummary(snapshot));
    this.container.appendChild(this.createTradeControls(snapshot, settlement, item));
    this.container.appendChild(this.createWorldLink(snapshot));
    this.container.appendChild(this.createMarketList(snapshot, settlement));
    this.container.appendChild(this.createPriceTrend(snapshot, settlement, item));
    this.container.appendChild(this.createMarketIntel(snapshot));
    this.container.appendChild(this.createRouteIntel(snapshot, settlement));
    this.container.appendChild(this.createAutoRoutes(snapshot));
    this.container.appendChild(this.createNpcTraders(snapshot));
    this.container.appendChild(this.createColony(snapshot, settlement));
    this.container.appendChild(this.createContracts(snapshot));
    this.container.appendChild(this.createFactionIntel(snapshot));
    this.container.appendChild(this.createDataManifest(snapshot));
    this.container.appendChild(this.createEvents(snapshot));
    this.container.appendChild(this.createCrisis(snapshot));
    this.container.appendChild(this.createEconomyLog(snapshot));
  }

  private createSummary(snapshot: EconomySnapshot): HTMLElement {
    const section = createSection('FRONTIER ECONOMY');
    section.appendChild(metric('Hour', snapshot.hour.toString()));
    section.appendChild(metric('Credits', Math.floor(snapshot.player.money).toLocaleString('en-US')));
    section.appendChild(metric('Open Contracts', snapshot.contracts.filter(contract => !contract.completed).length.toString()));
    section.appendChild(metric('Active Events', snapshot.activeEvents.length.toString()));
    section.appendChild(metric('Crisis', `${snapshot.crisis.label} ${Math.round(snapshot.crisis.level)}`));
    section.appendChild(metric('Intel', `${snapshot.intel.label} ${Math.round(snapshot.intel.level)}`));
    section.appendChild(metric('Corporation', `${snapshot.corporation.tier} ${Math.round(snapshot.corporation.influence)}`));
    section.appendChild(this.createInventory(snapshot));
    section.appendChild(this.createWarehouse(snapshot));

    const persistenceActions = document.createElement('div');
    persistenceActions.className = 'economy-actions';
    persistenceActions.appendChild(actionButton('Save Econ', () => this.saveEconomy()));
    persistenceActions.appendChild(actionButton('Load Econ', () => this.loadEconomy(ECONOMY_STORAGE_KEY)));
    persistenceActions.appendChild(actionButton('Load Auto', () => this.loadEconomy(ECONOMY_AUTOSAVE_KEY)));
    persistenceActions.appendChild(actionButton('Clear Save', () => localStorage.removeItem(ECONOMY_STORAGE_KEY)));
    section.appendChild(persistenceActions);

    return section;
  }

  private updateReadout(snapshot: EconomySnapshot): void {
    if (!this.readout) return;

    const activeRoutes = snapshot.player.autoRoutes.filter(route => route.active).length;
    this.readout.innerHTML = '';
    this.readout.appendChild(readoutItem('H', snapshot.hour.toString()));
    this.readout.appendChild(readoutItem('CR', Math.floor(snapshot.player.money).toLocaleString('en-US')));
    this.readout.appendChild(readoutItem('CT', snapshot.contracts.filter(contract => contract.accepted && !contract.completed).length.toString()));
    this.readout.appendChild(readoutItem('RT', activeRoutes.toString()));
    this.readout.appendChild(readoutItem('EV', snapshot.activeEvents.length.toString()));
    this.readout.appendChild(readoutItem('CS', Math.round(snapshot.crisis.level).toString()));
    this.readout.appendChild(readoutItem('IN', Math.round(snapshot.intel.level).toString()));
    this.readout.appendChild(readoutItem('CP', Math.round(snapshot.corporation.influence).toString()));
    if (snapshot.player.colony) {
      this.readout.appendChild(readoutItem('CL', Math.floor(snapshot.player.colony.population).toString()));
    }
  }

  private createInventory(snapshot: EconomySnapshot): HTMLElement {
    const inventory = document.createElement('div');
    inventory.className = 'economy-inventory';
    const entries = Object.entries(snapshot.player.inventory).filter(([, quantity]) => quantity > 0);
    inventory.textContent = entries.length === 0
      ? 'Cargo: empty'
      : `Cargo: ${entries.map(([itemId, quantity]) => `${this.getItemName(snapshot, itemId)} ${Math.floor(quantity)}`).join(', ')}`;
    return inventory;
  }

  private createWarehouse(snapshot: EconomySnapshot): HTMLElement {
    const warehouse = document.createElement('div');
    warehouse.className = 'economy-inventory';
    const entries = Object.entries(snapshot.player.warehouse).filter(([, quantity]) => quantity > 0);
    const used = entries.reduce((sum, [, quantity]) => sum + quantity, 0);
    const capacity = this.getWarehouseCapacity(snapshot);
    warehouse.textContent = entries.length === 0
      ? `Warehouse: empty / ${capacity}`
      : `Warehouse ${Math.floor(used)}/${capacity}: ${entries.map(([itemId, quantity]) => `${this.getItemName(snapshot, itemId)} ${Math.floor(quantity)}`).join(', ')}`;
    return warehouse;
  }

  private createTradeControls(snapshot: EconomySnapshot, settlement: Settlement, item: ItemDefinition): HTMLElement {
    const section = createSection('TRADE DESK');

    const settlementSelect = document.createElement('select');
    settlementSelect.className = 'economy-select';
    for (const entry of snapshot.settlements) {
      const option = document.createElement('option');
      option.value = entry.id;
      option.textContent = entry.name;
      option.selected = entry.id === settlement.id;
      settlementSelect.appendChild(option);
    }
    settlementSelect.addEventListener('change', () => {
      this.selectedSettlementId = settlementSelect.value;
      this.render(this.app?.getEconomySnapshot() ?? snapshot);
    });

    const itemSelect = document.createElement('select');
    itemSelect.className = 'economy-select';
    for (const entry of snapshot.items) {
      const option = document.createElement('option');
      option.value = entry.id;
      option.textContent = entry.name;
      option.selected = entry.id === item.id;
      itemSelect.appendChild(option);
    }
    itemSelect.addEventListener('change', () => {
      this.selectedItemId = itemSelect.value;
      this.render(this.app?.getEconomySnapshot() ?? snapshot);
    });

    const quantityInput = document.createElement('input');
    quantityInput.className = 'economy-number';
    quantityInput.type = 'number';
    quantityInput.min = '1';
    quantityInput.max = '99';
    quantityInput.value = this.quantity.toString();
    quantityInput.addEventListener('change', () => {
      this.quantity = Math.max(1, Math.floor(Number(quantityInput.value) || 1));
    });

    const price = settlement.prices[item.id] ?? item.basePrice;
    const traits = (settlement.traits ?? []).map(formatTrait).join(', ') || 'Standard';
    section.appendChild(labeled('Settlement', settlementSelect));
    section.appendChild(labeled('Good', itemSelect));
    section.appendChild(labeled('Qty', quantityInput));
    section.appendChild(metric('Traits', traits));
    section.appendChild(metric('Unit Price', price.toFixed(2)));
    section.appendChild(metric('Stock', Math.floor(settlement.stockpiles[item.id] ?? 0).toString()));

    const actions = document.createElement('div');
    actions.className = 'economy-actions';
    actions.appendChild(actionButton('Buy', () => this.app?.buyEconomyGoods(settlement.id, item.id, this.quantity)));
    actions.appendChild(actionButton('Sell', () => this.app?.sellEconomyGoods(settlement.id, item.id, this.quantity)));
    actions.appendChild(actionButton('+1h', () => this.app?.advanceEconomy(1)));
    section.appendChild(actions);

    const storageActions = document.createElement('div');
    storageActions.className = 'economy-actions';
    storageActions.appendChild(actionButton('Deposit', () => this.app?.depositEconomyGoods(item.id, this.quantity)));
    storageActions.appendChild(actionButton('Withdraw', () => this.app?.withdrawEconomyGoods(item.id, this.quantity)));
    storageActions.appendChild(actionButton('Charter', () => this.app?.charterEconomyAutoRoute(settlement.id, item.id, this.quantity)));
    section.appendChild(storageActions);

    const timeActions = document.createElement('div');
    timeActions.className = 'economy-actions';
    timeActions.appendChild(actionButton('+12h', () => this.app?.advanceEconomy(12)));
    timeActions.appendChild(actionButton('+24h', () => this.app?.advanceEconomy(24)));
    section.appendChild(timeActions);

    return section;
  }

  private createMarketList(snapshot: EconomySnapshot, settlement: Settlement): HTMLElement {
    const section = createSection('MARKET SIGNALS');
    const rows = snapshot.items
      .map(item => ({
        item,
        price: settlement.prices[item.id] ?? item.basePrice,
        stock: settlement.stockpiles[item.id] ?? 0,
      }))
      .sort((a, b) => b.price - a.price)
      .slice(0, 8);

    for (const row of rows) {
      const line = document.createElement('button');
      line.className = 'economy-market-row';
      line.type = 'button';
      line.title = `Select ${row.item.name}`;
      line.addEventListener('click', () => {
        this.selectedItemId = row.item.id;
        this.render(snapshot);
      });
      line.appendChild(span('metric-label', row.item.name));
      line.appendChild(span('metric-value', `${row.price.toFixed(0)} / ${Math.floor(row.stock)}`));
      section.appendChild(line);
    }
    return section;
  }

  private createWorldLink(snapshot: EconomySnapshot): HTMLElement {
    const section = createSection('WORLD LINK');
    const world = snapshot.world;
    section.appendChild(metric('Chunk', `${world.chunk.x}, ${world.chunk.y}`));
    section.appendChild(metric('Linked Market', world.linkedSettlementId ? this.getSettlementName(snapshot, world.linkedSettlementId) : 'Unlinked'));
    section.appendChild(metric('Biome', world.localBiome ?? world.dominantBiome ?? 'Unknown'));
    section.appendChild(metric('Loaded / Explored', `${world.loadedChunkCount} / ${world.exploredChunkCount}`));

    const resources = this.formatCounts(world.nearbyResources);
    const structures = this.formatCounts(world.nearbyStructures);
    section.appendChild(metric('Resources', resources || 'None nearby'));
    section.appendChild(metric('Structures', structures || 'None nearby'));
    return section;
  }

  private createMarketIntel(snapshot: EconomySnapshot): HTMLElement {
    const section = createSection('MARKET INTEL');
    section.appendChild(metric('Quality', `${snapshot.intel.label} ${Math.round(snapshot.intel.level)}`));
    section.appendChild(metric('Network', `${Math.round(snapshot.intel.network)} / 100`));
    const reportButton = actionButton('Buy Report 120', () => this.app?.fundEconomyIntelNetwork());
    if (snapshot.player.money < 120 || snapshot.intel.network >= 100) {
      reportButton.disabled = true;
      reportButton.title = snapshot.intel.network >= 100 ? 'Intel network is complete' : 'Need 120 credits';
    }
    section.appendChild(reportButton);
    const limit = snapshot.intel.level >= 72 ? 7 : snapshot.intel.level >= 48 ? 5 : snapshot.intel.level >= 24 ? 3 : 1;
    const opportunities = this.findArbitrage(snapshot).slice(0, limit);
    const shortageLeads = this.findShortageLeads(snapshot).slice(0, snapshot.intel.level >= 48 ? 3 : 1);
    const eventLeads = this.findEventLeads(snapshot).slice(0, snapshot.intel.level >= 72 ? 3 : snapshot.intel.level >= 48 ? 2 : 1);

    if (opportunities.length === 0 && shortageLeads.length === 0 && eventLeads.length === 0) {
      section.appendChild(span('metric-label', 'No profitable spreads detected'));
      return section;
    }

    for (const opportunity of opportunities) {
      const row = document.createElement('button');
      row.className = 'economy-market-row';
      row.type = 'button';
      row.title = `Select ${opportunity.itemName} at ${opportunity.originName}`;
      row.addEventListener('click', () => {
        this.selectedSettlementId = opportunity.originId;
        this.selectedItemId = opportunity.itemId;
        this.render(snapshot);
      });
      row.appendChild(span('metric-label', `${opportunity.itemName}: ${opportunity.originName}`));
      row.appendChild(span('metric-value', `+${opportunity.margin.toFixed(0)} -> ${opportunity.destinationName}`));
      section.appendChild(row);
    }

    for (const lead of shortageLeads) {
      const row = document.createElement('button');
      row.className = 'economy-market-row';
      row.type = 'button';
      row.title = `Select ${lead.itemName} shortage at ${lead.settlementName}`;
      row.addEventListener('click', () => {
        this.selectedSettlementId = lead.settlementId;
        this.selectedItemId = lead.itemId;
        this.render(snapshot);
      });
      row.appendChild(span('metric-label', `${lead.itemName}: ${lead.settlementName}`));
      row.appendChild(span('metric-value', `Short ${Math.round(lead.severity * 100)}%`));
      section.appendChild(row);
    }

    for (const lead of eventLeads) {
      const row = document.createElement('button');
      row.className = 'economy-market-row';
      row.type = 'button';
      row.title = `Select ${lead.itemName} impacted by ${lead.eventName}`;
      row.addEventListener('click', () => {
        this.selectedSettlementId = lead.settlementId;
        this.selectedItemId = lead.itemId;
        this.render(snapshot);
      });
      row.appendChild(span('metric-label', `${lead.itemName}: ${lead.eventName}`));
      row.appendChild(span('metric-value', lead.detail));
      section.appendChild(row);
    }

    return section;
  }

  private createPriceTrend(snapshot: EconomySnapshot, settlement: Settlement, item: ItemDefinition): HTMLElement {
    const section = createSection('PRICE TREND');
    const history = snapshot.priceHistory
      .filter(entry => entry.settlementId === settlement.id && entry.itemId === item.id)
      .slice(-8);

    if (history.length === 0) {
      section.appendChild(span('metric-label', 'No price history yet'));
      return section;
    }

    const first = history[0].price;
    const last = history[history.length - 1].price;
    const delta = last - first;
    section.appendChild(metric('Market', `${settlement.name} / ${item.name}`));
    section.appendChild(metric('Last', last.toFixed(2)));
    section.appendChild(metric('Delta', `${delta >= 0 ? '+' : ''}${delta.toFixed(2)}`));

    const spark = document.createElement('div');
    spark.className = 'economy-sparkline';
    const max = Math.max(...history.map(entry => entry.price));
    const min = Math.min(...history.map(entry => entry.price));
    for (const entry of history) {
      const bar = document.createElement('span');
      bar.className = 'economy-sparkline-bar';
      const normalized = max === min ? 0.5 : (entry.price - min) / (max - min);
      bar.style.height = `${Math.max(4, Math.round(4 + normalized * 24))}px`;
      bar.title = `H${entry.hour}: ${entry.price.toFixed(2)}`;
      spark.appendChild(bar);
    }
    section.appendChild(spark);
    return section;
  }

  private createNpcTraders(snapshot: EconomySnapshot): HTMLElement {
    const section = createSection('NPC TRADERS');
    const traders = snapshot.traders
      .slice()
      .sort((a, b) => b.money - a.money)
      .slice(0, 5);

    if (traders.length === 0) {
      section.appendChild(span('metric-label', 'No NPC traders'));
      return section;
    }

    for (const trader of traders) {
      const row = document.createElement('div');
      row.className = 'economy-intel-row';
      const lastRoute = trader.routeHistory[trader.routeHistory.length - 1] ?? 'idle';
      row.appendChild(span('metric-label', `${trader.name} / ${trader.goal}`));
      row.appendChild(span('metric-value', `${Math.floor(trader.money)} / ${lastRoute}`));
      section.appendChild(row);
    }
    return section;
  }

  private createAutoRoutes(snapshot: EconomySnapshot): HTMLElement {
    const section = createSection('AUTO ROUTES');
    if (snapshot.player.autoRoutes.length === 0) {
      section.appendChild(span('metric-label', 'No chartered logistics'));
      return section;
    }

    for (const route of snapshot.player.autoRoutes.slice(-5).reverse()) {
      const row = document.createElement('div');
      row.className = 'economy-contract';
      const title = document.createElement('div');
      title.className = 'economy-contract-title';
      title.textContent = `${this.getItemName(snapshot, route.itemId)} x${route.quantity}`;
      row.appendChild(title);
      row.appendChild(metric('Lane', `${this.getSettlementName(snapshot, route.originId)} -> ${this.getSettlementName(snapshot, route.destinationId)}`));
      row.appendChild(metric('Last Profit', route.profit.toLocaleString('en-US')));
      row.appendChild(metric('Runs', route.completedRuns.toString()));
      row.appendChild(actionButton(route.active ? 'Pause' : 'Resume', () => this.app?.toggleEconomyAutoRoute(route.id)));
      section.appendChild(row);
    }
    return section;
  }

  private createRouteIntel(snapshot: EconomySnapshot, settlement: Settlement): HTMLElement {
    const section = createSection('ROUTE INTEL');
    const factionId = settlement.factionId;
    const factionIntel = snapshot.intel.factionIntel[factionId] ?? 0;
    section.appendChild(metric('Local Intel', `${Math.round(factionIntel)}`));
    const rows = snapshot.tradeRoutes
      .filter(route => route.originId === settlement.id || route.destinationId === settlement.id)
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 4);

    if (rows.length === 0) {
      section.appendChild(span('metric-label', 'No active routes'));
      return section;
    }

    for (const route of rows) {
      const origin = snapshot.settlements.find(item => item.id === route.originId)?.name ?? route.originId;
      const destination = snapshot.settlements.find(item => item.id === route.destinationId)?.name ?? route.destinationId;
      const row = document.createElement('div');
      row.className = 'economy-intel-row';
      row.appendChild(span('metric-label', `${origin} -> ${destination}`));
      const value = factionIntel >= 45
        ? `P${Math.floor(route.profit)} R${Math.round(route.risk * 100)}%`
        : `Traffic ${Math.round(route.traffic * 100)}%`;
      row.appendChild(span('metric-value', value));
      section.appendChild(row);
    }
    return section;
  }

  private createContracts(snapshot: EconomySnapshot): HTMLElement {
    const section = createSection('CONTRACT BOARD');
    const activeContracts = snapshot.contracts
      .filter(contract => !contract.completed && !contract.failed)
      .sort((a, b) => Number(b.accepted) - Number(a.accepted));
    const outcomeContracts = snapshot.contracts
      .filter(contract => contract.completed || contract.failed)
      .slice(-3)
      .reverse();
    const contracts = [...activeContracts, ...outcomeContracts].slice(0, 5);

    if (contracts.length === 0) {
      section.appendChild(span('metric-label', 'No contracts available'));
      return section;
    }

    for (const contract of contracts) {
      section.appendChild(this.createContractRow(snapshot, contract));
    }
    return section;
  }

  private createColony(snapshot: EconomySnapshot, settlement: Settlement): HTMLElement {
    const section = createSection('COLONY');
    const colony = snapshot.player.colony;

    if (!colony) {
      section.appendChild(metric('Charter Cost', '900'));
      section.appendChild(metric('Linked Market', settlement.name));
      section.appendChild(actionButton('Found Colony', () => this.app?.foundEconomyColony(settlement.id)));
      return section;
    }

    section.appendChild(metric('Name', colony.name));
    section.appendChild(metric('Population', Math.floor(colony.population).toLocaleString('en-US')));
    section.appendChild(metric('Balance / h', Math.floor(colony.lastBalance).toLocaleString('en-US')));
    section.appendChild(metric('Storage', `${this.getWarehouseUsed(snapshot)}/${this.getWarehouseCapacity(snapshot)}`));
    section.appendChild(this.createBuildingList(snapshot));

    const buildable = snapshot.buildings.filter(building => !colony.buildings.includes(building.id));
    if (buildable.length === 0) {
      section.appendChild(span('metric-label', 'All available buildings built'));
      return section;
    }

    const actions = document.createElement('div');
    actions.className = 'economy-actions';
    for (const building of buildable.slice(0, 3)) {
      const cost = BUILDING_COSTS[building.id] ?? 500;
      actions.appendChild(actionButton(`${building.name} ${cost}`, () => this.app?.buildEconomyColonyBuilding(building.id)));
    }
    section.appendChild(actions);
    return section;
  }

  private createBuildingList(snapshot: EconomySnapshot): HTMLElement {
    const list = document.createElement('div');
    list.className = 'economy-inventory';
    const colony = snapshot.player.colony;
    if (!colony || colony.buildings.length === 0) {
      list.textContent = 'Buildings: none';
      return list;
    }

    list.textContent = `Buildings: ${colony.buildings.map(buildingId => {
      return snapshot.buildings.find(building => building.id === buildingId)?.name ?? buildingId;
    }).join(', ')}`;
    return list;
  }

  private createContractRow(snapshot: EconomySnapshot, contract: Contract): HTMLElement {
    const row = document.createElement('div');
    row.className = 'economy-contract';

    const title = document.createElement('div');
    title.className = 'economy-contract-title';
    title.textContent = `${contract.type}: ${this.getItemName(snapshot, contract.itemId)} x${contract.quantity}`;
    row.appendChild(title);
    row.appendChild(metric('Issuer', this.getSettlementName(snapshot, contract.issuer)));
    row.appendChild(metric('Target', this.getSettlementName(snapshot, contract.targetId)));
    row.appendChild(metric('Reward', contract.reward.toLocaleString('en-US')));
    row.appendChild(metric('Deadline', `H${contract.deadlineHour}`));
    row.appendChild(metric('Risk', `${Math.round(contract.risks * 100)}%`));
    row.appendChild(metric('Status', this.getContractStatus(contract)));
    row.appendChild(metric('Requirements', contract.requirements.join(' / ')));
    if (contract.requiredHours > 0) {
      row.appendChild(metric('Progress', `${contract.progressHours}/${contract.requiredHours}h`));
    }

    if (contract.completed || contract.failed) {
      return row;
    }

    const blockingReason = contract.accepted ? this.getContractBlockingReason(snapshot, contract) : '';
    const button = actionButton(contract.accepted ? 'Complete' : 'Accept', () => {
      if (contract.accepted) {
        this.app?.completeEconomyContract(contract.id);
      } else {
        this.app?.acceptEconomyContract(contract.id);
      }
    });
    if (blockingReason) {
      button.disabled = true;
      button.title = blockingReason;
    }
    row.appendChild(button);
    return row;
  }

  private getContractBlockingReason(snapshot: EconomySnapshot, contract: Contract): string {
    if (contract.progressHours < contract.requiredHours) {
      return `Needs ${contract.requiredHours - contract.progressHours}h more field work`;
    }

    if (contract.type === 'Delivery' || contract.type === 'Procurement') {
      const owned = snapshot.player.inventory[contract.itemId] ?? 0;
      if (owned < contract.quantity) {
        return `Needs cargo ${this.getItemName(snapshot, contract.itemId)} x${contract.quantity - owned}`;
      }
    }

    if (contract.type === 'Construction') {
      const stored = snapshot.player.warehouse[contract.itemId] ?? 0;
      if (stored < contract.quantity) {
        return `Needs warehouse ${this.getItemName(snapshot, contract.itemId)} x${contract.quantity - stored}`;
      }
    }

    return '';
  }

  private createEconomyLog(snapshot: EconomySnapshot): HTMLElement {
    const section = createSection('ECONOMY LOG');
    const entries = snapshot.economyLog.slice(-6).reverse();
    if (entries.length === 0) {
      section.appendChild(span('metric-label', 'No notable entries yet'));
      return section;
    }

    for (const entry of entries) {
      const line = document.createElement('div');
      line.className = 'economy-event';
      line.textContent = `H${entry.hour} ${entry.type}: ${entry.message}`;
      section.appendChild(line);
    }
    return section;
  }

  private createFactionIntel(snapshot: EconomySnapshot): HTMLElement {
    const section = createSection('FACTION INTEL');
    for (const faction of snapshot.factions) {
      const block = document.createElement('div');
      block.className = 'economy-contract';
      const title = document.createElement('div');
      title.className = 'economy-contract-title';
      title.textContent = faction.name;
      block.appendChild(title);
      block.appendChild(metric('Rep / Influence', `${snapshot.player.reputation[faction.id] ?? 0} / ${Math.round(faction.influence)}`));
      block.appendChild(metric('Market Share', `${Math.round(snapshot.corporation.marketShare[faction.id] ?? 0)}%`));
      block.appendChild(metric('Wealth / Military', `${Math.floor(faction.wealth).toLocaleString('en-US')} / ${Math.round(faction.militaryPower)}`));
      block.appendChild(metric('Laws', faction.laws.join(', ')));
      block.appendChild(metric('Relations', this.formatRelationships(snapshot, faction.relationships)));
      block.appendChild(actionButton('Invest 250', () => this.app?.investEconomyFaction(faction.id, 250)));
      section.appendChild(block);
    }
    return section;
  }

  private createDataManifest(snapshot: EconomySnapshot): HTMLElement {
    const section = createSection('DATA MANIFEST');
    section.appendChild(metric('Items', snapshot.items.length.toString()));
    section.appendChild(metric('Events', snapshot.eventDefinitions.length.toString()));
    section.appendChild(metric('Factions', snapshot.factions.length.toString()));
    section.appendChild(metric('Contracts', snapshot.contractTemplates.length.toString()));
    section.appendChild(metric('Buildings', snapshot.buildings.length.toString()));
    section.appendChild(metric('Production', snapshot.production.length.toString()));
    section.appendChild(actionButton('Copy Snapshot', () => this.copySnapshot(snapshot)));
    return section;
  }

  private createEvents(snapshot: EconomySnapshot): HTMLElement {
    const section = createSection('EVENT FEED');
    if (snapshot.activeEvents.length === 0) {
      section.appendChild(span('metric-label', 'Markets stable'));
      return section;
    }

    for (const event of snapshot.activeEvents.slice(0, 4)) {
      const line = document.createElement('div');
      line.className = 'economy-event';
      line.textContent = `${event.trigger} / ${event.actor} / ${event.location} / ${event.modifier} -> ${event.outcome} (${event.remainingHours}h)`;
      section.appendChild(line);
    }
    return section;
  }

  private createCrisis(snapshot: EconomySnapshot): HTMLElement {
    const section = createSection('CRISIS WATCH');
    section.appendChild(metric('Level', `${snapshot.crisis.label} ${Math.round(snapshot.crisis.level)}`));
    if (snapshot.crisis.shortages.length === 0) {
      section.appendChild(span('metric-label', 'No critical shortages'));
      return section;
    }

    for (const shortage of snapshot.crisis.shortages.slice(0, 5)) {
      const row = document.createElement('div');
      row.className = 'economy-intel-row';
      const settlement = snapshot.settlements.find(item => item.id === shortage.settlementId);
      const localIntel = settlement ? snapshot.intel.factionIntel[settlement.factionId] ?? 0 : 0;
      const label = localIntel >= 40
        ? `${this.getSettlementName(snapshot, shortage.settlementId)} / ${this.getItemName(snapshot, shortage.itemId)}`
        : `${this.getSettlementName(snapshot, shortage.settlementId)} / shortage signal`;
      row.appendChild(span(
        'metric-label',
        label
      ));
      row.appendChild(span('metric-value', `${Math.round(shortage.severity * 100)}%`));
      section.appendChild(row);
    }
    return section;
  }

  private getItemName(snapshot: EconomySnapshot, itemId: string): string {
    return snapshot.items.find(item => item.id === itemId)?.name ?? itemId;
  }

  private getSettlementName(snapshot: EconomySnapshot, settlementId: string): string {
    return snapshot.settlements.find(settlement => settlement.id === settlementId)?.name ?? settlementId;
  }

  private getContractStatus(contract: Contract): string {
    if (contract.completed) return 'Completed';
    if (contract.failed) return 'Failed';
    if (contract.accepted) return 'Accepted';
    return 'Open';
  }

  private formatRelationships(snapshot: EconomySnapshot, relationships: Record<string, number>): string {
    const entries = Object.entries(relationships).slice(0, 2);
    if (entries.length === 0) return 'Neutral';

    return entries.map(([factionId, value]) => {
      const name = snapshot.factions.find(faction => faction.id === factionId)?.name ?? factionId;
      return `${name} ${value}`;
    }).join(', ');
  }

  private formatCounts(counts: Record<string, number>): string {
    return Object.entries(counts)
      .filter(([, value]) => value > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 4)
      .map(([name, value]) => `${formatTrait(name)} ${Math.round(value)}`)
      .join(', ');
  }

  private getWarehouseUsed(snapshot: EconomySnapshot): number {
    return Math.floor(Object.values(snapshot.player.warehouse).reduce((sum, quantity) => sum + quantity, 0));
  }

  private getWarehouseCapacity(snapshot: EconomySnapshot): number {
    const colony = snapshot.player.colony;
    if (!colony) return 600;

    return colony.buildings.reduce((capacity, buildingId) => {
      const building = snapshot.buildings.find(item => item.id === buildingId);
      return capacity + (building?.storageBonus ?? 0);
    }, 600);
  }

  private findArbitrage(snapshot: EconomySnapshot): Array<{
    itemId: string;
    itemName: string;
    originId: string;
    originName: string;
    destinationName: string;
    margin: number;
  }> {
    const opportunities: Array<{
      itemId: string;
      itemName: string;
      originId: string;
      originName: string;
      destinationName: string;
      margin: number;
    }> = [];

    for (const item of snapshot.items) {
      let cheapest = snapshot.settlements[0];
      let priciest = snapshot.settlements[0];
      for (const settlement of snapshot.settlements) {
        if ((settlement.prices[item.id] ?? item.basePrice) < (cheapest.prices[item.id] ?? item.basePrice)) {
          cheapest = settlement;
        }
        if ((settlement.prices[item.id] ?? item.basePrice) > (priciest.prices[item.id] ?? item.basePrice)) {
          priciest = settlement;
        }
      }

      const margin = (priciest.prices[item.id] ?? item.basePrice) - (cheapest.prices[item.id] ?? item.basePrice);
      if (margin > item.basePrice * 0.18) {
        opportunities.push({
          itemId: item.id,
          itemName: item.name,
          originId: cheapest.id,
          originName: cheapest.name,
          destinationName: priciest.name,
          margin,
        });
      }
    }

    return opportunities.sort((a, b) => b.margin - a.margin);
  }

  private findShortageLeads(snapshot: EconomySnapshot): Array<{
    settlementId: string;
    settlementName: string;
    itemId: string;
    itemName: string;
    severity: number;
  }> {
    return snapshot.crisis.shortages
      .filter(shortage => {
        const settlement = snapshot.settlements.find(entry => entry.id === shortage.settlementId);
        const localIntel = settlement ? snapshot.intel.factionIntel[settlement.factionId] ?? 0 : 0;
        return snapshot.intel.level >= 24 || localIntel >= 36;
      })
      .map(shortage => ({
        settlementId: shortage.settlementId,
        settlementName: this.getSettlementName(snapshot, shortage.settlementId),
        itemId: shortage.itemId,
        itemName: this.getItemName(snapshot, shortage.itemId),
        severity: shortage.severity,
      }))
      .sort((a, b) => b.severity - a.severity);
  }

  private findEventLeads(snapshot: EconomySnapshot): Array<{
    settlementId: string;
    itemId: string;
    itemName: string;
    eventName: string;
    detail: string;
    weight: number;
  }> {
    const leads: Array<{
      settlementId: string;
      itemId: string;
      itemName: string;
      eventName: string;
      detail: string;
      weight: number;
    }> = [];

    for (const event of snapshot.activeEvents) {
      const definition = snapshot.eventDefinitions.find(item => item.id === event.definitionId);
      const settlement = snapshot.settlements.find(item => item.id === event.targetSettlementId);
      const localIntel = settlement ? snapshot.intel.factionIntel[settlement.factionId] ?? 0 : 0;
      if (!definition || (!settlement && snapshot.intel.level < 48) || (snapshot.intel.level < 48 && localIntel < 42)) {
        continue;
      }

      for (const itemId of definition.targetGoods.slice(0, 2)) {
        const priceEffect = event.effects.price ?? 1;
        const demandEffect = event.effects.demand ?? 1;
        const supplyEffect = event.effects.supply ?? 1;
        const detail = snapshot.intel.level >= 72
          ? `P${priceEffect.toFixed(2)} D${demandEffect.toFixed(2)} S${supplyEffect.toFixed(2)}`
          : event.outcome;
        leads.push({
          settlementId: event.targetSettlementId,
          itemId,
          itemName: this.getItemName(snapshot, itemId),
          eventName: event.name,
          detail,
          weight: event.severity * Math.abs(priceEffect * demandEffect / Math.max(0.2, supplyEffect) - 1),
        });
      }
    }

    return leads.sort((a, b) => b.weight - a.weight);
  }

  private saveEconomy(): void {
    const snapshot = this.app?.getEconomySnapshot();
    if (!snapshot) return;
    localStorage.setItem(ECONOMY_STORAGE_KEY, JSON.stringify(snapshot));
  }

  private autosaveEconomy(snapshot: EconomySnapshot): void {
    if (snapshot.hour === this.lastAutosaveHour || snapshot.hour % 6 !== 0) {
      return;
    }

    this.lastAutosaveHour = snapshot.hour;
    localStorage.setItem(ECONOMY_AUTOSAVE_KEY, JSON.stringify(snapshot));
  }

  private loadEconomy(storageKey: string): void {
    const saved = localStorage.getItem(storageKey);
    if (!saved || !this.app) return;

    try {
      this.app.restoreEconomySnapshot(JSON.parse(saved) as EconomySnapshot);
    } catch (error) {
      console.error('Failed to load saved economy snapshot:', error);
    }
  }

  private copySnapshot(snapshot: EconomySnapshot): void {
    const payload = JSON.stringify(snapshot, null, 2);
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(payload);
    }
  }

  private hasFocusedControl(): boolean {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || !this.container?.contains(active)) {
      return false;
    }

    return active.matches('select, input, textarea, button');
  }
}

function createSection(title: string): HTMLElement {
  const section = document.createElement('div');
  section.className = 'monitor-section economy-section';
  const heading = document.createElement('h4');
  heading.textContent = title;
  section.appendChild(heading);
  return section;
}

function metric(label: string, value: string): HTMLElement {
  const row = document.createElement('div');
  row.className = 'metric';
  row.appendChild(span('metric-label', label));
  row.appendChild(span('metric-value', value));
  return row;
}

function labeled(label: string, element: HTMLElement): HTMLElement {
  const wrapper = document.createElement('label');
  wrapper.className = 'economy-field';
  wrapper.appendChild(span('metric-label', label));
  wrapper.appendChild(element);
  return wrapper;
}

function actionButton(label: string, onClick: () => unknown): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = 'secondary-btn-small economy-action';
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', () => onClick());
  return button;
}

function span(className: string, text: string): HTMLSpanElement {
  const element = document.createElement('span');
  element.className = className;
  element.textContent = text;
  return element;
}

function readoutItem(label: string, value: string): HTMLElement {
  const item = document.createElement('span');
  item.className = 'journey-economy-readout-item';
  item.appendChild(span('journey-economy-readout-label', label));
  item.appendChild(span('journey-economy-readout-value', value));
  return item;
}

function formatTrait(trait: string): string {
  return trait
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}
