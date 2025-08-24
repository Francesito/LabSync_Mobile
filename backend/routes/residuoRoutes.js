const express = require('express');
const router = express.Router();
const {
  obtenerResiduos,
  registrarResiduo,
  eliminarResiduos,
} = require('../controllers/residuoController');
const { verificarToken } = require('../middleware/authMiddleware');

router.get('/', verificarToken, obtenerResiduos);
router.post('/', verificarToken, registrarResiduo);
router.delete('/', verificarToken, eliminarResiduos);

module.exports = router;
