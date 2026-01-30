import dotenv from 'dotenv';
dotenv.config({ path: ['.env.local', '.env'] });

export const config = {
    baseUrl: process.env.BASE_URL,
    storeType: process.env.DATA_STORE || 'mongo',
    mongo: {
        uri: process.env.MONGO_URI!,
        dbName: process.env.MONGO_DB_NAME!,
    },
    mongoUri: process.env.MONGO_URI!,
    mongoDbName: process.env.MONGO_DB_NAME!,
    firebaseConfig: {
        credential: process.env.FIREBASE_CREDENTIAL!,
        projectId: process.env.FIREBASE_PROJECT_ID!,
        databaseId: process.env.FIREBASE_DATABASE_ID!,
    },
    redis: {
        host: process.env.REDIS_HOST!,
        port: Number(process.env.REDIS_PORT!),
        password: process.env.REDIS_PASSWORD!,
        db: Number(process.env.REDIS_DB!),
    },
    typingDNA: {
        server: process.env.TYPINGDNA_SERVER || 'https://api.typingdna.com',
        apiKey: process.env.TYPINGDNA_API_KEY!,
        apiSecret: process.env.TYPINGDNA_API_SECRET!,
        defaultText: process.env.TYPINGDNA_TEXT_DEFAULT || 'secured by typingdna',
        timeoutMs: process.env.TYPINGDNA_TIMEOUT_MS ? parseInt(process.env.TYPINGDNA_TIMEOUT_MS) : 20000,
    },
    smsProvider: process.env.SMS_PROVIDER || 'twilio',
    smsProviders: {
        twilio: {
            accountSid: process.env.TWILIO_ACCOUNT_SID!,
            apiKey: process.env.TWILIO_API_KEY!,
            apiSecret: process.env.TWILIO_API_SECRET!,
            fromNumber: process.env.TWILIO_FROM_NUMBER!,
        },
    },
    activeBridges: process.env.ENABLED_BRIDGES!,
    bridges: {
        okta: {
            sharedSecret: process.env.OKTA_SHARED_SECRET!,
        },
        cyberark: {
            sharedSecret: process.env.CYBERARK_SHARED_SECRET!,
        },
    },
    ttl: {
        // TTL in minutes
        token: 15,
        disableToken: 10,
        logs: 30 * 24 * 60, // 30 days
    },
    lockout: {
        globalMaxFailedAttempts: process.env.MAX_FAILED_ATTEMPTS
            ? parseInt(process.env.MAX_FAILED_ATTEMPTS)
            : 5,
        globalLockoutDuration: process.env.LOCKOUT_DURATION_MINUTES
            ? parseInt(process.env.LOCKOUT_DURATION_MINUTES)
            : 15,
        perChallengeMaxFailedAttempts: process.env.PER_CHALLENGE_MAX_FAILED_ATTEMPTS
            ? parseInt(process.env.PER_CHALLENGE_MAX_FAILED_ATTEMPTS)
            : 3,
    },
    maxInvalidTpAttempts: 1, // if typing pattern is not in the right position, ask again for new typing pattern
    defaultLanguage: process.env.DEFAULT_LANGUAGE || 'en',
    hashSalt: process.env.HASH_SALT || '',
    logging: {
        // whether requests should be logged
        logRequests: process.env.LOG_REQUESTS ? Boolean(process.env.LOG_REQUESTS) : true,
        logLevel: process.env.LOG_LEVEL || 'debug',
    },
};
