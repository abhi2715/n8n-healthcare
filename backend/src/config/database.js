const { Pool } = require('pg');

const sslConfig = process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://healthcare:healthcare_dev_2024@localhost:5432/healthcare_platform',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: sslConfig,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

/**
 * Execute a query with automatic connection management
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.warn(`[DB] Slow query (${duration}ms):`, text.substring(0, 80));
    }
    return result;
  } catch (err) {
    console.error('[DB] Query error:', err.message, '\nQuery:', text.substring(0, 120));
    throw err;
  }
}

/**
 * Get a client for transactions
 */
async function getClient() {
  return pool.connect();
}

/**
 * Health check
 */
async function healthCheck() {
  try {
    await pool.query('SELECT 1');
    return { status: 'healthy', pool: { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount } };
  } catch (err) {
    return { status: 'unhealthy', error: err.message };
  }
}

module.exports = { query, getClient, healthCheck, pool };
