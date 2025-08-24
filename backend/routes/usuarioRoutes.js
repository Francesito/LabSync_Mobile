// backend/routes/usuarioRoutes.js
const express = require('express');
const { obtenerUsuarios, desactivarUsuario } = require('../controllers/usuarioController');
const { verificarToken, verificarRol } = require('../middleware/authMiddleware');
const router = express.Router();

router.get('/', verificarToken, verificarRol([3]), obtenerUsuarios); // Solo almacén
router.put('/desactivar/:id', verificarToken, verificarRol([3]), desactivarUsuario); // Solo almacén

module.exports = router;