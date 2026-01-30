import { IAMBridge } from './interface';
import { basicAuthOk, extractOtp } from '../utils/helpers';
import { Request, Response } from 'express';

const USER = 'fusionauth';
const PASS = process.env.FUSIONAUTH_PASS || '';

export const FusionAuthBridge: IAMBridge = {
    id: 'fusionauth',
    name: 'FusionAuth',
    version: '1.0.0',
    enabled: true,

    isAuthorized(req) {
        return basicAuthOk(req.headers.authorization || '', USER, PASS);
    },

    getPhoneNumber(req) {
        return req.body?.phoneNumber;
    },

    getOtpMessage(req) {
        return req.body?.textMessage;
    },

    extractOtpFromMessage(message) {
        return extractOtp(message);
    },

    handleSuccess(req: Request, res: Response, cid: string | undefined) {
        res.status(200).json({ status: 'delivered', handledBy: this.name, cid: cid || '' });
    },

    handleError(res: Response, error: Error) {
        res.status(502).json({ error: error.message || 'Downstream SMS send failed' });
    },

    isTest(message: string) {
        if (!message) return false;
        return message.toLowerCase().startsWith('testing');
    },

    handleTest(res: Response) {
        res.status(200).json({ status: 'test-ok' });
    },
};

export default FusionAuthBridge;
