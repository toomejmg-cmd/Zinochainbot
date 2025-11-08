const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.ADMIN_DASHBOARD_PORT || 5000;

// Parse JSON bodies for POST/PUT requests
app.use(express.json());

// Manual API Proxy - Forward all /api requests to port 3001
app.all('/api/*', async (req, res) => {
  const apiUrl = `http://localhost:3001${req.originalUrl}`;
  
  const headers = {};
  if (req.headers.authorization) headers['Authorization'] = req.headers.authorization;
  if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];

  const options = {
    method: req.method,
    headers: headers
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    options.body = JSON.stringify(req.body);
  }

  try {
    const apiResponse = await fetch(apiUrl, options);
    const contentType = apiResponse.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      const data = await apiResponse.json();
      return res.status(apiResponse.status).json(data);
    }
    
    const text = await apiResponse.text();
    res.status(apiResponse.status).send(text);
  } catch (error) {
    console.error('[API Proxy Error]', error.message);
    res.status(500).json({ error: 'API connection failed' });
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
});
