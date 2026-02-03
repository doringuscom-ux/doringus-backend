import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const uri = process.env.MONGODB_URI;

const options = {
    serverSelectionTimeoutMS: 5000,
    family: 4
};

console.log('--- Remote Debug ---');
mongoose.connect(uri, options)
    .then(() => {
        console.log('Status: Connected to Cluster');
        process.exit(0);
    })
    .catch(err => {
        console.error('Status: Connection Failed');
        console.error('Error:', err.message);
        process.exit(1);
    });
