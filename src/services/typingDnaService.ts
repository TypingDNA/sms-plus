import { typingdna, ITDNAErrorCode } from '../apis/typingdna';
import { logger } from '../resources';
import { config } from '../config/config';

/**
 * Check if a user already has a typing profile.
 * This affects whether we send them into an 'enroll' or 'verify' flow.
 * 
 * Handling ERRORS:
 * - on network errors, timeout or misconfiguration of TypingDNA API, return { isServerError: true }
 * - on other errors, return { tpCount: 0 } to fallback to no typing patterns
 */
export const mobileProfileCount = async (userId: string, textId: string): Promise<{ isServerError?: boolean, tpCount?: number }> => {
    try {
        const data = await typingdna.checkUser(userId, textId);

        return { tpCount: data.mobilecount ?? 0 };
    } catch (err: any) {
        logger.error({ 
            action: 'mobileProfileCount',
            userId,
            message: 'TypingDNA profile check failed',
            error: `${err && err?.message}${err.response?.data?.message ? `. ${err.response?.data?.message}` : ''}`,
        });

        // handle missing TypingDNA API configuration
        if(err.message === 'TypingDNA API is not instantiated') {
            return { isServerError: true };
        }

        if(err.isAxiosError) {
            // handle network & timeout errors
            if(['ECONNABORTED', 'ENOTFOUND'].includes(err.code)) {
                return { isServerError: true };
            }

            /**
             * handle incorrect apiKey or apiSecret. Other possible errors:
             * https://api.typingdna.com/#api-API_Services-Standard-GetUser
             */
            const { status } = err.response?.data || {};
            if(status && [401, 403].includes(status)) {
                return { isServerError: true };
            }

        }
        return { tpCount: 0 }; // fallback to no typing patterns
    }
};

/**
 * Delete a TypingDNA mobile profile for the given user/text combo.
 */
export const deleteMobileProfile = async (userId: string, textId: string): Promise<void> => {
    await typingdna.deleteUser(userId, textId);
};

/**
 * Posture verification
 * Ensures the typing happened with both thumbs (position==3)
 */
export const validateTypingPosture = async (userId: string, tp: string) => {
    try {
        const posRes = await typingdna.getPosture(userId, tp);
        const positions = posRes?.positions || [];

        if (!positions.length || positions.length > 1 || positions[0] !== 3) {
            logger.info({
                action: 'validateTypingPosture',
                userId,
                message: `Incorrect position(s) detected: ${JSON.stringify(positions)}`,
            });

            // ask again for new typing pattern
            return { isValid: false, tryAgain: true };
        }
    } catch (err: any) {
        // Handle incoming errors from TypingDNA API
        let error = '';
        if (err.isAxiosError) {
            const data = err.response?.data as ITDNAErrorCode;
            error = data.message;
        }
        return { isValid: false, error };
    }

    return { isValid: true };
};

/**
 * Default TypingDNA method to get the text id for a given string
 */
export const getTextId = (str: string) => {
    if (str === undefined || typeof str !== 'string') {
        return 0;
    }
    str = str.toLowerCase();
    let i;
    let l;
    let hval = 0x721b5ad4;
    for (i = 0, l = str.length; i < l; i++) {
        hval ^= str.charCodeAt(i);
        hval += (hval << 1) + (hval << 4) + (hval << 7) + (hval << 8) + (hval << 24);
    }
    return hval >>> 0;
};

export const getDefaultText = () => {
    return config.typingDNA.defaultText;
};

/**
 * Basic validation of the motion data in the pattern before sending to TypingDNA API
 */
export const validateMotionDataInPattern = (tp: string) => {
    if (!tp) return false;

    try {
        const tpParts = tp.split('#');
        if (tpParts.length < 2) return false;
        if (!tpParts[1] || !tpParts[2]) return false;

        return true;
    } catch (err) {
        return false;
    }
};
