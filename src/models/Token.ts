import { config } from '../config/config';
import { Schema, model } from './Schema';

const TokenSchema = new Schema({
    id: { type: String, required: true, unique: true },
    cid: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    bridgeId: { type: String },
    token: { type: String },
    originalMessage: { type: String },
    failedAttempts: { type: Number, default: 0 },
    expiresAt: { type: Date, default: () => new Date(Date.now() + config.ttl.token * 60 * 1000) },
    createdAt: { type: Date, default: () => new Date() },
});

TokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'expires_At_TTL' });

export const Token = model('Token', TokenSchema);
