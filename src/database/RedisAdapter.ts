import Redis, { Redis as RedisClient } from 'ioredis';
import { Adapter } from './Adapter';
import { getRegisteredModels } from '../models/registry';

interface RedisAdapterOptions {
    autoIndex?: boolean;
}

type RedisConfig = {
    host: string;
    port: number;
    password?: string;
    db?: number;
    tls?: boolean;
};

function toKey(model: string, id: string | number) {
    return `${model}:${id}`;
}

function normalizeExpiresAt(expiresAt?: number | string | Date) {
    if (!expiresAt) return undefined;

    try {
        if (typeof expiresAt === 'string') {
            expiresAt = new Date(expiresAt);
        }
        const ms =
            expiresAt instanceof Date
                ? expiresAt.getTime()
                : typeof expiresAt === 'number' && expiresAt < 1e12
                  ? expiresAt * 1000 // seconds → ms
                  : typeof expiresAt === 'number'
                    ? expiresAt
                    : NaN;
        return Number.isFinite(ms) ? ms : undefined;
    } catch (e) {
        return undefined;
    }
}

export class RedisAdapter implements Adapter {
    private client: RedisClient;
    private ready = false;

    constructor(
        private config: RedisConfig,
        private options: RedisAdapterOptions = { autoIndex: true }
    ) {
        this.client = new Redis({
            host: config.host,
            port: config.port,
            password: config.password,
            db: config.db,
            tls: config.tls ? {} : undefined,
            lazyConnect: true,
            enableOfflineQueue: true,
            maxRetriesPerRequest: null,
        });

        this.client.on('ready', () => (this.ready = true));
        this.client.on('end', () => (this.ready = false));
        this.client.on('error', (err) => {
            console.error('[RedisAdapter] error:', err?.message || err);
        });
    }

    async init(): Promise<boolean> {
        if (this.ready || this.client.status === 'ready') return true;
        if (this.client.status === 'connecting') {
            await this.waitUntilReady();
            if (this.options.autoIndex) {
                await this.ensureIndexes();
            }
            return true;
        }
        await this.client.connect();
        await this.waitUntilReady();
        if (this.options.autoIndex) {
            await this.ensureIndexes();
        }
        return true;
    }

    async disconnect(): Promise<void> {
        try {
            await this.client.quit();
        } finally {
            this.ready = false;
        }
    }

    async insertOne(model: string, data: any) {
        await this.ensureReady();

        const { key, value, expiresAtMs } = this.formatDataForInsert(model, data);

        const multi = this.client.multi();
        multi.call('JSON.SET', key, '$', JSON.stringify(value));

        if (expiresAtMs && expiresAtMs > Date.now()) {
            multi.pexpireat(key, expiresAtMs);
        }

        await multi.exec();

        return value;
    }

    async insertMany(model: string, data: any[]) {
        await this.ensureReady();

        const pipeline = this.client.pipeline();

        data.forEach((d) => {
            const { key, value, expiresAtMs } = this.formatDataForInsert(model, d);

            pipeline.call('JSON.SET', key, '$', JSON.stringify(value));

            if (expiresAtMs && expiresAtMs > Date.now()) {
                pipeline.pexpireat(key, expiresAtMs);
            }
        });

        await pipeline.exec();

        return data;
    }

    async findOne(model: string, filter: any) {
        await this.ensureReady();
        const id = filter?.id;
        if (!id) return null;

        const key = toKey(model, id);
        const raw = await this.client.call('JSON.GET', key);

        return raw ? JSON.parse(raw as string) : null;
    }

    async findMany(model: string, _filter?: any) {
        await this.ensureReady();

        const prefix = `${model}:`;
        const keys: string[] = [];
        let cursor = '0';

        do {
            const [next, batch] = await this.client.scan(
                cursor,
                'MATCH',
                `${prefix}*`,
                'COUNT',
                '1000'
            );
            cursor = next;
            if (batch && batch.length) keys.push(...batch);
        } while (cursor !== '0');

        if (keys.length === 0) return [];

        const pipeline = this.client.pipeline();
        keys.forEach((k) => pipeline.call('JSON.GET', k));
        const results = await pipeline.exec();

        const out: any[] = [];
        if (results) {
            results.forEach(([err, val], i) => {
                if (!err && val) {
                    try {
                        const obj = JSON.parse(val as string);
                        if (obj && obj.id == null) {
                            obj.id = keys[i].substring(prefix.length);
                        }
                        out.push(obj);
                    } catch (_) {}
                }
            });
        }

        return out;
    }

    async findOneAndUpdate(model: string, filter: any, update: any) {
        const models = getRegisteredModels();
        await this.ensureReady();

        const id = filter?.id;
        if (!id) return null;

        const key = toKey(model, id);

        // update document
        const multi = this.client.multi();
        multi.call('JSON.MERGE', key, '$', JSON.stringify(update));

        // update TTL
        const m = models.find((m) => m.name === model);
        if (m && update.expiresAt) {
            const ttlIndex = m.schema.indexes.find((i) => i.options?.expireAfterSeconds === 0);
            if (ttlIndex) {
                const expiresAtMs = normalizeExpiresAt(update.expiresAt);
                if (expiresAtMs && expiresAtMs > Date.now()) {
                    multi.pexpireat(key, expiresAtMs);
                }
            }
        }

        const result = await multi.exec();

        // return new object
        const raw = await this.client.call('JSON.GET', key);
        return raw ? JSON.parse(raw as string) : null;
    }

    async updateMany(_model: string, _filter: any, _update: any): Promise<number> {
        throw new Error('RedisAdapter does not support updateMany without RediSearch/indexes.');
    }

    /**
     * Increment numeric fields in the `update` object
     * If `options.upsert` is true, set or update document in a transaction (set `update` object as document)
     */
    async findOneAndIncrement(
        model: string,
        filter: any,
        update: Record<string, unknown>,
        options: Record<string, unknown> = {}
    ) {
        await this.ensureReady();

        const id = filter?.id;
        if (!id) return null;

        /**
         * Upsert:false - perform increment operation only
         */
        if (!options?.upsert) {
            const key = toKey(model, id);

            for (const [field, incrementValue] of Object.entries(update)) {
                if (typeof incrementValue === 'number') {
                    await this.client.call('JSON.NUMINCRBY', key, `.${field}`, incrementValue);
                }
            }
        } else {
            /**
             * Upsert:true - set or update document in a transaction
             */
            const multi = this.client.multi();
            const { key, value, expiresAtMs } = this.formatDataForInsert(model, {
                ...update,
                id,
            });

            // Set if not exists (NX)
            // Because of the increment operation, we need to initialize the document with the decreased values
            for (const [field, incrementValue] of Object.entries(update)) {
                if (typeof incrementValue === 'number') {
                    value[field] -= incrementValue;
                }
            }
            multi.call('JSON.SET', key, '$', JSON.stringify(value), 'NX');

            // Set TTL on key
            if (expiresAtMs && expiresAtMs > Date.now()) {
                multi.pexpireat(key, expiresAtMs);
            }

            for (const [field, incrementValue] of Object.entries(update)) {
                if (typeof incrementValue === 'number') {
                    multi.call('JSON.NUMINCRBY', key, `.${field}`, incrementValue);
                }
            }
            const result = await multi.exec();
        }

        // Return the updated document
        const raw = await this.client.call('JSON.GET', toKey(model, id));
        return raw ? JSON.parse(raw as string) : null;
    }

    async deleteOne(model: string, filter: any) {
        await this.ensureReady();
        const id = filter?.id;
        if (!id) return 0;

        const result = await this.client.call('JSON.DEL', toKey(model, id));
        return result as number;
    }

    /**
     * Delete all documents belonging to a model (!!)
     */
    async deleteMany(model: string) {
        await this.ensureReady();

        const prefix = `${model}:`;
        const keys: string[] = [];
        let cursor = '0';

        do {
            const [next, batch] = await this.client.scan(
                cursor,
                'MATCH',
                `${prefix}*`,
                'COUNT',
                '1000'
            );
            cursor = next;
            if (batch && batch.length) keys.push(...batch);
        } while (cursor !== '0');

        if (!keys.length) return 0;

        const pipeline = this.client.pipeline();
        keys.forEach((k) => pipeline.del(k));
        const results = await pipeline.exec();

        return (results ?? []).reduce(
            (sum, [err, res]) => sum + (!err && (res as number) ? 1 : 0),
            0
        );
    }

    private async ensureReady(): Promise<void> {
        if (this.ready || this.client.status === 'ready') return;
        await this.init();
    }

    private waitUntilReady(): Promise<void> {
        if (this.ready || this.client.status === 'ready') return Promise.resolve();
        return new Promise<void>((resolve, reject) => {
            const onReady = () => {
                cleanup();
                resolve();
            };
            const onError = (err: any) => {
                cleanup();
                reject(err);
            };
            const cleanup = () => {
                this.client.off('ready', onReady);
                this.client.off('error', onError);
            };
            this.client.once('ready', onReady);
            this.client.once('error', onError);
        });
    }

    private async ensureIndexes() {
        const models = getRegisteredModels();
        for (const model of models) {
            for (const idx of model.schema.indexes) {
                if (idx.options?.expireAfterSeconds !== undefined) {
                    console.warn(
                        `[RedisAdapter] Model "${model.name}" declares TTL index on `,
                        idx.fields,
                        `expireAfterSeconds=${idx.options.expireAfterSeconds}`
                    );
                } else {
                    console.warn(
                        `[RedisAdapter] Model "${model.name}" declares index `,
                        idx.fields,
                        '(not natively supported in Redis)'
                    );
                }
            }
        }
    }

    /**
     * Format data for insertion into Redis
     */
    private formatDataForInsert(modelName: string, data: any) {
        const models = getRegisteredModels();
        const id = data?.id ?? Date.now().toString();
        const key = toKey(modelName, id);

        const { id: _omit, ...payload } = data ?? {};

        let expiresAtMs = normalizeExpiresAt(data?.expiresAt);

        const model = models.find((m) => m.name === modelName);
        if (model) {
            const ttlIndex = model.schema.indexes.find((i) => i.options?.expireAfterSeconds === 0);
            if (ttlIndex && data?.expiresAt) {
                expiresAtMs = normalizeExpiresAt(data.expiresAt);
            }
        }

        return { key, value: { ...payload, id }, expiresAtMs };
    }
}
