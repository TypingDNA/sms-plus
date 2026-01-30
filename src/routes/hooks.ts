import express, { Request, Response } from 'express';
import { activeBridges } from '../bridges/registry';
import { handleBridgeRequest } from '../bridges/handler';

const router = express.Router();

/**
 * Dynamic Bridge Webhook Endpoints
 *
 * This service provides dynamic webhook endpoints for different IAM bridges.
 * Each bridge has its own authentication method and request format.
 *
 * Available Endpoints:
 * - POST /hooks/okta
 * - POST /hooks/cyberark
 * - POST /hooks/fusionauth
 *
 * Bridge-Specific Requirements:
 *
 * 1. OKTA BRIDGE (/hooks/okta)
 *    - Authentication: Bearer token in Authorization header
 *    - Header: Authorization: Bearer {OKTA_SHARED_SECRET}
 *    - Body: JSON
 *      {
 *        "phoneNumber": "+1234567890",
 *        "msgTemplate": "Your OTP is: 123456"
 *      }
 *
 * 2. CYBERARK BRIDGE (/hooks/cyberark)
 *    - Authentication: Basic Auth
 *    - Header: Authorization: Basic {base64(username:password)}
 *    - Username: cyberark
 *    - Password: Set via CYBERARK_PASS environment variable
 *    - Body: JSON
 *      {
 *        "phoneNumber": "+1234567890",
 *        "smsMessage": "Your OTP is: 123456"
 *      }
 *
 * 3. FUSIONAUTH BRIDGE (/hooks/fusionauth)
 *    - Authentication: Basic Auth
 *    - Header: Authorization: Basic {base64(username:password)}
 *    - Username: fusionauth
 *    - Password: Set via FUSIONAUTH_PASS environment variable
 *    - Body: JSON
 *      {
 *        "phoneNumber": "+1234567890",
 *        "textMessage": "Your OTP is: 123456"
 *      }
 *
 * Common Response Format:
 * - Success: 200 OK with JSON body
 *   {
 *     "status": "ok",
 *     "handledBy": "{bridge_name}"
 *   }
 * - Error: 500 Internal Server Error with JSON body
 *   {
 *     "error": "error_message"
 *   }
 *
 * Notes:
 * - All phone numbers should be in international format (+1234567890)
 * - OTP extraction is automatic from the message content
 * - Test messages starting with "test" are ignored
 * - SMS sending failures will return 500 error
 */
for (const bridge of activeBridges) {
    router.post(`/${bridge.id}`, async (req: Request, res: Response) => {
        try {
            const bridgeReq: { cid: string | undefined; isTest: boolean } =
                await handleBridgeRequest(bridge, req);
            if (bridgeReq.isTest) {
                bridge.handleTest(res);
            } else {
                bridge.handleSuccess(req, res, bridgeReq.cid);
            }
        } catch (err: any) {
            console.error(`Bridge error [${bridge.id}]:`, err.message);
            bridge.handleError(res, err);
        }
    });
}

export default router;
