import { Request, Response } from 'express';
import { ResponseHandler } from '../resources';
import { deleteMobileProfile } from '../services/typingDnaService';
import { deleteUser } from '../services/authStateService';
import { deleteDisableToken } from '../services/tokenService';

/**
 * Handle the disable link flow: wipe TypingDNA profile, auth state, and the disable token.
 */
export const disableSecureCodesHandler = async (req: Request, res: Response) => {
    const { doc, user } = res.locals;

    /**
     * purge typing profile & clear user's auth state
     */
    const { userId } = user;
    await deleteMobileProfile(userId, user.textId);
    await deleteUser(userId);
    await deleteDisableToken(doc.disableTid);

    return ResponseHandler.success(req, res, {
        translationKey: 'secureCodesDisabled',
    });
};
