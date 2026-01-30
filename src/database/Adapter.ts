export interface Adapter {
    init(): Promise<any>;
    insertOne(model: string, data: any): Promise<any>;
    insertMany(model: string, data: any[]): Promise<any[]>;

    findOne(model: string, filter: any): Promise<any>;
    findMany(model: string, filter?: any): Promise<any[]>;

    findOneAndUpdate(model: string, filter: any, update: any): Promise<any>;
    findOneAndIncrement(
        model: string,
        filter: any,
        update: Record<string, unknown>,
        options?: Record<string, unknown>
    ): Promise<any>;
    updateMany(model: string, filter: any, update: any): Promise<number>;

    deleteOne(model: string, filter: any): Promise<number>;
    deleteMany(model: string, filter: any): Promise<number>;
}
