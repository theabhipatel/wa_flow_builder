import mongoose, { Schema } from 'mongoose';
import { IUser } from '../types';

const UserSchema = new Schema<IUser>(
    {
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        passwordHash: { type: String, required: true },
        role: { type: String, enum: ['ADMIN', 'USER'], default: 'USER' },
    },
    { timestamps: true }
);

export default mongoose.model<IUser>('User', UserSchema);
