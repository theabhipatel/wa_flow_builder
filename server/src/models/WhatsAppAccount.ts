import mongoose, { Schema } from 'mongoose';
import { IWhatsAppAccount } from '../types';

const WhatsAppAccountSchema = new Schema<IWhatsAppAccount>(
    {
        botId: { type: Schema.Types.ObjectId, ref: 'Bot', required: true, unique: true },
        phoneNumberId: { type: String, required: true, unique: true },
        accessToken: { type: String, required: true }, // Encrypted with AES-256
        phoneNumber: { type: String, required: true, unique: true },
        verifyToken: { type: String, required: true },
    },
    { timestamps: true }
);

export default mongoose.model<IWhatsAppAccount>('WhatsAppAccount', WhatsAppAccountSchema);
