const pool = require('../config/db');

const getResiduos = async (usuario) => {
  let query =
    `SELECT r.*, u.nombre, g.nombre AS grupo
     FROM Residuo r
     LEFT JOIN Usuario u ON r.usuario_id = u.id
     LEFT JOIN Grupo g ON u.grupo_id = g.id`;
  const params = [];

  // Si el usuario es alumno (rol_id === 1), solo obtener sus registros
  if (usuario && usuario.rol_id === 1) {
    query += ' WHERE r.usuario_id = ?';
    params.push(usuario.id);
  }

  query += ' ORDER BY r.fecha DESC, r.id DESC';

  const [rows] = await pool.query(query, params);
  return rows.map((r) => ({ ...r, cantidad: parseFloat(r.cantidad) }));
};

const createResiduo = async ({ usuario_id, fecha, laboratorio, reactivo, tipo, cantidad, unidad }) => {
  const [result] = await pool.query(
   'INSERT INTO Residuo (usuario_id, fecha, laboratorio, reactivo, tipo, cantidad, unidad) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [usuario_id, fecha, laboratorio, reactivo, tipo, cantidad, unidad]
  );
 return {
    id: result.insertId,
    usuario_id,
    fecha,
    laboratorio,
    reactivo,
    tipo,
    cantidad: parseFloat(cantidad),
    unidad,
  }
};

const deleteResiduos = async (ids) => {
  await pool.query('DELETE FROM Residuo WHERE id IN (?)', [ids]);
};

module.exports = { getResiduos, createResiduo, deleteResiduos };
