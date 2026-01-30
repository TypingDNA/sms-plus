import { IAMBridge } from './interface';
import { extractOtp } from '../utils';
import { Request, Response } from 'express';

const AUTH0_SECRET = process.env.AUTH0_SECRET;

export const Auth0Bridge: IAMBridge = {
    id: 'auth0',
    name: 'Auth0 IAM',
    version: '1.0.0',
    enabled: true,

    isAuthorized(req: Request) {
        return req.headers.authorization === `Bearer ${AUTH0_SECRET}`;
    },

    getPhoneNumber(req: Request) {
        return req.body?.recipient || req.body?.phoneNumber;
    },

    getOtpMessage(req) {
        return req.body?.message || req.body?.smsMessage;
    },

    extractOtpFromMessage(message) {
        return extractOtp(message);
    },

    handleSuccess(req: Request, res: Response, cid: string | undefined) {
        res.status(200).json({ status: 'ok', handledBy: this.name, cid: cid || '' });
    },

    handleError(res: Response, error: Error) {
        res.status(502).json({ error: error.message || 'Downstream SMS send failed' });
    },

    isTest(message) {
        return false;
    },

    handleTest(res: Response) {},
};

export default Auth0Bridge;
