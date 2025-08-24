// backend/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verificarToken } = require('../middleware/authMiddleware');

// Rutas públicas para obtener datos de formularios
router.get('/grupos', authController.obtenerGrupos);
router.get('/docentes', authController.obtenerDocentes); // ✅ Nueva ruta para obtener docentes

// Rutas públicas de autenticación
router.post('/register', authController.registrarUsuario);
router.get('/verify/:token', authController.verificarCorreo);
router.post('/login', authController.iniciarSesion);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password/:token', authController.resetPassword);

// ✅ Rutas protegidas para verificar permisos
router.get('/permisos-chat', verificarToken, authController.verificarPermisosChat);
router.get('/permisos-stock', verificarToken, authController.verificarPermisosStock);

module.exports = router;
