import { Token } from '../models/Token';
import { DisableToken } from '../models/DisableToken';
import { generateTokenId } from '../utils/helpers';
import { config } from '../config/config';

/**
 * Create a one-time challenge token and persist it with TTL metadata.
 */
export const createToken = async (
    userId: string, // user id hashed
    bridgeId: string, // bridge id (okta, cyberark, fusionauth etc)
    otp: string, // save OTP sent by bridge
    message: string // initial SMS message
) => {
    const cid = generateTokenId();
    const now = new Date();
    const expiresAt = now.getTime() + (config.ttl.token || 0) * 60 * 1000; // 15 minutes

    const token = {
        id: cid,
        cid,
        userId,
        bridgeId,
        token: otp,
        originalMessage: message,
        failedAttempts: 0,
        createdAt: now,
        expiresAt,
    };

    await Token.insertOne(token);
    return { cid };
};

/**
 * Retrieve a challenge token document by its cid.
 */
export const getToken = async (cid: string) => {
    return await Token.findOne({ id: cid });
};

/**
 * Delete a challenge token after consumption or expiry.
 */
export const deleteToken = async (cid: string) => {
    await Token.deleteOne({ id: cid });
};

/**
 * Increment per-token failed attempts counter, returning the new value.
 */
export const incrementFailedAttempts = async (cid: string): Promise<number> => {
    const updated = await Token.findOneAndIncrement({ id: cid }, { failedAttempts: 1 });

    return updated?.failedAttempts ?? 0;
};

/**
 * Issue a short-lived disable token to allow users to turn off secure codes.
 */
export const createDisableToken = async (userId: string, type?: string) => {
    const disableTid = generateTokenId();
    const now = new Date();
    const expiresAt = now.getTime() + (config.ttl.disableToken || 0) * 60 * 1000; // 10 minutes

    const disableToken = {
        id: disableTid,
        disableTid,
        userId,
        expiresAt,
        ...(type ? { type } : {}),
    };

    await DisableToken.insertOne(disableToken);
    return disableTid;
};

/**
 * Fetch a disable token document by id.
 */
export const getDisableToken = async (disableTid: string) => {
    return await DisableToken.findOne({ id: disableTid });
};

/**
 * Remove a disable token once used.
 */
export const deleteDisableToken = async (disableTid: string) => {
    return await DisableToken.deleteOne({ id: disableTid });
};
