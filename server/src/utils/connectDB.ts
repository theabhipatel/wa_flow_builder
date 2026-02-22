import mongoose from 'mongoose';

/**
 * Serverless-friendly MongoDB connection.
 * Connects on first request and reuses the connection across warm invocations.
 * In regular server mode (server.ts), mongoose is already connected before
 * app.listen(), so this function is essentially a no-op (readyState is already 1).
 */
export async function connectDB(): Promise<void> {
    if (mongoose.connection.readyState === 1) return;

    const uri = process.env.MONGODB_URI;
    if (!uri) {
        throw new Error('MONGODB_URI environment variable is not set');
    }

    await mongoose.connect(uri);
}
