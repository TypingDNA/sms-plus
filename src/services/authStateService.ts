import { incrementFailedAttempts, deleteToken, getToken, createDisableToken } from './tokenService';
import { getPendingReset, purgeReset, saveReset } from './resetService';
import {
    getUser as getUserFromDb,
    createUser,
    deleteUser as deleteUserFromDb,
    updateUser as updateUserFromDb,
    incrementFailedAuth,
} from './userService';
import { logger } from '../resources';
import { getTextId, getDefaultText } from './typingDnaService';
import { getRandomText } from './challengeTextService';
import { config } from '../config/config';

const { globalMaxFailedAttempts, globalLockoutDuration } = config.lockout;

/********************************************
 * User Methods
 ********************************************/

/**
 * Fetch a user document by id, logging errors instead of throwing.
 */
export async function getUser(userId: string): Promise<any | null> {
    try {
        const user = await getUserFromDb(userId);
        return user;
    } catch (error: any) {
        logger.error({ action: 'getUser', userId, error: error?.message });
        return null;
    }
}

/**
 * Find an existing user or create a blank profile if none exists.
 */
export async function getOrCreateUser(userId: string) {
    try {
        let user = await getUserFromDb(userId);
        if (!user) user = await createUser(userId);

        return user;
    } catch (error: any) {
        logger.error({ action: 'getOrCreateUser', userId, error: error?.message });
        throw error;
    }
}

/**
 * Apply a partial update to a user document.
 */
export async function updateUser(userId: string, update: any) {
    try {
        return await updateUserFromDb(userId, update);
    } catch (error: any) {
        logger.error({ action: 'updateUser', userId, error: error?.message });
        throw error;
    }
}

/**
 * Delete a user and its state.
 */
export async function deleteUser(userId: string) {
    try {
        return await deleteUserFromDb(userId);
    } catch (error: any) {
        logger.error({ action: 'deleteUser', userId, error: error?.message });
        throw error;
    }
}

/**
 * Reset lockout counters and allocate a new TypingDNA sentence.
 */
export async function resetUserAndAllocateNewText(userId: string) {
    const textToType = getRandomText() || getDefaultText();
    const textId = getTextId(textToType);

    // get new text & textId
    return await updateUserFromDb(userId, {
        textToType,
        textId,
        attempts: 0,
        lockoutUntil: 0,
        enroll: true,
        updatedAt: new Date(),
    });
}

/********************************************
 * Cid Token Methods
 ********************************************/

/**
 * Fetch a challenge token document by cid.
 */
export async function getCidToken(cid: string) {
    return await getToken(cid);
}

/**
 * Track per-challenge failed attempts and swallow missing-token errors.
 */
export async function incrementCidFailedAttempts(cid: string, userId: string): Promise<number> {
    try {
        return await incrementFailedAttempts(cid);
    } catch (error: any) {
        // Handle errors such as
        // ReplyError: ERR could not perform this operation on a key that doesn't exist
        logger.error({
            action: 'incrementCidFailedAttempts',
            message: `cid: ${cid}`,
            userId,
            error: error?.message,
        });
        return 0;
    }
}

/**
 * Delete a challenge token after successful use.
 */
export async function consumeCidToken(cid: string) {
    await deleteToken(cid);
}

/********************************************
 * Global lockout status
 ********************************************/

/**
 * Check if user is globally locked out
 * If lockout time expired, remove global lockout
 * Return lockout status and time remaining in minutes
 * @param user
 * @returns
 */
export async function isGlobalLockout(
    user: any
): Promise<{ locked: boolean; tryAgainMinutes: number }> {
    try {
        if (!user || !user.lockoutUntil) return { locked: false, tryAgainMinutes: 0 };

        const wait = user.lockoutUntil - Date.now();
        const waitMsSeconds = Math.max(wait, 0);

        // if lockout time expired, remove global lockout
        if (wait <= 0) {
            await resetGlobalFailedState(user.userId);
        }

        return {
            locked: wait > 0,
            tryAgainMinutes: Math.floor(waitMsSeconds / 60 / 1000) + 1,
        };
    } catch (error: any) {
        logger.error({
            action: 'checkUserGlobalLockout',
            userId: user.userId,
            error: error?.message,
        });
        return { locked: false, tryAgainMinutes: 0 };
    }
}

export async function incrementGlobalFailedAttempt(
    userId: string
): Promise<{ lockout: boolean; tryAgainMinutes: number }> {
    try {
        // increment failed attempt on user
        const failCount = await incrementFailedAuth(userId);

        // check if user reached lockout threshold & calculate lockout time
        if (failCount >= globalMaxFailedAttempts) {
            const tryAgainMinutes = globalLockoutDuration;
            await updateUserFromDb(userId, {
                lockoutUntil: Date.now() + tryAgainMinutes * 60 * 1000,
                updatedAt: new Date(),
            });

            return { lockout: true, tryAgainMinutes };
        }

        return { lockout: false, tryAgainMinutes: 0 };
    } catch (error: any) {
        logger.error({ action: 'incrementGlobalFailedAttempt', userId, error: error?.message });

        throw error;
    }
}

/**
 * Used after successful verification — reset global failed state
 */
export async function resetGlobalFailedState(userId: string) {
    try {
        await updateUserFromDb(userId, {
            attempts: 0,
            lockoutUntil: 0,
            updatedAt: new Date(),
        });
    } catch (error: any) {
        logger.error({ action: 'resetGlobalFailedState', userId, error: error?.message });
        throw error;
    }
}

/********************************************
 * Disable Token Methods
 ********************************************/

/**
 * Issue and store a disable token for the given user.
 */
export async function saveDisableToken(userId: string, type?: string) {
    return await createDisableToken(userId, type);
}

/********************************************
 * Scheduled Reset Methods
 ********************************************/

/**
 * Return the scheduled reset timestamp if one exists for the user.
 */
export async function getUserResetTime(userId: string): Promise<number | null> {
    const resetDoc = await getPendingReset(userId);
    if (!resetDoc) return null;

    return resetDoc.deleteAfter instanceof Date ? resetDoc.deleteAfter.getTime() : null;
}

/**
 * Remove any pending scheduled reset for the user.
 */
export async function clearUserReset(userId: string) {
    await purgeReset(userId);
}

/**
 * Schedule a user reset for a future time in hours.
 */
export async function scheduleUserReset(userId: string, delayHours: number) {
    const deleteAfter = new Date(Date.now() + delayHours * 60 * 60 * 1000);
    return await saveReset(userId, deleteAfter);
}
