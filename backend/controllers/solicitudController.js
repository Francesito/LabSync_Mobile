//backend/controllers/solicitudController.js
const pool = require('../config/db');
const { crearNotificacion } = require('../models/notificacion');

// Crear solicitud sin adeudo

const obtenerMisSolicitudes = async (req, res) => {
  try {
    const { id: usuarioId } = req.usuario;
    
    const [rows] = await pool.query(`
      SELECT 
        s.id AS solicitud_id,
        s.fecha_solicitud,
        s.fecha_recoleccion,
        s.estado,
        s.motivo,
        s.folio,
        si.id AS item_id,
        si.material_id,
        si.cantidad,
        si.cantidad_devuelta,
        si.tipo,
        CASE 
          WHEN si.tipo = 'liquido' THEN ml.nombre
          WHEN si.tipo = 'solido' THEN ms.nombre
          WHEN si.tipo = 'equipo' THEN me.nombre
        END AS nombre_material
      FROM Solicitud s
      JOIN SolicitudItem si ON s.id = si.solicitud_id
      LEFT JOIN MaterialLiquido ml ON si.material_id = ml.id AND si.tipo = 'liquido'
      LEFT JOIN MaterialSolido ms ON si.material_id = ms.id AND si.tipo = 'solido'
      LEFT JOIN MaterialEquipo me ON si.material_id = me.id AND si.tipo = 'equipo'
      WHERE s.usuario_id = ?
      ORDER BY s.fecha_solicitud DESC
    `, [usuarioId]);

    res.json(rows);
  } catch (error) {
    console.error('Error al obtener solicitudes por rango de fechas:', error);
    res.status(500).json({ error: 'Error al obtener solicitudes' });
  }
};

const obtenerGrupoPorUsuario = async (req, res) => {
  const { id: usuarioId } = req.usuario;
  
  console.log('🔍 obtenerGrupoPorUsuario - Usuario ID:', usuarioId);

  try {
    const [rows] = await pool.query(`
      SELECT u.id, u.nombre, u.grupo_id, g.nombre as grupo_nombre
      FROM Usuario u
      LEFT JOIN Grupo g ON u.grupo_id = g.id
      WHERE u.id = ?
    `, [usuarioId]);

    console.log('🔍 Query result:', rows);

    if (rows.length === 0) {
      console.log('❌ Usuario no encontrado');
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const usuario = rows[0];
    const nombreGrupo = usuario.grupo_nombre || 'No asignado';
    
    console.log('✅ Grupo encontrado:', nombreGrupo);

    res.json({ nombre: nombreGrupo });
  } catch (error) {
    console.error('❌ Error al obtener el grupo:', error);
    res.status(500).json({ error: 'Error al obtener el grupo' });
  }
};

const cancelarMiSolicitud = async (req, res) => {
  const { id } = req.params;
  const { id: usuarioId } = req.usuario;

  try {
    // Verificar que la solicitud pertenece al usuario y está en estado válido para cancelar
    const [solicitud] = await pool.query(
      'SELECT estado FROM Solicitud WHERE id = ? AND usuario_id = ?',
      [id, usuarioId]
    );

    if (solicitud.length === 0) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    if (!['pendiente', 'aprobada'].includes(solicitud[0].estado)) {
      return res.status(400).json({ error: 'No se puede cancelar una solicitud en este estado' });
    }

    await pool.query(
      'UPDATE Solicitud SET estado = ? WHERE id = ? AND usuario_id = ?',
      ['cancelado', id, usuarioId]
    );

    res.json({ mensaje: 'Solicitud cancelada correctamente' });
  } catch (error) {
    console.error('Error al cancelar solicitud:', error);
    res.status(500).json({ error: 'Error al cancelar solicitud' });
  }
};

// ========================================
// FUNCIONES PARA DOCENTES
// ========================================

const obtenerTodasSolicitudes = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        s.id AS solicitud_id,
        s.usuario_id,
        s.nombre_alumno,
        s.profesor,
        s.fecha_solicitud,
        s.fecha_recoleccion,
        s.estado,
        s.motivo,
        s.folio,
        u.nombre AS nombre_usuario,
        u.correo_institucional,
        g.nombre AS grupo_nombre,
        si.id AS item_id,
        si.material_id,
        si.cantidad,
        si.cantidad_devuelta,
        si.tipo,
        CASE 
          WHEN si.tipo = 'liquido' THEN ml.nombre
          WHEN si.tipo = 'solido' THEN ms.nombre
          WHEN si.tipo = 'equipo' THEN me.nombre
        END AS nombre_material
      FROM Solicitud s
      JOIN Usuario u ON s.usuario_id = u.id
      LEFT JOIN Grupo g ON u.grupo_id = g.id
      JOIN SolicitudItem si ON s.id = si.solicitud_id
      LEFT JOIN MaterialLiquido ml ON si.material_id = ml.id AND si.tipo = 'liquido'
      LEFT JOIN MaterialSolido ms ON si.material_id = ms.id AND si.tipo = 'solido'
      LEFT JOIN MaterialEquipo me ON si.material_id = me.id AND si.tipo = 'equipo'
      ORDER BY s.fecha_solicitud DESC
    `);

    res.json(rows);
  } catch (error) {
    console.error('Error al obtener todas las solicitudes:', error);
    res.status(500).json({ error: 'Error al obtener solicitudes' });
  }
};

const obtenerSolicitudesPendientesAprobacion = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        s.id AS solicitud_id,
        s.usuario_id,
        s.nombre_alumno,
        s.profesor,
        s.fecha_solicitud,
        s.fecha_recoleccion,
        s.fecha_devolucion, 
        s.motivo,
        s.folio,
        u.nombre AS nombre_usuario,
        u.correo_institucional,
        si.id AS item_id,
        si.material_id,
        si.cantidad,
        si.tipo,
        CASE 
          WHEN si.tipo = 'liquido' THEN ml.nombre
          WHEN si.tipo = 'solido' THEN ms.nombre
          WHEN si.tipo = 'equipo' THEN me.nombre
        END AS nombre_material
      FROM Solicitud s
      JOIN Usuario u ON s.usuario_id = u.id
      JOIN SolicitudItem si ON s.id = si.solicitud_id
      LEFT JOIN MaterialLiquido ml ON si.material_id = ml.id AND si.tipo = 'liquido'
      LEFT JOIN MaterialSolido ms ON si.material_id = ms.id AND si.tipo = 'solido'
      LEFT JOIN MaterialEquipo me ON si.material_id = me.id AND si.tipo = 'equipo'
      WHERE s.estado = 'pendiente'
      ORDER BY s.fecha_solicitud ASC
    `);

    res.json(rows);
  } catch (error) {
    console.error('Error al obtener solicitudes pendientes:', error);
    res.status(500).json({ error: 'Error al obtener solicitudes pendientes' });
  }
};

// ========================================
// FUNCIONES PARA ALMACENISTAS
// ========================================

const obtenerSolicitudesAprobadasPendientes = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        s.id AS solicitud_id,
        s.usuario_id,
        s.nombre_alumno,
        s.profesor,
        s.fecha_solicitud,
        s.fecha_recoleccion,
         s.fecha_devolucion,
        s.motivo,
        s.folio,
        s.estado,                               -- ✅ incluye estado (el front lo usa)
        u.nombre AS nombre_usuario,
        u.correo_institucional,
        g.nombre AS grupo_nombre,
        si.id AS item_id,
        si.material_id,
        si.cantidad,
        si.tipo,
        -- ✅ nombre del material para cualquiera de los 4 tipos
        COALESCE(ml.nombre, ms.nombre, me.nombre, mlab.nombre) AS nombre_material,
        -- ✅ disponibilidad según el tipo
        COALESCE(ml.cantidad_disponible_ml, ms.cantidad_disponible_g, me.cantidad_disponible_u, mlab.cantidad_disponible) AS cantidad_disponible
      FROM Solicitud s
      JOIN Usuario u             ON s.usuario_id = u.id
      LEFT JOIN Grupo g          ON u.grupo_id = g.id
      JOIN SolicitudItem si      ON s.id = si.solicitud_id
      LEFT JOIN MaterialLiquido ml
        ON TRIM(LOWER(si.tipo)) = 'liquido'     AND si.material_id = ml.id
      LEFT JOIN MaterialSolido ms
        ON TRIM(LOWER(si.tipo)) = 'solido'      AND si.material_id = ms.id
      LEFT JOIN MaterialEquipo me
        ON TRIM(LOWER(si.tipo)) = 'equipo'      AND si.material_id = me.id
      LEFT JOIN MaterialLaboratorio mlab
        ON TRIM(LOWER(si.tipo)) = 'laboratorio' AND si.material_id = mlab.id
      WHERE s.estado = 'aprobada'
      ORDER BY s.fecha_solicitud DESC
    `);

    res.json(rows);
  } catch (error) {
    console.error('Error al obtener solicitudes aprobadas pendientes:', error);
    res.status(500).json({ error: 'Error al obtener solicitudes' });
  }
};


const obtenerSolicitudes = async (req, res) => {
  try {
    const { id: usuarioId, rol_id } = req.usuario;

    let baseQuery = `
      SELECT 
        s.id AS solicitud_id,
        s.usuario_id,
        s.nombre_alumno,
        s.profesor,
        s.fecha_solicitud,
        s.fecha_recoleccion,
        s.estado,
        g.nombre AS grupo_nombre,
        si.id AS item_id,
        si.material_id,
        si.cantidad,
        si.tipo,
        CASE 
          WHEN si.tipo = 'liquido' THEN ml.nombre
          WHEN si.tipo = 'solido' THEN ms.nombre
          WHEN si.tipo = 'equipo' THEN me.nombre
        END AS nombre_material
      FROM Solicitud s
      JOIN Usuario u ON s.usuario_id = u.id
      LEFT JOIN Grupo g ON u.grupo_id = g.id
      JOIN SolicitudItem si ON s.id = si.solicitud_id
      LEFT JOIN MaterialLiquido ml ON si.material_id = ml.id AND si.tipo = 'liquido'
      LEFT JOIN MaterialSolido ms ON si.material_id = ms.id AND si.tipo = 'solido'
      LEFT JOIN MaterialEquipo me ON si.material_id = me.id AND si.tipo = 'equipo'
    `;

    let whereClause = '';
    let params = [];

    if (rol_id === 1) {
      // Alumno: solo sus solicitudes
      whereClause = ' WHERE s.usuario_id = ?';
      params.push(usuarioId);
    } else if (rol_id === 3) {
      // Almacenista: solo aprobadas
      whereClause = " WHERE s.estado IN ('aprobada', 'entregado')";
    }
    // Docente: ve TODO (sin WHERE extra)

    const finalQuery = baseQuery + whereClause + ' ORDER BY s.fecha_solicitud DESC';

    console.log('Consulta SQL:', finalQuery, params);

    const [rows] = await pool.query(finalQuery, params);

    res.json(rows);
  } catch (error) {
    console.error('Error al obtener solicitudes:', error);
    res.status(500).json({ error: 'Error al obtener solicitudes' });
  }
};

const obtenerSolicitudesPendientesDevolucion = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        s.id AS solicitud_id,
        s.usuario_id,
        s.nombre_alumno,
        s.profesor,
        s.fecha_solicitud,
        s.fecha_recoleccion,
        s.fecha_devolucion,
        s.motivo,
        s.folio,
        u.nombre AS nombre_usuario,
        si.id AS item_id,
        si.material_id,
        si.cantidad,
        si.cantidad_devuelta,
        si.tipo,
        CASE 
          WHEN si.tipo = 'liquido' THEN ml.nombre
          WHEN si.tipo = 'solido' THEN ms.nombre
          WHEN si.tipo = 'equipo' THEN me.nombre
        END AS nombre_material,
        (si.cantidad - si.cantidad_devuelta) AS cantidad_pendiente
      FROM Solicitud s
      JOIN Usuario u ON s.usuario_id = u.id
      JOIN SolicitudItem si ON s.id = si.solicitud_id
      LEFT JOIN MaterialLiquido ml ON si.material_id = ml.id AND si.tipo = 'liquido'
      LEFT JOIN MaterialSolido ms ON si.material_id = ms.id AND si.tipo = 'solido'
      LEFT JOIN MaterialEquipo me ON si.material_id = me.id AND si.tipo = 'equipo'
      WHERE s.estado = 'entregado' AND si.cantidad > si.cantidad_devuelta
      ORDER BY s.fecha_solicitud ASC
    `);

    res.json(rows);
  } catch (error) {
    console.error('Error al obtener solicitudes pendientes de devolución:', error);
    res.status(500).json({ error: 'Error al obtener solicitudes' });
  }
};

const obtenerHistorialSolicitudes = async (req, res) => {
  try {
    const { fecha } = req.query;
    let query = `
      SELECT
        s.id,
        s.folio,
        u.nombre AS solicitante,
        COALESCE(doc.nombre, u.nombre) AS encargado,
        s.fecha_recoleccion,
        s.fecha_devolucion,
         s.estado,
        g.nombre AS grupo,
        GROUP_CONCAT(CONCAT(si.cantidad, ' ', COALESCE(ml.nombre, ms.nombre, me.nombre)) SEPARATOR ', ') AS materiales
      FROM Solicitud s
      JOIN Usuario u ON s.usuario_id = u.id
      LEFT JOIN Usuario doc ON s.docente_id = doc.id
      LEFT JOIN Grupo g ON u.grupo_id = g.id
      JOIN SolicitudItem si ON s.id = si.solicitud_id
      LEFT JOIN MaterialLiquido ml ON si.material_id = ml.id AND si.tipo = 'liquido'
      LEFT JOIN MaterialSolido ms ON si.material_id = ms.id AND si.tipo = 'solido'
      LEFT JOIN MaterialEquipo me ON si.material_id = me.id AND si.tipo = 'equipo'
      WHERE s.estado IN ('aprobada','entregado','devuelto parcial','devuelto total')`;
    const params = [];
    if (fecha) {
      query += ' AND DATE(s.fecha_solicitud) = ?';
      params.push(fecha);
    }
    query += ' GROUP BY s.id ORDER BY s.fecha_solicitud DESC';
    const [historial] = await pool.query(query, params);

    const [estadisticas] = await pool.query(`
      SELECT DATE_FORMAT(fecha_solicitud, '%Y-%m') AS mes, COUNT(*) AS total
      FROM Solicitud
      WHERE estado IN ('aprobada','entregado','devuelto parcial','devuelto total')
      GROUP BY mes
      ORDER BY mes ASC
    `);

    res.json({ historial, estadisticas });
  } catch (error) {
    console.error('Error al obtener historial de solicitudes:', error);
    res.status(500).json({ error: 'Error al obtener historial de solicitudes' });
  }
};

const obtenerDetalleSolicitud = async (req, res) => {
  const { id } = req.params;
  
  try {
    // Primero verificar que la solicitud exista
    const [existe] = await pool.query(
      `SELECT s.id 
       FROM Solicitud s 
       WHERE s.id = ?`,
      [id]
    );

    if (existe.length === 0) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    // Traer el detalle (usando LEFT JOIN para que no falle si aún no hay items)
    const [rows] = await pool.query(`
      SELECT 
        s.id AS solicitud_id,
        s.usuario_id,
        s.nombre_alumno,
        s.profesor,
        s.fecha_solicitud,
        s.fecha_recoleccion,
        s.estado,
        s.motivo,
        s.folio,
        u.nombre AS nombre_usuario,
        u.correo_institucional,
        si.id AS item_id,
        si.material_id,
        si.cantidad,
        si.cantidad_devuelta,
        si.tipo,
        CASE 
          WHEN si.tipo = 'liquido' THEN ml.nombre
          WHEN si.tipo = 'solido' THEN ms.nombre
          WHEN si.tipo = 'equipo' THEN me.nombre
        END AS nombre_material,
        CASE 
          WHEN si.tipo = 'liquido' THEN ml.cantidad_disponible_ml
          WHEN si.tipo = 'solido' THEN ms.cantidad_disponible_g
          WHEN si.tipo = 'equipo' THEN me.cantidad_disponible_u
        END AS cantidad_disponible
      FROM Solicitud s
      JOIN Usuario u ON s.usuario_id = u.id
      LEFT JOIN SolicitudItem si ON s.id = si.solicitud_id
      LEFT JOIN MaterialLiquido ml ON si.material_id = ml.id AND si.tipo = 'liquido'
      LEFT JOIN MaterialSolido ms ON si.material_id = ms.id AND si.tipo = 'solido'
      LEFT JOIN MaterialEquipo me ON si.material_id = me.id AND si.tipo = 'equipo'
      WHERE s.id = ?
      ORDER BY si.id ASC
    `, [id]);

    // Si no hay items, devolvemos al menos una fila con los datos de la solicitud (LEFT JOIN ya lo garantiza)
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener detalle de solicitud:', error);
    res.status(500).json({ error: 'Error al obtener detalle de solicitud' });
  }
};

const entregarMateriales = async (req, res) => {
  const { id } = req.params;
  const { items_entregados } = req.body; // Array con {item_id, cantidad_entregada}
  const { rol_id, id: usuarioId } = req.usuario;

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Verificar que la solicitud existe y está aprobada
    const [solicitud] = await connection.query(
      'SELECT estado, fecha_recoleccion, fecha_devolucion, usuario_id, docente_id FROM Solicitud WHERE id = ?',
      [id]
    );

    if (solicitud.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    if (solicitud[0].estado !== 'aprobada') {
      await connection.rollback();
      return res.status(400).json({ error: 'La solicitud debe estar aprobada para entregar materiales' });
    }

      const reco = solicitud[0].fecha_recoleccion;
    const fechaDevolucion = solicitud[0].fecha_devolucion;
    const solicitanteId = solicitud[0].usuario_id;
    const docenteId = solicitud[0].docente_id;
const formatDate = (date) => new Date(date).toISOString().split('T')[0];
    if (!reco || formatDate(reco) !== formatDate(new Date())) {
      await connection.rollback();
      return res
        .status(400)
        .json({ error: 'La solicitud solo puede entregarse en su fecha de recolección' });
    }
    
    // Verificar permisos de modificar stock solo para usuarios de almacén
    let tienePermisoStock = rol_id === 4; // Los administradores siempre tienen permiso
    if (rol_id === 3) {
      const [permisos] = await connection.query(
        'SELECT modificar_stock FROM PermisosAlmacen WHERE usuario_id = ?',
        [usuarioId]
      );
      tienePermisoStock = permisos.length > 0 && permisos[0].modificar_stock;
    }

    // Procesar cada item entregado solo si tiene permiso para modificar stock
    if (items_entregados && items_entregados.length > 0) {
      if (!tienePermisoStock) {
        await connection.rollback();
        return res.status(403).json({ error: 'No tienes permisos para modificar el stock.' });
      }

      for (const item of items_entregados) {
        const { item_id, cantidad_entregada } = item;

        // Obtener información del item
        const [itemInfo] = await connection.query(
          'SELECT material_id, tipo, cantidad FROM SolicitudItem WHERE id = ? AND solicitud_id = ?',
          [item_id, id]
        );

        if (itemInfo.length === 0) {
          await connection.rollback();
          return res.status(404).json({ error: `Item ${item_id} no encontrado en la solicitud` });
        }

        const { material_id, tipo, cantidad } = itemInfo[0];

        // Validar que la cantidad entregada no exceda la solicitada
        if (cantidad_entregada > cantidad) {
          await connection.rollback();
          return res.status(400).json({ error: `La cantidad entregada para el item ${item_id} excede la cantidad solicitada` });
        }

        // Verificar stock disponible antes de actualizar
        let stockDisponible;
        if (tipo === 'liquido') {
          const [stock] = await connection.query(
            'SELECT cantidad_disponible_ml FROM MaterialLiquido WHERE id = ?',
            [material_id]
          );
          stockDisponible = stock[0]?.cantidad_disponible_ml || 0;
        } else if (tipo === 'solido') {
          const [stock] = await connection.query(
            'SELECT cantidad_disponible_g FROM MaterialSolido WHERE id = ?',
            [material_id]
          );
          stockDisponible = stock[0]?.cantidad_disponible_g || 0;
        } else if (tipo === 'equipo') {
          const [stock] = await connection.query(
            'SELECT cantidad_disponible_u FROM MaterialEquipo WHERE id = ?',
            [material_id]
          );
          stockDisponible = stock[0]?.cantidad_disponible_u || 0;
        }

        if (stockDisponible < cantidad_entregada) {
          await connection.rollback();
          return res.status(400).json({ error: `Stock insuficiente para el material ${material_id} (${tipo})` });
        }

        // Actualizar stock según el tipo de material
        if (tipo === 'liquido') {
          await connection.query(
            'UPDATE MaterialLiquido SET cantidad_disponible_ml = cantidad_disponible_ml - ? WHERE id = ?',
            [cantidad_entregada, material_id]
          );
        } else if (tipo === 'solido') {
          await connection.query(
            'UPDATE MaterialSolido SET cantidad_disponible_g = cantidad_disponible_g - ? WHERE id = ?',
            [cantidad_entregada, material_id]
          );
        } else if (tipo === 'equipo') {
          await connection.query(
            'UPDATE MaterialEquipo SET cantidad_disponible_u = cantidad_disponible_u - ? WHERE id = ?',
            [cantidad_entregada, material_id]
          );
        }

         // Registrar movimiento de inventario
        await connection.query(
          `INSERT INTO MovimientosInventario (usuario_id, material_id, tipo, cantidad, tipo_movimiento, motivo, fecha_movimiento)
           VALUES (?, ?, ?, ?, ?, ?, NOW())`,
          [
            usuarioId,
            material_id,
            tipo,
            -cantidad_entregada,
            'salida',
            'Entrega de solicitud'
          ]
        );
        await connection.query(
          `INSERT INTO Adeudo
             (solicitud_id, solicitud_item_id, usuario_id, material_id, tipo, cantidad_pendiente, fecha_entrega)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            item_id,
            solicitanteId,
            material_id,
            tipo,
            cantidad_entregada,
            fechaDevolucion
          ]
        );

        // Actualizar cantidad del item a lo realmente entregado
        await connection.query(
          'UPDATE SolicitudItem SET cantidad = ? WHERE id = ?',
          [cantidad_entregada, item_id]
        );
      }
      // Eliminar items no entregados
      const idsEntregados = items_entregados.map(i => i.item_id);
      if (idsEntregados.length > 0) {
        await connection.query(
          `DELETE FROM SolicitudItem WHERE solicitud_id = ? AND id NOT IN (?)`,
          [id, idsEntregados]
        );
      } else {
        await connection.query('DELETE FROM SolicitudItem WHERE solicitud_id = ?', [id]);
      }
    }
    
    // Actualizar estado de la solicitud a entregado (independiente del permiso de stock)
    await connection.query(
      'UPDATE Solicitud SET estado = ? WHERE id = ?',
      ['entregado', id]
    );

     // Notificar al solicitante (y al docente si aplica)
    const mensaje = `Se entregaron ${items_entregados?.length || 0} materiales de la solicitud ${id}`;
    await crearNotificacion(solicitanteId, 'solicitud_entregada', mensaje);
    if (docenteId && docenteId !== solicitanteId) {
      await crearNotificacion(docenteId, 'solicitud_entregada', mensaje);
    }
    
    await connection.commit();
    res.json({ mensaje: 'Solicitud marcada como entregada correctamente' });

  } catch (error) {
    await connection.rollback();
    console.error('Error al entregar materiales:', error);
    res.status(500).json({ error: 'Error al entregar materiales' });
  } finally {
    connection.release();
  }
};

const recibirDevolucion = async (req, res) => {
  const { id } = req.params;
  const { items_devueltos } = req.body; // [{ item_id, cantidad_devuelta }]
  const { id: usuarioId } = req.usuario;

  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    for (const item of items_devueltos) {
      const { item_id, cantidad_devuelta } = item;

      const [rows] = await connection.query(
        `SELECT si.material_id, si.tipo, si.cantidad, si.cantidad_devuelta, a.cantidad_pendiente
           FROM SolicitudItem si
           JOIN Adeudo a ON a.solicitud_item_id = si.id AND a.solicitud_id = ?
          WHERE si.id = ?`,
        [id, item_id]
      );
      if (!rows.length) continue;

  const { material_id, tipo, cantidad, cantidad_devuelta: ya_devuelta, cantidad_pendiente } = rows[0];
      if (cantidad_devuelta > cantidad_pendiente) {
        await connection.rollback();
        return res.status(400).json({ error: 'Cantidad devuelta mayor que pendiente' });
      }

      const nuevaDevuelta = ya_devuelta + cantidad_devuelta;
      await connection.query(
        'UPDATE SolicitudItem SET cantidad_devuelta = ? WHERE id = ?',
         [nuevaDevuelta, item_id]
      );

     const nuevaPendiente = cantidad_pendiente - cantidad_devuelta;
      if (nuevaPendiente > 0) {
        await connection.query(
          'UPDATE Adeudo SET cantidad_pendiente = ? WHERE solicitud_id = ? AND solicitud_item_id = ?',
          [nuevaPendiente, id, item_id]
        );
      } else {
        await connection.query(
           'DELETE FROM Adeudo WHERE solicitud_id = ? AND solicitud_item_id = ?',
          [id, item_id]
        );
      }

      if (tipo === 'equipo') {
        await connection.query(
          'UPDATE MaterialEquipo SET cantidad_disponible_u = cantidad_disponible_u + ? WHERE id = ?',
          [cantidad_devuelta, material_id]
        );
        } else if (tipo === 'laboratorio') {
        await connection.query(
          'UPDATE MaterialLaboratorio SET cantidad_disponible = cantidad_disponible + ? WHERE id = ?',
          [cantidad_devuelta, material_id]
        );
      }

      // Registrar movimiento de inventario
      await connection.query(
        `INSERT INTO MovimientosInventario (usuario_id, material_id, tipo, cantidad, tipo_movimiento, motivo, fecha_movimiento)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [
          usuarioId,
          material_id,
          tipo,
          cantidad_devuelta,
          'entrada',
          'Devolución de solicitud'
        ]
      );
    }
 const [pendientes] = await connection.query(
      'SELECT COUNT(*) AS cnt FROM SolicitudItem WHERE solicitud_id = ? AND cantidad > cantidad_devuelta',
      [id]
    );

    if (pendientes[0].cnt === 0) {
      await connection.query('DELETE FROM Adeudo WHERE solicitud_id = ?', [id]);
      await connection.query('DELETE FROM SolicitudItem WHERE solicitud_id = ?', [id]);
      await connection.query('DELETE FROM Solicitud WHERE id = ?', [id]);
    }

    await connection.commit();
    res.json({ mensaje: 'Devolución procesada correctamente' });

  } catch (error) {
    await connection.rollback();
    console.error('Error al procesar devolución:', error);
    res.status(500).json({ error: 'Error al procesar devolución' });
  } finally {
    connection.release();
  }
};

const cancelarSolicitudAlmacen = async (req, res) => {
  const { id } = req.params;
  const { motivo } = req.body;

  try {
    const [solicitud] = await pool.query(
      'SELECT estado FROM Solicitud WHERE id = ?',
      [id]
    );

    if (solicitud.length === 0) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    if (!['aprobada', 'entregado'].includes(solicitud[0].estado)) {
      return res.status(400).json({ error: 'No se puede cancelar una solicitud en este estado' });
    }

    await pool.query(
      'UPDATE Solicitud SET estado = ?, motivo = CONCAT(COALESCE(motivo, ""), " - CANCELADO POR ALMACÉN: ", ?) WHERE id = ?',
      ['cancelado', motivo || 'Sin motivo especificado', id]
    );

    res.json({ mensaje: 'Solicitud cancelada por almacén' });
  } catch (error) {
    console.error('Error al cancelar solicitud desde almacén:', error);
    res.status(500).json({ error: 'Error al cancelar solicitud' });
  }
};

const ajustarCantidadSolicitud = async (req, res) => {
  const { id } = req.params;
  const { item_id, nueva_cantidad, motivo } = req.body;

  try {
    // Verificar que el item pertenece a la solicitud
    const [item] = await pool.query(
      'SELECT si.* FROM SolicitudItem si WHERE si.id = ? AND si.solicitud_id = ?',
      [item_id, id]
    );

    if (item.length === 0) {
      return res.status(404).json({ error: 'Item no encontrado en la solicitud' });
    }

    await pool.query(
      'UPDATE SolicitudItem SET cantidad = ? WHERE id = ?',
      [nueva_cantidad, item_id]
    );

    res.json({ mensaje: 'Cantidad ajustada correctamente' });
  } catch (error) {
    console.error('Error al ajustar cantidad:', error);
    res.status(500).json({ error: 'Error al ajustar cantidad' });
  }
};

const procesarDevolucionParcial = async (req, res) => {
  const { id } = req.params;
  const { item_id, cantidad_devuelta } = req.body;

  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    // Obtener información del item
    const [itemInfo] = await connection.query(
      'SELECT material_id, tipo, cantidad, cantidad_devuelta FROM SolicitudItem WHERE id = ?',
      [item_id]
    );

    if (itemInfo.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Item no encontrado' });
    }

    const { material_id, tipo, cantidad, cantidad_devuelta: ya_devuelta } = itemInfo[0];
    const nueva_cantidad_devuelta = ya_devuelta + cantidad_devuelta;

    if (nueva_cantidad_devuelta > cantidad) {
      await connection.rollback();
      return res.status(400).json({ error: 'No se puede devolver más de lo prestado' });
    }

    // Actualizar cantidad devuelta
    await connection.query(
      'UPDATE SolicitudItem SET cantidad_devuelta = ? WHERE id = ?',
      [nueva_cantidad_devuelta, item_id]
    );

    // Actualizar stock
    if (tipo === 'liquido') {
      await connection.query(
        'UPDATE MaterialLiquido SET cantidad_disponible_ml = cantidad_disponible_ml + ? WHERE id = ?',
        [cantidad_devuelta, material_id]
      );
    } else if (tipo === 'solido') {
      await connection.query(
        'UPDATE MaterialSolido SET cantidad_disponible_g = cantidad_disponible_g + ? WHERE id = ?',
        [cantidad_devuelta, material_id]
      );
    } else if (tipo === 'equipo') {
      await connection.query(
        'UPDATE MaterialEquipo SET cantidad_disponible_u = cantidad_disponible_u + ? WHERE id = ?',
        [cantidad_devuelta, material_id]
      );
    }

    await connection.commit();
    res.json({ mensaje: 'Devolución parcial procesada correctamente' });

  } catch (error) {
    await connection.rollback();
    console.error('Error al procesar devolución parcial:', error);
    res.status(500).json({ error: 'Error al procesar devolución parcial' });
  } finally {
    connection.release();
  }
};

// ========================================
// FUNCIONES GENERALES
// ========================================

const obtenerSolicitudPorId = async (req, res) => {
  const { id } = req.params;
  const { id: usuarioId, rol_id } = req.usuario;

  try {
    let whereClause = 'WHERE s.id = ?';
    let params = [id];

    // Si es alumno, solo puede ver sus propias solicitudes
    if (rol_id === 1) {
      whereClause += ' AND s.usuario_id = ?';
      params.push(usuarioId);
    }

    // Primero verificar que la solicitud exista (y pertenezca si es alumno)
    const [existe] = await pool.query(
      `SELECT s.id 
       FROM Solicitud s 
       ${whereClause}`,
      params
    );

    if (existe.length === 0) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    // Traer el detalle (LEFT JOIN para no romper si no hay items)
    const [rows] = await pool.query(`
      SELECT 
        s.id AS solicitud_id,
        s.usuario_id,
        s.nombre_alumno,
        s.profesor,
        s.fecha_solicitud,
        s.fecha_recoleccion,
        s.estado,
        s.motivo,
        s.folio,
        u.nombre AS nombre_usuario,
        u.correo_institucional,
        si.id AS item_id,
        si.material_id,
        si.cantidad,
        si.cantidad_devuelta,
        si.tipo,
        CASE 
          WHEN si.tipo = 'liquido' THEN ml.nombre
          WHEN si.tipo = 'solido' THEN ms.nombre
          WHEN si.tipo = 'equipo' THEN me.nombre
        END AS nombre_material
      FROM Solicitud s
      JOIN Usuario u ON s.usuario_id = u.id
      LEFT JOIN SolicitudItem si ON s.id = si.solicitud_id
      LEFT JOIN MaterialLiquido ml ON si.material_id = ml.id AND si.tipo = 'liquido'
      LEFT JOIN MaterialSolido ms ON si.material_id = ms.id AND si.tipo = 'solido'
      LEFT JOIN MaterialEquipo me ON si.material_id = me.id AND si.tipo = 'equipo'
      ${whereClause}
      ORDER BY si.id ASC
    `, params);

    res.json(rows);
  } catch (error) {
    console.error('Error al obtener solicitud por ID:', error);
    res.status(500).json({ error: 'Error al obtener solicitud' });
  }
};

const obtenerHistorialSolicitud = async (req, res) => {
  const { id } = req.params;

  try {
    // Por ahora devolvemos información básica de la solicitud
    // En el futuro se podría implementar una tabla de auditoría
    const [rows] = await pool.query(`
      SELECT 
        s.id,
        s.fecha_solicitud,
        s.estado,
        s.motivo,
        u.nombre AS usuario_nombre,
        'Solicitud creada' AS accion,
        s.fecha_solicitud AS fecha_accion
      FROM Solicitud s
      JOIN Usuario u ON s.usuario_id = u.id
      WHERE s.id = ?
    `, [id]);

    res.json(rows);
  } catch (error) {
    console.error('Error al obtener historial:', error);
    res.status(500).json({ error: 'Error al obtener historial' });
  }
};

// ========================================
// FUNCIONES DE MANTENIMIENTO
// ========================================

const limpiarSolicitudesCanceladas = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    // Eliminar items de solicitudes canceladas más de 30 días atrás
    await connection.query(`
      DELETE si FROM SolicitudItem si
      JOIN Solicitud s ON si.solicitud_id = s.id
      WHERE s.estado = 'cancelado' 
      AND s.fecha_solicitud < DATE_SUB(NOW(), INTERVAL 30 DAY)
    `);

    // Eliminar las solicitudes canceladas
    const [result] = await connection.query(`
      DELETE FROM Solicitud 
      WHERE estado = 'cancelado' 
      AND fecha_solicitud < DATE_SUB(NOW(), INTERVAL 30 DAY)
    `);

    await connection.commit();
    res.json({ 
      mensaje: 'Limpieza completada', 
      solicitudes_eliminadas: result.affectedRows 
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error en limpieza:', error);
    res.status(500).json({ error: 'Error en limpieza de solicitudes' });
  } finally {
    connection.release();
  }
};

// ========================================
// FUNCIONES DE REPORTES POR ROL
// ========================================

const obtenerReportePorAlumno = async (req, res) => {
  const { alumno_id } = req.query;

  try {
    let whereClause = '';
    let params = [];

    if (alumno_id) {
      whereClause = 'WHERE s.usuario_id = ?';
      params = [alumno_id];
    }

    const [rows] = await pool.query(`
      SELECT 
        u.id as usuario_id,
        u.nombre,
        u.correo_institucional,
        COUNT(s.id) as total_solicitudes,
        SUM(CASE WHEN s.estado = 'pendiente' THEN 1 ELSE 0 END) as pendientes,
        SUM(CASE WHEN s.estado = 'aprobada' THEN 1 ELSE 0 END) as aprobadas,
        SUM(CASE WHEN s.estado = 'entregado' THEN 1 ELSE 0 END) as entregadas,
        SUM(CASE WHEN s.estado = 'rechazada' THEN 1 ELSE 0 END) as rechazadas
      FROM Usuario u
      LEFT JOIN Solicitud s ON u.id = s.usuario_id
      ${whereClause}
      GROUP BY u.id, u.nombre, u.correo_institucional
      ORDER BY total_solicitudes DESC
    `, params);

    res.json(rows);
  } catch (error) {
    console.error('Error al obtener reporte por alumno:', error);
    res.status(500).json({ error: 'Error al obtener reporte' });
  }
};

const obtenerReportePorFecha = async (req, res) => {
  const { fecha_inicio, fecha_fin } = req.query;

  try {
    let whereClause = '';
    let params = [];

    if (fecha_inicio && fecha_fin) {
      whereClause = 'WHERE s.fecha_solicitud BETWEEN ? AND ?';
      params = [fecha_inicio, fecha_fin];
    }

    const [rows] = await pool.query(`
      SELECT 
        DATE(s.fecha_solicitud) as fecha,
        COUNT(*) as total_solicitudes,
        SUM(CASE WHEN s.estado = 'pendiente' THEN 1 ELSE 0 END) as pendientes,
        SUM(CASE WHEN s.estado = 'aprobada' THEN 1 ELSE 0 END) as aprobadas,
        SUM(CASE WHEN s.estado = 'entregado' THEN 1 ELSE 0 END) as entregadas,
        SUM(CASE WHEN s.estado = 'rechazada' THEN 1 ELSE 0 END) as rechazadas
      FROM Solicitud s
      ${whereClause}
      GROUP BY DATE(s.fecha_solicitud)
      ORDER BY fecha DESC
    `, params);

    res.json(rows);
  } catch (error) {
    console.error('Error al obtener reporte por fecha:', error);
    res.status(500).json({ error: 'Error al obtener reporte' });
  }
};

const obtenerReporteEntregasPendientes = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        s.id as solicitud_id,
        s.folio,
        s.fecha_solicitud,
        u.nombre as alumno,
        COUNT(si.id) as total_items,
        DATEDIFF(NOW(), s.fecha_solicitud) as dias_pendientes
      FROM Solicitud s
      JOIN Usuario u ON s.usuario_id = u.id
      JOIN SolicitudItem si ON s.id = si.solicitud_id
      WHERE s.estado = 'aprobada'
      GROUP BY s.id, s.folio, s.fecha_solicitud, u.nombre
      ORDER BY dias_pendientes DESC
    `);

    res.json(rows);
  } catch (error) {
    console.error('Error al obtener entregas pendientes:', error);
    res.status(500).json({ error: 'Error al obtener reporte' });
  }
};

const obtenerReporteDevolucionesPendientes = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        s.id as solicitud_id,
        s.folio,
        s.fecha_solicitud,
        u.nombre as alumno,
        si.id as item_id,
        CASE 
          WHEN si.tipo = 'liquido' THEN ml.nombre
          WHEN si.tipo = 'solido' THEN ms.nombre
          WHEN si.tipo = 'equipo' THEN me.nombre
        END AS nombre_material,
        si.cantidad,
        si.cantidad_devuelta,
        (si.cantidad - si.cantidad_devuelta) as cantidad_pendiente,
        DATEDIFF(NOW(), s.fecha_solicitud) as dias_prestado
      FROM Solicitud s
      JOIN Usuario u ON s.usuario_id = u.id
      JOIN SolicitudItem si ON s.id = si.solicitud_id
      LEFT JOIN MaterialLiquido ml ON si.material_id = ml.id AND si.tipo = 'liquido'
      LEFT JOIN MaterialSolido ms ON si.material_id = ms.id AND si.tipo = 'solido'
      LEFT JOIN MaterialEquipo me ON si.material_id = me.id AND si.tipo = 'equipo'
      WHERE s.estado = 'entregado' AND si.cantidad > si.cantidad_devuelta
      ORDER BY dias_prestado DESC
    `);

    res.json(rows);
  } catch (error) {
    console.error('Error al obtener devoluciones pendientes:', error);
    res.status(500).json({ error: 'Error al obtener reporte' });
  }
};

const marcarSolicitudVista = async (req, res) => {
  const { id } = req.params;

  try {
    // Esta función requeriría una tabla adicional para tracking de vistas
    // Por ahora solo retornamos éxito
    res.json({ mensaje: 'Solicitud marcada como vista' });
  } catch (error) {
    console.error('Error al marcar como vista:', error);
    res.status(500).json({ error: 'Error al marcar solicitud' });
  }
};

const obtenerNotificacionesPendientes = async (req, res) => {
  const { id: usuarioId, rol_id } = req.usuario;

  try {
    let notificaciones = [];

    // Notificaciones para alumnos
    if (rol_id === 1) {
      const [misEstados] = await pool.query(`
        SELECT 
          id,
          estado,
          folio,
          fecha_solicitud
        FROM Solicitud 
        WHERE usuario_id = ? AND estado IN ('aprobada', 'rechazada')
        ORDER BY fecha_solicitud DESC
        LIMIT 5
      `, [usuarioId]);

      notificaciones = misEstados.map(sol => ({
        tipo: 'cambio_estado',
        mensaje: `Tu solicitud ${sol.folio} ha sido ${sol.estado}`,
        solicitud_id: sol.id,
        fecha: sol.fecha_solicitud
      }));
    }

    res.json(notificaciones);
  } catch (error) {
    console.error('Error al obtener notificaciones:', error);
    res.status(500).json({ error: 'Error al obtener notificaciones' });
  }
};

// Enviar notificaciones por préstamo vencido
const informarPrestamoVencido = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
   `SELECT s.id, s.usuario_id, s.docente_id, s.profesor, u.rol_id,
              g.nombre AS grupo, u.nombre AS alumno
       FROM Solicitud s
        LEFT JOIN Grupo g ON s.grupo_id = g.id
       JOIN Usuario u ON s.usuario_id = u.id
       WHERE s.id = ?`,
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }
    
    const sol = rows[0];
    // Si el préstamo pertenece a un docente, solo se le notifica a él
    if (sol.rol_id === 2) {
      const mensajeDocente = 'Tienes un préstamo vencido, haz la devolución lo antes posible.';
      await crearNotificacion(sol.usuario_id, 'prestamo_vencido', mensajeDocente);
      return res.json({ mensaje: 'Notificación enviada' });
    }

    // Préstamo de alumno: notificar a alumno y docente
    const mensajeAlumno = `Tienes un préstamo vencido (folio ${sol.id}). Devuelve los materiales lo antes posible.`;
      await crearNotificacion(sol.usuario_id, 'prestamo_vencido', mensajeAlumno);

    const mensajeDoc = `El alumno ${sol.alumno} del grupo ${sol.grupo || ''} tiene un préstamo vencido (folio ${sol.id}).`;
    if (sol.docente_id) {
      await crearNotificacion(sol.docente_id, 'prestamo_vencido', mensajeDoc);
    } else if (sol.profesor) {
      const [doc] = await pool.query(
        'SELECT id FROM Usuario WHERE nombre = ? AND rol_id = 2 LIMIT 1',
        [sol.profesor]
      );
      if (doc.length) {
        await crearNotificacion(doc[0].id, 'prestamo_vencido', mensajeDoc);
      }
    }

    res.json({ mensaje: 'Notificaciones enviadas' });
  } catch (error) {
    console.error('Error al informar préstamo vencido:', error);
    res.status(500).json({ error: 'Error al informar préstamo vencido' });
  }
};

// ========================================
// FUNCIONES DE BÚSQUEDA Y FILTROS
// ========================================

const buscarSolicitudes = async (req, res) => {
  const { termino } = req.params;
  const { id: usuarioId, rol_id } = req.usuario;

  try {
    let whereClause = `WHERE (
      s.folio LIKE ? OR 
      s.nombre_alumno LIKE ? OR 
      s.profesor LIKE ? OR 
      s.motivo LIKE ? OR
      u.nombre LIKE ? OR
      u.correo_institucional LIKE ?
    )`;
    
    let params = Array(6).fill(`%${termino}%`);

    // Filtrar por rol
    if (rol_id === 1) {
      whereClause += ' AND s.usuario_id = ?';
      params.push(usuarioId);
    } else if (rol_id === 3) {
      whereClause += " AND s.estado = 'aprobada'";
    }

    const [rows] = await pool.query(`
      SELECT 
        s.id AS solicitud_id,
        s.usuario_id,
        s.nombre_alumno,
        s.profesor,
        s.fecha_solicitud,
        s.fecha_recoleccion,
        s.estado,
        s.motivo,
        s.folio,
        u.nombre AS nombre_usuario,
        u.correo_institucional
      FROM Solicitud s
      JOIN Usuario u ON s.usuario_id = u.id
      ${whereClause}
      ORDER BY s.fecha_solicitud DESC
      LIMIT 50
    `, params);

    res.json(rows);
  } catch (error) {
    console.error('Error al buscar solicitudes:', error);
    res.status(500).json({ error: 'Error en la búsqueda' });
  }
};

const filtrarSolicitudes = async (req, res) => {
  const { estado, fecha_inicio, fecha_fin, usuario_id, tipo_material } = req.body;
  const { id: usuarioIdToken, rol_id } = req.usuario;

  try {
    let whereConditions = [];
    let params = [];

    // Filtros básicos
    if (estado) {
      whereConditions.push('s.estado = ?');
      params.push(estado);
    }

    if (fecha_inicio && fecha_fin) {
      whereConditions.push('s.fecha_solicitud BETWEEN ? AND ?');
      params.push(fecha_inicio, fecha_fin);
    }

    if (usuario_id && [2, 4].includes(rol_id)) { // Solo docentes y admin pueden filtrar por usuario
      whereConditions.push('s.usuario_id = ?');
      params.push(usuario_id);
    }

    if (tipo_material) {
      whereConditions.push('si.tipo = ?');
      params.push(tipo_material);
    }

    // Restricciones por rol
    if (rol_id === 1) {
      whereConditions.push('s.usuario_id = ?');
      params.push(usuarioIdToken);
    } else if (rol_id === 3) {
      whereConditions.push("s.estado = 'aprobada'");
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    const [rows] = await pool.query(`
      SELECT DISTINCT
        s.id AS solicitud_id,
        s.usuario_id,
        s.nombre_alumno,
        s.profesor,
        s.fecha_solicitud,
        s.estado,
        s.motivo,
        s.folio,
        u.nombre AS nombre_usuario,
        u.correo_institucional
      FROM Solicitud s
      JOIN Usuario u ON s.usuario_id = u.id
      LEFT JOIN SolicitudItem si ON s.id = si.solicitud_id
      ${whereClause}
      ORDER BY s.fecha_solicitud DESC
    `, params);

    res.json(rows);
  } catch (error) {
    console.error('Error al filtrar solicitudes:', error);
    res.status(500).json({ error: 'Error al filtrar solicitudes' });
  }
};

const obtenerSolicitudesPorEstado = async (req, res) => {
  const { estado } = req.params;
  const { id: usuarioId, rol_id } = req.usuario;

  try {
    let whereClause = 'WHERE s.estado = ?';
    let params = [estado];

    // Aplicar filtros por rol
    if (rol_id === 1) {
      whereClause += ' AND s.usuario_id = ?';
      params.push(usuarioId);
    } else if (rol_id === 3 && estado !== 'aprobada' && estado !== 'entregado') {
      return res.status(403).json({ error: 'Los almacenistas solo pueden ver solicitudes aprobadas o entregadas' });
    }

    const [rows] = await pool.query(`
      SELECT 
        s.id AS solicitud_id,
        s.usuario_id,
        s.nombre_alumno,
        s.profesor,
        s.fecha_solicitud,
        s.estado,
        s.motivo,
        s.folio,
        u.nombre AS nombre_usuario,
        u.correo_institucional,
        si.id AS item_id,
        si.material_id,
        si.cantidad,
        si.cantidad_devuelta,
        si.tipo,
        CASE 
          WHEN si.tipo = 'liquido' THEN ml.nombre
          WHEN si.tipo = 'solido' THEN ms.nombre
          WHEN si.tipo = 'equipo' THEN me.nombre
        END AS nombre_material
      FROM Solicitud s
      JOIN Usuario u ON s.usuario_id = u.id
      JOIN SolicitudItem si ON s.id = si.solicitud_id
      LEFT JOIN MaterialLiquido ml ON si.material_id = ml.id AND si.tipo = 'liquido'
      LEFT JOIN MaterialSolido ms ON si.material_id = ms.id AND si.tipo = 'solido'
      LEFT JOIN MaterialEquipo me ON si.material_id = me.id AND si.tipo = 'equipo'
      ${whereClause}
      ORDER BY s.fecha_solicitud DESC
    `, params);

    res.json(rows);
  } catch (error) {
    console.error('Error al obtener solicitudes por estado:', error);
    res.status(500).json({ error: 'Error al obtener solicitudes' });
  }
};

const obtenerSolicitudesPorRangoFechas = async (req, res) => {
 const { inicio, fin } = req.params;
 const { id: usuarioId, rol_id } = req.usuario;

 try {
   let whereClause = 'WHERE s.fecha_solicitud BETWEEN ? AND ?';
   let params = [inicio, fin];

   // Aplicar filtros por rol
   if (rol_id === 1) {
     whereClause += ' AND s.usuario_id = ?';
     params.push(usuarioId);
   } else if (rol_id === 3) {
     whereClause += " AND s.estado IN ('aprobada', 'entregado')";
   }

   const [rows] = await pool.query(`
     SELECT 
       s.id AS solicitud_id,
       s.usuario_id,
       s.nombre_alumno,
       s.profesor,
       s.fecha_solicitud,
       s.fecha_recoleccion,
       s.estado,
       s.motivo,
       s.folio,
       u.nombre AS nombre_usuario,
       u.correo_institucional,
       COUNT(si.id) as total_items
     FROM Solicitud s
     JOIN Usuario u ON s.usuario_id = u.id
     LEFT JOIN SolicitudItem si ON s.id = si.solicitud_id
     ${whereClause}
     GROUP BY s.id, s.usuario_id, s.nombre_alumno, s.profesor, s.fecha_solicitud, s.estado, s.motivo, s.folio, u.nombre, u.correo_institucional
     ORDER BY s.fecha_solicitud DESC
   `, params);

   res.json(rows);
 } catch (error) {
   console.error('Error al obtener solicitudes por rango de fechas:', error);
   res.status(500).json({ error: 'Error al obtener solicitudes' });
 }
};

// Crear solicitud con adeudo
const crearSolicitudConAdeudo = async (req, res) => {
  const { usuario_id, material_id, fecha_solicitud, motivo, monto_adeudo } = req.body;

  if (!usuario_id || !material_id || !fecha_solicitud || !motivo || !monto_adeudo) {
    return res.status(400).json({ error: 'Faltan datos para solicitud con adeudo' });
  }

  try {
    const [adeudos] = await pool.query(
      'SELECT * FROM Adeudo WHERE usuario_id = ? AND pagado = FALSE',
      [usuario_id]
    );

    if (adeudos.length > 0) {
      return res.status(400).json({ error: 'Usuario con adeudos pendientes' });
    }

    await pool.query(
      `INSERT INTO Solicitud 
        (usuario_id, material_id, fecha_solicitud, estado, motivo) 
        VALUES (?, ?, ?, ?, ?)`,
      [usuario_id, material_id, fecha_solicitud, 'pendiente', motivo]
    );

    await pool.query(
      `INSERT INTO Adeudo 
        (usuario_id, tipo, monto, fecha, pagado) 
        VALUES (?, ?, ?, NOW(), FALSE)`,
      [usuario_id, 'Préstamo de material', monto_adeudo]
    );

    res.status(201).json({ mensaje: 'Solicitud y adeudo creados correctamente' });
  } catch (error) {
    console.error('Error al crear solicitud con adeudo:', error);
    res.status(500).json({ error: 'Error al crear solicitud y adeudo' });
  }
};

// Aprobar solicitud
const aprobarSolicitud = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('UPDATE Solicitud SET estado = ? WHERE id = ?', ['aprobada', id]);
    
     const [rows] = await pool.query(
      'SELECT usuario_id, nombre_alumno FROM Solicitud WHERE id = ?',
      [id]
    );
    
    if (rows.length) {
     const solicitud = rows[0];

      // Notificar al alumno
      await crearNotificacion(
        solicitud.usuario_id,
        'aprobacion_docente',
        `Solicitud ${id} aprobada`
      );

      // Notificar a almacenistas con permiso de stock
      const [almacenistas] = await pool.query(
        `SELECT u.id
         FROM Usuario u
         JOIN PermisosAlmacen p ON u.id = p.usuario_id
         WHERE u.rol_id = 3 AND p.modificar_stock = TRUE`
      );
      for (const a of almacenistas) {
        await crearNotificacion(
          a.id,
          'solicitud_aprobada',
          `Solicitud ${id} aprobada para ${solicitud.nombre_alumno}`
        );
      }
    }
    
    res.json({ mensaje: 'Solicitud aprobada' });
  } catch (error) {
    console.error('Error al aprobar solicitud:', error);
    res.status(500).json({ error: 'Error al aprobar solicitud' });
  }
};

// Rechazar solicitud
const rechazarSolicitud = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      'SELECT usuario_id, nombre_alumno FROM Solicitud WHERE id = ?',
      [id]
    );
    
    await pool.query('DELETE FROM SolicitudItem WHERE solicitud_id = ?', [id]);
    await pool.query('DELETE FROM Adeudo WHERE solicitud_id = ?', [id]);
    await pool.query('DELETE FROM Solicitud WHERE id = ?', [id]);

     if (rows.length) {
      const solicitud = rows[0];
      await crearNotificacion(
        solicitud.usuario_id,
        'solicitud_rechazada',
        `Solicitud ${id} rechazada`
      );

      const [almacenistas] = await pool.query(
        `SELECT u.id
         FROM Usuario u
         JOIN PermisosAlmacen p ON u.id = p.usuario_id
         WHERE u.rol_id = 3 AND p.modificar_stock = TRUE`
      );
      for (const a of almacenistas) {
        await crearNotificacion(
          a.id,
          'solicitud_rechazada',
          `Solicitud ${id} rechazada para ${solicitud.nombre_alumno}`
        );
      }
    }
    
    res.json({ mensaje: 'Solicitud rechazada y eliminada' });
  } catch (error) {
    console.error('Error al rechazar solicitud:', error);
    res.status(500).json({ error: 'Error al rechazar solicitud' });
  }
};






// Cancelar solicitudes cuya fecha de recolección ya pasó
const cancelarSolicitudesVencidas = async () => {
  try {
    const [result] = await pool.query(
    "UPDATE Solicitud SET estado = 'sin recoleccion' WHERE estado IN ('pendiente','aprobada') AND fecha_recoleccion < CURDATE()"
    );
    if (result.affectedRows > 0) {
     console.log(`⏰ Marcadas ${result.affectedRows} solicitudes por falta de recolección`);
    }
  } catch (error) {
 console.error('Error al marcar solicitudes vencidas:', error);
  }
};

// ELIMINAR SOLICITUDES VIEJAS
const eliminarSolicitudesViejas = async () => {
  try {
    const [result] = await pool.query(`
    DELETE FROM Solicitud
      WHERE fecha_solicitud < DATE_SUB(CURDATE(), INTERVAL 7 DAY)
     OR (estado = 'sin recoleccion' AND fecha_recoleccion <= DATE_SUB(CURDATE(), INTERVAL 1 DAY))
    `);
    console.log(`🗑️ Limpieza automática: ${result.affectedRows} solicitudes eliminadas`);
  } catch (error) {
    console.error('Error al eliminar solicitudes viejas:', error);
  }
};

// Endpoint opcional para disparar limpieza manual
const eliminarSolicitudesViejasHandler = async (req, res) => {
  try {
    await eliminarSolicitudesViejas();
    res.json({ mensaje: 'Solicitudes antiguas eliminadas' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar solicitudes viejas' });
  }
};

module.exports = {
  crearSolicitudConAdeudo,
  aprobarSolicitud,
  rechazarSolicitud,
  obtenerSolicitudes,
  eliminarSolicitudesViejasHandler,
  eliminarSolicitudesViejas,
  cancelarSolicitudesVencidas,

  // Funciones para alumnos
  obtenerMisSolicitudes,
  cancelarMiSolicitud,

  // Funciones para docentes
  obtenerTodasSolicitudes,
  obtenerSolicitudesPendientesAprobacion,

  // Funciones para almacenistas
  obtenerSolicitudesAprobadasPendientes,
  obtenerSolicitudesPendientesDevolucion,
   obtenerHistorialSolicitudes,
  obtenerDetalleSolicitud,
  entregarMateriales,
  recibirDevolucion,
  cancelarSolicitudAlmacen,
  ajustarCantidadSolicitud,
  procesarDevolucionParcial,

  // Funciones generales
  obtenerSolicitudPorId,
  obtenerHistorialSolicitud,
  obtenerGrupoPorUsuario,

  // Funciones de mantenimiento
  limpiarSolicitudesCanceladas,

  // Funciones de reportes por rol
  obtenerReportePorAlumno,
  obtenerReportePorFecha,
  obtenerReporteEntregasPendientes,
  obtenerReporteDevolucionesPendientes,

  // Funciones de notificaciones y alertas
  marcarSolicitudVista,
  obtenerNotificacionesPendientes,
    informarPrestamoVencido,

  // Funciones de búsqueda y filtros
  buscarSolicitudes,
  filtrarSolicitudes,
  obtenerSolicitudesPorEstado,
  obtenerSolicitudesPorRangoFechas
};
