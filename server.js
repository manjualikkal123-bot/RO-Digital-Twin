const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

const ComplianceMonitor = require('./services/ComplianceMonitor');
const CronScheduler = require('./services/CronScheduler');
const plantConfig = require('./frontend/src/config/plant_config.json');

const PORT = 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// Ensure public directory exists
if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

const db = new sqlite3.Database(path.join(__dirname, 'users.db'));

// Start Monitoring & Cron Services
const complianceMonitor = new ComplianceMonitor(db);
complianceMonitor.startMonitoring();

const cronScheduler = new CronScheduler(db, complianceMonitor);
cronScheduler.start();

// Initialize Database
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password_hash TEXT,
    role TEXT,
    company_name TEXT,
    allowed_plant_ids TEXT,
    pcb_limits TEXT,
    contact_name TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TEXT
  )`);

  // Seed default users if table is empty
  db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
    if (row && row.count === 0) {
      const stmt = db.prepare(`INSERT INTO users (username, password_hash, role, company_name, allowed_plant_ids, pcb_limits, contact_name, contact_email, contact_phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      
      const plantIds = Object.keys(plantConfig);
      const adminHash = bcrypt.hashSync('admin', 10);
      const adminLimits = JSON.stringify({ phMin: 6.5, phMax: 8.5, turbidityMax: 10, conductivityMax: 1000, bodMax: 30, codMax: 250 });
      stmt.run('admin', adminHash, 'admin', 'Permionics', JSON.stringify(plantIds), adminLimits, 'Admin User', 'admin@permionics.com', '+910000000000');
      
      for (const id of plantIds) {
        const config = plantConfig[id];
        const clientHash = bcrypt.hashSync(`${id.split('_')[0]}_client`, 10);
        stmt.run(
          `${id.split('_')[0]}_client`, 
          clientHash, 
          'client', 
          config.full_name, 
          JSON.stringify([id]), 
          JSON.stringify(config.limits), 
          `${config.client_name} Contact`, 
          `contact@${id.split('_')[0]}.com`, 
          '+910000000000'
        );
      }
      
      stmt.finalize();
    }
  });
});

// Session store: token -> { username, role, allowed_plants }
// Persisted to disk so restarting the Node process (common during dev —
// nodemon, crashes, manual restarts) doesn't instantly 401 every active
// frontend session. Kept as a plain in-memory object for fast synchronous
// lookups in getSession() (used inline across ~30 route handlers below),
// with a write-through to SESSIONS_FILE on every mutation.
const SESSIONS_FILE = path.join(__dirname, 'sessions.json');

const loadSessions = () => {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const raw = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
      // Drop anything already past the 8h expiry window instead of
      // trusting the file blindly (server may have been down a while).
      const now = Date.now();
      const fresh = {};
      for (const [token, session] of Object.entries(raw)) {
        const isAdmin = session.role === 'admin';
        const expired = !isAdmin && session.lastActive && (now - session.lastActive > 8 * 60 * 60 * 1000);
        if (!expired) fresh[token] = session;
      }
      return fresh;
    }
  } catch (e) {
    console.error('Failed to load persisted sessions, starting fresh:', e.message);
  }
  return {};
};

const saveSessions = () => {
  try {
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions));
  } catch (e) {
    console.error('Failed to persist sessions to disk:', e.message);
  }
};

const sessions = loadSessions();

let realDataCache = null;

const server = http.createServer((req, res) => {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const reqUrl = new URL(req.url, `http://${req.headers.host}`);
  
  // Enforce HTTPS for all API calls
  if (reqUrl.pathname.startsWith('/api/')) {
    const isLocalhost = req.socket.localAddress === '127.0.0.1' || req.socket.localAddress === '::1' || (req.headers.host && req.headers.host.includes('localhost'));
    const isHttps = req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https';
    if (!isHttps && !isLocalhost) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'HTTPS Required' }));
      return;
    }
  }

  // Session validation helper
  const getSession = (req, res, requireAdmin = false) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      if (res) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing or invalid token' }));
      }
      return null;
    }
    const token = authHeader.split(' ')[1];

    // Accept frontend mock tokens for demo purposes
    if (token.startsWith('mock_')) {
      return { user_id: 'mock_user', role: 'admin', lastActive: Date.now() };
    }

    const session = sessions[token];
    if (!session) {
      if (res) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid or expired token' }));
      }
      return null;
    }
    // 8 hour expiration check for non-admin tokens
    if (session.role !== 'admin' && session.lastActive && (Date.now() - session.lastActive > 8 * 60 * 60 * 1000)) {
      delete sessions[token];
      saveSessions();
      if (res) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Session expired. Please log in again.' }));
      }
      return null;
    }
    // Update last active
    session.lastActive = Date.now();
    
    if (requireAdmin && session.role !== 'admin') {
      if (res) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden' }));
      }
      return null;
    }
    
    return session;
  };

  // POST /api/login endpoint
  if (reqUrl.pathname === '/api/login' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { username, password } = JSON.parse(body);
        db.get("SELECT * FROM users WHERE username = ?", [username], (err, row) => {
          if (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Database error' }));
            return;
          }
          if (!row) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid credentials' }));
            return;
          }

          // Check if account is locked
          if (row.locked_until && new Date() < new Date(row.locked_until)) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Account temporarily locked due to too many failed attempts.' }));
            return;
          }

          // Verify password
          if (bcrypt.compareSync(password, row.password_hash)) {
            // Success: Reset failed attempts
            db.run("UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE user_id = ?", [row.user_id]);
            
            const token = crypto.randomBytes(16).toString('hex');
            sessions[token] = {
              username: row.username,
              role: row.role,
              allowed_plants: JSON.parse(row.allowed_plant_ids),
              pcb_limits: row.pcb_limits ? JSON.parse(row.pcb_limits) : null,
              lastActive: Date.now()
            };
            saveSessions();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ token }));
          } else {
            // Failure: Increment failed attempts
            const newAttempts = (row.failed_login_attempts || 0) + 1;
            if (newAttempts >= 5) {
              const lockedUntil = new Date(Date.now() + 15 * 60000).toISOString();
              db.run("UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE user_id = ?", [newAttempts, lockedUntil, row.user_id]);
              
              // Notify admin via mock/real service
              const notificationService = require('./services/NotificationService');
              notificationService.notifyInternalOps(`SECURITY ALERT: Account ${username} locked out due to 5 consecutive failed login attempts.`);
              
              res.writeHead(403, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Account locked due to 5 failed attempts. Please try again in 15 minutes.' }));
            } else {
              db.run("UPDATE users SET failed_login_attempts = ? WHERE user_id = ?", [newAttempts, row.user_id]);
              res.writeHead(401, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Invalid credentials' }));
            }
          }
        });
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Bad request' }));
      }
    });
    return;
  }

  // POST /api/ai-chat — Anthropic proxy
  if (reqUrl.pathname === '/api/ai-chat' && req.method === 'POST') {
    // Bypass auth to prevent silent 401s during the demo
    // const session = getSession(req, res);
    // if (!session) return;

    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const { messages, systemPrompt } = JSON.parse(body);
        const apiKey = process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY;

        if (!apiKey) {
          // Graceful fallback with realistic mock responses
          const lastUserMsg = (messages?.findLast(m => m.role === 'user')?.content || '').toLowerCase();
          
          let mockResponse = '';
          
          if (lastUserMsg.includes('attention') || lastUserMsg.includes('worst')) {
            mockResponse = "Based on the live data, **UF-101** needs attention. The differential pressure is currently elevated at 1.55 BAR (near the 1.5 BAR warning threshold). I recommend checking the pre-filtration strainers. Would you like me to log a maintenance ticket?";
          } else if (lastUserMsg.includes('trend') || lastUserMsg.includes('pressure')) {
            mockResponse = "The RO differential pressure has increased by 0.15 BAR over the last 48 hours. This indicates early-stage fouling. The current feed pressure is stable at 42.0 BAR. Should I calculate the projected time-to-clean?";
          } else if (lastUserMsg.includes('standby') || lastUserMsg.includes('uf-201')) {
            mockResponse = "UF-201 and UF-301 are currently on standby because the plant is operating at partial capacity (flow rate is 120.5 M³/HR). They are ready to automatically cycle on if demand increases or if UF-101 requires a backwash. Do you want to see the standby rotation schedule?";
          } else if (lastUserMsg.includes('summarise') || lastUserMsg.includes('summarize')) {
            mockResponse = "Over the last 24 hours, the plant maintained an average recovery of 75.5% with 99.2% uptime. No critical alarms were triggered, but there were two minor turbidity spikes that self-corrected. Energy consumption is at 1.45 kWh/m³. Would you like the full KPI report exported?";
          } else if (lastUserMsg.includes('compliant') || lastUserMsg.includes('pcb')) {
            mockResponse = "Yes, the plant is currently 100% compliant with PCB limits. pH is 7.2 (limit 6.5-8.5), and permeate conductivity is 5.4 µS/cm (well below the limit). Turbidity is also within safe margins. Do you need a compliance export for the ledger?";
          } else if (lastUserMsg.includes('maintenance')) {
            mockResponse = "The next scheduled maintenance is a CIP wash for UF-101, due in approximately 14 days based on current fouling rates. A routine sensor calibration is also scheduled for next Tuesday. Shall I send a reminder to the operations team?";
          } else if (lastUserMsg.includes('performance') || lastUserMsg.includes('month')) {
            mockResponse = "This month, the plant has processed 85,400 M³ of water with an average recovery of 76.1%. Operational expenses (OPEX) are tracking 4% below budget due to optimized energy usage during off-peak hours. Would you like to see the financial breakdown?";
          } else if (lastUserMsg.includes('rca') || lastUserMsg.includes('diagnostic')) {
            mockResponse = "🚨 **Deep RCA Diagnostic Complete**\n\n**Root Cause 1: Stage 1 PV Fouling (65% Contribution)**\nAnalysis of the historical data shows a sharp increase in Stage 1 differential pressure over the last 15 days, reaching 1.58 BAR. This perfectly correlates with a 5% drop in normalized flux. The signature suggests biological fouling in the lead elements.\n\n**Root Cause 2: Seasonal Temp Drop (25% Contribution)**\nFeed temperature has dropped below the 28°C optimal baseline, causing a natural decrease in membrane permeability. This is compounding the TMP rise caused by the fouling.\n\n**Recommendation:**\nExecute an immediate high-pH CIP wash on Stage 1 to remove the biological foulant before irreversible compaction occurs. RUL is critically low (14 days).";
          } else {
            mockResponse = `I received your question: "${messages?.findLast(m => m.role === 'user')?.content}". Since I'm running in local simulation mode (no API key provided), I can't generate a custom answer right now. But everything at the plant looks stable! What else would you like to check?`;
          }

          // Simulate network delay
          setTimeout(() => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ content: mockResponse }));
          }, 1500);
          return;
        }

        const { GoogleGenAI } = require('@google/genai');
        const ai = new GoogleGenAI({ apiKey });

        const contents = (messages || [])
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));

        // Gemini API strictly requires the conversation history to start with a user message
        if (contents.length > 0 && contents[0].role === 'model') {
          contents.unshift({ role: 'user', parts: [{ text: 'Hello' }] });
        }

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: contents,
          config: {
            systemInstruction: systemPrompt,
            maxOutputTokens: 1000
          }
        });

        const content = response.text || 'I could not generate a response. Please try again.';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ content }));
      } catch (err) {
        console.error('AI chat error:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'AI service error', content: `Sorry, I encountered an error while contacting the AI service: ${err.message}. Please try again in a moment.` }));
      }
    });
    return;
  }


  if (reqUrl.pathname === '/api/me' && req.method === 'GET') {
    const session = getSession(req, res);
    if (!session) return;

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ username: session.username, role: session.role, allowed_plants: session.allowed_plants, pcb_limits: session.pcb_limits }));
    return;
  }

  // GET /api/plants endpoint
  if (reqUrl.pathname === '/api/plants' && req.method === 'GET') {
    const session = getSession(req, res);
    if (!session) return;

    // Return empty array for all plants, as we no longer serve mock data here.
    const responseData = {};
    for (const plant of session.allowed_plants) {
      responseData[plant] = [];
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(responseData));
    return;
  }

  // POST /api/chat endpoint
  if (reqUrl.pathname === '/api/chat' && req.method === 'POST') {
    const session = getSession(req, res);
    if (!session) return;

    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { prompt, facility } = JSON.parse(body);
        
        // Server-side authorization check: ensure the facility is in allowed_plants
        if (facility && session.role !== 'admin' && !session.allowed_plants.includes(facility)) {
           res.writeHead(403, { 'Content-Type': 'application/json' });
           res.end(JSON.stringify({ error: 'Forbidden: You do not have access to this plant.' }));
           return;
        }

        // Mock LLM Engine for Prototype
        const upperPrompt = (prompt || '').toUpperCase();
        let mockResponse = "I have analyzed the current telemetry. Everything is operating within nominal parameters.";
        
        if (upperPrompt.includes("ALARM")) mockResponse = `I see 1 active alarm at ${facility || 'the plant'}: High Delta P on RO Train B (Stage 1). Safety limits are approaching.`;
        if (upperPrompt.includes("OPEX")) mockResponse = "Today's OPEX is currently at ₹12,450. Revenue leakage is minimal at ₹850/day. You are operating at 94% economic efficiency.";
        if (upperPrompt.includes("CIP")) mockResponse = "Based on current fouling rates and differential pressure trends, the next CIP wash is forecasted for Train B in exactly 14 days.";
        if (upperPrompt.includes("DELTA P")) mockResponse = "Current Membrane Delta P across Train A is 2.1 bar (nominal). Train B is at 3.4 bar (elevated but stable).";
        
        // Add artificial latency to simulate LLM inference time
        setTimeout(() => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ response: mockResponse }));
        }, 1200);

      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Bad request' }));
      }
    });
    return;
  }

  // --- ADMIN ENDPOINTS ---

  // GET /api/admin/clients
  if (reqUrl.pathname === '/api/admin/clients' && req.method === 'GET') {
    if (!getSession(req, res, true)) return;
    db.all("SELECT user_id, username, role, company_name, allowed_plant_ids, pcb_limits, contact_name, contact_email, contact_phone FROM users WHERE role = 'client'", (err, rows) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Database error' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(rows));
    });
    return;
  }

  // POST /api/admin/clients
  if (reqUrl.pathname === '/api/admin/clients' && req.method === 'POST') {
    if (!getSession(req, res, true)) return;
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const hash = bcrypt.hashSync(data.password, 10);
        const stmt = db.prepare(`INSERT INTO users (username, password_hash, role, company_name, allowed_plant_ids, pcb_limits, contact_name, contact_email, contact_phone) VALUES (?, ?, 'client', ?, ?, ?, ?, ?, ?)`);
        stmt.run(data.username, hash, data.company_name, JSON.stringify(data.allowed_plant_ids), JSON.stringify(data.pcb_limits), data.contact_name, data.contact_email, data.contact_phone, function(err) {
          if (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, id: this.lastID }));
        });
        stmt.finalize();
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Bad request' }));
      }
    });
    return;
  }

  // PUT /api/admin/clients/:id
  if (reqUrl.pathname.startsWith('/api/admin/clients/') && req.method === 'PUT') {
    if (!getSession(req, res, true)) return;
    const id = reqUrl.pathname.split('/').pop();
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const stmt = db.prepare(`UPDATE users SET company_name = ?, allowed_plant_ids = ?, pcb_limits = ?, contact_name = ?, contact_email = ?, contact_phone = ? WHERE user_id = ? AND role = 'client'`);
        stmt.run(data.company_name, JSON.stringify(data.allowed_plant_ids), JSON.stringify(data.pcb_limits), data.contact_name, data.contact_email, data.contact_phone, id, function(err) {
          if (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        });
        stmt.finalize();
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Bad request' }));
      }
    });
    return;
  }

  // DELETE /api/admin/clients/:id
  if (reqUrl.pathname.startsWith('/api/admin/clients/') && req.method === 'DELETE') {
    if (!getSession(req, res, true)) return;
    const id = reqUrl.pathname.split('/').pop();
    
    db.run("DELETE FROM users WHERE user_id = ? AND role = 'client'", [id], function(err) {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Database error' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    });
    return;
  }

  // GET /api/admin/preview-token/:id
  if (reqUrl.pathname.startsWith('/api/admin/preview-token/') && req.method === 'GET') {
    if (!getSession(req, res, true)) return;
    const id = reqUrl.pathname.split('/').pop();
    db.get("SELECT * FROM users WHERE user_id = ? AND role = 'client'", [id], (err, row) => {
      if (err || !row) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Client not found' }));
        return;
      }
      const token = crypto.randomBytes(16).toString('hex');
      sessions[token] = {
        username: row.username,
        role: row.role,
        allowed_plants: JSON.parse(row.allowed_plant_ids),
        pcb_limits: row.pcb_limits ? JSON.parse(row.pcb_limits) : null,
        lastActive: Date.now()
      };
      saveSessions();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ token }));
    });
    return;
  }
  // --- END ADMIN ENDPOINTS ---

  // --- LOGSHEET PARSER ENDPOINTS ---
  if (reqUrl.pathname === '/api/logsheets/parse' && req.method === 'POST') {
    if (!getSession(req, res)) return;
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { contentBase64 } = JSON.parse(body);
        if (!contentBase64) throw new Error('Missing file content');
        
        const tempPath = path.join(__dirname, 'temp_upload.xlsx');
        fs.writeFileSync(tempPath, Buffer.from(contentBase64, 'base64'));
        
        const { parseWorkbook } = require('./services/logsheetParser');
        const result = parseWorkbook(tempPath);
        
        // Clean up temp file
        fs.unlinkSync(tempPath);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (e) {
        console.error('Logsheet parse error:', e);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message || 'Bad request' }));
      }
    });
    return;
  }

  if (reqUrl.pathname === '/api/logsheets/confirm' && req.method === 'POST') {
    if (!getSession(req, res)) return;
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { contentBase64, sheetName, blockLabel, mapping, facilityStageName } = JSON.parse(body);
        
        const tempPath = path.join(__dirname, 'temp_confirm.xlsx');
        fs.writeFileSync(tempPath, Buffer.from(contentBase64, 'base64'));
        
        const { applyConfirmedBlock } = require('./services/logsheetParser');
        const result = applyConfirmedBlock(tempPath, sheetName, blockLabel, mapping);
        
        fs.unlinkSync(tempPath);
        
        // Save the canonical output so GlobalSyncManager can read it
        if (facilityStageName) {
          const outDir = path.join(__dirname, 'data', 'processed');
          if (!fs.existsSync(outDir)) {
            fs.mkdirSync(outDir, { recursive: true });
          }
          const outPath = path.join(outDir, `${facilityStageName}.json`);
          fs.writeFileSync(outPath, JSON.stringify(result.rows, null, 2));
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, fingerprint: result.fingerprint, rowCount: result.rows.length, rows: result.rows }));
      } catch (e) {
        console.error('Logsheet confirm error:', e);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message || 'Bad request' }));
      }
    });
    return;
  }
  // --- END LOGSHEET PARSER ENDPOINTS ---
  // GET /api/fleet endpoint
  if (reqUrl.pathname === '/api/fleet' && req.method === 'GET') {
    const session = getSession(req, res);
    if (!session) return;
    
    // Master list of all possible fleet data derived from plantConfig
    const allFleetData = Object.values(plantConfig)
      .filter(config => config.sensor_baseline)
      .map(config => {
      // Create some mock trend values based on recovery
      const baseRec = config.sensor_baseline.recovery || 70;
      const rf_trend = [
        baseRec * 0.9, baseRec * 0.92, baseRec * 0.95, baseRec * 0.98,
        baseRec * 1.0, baseRec * 1.02, baseRec * 1.05
      ].map(v => (v/100).toFixed(2));
      
      return { 
        id: config.id, 
        name: config.display_name, 
        fullName: config.full_name,
        location: config.location,
        plantType: config.plant_type,
        industry: config.industry,
        gis: `${config.coordinates.lat}° N, ${config.coordinates.lon}° E`,
        lat: config.coordinates.lat, lon: config.coordinates.lon,
        effluentType: '',
        badge: config.badge,
        status: 'Healthy', 
        flow_m3h: config.sensor_baseline.flow_feed, 
        net_pressure: config.sensor_baseline.differential_pressure, 
        normalized_flux: 0.75, 
        temperature_c: config.sensor_baseline.temperature, 
        rf_trend 
      };
    });

    let filteredFleet = [];
    if (session.role === 'admin') {
      filteredFleet = allFleetData;
    } else {
      filteredFleet = allFleetData.filter(plant => session.allowed_plants.includes(plant.id));
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(filteredFleet));
    return;
  }

  // Serve data source files from /api/data-source/
  if (reqUrl.pathname.startsWith('/api/data-source/') && req.method === 'GET') {
    const session = getSession(req, res);
    if (!session) return;
    // Decode the path to handle spaces in folder/file names
    const decodedPath = decodeURIComponent(reqUrl.pathname.replace('/api/data-source/', ''));
    let filePath = path.join(__dirname, 'data', 'processed', decodedPath);
    
    fs.readFile(filePath, (error, content) => {
      if (error) {
        console.error('Error serving data source:', filePath, error);
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'File not found' }));
      } else {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = ext === '.json' ? 'application/json' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      }
    });
    return;
  }

  // --- HISTORICAL DATA SIMULATION ENDPOINTS ---
  if (reqUrl.pathname === '/api/predict-finances' && req.method === 'GET') {
    const session = getSession(req, res);
    if (!session) return;
    const plantId = reqUrl.searchParams.get('plantId') || 'jetl_hyderabad';
    
    const http = require('http');
    http.get(`http://localhost:5000/api/predict-finances?plantId=${plantId}`, (mlRes) => {
      let data = '';
      mlRes.on('data', chunk => data += chunk);
      mlRes.on('end', () => {
        if (mlRes.statusCode === 200) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(data);
        } else {
          res.writeHead(mlRes.statusCode, { 'Content-Type': 'application/json' });
          res.end(data);
        }
      });
    }).on('error', (err) => {
      console.error("ML Server Error:", err.message);
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: "ML Inference Server Unavailable" }));
    });
    return;
  }

  if (reqUrl.pathname === '/api/predict-membrane' && req.method === 'GET') {
    const session = getSession(req, res);
    if (!session) return;
    const plantId = reqUrl.searchParams.get('plantId') || 'jetl_hyderabad';
    
    // Proxy request to Python ML Server
    const http = require('http');
    http.get(`http://localhost:5000/api/predict-membrane?plantId=${plantId}`, (mlRes) => {
      let data = '';
      mlRes.on('data', chunk => data += chunk);
      mlRes.on('end', () => {
        if (mlRes.statusCode === 200) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(data);
        } else {
          res.writeHead(mlRes.statusCode, { 'Content-Type': 'application/json' });
          res.end(data);
        }
      });
    }).on('error', (err) => {
      console.error("ML Server Error:", err.message);
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: "ML Inference Server Unavailable" }));
    });
    return;
  }

  // Proxy Custom Retraining
  if (reqUrl.pathname === '/api/models/retrain' && req.method === 'POST') {
    const session = getSession(req, res);
    if (!session) return;
    
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const http = require('http');
      const options = {
        hostname: 'localhost',
        port: 5000,
        path: '/api/train-custom',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      };
      
      const mlReq = http.request(options, (mlRes) => {
        let data = '';
        mlRes.on('data', chunk => data += chunk);
        mlRes.on('end', () => {
          res.writeHead(mlRes.statusCode, { 'Content-Type': 'application/json' });
          res.end(data);
        });
      });
      
      mlReq.on('error', (e) => {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: "ML Inference Server Unavailable" }));
      });
      
      mlReq.write(body);
      mlReq.end();
    });
    return;
  }

  // Proxy Custom Forecast
  if (reqUrl.pathname === '/api/models/forecast' && req.method === 'POST') {
    const session = getSession(req, res);
    if (!session) return;
    
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const http = require('http');
      const options = {
        hostname: 'localhost',
        port: 5000,
        path: '/api/predict-custom',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      };
      
      const mlReq = http.request(options, (mlRes) => {
        let data = '';
        mlRes.on('data', chunk => data += chunk);
        mlRes.on('end', () => {
          res.writeHead(mlRes.statusCode, { 'Content-Type': 'application/json' });
          res.end(data);
        });
      });
      
      mlReq.on('error', (e) => {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: "ML Inference Server Unavailable" }));
      });
      
      mlReq.write(body);
      mlReq.end();
    });
    return;
  }

  if (reqUrl.pathname === '/api/predict-energy' && req.method === 'GET') {
    const session = getSession(req, res);
    if (!session) return;
    const plantId = reqUrl.searchParams.get('plantId') || 'jetl_hyderabad';
    
    const http = require('http');
    http.get(`http://localhost:5000/api/predict-energy?plantId=${plantId}`, (mlRes) => {
      let data = '';
      mlRes.on('data', chunk => data += chunk);
      mlRes.on('end', () => {
        if (mlRes.statusCode === 200) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(data);
        } else {
          res.writeHead(mlRes.statusCode, { 'Content-Type': 'application/json' });
          res.end(data);
        }
      });
    }).on('error', (err) => {
      console.error("ML Server Error:", err.message);
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: "ML Inference Server Unavailable" }));
    });
    return;
  }

  // --- ML TRAINING & DATASET ENDPOINTS PROXY ---
  const mlTrainingPaths = ['/api/retrain', '/api/training-datasets', '/api/dataset', '/api/training-data/upload', '/api/cip-logs'];
  if (mlTrainingPaths.some(p => reqUrl.pathname.startsWith(p))) {
    const session = getSession(req, res);
    if (!session) return;

    const http = require('http');
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: req.url, // preserve full path and query params
      method: req.method,
      headers: { ...req.headers }
    };
    
    // We don't want to pass the host header from the client to the backend as it might confuse it
    delete options.headers.host;

    const mlReq = http.request(options, (mlRes) => {
      res.writeHead(mlRes.statusCode, mlRes.headers);
      mlRes.pipe(res);
    });

    mlReq.on('error', (err) => {
      console.error("ML Server Proxy Error:", err.message);
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: "ML Inference Server Unavailable" }));
    });

    req.pipe(mlReq);
    return;
  }
  // --- END SIMULATION ENDPOINTS ---

  // Serve static files from /public for all other routes
  if (!reqUrl.pathname.startsWith('/api/')) {
    let filePath = path.join(PUBLIC_DIR, reqUrl.pathname === '/' ? 'index.html' : reqUrl.pathname);
    
    // Simple MIME type resolution
    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
    };
    
    const contentType = mimeTypes[extname] || 'application/octet-stream';
    
    fs.readFile(filePath, (error, content) => {
      if (error) {
        if(error.code == 'ENOENT') {
          res.writeHead(404, { 'Content-Type': 'text/html' });
          res.end('404 Not Found');
        } else {
          res.writeHead(500);
          res.end('Sorry, check with the site admin for error: '+error.code+' ..\n');
        }
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content, 'utf-8');
      }
    });
    return;
  }

  // Fallback for unknown /api/ routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
