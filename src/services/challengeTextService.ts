import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../resources';

// In-memory cache for texts
const textCache: string[] = [];

/**
 * Load challenge texts and cache them in memory
 * @returns Array of text strings
 */
export const loadTexts = async (): Promise<string[]> => {
    try {
        // Check if texts are already cached
        if (textCache && textCache.length > 0) {
            return textCache;
        }

        // Read the texts file
        const textsPath = path.join(__dirname, '..', 'texts.txt');
        const fileContent = fs.readFileSync(textsPath, 'utf8');

        // Split by lines and filter out empty lines, convert to lowercase
        const lines = fileContent
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
            .map((line) => line.toLowerCase());

        // Cache the texts
        textCache.push(...lines);

        logger.debug(`Challenge texts loaded: ${lines.length} texts`);
        return lines;
    } catch (error: any) {
        logger.debug({
            action: 'loadTexts',
            error: `Error loading challenge texts: ${error?.message}`,
        });
        return [];
    }
};

/**
 * Get a random text from the cached texts
 * @param language - Language code (default: 'en')
 * @returns Random text string or null if no texts available
 */
export const getRandomText = (): string | null => {
    const texts = textCache;

    if (!texts || texts.length === 0) {
        logger.warn({
            action: 'getRandomText',
            message: `No challenge texts available'`,
        });
        return null;
    }

    // Get a random text
    const randomIndex = Math.floor(Math.random() * texts.length);
    return texts[randomIndex] || null;
};

/**
 * Initialize texts for all supported languages
 * @returns Promise that resolves when all texts are loaded
 */
export const initializeChallengeTexts = async (): Promise<void> => {
    try {
        // Load English texts by default
        await loadTexts();

        logger.debug('Challenge texts initialization completed');
    } catch (error: any) {
        logger.debug({
            action: 'initializeChallengeTexts',
            error: `Failed to initialize challenge texts: ${error?.message}`,
        });
        throw error;
    }
};
