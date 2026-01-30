import { getApps, initializeApp, App, cert, applicationDefault, getApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

import { Adapter } from './Adapter';
import { getRegisteredModels } from '../models/registry';

// Helper functions for setting the TTL indexes

/**
 * Obtain a bearer token from the initialized Firebase app credentials.
 */
async function getBearer(): Promise<string> {
    const cred: any = getApp().options.credential;
    if (!cred || typeof cred.getAccessToken !== 'function') {
        throw new Error('Admin credential not available (initializeApp first)');
    }
    const { access_token } = await cred.getAccessToken();
    if (!access_token) throw new Error('Failed to obtain access token');
    return access_token;
}

export async function enableTtl(opts: {
    projectId: string;
    databaseId?: string;
    collectionGroup: string;
    fieldPath: string;
    wait?: boolean;
}) {
    /**
     * Toggle TTL on the specified collection field using the Firestore REST API.
     */
    const { projectId, collectionGroup, fieldPath, wait = true } = opts;
    const databaseId = opts.databaseId ?? '(default)';
    const token = await getBearer();

    const url =
        `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}` +
        `/databases/${encodeURIComponent(databaseId)}` +
        `/collectionGroups/${encodeURIComponent(collectionGroup)}` +
        `/fields/${encodeURIComponent(fieldPath)}?updateMask=ttlConfig`;

    const res = await fetch(url, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ttlConfig: {} }),
    });

    if (!res.ok) throw new Error(`Enable TTL failed: ${res.status} ${await res.text()}`);
    const op = await res.json();
    if (!wait || !op?.name) return op;
    return waitOperation(op.name);
}

/**
 * Poll a long-running Firestore admin operation until it reports done.
 */
export async function waitOperation(operationName: string, intervalMs = 1500) {
    const token = await getBearer();
    while (true) {
        const r = await fetch(
            `https://firestore.googleapis.com/v1/${encodeURIComponent(operationName)}`,
            {
                headers: { Authorization: `Bearer ${token}` },
            }
        );
        if (!r.ok) throw new Error(`operations.get failed: ${r.status} ${await r.text()}`);
        const op = await r.json();
        if (op.done) return op;
        await new Promise((r) => setTimeout(r, intervalMs));
    }
}

interface FirestoreAdapterOptions {
    autoIndex?: boolean;
}

type FirebaseConfig = {
    projectId?: string;
    databaseId?: string;
    credential?: string;
};

export class FirestoreAdapter implements Adapter {
    private db: FirebaseFirestore.Firestore;
    private app: App;
    private config: FirebaseConfig;

    constructor(
        config: FirebaseConfig,
        private options: FirestoreAdapterOptions = { autoIndex: true }
    ) {
        if (!getApps().length) {
            this.app = initializeApp({
                credential: config?.credential ? cert(config.credential) : applicationDefault(),
                projectId: (config as any)?.projectId || process.env.FIREBASE_PROJECT_ID,
            });
        } else {
            this.app = getApps()[0]!;
        }

        const databaseId =
            (config as any)?.databaseId && (config as any).databaseId !== '(default)'
                ? (config as any).databaseId
                : undefined;
        this.db = getFirestore(this.app, databaseId);
        this.config = config;
    }

    async init() {
        if (!this.db) return false;
        if (this.options?.autoIndex) this.ensureIndexes();
        return true;
    }

    async insertOne(model: string, data: any) {
        const col = this.db.collection(model);
        const id = data.id || undefined;
        const ref = id ? col.doc(String(id)) : col.doc();
        await ref.set(data);
        return { ...data, id: ref.id };
    }

    async insertMany(model: string, data: any[]) {
        const col = this.db.collection(model);
        const batch = this.db.batch();

        data.forEach((d) => {
            const id = d.id || undefined;
            const ref = id ? col.doc(String(id)) : col.doc();
            batch.set(ref, d);
        });

        await batch.commit();
        return data;
    }

    async findOne(model: string, filter: any) {
        const id = filter.id || undefined;
        if (!id) return null;
        const ref = this.db.collection(model).doc(String(id));
        const snap = await ref.get();
        return snap.exists ? this.convertTimestamp(model, { id: snap.id, ...snap.data() }) : null;
    }

    async findMany(model: string) {
        const snap = await this.db.collection(model).get();
        return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    }

    async findOneAndUpdate(model: string, filter: any, update: any) {
        const id = filter.id || undefined;
        if (!id) throw new Error('Firestore findOneAndUpdate requires an id.');
        const ref = this.db.collection(model).doc(String(id));
        await ref.update(update);
        const updated = await ref.get();
        return updated.exists ? { id: updated.id, ...updated.data() } : null;
    }

    async updateMany(model: string, filter: any, update: any): Promise<number> {
        throw new Error('FirestoreAdapter does not support updateMany.');
    }

    async findOneAndIncrement(
        model: string,
        filter: any,
        update: Record<string, number>,
        options: Record<string, unknown> = {}
    ) {
        const id = filter?.id;
        if (!id) throw new Error('Firestore findOneAndIncrement requires an id.');

        const ref = this.db.collection(model).doc(String(id));

        const incPayload: Record<string, any> = {};
        for (let [field, amount] of Object.entries(update || {})) {
            if (typeof amount !== 'number' || !Number.isFinite(amount)) {
                amount = 1;
            }
            incPayload[field] = FieldValue.increment(amount);
        }

        await (options && (options as any).upsert
            ? ref.set(incPayload, { merge: true })
            : ref.update(incPayload));

        const snap = await ref.get();
        if (!snap.exists) return null;
        const payload = { id: snap.id, ...snap.data() };

        return payload;
    }

    async deleteOne(model: string, filter: any) {
        const id = filter.id || undefined;
        if (!id) return 0;
        const ref = this.db.collection(model).doc(String(id));
        await ref.delete();
        return 1;
    }

    async deleteMany(model: string, filter: any): Promise<number> {
        throw new Error('FirestoreAdapter does not support deleteMany.');
    }

    private async ensureIndexes() {
        const models = getRegisteredModels();

        const projectId = this.config.projectId;
        const databaseId = this.config.databaseId;

        if (!projectId) {
            console.warn(
                '[FirestoreAdapter] Missing projectId; set FIREBASE_PROJECT_ID or GOOGLE_CLOUD_PROJECT.'
            );
            return;
        }

        const tasks: Promise<unknown>[] = [];
        const seen = new Set<string>();

        for (const model of models) {
            const schema: any = model.schema || {};
            const indexes: Array<{ fields: Record<string, 1 | -1>; options?: any }> =
                schema.indexes || [];

            for (const idx of indexes) {
                const isTtl =
                    idx?.options?.expireAfterSeconds === 0 ||
                    idx?.options?.expireAfterSeconds === '0';

                if (!isTtl) continue;

                const keys = Object.keys(idx.fields || {});
                if (keys.length !== 1) {
                    console.warn(
                        `[FirestoreAdapter] TTL index on "${model.name}" must reference exactly one field (got: ${keys.join(', ')})`
                    );
                    continue;
                }

                const fieldName = keys[0];
                const sig = `${model.name}::${fieldName}`;
                if (seen.has(sig)) continue;
                seen.add(sig);

                tasks.push(
                    enableTtl({
                        projectId,
                        databaseId,
                        collectionGroup: model.name,
                        fieldPath: fieldName,
                        wait: false,
                    }).catch((e: any) => {
                        console.warn(
                            `[FirestoreAdapter] enableTtl failed for ${model.name}.${fieldName}:`,
                            e?.message || e
                        );
                    })
                );
            }
        }

        await Promise.all(tasks);
    }

    private convertTimestamp(modelName: string, data: any) {
        const models = getRegisteredModels();
        const model = models.find((m) => m.name === modelName);
        if (model) {
            for (const [key, def] of Object.entries(model.schema.fields)) {
                if (def.type === Date) {
                    if (data.hasOwnProperty(key)) {
                        const v: any = (data as any)[key];
                        if (v && typeof v.toDate === 'function') {
                            (data as any)[key] = v.toDate();
                        }
                    }
                }
            }
        }

        return data;
    }
}
