import { IAMBridge } from './interface';
import { basicAuthOk, extractOtp } from '../utils/helpers';
import { Request, Response } from 'express';

const OKTA_SHARED_SECRET = process.env.OKTA_SHARED_SECRET || '';

export const OktaBridge: IAMBridge = {
    id: 'okta',
    name: 'Okta IAM',
    version: '1.0.0',
    enabled: true,

    isAuthorized(req) {
        return req.headers.authorization === `Bearer ${OKTA_SHARED_SECRET}`;
    },

    getPhoneNumber(req: Request) {
        if (req.body && req.body['data'] && req.body['data']) {
            const messageProfile = req.body.data['messageProfile'];
            return messageProfile ? messageProfile['phoneNumber'] : null;
        } else {
            return null;
        }
    },

    getOtpMessage(req) {
        if (req.body && req.body['data'] && req.body['data']) {
            const messageProfile = req.body.data['messageProfile'];
            return messageProfile ? messageProfile['msgTemplate'] : null;
        } else {
            return null;
        }
    },

    extractOtpFromMessage(message) {
        return extractOtp(message);
    },

    handleSuccess(req: Request, res: Response, cid: string | undefined) {
        res.status(200).json({
            commands: [
                {
                    type: 'com.okta.telephony.action',
                    value: [
                        {
                            status: 'SUCCESSFUL',
                            provider: 'TYPINGDNA',
                            transactionId: cid ? cid : null,
                        },
                    ],
                },
            ],
        });
    },

    handleError(res: Response, error: Error) {
        res.status(502).json({ error: error.message || 'Downstream SMS send failed' });
    },

    isTest(message: string) {
        return false;
    },

    handleTest(res: Response) {},
};

export default OktaBridge;
