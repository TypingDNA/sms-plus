import { SMSGateway } from './gateway.interface';
import { TwilioGateway } from './twilio';
import { config } from '../../config/config';

const { smsProvider } = config;

const gateways: Record<string, SMSGateway> = {
    twilio: TwilioGateway,
};

const active = smsProvider;
// Expose the configured SMS provider implementation.
export const smsGateway: SMSGateway = gateways[active];
