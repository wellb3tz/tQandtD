import items from './data/items.json';
import factions from './data/factions.json';
import events from './data/events.json';
import contractTemplates from './data/contracts.json';
import buildings from './data/buildings.json';
import production from './data/production.json';
import type {
  BuildingDefinition,
  ContractDefinition,
  EconomyEventDefinition,
  FactionDefinition,
  ItemDefinition,
  ProductionDefinition,
} from './types';

export const ECONOMY_ITEMS = items as ItemDefinition[];
export const ECONOMY_FACTIONS = factions as unknown as FactionDefinition[];
export const ECONOMY_EVENTS = events as EconomyEventDefinition[];
export const ECONOMY_CONTRACT_TEMPLATES = contractTemplates as ContractDefinition[];
export const ECONOMY_BUILDINGS = buildings as BuildingDefinition[];
export const ECONOMY_PRODUCTION = production as ProductionDefinition[];
