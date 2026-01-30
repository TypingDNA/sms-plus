import { IAMBridge } from './interface';
import { basicAuthOk, extractOtp, publicLink } from '../utils';
import { Request, Response } from 'express';

const USER = 'pingone';
const PASS = process.env.PING_SHARED_SECRET || '';

export const PingOneBridge: IAMBridge = {
    id: 'pingone',
    name: 'PingOne IAM',
    version: '1.0.0',
    enabled: true,

    isAuthorized(req) {
        return basicAuthOk(req.headers.authorization || '', USER, PASS);
    },

    getPhoneNumber(req) {
        return req.body?.recipient || req.body?.t0;
    },

    getOtpMessage(req) {
        return req.body?.body || req.body?.message || '000000';
    },

    extractOtpFromMessage(message) {
        return extractOtp(message);
    },

    handleSuccess(req: Request, res: Response, cid: string | undefined) {
        res.status(200).json({ cid: cid || '', link: cid ? publicLink(req, cid) : '' });
    },

    handleError(res: Response, error: Error) {
        res.status(502).json({ error: error.message || 'Downstream SMS send failed' });
    },

    isTest(message: string) {
        return false;
    },

    handleTest(res: Response) {},
};

export default PingOneBridge;
