const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Supabase exige conexión cifrada (SSL)
  max: 20, // Aumentar límite para soportar ráfagas de usuarios
  idleTimeoutMillis: 30000,
});

pool.on('error', (err, client) => {
  console.error('Error inesperado en un cliente inactivo de la base de datos', err);
});

module.exports = pool;
