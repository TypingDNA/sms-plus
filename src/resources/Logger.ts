import { v4 as uuidv4 } from 'uuid';
import { logService, LogLevel, LogEntry } from '../services/logService';
import { chunkArray, sanitizeUrl } from '../utils';
import { config } from '../config/config';

/**
 * Enhanced Logger with Bulk Insert and Retry Mechanism
 *
 * Debug messages logged in console
 * Info, Warnings and Errors logged in database with a configured TTL
 * - logs are added to a buffer and flushed periodically
 * - logs are inserted in bulk to the database on flush
 * - logs are inserted with a retry mechanism, fallback to file on failure
 */
class Logger {
    private static instance: Logger;
    /**
     * Log events starting from this level
     */
    private currentLevel: LogLevel;

    private ttlMilliseconds = 1000 * 60 * (config.ttl.logs || 30);

    private levelPriority: Record<LogLevel, number> = {
        debug: 0,
        info: 1,
        warn: 2,
        error: 3,
    };
    private buffer: LogEntry[] = [];
    private flushTimer: NodeJS.Timeout | null = null;
    private isShuttingDown = false;
    private isFlushing = false; // Mutual exclusion to prevent concurrent flushing

    private readonly bulkConfig = {
        batchSize: 100,
        flushInterval: 5000, // 5 seconds
        maxBufferSize: 1000,
    };

    private constructor() {
        /**
         * log entries higher or equal to the current level
         */
        this.currentLevel = (config.logging.logLevel as LogLevel) || LogLevel.DEBUG;

        this.startFlushTimer();
    }

    static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    private shouldLog(level: LogLevel): boolean {
        return this.levelPriority[level] >= this.levelPriority[this.currentLevel];
    }

    private consoleFormat(logLevel: LogLevel, raw: LogEntry | string): string {
        const timestamp = new Date().toISOString();
        const levelTag = `[${timestamp}] [${logLevel.toUpperCase()}]`;
        const message = typeof raw === 'string' ? raw : raw?.message || raw?.error;

        return `${levelTag} ${message}`;
    }

    private logFormat(logLevel: LogLevel, raw: LogEntry | string): LogEntry {
        /**
         * transform 'raw' parameter to LogEntry it if comes as string
         */
        const data = typeof raw === 'string' ? { message: raw } : { ...raw };

        const log = {
            id: uuidv4(),
            type: logLevel,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + this.ttlMilliseconds),
            ...(data.action && { action: data.action }),
            ...(data.url && { url: sanitizeUrl(data.url) }),
            ...(data.method && { method: data.method }),
            ...(data.userId && { userId: data.userId }),
            ...(data.message && { message: data.message }),
            ...(data.error && { error: data.error }),
            ...(data.httpStatus && { httpStatus: data.httpStatus }),
        };

        return log;
    }

    /**
     * Start periodic flush timer
     */
    private startFlushTimer(): void {
        this.flushTimer = setInterval(() => {
            if (this.buffer.length > 0) {
                this.flushBuffer();
            }
        }, this.bulkConfig.flushInterval);
    }

    /**
     * Flush buffered logs
     */
    private async flushBuffer(): Promise<void> {
        if (this.buffer.length === 0 || this.isFlushing) return;

        this.isFlushing = true;

        try {
            // Process all items in buffer, not just batchSize
            const allItems = this.buffer.splice(0);
            const batches = chunkArray(allItems, this.bulkConfig.batchSize);

            for (const batch of batches) {
                try {
                    await logService.insertLogs(batch);
                } catch (error: any) {
                    // Failed logs after the retry mechanism, add back to buffer for retry
                    this.buffer.unshift(...batch);
                }
            }
        } finally {
            this.isFlushing = false;
        }
    }

    /**
     * Add log to buffer for batch processing
     */
    private async addToBuffer(data: LogEntry) {
        if (this.isShuttingDown) {
            // If shutting down, insert immediately
            await logService.insertLogs([data]).catch((error) =>
                logger.error({
                    action: 'logInsertError',
                    message: 'Failed to insert log during shutdown:',
                    error: error?.message,
                    userId: 'system',
                })
            );
            return;
        }

        this.buffer.push(data);

        // Flush immediately if buffer is full or growing too large
        if (
            this.buffer.length >= this.bulkConfig.batchSize ||
            this.buffer.length > this.bulkConfig.maxBufferSize
        ) {
            this.flushBuffer();
        }
    }

    /************************
     * Exposed public methods
     *************************/

    debug(data: LogEntry | string): void {
        if (this.shouldLog(LogLevel.DEBUG)) console.debug(this.consoleFormat(LogLevel.DEBUG, data));
    }

    info(data: LogEntry | string): void {
        if (!this.shouldLog(LogLevel.INFO)) return;

        // console.info(this.consoleFormat(LogLevel.INFO, data));
        this.addToBuffer(this.logFormat(LogLevel.INFO, data));
    }

    warn(data: LogEntry | string): void {
        if (!this.shouldLog(LogLevel.WARN)) return;

        console.warn(this.consoleFormat(LogLevel.WARN, data));
        this.addToBuffer(this.logFormat(LogLevel.WARN, data));
    }

    error(data: LogEntry | string): void {
        if (!this.shouldLog(LogLevel.ERROR)) return;

        console.error(LogLevel.ERROR, data);
        this.addToBuffer(this.logFormat(LogLevel.ERROR, data));
    }

    /**
     * Setup graceful shutdown
     * - clear interval
     * - flush all logs
     * - log service shutdown complete
     */
    async setupGracefulShutdown(): Promise<void> {
        this.isShuttingDown = true;

        if (this.flushTimer) {
            clearInterval(this.flushTimer);
        }

        logger.debug('Flushing remaining logs before shutdown...');
        if (this.buffer.length > 0) {
            await this.flushBuffer();
        }
        logger.debug('Log service shutdown complete');
    }
}

export const logger = Logger.getInstance();
