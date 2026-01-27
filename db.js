const localDb = require('./localDb');
const MongoAdapter = require('./mongoAdapter');

// Configuration
const IS_PROD = process.env.NODE_ENV === 'production';
const MONGO_URI = process.env.MONGO_URI;

// This will be updated by init
const db = {
    users: localDb.users,
    influencers: localDb.influencers,
    categories: localDb.categories,
    inquiries: localDb.inquiries,
    campaigns: localDb.campaigns,
    init: async () => {
        if (IS_PROD) {
            if (!MONGO_URI) {
                console.error('[Database] CRITICAL: MONGO_URI is missing in production!');
                process.exit(1);
            }

            const mongo = new MongoAdapter(MONGO_URI);
            const connected = await mongo.connect();

            if (connected) {
                console.log('Connected to MongoDB Atlas');
                db.users = mongo.db.users;
                db.influencers = mongo.db.influencers;
                db.categories = mongo.db.categories;
                db.inquiries = mongo.db.inquiries;
                db.campaigns = mongo.db.campaigns;
                return true;
            } else {
                console.error('[Database] CRITICAL: MongoDB Atlas connection failed in production!');
                process.exit(1);
            }
        } else {
            // Development behavior
            if (MONGO_URI) {
                const mongo = new MongoAdapter(MONGO_URI);
                const connected = await mongo.connect();
                if (connected) {
                    console.log('[Database] Development: Connected to MongoDB Atlas');
                    db.users = mongo.db.users;
                    db.influencers = mongo.db.influencers;
                    db.categories = mongo.db.categories;
                    db.inquiries = mongo.db.inquiries;
                    db.campaigns = mongo.db.campaigns;
                    return true;
                }
            }
            console.log('[Database] Using Local JSON Engine');
            return false;
        }
    }
};

module.exports = db;

