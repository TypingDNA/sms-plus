import { Request } from 'express';
import { config } from '../config/config';

/**
 * Build a public URL for a challenge id, falling back to the request host.
 */
export function publicLink(req: Request, cid: string): string {
    const base = config.baseUrl || `http://${req.headers.host}`;
    return `${base}/${cid}`;
}
