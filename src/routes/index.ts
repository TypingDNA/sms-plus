import express from 'express';
import { verifyHandler, renderChallengePage } from '../controllers/verifyController';
import { resetHandler, resetNowHandler } from '../controllers/resetController';
import { disableSecureCodesHandler } from '../controllers/disableController';
import {
    validatePostCid,
    validatePostReset,
    validatePostResetNow,
    validatePostDisable,
    errorInterceptor,
} from '../middleware';

const router = express.Router();

/********************************************
 * 1) Public challenge page  —  GET /{cid}
 ********************************************/
router.get('/:cid', renderChallengePage);

/********************************************
 * 2) Verify OTP (AJAX)   —  POST /verify-otp
 ********************************************/
router.post('/verify-otp', errorInterceptor(validatePostCid), errorInterceptor(verifyHandler));

/********************************************
 * 3) Reset flow (AJAX)  —  POST /reset-account
 *
 * Display reset link on locked status
 * (too many failed attempts)
 ********************************************/
router.post('/reset-account', errorInterceptor(validatePostReset), errorInterceptor(resetHandler));

/********************************************
 * 3.5) Reset account now (AJAX)  —  POST /reset-account-now
 *
 * Immediately resets the account when user has a scheduled reset and is verified with typing pattern
 * Deletes mobile profile, resets user, clears reset time
 ********************************************/
router.post('/reset-account-now', errorInterceptor(validatePostResetNow), errorInterceptor(resetNowHandler));

/********************************************
 * 4) Disable account verification (AJAX)  —  POST /disable-account
 *
 * Immediate, irreversible profile wipe (user clicked 'Turn Off Codes')
 * Requires `disableTid` (10-minute one-time token) generated earlier
 ********************************************/
router.post(
    '/disable-account',
    errorInterceptor(validatePostDisable),
    errorInterceptor(disableSecureCodesHandler)
);

export default router;
