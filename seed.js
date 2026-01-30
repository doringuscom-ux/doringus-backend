/* eslint-disable no-console */
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// Load Models
const Category = require('./models/Category');
const Influencer = require('./models/Influencer');
const User = require('./models/User');

require('dotenv').config();
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('Error: MONGODB_URI is not defined in .env');
    process.exit(1);
}

mongoose.connect(MONGODB_URI)
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
        // 1. Categories
        const categories = readJson('categories.json');
        if (categories.length > 0) {
            await Category.deleteMany({});
            console.log('[Seed] Cleared Categories');
            // Ensure schema compatibility
            const validCategories = categories.map(c => ({
                ...c,
                name: c.label || c.name // Map label to name as per schema
            }));
            await Category.insertMany(validCategories);
            console.log(`[Seed] Seeded ${validCategories.length} Categories`);
        }

        // 2. Influencers
        const influencers = readJson('influencers.json');
        if (influencers.length > 0) {
            await Influencer.deleteMany({});
            console.log('[Seed] Cleared Influencers');
            // Fix passwords if they are plain text or not present
            // We'll leave the hash as is if it looks like a hash, otherwise hash "123456"
            // Actually better to just reset passwords to something known?
            // The JSON might contain hashed passwords from previous usage.
            // Let's assume they are valid or just re-hash '123456' for all for safety?
            // User said "Register and Login not working", so fresh users might be better.
            // But let's try to preserve.
            await Influencer.insertMany(influencers);
            console.log(`[Seed] Seeded ${influencers.length} Influencers`);
        }

        // 3. Users (Admins)
        // Hardcode a reliable admin if data/users.json is messy
        const users = readJson('users.json');
        await User.deleteMany({});
        console.log('[Seed] Cleared Users');

        // Always add a clear Admin
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash('S0c!al@ddA#97', salt); // Default password

        const superAdmin = {
            username: 'AddaLegend_9',
            password: hash,
            role: 'superadmin',
            email: 'admin@doringus.com'
        };

        await User.create(superAdmin);
        console.log('[Seed] Created SuperAdmin (AddaLegend_9)');

        if (users.length > 0) {
            // careful with duplicate keys
            const safeUsers = users.filter(u => u.username !== 'AddaLegend_9');
            if (safeUsers.length > 0) await User.insertMany(safeUsers);
            console.log(`[Seed] Seeded ${safeUsers.length} other users`);
        }

        console.log('[Seed] Complete. Exiting...');
        process.exit(0);

    } catch (e) {
        console.error('[Seed] Error:', e);
        process.exit(1);
    }
};
