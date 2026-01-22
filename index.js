const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 5000;
const SECRET_KEY = process.env.JWT_SECRET || 'S0c!al@ddA#97_Secret';

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());

// Global Logging
app.use((req, res, next) => {
    console.log(`[Global] ${req.method} ${req.url}`);
    next();
});

// Paths
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const CATEGORIES_PATH = path.join(DATA_DIR, 'categories.json');
const INFLUENCERS_PATH = path.join(DATA_DIR, 'influencers.json');
const USERS_PATH = path.join(DATA_DIR, 'users.json');
const INQUIRIES_PATH = path.join(DATA_DIR, 'inquiries.json');
const CAMPAIGNS_PATH = path.join(DATA_DIR, 'campaigns.json');
const UPLOADS_PATH = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOADS_PATH)) fs.mkdirSync(UPLOADS_PATH);
app.use('/uploads', express.static(UPLOADS_PATH));

// Helpers
const readData = (filePath) => {
    try {
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify([], null, 4), 'utf8');
            return [];
        }
        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content || '[]');
    } catch (err) {
        return [];
    }
};

const writeData = (filePath, data) => {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf8');
};

// Auth Middleware
const authenticate = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).send({ message: 'No token provided' });

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(401).send({ message: 'Unauthorized session. Please login again.' });
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

// Debug middleware for API
apiRouter.use((req, res, next) => {
    console.log(`[API-Router] Processing: ${req.method} ${req.url}`);
    next();
});

// Health Check
apiRouter.get('/health', (req, res) => res.json({
    status: 'ok',
    engine: 'Doringus-Core-v2',
    version: '2.0.1',
    timestamp: new Date().toISOString()
}));

// Auth - HIGHEST PRIORITY
apiRouter.post('/auth/login', async (req, res) => {
    const { username, password } = req.body;
    console.log(`[Auth] Admin Login Attempt: ${username}`);
    // Hardcoded Admin
    if (username === 'AddaLegend_9' && password === 'S0c!al@ddA#97') {
        const token = jwt.sign({ username, role: 'admin' }, SECRET_KEY, { expiresIn: '24h' });
        return res.json({ success: true, token, user: { username, role: 'admin', name: 'Super Admin' } });
    }
    const users = readData(USERS_PATH);
    const user = users.find(u => u.username === username);
    if (user && await bcrypt.compare(password, user.password)) {
        const token = jwt.sign({ id: user.id, username, role: user.role }, SECRET_KEY, { expiresIn: '24h' });
        res.json({ success: true, token, user: { username, role: user.role } });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

apiRouter.post('/influencers/login', async (req, res) => {
    const { email, password } = req.body;
    console.log(`[Auth] Influencer Login Attempt: ${email}`);
    const influencers = readData(INFLUENCERS_PATH);
    const influencer = influencers.find(i => i.email === email);

    if (influencer && await bcrypt.compare(password, influencer.password)) {
        if (influencer.status !== 'Approved') {
            return res.status(403).json({ success: false, message: 'Your account is currently pending admin approval.' });
        }
        const token = jwt.sign({ id: influencer.id, username: influencer.name, role: 'influencer' }, SECRET_KEY, { expiresIn: '24h' });
        return res.json({ success: true, token, user: { ...influencer, role: 'influencer' } });
    }
    res.status(401).json({ success: false, message: 'Invalid credentials' });
});

apiRouter.post('/influencers/register', async (req, res) => {
    try {
        const influencers = readData(INFLUENCERS_PATH);
        const { email, username, password } = req.body;
        if (influencers.find(i => i.email === email || i.username === username)) return res.status(400).json({ message: 'Influencer with this email or username already exists' });
        const hashedPassword = await bcrypt.hash(password, 10);
        const newInfluencer = { id: Date.now().toString(), ...req.body, password: hashedPassword, status: 'Pending', joinedDate: new Date().toISOString().split('T')[0] };
        influencers.push(newInfluencer);
        writeData(INFLUENCERS_PATH, influencers);
        res.json({ success: true, message: 'Registration submitted for review' });
    } catch (e) {
        res.status(500).json({ message: 'Server error during influencer registration' });
    }
});

apiRouter.post('/auth/register', async (req, res) => {
    try {
        const { username, password, email, role = 'user' } = req.body;
        const users = readData(USERS_PATH);
        if (users.find(u => u.username === username)) return res.status(400).json({ message: 'User already exists' });
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = { id: Date.now().toString(), username, password: hashedPassword, email, role };
        users.push(newUser);
        writeData(USERS_PATH, users);
        const token = jwt.sign({ id: newUser.id, username, role }, SECRET_KEY, { expiresIn: '24h' });
        res.json({ success: true, token, user: { username, role, email } });
    } catch (e) {
        res.status(500).json({ message: 'Server error during registration' });
    }
});

// Categories (Brands)
apiRouter.get('/categories', (req, res) => res.json(readData(CATEGORIES_PATH)));
apiRouter.post('/categories', authenticate, isAdmin, (req, res) => {
    const categories = readData(CATEGORIES_PATH);
    const newCategory = { id: Date.now().toString(), ...req.body };
    categories.push(newCategory);
    writeData(CATEGORIES_PATH, categories);
    res.json(newCategory);
});
apiRouter.put('/categories/:id', authenticate, isAdmin, (req, res) => {
    let categories = readData(CATEGORIES_PATH);
    categories = categories.map(cat => String(cat.id) === String(req.params.id) ? { ...cat, ...req.body } : cat);
    writeData(CATEGORIES_PATH, categories);
    res.json({ success: true });
});
apiRouter.delete('/categories/:id', authenticate, isAdmin, (req, res) => {
    let categories = readData(CATEGORIES_PATH);
    categories = categories.filter(cat => String(cat.id) !== String(req.params.id));
    writeData(CATEGORIES_PATH, categories);
    res.json({ success: true });
});

// Influencers Management
apiRouter.get('/influencers', (req, res) => {
    const influencers = readData(INFLUENCERS_PATH);
    res.json(influencers.map(({ password, ...rest }) => rest));
});

apiRouter.put('/influencers/status/:id', authenticate, isAdmin, (req, res) => {
    const { status } = req.body;
    let influencers = readData(INFLUENCERS_PATH);
    const idx = influencers.findIndex(inf => String(inf.id) === String(req.params.id));
    if (idx !== -1) {
        influencers[idx].status = status;
        writeData(INFLUENCERS_PATH, influencers);
        res.json({ success: true });
    } else {
        res.status(404).json({ message: 'Influencer not found' });
    }
});

apiRouter.get('/influencers/:username', (req, res) => {
    const influencers = readData(INFLUENCERS_PATH);
    const influencer = influencers.find(inf => inf.username === req.params.username);
    if (influencer) {
        const { password, ...safeInfluencer } = influencer;
        res.json(safeInfluencer);
    } else {
        res.status(404).json({ message: 'Influencer not found' });
    }
});

apiRouter.post('/influencers', authenticate, isAdmin, (req, res) => {
    const influencers = readData(INFLUENCERS_PATH);
    const newInfluencer = { id: Date.now().toString(), ...req.body, status: req.body.status || 'Approved', joinedDate: new Date().toISOString().split('T')[0] };
    influencers.push(newInfluencer);
    writeData(INFLUENCERS_PATH, influencers);
    res.json(newInfluencer);
});

apiRouter.put('/influencers/update/:id', authenticate, (req, res) => {
    try {
        let influencers = readData(INFLUENCERS_PATH);
        const idx = influencers.findIndex(inf => String(inf.id) === String(req.params.id));
        if (idx === -1) return res.status(404).json({ success: false, message: 'Not found' });
        if (req.user.role !== 'admin' && req.user.role !== 'superadmin' && String(req.user.id) !== String(req.params.id)) return res.status(403).json({ success: false, message: 'Unauthorized' });

        const { password, ...updateData } = req.body;
        influencers[idx] = { ...influencers[idx], ...updateData, id: req.params.id };

        writeData(INFLUENCERS_PATH, influencers);
        res.json({ success: true, influencer: influencers[idx] });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Update failed' });
    }
});

apiRouter.delete('/influencers/:id', authenticate, isAdmin, (req, res) => {
    let influencers = readData(INFLUENCERS_PATH);
    const originalLength = influencers.length;
    influencers = influencers.filter(inf => String(inf.id) !== String(req.params.id));
    if (influencers.length === originalLength) {
        return res.status(404).json({ message: 'Influencer not found or already deleted' });
    }
    writeData(INFLUENCERS_PATH, influencers);
    res.json({ success: true });
});

// Users
apiRouter.get('/users', authenticate, isAdmin, (req, res) => {
    const users = readData(USERS_PATH);
    res.json(users.map(({ password, ...rest }) => rest));
});

apiRouter.post('/users', authenticate, isAdmin, async (req, res) => {
    try {
        const { username, password, email, role = 'user' } = req.body;
        const users = readData(USERS_PATH);
        if (users.find(u => u.username === username)) return res.status(400).json({ message: 'User already exists' });
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = { id: Date.now().toString(), username, password: hashedPassword, email, role };
        users.push(newUser);
        writeData(USERS_PATH, users);
        res.json({ id: newUser.id, username, email, role });
    } catch (e) {
        res.status(500).json({ message: 'Server error during user creation' });
    }
});

apiRouter.delete('/users/:id', authenticate, isAdmin, (req, res) => {
    let users = readData(USERS_PATH);
    users = users.filter(u => String(u.id) !== String(req.params.id));
    writeData(USERS_PATH, users);
    res.json({ success: true });
});

// Inquiries
apiRouter.get('/inquiries', (req, res) => res.json(readData(INQUIRIES_PATH)));
apiRouter.post('/inquiries', (req, res) => {
    const inquiries = readData(INQUIRIES_PATH);
    const newInquiry = { id: Date.now().toString(), ...req.body, status: 'Pending', createdAt: new Date().toISOString() };
    inquiries.push(newInquiry);
    writeData(INQUIRIES_PATH, inquiries);
    res.json(newInquiry);
});
apiRouter.put('/inquiries/:id/status', authenticate, (req, res) => {
    const { status } = req.body;
    let inquiries = readData(INQUIRIES_PATH);
    inquiries = inquiries.map(inq => String(inq.id) === String(req.params.id) ? { ...inq, status } : inq);
    writeData(INQUIRIES_PATH, inquiries);
    res.json({ success: true });
});
apiRouter.delete('/inquiries/:id', authenticate, isAdmin, (req, res) => {
    let inquiries = readData(INQUIRIES_PATH);
    inquiries = inquiries.filter(inq => String(inq.id) !== String(req.params.id));
    writeData(INQUIRIES_PATH, inquiries);
    res.json({ success: true });
});

// Campaigns
apiRouter.get('/campaigns', authenticate, isAdmin, (req, res) => res.json(readData(CAMPAIGNS_PATH)));
apiRouter.post('/campaigns', authenticate, isAdmin, (req, res) => {
    const campaigns = readData(CAMPAIGNS_PATH);
    const newCampaign = { id: Date.now().toString(), ...req.body, status: 'Active' };
    campaigns.push(newCampaign);
    writeData(CAMPAIGNS_PATH, campaigns);
    res.json(newCampaign);
});

// File Upload
const multer = require('multer');
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_PATH),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname))
});
const upload = multer({ storage });
apiRouter.post('/upload', upload.single('image'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
        const fileUrl = `/uploads/${req.file.filename}`;
        res.json({ success: true, url: fileUrl });
    } catch (e) {
        res.status(500).json({ message: 'Upload failed' });
    }
});

// Mount API Router
app.use('/api', apiRouter);

// --- STATIC FILES & SPA ROUTING ---
const DIST_PATH = path.join(__dirname, '..', 'dist');

if (fs.existsSync(DIST_PATH)) {
    console.log(`[Static] Serving dist from ${DIST_PATH}`);
    app.use(express.static(DIST_PATH));
}

// Catch-all using app.use for SPA stability
app.use((req, res, next) => {
    // Return API not found if it's an API request
    if (req.url.startsWith('/api')) {
        console.error(`[API-Error] Route not found: ${req.method} ${req.url}`);
        return res.status(404).json({
            success: false,
            message: `API Route not found: ${req.method} ${req.url}`,
            hint: 'Check if the route is defined in apiRouter and mounted correctly.'
        });
    }

    // Serve index.html for everything else
    const indexPath = path.join(DIST_PATH, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        console.warn(`[Server-Warning] Build not found at ${DIST_PATH}. Please run 'npm run build' or 'node node_modules/vite/bin/vite.js build'.`);
        res.status(200).send(`
            <div style="font-family: sans-serif; padding: 50px; text-align: center;">
                <h1 style="color: #FF2D55;">Doringus Backend Active</h1>
                <p>The backend is running successfully on port ${PORT}, but the frontend build (dist folder) was not found.</p>
                <div style="background: #f1f5f9; padding: 20px; border-radius: 12px; display: inline-block; text-align: left; margin-top: 20px;">
                    <code>1. Run build: <b>node node_modules/vite/bin/vite.js build</b></code><br>
                    <code>2. Refresh this page</b></code>
                </div>
            </div>
        `);
    }
});

app.listen(PORT, () => console.log(`[Server] Doringus Titan v2 running on port ${PORT}`));
