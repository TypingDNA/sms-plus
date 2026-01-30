import fs from 'fs';
import path from 'path';
import { IAMBridge } from './interface';
import { logger } from '../resources';

/**
 * Bridge Registry - Dynamic Bridge Loader
 *
 * This module automatically discovers and loads IAM bridge implementations
 * from the bridges directory. It scans for files ending with '.bridge.ts' or '.bridge.js'
 * and dynamically imports them to create a registry of available bridges.
 *
 * Bridge Module Requirements:
 * - File must end with '.bridge.ts' or '.bridge.js'
 * - Must export a class or an object implementing the IAMBridge interface
 * - Bridge object must have: id, name, version, enabled properties
 * - Bridge must implement: isAuthorized(), getPhoneNumber(), getOtpMessage() methods
 *
 * Example Bridge Structure:
 * ```typescript
 * export const MyBridge: IAMBridge = {
 *     id: 'mybridge',
 *     name: 'My IAM Bridge',
 *     version: '1.0.0',
 *     enabled: true,
 *
 *     isAuthorized(req) { // auth logic },
 *     getPhoneNumber(req) { // extract phone },
 *     getOtpMessage(req) { // extract message }
 * };
 * ```
 *
 * Error Handling:
 * - Invalid bridges (missing required properties) are skipped
 * - Disabled bridges (enabled: false) are excluded from activeBridges
 *
 * Usage:
 * - The activeBridges are used by the hooks router to create dynamic endpoints
 * - Each bridge gets its own POST endpoint: /hooks/{bridge.id}
 */

const bridgesDir = path.resolve(__dirname);
const bridgeFiles = fs
    .readdirSync(__dirname)
    .filter((file) => file.endsWith('.bridge.ts') || file.endsWith('.bridge.js'));

const loadedBridges: IAMBridge[] = [];

for (const file of bridgeFiles) {
    const modulePath = path.join(bridgesDir, file);
    try {
        const mod = require(modulePath);
        const bridge: IAMBridge = mod.default || Object.values(mod)[0];

        if (bridge && bridge.id && bridge.enabled !== false) {
            // @toDo check for duplicated bridge ids.
            loadedBridges.push(bridge);
        }
    } catch (error: any) {
        logger.error({
            action: 'loadBridge',
            userId: 'system',
            message: `Failed to load bridge from ${file}:`,
            error: error?.message,
        });
    }
}

export const activeBridges: IAMBridge[] = loadedBridges;
