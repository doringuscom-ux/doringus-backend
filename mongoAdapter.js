/* eslint-disable no-console */
import mongoose from 'mongoose';

// Models
import User from './models/User.js';
import Influencer from './models/Influencer.js';
import Category from './models/Category.js';
import Location from './models/Location.js';
import Inquiry from './models/Inquiry.js';
import Campaign from './models/Campaign.js';

export default class MongoAdapter {
    constructor(uri) {
        this.uri = uri;
        this.isConnected = false;

        // This object mirrors the db export key names
        this.db = {
            users: this._wrapModel(User),
            influencers: this._wrapModel(Influencer),
            categories: this._wrapModel(Category),
            locations: this._wrapModel(Location),
            inquiries: this._wrapModel(Inquiry),
            campaigns: this._wrapModel(Campaign)
        };
    }

    async connect() {
        if (!this.uri) {
            console.error('[MongoAdapter] Error: MONGODB_URI is undefined. Check your .env file.');
            throw new Error('Missing MONGODB_URI');
        }

        try {
            // Mask password for safe logging
            const safeUri = this.uri.replace(/:([^:@]+)@/, ':****@');
            console.log(`[MongoAdapter] Connecting to: ${safeUri}`);

            // Production-Ready Options
            const options = {
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
                family: 4, // IPv4 Force (Required for some Windows setups)
                maxPoolSize: 10,
                retryWrites: true,
                w: 'majority'
            };

            await mongoose.connect(this.uri, options);
            this.isConnected = true;
            console.log('[MongoAdapter] status: CONNECTED');
            return true;
        } catch (e) {
            this.isConnected = false;
            console.error('[MongoAdapter] Connection FAILED');
            console.error(`[MongoAdapter] Reason: ${e.message}`);

            if (e.message.includes('ECONNREFUSED') && e.message.includes('querySrv')) {
                console.error('[MongoAdapter] ⚠️  SRV DNS Error detected. This is a network/environment issue, not a code bug.');
            }
            // We throw here so the caller (db.js) knows it failed
            throw e;
        }
    }

    // Wrap Mongoose Model to match LocalDb API (roughly)
    _wrapModel(Model) {
        return {
            find: async (query = {}) => {
                const docs = await Model.find(query);
                // Return plain objects to match LocalDb behavior
                return docs.map(d => {
                    const obj = d.toObject();
                    obj.id = obj.id || obj._id.toString(); // Preserve existing ID or use _id
                    return obj;
                });
            },
            findOne: async (query = {}) => {
                const doc = await Model.findOne(query);
                if (!doc) return null;
                const obj = doc.toObject();
                obj.id = obj.id || obj._id.toString();
                return obj;
            },
            findById: async (id) => {
                let doc;
                if (mongoose.Types.ObjectId.isValid(id)) {
                    doc = await Model.findById(id);
                }
                if (!doc) doc = await Model.findOne({ id: id }); // Fallback to custom id field
                if (!doc) return null;
                const obj = doc.toObject();
                obj.id = obj.id || obj._id.toString();
                return obj;
            },
            create: async (data) => {
                const doc = new Model(data);
                await doc.save();
                const obj = doc.toObject();
                obj.id = obj.id || obj._id.toString();
                return obj;
            },
            findByIdAndUpdate: async (id, data) => {
                let doc;
                if (mongoose.Types.ObjectId.isValid(id)) {
                    doc = await Model.findByIdAndUpdate(id, data, { new: true });
                }
                if (!doc) {
                    doc = await Model.findOneAndUpdate({ id: id }, data, { new: true });
                }
                if (!doc) return null;
                const obj = doc.toObject();
                obj.id = obj.id || obj._id.toString();
                return obj;
            },
            findByIdAndDelete: async (id) => {
                if (mongoose.Types.ObjectId.isValid(id)) {
                    await Model.findByIdAndDelete(id);
                } else {
                    await Model.findOneAndDelete({ id: id });
                }
                return { success: true };
            },
            countDocuments: async (query = {}) => {
                return await Model.countDocuments(query);
            }
        };
    }
}
