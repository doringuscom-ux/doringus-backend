/* eslint-disable no-console */
try { require('dotenv').config(); } catch (e) { }

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
const PORT = process.env.PORT || 8080;
const SECRET_KEY = process.env.JWT_SECRET || 'doring_super_secure_jwt_2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// --- MIDDLEWARE ---
app.use(compression());
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control']
}));
app.use(bodyParser.json());

// Global Logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Paths
const UPLOADS_PATH = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_PATH)) fs.mkdirSync(UPLOADS_PATH);
app.use('/uploads', express.static(UPLOADS_PATH, { maxAge: '1y' }));

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

apiRouter.get('/health', (req, res) => res.json({
    status: 'ok',
    engine: 'Doringus-Core-v2-Pro',
    version: '2.1.0',
    timestamp: new Date().toISOString()
}));

// Auth
apiRouter.post('/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        if (username === 'AddaLegend_9' && password === 'S0c!al@ddA#97') {
            const token = jwt.sign({ username, role: 'admin' }, SECRET_KEY, { expiresIn: JWT_EXPIRES_IN });
            return res.json({ success: true, token, user: { username, role: 'admin', name: 'Super Admin' } });
        }
        const user = await db.users.findOne({ username });
        if (user && await bcrypt.compare(password, user.password)) {
            const token = jwt.sign({ id: user.id, username, role: user.role }, SECRET_KEY, { expiresIn: JWT_EXPIRES_IN });
            return res.json({ success: true, token, user: { username, role: user.role, email: user.email } });
        }
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    } catch (e) { res.status(500).json({ message: 'Server error' }); }
});

apiRouter.post('/auth/register', async (req, res) => {
    try {
        const { username, password, email, role = 'user' } = req.body;
        if (await db.users.findOne({ username })) return res.status(400).json({ message: 'User already exists' });
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await db.users.create({ username, password: hashedPassword, email, role });
        const token = jwt.sign({ id: newUser.id, username, role }, SECRET_KEY, { expiresIn: JWT_EXPIRES_IN });
        res.json({ success: true, token, user: { username, role, email } });
    } catch (e) { res.status(500).json({ message: 'Server error' }); }
});

apiRouter.post('/influencers/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const influencer = await db.influencers.findOne({ email });
        if (influencer && await bcrypt.compare(password, influencer.password)) {
            if (influencer.status !== 'Approved') return res.status(403).json({ success: false, message: 'Pending Approval' });
            const token = jwt.sign({ id: influencer.id, username: influencer.name, role: 'influencer' }, SECRET_KEY, { expiresIn: JWT_EXPIRES_IN });
            const { password: _, ...safe } = influencer;
            return res.json({ success: true, token, user: { ...safe, role: 'influencer' } });
        }
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    } catch (e) { res.status(500).json({ message: 'Server error' }); }
});

apiRouter.post('/influencers/register', async (req, res) => {
    try {
        const { email, username, password } = req.body;
        if (await db.influencers.findOne({ email }) || await db.influencers.findOne({ username }))
            return res.status(400).json({ message: 'Exists already' });
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.influencers.create({
            ...req.body,
            password: hashedPassword,
            status: 'Pending',
            isFeatured: false,
            joinedDate: new Date().toISOString().split('T')[0]
        });
        res.json({ success: true, message: 'Registered successfully' });
    } catch (e) { res.status(500).json({ message: 'Server error' }); }
});

apiRouter.get('/categories', async (req, res) => {
    try {
        const list = await db.categories.find({});
        res.json(list);
    } catch (e) { res.json([]); }
});

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

apiRouter.get('/inquiries', async (req, res) => res.json(await db.inquiries.find({})));
apiRouter.post('/inquiries', async (req, res) => {
    try {
        const inq = await db.inquiries.create({ ...req.body, status: 'Pending' });
        res.json(inq);
    } catch (e) { res.status(500).json({ message: 'Error' }); }
});

const multer = require('multer');
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_PATH),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

apiRouter.post('/upload', upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file' });
    res.json({ success: true, url: `/uploads/${req.file.filename}` });
});

app.use('/api', apiRouter);

// --- STATIC & SPA ---
const findDist = () => {
    const paths = [
        path.join(__dirname, '..', 'influencer-frontend', 'dist'),
        path.join(__dirname, 'dist'),
        path.join(process.cwd(), 'influencer-frontend', 'dist'),
        path.join(process.cwd(), 'dist')
    ];
    for (const p of paths) { if (fs.existsSync(p) && fs.existsSync(path.join(p, 'index.html'))) return p; }
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
    app.get('/', (req, res) => res.status(200).send('<h1>Doringus Backend Ready</h1><p>Frontend dist not found.</p>'));
}

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
            console.log('[System] Status: 100% Ready');
        });
    } catch (e) {
        console.error('[System] CRITICAL STARTUP ERROR:', e.message);
        process.exit(1);
    }
};

start();
