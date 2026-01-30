const mongoose = require('mongoose');
const http = require('http');
require('dotenv').config();

console.log('\n=== DIAGNOSTIC TOOL v1.0 ===');
console.log('OS:', process.platform);
console.log('Node:', process.version);
console.log('Time:', new Date().toISOString());

const MONGO_URI = process.env.MONGODB_URI;
console.log('\n1. Checking Environment...');
if (!MONGO_URI) {
    console.error('❌ MONGODB_URI is MISSING in .env');
} else {
    console.log('✅ MONGODB_URI found:', MONGO_URI.split('@')[1]); // Log only host
}

const PORT = process.env.PORT || 5000;
console.log(`\n2. Checking Port ${PORT}...`);

const checkPort = () => {
    return new Promise((resolve) => {
        const server = http.createServer();

        server.once('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.log(`⚠️  Port ${PORT} is BUSY. Something is already running here!`);
                console.log('   (This is GOOD if it is your backend. BAD if it is a zombie process.)');
                resolve(true); // Port is busy
            } else {
                console.error('❌ Port check error:', err.code);
                resolve(false);
            }
        });

        server.once('listening', () => {
            console.log(`✅ Port ${PORT} is FREE. (The backend is NOT running)`);
            server.close();
            resolve(false); // Port is free
        });

        server.listen(PORT);
    });
};

const checkMongo = async () => {
    console.log('\n3. Testing MongoDB Connection...');
    try {
        await mongoose.connect(MONGO_URI, {
            serverSelectionTimeoutMS: 5000,
            family: 4
        });
        console.log('✅ MongoDB Connection SUCCESS!');
        await mongoose.disconnect();
    } catch (e) {
        console.error('❌ MongoDB Connection FAILED:');
        console.error('   ', e.message);
    }
};

(async () => {
    await checkPort();
    if (MONGO_URI) await checkMongo();
    console.log('\n=== END DIAGNOSTIC ===');
    process.exit(0);
})();
