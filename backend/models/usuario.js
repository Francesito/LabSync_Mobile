// backend/models/usuario.js
const pool = require('../config/db');

const obtenerPorCorreo = async (correo_institucional) => {
  const [rows] = await pool.query('SELECT * FROM Usuario WHERE correo_institucional = ?', [correo_institucional]);
  return rows[0];
};

module.exports = { obtenerPorCorreo };