import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from './models';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/whatsapp_flow_builder';

const seedUsers = async (): Promise<void> => {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB for seeding');

        const defaultUsers = [
            { firstName: 'Admin', lastName: 'User', email: 'admin@gmail.com', password: '123456', role: 'ADMIN' as const },
            { firstName: 'Abhi', lastName: 'Patel', email: 'abhi@gmail.com', password: '123456', role: 'USER' as const },
        ];

        for (const userData of defaultUsers) {
            const existing = await User.findOne({ email: userData.email });
            if (existing) {
                console.log(`⏭️  User ${userData.email} already exists — skipping`);
                continue;
            }

            const passwordHash = await bcrypt.hash(userData.password, 10);
            await User.create({
                firstName: userData.firstName,
                lastName: userData.lastName,
                email: userData.email,
                passwordHash,
                role: userData.role,
            });

            console.log(`✅ Created ${userData.role} user: ${userData.email}`);
        }

        console.log('\n🎉 Seeding complete!');
        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding failed:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
};

seedUsers();
