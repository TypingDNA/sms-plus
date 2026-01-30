import { Log, LogEntry, LogLevel } from '../models/Log';
import { logger } from '../resources/Logger';

/**
 * Logging Service with Exponential Backoff Retry
 *
 * Retry delays: 1s → 2s → 4s → 8s → 16s (max 30s)
 * After 5 failed attempts, logs are saved to file for later processing
 *
 * Examples:
 *
 * // Single log with retry
 * await logService.insertLog({
 *   action: 'user_login',
 *   userId: 'user123',
 *   message: 'Login successful'
 * });
 *
 * // Bulk logs with retry
 * await logService.insertLogsBulk([
 *   { action: 'sms_sent', userId: 'user1' },
 *   { action: 'sms_sent', userId: 'user2' }
 * ]);
 */

class LogService {
    private static instance: LogService;

    private readonly retryConfig = {
        maxRetries: 5,
        baseDelay: 1000, // 1 second
        maxDelay: 30000, // 30 seconds
        backoffMultiplier: 2,
    };

    constructor() {}

    // Create singleton instance
    static getInstance(): LogService {
        if (!LogService.instance) {
            LogService.instance = new LogService();
        }
        return LogService.instance;
    }

    /**
     * Insert single or multiple log entries with retry mechanism
     */
    async insertLogs(data: LogEntry[]): Promise<void> {
        try {
            await this.insertWithRetry(data, 0);
        } catch (error: any) {
            logger.error({
                action: 'logInsertError',
                userId: 'system',
                message: 'Failed to insert bulk logs after all retries:',
                error: error?.message,
            });
            throw error;
        }
    }

    /**
     * Insert with exponential backoff retry mechanism
     */
    private async insertWithRetry(data: LogEntry[], attempt: number): Promise<void> {
        try {
            if (data.length === 1) {
                await Log.insertOne(data[0]);
            } else {
                await Log.insertMany(data);
            }
        } catch (error: any) {
            if (attempt < this.retryConfig.maxRetries) {
                const delay = this.calculateBackoffDelay(attempt);

                logger.debug(
                    `Log insert failed (attempt ${attempt + 1}/${this.retryConfig.maxRetries}), retrying in ${delay}ms, error: ${error?.message}`
                );

                await this.delay(delay);
                return this.insertWithRetry(data, attempt + 1);
            }

            // Failed after all retries
            throw error;
        }
    }

    /**
     * Calculate exponential backoff delay
     */
    private calculateBackoffDelay(attempt: number): number {
        const delay =
            this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt);
        return Math.min(delay, this.retryConfig.maxDelay);
    }

    /**
     * Utility function for delays
     */
    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

export const logService = LogService.getInstance();
export { LogLevel, LogEntry };
