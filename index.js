/* eslint-disable no-console */
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import compression from 'compression';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';

// Internal Imports
import db from './db.js';
import { storage } from './config/cloudinary.js';

dotenv.config();

// --- ESM PATH FIX ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Config
const app = express();
const PORT = process.env.PORT || 5000;
const SECRET_KEY = process.env.JWT_SECRET; // Already validated
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const CLIENT_URL = process.env.CLIENT_URL;

// --- MIDDLEWARE ---
app.use(compression());



const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://doringus.com",
    "https://www.doringus.com",
    "https://doringus-frontend.onrender.com"
];

app.use(
    cors({
        origin: function (origin, callback) {
            // allow requests with no origin (Postman, server-to-server)
            if (!origin) return callback(null, true);

            if (allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                console.error(`[CORS] Blocked request from: ${origin}`);
                callback(new Error("CORS not allowed by security policy"));
            }
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);

app.use(bodyParser.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Global Logging (Filtered for API only to reduce clutter/latency)
app.use((req, res, next) => {
    if (req.originalUrl.startsWith('/api')) {
        console.log(`[API] ${req.method} ${req.originalUrl}`);
    }
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
    version: '3.1.0-prod-ESM-Stability',
    timestamp: new Date().toISOString(),
    db: db.isConnected ? 'connected' : 'offline'
}));

// Database connection check middleware
const checkDb = (req, res, next) => {
    if (!db.isConnected) {
        return res.status(503).json({
            success: false,
            message: 'Database is currently offline. Please try again later.',
            status: 'offline'
        });
    }
    next();
};

// Apply connection check to all subsequent API routes
apiRouter.use(checkDb);

// --- MAGIC SEED ROUTE (TEMPORARY) ---
// Allows seeding via browser: http://localhost:5000/api/seed-db
apiRouter.get('/seed-db', async (req, res) => {
    try {
        console.log('[API Seed] Starting manual seeding...');
        const readJson = (file) => {
            try {
                const p = path.join(__dirname, 'data', file);
                if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
            } catch (e) { console.error(e); }
            return [];
        };

        // 1. Categories
        const catCount = await db.categories.countDocuments({});
        if (catCount === 0) {
            const categories = readJson('categories.json');
            // Fallback
            const finalCats = categories.length > 0 ? categories : [
                { id: 'tech', label: 'Tech', name: 'Tech', image: 'https://placehold.co/400' },
                { id: 'fashion', label: 'Fashion', name: 'Fashion', image: 'https://placehold.co/400' }
            ];
            for (const c of finalCats) {
                // Ensure BOTH name and label exist for safety
                await db.categories.create({
                    ...c, // Preserve all JSON fields (icon, status, etc)
                    id: c.id,
                    label: c.label || c.name,
                    name: c.name || c.label,
                    image: c.image
                });
            }
            console.log(`[API Seed] Seeded ${finalCats.length} categories`);
        } else {
            console.log(`[API Seed] Categories exist. Skipping.`);
        }

        // 2. Influencers
        const infCount = await db.influencers.countDocuments({});
        if (infCount === 0) {
            const influencers = readJson('influencers.json');
            for (const inf of influencers) {
                // Ensure joinedDate
                if (!inf.joinedDate) inf.joinedDate = new Date().toISOString().split('T')[0];
                // Hash Password '123456' if needed
                if (!inf.password || inf.password.length < 50) {
                    inf.password = await bcrypt.hash('123456', 10);
                }
                // FORCE APPROVED STATUS for Seeding
                inf.status = 'Approved';
                await db.influencers.create(inf);
            }
            console.log(`[API Seed] Seeded ${influencers.length} influencers`);
        } else {
            console.log(`[API Seed] Influencers exist (${infCount}). Skipping.`);
        }

        res.json({ success: true, message: 'Database seeded successfully! Refresh your frontend.' });

    } catch (e) {
        console.error('[API Seed] Error:', e);
        res.status(500).json({ error: e.message, stack: e.stack });
    }
});

// --- DEBUG ROUTE ---
apiRouter.get('/debug/status', async (req, res) => {
    try {
        const categories = await db.categories.find({});
        const influencers = await db.influencers.find({});
        res.json({
            status: 'ok',
            db: process.env.MONGODB_URI.includes('cluster0') ? 'Connected' : 'Disconnected',
            counts: { categories: categories.length, influencers: influencers.length },
            sample_category: categories[0] || null,
            sample_influencer_status: influencers[0]?.status || null
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

apiRouter.get('/', (req, res) => {
    res.json({
        status: 'online',
        message: 'DO RING US API (Production)',
        version: '3.1.0-ESM',
    });
});


// --- AUTH ROUTES ---
apiRouter.post(['/auth/login', '/admin/login'], async (req, res) => {
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

// --- HELPER: READ JSON SAFE ---
const readJson = (file) => {
    try {
        const p = path.join(__dirname, 'data', file);
        if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (e) { console.error('[Data Read Error]', e.message); }
    return [];
};

// Locations
apiRouter.get('/locations', async (req, res) => {
    try {
        let items = await db.locations.find();
        if (items.length === 0) {
            // Seed initial locations if none exist
            const initial = [
                { id: 'chandigarh', name: 'chandigarh', label: 'Chandigarh' },
                { id: 'mohali', name: 'mohali', label: 'Mohali' },
                { id: 'panchkula', name: 'panchkula', label: 'Panchkula' }
            ];
            for (const loc of initial) {
                await db.locations.create(loc);
            }
            items = await db.locations.find();
        }
        res.json(items);
    } catch (e) { res.status(500).json({ message: 'Failed to fetch locations' }); }
});

apiRouter.post('/locations', authenticate, isAdmin, async (req, res) => {
    try {
        console.log('[API] Adding location:', req.body);
        const newItem = await db.locations.create(req.body);
        console.log('[API] Location added:', newItem);
        res.json(newItem);
    } catch (e) {
        console.error('[API] Add location FAILED:', e);
        res.status(500).json({ message: 'Create failed', error: e.message });
    }
});

apiRouter.delete('/locations/:id', authenticate, isAdmin, async (req, res) => {
    try {
        await db.locations.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ message: 'Delete failed' }); }
});

// Categories
apiRouter.get('/categories', async (req, res) => {
    try {
        let list = await db.categories.find({});

        // JUST-IN-TIME SEEDING
        if (list.length === 0) {
            console.log('[JIT Seed] Categories empty. Seeding on-the-fly...');
            const categories = readJson('categories.json');
            const data = categories.length > 0 ? categories : [
                { id: 'tech', label: 'Tech', name: 'Tech', image: 'https://placehold.co/400' },
                { id: 'fashion', label: 'Fashion', name: 'Fashion', image: 'https://placehold.co/400' }
            ];

            // Transform and Insert
            for (const c of data) {
                await db.categories.create({
                    ...c,
                    id: c.id,
                    label: c.label || c.name,
                    name: c.name || c.label,
                    image: c.image
                });
            }
            list = await db.categories.find({}); // Re-fetch
        }

        console.log(`[API] Serving ${list.length} categories`);
        res.json(list);
    } catch (e) {
        console.error('[API Error] /categories:', e);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
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
        let list = await db.influencers.find({});

        // JUST-IN-TIME SEEDING
        if (list.length === 0) {
            console.log('[JIT Seed] Influencers empty. Seeding on-the-fly...');
            const influencers = readJson('influencers.json');
            for (const inf of influencers) {
                // Ensure joinedDate
                if (!inf.joinedDate) inf.joinedDate = new Date().toISOString().split('T')[0];
                // Hash Password '123456' if needed
                if (!inf.password || inf.password.length < 50) {
                    inf.password = await bcrypt.hash('123456', 10);
                }
                // FORCE APPROVED STATUS for JIT Seeding (Fixes Frontend Filtering)
                inf.status = 'Approved';
                await db.influencers.create(inf);
            }
            list = await db.influencers.find({}); // Re-fetch
        }

        console.log(`[API] Serving ${list.length} influencers`);
        res.json(list.map(({ password, ...rest }) => rest));
    } catch (e) {
        console.error('[API Error] /influencers:', e);
        res.status(500).json({ error: 'Failed to fetch influencers' });
    }
});

// --- DEBUG RESET ROUTE ---
apiRouter.get('/debug/reset', async (req, res) => {
    try {
        await db.categories.deleteMany({});
        await db.influencers.deleteMany({});
        await autoSeed(); // Uses the internal autoSeed which calls readJson
        res.json({ success: true, message: 'Database reset and re-seeded successfully with APPROVED influencers.' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
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
        const { email, username, password, category, categories } = req.body;
        if (await db.influencers.findOne({ $or: [{ email }, { username }] }))
            return res.status(400).json({ message: 'Email or Username exists already' });

        const hashedPassword = await bcrypt.hash(password, 10);

        // Handle single category vs multiple categories normalization
        const finalCategories = Array.isArray(categories) ? categories : (category ? [category] : []);

        const newItem = await db.influencers.create({
            ...req.body,
            categories: finalCategories,
            category: finalCategories[0] || '', // Fallback for legacy single field
            followers: req.body.followers || req.body.instagramFollowers,
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
        const { category, categories } = req.body;
        if (req.body.password) req.body.password = await bcrypt.hash(req.body.password, 10);

        const finalCategories = Array.isArray(categories) ? categories : (category ? [category] : []);

        const inf = await db.influencers.create({
            ...req.body,
            categories: finalCategories,
            category: finalCategories[0] || ''
        });
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
        const { category, categories } = req.body;
        const updateData = { ...req.body };

        if (categories || category) {
            updateData.categories = Array.isArray(categories) ? categories : (category ? [category] : []);
            updateData.category = updateData.categories[0] || '';
        }

        const inf = await db.influencers.findByIdAndUpdate(req.params.id, updateData, { new: true });
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

// --- AUTO-SEED HELPER ---
const autoSeed = async () => {
    try {
        if (!db.isConnected) {
            console.log('[Auto-Seed] Database offline. Skipping seeding.');
            return;
        }
        console.log('[Auto-Seed] Checking database status...');
        const readJson = (file) => {
            try {
                const p = path.join(__dirname, 'data', file);
                if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
            } catch (e) { console.error('[Auto-Seed] File read error:', e.message); }
            return [];
        };

        // 1. Categories
        const catCount = await db.categories.countDocuments({});
        if (catCount === 0) {
            console.log('[Auto-Seed] Categories empty. Seeding...');
            const categories = readJson('categories.json');
            const finalCats = categories.length > 0 ? categories : [
                { id: 'tech', label: 'Tech', name: 'Tech', image: 'https://placehold.co/400' },
                { id: 'fashion', label: 'Fashion', name: 'Fashion', image: 'https://placehold.co/400' }
            ];
            for (const c of finalCats) {
                await db.categories.create({
                    ...c,
                    id: c.id,
                    label: c.label || c.name,
                    name: c.name || c.label,
                    image: c.image
                });
            }
            console.log(`[Auto-Seed] Seeded ${finalCats.length} categories.`);
        }

        // 2. Influencers
        const infCount = await db.influencers.countDocuments({});
        if (infCount === 0) {
            console.log('[Auto-Seed] Influencers empty. Seeding...');
            const influencers = readJson('influencers.json');
            for (const inf of influencers) {
                if (!inf.joinedDate) inf.joinedDate = new Date().toISOString().split('T')[0];
                if (!inf.password || inf.password.length < 50) {
                    inf.password = await bcrypt.hash('123456', 10);
                }
                // FORCE APPROVED Status for Auto-Seed
                inf.status = 'Approved';
                await db.influencers.create(inf);
            }
            console.log(`[Auto-Seed] Seeded ${influencers.length} influencers.`);
        }

        // 3. Admin User - Re-added for access stability
        const userCount = await db.users.countDocuments({});
        if (userCount === 0) {
            console.log('[Auto-Seed] Users empty. Creating default Admin...');
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await db.users.create({
                username: 'admin',
                password: hashedPassword,
                email: 'admin@doringus.com',
                role: 'superadmin'
            });
            console.log('[Auto-Seed] Created default superadmin: admin / admin123');
        }

    } catch (e) {
        console.error('[Auto-Seed] Failed:', e.message);
    }
};
app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Doringus Backend is Live 🚀",
        timestamp: new Date().toISOString()
    });
});

app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Doringus Backend API is Live 🚀"
    });
});


// --- BOOTSTRAP ---
const start = async () => {
    let dbStatus = 'Pending';
    let seedStatus = 'Pending';

    // 1. Attempt Database Connection (Non-Blocking)
    try {
        console.log('[System] Initializing Database...');
        await db.init();
        dbStatus = 'Connected';

        // 2. Attempt Auto-Seed
        try {
            await autoSeed();
            seedStatus = 'Seeded';
        } catch (seedErr) {
            console.error('[System] Auto-Seed Warning:', seedErr.message);
            seedStatus = 'Failed';
        }
    } catch (dbErr) {
        console.error('[System] CRITICAL DB ERROR: Could not connect to MongoDB.', dbErr);
        console.error('[System] Server will start in OFFLINE MODE to allow debugging.');
        dbStatus = 'Offline/Error';
    }

    // 3. Start HTTP Server (Always)
    try {
        app.listen(PORT, () => {
            console.log('\n==================================================');
            console.log(`🚀  SERVER RUNNING ON LOCALHOST:${PORT}`);
            console.log(`🌟  MODE: ${process.env.NODE_ENV || 'development'}`);
            console.log(`💾  DATABASE: ${dbStatus}`);
            console.log(`🌱  SEEDING: ${seedStatus}`);
            console.log(`🔗  CLIENT URL: ${CLIENT_URL}`);
            console.log('==================================================\n');
        });
    } catch (serverErr) {
        console.error('[System] FAILED TO BIND PORT:', serverErr.message);
        process.exit(1);
    }
};

// Check if this file is the main module being executed
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    start();
}


export default app;
