import { MongoAdapter } from './MongoAdapter';
import { FirestoreAdapter } from './FirestoreAdapter';
import { RedisAdapter } from './RedisAdapter';
import { Adapter } from './Adapter';
import { config } from '../config/config';

let globalAdapter: Adapter;

/**
 * Instantiate the configured database adapter (Firestore, Redis, or Mongo).
 */
export function initAdapter() {
    switch (config.storeType) {
        case 'firestore':
            globalAdapter = new FirestoreAdapter(config.firebaseConfig);
            break;
        case 'redis':
            globalAdapter = new RedisAdapter(config.redis);
            break;
        case 'mongo':
            globalAdapter = new MongoAdapter(config.mongo.uri, config.mongo.dbName);
            break;
        default:
            throw new Error(`Unsupported data store type: ${config.storeType}`);
    }
}

/**
 * Retrieve the adapter instance, enforcing initialization first.
 */
export function getAdapter(): Adapter {
    if (!globalAdapter) {
        throw new Error('Adapter not initialized. Call initAdapter() first.');
    }
    return globalAdapter;
}
