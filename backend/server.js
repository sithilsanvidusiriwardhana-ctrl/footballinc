const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { parseCSV, calculateColumnStats, filterDataFrame } = require('./utils/csvParser');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and parsing
app.use(cors());
app.use(express.json());

// Set up public static folder for frontend dashboard
app.use(express.static(path.join(__dirname, 'public')));

// Directories setup
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const DATA_DIR = path.join(__dirname, '../data');
const USERS_FILE = path.join(__dirname, '../users.txt');
const LOG_FILE = path.join(__dirname, '../login_attempts.log');

if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        // Safe filename with original extension
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '');
        cb(null, `${name}_${Date.now()}${ext}`);
    }
});
const upload = multer({ storage });

// Helper to log attempts to the unified log file, matching C logic
function logAttempt(username, success) {
    try {
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
        const logMsg = `[${timestamp}] User '${username}' logged in ${success ? 'successfully' : 'failed login attempt'}.
`;
        fs.appendFileSync(LOG_FILE, logMsg, 'utf8');
    } catch (err) {
        console.error("Failed to write to login attempts log:", err);
    }
}

// Read users and return role string on success, null on failure
function getUserRole(username, password) {
    try {
        // Auto create users.txt with admin:admin123:admin if not exists
        if (!fs.existsSync(USERS_FILE)) {
            fs.writeFileSync(USERS_FILE, "admin:admin123:admin\n", 'utf8');
            console.log(`[System Info] Created default credentials file 'users.txt' (admin:admin123:admin).`);
        }

        const data = fs.readFileSync(USERS_FILE, 'utf8');
        const lines = data.split(/\r?\n/);

        for (let line of lines) {
            line = line.trim();
            if (line === "" || line.startsWith("#")) {
                continue;
            }

            // Accept formats: username:password:role  OR username:password

            // Accept : or , as delimiters for compatibility
            let parts = null;
            if (line.indexOf(':') !== -1) {
                parts = line.split(':');
            } else if (line.indexOf(',') !== -1) {
                parts = line.split(',');
            }

            if (parts && parts.length >= 2) {
                const fileUser = parts[0].trim();
                const filePass = parts[1].trim();
                const fileRole = (parts.length >= 3 && parts[2].trim() !== "") ? parts[2].trim() : (fileUser === 'admin' ? 'admin' : 'user');

                if (fileUser === username && filePass === password) {
                    return fileRole;
                }
            }
        }
    } catch (err) {
        console.error("Error checking credentials:", err);
    }
    return null;
}

// Locate file helper (looks in uploads/ or default data/)
function resolveFilePath(filename) {
    // Prevent path traversal
    const safeName = path.basename(filename);
    const uploadedPath = path.join(UPLOADS_DIR, safeName);
    const defaultPath = path.join(DATA_DIR, safeName);

    if (fs.existsSync(uploadedPath)) {
        return uploadedPath;
    }
    if (fs.existsSync(defaultPath)) {
        return defaultPath;
    }
    return null;
}

// ================= API ROUTES =================

// Auth Route
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
    }
    const role = checkCredentials(username.trim(), password.trim());
    const success = role !== null;
    logAttempt(username, success);

    if (success) {
        const token = Buffer.from(`${username.trim()}:${role}:${Date.now()}`).toString('base64');
        return res.json({ 
            success: true, 
            message: "Login successful", 
            user: { username: username.trim(), role },
            token // Simple mock token containing role
        });
    } else {
        return res.status(401).json({ error: "Access Denied. Incorrect username or password." });
    }
});

// Helper: extract role from token and validate against users.txt.
function getRoleFromToken(token) {
    if (!token) return null;
    try {
        const decoded = Buffer.from(token, 'base64').toString('utf8');
        // Expect format username:role:timestamp
        const parts = decoded.split(':');
        if (parts.length < 2) return null;
        const username = parts[0];
        const role = parts[1];

        // Validate that this username still exists with the same role in users.txt
        if (!fs.existsSync(USERS_FILE)) return null;
        const data = fs.readFileSync(USERS_FILE, 'utf8');
        const lines = data.split(/\r?\n/);
        for (let line of lines) {
            line = line.trim();
            if (line === "" || line.startsWith('#')) continue;
            let partsLine = null;
            if (line.indexOf(':') !== -1) partsLine = line.split(':');
            else if (line.indexOf(',') !== -1) partsLine = line.split(',');
            if (partsLine && partsLine.length >= 2) {
                const fileUser = partsLine[0].trim();
                const fileRole = (partsLine.length >= 3 && partsLine[2].trim() !== "") ? partsLine[2].trim() : (fileUser === 'admin' ? 'admin' : 'user');
                if (fileUser === username && fileRole === role) return role;
            }
        }
    } catch (err) {
        return null;
    }
    return null;
}

// Middleware to require admin role
function requireAdmin(req, res, next) {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (!authHeader) return res.status(401).json({ error: 'Missing Authorization header' });
    const parts = authHeader.split(' ');
    const token = parts.length === 2 ? parts[1] : parts[0];
    const role = getRoleFromToken(token);
    if (role === 'admin') return next();
    return res.status(403).json({ error: 'Forbidden: admin role required' });
}

// List CSV Files Route
app.get('/api/files', (req, res) => {
    try {
        const fileList = [];

        // Check data directory (default)
        if (fs.existsSync(DATA_DIR)) {
            const defaultFiles = fs.readdirSync(DATA_DIR);
            for (const file of defaultFiles) {
                if (file.toLowerCase().endsWith('.csv')) {
                    const stats = fs.statSync(path.join(DATA_DIR, file));
                    fileList.push({
                        name: file,
                        source: 'default',
                        size: stats.size,
                        modified: stats.mtime
                    });
                }
            }
        }

        // Check uploads directory
        const uploadedFiles = fs.readdirSync(UPLOADS_DIR);
        for (const file of uploadedFiles) {
            if (file.toLowerCase().endsWith('.csv')) {
                const stats = fs.statSync(path.join(UPLOADS_DIR, file));
                fileList.push({
                    name: file,
                    source: 'uploaded',
                    size: stats.size,
                    modified: stats.mtime
                });
            }
        }

        // Sort: default files first, then newest uploads
        fileList.sort((a, b) => {
            if (a.source !== b.source) {
                return a.source === 'default' ? -1 : 1;
            }
            return new Date(b.modified) - new Date(a.modified);
        });

        res.json({ files: fileList });
    } catch (err) {
        res.status(500).json({ error: "Failed to list CSV files" });
    }
});

// Upload CSV Route (admin only)
app.post('/api/files/upload', requireAdmin, upload.single('csv'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded or invalid parameter" });
    }

    if (!req.file.originalname.toLowerCase().endsWith('.csv')) {
        // Clean up invalid uploaded file
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: "Only CSV files are allowed" });
    }

    res.json({
        success: true,
        message: "CSV file uploaded successfully",
        file: {
            name: req.file.filename,
            originalName: req.file.originalname,
            size: req.file.size
        }
    });
});

// Delete CSV Route (admin only)
app.delete('/api/files/:filename', requireAdmin, (req, res) => {
    const filename = req.params.filename;
    const safeName = path.basename(filename);
    const uploadedPath = path.join(UPLOADS_DIR, safeName);

    if (fs.existsSync(uploadedPath)) {
        try {
            fs.unlinkSync(uploadedPath);
            return res.json({ success: true, message: `Deleted ${filename}` });
        } catch (err) {
            return res.status(500).json({ error: "Failed to delete file" });
        }
    }
    
    return res.status(404).json({ error: "File not found or cannot be deleted (default files are read-only)" });
});

// Get CSV File Summary Route
app.get('/api/files/:filename/summary', (req, res) => {
    const filePath = resolveFilePath(req.params.filename);
    if (!filePath) {
        return res.status(404).json({ error: "CSV File not found" });
    }

    const df = parseCSV(filePath);
    if (!df) {
        return res.status(400).json({ error: "Failed to parse CSV file. Ensure it is a valid CSV format." });
    }

    res.json({
        filename: req.params.filename,
        rowCount: df.rowCount,
        colCount: df.colCount,
        headers: df.headers,
        isNumeric: df.isNumeric,
        columns: df.headers.map((h, i) => ({
            name: h,
            type: df.isNumeric[i] ? "Numeric" : "String"
        }))
    });
});

// Get CSV Data (Paging) Route
app.get('/api/files/:filename/data', (req, res) => {
    const filePath = resolveFilePath(req.params.filename);
    if (!filePath) {
        return res.status(404).json({ error: "CSV File not found" });
    }

    const df = parseCSV(filePath);
    if (!df) {
        return res.status(400).json({ error: "Failed to parse CSV file" });
    }

    let limit = parseInt(req.query.limit);
    let offset = parseInt(req.query.offset) || 0;

    if (isNaN(limit) || limit < 0) {
        limit = df.rowCount; // return all
    }

    const endIdx = Math.min(offset + limit, df.rowCount);
    const slicedData = [];

    for (let r = offset; r < endIdx; r++) {
        const rowObj = {};
        for (let c = 0; c < df.colCount; c++) {
            rowObj[df.headers[c]] = df.data[r][c];
        }
        slicedData.push(rowObj);
    }

    res.json({
        filename: req.params.filename,
        totalRows: df.rowCount,
        limit,
        offset,
        headers: df.headers,
        data: slicedData
    });
});

// Get Column Statistics Route
app.get('/api/files/:filename/stats/:column', (req, res) => {
    const filePath = resolveFilePath(req.params.filename);
    const column = req.params.column;

    if (!filePath) {
        return res.status(404).json({ error: "CSV File not found" });
    }

    const df = parseCSV(filePath);
    if (!df) {
        return res.status(400).json({ error: "Failed to parse CSV file" });
    }

    const stats = calculateColumnStats(df, column);
    res.json(stats);
});

// Filter Data Route
app.post('/api/files/:filename/filter', (req, res) => {
    const filePath = resolveFilePath(req.params.filename);
    const { column, operator, value } = req.body;

    if (!filePath) {
        return res.status(404).json({ error: "CSV File not found" });
    }
    if (!column || !operator || value === undefined) {
        return res.status(400).json({ error: "Parameters 'column', 'operator', and 'value' are required" });
    }

    const df = parseCSV(filePath);
    if (!df) {
        return res.status(400).json({ error: "Failed to parse CSV file" });
    }

    try {
        const filtered = filterDataFrame(df, column, operator, value.toString());
        res.json({
            filename: req.params.filename,
            column,
            operator,
            value,
            matchCount: filtered.length,
            data: filtered
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// All other requests serve the index.html page
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.listen(PORT, () => {
    console.log(`=================================================`);
    console.log(`  FOOTBALL INC. BACKEND SERVICES STARTED`);
    console.log(`  Access dashboard at: http://localhost:${PORT}`);
    console.log(`=================================================`);
});
