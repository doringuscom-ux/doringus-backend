const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI || 'mongodb+srv://doringdb:doring%40123@cluster0.4xtwinz.mongodb.net/doringdb?retryWrites=true&w=majority';

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
