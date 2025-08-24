// backend/routes/prestamoRoutes.js
const express = require('express');
const { crearPrestamo, devolverMaterial, obtenerPrestamos } = require('../controllers/prestamoController');
const { verificarToken, verificarRol } = require('../middleware/authMiddleware');
const router = express.Router();

router.get('/', verificarToken, obtenerPrestamos);
router.post('/', verificarToken, verificarRol([3]), crearPrestamo); // Solo almacén
router.put('/devolver/:id', verificarToken, verificarRol([3]), devolverMaterial); // Solo almacén

module.exports = router;