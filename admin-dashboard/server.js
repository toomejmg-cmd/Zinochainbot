const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = parseInt(process.env.PORT || '5000', 10);

// Get API URL from environment (Railway internal URL or localhost)
const API_URL = process.env.ADMIN_API_URL || 'http://127.0.0.1:3001';

// Resolve public directory path - handle both local and Railway environments
const publicDir = path.resolve(__dirname, 'public');

console.log('=== ADMIN DASHBOARD STARTUP ===');
console.log('Working Directory:', process.cwd());
console.log('Script Directory:', __dirname);
console.log('Public Directory:', publicDir);
console.log('ADMIN_API_URL:', API_URL);
console.log('PORT:', PORT);
console.log('================================');

// Parse JSON bodies for POST/PUT requests (only for non-multipart)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Manual API Proxy - Forward all /api requests to Admin API
app.all('/api/*', async (req, res) => {
  const apiUrl = `${API_URL}${req.originalUrl}`;
  
  // Forward all headers except host
  const headers = {};
  Object.keys(req.headers).forEach(key => {
    if (key.toLowerCase() !== 'host') {
      headers[key] = req.headers[key];
    }
  });

  const options = {
    method: req.method,
    headers: headers
  };

  // Handle request body for non-GET/HEAD requests
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const contentType = req.headers['content-type'] || '';
    
    // For JSON requests, stringify the body
    if (contentType.includes('application/json')) {
      options.body = JSON.stringify(req.body);
    } 
    // For form-data/multipart or other types, pass raw body
    else {
      // Use raw body if available, otherwise stringify
      options.body = req.body ? JSON.stringify(req.body) : undefined;
    }
  }

  try {
    console.log(`[Proxy] Forwarding ${req.method} ${req.originalUrl} to ${apiUrl}`);
    const apiResponse = await fetch(apiUrl, options);
    const responseContentType = apiResponse.headers.get('content-type');
    
    // Copy response headers
    apiResponse.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'content-encoding' && key.toLowerCase() !== 'transfer-encoding') {
        res.setHeader(key, value);
      }
    });
    
    // Handle JSON responses
    if (responseContentType && responseContentType.includes('application/json')) {
      const data = await apiResponse.json();
      return res.status(apiResponse.status).json(data);
    }
    
    // Handle other content types
    const text = await apiResponse.text();
    res.status(apiResponse.status).send(text);
  } catch (error) {
    console.error('[API Proxy Error]', `Failed to connect to ${apiUrl}:`, error.message);
    console.error('[API Proxy Error] Stack:', error.stack);
    res.status(500).json({ error: 'API connection failed', details: error.message, targetUrl: apiUrl });
  }
});

// Health check with environment diagnostics
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    apiUrl: API_URL,
    hasAdminApiUrl: !!process.env.ADMIN_API_URL,
    adminApiUrlValue: process.env.ADMIN_API_URL || 'NOT_SET',
    nodeEnv: process.env.NODE_ENV,
    publicDir: publicDir
  });
});

// Serve static files with cache control
app.use(express.static(publicDir, {
  setHeaders: (res, filePath) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

// Main route - serve index.html
app.get('/', (req, res) => {
  const indexPath = path.join(publicDir, 'index.html');
  console.log('[Routes] Serving index.html from:', indexPath);
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error('[Routes] Error sending index.html:', err);
      res.status(500).json({ error: 'Failed to load dashboard', details: err.message });
    }
  });
});

// Catch-all route for SPA - must be last (serves index.html for all other routes)
app.use((req, res) => {
  const indexPath = path.join(publicDir, 'index.html');
  console.log('[Routes] SPA fallback - serving index.html from:', indexPath);
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error('[Routes] Error in catch-all route:', err);
      res.status(500).json({ error: 'Failed to load dashboard', details: err.message });
    }
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(500).json({ error: 'Server error', message: err.message });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅ Admin Dashboard is RUNNING`);
  console.log(`📊 URL: http://0.0.0.0:${PORT}`);
  console.log(`🔌 API: ${API_URL}`);
  console.log(`📁 Serving from: ${publicDir}\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});
