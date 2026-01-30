import twilio from 'twilio';
import { SMSGateway } from './gateway.interface';
import { config } from '../../config/config';

const { accountSid, apiKey, apiSecret, fromNumber: from } = config.smsProviders.twilio;

const client = twilio(apiKey, apiSecret, {
    accountSid,
});

export const TwilioGateway: SMSGateway = {
    /**
     * Send an SMS via Twilio and throw if Twilio reports a failure.
     */
    async sendSMS(to, body) {
        try {
            const result = await client.messages.create({
                body,
                to,
                from,
            });

            if (result.errorCode || result.status === 'failed') {
                console.error('[Twilio] SMS failed:', {
                    sid: result.sid,
                    errorCode: result.errorCode,
                    errorMessage: result.errorMessage,
                    status: result.status,
                });
                throw new Error(`Twilio SMS failed: ${result.errorMessage}`);
            }

            return true;
        } catch (error) {
            throw error;
        }
    },
};
