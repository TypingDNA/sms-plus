import type { Model } from './Schema';

const registry = new Set<Model<any>>();

/**
 * Track a model so adapters can discover schemas (e.g., for TTL setup).
 */
export function registerModel<T>(m: Model<T>) {
    registry.add(m as Model<any>);
}

/**
 * Return all models registered in memory.
 */
export function getRegisteredModels(): Model<any>[] {
    return Array.from(registry);
}
