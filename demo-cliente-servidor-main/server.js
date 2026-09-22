// ============================================================================
// SERVIDOR (el "proveedor" del estilo Cliente-Servidor)
// ============================================================================
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const dbPool = require('./src/config/db');
const apiRoutes = require('./src/routes/api');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

// Rutas centralizadas bajo /api
app.use('/api', apiRoutes);

// --- Encender el servidor ---------------------------------------------------
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
  console.log(`Cliente web: http://localhost:${PORT}`);
});

// --- Graceful Shutdown ------------------------------------------------------
// Si Render reinicia o apaga el servidor, escuchamos estas señales para
// cerrar todo ordenadamente (especialmente el pool de conexiones de Postgres).
const gracefullyShutdown = () => {
  console.log('\nRecibida señal de apagado. Cerrando servidor HTTP...');
  server.close(async () => {
    console.log('Servidor HTTP cerrado.');
    try {
      console.log('Cerrando pool de base de datos...');
      await dbPool.end();
      console.log('Pool de base de datos cerrado. Saliendo...');
      process.exit(0);
    } catch (err) {
      console.error('Error cerrando el pool:', err);
      process.exit(1);
    }
  });
};

process.on('SIGTERM', gracefullyShutdown); // Enviada por Render y otros hosts
process.on('SIGINT', gracefullyShutdown);  // Enviada al presionar Ctrl+C en local
