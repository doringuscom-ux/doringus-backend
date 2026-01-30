const mongoose = require('mongoose');

require('dotenv').config();
const uri = process.env.MONGODB_URI;

if (!uri) {
    console.error('Error: MONGODB_URI is not defined in .env');
    process.exit(1);
}

console.log('Testing connection to:', uri);

mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000 // 5 seconds timeout
})
    .then(() => {
        console.log('SUCCESS: Connected to MongoDB!');
        process.exit(0);
    })
    .catch(err => {
        console.error('ERROR: Could not connect to MongoDB');
        console.error('Reason:', err.message);
        if (err.message.includes('ETIMEDOUT')) {
            console.error('HINT: Check your IP Whitelist in MongoDB Atlas Security -> Network Access.');
        }
        process.exit(1);
    });
