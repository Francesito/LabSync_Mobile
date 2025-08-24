// backend/routes/adeudoRoutes.js
const express = require('express');
const router  = express.Router();
const { getUsuarioAdeudos, ajustarAdeudo, getAllAdeudos } = require('../controllers/adeudoController');
const { verificarToken, requireAlmacen } = require('../middleware/authMiddleware');

// Obtiene todos los adeudos (almacenista/administrador)
router.get('/', verificarToken, requireAlmacen, getAllAdeudos);

// Obtiene adeudos del usuario
router.get('/usuario', verificarToken, getUsuarioAdeudos);

// Ajusta adeudo tras devolución parcial
router.post('/ajustar/:solicitudId', verificarToken, ajustarAdeudo);

module.exports = router;
