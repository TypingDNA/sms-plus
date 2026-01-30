import crypto from 'crypto';
import { config } from '../config/config';

const { hashSalt: HASH_SALT } = config;
/**
 * Base62 characters: 0-9, A-Z, a-z (without special characters)
 */
const BASE_62_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
/**
 * Regex to validate if a string is alphanumeric
 * - at least one letter
 * - at least one number
 * - no special characters
 */
const REGEX_ALPHANUMERIC = /^(?=.*[a-zA-Z])(?=.*[0-9])[A-Za-z0-9]+$/;
const TOKEN_ID_LENGTH = 6;

/**
 * Split array into chunks of specified size
 */
export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
}

/**
 * Remove non-digit characters and leading extras from a phone number.
 */
export function sanitizePhone(phone: string): string {
    if (!phone || typeof phone !== 'string') return '';

    const match = phone.trim().match(/^\+?\d+/);
    return match ? match[0] : '';
}

/**
 * Strip disallowed characters to keep URLs safe for logging or redirects.
 */
export function sanitizeUrl(url: string): string {
    return url.replace(/[^A-Za-z0-9\-._~:\/?#\[\]@!$&'()*+,;=%]/g, '');
}

/**
 * Ensure phone string is in E.164-ish format with a leading plus and digits.
 */
export const validatePhone = (phone: string): boolean => {
    if (!phone || typeof phone !== 'string') return false;

    const arr = phone && phone.match(/^\+\d{6,15}$/);
    return Array.isArray(arr) && arr.length > 0;
};

/**
 * Extract a numeric OTP token out of an arbitrary message body.
 */
export function extractOtp(message: string): string | null {
    if (!message || typeof message !== 'string') return null;

    const match = message?.match(/\b\d{4,8}\b/);
    return match ? match[0] : null;
}

/**
 * Validate an HTTP Basic auth header against expected credentials.
 */
export function basicAuthOk(
    authHeader: string,
    expectedUser: string,
    expectedPass: string
): boolean {
    if (!authHeader?.startsWith('Basic ')) return false;

    try {
        const base64Credentials = authHeader.split(' ')[1];
        const credentials = Buffer.from(base64Credentials, 'base64').toString('utf8');
        const [user, pass] = credentials.split(':');

        return user === expectedUser && pass === expectedPass;
    } catch {
        return false;
    }
}

/**
 * Hashes the user id using a salt, with the SHA256 algorithm
 */
export const getUserIdHashed = (userId: string) => {
    return hash(userId, HASH_SALT);
};

function hash(text: string, salt: string = ''): string {
    return crypto
        .createHash('sha256')
        .update(text + salt)
        .digest('hex');
}

/**
 * Generates a short unique ID (6-8 characters) using base62 encoding
 * Combines timestamp and random component for uniqueness
 */
export const generateTokenId = (): string => {
    const length = TOKEN_ID_LENGTH;
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000000);

    // Combine timestamp and random into a single number
    const combined = timestamp * 1000000 + random;

    let result = '';
    let num = combined;

    // Convert to base62
    while (num > 0 && result.length < length) {
        result = BASE_62_CHARS[num % 62] + result;
        num = Math.floor(num / 62);
    }

    // Pad with random characters if needed
    while (result.length < length) {
        result = BASE_62_CHARS[Math.floor(Math.random() * 62)] + result;
    }

    // Ensure we don't exceed the requested length
    let tokenId = result.slice(-length);

    // validate tokenId is alphanumeric, else generate a new one
    if (!REGEX_ALPHANUMERIC.test(tokenId)) {
        tokenId = generateTokenId();
    }

    return tokenId;
};

/**
 * Validates if a string is a valid 8-character base62 token
 * @param cid - The token to validate
 * @returns true if valid, false otherwise
 */
export const validateTokenId = (cid: string): boolean => {
    // Check if cid exists and is exactly TOKEN_ID_LENGTH characters
    if (!cid || typeof cid !== 'string' || cid.length !== TOKEN_ID_LENGTH) {
        return false;
    }

    // Check if all characters are valid base62 characters
    return REGEX_ALPHANUMERIC.test(cid);
};
