const localDb = require('./localDb');
const MongoAdapter = require('./mongoAdapter');

// Configuration
const ENABLE_MONGO = process.env.USE_MONGODB === 'true' || process.env.NODE_ENV === 'production';
const MONGO_URI = process.env.MONGODB_URI;

// This will be updated by initDb
const db = {
    users: localDb.users,
    influencers: localDb.influencers,
    categories: localDb.categories,
    inquiries: localDb.inquiries,
    campaigns: localDb.campaigns,
    init: async () => {
        if (ENABLE_MONGO && MONGO_URI) {
            const mongo = new MongoAdapter(MONGO_URI);
            const connected = await mongo.connect();
            if (connected) {
                console.log('[Database] Switched to MongoDB Atlas Engine');
                db.users = mongo.db.users;
                db.influencers = mongo.db.influencers;
                db.categories = mongo.db.categories;
                db.inquiries = mongo.db.inquiries;
                db.campaigns = mongo.db.campaigns;
                return true;
            } else {
                console.warn('[Database] MongoDB Connection Failed. Using Local Engine.');
            }
        } else {
            console.log('[Database] Using Local JSON Engine (No MONGO_URI)');
        }
        return false;
    }
};

module.exports = db;
