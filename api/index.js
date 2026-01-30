const app = require('../index');
const db = require('../db');

// Vercel Serverless Handler
module.exports = async (req, res) => {
    // 1. Ensure DB is connected (uses global cache internally)
    await db.init();

    // 2. Delegate to Express
    app(req, res);
};
