import { Request, Response, NextFunction } from 'express';
import { ErrorCodes, ResponseHandler } from '../resources';
import { getDisableToken, deleteDisableToken } from '../services/tokenService';
import { getUser } from '../services/authStateService';
import { validatePhone, getUserIdHashed } from '../utils';

/**
 * Validate reset-account-now requests and ensure phoneNumber matches the hashed token user id.
 */
export const validatePostResetNow = async (req: Request, res: Response, next: NextFunction) => {
    const { cid, phoneNumber } = req.body;
    if (!cid || !phoneNumber) return ResponseHandler.error(req, res, ErrorCodes.missingRequiredData);

    if (!validatePhone(phoneNumber))
        return ResponseHandler.error(req, res, ErrorCodes.phoneNumberInvalid);

    const doc = await getDisableToken(cid);
    // validate the disableToken is of type 'reset'
    if (!doc || doc.type !== 'reset') return ResponseHandler.error(req, res, ErrorCodes.linkExpiredOrInvalid);

    if (!doc.userId) return ResponseHandler.error(req, res, ErrorCodes.tokenMissingUserId);

    if (doc.expiresAt && doc.expiresAt <= Date.now()) {
        void deleteDisableToken(cid);
        return ResponseHandler.error(req, res, ErrorCodes.linkExpiredOrInvalid);
    }

    // validate incoming phone number matches the one in the document
    if (doc.userId !== getUserIdHashed(phoneNumber))
        return ResponseHandler.error(req, res, ErrorCodes.phoneNumberMismatch);

    const user = await getUser(doc.userId);
    if (!user) return ResponseHandler.error(req, res, ErrorCodes.userNotFound);

    res.locals = { doc, cid, phoneNumber, user };

    next();
};

