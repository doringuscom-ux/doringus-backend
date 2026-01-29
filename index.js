/* eslint-disable no-console */
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const compression = require('compression');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;
const SECRET_KEY = process.env.JWT_SECRET || 'doring_super_secure_jwt_2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// --- MIDDLEWARE ---
app.use(compression());
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        const allowedOrigins = [
            'https://doringus-frontend.onrender.com',
            'https://doringus.com',
            'https://www.doringus.com',
            'http://localhost:5173',
            'http://localhost:3000'
        ];

        if (allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('.onrender.com')) {
            callback(null, true);
        } else {
            console.log('[CORS Blocked]', origin);
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
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// --- FILE SYSTEM CONFIG ---
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Ensure directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    console.log(`[System] Created uploads directory at: ${UPLOADS_DIR}`);
}

// Serve static files correctly
app.use('/uploads', express.static(UPLOADS_DIR));

// Auth Middleware (Keep existing)
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
// --- API ROUTES ---
const apiRouter = express.Router();

// Friendly Root Message
apiRouter.get('/', (req, res) => {
    res.json({
        status: 'online',
        message: 'DO RING US API is running safely.',
        version: '3.0.0',
        timestamp: new Date().toISOString()
    });
});

apiRouter.get('/health', (req, res) => res.json({
    status: 'ok',
    engine: 'DO RING US-Core-v3-Enterprise',
    version: '3.0.0',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
    db: db.users ? 'connected' : 'disconnected'
}));

// --- AUTH ROUTES ---
apiRouter.post('/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        // Super Admin Hardcoded Bypass
        if (username === 'AddaLegend_9' && password === 'S0c!al@ddA#97') {
            const token = jwt.sign({ username, role: 'admin' }, SECRET_KEY, { expiresIn: JWT_EXPIRES_IN });
            return res.json({ success: true, token, user: { username, role: 'admin', name: 'Super Admin' } });
        }
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
        // Only admin or the influencer themselves can update
        if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
            return res.status(403).json({ message: 'Forbidden' });
        }
        if (req.body.password) req.body.password = await bcrypt.hash(req.body.password, 10);
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

// --- USER MANAGEMENT ROUTES (Admin) ---
apiRouter.get('/users', authenticate, isAdmin, async (req, res) => {
    try {
        const list = await db.users.find({});
        res.json(list);
    } catch (e) { res.json([]); }
});

apiRouter.post('/users', authenticate, isAdmin, async (req, res) => {
    try {
        if (req.body.password) req.body.password = await bcrypt.hash(req.body.password, 10);
        const user = await db.users.create(req.body);
        res.json(user);
    } catch (e) { res.status(500).json({ message: 'Create failed' }); }
});

apiRouter.delete('/users/:id', authenticate, isAdmin, async (req, res) => {
    try {
        await db.users.findByIdAndDelete(req.params.id);
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

// --- FILE UPLOAD ---
const multer = require('multer');
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
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

        console.log(`[Upload Success] File: ${req.file.filename}, Size: ${req.file.size}, Path: ${req.file.path}`);
        res.json({ success: true, url: `/uploads/${req.file.filename}`, filename: req.file.filename });
    });
});

// Debug Uploads Route
apiRouter.get('/debug/uploads', authenticate, isAdmin, (req, res) => {
    try {
        const files = fs.existsSync(UPLOADS_DIR) ? fs.readdirSync(UPLOADS_DIR) : [];
        const rootFiles = fs.existsSync(ROOT_UPLOADS_DIR) ? fs.readdirSync(ROOT_UPLOADS_DIR) : [];
        const parentFiles = fs.existsSync(PARENT_UPLOADS_DIR) ? fs.readdirSync(PARENT_UPLOADS_DIR) : [];
        const tmpFiles = fs.existsSync(TMP_UPLOADS_DIR) ? fs.readdirSync(TMP_UPLOADS_DIR) : [];
        res.json({
            UPLOADS_DIR,
            ROOT_UPLOADS_DIR,
            PARENT_UPLOADS_DIR,
            TMP_UPLOADS_DIR,
            cwd: process.cwd(),
            dirname: __dirname,
            files,
            rootFiles,
            parentFiles,
            tmpFiles
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.use('/api', apiRouter);

// --- STATIC & SPA ---
const findDist = () => {
    const paths = [
        path.join(__dirname, 'dist'),
        path.join(__dirname, '..', 'influencer-frontend', 'dist'),
        path.join(__dirname, '..', 'dist'),
        path.join(process.cwd(), 'influencer-frontend', 'dist'),
        path.join(process.cwd(), 'dist')
    ];
    for (const p of paths) {
        try {
            if (fs.existsSync(p) && fs.existsSync(path.join(p, 'index.html'))) return p;
        } catch (e) { /* skip */ }
    }
    return null;
};

const distPath = findDist();
if (distPath) {
    console.log(`[Static] Serving from: ${distPath}`);
    app.use('/assets', express.static(path.join(distPath, 'assets'), { maxAge: '1y', immutable: true }));
    app.use(express.static(distPath, {
        setHeaders: (res, p) => { if (p.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache'); }
    }));
    app.use((req, res) => {
        if (req.url.startsWith('/api')) return res.status(404).json({ message: 'API Not Found' });
        res.setHeader('Cache-Control', 'no-cache');
        res.sendFile(path.join(distPath, 'index.html'));
    });
} else {
    app.get('/', (req, res) => res.status(200).send('<h1>DO RING US Backend Ready</h1><p>Frontend dist not found.</p>'));
}

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

        // Final sanity seed check
        const cats = await db.categories.find({});
        if (cats.length === 0) {
            console.log('[System] Database empty. Seeding...');
            const seed = require('./seed_local');
            await seed();
        }

        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (e) {
        console.error('[System] CRITICAL STARTUP ERROR:', e.message);
        process.exit(1);
    }
};


start();
