import { Request } from 'express';
import { IAMBridge } from './interface';
import { mobileProfileCount } from '../services/typingDnaService';
import { createToken } from '../services/tokenService';
import { sendTokenSMS, sendFallbackSMS } from '../apis/sms';
import { publicLink, validatePhone, sanitizePhone, getUserIdHashed } from '../utils';
import { getOrCreateUser, updateUser, getUserResetTime } from '../services/authStateService';

/**
 * Handle inbound webhook from an IAM bridge: validate, generate token, and send SMS.
 */
export async function handleBridgeRequest(
    bridge: IAMBridge,
    req: Request
): Promise<{ cid: string | undefined; isTest: boolean }> {
    if (!bridge.isAuthorized(req)) {
        throw new Error('Unauthorized');
    }

    const phone = sanitizePhone(bridge.getPhoneNumber(req));
    const message = bridge.getOtpMessage(req);

    if (bridge.isTest(message)) {
        return { cid: undefined, isTest: true };
    }

    if (!validatePhone(phone)) throw new Error('Invalid phone number');

    const otp = bridge.extractOtpFromMessage(message);

    if (!otp) {
        throw new Error('No OTP found');
    }

    const userId = getUserIdHashed(phone);

    const user = await getOrCreateUser(userId);

    /**
     * on server errors (network errors, timeout errors, incorrect configuration of TypingDNA API), 
     * fallback to the original message
     */
    const { isServerError, tpCount = 0 } = await mobileProfileCount(userId, user.textId);

    if(isServerError) {
        const sent = await sendFallbackSMS(phone, message, userId);
        if (!sent) throw new Error('SMS send failed');

        return { cid: undefined, isTest: false };
    }

    // determine if user is enrolling
    const enroll = tpCount < 1;
    if (user.enroll !== enroll) {
        await updateUser(userId, { enroll });
    }

    // determine if user has expired reset time (new enrollment needed)
    const resetTime = await getUserResetTime(userId);
    const isResettingProfile = resetTime && resetTime <= Date.now();

    // create Token and send SMS
    const { cid } = await createToken(userId, bridge.id, otp, message);
    const link = publicLink(req, cid);

    const addOTPToMessage = Boolean(enroll || isResettingProfile);
    const sent = await sendTokenSMS(phone, link, otp, addOTPToMessage, userId);
    if (!sent) throw new Error('SMS send failed');

    return { cid, isTest: false };
}
