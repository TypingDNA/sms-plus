import { Request, Response } from 'express';
import {
    getUser,
    getUserResetTime,
    resetUserAndAllocateNewText,
    clearUserReset,
    isGlobalLockout,
    incrementGlobalFailedAttempt,
    consumeCidToken,
    incrementCidFailedAttempts,
    getCidToken,
    saveDisableToken,
    updateUser,
} from '../services/authStateService';
import { incrementInvalidTpAttempts } from '../services/userService';
import { typingdna, ITDNAErrorCode } from '../apis/typingdna';
import { validateTypingPosture, deleteMobileProfile } from '../services/typingDnaService';
import { logger, ErrorCodes, ResponseHandler, createTextToTypeCanvas } from '../resources';
import { validateTokenId } from '../utils/helpers';
import { getTranslationDictionary, getTranslationByKey } from '../services/translationService';
import { config } from '../config/config';

interface IVerifyResponse {
    result: number;
    action: string;
    otp?: string | null;
    disableTid?: string;
    resetNowTid?: string;
}

const {
    lockout: { perChallengeMaxFailedAttempts },
    maxInvalidTpAttempts,
} = config;

/**
 * Render the challenge page after validating the request token and user state.
 */
export const renderChallengePage = async (req: Request, res: Response) => {
    try {
        const { cid } = req.params;

        if (!validateTokenId(cid)) throw ErrorCodes.linkExpiredOrInvalid;

        const token = await getCidToken(cid);
        if (!token || !token.expiresAt || token.expiresAt < Date.now()) throw ErrorCodes.linkExpiredOrInvalid;

        const userId = token.userId;

        // get user
        let user = await getUser(userId);
        if (!user) throw ErrorCodes.userNotFound;

        /**
         * check if user is scheduled for reset
         * if yes, reallocate new sentence, enroll: true
         */
        const newUser = await checkUserScheduledForReset(user);

        // update user if new text is allocated
        if (newUser) user = newUser;

        /**
         * check user lockout & per-challenge lockout, remove user lockout if expired
         * perform AFTER user scheduled reset check
         */
        await validateUserLockout(user, token);

        const canvas = createTextToTypeCanvas(user.textToType);

        const translation = getTranslationDictionary();

        ResponseHandler.renderTemplate(res, 'sms_verify', {
            translation,
            cid,
            enroll: user.enroll,
            tdna_text: user.textToType,
            tdna_text_id: user.textId,
            tdna_text_canvas: canvas,
        });
    } catch (error: any) {
        return ResponseHandler.renderTemplate(res, 'error', {
            title: error?.title || 'Error',
            message: error?.message || getTranslationByKey('helpError'),
        });
    }
};

/**
 * Verify or enroll a typing pattern, handle lockouts, and return the OTP or disable token.
 */
export const verifyHandler = async (req: Request, res: Response) => {
    const { user, doc, cid, tp } = res.locals;

    const { userId } = user;

    // Posture check - Ensures the typing happened with both thumbs (position==3).
    const { error: errorPosture, isValid, tryAgain } = await validateTypingPosture(userId, tp);
    if (!isValid) {
        // if user typed in incorrect position, ask again for new typing pattern
        if(tryAgain && (user.invalidTpAttempts ?? 0) < maxInvalidTpAttempts) {
            // increment invalid typing pattern attempts
            await incrementInvalidTpAttempts(userId);

            const errorMsg = { ...ErrorCodes.incorrectPositionTryAgain };
            return ResponseHandler.error(req, res, {
                code: errorMsg.code,
                message: getTranslationByKey(errorMsg.translationKey),
            }, 400);
        }

        // else reset user invalid typing pattern attempts before displaying error
        if(user.invalidTpAttempts && user.invalidTpAttempts >= maxInvalidTpAttempts) {
            await updateUser(userId, { invalidTpAttempts: 0 });
        }

        const errorMsg = { ...ErrorCodes.incorrectPosition };
        return ResponseHandler.error(
            req,
            res,
            {
                code: errorMsg.code,
                message: errorPosture || getTranslationByKey(errorMsg.translationKey),
            },
            400
        );
    }

    /**
     * send typing pattern to TypingDNA for verify/enroll
     * - autoenroll should be enabled on the /verify route
     */
    const tdnaRes = await typingdna.verifyTypingPattern(userId, tp);

    /**
     * check if autoenroll has not been enabled in TypingDNA
     * e.g. of response: { message: 'No previous valid typing patterns found', message_code: 4, success: 0,status: 200 }
     */
    if (tdnaRes.result === undefined && tdnaRes.success === 0) {
        const errorData = tdnaRes as unknown as ITDNAErrorCode;
        return ResponseHandler.error(req, res, errorData, 400);
    }

    const response: IVerifyResponse = {
        result: tdnaRes.result,
        action: tdnaRes.action,
    };

    if (tdnaRes.result === 1 || tdnaRes.action === 'enroll') {
        /**
         * SUCCESS
         * either on Verify with success or on Enroll new typing pattern
         * - consume token
         * - delete auth state (global lockout)
         * - create disable token (10 minutes TTL if user chooses to disable secure codes)
         *      & return disableTid to frontend
         */
        await consumeCidToken(cid);

        // reset global failed state, set enroll flag
        const update = {
            attempts: 0,
            lockoutUntil: 0,
            invalidTpAttempts: 0,
            updatedAt: new Date(),
            ...(tdnaRes.action === 'enroll' ? { enroll: false } : {}),
        };

        await updateUser(userId, update);

        response.otp = doc.token;
        response.disableTid = await saveDisableToken(userId);

        const resetTime = await getUserResetTime(userId); // timestamp or null
        if(resetTime && resetTime >= Date.now()) {
            response.resetNowTid = await saveDisableToken(userId, 'reset');
        }
    } else {
        /**
         * FAILURE
         * increment user failed attempts & per-challenge failed attempts
         * check if user is locked out due to too many failures
         */
        const { lockout, tryAgainMinutes } = await incrementGlobalFailedAttempt(userId);
        const newCidFailures = await incrementCidFailedAttempts(cid, userId);

        if (lockout) return ResponseHandler.locked(req, res, tryAgainMinutes);
        if (newCidFailures >= perChallengeMaxFailedAttempts)
            return ResponseHandler.locked(req, res);
    }

    return ResponseHandler.success(req, res, response);
};

/**
 * Check if user has a scheduled reset
 * Run scheduled reset logic BEFORE any lockout check
 */
const checkUserScheduledForReset = async (user: any) => {
    const { userId, textId } = user;
    const resetTime = await getUserResetTime(userId);

    let newUser: any;

    if (resetTime && resetTime <= Date.now()) {
        try {
            await deleteMobileProfile(userId, textId);

            newUser = await resetUserAndAllocateNewText(userId);

            await clearUserReset(userId);

            logger.info({ action: 'scheduledUserReset', userId, message: 'done' });
        } catch (e: any) {
            logger.error({ action: 'scheduledUserReset', userId, error: e?.message });
            throw e;
        }
    }

    return newUser;
};

/**
 * Validate both global and per-challenge lockout thresholds for the current request.
 */
const validateUserLockout = async (user: any, token: any) => {
    // Global lockout per user
    const { locked, tryAgainMinutes } = await isGlobalLockout(user);
    if (locked) throw ErrorCodes.tooManyFailedAttemptsUserLocked(tryAgainMinutes);

    // Per-challenge lockout
    const cidFailures = token?.failedAttempts || 0;
    if (cidFailures >= perChallengeMaxFailedAttempts)
        throw ErrorCodes.tooManyFailedAttemptsSessionLocked;
};
