// backend/middleware/rolMiddleware.js
const pool = require('../config/db');

const verificarRolEspecifico = async (req, res, next) => {
  const { rol_id } = req.usuario;
  try {
    const [rows] = await pool.query('SELECT * FROM Rol WHERE id = ?', [rol_id]);
    if (rows.length === 0) {
      return res.status(403).json({ error: 'Rol no válido' });
    }
    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al verificar rol' });
  }
};

module.exports = { verificarRolEspecifico };