import { config } from '../config/config';
import { Schema, model } from './Schema';

export enum LogLevel {
    DEBUG = 'debug',
    INFO = 'info',
    WARN = 'warn',
    ERROR = 'error',
}

export interface LogEntry {
    id?: string;
    type?: LogLevel;
    action?: string;
    url?: string;
    method?: string;
    userId?: string;
    message?: string;
    error?: string;
    httpStatus?: number;
    expiresAt?: Date;
    createdAt?: Date;
}

const LogSchema = new Schema({
    id: { type: String, required: true, unique: true },
    type: { type: String },
    action: { type: String },
    url: { type: String },
    message: { type: String },
    method: { type: String },
    userId: { type: String },
    error: { type: String },
    httpStatus: { type: Number },
    expiresAt: { type: Date, default: () => new Date(Date.now() + config.ttl.logs * 60 * 1000) },
    createdAt: { type: Date, default: () => new Date() },
});

LogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'expires_At_TTL' });

export const Log = model('Log', LogSchema);
