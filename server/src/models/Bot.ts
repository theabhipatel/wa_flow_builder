import mongoose, { Schema } from 'mongoose';
import { IBot } from '../types';

const BotSchema = new Schema<IBot>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        name: { type: String, required: true, trim: true },
        description: { type: String, trim: true },
        activeFlowId: { type: Schema.Types.ObjectId, ref: 'Flow' },
        defaultFallbackMessage: { type: String, trim: true },
    },
    { timestamps: true }
);

BotSchema.index({ userId: 1 });

export default mongoose.model<IBot>('Bot', BotSchema);
