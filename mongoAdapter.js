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
            // Mask password for logging
            const safeUri = this.uri.replace(/:([^:@]+)@/, ':****@');
            console.log(`[MongoAdapter] Connecting to Atlas: ${safeUri}`);

            // Robust Connection Options for Windows/Atlas
            const options = {
                serverSelectionTimeoutMS: 5000, // Fail fast if no connection
                socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
                family: 4 // Force IPv4 (Fixes nodejs/node#40537 on Windows 10/11)
            };

            await mongoose.connect(this.uri, options);
            this.isConnected = true;
            console.log('[MongoAdapter] Connected successfully');
            return true;
        } catch (e) {
            console.error('[MongoAdapter] Connection failed!');
            console.error('Error Name:', e.name);
            console.error('Error Message:', e.message);
            console.error('Full Stack:', e.stack);

            if (e.message.includes('ECONNREFUSED')) {
                console.error('[MongoAdapter] HINT: DNS Lookup Failed.');
                console.error('[MongoAdapter] 1. Check Internet Connection.');
                console.error('[MongoAdapter] 2. Try changing PC DNS to 8.8.8.8.');
                console.error('[MongoAdapter] 3. Ensure IP Whitelist on Atlas includes CURRENT IP (0.0.0.0/0).');
            }
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
            }
        };
    }
}

module.exports = MongoAdapter;
