import { Schema, model } from './Schema';

const UserSchema = new Schema({
    id: { type: String, required: true, unique: true },
    userId: { type: String, required: true, unique: true },
    textId: { type: Number },
    textToType: { type: String },
    enroll: { type: Boolean, default: false },
    attempts: { type: Number, default: 0 },
    invalidTpAttempts: { type: Number, default: 0 },
    lockoutUntil: { type: Number, default: 0 },
    createdAt: { type: Date, default: () => new Date() },
    updatedAt: { type: Date },
});

export const User = model('User', UserSchema);
