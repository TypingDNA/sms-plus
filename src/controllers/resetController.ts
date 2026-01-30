import { Request, Response } from 'express';
import { mobileProfileCount, deleteMobileProfile } from '../services/typingDnaService';
import { ResponseHandler, logger } from '../resources';
import { scheduleUserReset, resetUserAndAllocateNewText, clearUserReset } from '../services/authStateService';
import { deleteDisableToken } from '../services/tokenService';

/**
 * Trigger a delayed account reset depending on how many patterns the user enrolled.
 */
export const resetHandler = async (req: Request, res: Response) => {
    const { doc, cid, phone, user } = res.locals;

    /**
     * Check if user has a typing profile
     * Schedule a reset for 1 hour (if recently enrolled)
     * or 24 hours (if not recently enrolled)
     */
    const { userId } = user;
    const { tpCount = 0 } = await mobileProfileCount(userId, user.textId);
    const delayHours = tpCount < 7 ? 1 : 24;
    await scheduleUserReset(userId, delayHours);

    const translationKey = tpCount < 7 ? 'resetAccountMessageFewTPs' : 'resetAccountMessageManyTPs';
    return ResponseHandler.success(req, res, { translationKey });
};

/**
 * Immediately reset the user account: delete mobile profile, reset user, clear reset time, and return OTP.
 */
export const resetNowHandler = async (req: Request, res: Response) => {
    const { cid, user } = res.locals;

    const { userId, textId } = user;

    // Delete mobile profile
    await deleteMobileProfile(userId, textId);

    // Reset user and allocate new text
    await resetUserAndAllocateNewText(userId);

    // Clear the scheduled reset
    await clearUserReset(userId);

    // Delete the disable token
    await deleteDisableToken(cid);

    // Return the OTP from the token document
    return ResponseHandler.success(req, res, {
        translationKey: 'resetAccountNowSuccess',
    });
};
