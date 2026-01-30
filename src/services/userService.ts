import { User } from '../models/User';
import { getTextId, getDefaultText } from './typingDnaService';
import { getRandomText } from './challengeTextService';
import { logger } from '../resources';

/**
 * Create a user record with a fresh TypingDNA sentence assigned.
 */
export const createUser = async (
    userId: string // user id hashed
) => {
    // get new text, calculate textId
    const now = new Date();
    const textToType = getRandomText() || getDefaultText();
    const textId = getTextId(textToType);

    const user = {
        id: userId,
        userId,
        textId,
        textToType,
        enroll: true,
        createdAt: now,
        updatedAt: now,
    };

    const userDb = await User.insertOne(user);
    return userDb;
};

/**
 * Load a user document by id.
 */
export const getUser = async (userId: string) => {
    return await User.findOne({ id: userId });
};

/**
 * Update fields on a user document.
 */
export const updateUser = async (userId: string, update: any) => {
    return await User.findOneAndUpdate({ id: userId }, update);
};

/**
 * Delete the user record and profile state.
 */
export const deleteUser = async (userId: string) => {
    return await User.deleteOne({ id: userId });
};

/**
 * User counters
 */
/**
 * Increment the global failed-auth counter and return the new value.
 */
export const incrementFailedAuth = async (userId: string): Promise<number> => {
    try {
        const doc = await User.findOneAndIncrement({ id: userId }, { attempts: 1 });

        return doc?.attempts ?? 0;
    } catch (error: any) {
        logger.error({ action: 'incrementFailedAuth', userId, error: error?.message });
        return 0;
    }
};

/**
 * Increment the invalid typing pattern attempts counter for the user.
 */
export const incrementInvalidTpAttempts = async (userId: string): Promise<number> => {
    try {
        const doc = await User.findOneAndIncrement({ id: userId }, { invalidTpAttempts: 1 });

        return doc?.invalidTpAttempts ?? 0;
    } catch (error: any) {
        logger.error({ action: 'incrementInvalidTpAttempts', userId, error: error?.message });
        return 0;
    }
};
