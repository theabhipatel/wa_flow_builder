import cron from 'node-cron';
import { Session, FlowVersion } from '../models';
import * as executionService from './executionService';

/**
 * Start the delay node cron job
 * Checks every 10 seconds for sessions with resumeAt <= NOW
 */
export const startDelayCron = (): void => {
    cron.schedule('*/10 * * * * *', async () => {
        try {
            const now = new Date();
            const sessions = await Session.find({
                status: 'PAUSED',
                resumeAt: { $lte: now },
            });

            for (const session of sessions) {
                try {
                    // Clear resumeAt and set status to ACTIVE
                    session.status = 'ACTIVE';
                    session.resumeAt = undefined;
                    await session.save();

                    // Check if this is a simulator (test) session
                    const isSimulator = session.isTest === true;

                    // Resume execution with the correct isSimulator flag
                    // Note: executeMessageNode/executeButtonNode already store messages in DB,
                    // so the frontend can poll for them via the /simulator/poll endpoint.
                    await executionService.executeFlow(session, undefined, undefined, isSimulator);
                } catch (error) {
                    console.error(`[DelayCron] Error resuming session ${session._id}:`, error);
                }
            }
        } catch (error) {
            console.error('[DelayCron] Error in delay cron job:', error);
        }
    });

    console.log('[DelayCron] Delay node cron job started (every 10s)');
};

