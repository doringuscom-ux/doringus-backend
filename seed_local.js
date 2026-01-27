/* eslint-disable no-console */
const db = require('./db');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const readJson = (file) => {
    try {
        const p = path.join(__dirname, 'data', file);
        if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (e) { }
    return [];
};

const seed = async () => {
    console.log('[Seed] Auto-seeding database...');

    // Admin
    const admin = await db.users.findOne({ username: 'AddaLegend_9' });
    if (!admin) {
        const hash = await bcrypt.hash('S0c!al@ddA#97', 10);
        await db.users.create({
            username: 'AddaLegend_9',
            password: hash,
            role: 'superadmin',
            email: 'admin@doringus.com'
        });
        console.log('[Seed] Admin created.');
    }

    // Categories
    const existingCats = await db.categories.find({});
    if (existingCats.length === 0) {
        const jsonCats = readJson('categories.json');
        for (const c of jsonCats) {
            await db.categories.create(c);
        }
        console.log(`[Seed] ${jsonCats.length} categories added.`);
    }

    // Influencers
    const existingInfs = await db.influencers.find({});
    if (existingInfs.length === 0) {
        const jsonInfs = readJson('influencers.json');
        for (const i of jsonInfs) {
            const hash = await bcrypt.hash('123456', 10);
            await db.influencers.create({ ...i, password: hash, status: 'Approved' });
        }
        console.log(`[Seed] ${jsonInfs.length} influencers added.`);
    }
    console.log('[Seed] Done.');
};

module.exports = seed;

// If run directly
if (require.main === module) {
    db.init().then(() => seed());
}
