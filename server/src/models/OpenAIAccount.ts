import mongoose, { Schema } from 'mongoose';
import { IOpenAIAccount } from '../types';

const OpenAIAccountSchema = new Schema<IOpenAIAccount>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
        apiKey: { type: String, required: true }, // Encrypted with AES-256
    },
    { timestamps: true }
);

export default mongoose.model<IOpenAIAccount>('OpenAIAccount', OpenAIAccountSchema);
