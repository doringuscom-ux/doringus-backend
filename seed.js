/* eslint-disable no-console */
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load Models
import Category from './models/Category.js';
import Influencer from './models/Influencer.js';
import User from './models/User.js';

dotenv.config();
const MONGODB_URI = process.env.MONGODB_URI;

// Path fix for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!MONGODB_URI) {
    console.error('Error: MONGODB_URI is not defined in .env');
    process.exit(1);
}

// Robust options for Windows/Atlas (Same as mongoAdapter.js)
const options = {
    serverSelectionTimeoutMS: 5000,
    family: 4 // Force IPv4 to fix Windows 10/11 DNS issues
};

mongoose.connect(MONGODB_URI, options)
    .then(() => {
        console.log('[Seed] Connected to MongoDB');
        seedData();
    })
    .catch(err => {
        console.error('[Seed] Connection Error:', err);
        process.exit(1);
    });

const readJson = (file) => {
    try {
        const filePath = path.join(__dirname, 'data', file);
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
    } catch (e) {
        console.error(`[Seed] Error reading ${file}:`, e.message);
    }
    return [];
};

const seedData = async () => {
    try {
        console.log('[Seed] Starting Data Seeding...');

        // 1. Categories
        const categoryCount = await Category.countDocuments();
        if (categoryCount === 0) {
            console.log('[Seed] Categories collection is empty. Seeding...');
            const categories = readJson('categories.json');

            // Fallback if file missing
            const finalCategories = categories.length > 0 ? categories : [
                { name: 'Tech', image: 'https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg' },
                { name: 'Fashion', image: 'https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg' },
                { name: 'Lifestyle', image: 'https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg' }
            ];

            const validCategories = finalCategories.map(c => ({
                ...c,
                name: c.label || c.name
            }));

            await Category.insertMany(validCategories);
            console.log(`[Seed] Successfully seeded ${validCategories.length} Categories.`);
        } else {
            console.log(`[Seed] Categories already exist (${categoryCount}). Skipping.`);
        }

        // 2. Influencers
        const influencerCount = await Influencer.countDocuments();
        if (influencerCount === 0) {
            console.log('[Seed] Influencers collection is empty. Seeding...');
            const influencers = readJson('influencers.json');

            if (influencers.length > 0) {
                await Influencer.insertMany(influencers);
                console.log(`[Seed] Successfully seeded ${influencers.length} Influencers.`);
            } else {
                console.log('[Seed] Warning: influencers.json is empty or missing. No influencers seeded.');
            }
        } else {
            console.log(`[Seed] Influencers already exist (${influencerCount}). Skipping.`);
        }

        // 3. User (SuperAdmin)
        const adminRegex = /AddaLegend_9/i;
        const adminExists = await User.findOne({ username: adminRegex });

        if (!adminExists) {
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash('S0c!al@ddA#97', salt);

            await User.create({
                username: 'AddaLegend_9',
                password: hash,
                role: 'superadmin',
                email: 'admin@doringus.com'
            });
            console.log('[Seed] Created SuperAdmin: AddaLegend_9');
        } else {
            console.log('[Seed] SuperAdmin already exists. Skipping.');
        }

        console.log('[Seed] Database population complete.');
        process.exit(0);

    } catch (e) {
        console.error('[Seed] Critical Error:', e);
        process.exit(1);
    }
};
