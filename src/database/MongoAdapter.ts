import { MongoClient, ObjectId } from 'mongodb';
import { Adapter } from './Adapter';
import { getRegisteredModels } from '../models/registry';

interface MongoAdapterOptions {
    autoIndex?: boolean;
}

export class MongoAdapter implements Adapter {
    private client: MongoClient;
    private db: any;
    private dbName: string;
    private options: MongoAdapterOptions = { autoIndex: true };

    constructor(uri: string, dbName: string) {
        this.client = new MongoClient(uri);
        this.dbName = dbName;
    }

    async init() {
        await this.client.connect();
        this.db = this.client.db(this.dbName);

        if (this.options.autoIndex) {
            await this.ensureIndexes();
        }

        return true;
    }

    async insertOne(model: string, data: any) {
        const result = await this.db.collection(model).insertOne(this.normalizeDataForInsert(data));
        return { ...data, _id: result.insertedId };
    }

    async insertMany(model: string, data: any[]) {
        const result = await this.db
            .collection(model)
            .insertMany(data.map(this.normalizeDataForInsert));
        return result.insertedIds;
    }

    async findOne(model: string, filter: any) {
        return this.db.collection(model).findOne(this.normalizeFilterForQuery(filter));
    }

    async findMany(model: string, filter: any = {}) {
        return this.db.collection(model).find(this.normalizeFilterForQuery(filter)).toArray();
    }

    async findOneAndUpdate(model: string, filter: any, update: any) {
        const result = await this.db
            .collection(model)
            .findOneAndUpdate(
                this.normalizeFilterForQuery(filter),
                { $set: update },
                { returnDocument: 'after' }
            );
        return result;
    }

    async updateMany(model: string, filter: any, update: any) {
        const result = await this.db
            .collection(model)
            .updateMany(this.normalizeFilterForQuery(filter), { $set: update });
        return result.modifiedCount;
    }

    async findOneAndIncrement(
        model: string,
        filter: any,
        update: Record<string, unknown>,
        options: Record<string, unknown> = {}
    ) {
        const normalizedFilter = this.normalizeFilterForQuery(filter);

        // increment only numeric fields
        const $inc: Record<string, number> = {};
        for (const [field, incrementValue] of Object.entries(update)) {
            if (typeof incrementValue === 'number') {
                $inc[field] = incrementValue;
            }
        }
        if (Object.keys($inc).length === 0) return null;

        /**
         * Upsert:false - perform increment operation only
         */
        if (!options?.upsert) {
            const result = await this.db
                .collection(model)
                .findOneAndUpdate(
                    normalizedFilter,
                    { $inc },
                    { returnDocument: 'after', ...options }
                );
            return result;
        }

        /**
         * Upsert:true - set or update document in an ordered transaction
         */
        const session = await this.client.startSession();
        let newDoc: any;

        try {
            await session.withTransaction(
                async () => {
                    await this.db.collection(model).bulkWrite(
                        [
                            {
                                // try to update if it exists already
                                updateOne: {
                                    filter: normalizedFilter,
                                    update: {
                                        $inc,
                                    },
                                    upsert: false,
                                },
                            },
                            {
                                // insert if doesn't exist
                                updateOne: {
                                    filter: normalizedFilter,
                                    update: {
                                        $setOnInsert: {
                                            ...update,
                                            ...normalizedFilter,
                                        },
                                    },
                                    upsert: true,
                                },
                            },
                        ],
                        { ordered: true, session }
                    );

                    // Fetch the updated document after bulkWrite
                    newDoc = await this.db.collection(model).findOne(normalizedFilter, { session });
                },
                { readConcern: { level: 'snapshot' } }
            );
        } catch (error) {
            await session.endSession();
            throw error;
        }

        await session.endSession();
        return newDoc;
    }

    async deleteOne(model: string, filter: any) {
        const result = await this.db
            .collection(model)
            .deleteOne(this.normalizeFilterForQuery(filter));
        return result.deletedCount || 0;
    }

    async deleteMany(model: string, filter: any) {
        const result = await this.db
            .collection(model)
            .deleteMany(this.normalizeFilterForQuery(filter));
        return result.deletedCount || 0;
    }

    /**
     * Prepares data for insertion by converting 'id' to '_id' (ObjectId)
     * @param data - The data object containing 'id' field
     * @returns Data object with '_id' instead of 'id'
     */
    private normalizeDataForInsert(data: any): any {
        const { id, ...rest } = data;

        if (id) return { ...rest, _id: new ObjectId(id) };
        return rest;
    }

    /**
     * Prepares filter for querying by converting 'id' to '_id' (ObjectId)
     * @param filter - The filter object containing 'id' field
     * @returns Filter object with '_id' instead of 'id'
     */
    private normalizeFilterForQuery(filter: any): any {
        const { id, ...rest } = filter;

        if (id) return { _id: new ObjectId(id) };
        return rest;
    }

    private async ensureIndexes() {
        const models = getRegisteredModels();

        for (const model of models) {
            const collection = this.db.collection(model.name);

            for (const idx of model.schema.indexes) {
                const fields = idx.fields;
                const options = { ...idx.options };

                try {
                    await collection.createIndex(fields, options);
                } catch (err: any) {
                    if (err.code === 85 || err.codeName === 'IndexOptionsConflict') {
                        console.warn(
                            `Recreating conflicting index "${options.name}" on ${model.name}...`
                        );
                        if (options.name) {
                            await collection.dropIndex(options.name);
                            await collection.createIndex(fields, options);
                        } else {
                            throw err;
                        }
                    } else {
                        throw err;
                    }
                }
            }
        }
    }
}
