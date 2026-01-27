const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

class LocalCollection {
    constructor(filename) {
        this.filename = filename;
        this.filepath = path.join(DATA_DIR, `${filename}.json`);
        this.data = this._read();
    }

    _read() {
        try {
            if (!fs.existsSync(this.filepath)) {
                fs.writeFileSync(this.filepath, '[]', 'utf8');
                return [];
            }
            const content = fs.readFileSync(this.filepath, 'utf8');
            return JSON.parse(content || '[]');
        } catch (e) {
            console.error(`Error reading ${this.filename}:`, e);
            return [];
        }
    }

    _write() {
        try {
            fs.writeFileSync(this.filepath, JSON.stringify(this.data, null, 4), 'utf8');
        } catch (e) {
            console.error(`Error writing ${this.filename}:`, e);
        }
    }

    async find(query = {}) {
        return this.data.filter(item => {
            for (let key in query) {
                if (item[key] !== query[key]) return false;
            }
            return true;
        });
    }

    async findOne(query = {}) {
        return this.data.find(item => {
            for (let key in query) {
                if (item[key] !== query[key]) return false;
            }
            return true;
        });
    }

    async findById(id) {
        return this.data.find(item => String(item.id) === String(id) || String(item._id) === String(id));
    }

    async create(doc) {
        const newItem = {
            _id: uuidv4(),
            id: uuidv4(), // dual support
            ...doc,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        this.data.push(newItem);
        this._write();
        return newItem;
    }

    async findByIdAndUpdate(id, update, options) {
        const idx = this.data.findIndex(item => String(item.id) === String(id) || String(item._id) === String(id));
        if (idx === -1) return null;

        this.data[idx] = { ...this.data[idx], ...update, updatedAt: new Date().toISOString() };
        this._write();
        return this.data[idx];
    }

    async findByIdAndDelete(id) {
        const idx = this.data.findIndex(item => String(item.id) === String(id) || String(item._id) === String(id));
        if (idx === -1) return null;

        const deleted = this.data[idx];
        this.data = this.data.filter((_, i) => i !== idx);
        this._write();
        return deleted;
    }

    // Helper to mimic Mongoose .save() pattern if needed involved in objects
    // But for this simple refactor, direct util methods are better.
}

// Initialize Collections
const db = {
    users: new LocalCollection('users'),
    influencers: new LocalCollection('influencers'),
    categories: new LocalCollection('categories'),
    inquiries: new LocalCollection('inquiries'),
    campaigns: new LocalCollection('campaigns')
};

module.exports = db;
