export type GoodsCategory = 'raw' | 'industrial' | 'luxury' | 'service';
export type ContractType = 'Delivery' | 'Escort' | 'Procurement' | 'Construction' | 'Exploration';
export type EconomyEventType = 'Economic' | 'Social' | 'Political' | 'Trade' | 'Rare';

export interface ItemDefinition {
  id: string;
  name: string;
  category: GoodsCategory;
  basePrice: number;
  weight: number;
}

export interface FactionDefinition {
  id: string;
  name: string;
  wealth: number;
  influence: number;
  militaryPower: number;
  territory: string[];
  laws: string[];
  relationships: Record<string, number>;
}

export interface EconomyEventDefinition {
  id: string;
  type: EconomyEventType;
  name: string;
  targetGoods: string[];
  durationHours: number;
  severity: number;
  effects: {
    supply?: number;
    demand?: number;
    risk?: number;
    traffic?: number;
    price?: number;
  };
}

export interface ContractDefinition {
  id: string;
  type: ContractType;
  rewardMultiplier: number;
  deadlineHours: number;
  risk: number;
}

export interface Quantity {
  itemId: string;
  quantity: number;
}

export interface ProductionDefinition {
  id: string;
  inputs: Quantity[];
  outputs: Quantity[];
  workers: number;
  efficiency: number;
}

export interface BuildingDefinition {
  id: string;
  name: string;
  storageBonus?: number;
  productionId?: string;
  consumes?: string[];
  taxCost: number;
}

export interface Settlement {
  id: string;
  name: string;
  seed: number;
  traits: string[];
  population: number;
  wealth: number;
  stability: number;
  security: number;
  factionId: string;
  stockpiles: Record<string, number>;
  production: string[];
  consumption: string[];
  activeEvents: string[];
  reputationMap: Record<string, number>;
  prices: Record<string, number>;
}

export interface TradeRoute {
  id: string;
  originId: string;
  destinationId: string;
  goods: string[];
  risk: number;
  distance: number;
  profit: number;
  traffic: number;
}

export interface Trader {
  id: string;
  name: string;
  money: number;
  inventory: Record<string, number>;
  reputation: Record<string, number>;
  routeHistory: string[];
  goal: string;
}

export interface ActiveEconomyEvent {
  id: string;
  definitionId: string;
  type: EconomyEventType;
  name: string;
  targetSettlementId: string;
  targetRegion: string;
  trigger: string;
  actor: string;
  location: string;
  modifier: string;
  outcome: string;
  remainingHours: number;
  severity: number;
  causes: string[];
  effects: EconomyEventDefinition['effects'];
}

export interface Contract {
  id: string;
  type: ContractType;
  issuer: string;
  originId: string;
  targetId: string;
  itemId: string;
  quantity: number;
  reward: number;
  deadlineHour: number;
  risks: number;
  requirements: string[];
  progressHours: number;
  requiredHours: number;
  accepted: boolean;
  completed: boolean;
  failed: boolean;
}

export interface PlayerEconomy {
  money: number;
  inventory: Record<string, number>;
  warehouse: Record<string, number>;
  reputation: Record<string, number>;
  intelNetwork: number;
  acceptedContracts: string[];
  autoRoutes: PlayerAutoRoute[];
  colony: Colony | null;
  corporationName: string;
}

export interface PlayerAutoRoute {
  id: string;
  originId: string;
  destinationId: string;
  itemId: string;
  quantity: number;
  active: boolean;
  risk: number;
  profit: number;
  completedRuns: number;
}

export interface Colony {
  id: string;
  name: string;
  linkedSettlementId: string;
  population: number;
  buildings: string[];
  stockpiles: Record<string, number>;
  routes: string[];
  taxes: number;
  reputation: Record<string, number>;
  foundedHour: number;
  lastBalance: number;
}

export interface PriceHistoryEntry {
  hour: number;
  settlementId: string;
  itemId: string;
  price: number;
}

export interface EconomyLogEntry {
  hour: number;
  type: 'event' | 'contract' | 'colony' | 'route' | 'faction' | 'market';
  message: string;
}

export interface WorldEconomyContext {
  position: { x: number; z: number };
  chunk: { x: number; y: number };
  loadedChunkCount: number;
  exploredChunkCount: number;
  dominantBiome?: string;
  localBiome?: string;
  nearbyResources: Record<string, number>;
  nearbyStructures: Record<string, number>;
  linkedSettlementId?: string;
}

export interface EconomySnapshot {
  seed: number;
  hour: number;
  items: ItemDefinition[];
  factions: FactionDefinition[];
  buildings: BuildingDefinition[];
  contractTemplates: ContractDefinition[];
  production: ProductionDefinition[];
  eventDefinitions: EconomyEventDefinition[];
  settlements: Settlement[];
  tradeRoutes: TradeRoute[];
  traders: Trader[];
  activeEvents: ActiveEconomyEvent[];
  crisis: EconomyCrisis;
  contracts: Contract[];
  player: PlayerEconomy;
  intel: EconomyIntel;
  corporation: CorporationSnapshot;
  world: WorldEconomyContext;
  priceHistory: PriceHistoryEntry[];
  economyLog: EconomyLogEntry[];
}

export interface EconomyCrisis {
  level: number;
  label: 'Stable' | 'Stressed' | 'Crisis' | 'Collapse Risk';
  shortages: Array<{
    settlementId: string;
    itemId: string;
    severity: number;
  }>;
}

export interface EconomyIntel {
  level: number;
  label: 'Rumors' | 'Market Notes' | 'Broker Network' | 'Regional Ledger';
  network: number;
  factionIntel: Record<string, number>;
}

export interface CorporationSnapshot {
  tier: 'Operator' | 'Company' | 'Consortium' | 'Regional Power';
  influence: number;
  marketShare: Record<string, number>;
}
