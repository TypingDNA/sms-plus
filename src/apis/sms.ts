import { smsGateway } from './gateways';
import { logger } from '../resources';

/**
 * Send the primary secure-code SMS with either enrollment or verification copy.
 */
export async function sendTokenSMS(
    to: string,
    link: string,
    otp: string,
    addOTPToMessage: boolean, // in enroll mode or resetting user profile
    userId: string // user id hashed
): Promise<boolean> {
    const message = addOTPToMessage
        ? `Your code is ${otp}.\nTurn on secure codes: ${link}`
        : `Get your secure code:\n${link}`;

    try {
        logger.info({
            action: 'sendTokenSMS',
            userId,
            message: `to: ${to}, message: ${message}`,
        });
        await smsGateway.sendSMS(to, message);

        return true;
    } catch (error: any) {
        logger.error({
            action: 'sendTokenSMS',
            userId,
            message: `SMS send failed for ${to}`,
            error: error?.message,
        });
        return false;
    }
}

/**
 * Send a fallback SMS message, typically used when the main path fails.
 */
export async function sendFallbackSMS(
    to: string,
    message: string,
    userId: string // user id hashed
): Promise<boolean> {
    try {
        logger.info({
            action: 'sendFallbackSMS',
            userId,
            message: `to: ${to}, message: ${message}`,
        });
        console.log('Sending Fallback SMS:', `to: ${to}, message: ${message}`);
        await smsGateway.sendSMS(to, message);

        return true;
    } catch (error: any) {
        logger.error({
            action: 'sendFallbackSMS',
            userId,
            message: `SMS send failed for ${to}`,
            error: error?.message,
        });
        return false;
    }
}
