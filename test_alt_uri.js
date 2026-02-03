import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

// Derived from nslookup
const hosts = [
    'ac-qeazkaf-shard-00-00.irqejva.mongodb.net:27017',
    'ac-qeazkaf-shard-00-01.irqejva.mongodb.net:27017',
    'ac-qeazkaf-shard-00-02.irqejva.mongodb.net:27017'
];

const user = 'doringususer';
const pass = 'vikas12345';
const db = 'doringus';

// Try standard connection string (Non-SRV)
// Note: We might need the correct replicaSet name, but usually it works without if we list multiple
const uri = `mongodb://${user}:${pass}@${hosts.join(',')}/${db}?ssl=true&authSource=admin&retryWrites=true&w=majority`;

console.log('Testing Alternative URI:', uri.replace(pass, '****'));

mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 })
    .then(() => {
        console.log('SUCCESS: Connected using Standard Connection String!');
        process.exit(0);
    })
    .catch(err => {
        console.error('FAILED:', err.message);
        process.exit(1);
    });
