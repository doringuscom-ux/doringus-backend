import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const uri = process.env.MONGODB_URI;

if (!uri) {
    console.error('MONGODB_URI not found in env');
    process.exit(1);
}

mongoose.connect(uri)
    .then(() => {
        console.log('Connection successful');
        process.exit(0);
    })
    .catch(err => {
        console.error('Connection failed:', err);
        process.exit(1);
    });
