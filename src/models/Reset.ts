import { Schema, model } from './Schema';

const ResetSchema = new Schema({
    id: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    deleteAfter: { type: Date, required: true },
    createdAt: { type: Date, default: () => new Date() },
});

ResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'expires_At_TTL' });

export const Reset = model('Reset', ResetSchema);
