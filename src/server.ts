import dotenv from 'dotenv';
dotenv.config({ path: ['.env.local', '.env'] });

import { initAdapter, getAdapter } from './database/AdapterProvider';
initAdapter();

import { logger } from './resources';
import { app } from './app';
import { initializeChallengeTexts } from './services/challengeTextService';
const PORT = process.env.PORT || 8080;

getAdapter()
    .init()
    .then(async () => {
        logger.debug('Database adapter initialized');

        // Initialize texts
        await initializeChallengeTexts();

        app.listen(PORT, () => logger.debug(`Server running on port ${PORT}`));
    })
    .catch((err) => {
        logger.debug(`Database Adapter initialization failed: ${err?.message}`);
        process.exit(1);
    });

/**
 * Graceful shutdown and exit
 * @param options - cleanup: boolean - cleanup resources, flush log buffer
 * @param options - exit: boolean - exit the process
 */
const processHandler = async (options: { cleanup: boolean; exit: boolean }) => {
    if (options.cleanup) {
        await logger.setupGracefulShutdown();
    }
    if (options.exit) {
        process.exit(0);
    }
};

process.on('exit', processHandler.bind(null, { cleanup: true, exit: true }));

//user-initiated interruptions (catches ctrl+c command)
process.on('SIGINT', processHandler.bind(null, { cleanup: true, exit: true }));

//default signal for the kill command
process.on('SIGTERM', processHandler.bind(null, { cleanup: true, exit: true }));

//catches uncaught exceptions
process.on('uncaughtException', function (error) {
    logger.error({ action: 'uncaughtException', userId: 'system', error: error?.message });
});

process.stdin.resume();
