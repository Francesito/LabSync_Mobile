// backend/controllers/adeudoController.js
const pool = require('../config/db');
const jwt = require('jsonwebtoken');

/** Log helper con timestamp */
function logRequest(name) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [AdeudoController] >> ${name}`);
}

/**
 * GET /api/adeudos/usuario
 * Devuelve todos los adeudos pendientes del usuario autenticado
 */
async function getUsuarioAdeudos(req, res) {
  logRequest('getUsuarioAdeudos');
  try {
    const usuarioId = req.usuario.id;
    const [rows] = await pool.query(
      `SELECT
         a.id,
         a.solicitud_id,
    a.solicitud_item_id,
         COALESCE(ml.nombre, ms.nombre, me.nombre, mlab.nombre) AS nombre_material,
         a.cantidad_pendiente AS cantidad,
         CASE a.tipo WHEN 'liquido' THEN 'ml'
                     WHEN 'solido'  THEN 'g'
                     ELSE 'u' END AS unidad,
         s.folio
       FROM Adeudo a
     JOIN Solicitud s ON a.solicitud_id = s.id
       LEFT JOIN MaterialLiquido ml ON a.tipo='liquido' AND a.material_id = ml.id
       LEFT JOIN MaterialSolido  ms ON a.tipo='solido'  AND a.material_id = ms.id
       LEFT JOIN MaterialEquipo  me ON a.tipo='equipo'  AND a.material_id = me.id
        LEFT JOIN MaterialLaboratorio mlab ON a.tipo='laboratorio' AND a.material_id = mlab.id
       WHERE a.usuario_id = ?`,
      [usuarioId]
    );
    res.json(rows);
  } catch (error) {
    console.error('[Error] getUsuarioAdeudos:', error);
    res.status(500).json({ error: 'Error al obtener adeudos' });
  }
}

/**
 * POST /api/adeudos/ajustar/:solicitudId
 * Body: { entregados: [solicitud_item_id, ...] }
 * Borra todos los adeudos marcados
 */
async function ajustarAdeudo(req, res) {
  logRequest('ajustarAdeudo');
  const { solicitudId } = req.params;
  const { entregados }  = req.body;

  if (!Array.isArray(entregados)) {
    return res.status(400).json({ error: 'Array de items entregados obligatorio' });
  }

  try {
    if (entregados.length > 0) {
      await pool.query(
        `DELETE FROM Adeudo
           WHERE solicitud_id = ?
             AND solicitud_item_id IN (?)`,
        [solicitudId, entregados]
      );
    }

    const [[{ cnt }]] = await pool.query(
      `SELECT COUNT(*) AS cnt
         FROM Adeudo
        WHERE solicitud_id = ?`,
      [solicitudId]
    );

    if (cnt === 0) {
      await pool.query('DELETE FROM SolicitudItem WHERE solicitud_id = ?', [solicitudId]);
      await pool.query('DELETE FROM Solicitud WHERE id = ?', [solicitudId]);
      return res.json({
        message: 'Adeudo completado y solicitud eliminada',
        pendingItems: 0
      });
    }
    
    return res.json({
     message: 'Adeudo parcial registrado',
      pendingItems: cnt
    });
  } catch (error) {
    console.error('[Error] ajustarAdeudo:', error);
    res.status(500).json({ error: 'Error al ajustar adeudo' });
  }
}
/**
 * GET /api/adeudos
 * Devuelve todos los adeudos pendientes (para almacenista)
 */
async function getAllAdeudos(req, res) {
  logRequest('getAllAdeudos');
  try {
    const [rows] = await pool.query(
      `SELECT
         a.id,
         a.solicitud_id,
         a.solicitud_item_id,
         COALESCE(ml.nombre, ms.nombre, me.nombre, mlab.nombre) AS nombre_material,
         a.cantidad_pendiente AS cantidad,
         CASE a.tipo WHEN 'liquido' THEN 'ml' WHEN 'solido' THEN 'g' ELSE 'u' END AS unidad,
         s.folio,
         s.nombre_alumno AS solicitante,
         s.profesor,
         g.nombre AS grupo,
         DATE_FORMAT(a.fecha_entrega, '%Y-%m-%d') AS fecha_entrega
       FROM Adeudo a
     JOIN Solicitud s       ON a.solicitud_id = s.id
       LEFT JOIN Grupo g      ON s.grupo_id = g.id
        LEFT JOIN MaterialLiquido ml ON a.tipo='liquido' AND a.material_id = ml.id
       LEFT JOIN MaterialSolido  ms ON a.tipo='solido'  AND a.material_id = ms.id
       LEFT JOIN MaterialEquipo  me ON a.tipo='equipo'  AND a.material_id = me.id
        LEFT JOIN MaterialLaboratorio mlab ON a.tipo='laboratorio' AND a.material_id = mlab.id
      ORDER BY a.fecha_entrega DESC`
    );
    res.json(rows);
  } catch (error) {
    console.error('[Error] getAllAdeudos:', error);
    res.status(500).json({ error: 'Error al obtener adeudos' });
  }
}

module.exports = {
  getUsuarioAdeudos,
  getAllAdeudos,
  ajustarAdeudo
};
