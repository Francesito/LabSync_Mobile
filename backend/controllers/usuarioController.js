// backend/controllers/usuarioController.js
const pool = require('../config/db');

const obtenerUsuarios = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT u.*, r.nombre as rol FROM Usuario u JOIN Rol r ON u.rol_id = r.id');
   const solicitudesMap = new Map();

for (const row of rows) {
  if (!solicitudesMap.has(row.solicitud_id)) {
    solicitudesMap.set(row.solicitud_id, {
      solicitud_id: row.solicitud_id,
      folio: row.folio,
      fecha_solicitud: row.fecha_solicitud,
      estado: row.estado,
      profesor: row.profesor,
      nombre_alumno: row.nombre_alumno,
      items: []
    });
  }

  solicitudesMap.get(row.solicitud_id).items.push({
    id: row.item_id,
    material_id: row.material_id,
    tipo: row.tipo,
    cantidad: row.cantidad,
    nombre_material: row.nombre_material
  });
}

const resultado = Array.from(solicitudesMap.values());
res.json(resultado);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
};

const desactivarUsuario = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('UPDATE Usuario SET activo = FALSE WHERE id = ?', [id]);
    res.json({ mensaje: 'Usuario desactivado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al desactivar usuario' });
  }
};

module.exports = { obtenerUsuarios, desactivarUsuario };