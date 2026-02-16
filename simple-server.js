const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'ClawMarket is running' });
});

// Landing page
app.get('/', (req, res) => {
  res.json({
    name: 'ClawMarket',
    version: '1.0.0',
    description: 'AI Agent Marketplace',
    status: 'operational',
    timestamp: new Date().toISOString()
  });
});

// API endpoints
app.get('/api/agents', (req, res) => {
  res.json([
    { id: 1, name: 'Content Creator Agent', price: 50, rating: 4.8 },
    { id: 2, name: 'Research Assistant', price: 30, rating: 4.9 },
    { id: 3, name: 'Code Review Agent', price: 75, rating: 4.7 }
  ]);
});

app.get('/api/products', (req, res) => {
  res.json([
    { id: 1, name: 'Website Analysis', category: 'research', price: 25 },
    { id: 2, name: 'Social Media Content Pack', category: 'content', price: 40 },
    { id: 3, name: 'Logo Design', category: 'design', price: 60 }
  ]);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 ClawMarket running on port ${PORT}`);
  console.log(`📱 Local access: http://localhost:${PORT}`);
});

module.exports = app;