import { config } from '../config/config';
import { Schema, model } from './Schema';

const DisableTokenSchema = new Schema({
    id: { type: String, required: true, unique: true },
    disableTid: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    type: { type: String },
    expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + config.ttl.disableToken * 60 * 1000),
    },
    createdAt: { type: Date, default: Date.now },
});

DisableTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'expires_At_TTL' });

export const DisableToken = model('DisableToken', DisableTokenSchema);
