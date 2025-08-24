// backend/models/prestamo.js
const pool = require('../config/db');

const obtenerPorId = async (id) => {
  const [rows] = await pool.query('SELECT * FROM Prestamo WHERE id = ?', [id]);
  return rows[0];
};

module.exports = { obtenerPorId };