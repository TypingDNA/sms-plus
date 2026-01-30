import { Reset } from '../models/Reset';

/**
 * Persist a scheduled reset marker for a user with the time it should execute.
 */
export const saveReset = async (userId: string, deleteAfter: Date) => {
    const data = {
        id: userId,
        userId,
        deleteAfter,
    };
    const reset = await Reset.insertOne(data);
    return reset;
};

/**
 * Look up any pending reset request for the given user.
 */
export const getPendingReset = async (userId: string) => {
    return await Reset.findOne({ id: userId });
};

/**
 * Remove a pending reset record when it has been processed or cancelled.
 */
export const purgeReset = async (userId: string) => {
    return await Reset.deleteOne({ id: userId });
};
