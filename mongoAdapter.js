/* eslint-disable no-console */
const mongoose = require('mongoose');

// Models
const User = require('./models/User');
const Influencer = require('./models/Influencer');
const Category = require('./models/Category');
const Inquiry = require('./models/Inquiry');
const Campaign = require('./models/Campaign');

class MongoAdapter {
    constructor(uri) {
        this.uri = uri;
        this.isConnected = false;

        // This object mirrors the db export key names
        this.db = {
            users: this._wrapModel(User),
            influencers: this._wrapModel(Influencer),
            categories: this._wrapModel(Category),
            inquiries: this._wrapModel(Inquiry),
            campaigns: this._wrapModel(Campaign)
        };
    }

    async connect() {
        try {
            console.log('[MongoAdapter] Connecting to Atlas...');
            await mongoose.connect(this.uri, { serverSelectionTimeoutMS: 5000 });
            this.isConnected = true;
            console.log('[MongoAdapter] Connected successfully');
            return true;
        } catch (e) {
            console.error('[MongoAdapter] Connection failed:', e.message);
            return false;
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
                    obj.id = obj._id.toString(); // Ensure id exists
                    return obj;
                });
            },
            findOne: async (query = {}) => {
                const doc = await Model.findOne(query);
                if (!doc) return null;
                const obj = doc.toObject();
                obj.id = obj._id.toString();
                return obj;
            },
            findById: async (id) => {
                const doc = await Model.findById(id);
                if (!doc) return null;
                const obj = doc.toObject();
                obj.id = obj._id.toString();
                return obj;
            },
            create: async (data) => {
                const doc = new Model(data);
                await doc.save();
                const obj = doc.toObject();
                obj.id = obj._id.toString();
                return obj;
            },
            findByIdAndUpdate: async (id, data) => {
                const doc = await Model.findByIdAndUpdate(id, data, { new: true });
                if (!doc) return null;
                const obj = doc.toObject();
                obj.id = obj._id.toString();
                return obj;
            },
            findByIdAndDelete: async (id) => {
                await Model.findByIdAndDelete(id);
                return { success: true };
            }
        };
    }
}

module.exports = MongoAdapter;
