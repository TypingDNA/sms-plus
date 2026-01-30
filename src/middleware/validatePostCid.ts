import { Request, Response, NextFunction } from 'express';
import { ErrorCodes, ResponseHandler } from '../resources';
import { getToken, deleteToken } from '../services/tokenService';
import { validateMotionDataInPattern } from '../services/typingDnaService';
import { getUser } from '../services/authStateService';

/**
 * Validate OTP verification payload and hydrate locals with token, user, and typing pattern.
 */
export const validatePostCid = async (req: Request, res: Response, next: NextFunction) => {
    const { cid, tp, textId } = req.body;
    if (!cid || !tp) return ResponseHandler.error(req, res, ErrorCodes.missingRequiredData);

    const doc = await getToken(cid);
    if (!doc) return ResponseHandler.error(req, res, ErrorCodes.linkExpiredOrInvalid);

    if (!doc.userId) return ResponseHandler.error(req, res, ErrorCodes.tokenMissingUserId);

    if (doc.expiresAt && doc.expiresAt <= Date.now()) {
        void deleteToken(cid);
        return ResponseHandler.error(req, res, ErrorCodes.linkExpiredOrInvalid);
    }

    if (!validateMotionDataInPattern(tp))
        return ResponseHandler.error(req, res, ErrorCodes.motionDataInvalid);

    const user = await getUser(doc.userId);
    if (!user) return ResponseHandler.error(req, res, ErrorCodes.userNotFound);

    if (user.textId !== textId) return ResponseHandler.error(req, res, ErrorCodes.textIdMismatch);

    res.locals = { doc, cid, tp, user };

    next();
};
