import { Adapter } from '../database/Adapter';

/**
 * Thin wrapper around the database adapter that enforces model validation.
 */
export class DatabaseService<T> {
    constructor(
        private adapter: Adapter,
        private modelName: string,
        public validate: (input: Partial<T>, opts?: { partial?: boolean }) => T
    ) {}

    /**
     * Validate and insert a single document.
     */
    async insertOne(raw: Partial<T>) {
        const data = this.validate(raw);
        return this.adapter.insertOne(this.modelName, data);
    }

    /**
     * Fetch a single document by query.
     */
    async findOne(query: any) {
        return this.adapter.findOne(this.modelName, query);
    }

    /**
     * Fetch multiple documents that match a query.
     */
    async findMany(query: any = {}) {
        return this.adapter.findMany(this.modelName, query);
    }

    /**
     * Partially update a single document and return the result.
     */
    async findOneAndUpdate(query: any, raw: Partial<T>, options?: any) {
        const data = this.validate(raw, { partial: true });
        return this.adapter.findOneAndUpdate(this.modelName, query, data);
    }

    /**
     * Apply partial updates to all matching documents.
     */
    async updateMany(query: any, raw: Partial<T>) {
        const data = this.validate(raw, { partial: true });
        return this.adapter.updateMany(this.modelName, query, data);
    }

    /**
     * Delete a single document by query.
     */
    async deleteOne(query: any) {
        return this.adapter.deleteOne(this.modelName, query);
    }

    /**
     * Delete multiple documents that match a query.
     */
    async deleteMany(query: any) {
        return this.adapter.deleteMany(this.modelName, query);
    }
}
