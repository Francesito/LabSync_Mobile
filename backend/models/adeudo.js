// backend/models/adeudo.js
const pool = require('../config/db');

const obtenerPorUsuario = async (usuario_id) => {
  const [rows] = await pool.query('SELECT * FROM Adeudo WHERE usuario_id = ?', [usuario_id]);
  return rows;
};

module.exports = { obtenerPorUsuario };