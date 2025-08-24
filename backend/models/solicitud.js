// backend/models/solicitud.js
const pool = require('../config/db');

const obtenerPorId = async (id) => {
  const [rows] = await pool.query('SELECT * FROM Solicitud WHERE id = ?', [id]);
  return rows[0];
};

const crearSolicitud = (data, callback) => {
  const query = `
    INSERT INTO solicitudes 
    (material_id, cantidad, motivo, monto, estado, usuario_id, nombre_alumno, profesor)
    VALUES (?, ?, ?, ?, 'pendiente', ?, ?, ?)`;

  const params = [
    data.material_id,
    data.cantidad,
    data.motivo,
    data.monto,
    data.usuario_id,
    data.nombre_alumno,
    data.profesor,
  ];

  db.query(query, params, callback);
};

module.exports = { obtenerPorId };