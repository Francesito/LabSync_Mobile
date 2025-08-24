const pool = require('../config/db');

const crearNotificacion = async (usuarioId, tipo, mensaje) => {
 try {
    await pool.query(
      `INSERT INTO Notificacion (usuario_id, tipo, mensaje) VALUES (?, ?, ?)`,
      [usuarioId, tipo, mensaje]
    );
  } catch (error) {
    console.error('Error al crear notificación:', error);
  }
};

const obtenerNotificacionesPorUsuario = async (usuarioId) => {
  const [rows] = await pool.query(
  `SELECT id, tipo, mensaje, fecha, leida FROM Notificacion WHERE usuario_id = ? ORDER BY fecha DESC`,
    [usuarioId]
  );
  return rows;
};

const eliminarNotificacion = async (id, usuarioId) => {
  await pool.query(`DELETE FROM Notificacion WHERE id = ? AND usuario_id = ?`, [id, usuarioId]);
};

const eliminarNotificacionesUsuario = async (usuarioId) => {
  await pool.query(`DELETE FROM Notificacion WHERE usuario_id = ?`, [usuarioId]);
};

const marcarNotificacionesLeidas = async (usuarioId) => {
  await pool.query(`UPDATE Notificacion SET leida = 1 WHERE usuario_id = ?`, [usuarioId]);
};

module.exports = {
  crearNotificacion,
  obtenerNotificacionesPorUsuario,
     eliminarNotificacion,
  eliminarNotificacionesUsuario,
  marcarNotificacionesLeidas,
};
