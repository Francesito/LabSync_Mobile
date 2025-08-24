const express = require('express');
const router = express.Router();
const { verificarToken } = require('../middleware/authMiddleware');
const notificacionController = require('../controllers/notificacionController');

router.get('/', verificarToken, notificacionController.obtenerNotificaciones);
router.put('/marcar-leidas', verificarToken, notificacionController.marcarLeidas);
router.delete('/', verificarToken, notificacionController.eliminarTodas);
router.delete('/:id', verificarToken, notificacionController.eliminar);

module.exports = router;
