export type EntityId = string;
export type ComponentKey<T = unknown> = string;

let nextEntityId = 1;

/**
 * A runtime object composed from named data components.
 */
export class Entity {
  readonly id: EntityId;
  private readonly components: Map<ComponentKey, unknown>;

  constructor(id?: EntityId) {
    this.id = id ?? `entity-${nextEntityId++}`;
    this.components = new Map();
  }

  addComponent<T>(key: ComponentKey<T>, component: T): this {
    this.components.set(key, component);
    return this;
  }

  getComponent<T>(key: ComponentKey<T>): T | undefined {
    return this.components.get(key) as T | undefined;
  }

  requireComponent<T>(key: ComponentKey<T>): T {
    if (!this.components.has(key)) {
      throw new Error(`Entity '${this.id}' is missing component '${key}'`);
    }

    return this.components.get(key) as T;
  }

  hasComponent(key: ComponentKey): boolean {
    return this.components.has(key);
  }

  removeComponent(key: ComponentKey): boolean {
    return this.components.delete(key);
  }

  getComponentKeys(): ComponentKey[] {
    return Array.from(this.components.keys());
  }
}

/**
 * Owns runtime entities and supports simple component queries.
 */
export class EntityManager {
  private readonly entities: Map<EntityId, Entity>;

  constructor() {
    this.entities = new Map();
  }

  createEntity(id?: EntityId): Entity {
    const entity = new Entity(id);

    if (this.entities.has(entity.id)) {
      throw new Error(`Entity '${entity.id}' already exists`);
    }

    this.entities.set(entity.id, entity);
    return entity;
  }

  addEntity(entity: Entity): Entity {
    if (this.entities.has(entity.id)) {
      throw new Error(`Entity '${entity.id}' already exists`);
    }

    this.entities.set(entity.id, entity);
    return entity;
  }

  getEntity(id: EntityId): Entity | undefined {
    return this.entities.get(id);
  }

  removeEntity(id: EntityId): boolean {
    return this.entities.delete(id);
  }

  clear(): void {
    this.entities.clear();
  }

  get size(): number {
    return this.entities.size;
  }

  getAll(): Entity[] {
    return Array.from(this.entities.values());
  }

  query(requiredComponents: ComponentKey[]): Entity[] {
    return this.getAll().filter(entity =>
      requiredComponents.every(component => entity.hasComponent(component))
    );
  }
}
