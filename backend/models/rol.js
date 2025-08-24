// backend/models/rol.js
const pool = require('../config/db');

const obtenerRoles = async () => {
  const [rows] = await pool.query('SELECT * FROM Rol');
  return rows;
};

module.exports = { obtenerRoles };