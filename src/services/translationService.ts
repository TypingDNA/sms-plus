import defaultTranslation from '../resources/translations/en';
import { logger } from '../resources';
import { config } from '../config/config';

// Cache for loaded translations
const translationCache = new Map<string, any>();
const language = config.defaultLanguage;

/**
 * Get the entire translation dictionary for a given language
 * @param language - Language code (default: 'en')
 * @returns Translation dictionary object
 */
export const getTranslationDictionary = () => {
    try {
        // Check cache first
        if (!translationCache.has(language)) {
            const translation = require(`../resources/translations/${language}`);
            translationCache.set(language, translation.default);
        }

        return translationCache.get(language);
    } catch (error: any) {
        logger.error({
            action: 'getTranslationDictionary',
            error: `Error loading language: ${language} - ${error?.message}`,
        });

        // default to EN if invalid language
        return defaultTranslation;
    }
};

/**
 * Get a specific translation by key for a given language
 * @param language - Language code (default: 'en')
 * @param key - Translation key
 * @returns Translated string or key as fallback
 */
export const getTranslationByKey = (key: string): string => {
    if (!key) return '';

    try {
        const translation = getTranslationDictionary();

        // Return the key if found in requested language
        // or the key itself as fallback
        return translation[key] || key;
    } catch (error: any) {
        logger.error({
            action: 'getTranslationByKey',
            error: `Error loading key ${key} for language: ${language} - ${error?.message}`,
        });

        return key;
    }
};
