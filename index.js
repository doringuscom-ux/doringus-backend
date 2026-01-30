/* eslint-disable no-console */
require('dotenv').config();

// --- STRICT ENV VALIDATION ---
const requiredEnv = [
    'MONGODB_URI',
    'JWT_SECRET',
    'CLIENT_URL',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET'
];
const missingEnv = requiredEnv.filter(key => !process.env[key]);

if (missingEnv.length > 0) {
    console.error('[System] CRITICAL STARTUP ERROR: Missing required environment variables:');
    console.error(`[System] Missing: ${missingEnv.join(', ')}`);
    process.exit(1);
}

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const compression = require('compression');
const db = require('./db');

// Config
const app = express();
const PORT = process.env.PORT || 5000;
const SECRET_KEY = process.env.JWT_SECRET; // Already validated
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const CLIENT_URL = process.env.CLIENT_URL;

// --- MIDDLEWARE ---
app.use(compression());

// Strict CORS
const allowedOrigins = [
    CLIENT_URL, // Production Frontend
    'http://localhost:5173', // Local Vite
    'http://localhost:3000'  // Local React (Backup)
].filter(Boolean); // Remove undefined/null

app.use(cors({
    origin: function (origin, callback) {
        // Allow mobile/curl (no origin)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin) || origin.endsWith('.onrender.com') || origin.endsWith('.vercel.app')) {
            callback(null, true);
        } else {
            console.log(`[CORS Blocked] Origin: ${origin} is not in Allowed List:`, allowedOrigins);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'X-Requested-With']
}));

app.use(bodyParser.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Global Logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    next();
});

// Auth Middleware
const authenticate = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).send({ message: 'No token provided' });

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(401).send({ message: 'Unauthorized session' });
        req.user = decoded;
        next();
    });
};

const isAdmin = (req, res, next) => {
    if (req.user && (req.user.role === 'admin' || req.user.role === 'superadmin')) {
        next();
    } else {
        res.status(403).json({ message: 'Forbidden: Admin access required' });
    }
};

// --- API ROUTES ---
const apiRouter = express.Router();

// Health Check
apiRouter.get('/health', (req, res) => res.json({
    status: 'ok',
    version: '3.1.0-prod',
    timestamp: new Date().toISOString(),
    db: 'connected'
}));

apiRouter.get('/', (req, res) => {
    res.json({
        status: 'online',
        message: 'DO RING US API (Production)',
        version: '3.1.0',
    });
});


// --- AUTH ROUTES ---
apiRouter.post('/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await db.users.findOne({ username });
        if (user && await bcrypt.compare(password, user.password)) {
            const token = jwt.sign({ id: user.id || user._id, username, role: user.role }, SECRET_KEY, { expiresIn: JWT_EXPIRES_IN });
            return res.json({ success: true, token, user: { id: user.id || user._id, username, role: user.role, email: user.email } });
        }
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    } catch (e) { res.status(500).json({ message: 'Server error' }); }
});

apiRouter.post('/auth/register', async (req, res) => {
    try {
        const { username, password, email, role = 'user' } = req.body;
        if (await db.users.findOne({ $or: [{ username }, { email }] })) return res.status(400).json({ message: 'User or Email already exists' });
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await db.users.create({ username, password: hashedPassword, email, role });
        const token = jwt.sign({ id: newUser.id || newUser._id, username, role }, SECRET_KEY, { expiresIn: JWT_EXPIRES_IN });
        res.json({ success: true, token, user: { id: newUser.id || newUser._id, username, role, email } });
    } catch (e) { res.status(500).json({ message: 'Server error' }); }
});

// --- CATEGORY ROUTES ---
apiRouter.get('/categories', async (req, res) => {
    try {
        const list = await db.categories.find({});
        res.json(list);
    } catch (e) { res.json([]); }
});

apiRouter.post('/categories', authenticate, isAdmin, async (req, res) => {
    try {
        const cat = await db.categories.create(req.body);
        res.json(cat);
    } catch (e) { res.status(500).json({ message: 'Create failed' }); }
});

apiRouter.put('/categories/:id', authenticate, isAdmin, async (req, res) => {
    try {
        const cat = await db.categories.findByIdAndUpdate(req.params.id, req.body);
        res.json(cat);
    } catch (e) { res.status(500).json({ message: 'Update failed' }); }
});

apiRouter.delete('/categories/:id', authenticate, isAdmin, async (req, res) => {
    try {
        await db.categories.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ message: 'Delete failed' }); }
});

// --- INFLUENCER ROUTES ---
apiRouter.get('/influencers', async (req, res) => {
    try {
        const list = await db.influencers.find({});
        res.json(list.map(({ password, ...rest }) => rest));
    } catch (e) { res.json([]); }
});

apiRouter.get('/influencers/:username', async (req, res) => {
    try {
        const inf = await db.influencers.findOne({ username: req.params.username });
        if (inf) {
            const { password, ...safe } = inf;
            res.json(safe);
        } else { res.status(404).json({ message: 'Not found' }); }
    } catch (e) { res.status(500).json({ message: 'Server error' }); }
});

apiRouter.post('/influencers/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const influencer = await db.influencers.findOne({ email });
        if (influencer && await bcrypt.compare(password, influencer.password)) {
            if (influencer.status !== 'Approved') return res.status(403).json({ success: false, message: 'Pending Approval' });
            const token = jwt.sign({ id: influencer.id || influencer._id, username: influencer.name, role: 'influencer' }, SECRET_KEY, { expiresIn: JWT_EXPIRES_IN });
            const { password: _, ...safe } = influencer;
            return res.json({ success: true, token, user: { ...safe, role: 'influencer' } });
        }
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    } catch (e) { res.status(500).json({ message: 'Server error' }); }
});

apiRouter.post('/influencers/register', async (req, res) => {
    try {
        const { email, username, password } = req.body;
        if (await db.influencers.findOne({ $or: [{ email }, { username }] }))
            return res.status(400).json({ message: 'Email or Username exists already' });
        const hashedPassword = await bcrypt.hash(password, 10);
        const newItem = await db.influencers.create({
            ...req.body,
            password: hashedPassword,
            status: 'Pending',
            isFeatured: false,
            joinedDate: new Date().toISOString().split('T')[0]
        });
        res.json({ success: true, message: 'Registered successfully', id: newItem.id || newItem._id });
    } catch (e) { res.status(500).json({ message: 'Server error' }); }
});

// Admin specific influencer routes
apiRouter.post('/influencers', authenticate, isAdmin, async (req, res) => {
    try {
        if (req.body.password) req.body.password = await bcrypt.hash(req.body.password, 10);
        const inf = await db.influencers.create(req.body);
        res.json(inf);
    } catch (e) { res.status(500).json({ message: 'Create failed' }); }
});

apiRouter.put('/influencers/status/:id', authenticate, isAdmin, async (req, res) => {
    try {
        const inf = await db.influencers.findByIdAndUpdate(req.params.id, { status: req.body.status });
        res.json({ success: true, influencer: inf });
    } catch (e) { res.status(500).json({ message: 'Status update failed' }); }
});

apiRouter.put('/influencers/update/:id', authenticate, async (req, res) => {
    try {
        const inf = await db.influencers.findByIdAndUpdate(req.params.id, req.body);
        res.json({ success: true, influencer: inf });
    } catch (e) { res.status(500).json({ message: 'Update failed' }); }
});

apiRouter.delete('/influencers/:id', authenticate, isAdmin, async (req, res) => {
    try {
        await db.influencers.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ message: 'Delete failed' }); }
});

// --- INQUIRY ROUTES ---
apiRouter.get('/inquiries', authenticate, isAdmin, async (req, res) => {
    try {
        const list = await db.inquiries.find({});
        res.json(list);
    } catch (e) { res.json([]); }
});

apiRouter.post('/inquiries', async (req, res) => {
    try {
        const inq = await db.inquiries.create({ ...req.body, status: 'Pending' });
        res.json(inq);
    } catch (e) { res.status(500).json({ message: 'Error' }); }
});

apiRouter.put('/inquiries/:id/status', authenticate, isAdmin, async (req, res) => {
    try {
        await db.inquiries.findByIdAndUpdate(req.params.id, { status: req.body.status });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ message: 'Update failed' }); }
});

apiRouter.delete('/inquiries/:id', authenticate, isAdmin, async (req, res) => {
    try {
        await db.inquiries.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ message: 'Delete failed' }); }
});

// --- CAMPAIGN ROUTES ---
apiRouter.get('/campaigns', async (req, res) => {
    try {
        const list = await db.campaigns.find({});
        res.json(list);
    } catch (e) { res.json([]); }
});

apiRouter.post('/campaigns', authenticate, isAdmin, async (req, res) => {
    try {
        const camp = await db.campaigns.create(req.body);
        res.json(camp);
    } catch (e) { res.status(500).json({ message: 'Create failed' }); }
});

apiRouter.delete('/campaigns/:id', authenticate, isAdmin, async (req, res) => {
    try {
        await db.campaigns.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ message: 'Delete failed' }); }
});

// --- FILE UPLOAD (Cloudinary) ---
const multer = require('multer');
const { storage } = require('./config/cloudinary');

const upload = multer({
    storage,
    limits: { fileSize: 30 * 1024 * 1024 } // 30MB Limit
});

apiRouter.post('/upload', (req, res) => {
    upload.single('image')(req, res, (err) => {
        if (err) {
            console.error('[Upload Debug] MULTER ERROR:', err);
            return res.status(500).json({
                success: false,
                message: `Server Upload Error: ${err.message}`,
                error: err.code || 'UNKNOWN'
            });
        }

        if (!req.file) {
            console.error('[Upload Debug] NO FILE');
            return res.status(400).json({ success: false, message: 'No file received by server' });
        }

        console.log(`[Upload Success] File uploaded to Cloudinary: ${req.file.path}`);
        res.json({ success: true, url: req.file.path, filename: req.file.filename });
    });
});

app.use('/api', apiRouter);

// --- GLOBAL ERROR HANDLER ---
app.use((err, req, res, next) => {
    console.error('[Uncaught Error]', err);
    res.status(500).json({
        success: false,
        message: 'A critical server error occurred.',
        error: err.message,
        path: req.url
    });
});

// --- BOOTSTRAP ---
const start = async () => {
    try {
        console.log('[System] Initializing Database...');
        await db.init();

        app.listen(PORT, () => {
            console.log(`[System] Server running on port ${PORT}`);
            console.log(`[System] Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`[System] Client URL: ${CLIENT_URL}`);
            console.log(`[System] Database: Connected to Atlas (${MONGODB_URI.includes('doringdb') ? 'Production DB' : 'Check URI'})`);
        });
    } catch (e) {
        console.error('[System] CRITICAL STARTUP ERROR:', e.message);
        process.exit(1);
    }
};

// Only run listen if executed directly (not imported as a module for Vercel)
if (require.main === module) {
    start();
}

module.exports = app;
