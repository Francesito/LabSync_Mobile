// backend/routes/messageRoutes.js
const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { 
  verificarToken, 
  verificarMultiplesRoles, 
  verificarPermisosAlmacen 
} = require('../middleware/authMiddleware');

// Todas las rutas requieren autenticación
router.use(verificarToken);

// ✅ Middleware que verifica tanto el rol como los permisos específicos de chat
const verificarAccesoChat = [
  verificarMultiplesRoles(1, 3, 4), // Permitir alumnos, almacén y admin
  verificarPermisosAlmacen('chat')   // Verificar permisos específicos para almacén
];

// ==================== RUTAS DEL CHAT ====================

// Obtener lista de contactos 
// - Alumno verá todos los almacenistas
// - Almacenista verá solo alumnos con quienes ha chateado
router.get('/users', verificarAccesoChat, messageController.getContactos);

// Obtener mensajes con un usuario específico
router.get('/:userId', verificarAccesoChat, messageController.getMessages);

// Enviar mensaje
router.post('/send', verificarAccesoChat, messageController.sendMessage);

// ==================== RUTAS OPCIONALES/ADMINISTRATIVAS ====================

// (Opcional) Obtener todos los usuarios de un rol específico
router.get('/all', verificarAccesoChat, messageController.getAllByRole);

// Limpiar mensajes antiguos manualmente (solo admin o almacén con permisos)
router.delete('/cleanup', verificarMultiplesRoles(3, 4), messageController.cleanupMessages);

module.exports = router;
