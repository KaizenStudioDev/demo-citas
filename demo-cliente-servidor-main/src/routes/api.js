const express = require('express');
const router = express.Router();
const profesionalesController = require('../controllers/profesionalesController');
const citasController = require('../controllers/citasController');

// Rutas de salud
router.get('/salud', (req, res) => {
  res.json({ estado: 'ok', servidor: 'activo', hora: new Date().toISOString() });
});

// Rutas de profesionales
router.get('/profesionales', profesionalesController.obtenerProfesionales);

// Rutas de citas
router.get('/citas', citasController.obtenerCitas);
router.post('/citas', citasController.crearCita);

module.exports = router;
