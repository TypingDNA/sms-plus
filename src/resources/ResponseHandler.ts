import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { logger, ErrorCodes } from './';
import { config } from '../config/config';

export class ResponseHandler {
    private static logRequest(
        req: Request,
        res: Response,
        data: any,
        statusCode: number,
        action: 'requestSuccess' | 'requestError'
    ) {
        if (!config.logging.logRequests) return;

        const { userId } = res.locals;

        const log = {
            action,
            userId: userId ?? 'system',
            httpStatus: statusCode,
            url: req.originalUrl,
            method: req.method,
        };

        if (action === 'requestSuccess')
            return logger.info({ ...log, message: JSON.stringify(data) });
        else return logger.error({ ...log, error: JSON.stringify(data) });
    }

    /**
     * Return 200 with json data
     */
    static success(req: Request, res: Response, data: any, statusCode: number = 200) {
        this.logRequest(req, res, data, statusCode, 'requestSuccess');

        return res.status(statusCode).json(data);
    }

    /**
     * Return 400 with json error
     */
    static error(req: Request, res: Response, error: any, statusCode: number = 400) {
        this.logRequest(req, res, error, statusCode, 'requestError');

        return res.status(statusCode).json({
            code: 'UNKNOWN_ERROR',
            message: 'An error occurred',
            ...error,
        });
    }

    /**
     * Load the html template, replace placeholders with dynamic data
     * and send the html to the client
     */
    static renderTemplate(res: Response, templateName: string, data: Record<string, any>) {
        const filePath = path.join(__dirname, '..', 'templates', `${templateName}.html`);
        let html = fs.readFileSync(filePath, 'utf-8');

        /**
         * Replace {{placeholder}} or {{object.placeholder}} with corresponding values from data object
         */
        html = html.replace(/\{\{([\w.]+)\}\}/g, (_, key) => {
            try {
                if (!(key in data)) {
                    // if the key contains a dot, we look for the property in the object
                    if (key.includes('.')) {
                        const [obj, property] = key.split('.');
                        if (!data[obj] || typeof data[obj] !== 'object') return '';

                        return String(data[obj][property]);
                    }
                    // no key found in data object
                    return '';
                }

                const value = data[key];

                // If the value is an object, stringify it for JavaScript usage
                if (typeof value === 'object' && value !== null) {
                    return JSON.stringify(value);
                }

                // default: return the value as a string
                return String(value);
            } catch (error) {
                return '';
            }
        });

        res.send(html);
    }

    static locked(req: Request, res: Response, tryAgainMinutes?: number) {
        const error = tryAgainMinutes
            ? ErrorCodes.tooManyFailedAttemptsUserLocked(tryAgainMinutes)
            : ErrorCodes.tooManyFailedAttemptsSessionLocked;
        return this.error(req, res, error, 403);
    }
}
