import { Request, Response, NextFunction } from 'express';
import { logger } from '../resources';

/**
 * Wrap async route handlers to surface thrown errors and log them consistently.
 */
export const errorInterceptor = (fn: Function) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            await fn(req, res, next);
        } catch (error: any) {
            let status = 500;
            let message = 'Internal server error';

            /**
             * Catch global axios errors
             */
            if (error && error.isAxiosError) {
                status = error.response?.status || 500;
                message = error.response?.data || error.message || 'Internal server error';
            }

            logger.error({
                action: 'errorInterceptor',
                userId: 'system',
                error: message,
                httpStatus: status,
                url: req.url,
                method: req.method,
            });

            return res.status(status).json({
                message,
            });
        }
    };
};
