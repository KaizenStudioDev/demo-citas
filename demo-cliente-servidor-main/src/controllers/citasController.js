const pool = require('../config/db');

// Caché en memoria para las citas
let citasCache = null;
let lastFetchTime = 0;
const CACHE_TTL = 3000; // 3 segundos de caché para citas para alta concurrencia

const obtenerCitas = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50; // Paginación por defecto: 50
    const offset = parseInt(req.query.offset) || 0;

    // Solo usamos caché si piden la primera página y con los valores por defecto
    const isDefaultQuery = limit === 50 && offset === 0;
    const ahora = Date.now();

    if (isDefaultQuery && citasCache && (ahora - lastFetchTime < CACHE_TTL)) {
      return res.json(citasCache);
    }

    const resultado = await pool.query(
      `SELECT c.id, c.paciente, c.fecha_hora, p.nombre AS profesional
         FROM citas c
         JOIN profesionales p ON p.id = c.profesional_id
        ORDER BY c.fecha_hora DESC
        LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    if (isDefaultQuery) {
      citasCache = resultado.rows;
      lastFetchTime = ahora;
    }

    res.json(resultado.rows);
  } catch (error) {
    console.error('Error consultando citas:', error.message);
    res.status(500).json({ error: 'No se pudo consultar la base de datos' });
  }
};

const crearCita = async (req, res) => {
  const { paciente, profesional_id, fecha_hora } = req.body;

  if (!paciente || !profesional_id || !fecha_hora) {
    return res.status(400).json({ error: 'Faltan datos: paciente, profesional y fecha son obligatorios' });
  }

  const fecha = new Date(fecha_hora);
  if (isNaN(fecha.getTime())) {
    return res.status(400).json({ error: 'Regla del servidor: la fecha enviada no es válida' });
  }
  if (fecha <= new Date()) {
    return res.status(400).json({ error: 'Regla del servidor: no se pueden reservar citas en el pasado' });
  }

  try {
    // Ya no necesitamos consultar si está ocupado aquí en JS porque delegamos a Postgres con UNIQUE.
    const insercion = await pool.query(
      `INSERT INTO citas (paciente, profesional_id, fecha_hora)
       VALUES ($1, $2, $3) RETURNING id`,
      [paciente, profesional_id, fecha_hora]
    );
    
    // Invalida el caché para que los clientes vean la cita de inmediato
    citasCache = null; 

    res.status(201).json({ mensaje: 'Cita creada', id: insercion.rows[0].id });
  } catch (error) {
    // Si Postgres lanza error de restricción UNIQUE (código 23505)
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Regla del servidor: ese profesional ya tiene una cita a esa hora' });
    }
    
    console.error('Error creando cita:', error.message);
    res.status(500).json({ error: 'No se pudo guardar en la base de datos' });
  }
};

module.exports = {
  obtenerCitas,
  crearCita,
};
