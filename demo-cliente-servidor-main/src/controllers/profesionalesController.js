const pool = require('../config/db');

// Caché en memoria simple
let profesionalesCache = null;
let lastFetchTime = 0;
const CACHE_TTL = 10000; // 10 segundos de caché

const obtenerProfesionales = async (req, res) => {
  try {
    const ahora = Date.now();
    // Si tenemos caché válida, usarla
    if (profesionalesCache && (ahora - lastFetchTime < CACHE_TTL)) {
      return res.json(profesionalesCache);
    }

    // Si no hay caché o expiró, consultar la BD
    const resultado = await pool.query(
      'SELECT id, nombre, especialidad FROM profesionales ORDER BY nombre'
    );
    
    // Actualizar caché
    profesionalesCache = resultado.rows;
    lastFetchTime = ahora;

    res.json(profesionalesCache);
  } catch (error) {
    console.error('Error consultando profesionales:', error.message);
    res.status(500).json({ error: 'No se pudo consultar la base de datos' });
  }
};

module.exports = {
  obtenerProfesionales,
};
