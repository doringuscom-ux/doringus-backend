import mongoose from 'mongoose';
import http from 'http';
import dotenv from 'dotenv';
dotenv.config();

console.log('--- Database Diagnosis ---');
console.log('URI:', process.env.MONGODB_URI ? 'Defined' : 'Missing');

if (process.env.MONGODB_URI) {
    mongoose.connect(process.env.MONGODB_URI)
        .then(() => {
            console.log('Status: Connected');
            process.exit(0);
        })
        .catch(err => {
            console.error('Status: Failed');
            console.error('Error:', err.message);
            process.exit(1);
        });
} else {
    console.error('Error: MONGODB_URI is not defined');
    process.exit(1);
}
