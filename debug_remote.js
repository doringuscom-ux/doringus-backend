const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGODB_URI;

console.log('--- REMOTE DB DEBUGGER ---');
console.log('Target URI:', uri ? uri.replace(/:([^:@]+)@/, ':****@') : 'UNDEFINED');

if (!uri) {
    console.error('ERROR: MONGODB_URI is missing from .env');
    process.exit(1);
}

const run = async () => {
    try {
        console.log('1. Attempting connection...');
        await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 5000,
            family: 4
        });
        console.log('✅ Connection Successful!');

        console.log('2. checking Collections...');
        const cats = await mongoose.connection.db.collection('categories').countDocuments();
        const infs = await mongoose.connection.db.collection('influencers').countDocuments();

        console.log(`   - Categories Count: ${cats}`);
        console.log(`   - Influencers Count: ${infs}`);

        if (cats === 0 || infs === 0) {
            console.warn('⚠️ WARNING: Collections are empty!');
        } else {
            console.log('✅ Data exists!');
        }

        process.exit(0);

    } catch (e) {
        console.error('❌ CONNECTION FAILED');
        console.error(e);
        process.exit(1);
    }
};

run();
