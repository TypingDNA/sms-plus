import crypto from 'crypto';
import { getAdapter } from '../database/AdapterProvider';
import { registerModel } from './registry';
import { config } from '../config/config';

const { hashSalt: HASH_SALT } = config;

type Constructor<T> = StringConstructor | NumberConstructor | BooleanConstructor | DateConstructor;

interface FieldOptions<T = any> {
    type: Constructor<T>;
    required?: boolean;
    default?: T | (() => T);
    unique?: boolean;
}

interface SchemaDefinition {
    [field: string]: FieldOptions;
}

interface IndexDef {
    fields: Record<string, 1 | -1>;
    options?: Record<string, any>;
}

/**
 * Generates a deterministic ObjectId from a unique identifier
 * Uses HMAC-SHA256 for security and takes first 12 bytes/ 24 hex chars for ObjectId (MongoDB) compatibility
 * @param id - The unique identifier (e.g., cid, disableTid, userId)
 * @returns stringified ObjectId instance
 */
const idToObjectId = (id: string): string => {
    if (!id) return '';

    const hmacHash = crypto.createHmac('sha256', HASH_SALT).update(id).digest('hex');
    return hmacHash.slice(0, 24);
};

export class Schema {
    public fields: SchemaDefinition;
    public indexes: IndexDef[] = [];

    constructor(definition: SchemaDefinition) {
        this.fields = definition;
    }

    index(fields: Record<string, 1 | -1>, options?: Record<string, any>) {
        this.indexes.push({ fields, options });
    }
}

/**
 * Factory to produce a database service with automatic id normalization and validation.
 */
function createDatabaseService<T>(
    modelName: string,
    validate: (input: Partial<T>, opts?: { partial?: boolean }) => T
) {
    const adapter = getAdapter();

    const normalizeId = (data: any) => {
        // transform id to a deterministic objectId
        if (data.id) data.id = idToObjectId(data.id);
        return data;
    };

    return {
        insertOne(raw: Partial<T>) {
            const data = validate(raw);

            return adapter.insertOne(modelName, normalizeId(data));
        },
        insertMany(raw: Partial<T>[]) {
            const data = raw.map((item) => validate(item));

            return adapter.insertMany(modelName, data.map(normalizeId));
        },
        findOne(filter: Partial<T>) {
            return adapter.findOne(modelName, normalizeId(filter));
        },
        findMany(filter?: Partial<T>) {
            return adapter.findMany(modelName, normalizeId(filter ?? {}));
        },
        findOneAndUpdate(filter: Partial<T>, update: any, options?: Record<string, unknown>) {
            const data = validate(update, { partial: true });

            return adapter.findOneAndUpdate(modelName, normalizeId(filter), data);
        },
        updateMany(filter: Partial<T>, update: any) {
            const data = validate(update, { partial: true });

            return adapter.updateMany(modelName, normalizeId(filter), data);
        },
        findOneAndIncrement(
            filter: Partial<T>,
            update: Record<string, unknown>,
            options?: Record<string, unknown>
        ) {
            return adapter.findOneAndIncrement(modelName, normalizeId(filter), update, options);
        },
        deleteOne(filter: Partial<T>) {
            return adapter.deleteOne(modelName, normalizeId(filter));
        },
        deleteMany(filter: Partial<T>) {
            return adapter.deleteMany(modelName, normalizeId(filter));
        },
    };
}

export interface Model<T> {
    name: string;
    schema: Schema;
    validate(input: Partial<T>, opts?: { partial?: boolean }): T;
}

/**
 * Construct a model with validation and register it with the adapter layer.
 */
export function model<T>(name: string, schema: Schema) {
    const validate = (input: Partial<T>, opts: { partial?: boolean } = {}) => {
        const out: Partial<T> = {};
        const { partial = false } = opts;

        for (const [key, def] of Object.entries(schema.fields)) {
            let val = input[key as keyof T];

            if (val == null) {
                if (!partial && def.default !== undefined) {
                    val = typeof def.default === 'function' ? def.default() : def.default;
                } else if (!partial && def.required) {
                    throw new Error(`Missing required field: ${key}`);
                } else {
                    continue;
                }
            }

            if (def.type === String && typeof val !== 'string')
                throw new Error(`${key} must be a string`);
            if (def.type === Number && typeof val !== 'number')
                throw new Error(`${key} must be a number`);
            if (def.type === Boolean && typeof val !== 'boolean')
                throw new Error(`${key} must be a boolean`);
            if (def.type === Date && !(val instanceof Date)) {
                const d = new Date(val as string | number | Date);
                if (isNaN(d.getTime())) throw new Error(`${key} must be a valid Date`);
                val = d as T[keyof T];
            }

            out[key as keyof T] = val as T[keyof T];
        }

        return out as T;
    };

    const model = {
        name,
        schema,
        validate,
        ...createDatabaseService<T>(name, validate),
    };

    registerModel(model);
    return model;
}
