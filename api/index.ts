/**
 * Vercel serverless function entry point.
 * Wraps the Express app and ensures MongoDB is connected before handling requests.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDB } from '../server/src/utils/connectDB';
import app from '../server/src/app';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    await connectDB();
    return app(req, res);
}
