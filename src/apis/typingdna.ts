import axios from 'axios';
import {
    ITDNAVerifyResponse,
    ITDNAEnrollResponse,
    ITDNACheckUserResponse,
    ITDNADeleteUserResponse,
    ITDNAGetPostureResponse,
} from './typingdna.interface';
import { config } from '../config/config';
import { logger } from '../resources';

const {
    typingDNA: { server, apiKey, apiSecret, timeoutMs = 20000 },
} = config;

export class TypingDNA {
    private static instance: TypingDNA;
    private readonly isInstantiated: boolean = false;
    private readonly apiUrl: string = '';
    private readonly authHeader: { auth: { username: string; password: string } } = {
        auth: {
            username: '',
            password: '',
        },
    };
    private readonly timeout: number = timeoutMs;

    constructor(server: string, apiKey: string, apiSecret: string) {
        if (!server || !apiKey || !apiSecret) {
            logger.debug('TypingDNA API not instantiated. Please check configuration.');

            this.isInstantiated = false;
            return;
        }

        this.apiUrl = server;
        this.authHeader = {
            auth: {
                username: apiKey,
                password: apiSecret,
            },
        };
        this.isInstantiated = true;
    }

    /**
     * Singleton instance of TypingDNA API
     */
    static getInstance(): TypingDNA {
        if (!TypingDNA.instance) {
            TypingDNA.instance = new TypingDNA(server, apiKey, apiSecret);
        }
        return TypingDNA.instance;
    }

    /**
     * Verify a typing pattern, auto-enrolling if TypingDNA is configured for it.
     */
    async verifyTypingPattern(userId: string, tp: string): Promise<ITDNAVerifyResponse> {
        if (!this.isInstantiated) {
            throw new Error('TypingDNA API is not instantiated');
        }

        const response = await axios.post(
            `${this.apiUrl}/verify/${userId}`,
            { tp },
            { ...this.authHeader, timeout: this.timeout },
        );
        return response.data;
    }

    /**
     * Enroll a new typing pattern for a user.
     */
    async enrollTypingPattern(userId: string, tp: string): Promise<ITDNAEnrollResponse> {
        if (!this.isInstantiated) {
            throw new Error('TypingDNA API is not instantiated');
        }

        const response = await axios.post(
            `${this.apiUrl}/save/${userId}`,
            { tp },
            { ...this.authHeader, timeout: this.timeout },
        );
        return response.data;
    }

    /**
     * Check TypingDNA user profile statistics, including mobile count.
     */
    async checkUser(userId: string, textid: string | number): Promise<ITDNACheckUserResponse> {
        if (!this.isInstantiated) {
            throw new Error('TypingDNA API is not instantiated');
        }

        const response = await axios.get(`${this.apiUrl}/user/${userId}`, {
            ...this.authHeader,
            params: {
                textid,
            },
            timeout: this.timeout,
        });
        return response.data;
    }

    /**
     * Delete a user profile and associated patterns from TypingDNA.
     */
    async deleteUser(userId: string, textid: string | number): Promise<ITDNADeleteUserResponse> {
        const response = await axios.delete(`${this.apiUrl}/user/${userId}`, {
            ...this.authHeader,
            params: {
                textid,
            },
            timeout: this.timeout,
        });
        return response.data;
    }

    /**
     * Retrieve the inferred posture for a given typing pattern.
     */
    async getPosture(userId: string, tp: string): Promise<ITDNAGetPostureResponse> {
        if (!this.isInstantiated) {
            throw new Error('TypingDNA API is not instantiated');
        }

        const response = await axios.post(
            `${this.apiUrl}/verify/${userId}`,
            {
                userId,
                tp,
                positionOnly: true,
            },
            { ...this.authHeader, timeout: this.timeout },
        );
        return response.data;
    }
}

/**
 * export instance of TypingDNA API
 */
export const typingdna = TypingDNA.getInstance();
export * from './typingdna.interface';
