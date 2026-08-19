import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';
export const prisma = new PrismaClient({ log: [{ emit: 'event', level: 'error' }] });
prisma.$on('error', e => logger.error({ message: e.message }, 'Database error'));
export async function withDbRetry(fn, attempts = 5) { let last; for (let i = 0; i < attempts; i++) {
    try {
        return await fn();
    }
    catch (e) {
        last = e;
        logger.warn({ attempt: i + 1, error: e instanceof Error ? e.message : 'unknown' }, 'Transient database operation failure');
        if (i + 1 < attempts)
            await new Promise(r => setTimeout(r, 500 * 2 ** i));
    }
} throw last; }
//# sourceMappingURL=prisma.js.map