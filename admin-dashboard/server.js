const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = parseInt(process.env.PORT || '5000', 10);

// Get API URL from environment (Railway internal URL or localhost)
const API_URL = process.env.ADMIN_API_URL || 'http://localhost:3001';

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

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Main route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Catch-all route for SPA - must be last
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`📊 Admin Dashboard running on http://0.0.0.0:${PORT}`);
  console.log(`🔗 Access the dashboard in your browser`);
  console.log(`🔌 API URL: ${API_URL}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
});
