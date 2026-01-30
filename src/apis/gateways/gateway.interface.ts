export interface SMSGateway {
    sendSMS(to: string, body: string): Promise<boolean>;
}
