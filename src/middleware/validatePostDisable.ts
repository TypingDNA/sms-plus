import { Request, Response, NextFunction } from 'express';
import { ErrorCodes, ResponseHandler } from '../resources';
import { getDisableToken, deleteDisableToken } from '../services/tokenService';
import { validatePhone, getUserIdHashed } from '../utils';
import { getUser } from '../services/authStateService';

/**
 * Validate the disable-account payload and hydrate locals with user and token data.
 */
export const validatePostDisable = async (req: Request, res: Response, next: NextFunction) => {
    const { phone, disableTid } = req.body;
    if (!phone || !disableTid)
        return ResponseHandler.error(req, res, ErrorCodes.missingRequiredData);

    if (!validatePhone(phone))
        return ResponseHandler.error(req, res, ErrorCodes.phoneNumberInvalid);

    const doc = await getDisableToken(disableTid);

    if (!doc) return ResponseHandler.error(req, res, ErrorCodes.linkExpiredOrInvalid);

    if (doc.expiresAt && doc.expiresAt <= Date.now()) {
        void deleteDisableToken(disableTid);
        return ResponseHandler.error(req, res, ErrorCodes.linkExpiredOrInvalid);
    }

    // validate incoming phone number matches the one in the document
    if (doc.userId !== getUserIdHashed(phone)) {
        return ResponseHandler.error(req, res, ErrorCodes.phoneNumberMismatch);
    }

    const user = await getUser(doc.userId);
    if (!user) return ResponseHandler.error(req, res, ErrorCodes.userNotFound);

    res.locals = { doc, phone, user };

    next();
};
