import MongoAdapter from './mongoAdapter.js';
import dotenv from 'dotenv';
import Category from './models/Category.js';
import Location from './models/Location.js';
import Inquiry from './models/Inquiry.js';
dotenv.config();

// Configuration
const MONGODB_URI = process.env.MONGODB_URI;

// Placeholder for a potential model proxy function, assuming it's defined elsewhere or will be added.
// For the purpose of this edit, we'll assume `createModelProxy` is available.
// If it's not, this will cause a runtime error.
const createModelProxy = (Model) => {
    // This is a placeholder implementation.
    // In a real scenario, this function would wrap the Mongoose model
    // to provide additional functionality or a consistent interface.
    return Model;
};

const db = {
    // Placeholders that will be populated by MongoAdapter
    users: null,
    influencers: null,
    categories: null,
    locations: null,
    inquiries: null,
    campaigns: null,
    isConnected: false,

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
            db.isConnected = true;
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
            db.isConnected = true;
            return true;
        } else {
            console.error('[Database] CRITICAL ERROR: Failed to connect to MongoDB Atlas.');
            console.error('[Database] Check your connection string and IP whitelist.');
            db.isConnected = false;
            throw new Error('Database Connection Failed');
        }
    },

    // Helper to bind adapter models to this db object
    _bindModels: (adapter) => {
        db.users = adapter.db.users;
        db.influencers = adapter.db.influencers;
        db.categories = adapter.db.categories;
        db.locations = adapter.db.locations;
        db.inquiries = adapter.db.inquiries;
        db.campaigns = adapter.db.campaigns;
    }
};

export default db;
