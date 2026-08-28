/**
 * Healthcare AI Platform — Backend API Server
 * 
 * DISCLAIMER: This is a PORTFOLIO/EDUCATIONAL project.
 * Uses synthetic data only. NOT HIPAA compliant.
 * Must NOT be connected to real patient information.
 */
const express = require('express');
const cors = require('cors');
const { healthCheck } = require('./config/database');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// ---- Middleware ----
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path !== '/api/health') {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} → ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// ---- Routes ----
app.use('/api/intake', require('./routes/intake'));
app.use('/api/patients', require('./routes/patients'));
app.use('/api/doctors', require('./routes/doctors'));
app.use('/api/specialties', require('./routes/specialties'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/triage', require('./routes/triage'));
app.use('/api/audit', require('./routes/audit'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/followups', require('./routes/followups'));
app.use('/api/feedback', require('./routes/feedback'));
app.use('/api/human-review', require('./routes/humanReview'));

// Health check
app.get('/api/health', async (req, res) => {
  const dbHealth = await healthCheck();
  res.json({
    status: 'ok',
    service: 'healthcare-ai-backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    database: dbHealth,
    environment: process.env.NODE_ENV || 'development',
    groq_configured: !!(process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'gsk_your_groq_api_key_here'),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` });
});

// Global error handler
app.use(errorHandler);

// ---- Start Server ----
app.listen(PORT, '0.0.0.0', () => {
  console.log('============================================================');
  console.log('  Healthcare AI Platform — Backend API');
  console.log('============================================================');
  console.log(`  Server:      http://0.0.0.0:${PORT}`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  Groq:        ${process.env.GROQ_API_KEY ? 'Configured' : '⚠️  Not configured'}`);
  console.log(`  Database:    ${process.env.DATABASE_URL ? 'Configured' : '⚠️  Not configured'}`);
  console.log('============================================================');
  console.log('  ⚠️  DEMO PROJECT — Synthetic data only. Not HIPAA compliant.');
  console.log('============================================================');
});

module.exports = app;
