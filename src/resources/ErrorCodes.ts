export const ErrorCodes = {
    missingRequiredData: {
        code: 100,
        message: 'Missing required data',
        translationKey: 'missingRequiredData',
    },
    linkExpiredOrInvalid: {
        code: 101,
        title: 'Invalid or Expired Link',
        message: 'This link is no longer valid.',
        translationKey: 'linkExpiredOrInvalid',
    },
    tokenMissingUserId: {
        code: 102,
        message: 'Token missing userId',
        translationKey: 'tokenMissingUserId',
    },
    tooManyFailedAttemptsSessionLocked: {
        code: 104,
        title: 'Too many failed attempts',
        message: 'This challenge link has been locked due to too many failed verifications.',
        translationKey: 'tooManyFailedAttemptsSessionLocked',
    },
    tooManyFailedAttemptsUserLocked: (tryAgainMinutes: number) => {
        return {
            code: 105,
            title: 'Too many failed attempts',
            message: `Try again in ${tryAgainMinutes} minutes.`,
            translationKey: 'tooManyFailedAttemptsUserLocked',
        };
    },
    tokenNotFound: {
        code: 106,
        message: 'Token not found',
        translationKey: 'tokenNotFound',
    },
    userNotFound: {
        code: 107,
        message: 'User not found',
        translationKey: 'userNotFound',
    },
    incorrectPosition: {
        code: 108,
        message:
            'You are not typing in the recommended position. Please use both hands and refresh the page.',
        translationKey: 'incorrectPosition',
    },
    incorrectPositionTryAgain: {
        code: 109,
        message:
            'You are not typing in the recommended position. Please use both hands and try again.',
        translationKey: 'incorrectPositionTryAgain',
    },
    motionDataInvalid: {
        code: 110,
        message: 'Motion not detected.',
        translationKey: 'motionDataInvalid',
    },
    phoneNumberMismatch: {
        code: 111,
        message: 'Phone number does not match',
        translationKey: 'phoneNumberMismatch',
    },
    phoneNumberInvalid: {
        code: 112,
        message: 'Phone number is invalid. Please enter in international format.',
        translationKey: 'phoneNumberInvalid',
    },
    textIdMismatch: {
        code: 113,
        message: 'TextId not matching.',
        translationKey: 'textIdMismatch',
    },
};
