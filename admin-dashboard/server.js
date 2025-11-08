const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.ADMIN_DASHBOARD_PORT || 5000;
const API_BASE_URL = 'http://localhost:3001';

app.use(express.json());

// API Proxy - Forward all /api/* requests to the Admin API on port 3001
app.use('/api', async (req, res) => {
  try {
    const url = `${API_BASE_URL}${req.originalUrl}`;
    
    const headers = {};
    
    // Copy important headers
    if (req.headers.authorization) headers.authorization = req.headers.authorization;
    if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'];

    const options = {
      method: req.method,
      headers: headers
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      options.body = JSON.stringify(req.body);
      headers['content-type'] = 'application/json';
    }

    const response = await fetch(url, options);
    
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      res.status(response.status).json(data);
    } else {
      const text = await response.text();
      res.status(response.status).send(text);
    }
  } catch (error) {
    console.error('API Proxy Error:', error);
    res.status(500).json({ error: 'Proxy error' });
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
