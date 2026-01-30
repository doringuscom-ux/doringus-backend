const MongoAdapter = require('./mongoAdapter');

// Configuration
const MONGODB_URI = process.env.MONGODB_URI;

const db = {
    // Placeholders that will be populated by MongoAdapter
    users: null,
    influencers: null,
    categories: null,
    inquiries: null,
    campaigns: null,

    init: async () => {
        // 1. Validate Env
        if (!MONGODB_URI) {
            console.error('[Database] CRITICAL ERROR: MONGODB_URI is missing from environment variables.');
            console.error('[Database] The server cannot start without a database connection.');
            process.exit(1);
        }

        // 2. Check Global Cache (Serverless/Hot-Reload)
        if (global.mongoInstance && global.mongoInstance.isConnected) {
            console.log('[Database] Using cached MongoDB connection');
            db._bindModels(global.mongoInstance);
            return true;
        }

        // 3. Create New Connection
        console.log('[Database] Connecting to MongoDB Atlas...');
        const mongo = new MongoAdapter(MONGODB_URI);
        const connected = await mongo.connect();

        if (connected) {
            console.log('[Database] Connected successfully to MongoDB Atlas');
            global.mongoInstance = mongo; // Cache it
            db._bindModels(mongo);
            return true;
            console.error('[Database] CRITICAL ERROR: Failed to connect to MongoDB Atlas.');
            console.error('[Database] Check your connection string and IP whitelist.');
            throw new Error('Database Connection Failed'); // Throw instead of exit
        }
    },

    // Helper to bind adapter models to this db object
    _bindModels: (adapter) => {
        db.users = adapter.db.users;
        db.influencers = adapter.db.influencers;
        db.categories = adapter.db.categories;
        db.inquiries = adapter.db.inquiries;
        db.campaigns = adapter.db.campaigns;
    }
};

module.exports = db;

