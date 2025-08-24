  //backend/controllers/materialController.js

const pool = require('../config/db');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const cloudinary = require('../config/cloudinary');
const { getFolderByType } = require('../middleware/uploadMiddleware');
const { crearNotificacion } = require('../models/notificacion');

/**
 * ========================================
 * UTILS
 * ========================================
 */

/** Log helper con timestamp */
function logRequest(name) {
  const timestamp = new Date().toISOString(); // Ejemplo: 2025-07-24T20:20:00.000Z
  console.log(`[${timestamp}] [MaterialController] >> ${name}`);
}

/** Detectar tabla y campo de stock según tipo de material */
function detectTableAndField(tipo) {
  switch (tipo) {
    case 'liquido': return { table: 'MaterialLiquido', field: 'cantidad_disponible_ml' };
    case 'solido': return { table: 'MaterialSolido', field: 'cantidad_disponible_g' };
    case 'equipo': return { table: 'MaterialEquipo', field: 'cantidad_disponible_u' };
    case 'laboratorio': return { table: 'MaterialLaboratorio', field: 'cantidad_disponible' };
    default: return null;
  }
}

/** Genera un folio alfanumérico de 4 caracteres */
function generarFolio() {
  return crypto.randomBytes(2).toString('hex').toUpperCase();
}

/**
 * ========================================
 * CONSULTA TEMPLATE JOIN para nombre_material
 * ========================================
 * 
 * Usado en getUserSolicitudes, getApprovedSolicitudes, getPendingSolicitudes
 * 
 * Explicación:
 * - Usa LEFT JOIN con COALESCE para resolver nombre del material de subtablas.
 * - Filtra dinámicamente por condición reemplazada en runtime.
 * 
 */

const SELECT_SOLICITUDES_CON_NOMBRE = `
  SELECT 
    s.id            AS solicitud_id,
    s.usuario_id,
    u.rol_id        AS usuario_rol,
    s.fecha_solicitud,
    s.fecha_recoleccion,
     s.fecha_devolucion,
    s.estado,
    s.nombre_alumno,
    s.profesor,
    s.folio,
    si.id           AS item_id,
    si.material_id,
    si.tipo,
    si.cantidad,
    COALESCE(ml.nombre, ms.nombre, me.nombre, mlab.nombre) AS nombre_material,
    g.nombre        AS grupo_nombre
  FROM Solicitud s
  JOIN SolicitudItem si ON s.id = si.solicitud_id
  LEFT JOIN Usuario u ON s.usuario_id = u.id
  LEFT JOIN MaterialLiquido ml ON si.tipo = 'liquido' AND si.material_id = ml.id
  LEFT JOIN MaterialSolido ms ON si.tipo = 'solido' AND si.material_id = ms.id
  LEFT JOIN MaterialEquipo me ON si.tipo = 'equipo' AND si.material_id = me.id
  LEFT JOIN MaterialLaboratorio mlab ON si.tipo = 'laboratorio' AND si.material_id = mlab.id
  LEFT JOIN Grupo g ON s.grupo_id = g.id
  WHERE 1=1
  /*AND_CONDITION*/
`;

/**
 * Elimina solicitudes cuya fecha de recolección ya pasó y
 * que no han sido marcadas como entregadas.
 * Solo elimina solicitudes de ALUMNOS (nombre_alumno IS NOT NULL)
 */
const cleanupExpiredSolicitudes = async () => {
  try {
    // Obtener fecha actual en zona horaria de México
    const hoyMexico = new Date().toLocaleDateString('en-CA', {
      timeZone: 'America/Mexico_City'
    });
    
    console.log(`[DEBUG] Fecha actual México: ${hoyMexico}`);
    
    // Primero obtener las solicitudes que van a ser eliminadas para debug
    const [solicitudesAEliminar] = await pool.query(`
      SELECT s.id, s.folio, s.fecha_recoleccion, s.estado, s.nombre_alumno
      FROM Solicitud s
      WHERE s.estado = 'aprobada'
        AND s.nombre_alumno IS NOT NULL
        AND s.fecha_recoleccion IS NOT NULL
        AND s.fecha_recoleccion < ?
    `, [hoyMexico]);
    
    if (solicitudesAEliminar.length > 0) {
      console.log(`[DEBUG] Solicitudes a eliminar:`, solicitudesAEliminar);
      
      // Antes de eliminar, restaurar el stock que fue descontado
      for (const sol of solicitudesAEliminar) {
        const [items] = await pool.query(
          'SELECT material_id, tipo, cantidad FROM SolicitudItem WHERE solicitud_id = ?',
          [sol.id]
        );
        
        for (const it of items) {
          const meta = detectTableAndField(it.tipo);
          if (meta) {
            await pool.query(
              `UPDATE ${meta.table} SET ${meta.field} = ${meta.field} + ? WHERE id = ?`,
              [it.cantidad, it.material_id]
            );
            console.log(`[DEBUG] Stock restaurado: ${it.cantidad} de material ${it.material_id} tipo ${it.tipo}`);
          }
        }
      }
    }

    // Eliminar SolicitudItem primero (por integridad referencial)
    await pool.query(`
      DELETE si FROM SolicitudItem si
      JOIN Solicitud s ON si.solicitud_id = s.id
      WHERE s.estado = 'aprobada'
        AND s.nombre_alumno IS NOT NULL
        AND s.fecha_recoleccion IS NOT NULL
        AND s.fecha_recoleccion < ?
    `, [hoyMexico]);

    // Eliminar las solicitudes
    const [result] = await pool.query(`
      DELETE FROM Solicitud
      WHERE estado = 'aprobada'
        AND nombre_alumno IS NOT NULL
        AND fecha_recoleccion IS NOT NULL
        AND fecha_recoleccion < ?
    `, [hoyMexico]);

    if (result.affectedRows > 0) {
      console.log(
        `[MaterialController] Solicitudes expiradas eliminadas: ${result.affectedRows}`
      );
    }
  } catch (error) {
    console.error('[Error] cleanupExpiredSolicitudes:', error);
  }
};


/**
 * ========================================
 * RUTAS DE CATALOGO: GET por tipo
 * ========================================
 */

/** Obtener líquidos */
const getLiquidos = async (req, res) => {
  logRequest('getLiquidos');
  try {
    const [rows] = await pool.query(`
      SELECT 
        id, nombre, cantidad_disponible_ml, 
        riesgos_fisicos, riesgos_salud, riesgos_ambientales,
        imagen AS imagen_url
      FROM MaterialLiquido
    `);
    
    // Usar directamente la URL de la base de datos
    const materialsWithValidImages = rows.map(material => ({
      ...material,
     imagen_url: material.imagen_url || ''
    }));
    
    res.json(materialsWithValidImages);
  } catch (error) {
    console.error('[Error] getLiquidos:', error);
    res.status(500).json({ error: 'Error al obtener materiales líquidos: ' + error.message });
  }
};


/** Obtener sólidos */
const getSolidos = async (req, res) => {
  logRequest('getSolidos');
  try {
    const [rows] = await pool.query(`
      SELECT 
        id, nombre, cantidad_disponible_g, 
        riesgos_fisicos, riesgos_salud, riesgos_ambientales,
        imagen AS imagen_url
      FROM MaterialSolido
    `);
    
    // Usar directamente la URL de la base de datos
    const materialsWithValidImages = rows.map(material => ({
      ...material,
     imagen_url: material.imagen_url || ''
    }));
    
    res.json(materialsWithValidImages);
  } catch (error) {
    console.error('[Error] getSolidos:', error);
    res.status(500).json({ error: 'Error al obtener materiales sólidos: ' + error.message });
  }
};

// Función auxiliar para obtener meses del cuatrimestre actual
function obtenerMesesCuatri() {
  const now = new Date();
const start = 8; // septiembre
  const nombres = [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ];
 // Año base del ciclo escolar (comienza en septiembre)
  const baseYear =
    now.getMonth() >= start ? now.getFullYear() : now.getFullYear() - 1;
  // Siempre retornar el primer cuatrimestre del ciclo (septiembre-diciembre)
  const indices = [8, 9, 10, 11];
  return indices.map((i) => ({
    index: i,
    nombre: nombres[i],
    year: i >= start ? baseYear : baseYear + 1,
  }));
}

const getInventarioLiquidosReport = async (req, res) => {
  logRequest('getInventarioLiquidosReport');
  try {
    const meses = obtenerMesesCuatri();
    const inicio = `${meses[0].year}-${String(meses[0].index + 1).padStart(2, '0')}-01`;
    const finDate = new Date(meses[3].year, meses[3].index + 1, 0);
    const fin = `${finDate.getFullYear()}-${String(finDate.getMonth() + 1).padStart(2, '0')}-${String(finDate.getDate()).padStart(2, '0')}`;
    const consumoSelect = meses
      .map(m => `SUM(CASE WHEN MONTH(mov.fecha_movimiento) = ${m.index + 1} AND YEAR(mov.fecha_movimiento) = ${m.year} THEN -mov.cantidad ELSE 0 END) AS ${m.nombre}`)
      .join(', ');
    const query = `
      SELECT ml.id, ml.nombre, ml.cantidad_disponible_ml, ${consumoSelect}
      FROM MaterialLiquido ml
      LEFT JOIN MovimientosInventario mov
        ON mov.material_id = ml.id AND mov.tipo = 'liquido' AND mov.tipo_movimiento = 'salida'
        AND mov.fecha_movimiento BETWEEN ? AND ?
      GROUP BY ml.id`;
    const [rows] = await pool.query(query, [inicio, fin]);
    const datos = rows.map(r => {
      const consumos = {};
     meses.forEach(m => { consumos[m.nombre] = parseFloat(r[m.nombre]) || 0; });
      const total = Object.values(consumos).reduce((a, b) => a + b, 0);
      const disponible = parseFloat(r.cantidad_disponible_ml) || 0;
      return {
        nombre: r.nombre,
        unidad: 'ml',
       cantidad_inicial: disponible + total,
        consumos,
       existencia_final: disponible,
        total_consumido: total,
      };
    });
    res.json({ meses: meses.map(m => m.nombre), datos });
  } catch (error) {
    console.error('[Error] getInventarioLiquidosReport:', error);
    res.status(500).json({ error: 'Error al obtener inventario de líquidos' });
  }
};

const getInventarioSolidosReport = async (req, res) => {
  logRequest('getInventarioSolidosReport');
  try {
    const meses = obtenerMesesCuatri();
    const inicio = `${meses[0].year}-${String(meses[0].index + 1).padStart(2, '0')}-01`;
    const finDate = new Date(meses[3].year, meses[3].index + 1, 0);
    const fin = `${finDate.getFullYear()}-${String(finDate.getMonth() + 1).padStart(2, '0')}-${String(finDate.getDate()).padStart(2, '0')}`;
    const consumoSelect = meses
      .map(m => `SUM(CASE WHEN MONTH(mov.fecha_movimiento) = ${m.index + 1} AND YEAR(mov.fecha_movimiento) = ${m.year} THEN -mov.cantidad ELSE 0 END) AS ${m.nombre}`)
      .join(', ');
    const query = `
      SELECT ms.id, ms.nombre, ms.cantidad_disponible_g, ${consumoSelect}
      FROM MaterialSolido ms
      LEFT JOIN MovimientosInventario mov
        ON mov.material_id = ms.id AND mov.tipo = 'solido' AND mov.tipo_movimiento = 'salida'
        AND mov.fecha_movimiento BETWEEN ? AND ?
      GROUP BY ms.id`;
    const [rows] = await pool.query(query, [inicio, fin]);
    const datos = rows.map(r => {
      const consumos = {};
meses.forEach(m => { consumos[m.nombre] = parseFloat(r[m.nombre]) || 0; });
      const total = Object.values(consumos).reduce((a, b) => a + b, 0);
      const disponible = parseFloat(r.cantidad_disponible_g) || 0;
      return {
        nombre: r.nombre,
        unidad: 'g',
           cantidad_inicial: disponible + total,
        consumos,
          existencia_final: disponible,
        total_consumido: total,
      };
    });
    res.json({ meses: meses.map(m => m.nombre), datos });
  } catch (error) {
    console.error('[Error] getInventarioSolidosReport:', error);
    res.status(500).json({ error: 'Error al obtener inventario de sólidos' });
  }
};

/** Obtener equipos */
const getEquipos = async (req, res) => {
  logRequest('getEquipos');
  try {
    const [rows] = await pool.query(`
      SELECT 
        id, nombre, cantidad_disponible_u,
        imagen AS imagen_url
      FROM MaterialEquipo
    `);
    
    // Usar directamente la URL de la base de datos
    const materialsWithValidImages = rows.map(material => ({
      ...material,
      imagen_url: material.imagen_url || ''
    }));
    
    res.json(materialsWithValidImages);
  } catch (error) {
    console.error('[Error] getEquipos:', error);
    res.status(500).json({ error: 'Error al obtener equipos: ' + error.message });
  }
};

// ✅ NUEVA FUNCIÓN: Obtener docentes disponibles para solicitudes
const obtenerDocentesParaSolicitud = async (req, res) => {
  logRequest('obtenerDocentesParaSolicitud');
  try {
    const [rows] = await pool.query(`
      SELECT id, nombre, correo_institucional 
      FROM Usuario 
      WHERE rol_id = 2 AND activo = TRUE 
      ORDER BY nombre
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener docentes:', error);
    res.status(500).json({ error: 'Error al obtener docentes' });
  }
};

/** Obtener materiales de laboratorio */
const getLaboratorio = async (req, res) => {
  logRequest('getLaboratorio');
  try {
    const [rows] = await pool.query(`
      SELECT 
        id, nombre, cantidad_disponible,
        imagen AS imagen_url
      FROM MaterialLaboratorio
    `);
    
    // Usar directamente la URL de la base de datos
    const materialsWithValidImages = rows.map(material => ({
      ...material,
    imagen_url: material.imagen_url || ''
    }));
    
    res.json(materialsWithValidImages);
  } catch (error) {
    console.error('[Error] getLaboratorio:', error);
    res.status(500).json({ error: 'Error al obtener materiales de laboratorio: ' + error.message });
  }
};


/**
 * ========================================
 * CREAR SOLICITUDES (AGRUPADAS)
 * ========================================
 * 
 * Permite que alumnos y docentes creen solicitudes
 * - Docentes pueden aprobar automáticamente
 * - Alumnos deben esperar aprobación
 * 
 * Guarda en tabla Solicitud con:
 * - usuario_id, material_id, tipo
 * - cantidad, motivo, estado
 * - folio_vale único para agrupar
 * 
 */

/** Obtener TODAS las solicitudes (para DOCENTE) */
const getAllSolicitudes = async (req, res) => {
  logRequest('getAllSolicitudes');
  try {
     await cleanupExpiredSolicitudes();
    const query = SELECT_SOLICITUDES_CON_NOMBRE.replace('/*AND_CONDITION*/', '') + ' ORDER BY s.fecha_solicitud DESC';
    const [rows] = await pool.query(query);
    res.json(rows);
  } catch (error) {
    console.error('[Error] getAllSolicitudes:', error);
    res.status(500).json({ error: 'Error al obtener solicitudes: ' + error.message });
  }
};

/** Crear solicitud (alumno/docente) con folio, grupo y selección de docente */
const crearSolicitudes = async (req, res) => {
  logRequest('crearSolicitudes');
  const token = req.headers.authorization?.split(' ')[1];
  const {
    materiales,
    motivo,
    fecha_solicitud,
    fecha_recoleccion,
    fecha_devolucion,
    aprobar_automatico,
    docente_id
  } = req.body;

  if (!token) return res.status(401).json({ error: 'Token requerido' });
  if (!Array.isArray(materiales) || materiales.length === 0) {
    return res.status(400).json({ error: 'Se requiere al menos un material' });
  }
  if (!fecha_recoleccion || !fecha_devolucion) {
    return res.status(400).json({ error: 'Fechas de recolección y entrega requeridas' });
  }

  try {
    const { id: usuario_id, rol_id } = jwt.verify(token, process.env.JWT_SECRET);
    if (![1, 2].includes(rol_id)) {
      return res.status(403).json({ error: 'Solo alumnos o docentes pueden crear solicitudes' });
    }

    const [user] = await pool.query('SELECT nombre, grupo_id FROM Usuario WHERE id = ?', [usuario_id]);
    if (!user.length) return res.status(404).json({ error: 'Usuario no encontrado' });

    let grupo_nombre = null;
    let grupo_id = null;
    if (rol_id === 1 && user[0].grupo_id) {
      const [grupo] = await pool.query('SELECT nombre FROM Grupo WHERE id = ?', [user[0].grupo_id]);
      grupo_nombre = grupo[0]?.nombre || 'No especificado';
      grupo_id = user[0].grupo_id;
    }

    const folio = generarFolio();
    const estadoInicial = (rol_id === 2 || aprobar_automatico) ? 'aprobada' : 'pendiente';
    
    let docente_seleccionado_id = null;
    let profesor = 'Sin asignar';

    if (estadoInicial === 'aprobada') {
      // Si es docente o aprobación automática, el docente es el mismo usuario
      docente_seleccionado_id = usuario_id;
      profesor = user[0].nombre;
    } else if (docente_id) {
      // Si es alumno y seleccionó un docente específico
      const [docente] = await pool.query('SELECT id, nombre FROM Usuario WHERE id = ? AND rol_id = 2 AND activo = TRUE', [docente_id]);
      if (docente.length > 0) {
        docente_seleccionado_id = docente[0].id;
        profesor = docente[0].nombre;
      } else {
        return res.status(400).json({ error: 'Docente seleccionado no válido' });
      }
    } else {
      // Si no se seleccionó docente, asignar el primero disponible
      const [docente] = await pool.query('SELECT id, nombre FROM Usuario WHERE rol_id = 2 AND activo = TRUE LIMIT 1');
      docente_seleccionado_id = docente[0]?.id;
      profesor = docente[0]?.nombre || profesor;
    }

    // 🟢 DIFERENCIA CLAVE:
    // - Alumno: nombre_alumno = nombre del alumno
    // - Docente: nombre_alumno = NULL (para distinguir solicitudes de docente)
    const nombre_alumno = (rol_id === 1) ? user[0].nombre : null;

    const [result] = await pool.query(
      `INSERT INTO Solicitud
   (usuario_id, fecha_solicitud, motivo, estado, docente_id, nombre_alumno, profesor, folio, grupo_id, fecha_recoleccion, fecha_devolucion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        usuario_id,
        fecha_solicitud,
        motivo,
        estadoInicial,
        docente_seleccionado_id,
        nombre_alumno,
        profesor,
        folio,
        grupo_id,
        fecha_recoleccion,
        fecha_devolucion
      ]
    );
    const solicitudId = result.insertId;

    for (const mat of materiales) {
      const { material_id, cantidad, tipo } = mat;
      await pool.query(
        `INSERT INTO SolicitudItem (solicitud_id, material_id, tipo, cantidad) VALUES (?,?,?,?)`,
        [solicitudId, material_id, tipo, cantidad]
      );
      
    }
     // Mensaje y notificación para quien crea la solicitud
    let mensajeCreador;
    if (rol_id === 1) {
      mensajeCreador = `Solicitud con Folio: ${folio} creada Exitosamente, aprobacion pendiente por el docente ${profesor}`;
    } else {
      const fechaStr = fecha_recoleccion
        ? new Date(fecha_recoleccion).toLocaleDateString('es-MX', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          })
        : 'sin fecha';
      mensajeCreador = `Solicitud con Folio: ${folio} creada Exitosamente, recoleccion pendiente para el dia: ${fechaStr}, favor de hacer la recoleccion a tiempo, de lo contrario la solicitud sera eliminada.`;
    }
    await crearNotificacion(usuario_id, 'creacion_solicitud', mensajeCreador);

    // Notificación para el docente seleccionado (si es diferente al creador)
    if (docente_seleccionado_id && docente_seleccionado_id !== usuario_id) {
      const mensajeDocente = `Tienes una nueva solicitud con Folio: ${folio} del alumno ${user[0].nombre}`;
      await crearNotificacion(docente_seleccionado_id, 'solicitud_nueva', mensajeDocente);
    }

    res.status(201).json({
      message: mensajeCreador,
      solicitudId,
      folio,
      docente_asignado: profesor,
      grupo: grupo_nombre
    });
  } catch (err) {
    console.error('[Error] crearSolicitudes:', err);
    res.status(500).json({ error: 'Error al registrar solicitud: ' + err.message });
  }
};


/**
 * ========================================
 * CREAR SOLICITUD CON ADEUDO
 * Solo ALUMNO
 * ========================================
 */

const crearSolicitudConAdeudo = async (req, res) => {
  logRequest('crearSolicitudConAdeudo');
  const { usuario_id, material_id, tipo, fecha_solicitud, motivo, monto_adeudo, docente_id } = req.body;

  if (!usuario_id || !material_id || !tipo || !fecha_solicitud || !motivo || !monto_adeudo) {
    return res.status(400).json({ error: 'Faltan datos obligatorios para la solicitud con adeudo' });
  }

  try {
    const [user] = await pool.query('SELECT nombre, rol_id, grupo_id FROM Usuario WHERE id = ?', [usuario_id]);
    if (!user.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (user[0].rol_id !== 1) return res.status(403).json({ error: 'Solo alumnos pueden crear solicitudes con adeudo' });

    let grupo_nombre = 'No especificado';
    let grupo_id = null;
    if (user[0].grupo_id) {
      const [grupo] = await pool.query('SELECT nombre FROM Grupo WHERE id = ?', [user[0].grupo_id]);
      grupo_nombre = grupo[0]?.nombre || 'No especificado';
      grupo_id = user[0].grupo_id;
    }

    const meta = detectTableAndField(tipo);
    if (!meta) return res.status(400).json({ error: 'Tipo de material inválido' });

    const [material] = await pool.query(`SELECT ${meta.field} FROM ${meta.table} WHERE id = ?`, [material_id]);
    if (!material.length) return res.status(404).json({ error: 'Material no encontrado' });
    if (material[0][meta.field] < 1) {
      return res.status(400).json({ error: 'No hay suficiente stock para el material' });
    }

    let docente_seleccionado_id = null;
    let profesor = 'Sin asignar';

    if (docente_id) {
      // Verificar que el docente seleccionado sea válido
      const [docente] = await pool.query('SELECT id, nombre FROM Usuario WHERE id = ? AND rol_id = 2 AND activo = TRUE', [docente_id]);
      if (docente.length > 0) {
        docente_seleccionado_id = docente[0].id;
        profesor = docente[0].nombre;
      } else {
        return res.status(400).json({ error: 'Docente seleccionado no válido' });
      }
    } else {
      // Si no se seleccionó docente, asignar el primero disponible
      const [docente] = await pool.query('SELECT id, nombre FROM Usuario WHERE rol_id = 2 AND activo = TRUE LIMIT 1');
      docente_seleccionado_id = docente[0]?.id || null;
      profesor = docente[0]?.nombre || 'Sin asignar';
    }

    const [result] = await pool.query(
      `INSERT INTO Solicitud 
        (usuario_id, material_id, tipo, cantidad, fecha_solicitud, motivo, monto_adeudo, estado, docente_id, nombre_alumno, profesor, grupo_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pendiente', ?, ?, ?, ?)`,
      [usuario_id, material_id, tipo, 1, fecha_solicitud, motivo, monto_adeudo, docente_seleccionado_id, user[0].nombre, profesor, grupo_id]
    );

    res.status(201).json({ 
      message: 'Solicitud con adeudo registrada correctamente',
      solicitudId: result.insertId,
      docente_asignado: profesor,
      grupo: grupo_nombre
    });
  } catch (error) {
    console.error('[Error] crearSolicitudConAdeudo:', error);
    res.status(500).json({ error: 'Error al crear solicitud con adeudo: ' + error.message });
  }
};

/**
 * ========================================
 * CONSULTAS DE SOLICITUDES CON JOIN POR TIPO
 * ========================================
 * 
 * LEFT JOIN dinámico con COALESCE para resolver nombre_material
 * 
 * ========================================
 */

/**
 * Obtener solicitudes del usuario */
const getUserSolicitudes = async (req, res) => {
  logRequest('getUserSolicitudes');
   await cleanupExpiredSolicitudes();
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token requerido' });

  try {
    const { id: usuario_id } = jwt.verify(token, process.env.JWT_SECRET);

    // Reemplaza el marcador del WHERE
    const query = SELECT_SOLICITUDES_CON_NOMBRE.replace(
      '/*AND_CONDITION*/',
      `AND s.usuario_id = ?`
    );

    const [rows] = await pool.query(query, [usuario_id]);
    res.json(rows);
  } catch (error) {
    console.error('[Error] getUserSolicitudes:', error);
    res.status(500).json({ error: 'Error al obtener solicitudes: ' + error.message });
  }
};


/**
 * Obtener solicitudes aprobadas */
const getApprovedSolicitudes = async (req, res) => {
  logRequest('getApprovedSolicitudes');

    await cleanupExpiredSolicitudes();
  try {
    // Inserta la condición AND para el estado aprobado
    const query = SELECT_SOLICITUDES_CON_NOMBRE.replace(
      '/*AND_CONDITION*/',
          "AND s.estado = 'aprobada' AND u.rol_id = 1"
    );

    const [rows] = await pool.query(query);
    res.json(rows);
  } catch (error) {
    console.error('[Error] getApprovedSolicitudes:', error);
    res.status(500).json({ error: 'Error al obtener solicitudes aprobadas: ' + error.message });
  }
};

/**
 * Obtener solicitudes pendientes */
const getPendingSolicitudes = async (req, res) => {
  logRequest('getPendingSolicitudes');


    await cleanupExpiredSolicitudes();
  try {
    const query = SELECT_SOLICITUDES_CON_NOMBRE.replace(
      '/*AND_CONDITION*/',
      "AND s.estado = 'pendiente'"
    );

    const [rows] = await pool.query(query);
    res.json(rows);
  } catch (error) {
    console.error('[Error] getPendingSolicitudes:', error);
    res.status(500).json({ error: 'Error al obtener solicitudes pendientes: ' + error.message });
  }
};

/**
 * ========================================
 * ACCIONES SOBRE SOLICITUDES
 * ========================================
 */

/**
 * Aprobar solicitud */
const approveSolicitud = async (req, res) => {
  logRequest(`approveSolicitud`);

  const { id } = req.params;
  if (!id || isNaN(parseInt(id))) {
    console.warn('[Warn] ID de solicitud inválido o no proporcionado');
    return res.status(400).json({ error: 'ID de solicitud inválido' });
  }

  try {
    const [items] = await pool.query(
      'SELECT material_id, tipo, cantidad FROM SolicitudItem WHERE solicitud_id = ?',
      [id]
    );

    if (items.length === 0) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    // Verificar stock disponible
    for (const it of items) {
      const meta = detectTableAndField(it.tipo);
      if (!meta) continue;
      const [row] = await pool.query(
        `SELECT ${meta.field} AS disponible FROM ${meta.table} WHERE id = ?`,
        [it.material_id]
      );
      if (!row.length || row[0].disponible < it.cantidad) {
        return res.status(400).json({ error: `Stock insuficiente para material ${it.material_id}` });
      }
    }

    // Descontar stock
    for (const it of items) {
      const meta = detectTableAndField(it.tipo);
      if (!meta) continue;
      await pool.query(
        `UPDATE ${meta.table} SET ${meta.field} = ${meta.field} - ? WHERE id = ?`,
        [it.cantidad, it.material_id]
      );
    }
    
    const [result] = await pool.query(
      "UPDATE Solicitud SET estado = 'aprobada' WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }
  const [rows] = await pool.query(
      `SELECT s.usuario_id, s.nombre_alumno, s.folio, s.profesor, s.fecha_recoleccion,
              u.nombre AS solicitante_nombre, u.rol_id AS solicitante_rol
       FROM Solicitud s
       JOIN Usuario u ON s.usuario_id = u.id
       WHERE s.id = ?`,
      [id]
    );
    if (rows.length) {
      const solicitud = rows[0];
      if (solicitud.solicitante_rol === 1) {
        const fechaStr = solicitud.fecha_recoleccion
          ? new Date(solicitud.fecha_recoleccion).toLocaleDateString('es-MX', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric'
            })
          : 'sin fecha';
        const mensajeAlumno = `Solicitud con Folio: ${solicitud.folio} Autorizada por el docente: ${solicitud.profesor}, por favor haz la recoleccion el dia ${fechaStr} de lo contrario la solicitud sera eliminada.`;
        await crearNotificacion(solicitud.usuario_id, 'aprobacion_docente', mensajeAlumno);
      }

      const [almacenistas] = await pool.query(
        `SELECT u.id
         FROM Usuario u
         JOIN PermisosAlmacen p ON u.id = p.usuario_id
         WHERE u.rol_id = 3 AND p.modificar_stock = TRUE`
      );
      const fechaLarga = solicitud.fecha_recoleccion
        ? new Date(solicitud.fecha_recoleccion).toLocaleDateString('es-ES', {
            weekday: 'long',
            day: 'numeric',
            month: 'long'
          })
        : 'sin fecha';
      const fechaLargaCap = fechaLarga.charAt(0).toUpperCase() + fechaLarga.slice(1);
      const solicitanteTipo = solicitud.solicitante_rol === 2 ? 'docente' : 'alumno';
      const solicitanteNombre = solicitud.solicitante_rol === 2 ? solicitud.solicitante_nombre : solicitud.nombre_alumno;
      const mensajeAlmacen = `Nueva solicitud aprobada con el Folio: ${solicitud.folio}, El ${solicitanteTipo} ${solicitanteNombre} espera la entrega para el dia ${fechaLargaCap}.`;
      for (const a of almacenistas) {
        await crearNotificacion(a.id, 'solicitud_aprobada', mensajeAlmacen);
      }
    }
    
    res.status(200).json({ message: 'Solicitud aprobada' });
  } catch (error) {
    console.error('[Error] approveSolicitud:', error);
    res.status(500).json({ error: 'Error al aprobar solicitud: ' + error.message });
  }
};

/**
 * Rechazar solicitud */
const rejectSolicitud = async (req, res) => {
  const { id } = req.params;
  logRequest(`rejectSolicitud - ID=${id}`);
  try {
   const [rows] = await pool.query(
      'SELECT usuario_id, nombre_alumno, folio FROM Solicitud WHERE id = ?',
      [id]
    );
     const solicitud = rows[0];
    await pool.query('DELETE FROM SolicitudItem WHERE solicitud_id = ?', [id]);
    await pool.query('DELETE FROM Adeudo WHERE solicitud_id = ?', [id]);
    await pool.query('DELETE FROM Solicitud WHERE id = ?', [id]);
    
  if (solicitud) {
      await crearNotificacion(
        solicitud.usuario_id,
        'solicitud_rechazada',
        `Solicitud con Folio: ${solicitud.folio} rechazada`
      );
    }

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
         `Solicitud ${id} rechazada${solicitud ? ` para ${solicitud.nombre_alumno}` : ''}`
        );
      }
    
    res.status(200).json({ message: 'Solicitud rechazada y eliminada' });
  } catch (error) {
    console.error('[Error] rejectSolicitud:', error);
    res.status(500).json({ error: 'Error al rechazar solicitud: ' + error.message });
  }
};

/**
 * Marcar solicitud como entregada + generar adeudos con fecha_entrega */
const deliverSolicitud = async (req, res) => {
  logRequest('deliverSolicitud');
  const { id } = req.params;
  const { items_entregados } = req.body || {};
  
  try {
    // 1) Verificar existencia y estado
    const [rows] = await pool.query(
     `SELECT usuario_id, estado, fecha_devolucion, fecha_recoleccion, docente_id
       FROM Solicitud WHERE id = ?`,
      [id]
    );
    
    const sol = rows[0];
    if (!sol) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }
    
    if (sol.estado !== 'aprobada') {
      return res.status(400).json({ 
        error: 'Solo solicitudes aprobadas pueden entregarse' 
      });
    }

    // 2) Validar fecha de recolección - CORREGIDO CON ZONA HORARIA MÉXICO
    if (sol.fecha_recoleccion) {
      // Obtener fecha actual en zona horaria de México
      const hoyMexico = new Date().toLocaleDateString('en-CA', {
        timeZone: 'America/Mexico_City'
      });
      
      // Convertir fecha_recoleccion a string formato YYYY-MM-DD
      const fechaRecoleccionStr = new Date(sol.fecha_recoleccion).toISOString().split('T')[0];

      // Comparar las fechas como strings
      if (fechaRecoleccionStr !== hoyMexico) {
        // Debug para verificar las fechas
        console.log('[DEBUG] Fecha actual México:', hoyMexico);
        console.log('[DEBUG] Fecha recolección:', fechaRecoleccionStr);
        console.log('[DEBUG] Fecha recolección original:', sol.fecha_recoleccion);
        console.log('[DEBUG] Zona horaria servidor:', Intl.DateTimeFormat().resolvedOptions().timeZone);
        
        return res.status(400).json({ 
          error: `La solicitud solo puede entregarse en su fecha de recolección (${fechaRecoleccionStr}). Hoy es ${hoyMexico}` 
        });
      }
    }
    
    // 3) Marcar la solicitud como entregada y registrar la fecha de entrega
    const fechaEntregaMx = new Date().toLocaleString('sv-SE', {
      timeZone: 'America/Mexico_City'
    });
    await pool.query(
    'UPDATE Solicitud SET estado = ?, fecha_entrega = ? WHERE id = ?',
      ['entregado', fechaEntregaMx, id]
    );

    // 4) Leer los ítems asociados
    const [itemsRows] = await pool.query(
      'SELECT id AS solicitud_item_id, material_id, tipo, cantidad FROM SolicitudItem WHERE solicitud_id = ?',
      [id]
    );
    
    // Normalizar la lista de ítems entregados. El frontend puede enviar
    // un arreglo de IDs o un arreglo de objetos { item_id, cantidad_entregada }.
    let items;
    if (Array.isArray(items_entregados) && items_entregados.length > 0) {
      const idToCantidad = new Map();
      for (const entry of items_entregados) {
        if (entry && typeof entry === 'object') {
          idToCantidad.set(entry.item_id, entry.cantidad_entregada);
        } else {
          idToCantidad.set(entry, undefined);
        }
      }

      items = itemsRows
        .filter((it) => idToCantidad.has(it.solicitud_item_id))
        .map((it) => ({
          ...it,
          cantidad: idToCantidad.get(it.solicitud_item_id) ?? it.cantidad,
        }));

      if (items.length === 0) items = itemsRows;
    } else {
      items = itemsRows;
    }

    // 5) Insertar un registro de adeudo por cada ítem seleccionado
    for (const it of items) {
      await pool.query(
        `INSERT INTO Adeudo
           (solicitud_id, solicitud_item_id, usuario_id, material_id, tipo, cantidad_pendiente, fecha_entrega)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          it.solicitud_item_id,
          sol.usuario_id,
          it.material_id,
          it.tipo,
          it.cantidad,
          sol.fecha_devolucion
        ]
      );

       // Actualizar la cantidad del item al valor realmente entregado
      await pool.query(
        'UPDATE SolicitudItem SET cantidad = ? WHERE id = ?',
        [it.cantidad, it.solicitud_item_id]
      );
    }

    // Eliminar los items que no fueron entregados
    const entregadosIds = items.map(it => it.solicitud_item_id);
    if (entregadosIds.length > 0) {
      const placeholders = entregadosIds.map(() => '?').join(',');
      await pool.query(
        `DELETE FROM SolicitudItem WHERE solicitud_id = ? AND id NOT IN (${placeholders})`,
        [id, ...entregadosIds]
      );
    } else {
      await pool.query('DELETE FROM SolicitudItem WHERE solicitud_id = ?', [id]);
    }
    
     // Notificar al solicitante y al docente si aplica
    const mensaje = `Se entregaron ${items.length} materiales de la solicitud ${id}`;
    await crearNotificacion(sol.usuario_id, 'solicitud_entregada', mensaje);
    if (sol.docente_id && sol.docente_id !== sol.usuario_id) {
      await crearNotificacion(sol.docente_id, 'solicitud_entregada', mensaje);
    }

    return res.json({
      message: 'Entregado y adeudos generados',
      fecha_entrega: fechaEntregaMx.split(' ')[0]
    });
    
  } catch (err) {
    console.error('[Error] deliverSolicitud:', err);
    return res.status(500).json({ 
      error: 'Error al entregar solicitud: ' + err.message 
    });
  }
};


/**
 * Cancelar solicitud
 * - Si lo hace un alumno (rol 1): valida que sea suya, esté pendiente,
 *   restaura stock y luego marca como cancelado.
 * - Para almacenistas (rol 3) sigue marcando como cancelado sin tocar stock.
 */
const cancelSolicitud = async (req, res) => {
  const { id } = req.params;
  logRequest(`cancelSolicitud - ID=${id}`);
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Token requerido' });

  try {
    const { id: usuario_id, rol_id } = jwt.verify(token, process.env.JWT_SECRET);

    if (rol_id === 1) {
      // 1) Verificar que la solicitud exista, sea del alumno y esté pendiente
      const [[sol]] = await pool.query(
        'SELECT estado, usuario_id FROM Solicitud WHERE id = ?',
        [id]
      );
      if (!sol) {
        return res.status(404).json({ error: 'Solicitud no encontrada' });
      }
      if (sol.usuario_id !== usuario_id) {
        return res.status(403).json({ error: 'No puede cancelar esta solicitud' });
      }
      if (sol.estado !== 'pendiente') {
        return res.status(400).json({ error: 'Solo solicitudes pendientes pueden cancelarse' });
      }

    }
    // 2) Eliminar o marcar según rol
    if (rol_id === 1) {
      // Si es alumno, borramos ítems y solicitud para que desaparezca del listado
      await pool.query('DELETE FROM SolicitudItem WHERE solicitud_id = ?', [id]);
      await pool.query('DELETE FROM Solicitud WHERE id = ?', [id]);
      return res.status(200).json({ message: 'Solicitud eliminada permanentemente' });
    } else {
      // Almacenistas siguen marcando como cancelado
      await pool.query('UPDATE Solicitud SET estado = ? WHERE id = ?', ['cancelado', id]);
      return res.status(200).json({ message: 'Solicitud cancelada' });
    }

  } catch (error) {
    console.error('[Error] cancelSolicitud:', error);
    res.status(500).json({ error: 'Error al cancelar solicitud: ' + error.message });
  }
};

/**
 * Ajuste de inventario (solo almacenista con permisos)
 */
const adjustInventory = async (req, res) => {
  logRequest('adjustInventory');
  const { id } = req.params;
  let { cantidad, tipo } = req.body;
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  try {
    // Verificar rol y permisos
    const { rol_id } = jwt.verify(token, process.env.JWT_SECRET);
    if (rol_id !== 3 && !req.user?.permisos?.modificar_stock) {
      return res
        .status(403)
        .json({ error: 'Solo almacenistas con permisos de stock pueden ajustar inventario' });
    }

    // Parsear y validar nueva cantidad absoluta
    cantidad = parseInt(cantidad, 10);
    if (isNaN(cantidad)) {
      return res.status(400).json({ error: 'Cantidad debe ser un número válido' });
    }
    if (cantidad < 0) {
      return res.status(400).json({ error: 'La cantidad no puede ser negativa' });
    }

    // Determinar tabla y campo
    const meta = detectTableAndField(tipo);
    if (!meta) {
      return res.status(400).json({ error: 'Tipo de material inválido' });
    }

    // Leer stock actual para calcular delta
    const [[actualRow]] = await pool.query(
      `SELECT ${meta.field} AS actual FROM ${meta.table} WHERE id = ?`,
      [id]
    );
    if (actualRow == null) {
      return res.status(404).json({ error: 'Material no encontrado' });
    }
    const actual = actualRow.actual;
    const delta = cantidad - actual;

    // Actualizar stock al valor absoluto
    await pool.query(
      `UPDATE ${meta.table} SET ${meta.field} = ? WHERE id = ?`,
      [cantidad, id]
    );

    // Registrar movimiento con la diferencia
    await pool.query(
      `INSERT INTO MovimientosInventario 
         (usuario_id, material_id, tipo, cantidad, tipo_movimiento, motivo, fecha_movimiento)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [
        req.usuario?.id || null,
        id,
        tipo,
        delta,
        'ajuste',
        'Ajuste de inventario via API'
      ]
    );

    // Responder con éxito y nuevo stock
    res.status(200).json({
      message: 'Inventario actualizado correctamente',
      nuevoStock: cantidad
    });

  } catch (error) {
    console.error('[Error] adjustInventory:', error);
    res
      .status(500)
      .json({ error: 'Error al ajustar inventario: ' + error.message });
  }
};


/**
 * ========================================
 * RUTAS ADICIONALES PARA ADMINISTRADORES
 * ========================================
 */

/** Obtener historial de movimientos (solo admin) */
const getHistorialMovimientos = async (req, res) => {
  logRequest('getHistorialMovimientos');
  try {
    const { rol_id } = req.usuario;
    if (rol_id !== 3 && rol_id !== 4) {
      return res.status(403).json({ error: 'Solo administradores o almacenistas pueden ver el historial' });
    }

    const { busqueda } = req.query;

    await pool.query(
      "DELETE FROM MovimientosInventario WHERE fecha_movimiento < DATE_SUB(NOW(), INTERVAL 30 DAY)"
    );

    let query = `
      SELECT
        m.id,
        m.usuario_id,
        m.material_id,
        m.tipo,
        m.cantidad,
          CASE m.tipo
          WHEN 'liquido' THEN 'ml'
          WHEN 'solido' THEN 'gr'
          ELSE 'unidad(es)'
        END AS unidad,
        CASE m.tipo
          WHEN 'liquido' THEN ml.cantidad_disponible_ml
          WHEN 'solido' THEN ms.cantidad_disponible_g
          WHEN 'equipo' THEN me.cantidad_disponible_u
          WHEN 'laboratorio' THEN mlab.cantidad_disponible
          ELSE NULL
        END AS stock_actual,
        m.tipo_movimiento,
        m.fecha_movimiento,
       COALESCE(u.nombre, 'Desconocido') AS usuario,
     COALESCE(REPLACE(ml.nombre, '_', ' '), REPLACE(ms.nombre, '_', ' '), REPLACE(me.nombre, '_', ' '), REPLACE(mlab.nombre, '_', ' ')) AS nombre_material
      FROM MovimientosInventario m
      LEFT JOIN Usuario u ON m.usuario_id = u.id
      LEFT JOIN MaterialLiquido ml ON m.tipo = 'liquido' AND m.material_id = ml.id
      LEFT JOIN MaterialSolido ms ON m.tipo = 'solido' AND m.material_id = ms.id
      LEFT JOIN MaterialEquipo me ON m.tipo = 'equipo' AND m.material_id = me.id
      LEFT JOIN MaterialLaboratorio mlab ON m.tipo = 'laboratorio' AND m.material_id = mlab.id
       WHERE 1=1`;

    const params = [];

    if (busqueda) {
      const like = `%${busqueda}%`;
      query +=
       " AND (COALESCE(REPLACE(ml.nombre, '_', ' '), REPLACE(ms.nombre, '_', ' '), REPLACE(me.nombre, '_', ' '), REPLACE(mlab.nombre, '_', ' ')) LIKE ? OR COALESCE(u.nombre, '') LIKE ?)";
      params.push(like, like);
    }

    query += ' ORDER BY m.fecha_movimiento DESC';

    const [rows] = await pool.query(query, params);

    const [estadisticas] = await pool.query(`
      SELECT DATE_FORMAT(fecha_movimiento, '%Y-%m') AS mes, COUNT(*) AS total
      FROM MovimientosInventario
      GROUP BY DATE_FORMAT(fecha_movimiento, '%Y-%m')
      ORDER BY mes DESC
      LIMIT 12
    `);

   res.json({ movimientos: rows, estadisticas });
  } catch (error) {
    console.error('[Error] getHistorialMovimientos:', error);
    res.status(500).json({ error: 'Error al obtener historial de movimientos: ' + error.message });
  }
};

/** Obtener historial de solicitudes (almacén y administradores) */
const getHistorialSolicitudes = async (req, res) => {
  logRequest('getHistorialSolicitudes');
  try {

     await cleanupExpiredSolicitudes();
    const { rol_id } = req.usuario || {}; // Usar req.usuario en lugar de decodificar JWT aquí
    
     // Verificar permisos - almacén (3) o administradores (4)
    if (![3, 4].includes(rol_id)) {
      return res.status(403).json({ error: 'Solo administradores o almacenistas pueden ver el historial' });
    }
    
    const { busqueda } = req.query;
    
    // Query principal para obtener solicitudes con todos los estados
    let query = `
      SELECT
        s.id,
        s.folio,
        u.nombre AS solicitante,
        CASE 
          WHEN s.nombre_alumno IS NULL THEN u.nombre 
          ELSE s.nombre_alumno 
        END AS nombre_display,
        COALESCE(doc.nombre, s.profesor, 'Sin asignar') AS encargado,
        s.fecha_solicitud,
        s.fecha_recoleccion,
        s.fecha_devolucion,
        s.estado,
        g.nombre AS grupo,
        GROUP_CONCAT(
          CONCAT(
            si.cantidad, ' ',
            CASE si.tipo
              WHEN 'liquido' THEN 'ml'
              WHEN 'solido' THEN 'gr'
              ELSE 'Unidad'
            END,
             ', ',
            COALESCE(REPLACE(ml.nombre, '_', ' '), REPLACE(ms.nombre, '_', ' '), REPLACE(me.nombre, '_', ' '), REPLACE(mlab.nombre, '_', ' '), 'Material Desconocido')
          ) SEPARATOR ', '
        ) AS materiales
      FROM Solicitud s
      JOIN Usuario u ON s.usuario_id = u.id
      LEFT JOIN Usuario doc ON s.docente_id = doc.id
      LEFT JOIN Grupo g ON s.grupo_id = g.id
      JOIN SolicitudItem si ON s.id = si.solicitud_id
      LEFT JOIN MaterialLiquido ml ON si.material_id = ml.id AND si.tipo = 'liquido'
      LEFT JOIN MaterialSolido ms ON si.material_id = ms.id AND si.tipo = 'solido'
      LEFT JOIN MaterialEquipo me ON si.material_id = me.id AND si.tipo = 'equipo'
      LEFT JOIN MaterialLaboratorio mlab ON si.material_id = mlab.id AND si.tipo = 'laboratorio'
      WHERE 1=1`;
    
    const params = [];

    if (busqueda) {
      const like = `%${busqueda}%`;
     query += ' AND (u.nombre LIKE ? OR s.nombre_alumno LIKE ? OR s.folio LIKE ?)';
      params.push(like, like, like);
    }
    
     // Almacenistas solo ven solicitudes aprobadas o entregadas
    if (rol_id === 3) {
      query += " AND s.estado IN ('aprobada', 'entregado')";
    }
    
    // Agrupar y ordenar
   query += `
      GROUP BY s.id, s.folio, u.nombre, s.nombre_alumno, doc.nombre, s.profesor,
               s.fecha_solicitud, s.fecha_recoleccion, s.fecha_devolucion, s.estado, g.nombre
      ORDER BY s.fecha_solicitud DESC, s.id DESC`;
      
    console.log('Query ejecutada:', query);
    console.log('Parámetros:', params);
    console.log('Usuario rol_id:', rol_id);
    
    const [historial] = await pool.query(query, params);
    
    // Query para estadísticas mensuales
    const [estadisticas] = await pool.query(`
      SELECT 
        DATE_FORMAT(fecha_solicitud, '%Y-%m') AS mes, 
        COUNT(*) AS total
      FROM Solicitud
      GROUP BY DATE_FORMAT(fecha_solicitud, '%Y-%m')
      ORDER BY mes DESC
      LIMIT 12
    `);
    
    console.log(`Historial encontrado: ${historial.length} solicitudes`);
    console.log(`Estadísticas: ${estadisticas.length} meses`);
    
    res.json({ 
      historial: historial || [], 
      estadisticas: estadisticas || [] 
    });
    
  } catch (error) {
    console.error('[Error] getHistorialSolicitudes:', error);
    res.status(500).json({ error: 'Error al obtener historial de solicitudes: ' + error.message });
  }
};

/**
 * ========================================
 * RUTAS ESPECIALES COMBINADAS
 * ========================================
 */

/** Ajuste masivo de stock (almacenistas con permisos y admins) */
const ajusteMasivoStock = async (req, res) => {
  logRequest('ajusteMasivoStock');
  const { ajustes } = req.body; // Array de { id, tipo, cantidad }
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Token requerido' });

  try {
    const { rol_id, permisos } = jwt.verify(token, process.env.JWT_SECRET);
    if (rol_id !== 3 && rol_id !== 4 && !permisos?.modificar_stock) {
      return res.status(403).json({ error: 'Acceso denegado. Requiere permisos de stock' });
    }

    if (!Array.isArray(ajustes) || ajustes.length === 0) {
      return res.status(400).json({ error: 'Se requiere al menos un ajuste' });
    }

    for (const ajuste of ajustes) {
      const { id, tipo, cantidad } = ajuste;
      if (!id || !tipo || isNaN(cantidad)) {
        return res.status(400).json({ error: 'Datos de ajuste inválidos' });
      }

      const meta = detectTableAndField(tipo);
      if (!meta) return res.status(400).json({ error: 'Tipo de material inválido' });

      const [material] = await pool.query(`SELECT ${meta.field} FROM ${meta.table} WHERE id = ?`, [id]);
      if (!material.length) return res.status(404).json({ error: `Material ${id} no encontrado` });

      const nuevaCantidad = material[0][meta.field] + parseInt(cantidad);
      if (nuevaCantidad < 0) return res.status(400).json({ error: 'La cantidad no puede ser negativa' });

      await pool.query(`UPDATE ${meta.table} SET ${meta.field} = ? WHERE id = ?`, [nuevaCantidad, id]);
      await pool.query(
        `INSERT INTO MovimientosInventario (usuario_id, material_id, tipo, cantidad, fecha_movimiento)
         VALUES (?, ?, ?, ?, NOW())`,
        [req.usuario.id, id, tipo, cantidad]
      );
    }

    res.status(200).json({ message: 'Ajuste masivo de stock completado' });
  } catch (error) {
    console.error('[Error] ajusteMasivoStock:', error);
    res.status(500).json({ error: 'Error al ajustar stock masivo: ' + error.message });
  }
};

/** Obtener materiales con stock bajo (almacenistas con permisos y admins) */
const getMaterialesStockBajo = async (req, res) => {
  logRequest('getMaterialesStockBajo');
  try {
    const { rol_id, permisos } = req.usuario;
    if (rol_id !== 3 && rol_id !== 4 && !permisos?.modificar_stock) {
      return res.status(403).json({ error: 'Acceso denegado. Requiere permisos de stock' });
    }

    const threshold = 10; // Umbral de stock bajo (ajustable)
    const [liquidos] = await pool.query(
      'SELECT id, nombre, cantidad_disponible_ml AS stock, riesgos_fisicos, riesgos_salud, riesgos_ambientales FROM MaterialLiquido WHERE cantidad_disponible_ml < ?',
      [threshold]
    );
    const [solidos] = await pool.query(
      'SELECT id, nombre, cantidad_disponible_g AS stock, riesgos_fisicos, riesgos_salud, riesgos_ambientales FROM MaterialSolido WHERE cantidad_disponible_g < ?',
      [threshold]
    );
    const [equipos] = await pool.query(
      'SELECT id, nombre, cantidad_disponible_u AS stock FROM MaterialEquipo WHERE cantidad_disponible_u < ?',
      [threshold]
    );
    const [laboratorio] = await pool.query(
      'SELECT id, nombre, cantidad_disponible AS stock FROM MaterialLaboratorio WHERE cantidad_disponible < ?',
      [threshold]
    );

    // Agregar tipo a cada material
    const liquidosConTipo = liquidos.map(item => ({ ...item, tipo: 'liquido' }));
    const solidosConTipo = solidos.map(item => ({ ...item, tipo: 'solido' }));
    const equiposConTipo = equipos.map(item => ({ ...item, tipo: 'equipo' }));
    const laboratorioConTipo = laboratorio.map(item => ({ ...item, tipo: 'laboratorio' }));

    const lowStock = [...liquidosConTipo, ...solidosConTipo, ...equiposConTipo, ...laboratorioConTipo];

    res.json(lowStock);
  } catch (error) {
    console.error('[Error] getMaterialesStockBajo:', error);
    res.status(500).json({ error: 'Error al obtener materiales con stock bajo: ' + error.message });
  }
};

/**
 * ========================================
 * RUTAS GENERALES
 * ========================================
 */
const getMaterials = async (req, res) => {
  logRequest('getMaterials');
  try {
    const [liquidos] = await pool.query(`
      SELECT id, nombre, 'liquido' AS tipo, cantidad_disponible_ml, 
             riesgos_fisicos, riesgos_salud, riesgos_ambientales,
             imagen AS imagen_url
      FROM MaterialLiquido
    `);
    const [solidos] = await pool.query(`
      SELECT id, nombre, 'solido' AS tipo, cantidad_disponible_g, 
             riesgos_fisicos, riesgos_salud, riesgos_ambientales,
             imagen AS imagen_url
      FROM MaterialSolido
    `);
    const [laboratorio] = await pool.query(`
      SELECT id, nombre, 'laboratorio' AS tipo, cantidad_disponible, 
             imagen AS imagen_url
      FROM MaterialLaboratorio
    `);
    const [equipos] = await pool.query(`
      SELECT id, nombre, 'equipo' AS tipo, cantidad_disponible_u, 
             imagen AS imagen_url
      FROM MaterialEquipo
    `);

    // Usar URLs directamente de la base de datos
    const liquidosConImagen = liquidos.map(material => ({
      ...material,
     imagen_url: material.imagen_url || ''
    }));
    
    const solidosConImagen = solidos.map(material => ({
      ...material,
    imagen_url: material.imagen_url || ''
    }));
    
    const laboratorioConImagen = laboratorio.map(material => ({
      ...material,
   imagen_url: material.imagen_url || ''
    }));
    
    const equiposConImagen = equipos.map(material => ({
      ...material,
     imagen_url: material.imagen_url || ''
    }));

    const materials = [...liquidosConImagen, ...solidosConImagen, ...laboratorioConImagen, ...equiposConImagen];
    res.json(materials);
  } catch (error) {
    console.error('[Error] getMaterials:', error);
    res.status(500).json({ error: 'Error al obtener materiales: ' + error.message });
  }
};


/** Obtener un material específico por ID y TIPO */
const getMaterialById = async (req, res) => {
  const { id } = req.params;
  const { tipo } = req.query;

  logRequest(`getMaterialById - ID=${id}, tipo=${tipo}`);

  try {
    const meta = detectTableAndField(tipo);
    if (!meta) {
      return res.status(400).json({ error: 'Tipo de material inválido' });
    }

    const [result] = await pool.query(`SELECT *, imagen AS imagen_url FROM ${meta.table} WHERE id = ?`, [id]);
    if (!result.length) {
      return res.status(404).json({ error: 'Material no encontrado' });
    }

    const material = result[0];
    material.tipo = tipo;
    
    // Usar la URL de la base de datos directamente
    material.imagen_url = material.imagen_url || '';

    res.json(material);
  } catch (error) {
    console.error('[Error] getMaterialById:', error);
    res.status(500).json({ error: 'Error al obtener material: ' + error.message });
  }
};


/** Listar solicitudes entregadas CON adeudos pendientes */
const getDeliveredSolicitudes = async (req, res) => {
  logRequest('getDeliveredSolicitudes');
  try {
        await cleanupExpiredSolicitudes();
    const [rows] = await pool.query(`
      SELECT
        s.id AS solicitud_id,
        s.folio,
        s.nombre_alumno,
        s.profesor,
       s.fecha_devolucion AS fecha_devolucion,
        g.nombre AS grupo_nombre
      FROM Solicitud s
      JOIN Adeudo a ON a.solicitud_id = s.id
      LEFT JOIN Grupo g ON s.grupo_id = g.id
      WHERE s.estado = 'entregado'
       AND a.cantidad_pendiente > 0
      GROUP BY s.id, s.folio, s.nombre_alumno, s.profesor, g.nombre, s.fecha_devolucion
      ORDER BY fecha_devolucion DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error('[Error] getDeliveredSolicitudes:', error);
    res.status(500).json({ error: 'Error al obtener solicitudes entregadas: ' + error.message });
  }
};

// Detalle de solicitud ENTREGADA (y fallback para evitar que /solicitudes/almacen caiga aquí por el orden de rutas)
const getSolicitudDetalle = async (req, res) => {
  logRequest(`getSolicitudDetalle - ID=${req.params.id}`);
  try {
    const rawId = req.params.id;

    // Fallback para /solicitudes/almacen
    if (!/^\d+$/.test(rawId)) {
      if (rawId === 'almacen') {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'Token requerido' });

        const { rol_id } = jwt.verify(token, process.env.JWT_SECRET);
        if (rol_id !== 3 && rol_id !== 4) {
          return res.status(403).json({ error: 'Solo almacenistas o admin' });
        }

        const queryListado = `
          SELECT 
            s.id AS id,
            s.id AS solicitud_id,
            s.usuario_id,
            s.fecha_solicitud,
            s.estado,
            s.nombre_alumno,
            s.profesor,
            s.folio,
            s.fecha_recoleccion,
            si.id  AS item_id,
            si.material_id,
            si.tipo,
            si.cantidad,
            COALESCE(ml.nombre, ms.nombre, me.nombre, mlab.nombre) AS nombre_material,
            g.nombre AS grupo_nombre
          FROM Solicitud s
          JOIN SolicitudItem si ON s.id = si.solicitud_id
LEFT JOIN MaterialLiquido ml
  ON TRIM(LOWER(si.tipo)) = 'liquido'     AND si.material_id = ml.id
LEFT JOIN MaterialSolido ms
  ON TRIM(LOWER(si.tipo)) = 'solido'      AND si.material_id = ms.id
LEFT JOIN MaterialEquipo me
  ON TRIM(LOWER(si.tipo)) = 'equipo'      AND si.material_id = me.id
LEFT JOIN MaterialLaboratorio mlab
  ON TRIM(LOWER(si.tipo)) = 'laboratorio' AND si.material_id = mlab.id
          LEFT JOIN Grupo g ON s.grupo_id = g.id
          ORDER BY s.fecha_solicitud DESC
        `;
        const [rows] = await pool.query(queryListado);
        return res.json(rows);
      }
      return res.status(400).json({ error: 'ID de solicitud inválido' });
    }

    const id = parseInt(rawId, 10);

    // 1) Cabecera de la solicitud
    const [solRows] = await pool.query(
      `SELECT
         s.id AS id,
         s.id AS solicitud_id,
         s.folio,
         s.nombre_alumno,
         s.profesor,
          s.fecha_recoleccion AS fecha_recoleccion,
         s.fecha_devolucion AS fecha_devolucion,
         g.nombre AS grupo_nombre
       FROM Solicitud s
       LEFT JOIN Adeudo a ON a.solicitud_id = s.id
       LEFT JOIN Grupo g  ON s.grupo_id = g.id
       WHERE s.id = ?
  GROUP BY s.id, s.folio, s.nombre_alumno, s.profesor, g.nombre, s.fecha_recoleccion, s.fecha_devolucion`,
      [id]
    );
    if (!solRows.length) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }
    const sol = solRows[0];

    // 2) Ítems con adeudo pendiente
    const [items] = await pool.query(
      `SELECT
         a.solicitud_item_id AS item_id,
         a.tipo,
         a.cantidad_pendiente AS cantidad,
         COALESCE(ml.nombre, ms.nombre, me.nombre, mlab.nombre) AS nombre_material
       FROM Adeudo a
       LEFT JOIN MaterialLiquido ml ON a.tipo = 'liquido' AND a.material_id = ml.id
       LEFT JOIN MaterialSolido ms ON a.tipo = 'solido' AND a.material_id = ms.id
       LEFT JOIN MaterialEquipo me ON a.tipo = 'equipo' AND a.material_id = me.id
       LEFT JOIN MaterialLaboratorio mlab ON a.tipo = 'laboratorio' AND a.material_id = mlab.id
      WHERE a.solicitud_id = ? AND a.cantidad_pendiente > 0`,
      [id]
    );

    // 3) Respuesta unificada
    return res.json({
      id: sol.id,
      solicitud_id: sol.solicitud_id,
      folio: sol.folio,
      nombre_alumno: sol.nombre_alumno,
      profesor: sol.profesor,
      fecha_recoleccion: sol.fecha_recoleccion,
    fecha_devolucion: sol.fecha_devolucion,
      grupo: sol.grupo_nombre || 'No especificado',
      items: items.map(i => ({
        item_id: i.item_id,
        nombre_material: i.nombre_material,
        cantidad: i.cantidad,
        tipo: i.tipo,
        entregado: false
      }))
    });
  } catch (err) {
    console.error('[Error] getSolicitudDetalle:', err);
    return res.status(500).json({ error: 'Error al obtener detalle de solicitud: ' + err.message });
  }
};


// ========================================
// FUNCIONES FALTANTES PARA materialController.js
// ========================================

// CREAR NUEVO MATERIAL
const crearMaterial = async (req, res) => {
  logRequest('crearMaterial');
  
  const { 
    nombre, 
    descripcion = '',
    tipo, 
    cantidad_inicial, 
    categoria_id = null,
    riesgos_fisicos = '',
    riesgos_salud = '',
    riesgos_ambientales = '',
    estado = 'disponible'
  } = req.body;

  // Validaciones básicas
  if (!nombre || !tipo || cantidad_inicial === undefined) {
    return res.status(400).json({ 
      error: 'Faltan datos obligatorios: nombre, tipo, cantidad_inicial' 
    });
  }
  if (parseInt(cantidad_inicial) < 0) {
    return res.status(400).json({ 
      error: 'La cantidad inicial no puede ser negativa' 
    });
  }

  try {
    const meta = detectTableAndField(tipo);
    if (!meta) {
      return res.status(400).json({ error: 'Tipo de material inválido' });
    }

    // Verificar duplicado
    const [existingMaterial] = await pool.query(
      `SELECT id FROM ${meta.table} WHERE nombre = ?`, 
      [nombre]
    );
    if (existingMaterial.length > 0) {
      return res.status(400).json({ error: 'Ya existe un material con ese nombre' });
    }

    // **Procesar imagen: siempre tomamos la URL de Cloudinary**
    const imagenUrl = req.file?.path || null;
    if (!imagenUrl) {
      console.warn('[Warn] No se subió imagen: crearMaterial sin URL de imagen');
    }

    // Construir e insertar
    let query, params;
    if (tipo === 'liquido' || tipo === 'solido') {
      query = `
        INSERT INTO ${meta.table} 
        (nombre, descripcion, ${meta.field}, categoria_id, riesgos_fisicos, riesgos_salud, riesgos_ambientales, estado, imagen) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      params = [
        nombre, descripcion, parseInt(cantidad_inicial), categoria_id,
        riesgos_fisicos, riesgos_salud, riesgos_ambientales, estado,
        imagenUrl
      ];
    } else {
      query = `
        INSERT INTO ${meta.table} 
        (nombre, descripcion, ${meta.field}, categoria_id, estado, imagen) 
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      params = [
        nombre, descripcion, parseInt(cantidad_inicial), categoria_id,
        estado, imagenUrl
      ];
    }
    const [result] = await pool.query(query, params);

    // Registrar movimiento inicial
    try {
      await pool.query(
        `INSERT INTO MovimientosInventario 
         (usuario_id, material_id, tipo, cantidad, tipo_movimiento, motivo, fecha_movimiento) 
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [
          req.usuario?.id || 1, 
          result.insertId, 
          tipo, 
          parseInt(cantidad_inicial), 
          'entrada', 
          'Material creado - Stock inicial'
        ]
      );
    } catch (movError) {
      console.warn('[Warn] No se pudo registrar movimiento:', movError.message);
    }

    res.status(201).json({ 
      message: 'Material creado exitosamente',
      material: {
        id: result.insertId,
        nombre,
        tipo,
        cantidad_inicial: parseInt(cantidad_inicial),
        imagen_url: imagenUrl,
        estado,
        descripcion,
        categoria_id,
        carpeta_cloudinary: getFolderByType(tipo)
      }
    });

  } catch (error) {
    console.error('[Error] crearMaterial:', error);
    // Si falló y se subió imagen, eliminarla de Cloudinary
    if (req.file?.public_id) {
      try {
        await cloudinary.uploader.destroy(req.file.public_id);
      } catch (_) {}
    }
    res.status(500).json({ error: 'Error al crear material: ' + error.message });
  }
};


// ACTUALIZAR MATERIAL EXISTENTE

const actualizarMaterial = async (req, res) => {
  logRequest('actualizarMaterial');
  const { id } = req.params;
  const { 
    nombre, 
    descripcion, 
    categoria_id, 
    riesgos_fisicos, 
    riesgos_salud, 
    riesgos_ambientales,
    estado,
    mantener_imagen = true // Flag para mantener imagen existente
  } = req.body;
  const { tipo } = req.query;

  if (!tipo) {
    return res.status(400).json({ error: 'Parámetro tipo requerido' });
  }

  try {
    const meta = detectTableAndField(tipo);
    if (!meta) {
      return res.status(400).json({ error: 'Tipo de material inválido' });
    }

    // Obtener imagen actual si existe
    let imagenActual = null;
    if (req.file || mantener_imagen === 'false') {
      const [materialActual] = await pool.query(
        `SELECT imagen FROM ${meta.table} WHERE id = ?`, 
        [id]
      );
      if (materialActual.length > 0) {
        imagenActual = materialActual[0].imagen;
      }
    }

    // Procesar nueva imagen si se subió
    let nuevaImagenUrl = imagenActual; // Por defecto mantener la actual
    
    if (req.file) {
      nuevaImagenUrl = req.file.path; // Nueva imagen desde Cloudinary
      
      // Eliminar imagen anterior de Cloudinary si existía
      if (imagenActual && imagenActual.includes('cloudinary')) {
        try {
          const cloudinary = require('../config/cloudinary');
          // Extraer public_id de la URL de Cloudinary
          const publicId = imagenActual.split('/').pop().split('.')[0];
          await cloudinary.uploader.destroy(`materiales-laboratorio/${publicId}`);
          console.log(`[INFO] Imagen anterior eliminada: ${publicId}`);
        } catch (deleteError) {
          console.warn('[Warn] No se pudo eliminar imagen anterior:', deleteError.message);
        }
      }
    } else if (mantener_imagen === 'false') {
      // Usuario quiere eliminar la imagen
      if (imagenActual && imagenActual.includes('cloudinary')) {
        try {
          const cloudinary = require('../config/cloudinary');
          const publicId = imagenActual.split('/').pop().split('.')[0];
          await cloudinary.uploader.destroy(`materiales-laboratorio/${publicId}`);
          console.log(`[INFO] Imagen eliminada por solicitud del usuario: ${publicId}`);
        } catch (deleteError) {
          console.warn('[Warn] No se pudo eliminar imagen:', deleteError.message);
        }
      }
      nuevaImagenUrl = null;
    }

    // Construir query de actualización
    let query, params;
    
    if (tipo === 'liquido' || tipo === 'solido') {
      query = `
        UPDATE ${meta.table} 
        SET nombre = ?, descripcion = ?, categoria_id = ?, 
            riesgos_fisicos = ?, riesgos_salud = ?, riesgos_ambientales = ?, 
            estado = ?, imagen = ?
        WHERE id = ?
      `;
      params = [
        nombre, 
        descripcion, 
        categoria_id, 
        riesgos_fisicos, 
        riesgos_salud, 
        riesgos_ambientales, 
        estado || 'disponible',
        nuevaImagenUrl,
        id
      ];
    } else if (tipo === 'equipo' || tipo === 'laboratorio') {
      query = `
        UPDATE ${meta.table} 
        SET nombre = ?, descripcion = ?, categoria_id = ?, estado = ?, imagen = ?
        WHERE id = ?
      `;
      params = [
        nombre, 
        descripcion, 
        categoria_id, 
        estado || 'disponible',
        nuevaImagenUrl,
        id
      ];
    }

    const [result] = await pool.query(query, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Material no encontrado' });
    }

    res.json({ 
      message: 'Material actualizado exitosamente',
      imagen_actualizada: req.file ? true : false,
      nueva_imagen_url: nuevaImagenUrl
    });

  } catch (error) {
    console.error('[Error] actualizarMaterial:', error);
    
    // Si hubo error y se subió nueva imagen, eliminarla
    if (req.file && req.file.public_id) {
      try {
        const cloudinary = require('../config/cloudinary');
        await cloudinary.uploader.destroy(req.file.public_id);
        console.log(`[INFO] Nueva imagen eliminada por error: ${req.file.public_id}`);
      } catch (deleteError) {
        console.error('[Error] No se pudo eliminar nueva imagen:', deleteError);
      }
    }

    res.status(500).json({ 
      error: 'Error al actualizar material: ' + error.message 
    });
  }
};

/** Obtener todas las categorías disponibles */
const getCategorias = async (req, res) => {
  logRequest('getCategorias');
  try {
    const [rows] = await pool.query('SELECT id, nombre FROM Categoria ORDER BY nombre');
    res.json(rows);
  } catch (error) {
    console.error('[Error] getCategorias:', error);
    res.status(500).json({ error: 'Error al obtener categorías: ' + error.message });
  }
};

// ELIMINAR MATERIAL (con borrado en Cloudinary)
const eliminarMaterial = async (req, res) => {
  logRequest('eliminarMaterial');
  const { id } = req.params;
  const { tipo } = req.query;

  if (!tipo) {
    return res.status(400).json({ error: 'Parámetro tipo requerido' });
  }

  const meta = detectTableAndField(tipo);
  if (!meta) {
    return res.status(400).json({ error: 'Tipo de material inválido' });
  }

  try {
    // 1) Verificar si tiene solicitudes pendientes
    const [solicitudesPendientes] = await pool.query(
      `SELECT COUNT(*) as count
       FROM SolicitudItem si
       JOIN Solicitud s ON si.solicitud_id = s.id
       WHERE si.material_id = ? AND si.tipo = ? AND s.estado IN ('pendiente','aprobada')`,
      [id, tipo]
    );
    if (solicitudesPendientes[0].count > 0) {
      return res.status(400).json({ error: 'No se puede eliminar material con solicitudes pendientes' });
    }

    // 2) Obtener URL de la imagen
    const [rows] = await pool.query(
      `SELECT imagen FROM ${meta.table} WHERE id = ?`,
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Material no encontrado' });
    }
    const imagenUrl = rows[0].imagen;

    // 3) Eliminar de Cloudinary
    if (imagenUrl) {
      const match = imagenUrl.match(/\/upload\/(?:v\d+\/)?(.+)\.\w+$/);
      if (match && match[1]) {
        const publicId = match[1];
        try {
          await cloudinary.uploader.destroy(publicId);
          console.log(`[INFO] Imagen eliminada de Cloudinary: ${publicId}`);
        } catch (err) {
          console.warn('[Warn] No se pudo eliminar imagen de Cloudinary:', err.message);
        }
      }
    }

    // 4) Borrar de la base de datos
    const [result] = await pool.query(
      `DELETE FROM ${meta.table} WHERE id = ?`,
      [id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Material no encontrado' });
    }

    res.json({ message: 'Material eliminado exitosamente' });
  } catch (error) {
    console.error('[Error] eliminarMaterial:', error);
    res.status(500).json({ error: 'Error al eliminar material: ' + error.message });
  }
};



// ACTUALIZAR STOCK ESPECÍFICO
const actualizarStock = async (req, res) => {
  logRequest('actualizarStock');
  const { id } = req.params;
  const { cantidad, tipo } = req.body;

  if (!tipo || cantidad === undefined) {
    return res.status(400).json({ error: 'Tipo y cantidad son requeridos' });
  }

  try {
    const meta = detectTableAndField(tipo);
    if (!meta) return res.status(400).json({ error: 'Tipo de material inválido' });

    if (cantidad < 0) return res.status(400).json({ error: 'La cantidad no puede ser negativa' });

    const [result] = await pool.query(
      `UPDATE ${meta.table} SET ${meta.field} = ? WHERE id = ?`,
      [cantidad, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Material no encontrado' });
    }

    // Registrar movimiento
    await pool.query(
      'INSERT INTO MovimientosInventario (usuario_id, material_id, tipo, cantidad, tipo_movimiento, motivo) VALUES (?, ?, ?, ?, ?, ?)',
      [req.usuario.id, id, tipo, cantidad, 'ajuste', 'Actualización directa de stock']
    );

    res.json({ message: 'Stock actualizado exitosamente', nuevoStock: cantidad });
  } catch (error) {
    console.error('[Error] actualizarStock:', error);
    res.status(500).json({ error: 'Error al actualizar stock: ' + error.message });
  }
};

// REGISTRAR ENTRADA DE STOCK
const registrarEntradaStock = async (req, res) => {
  logRequest('registrarEntradaStock');
  const { id } = req.params;
  const { cantidad, tipo, motivo } = req.body;

  if (!tipo || !cantidad || cantidad <= 0) {
    return res.status(400).json({ error: 'Tipo y cantidad válida son requeridos' });
  }

  try {
    const meta = detectTableAndField(tipo);
    if (!meta) return res.status(400).json({ error: 'Tipo de material inválido' });

    // Obtener stock actual
    const [material] = await pool.query(`SELECT ${meta.field} FROM ${meta.table} WHERE id = ?`, [id]);
    if (!material.length) return res.status(404).json({ error: 'Material no encontrado' });

    const nuevoStock = material[0][meta.field] + parseInt(cantidad);

    // Actualizar stock
    await pool.query(`UPDATE ${meta.table} SET ${meta.field} = ? WHERE id = ?`, [nuevoStock, id]);

    // Registrar movimiento solo si la tabla existe
    try {
      await pool.query(
        'INSERT INTO MovimientosInventario (usuario_id, material_id, tipo, cantidad, tipo_movimiento, motivo) VALUES (?, ?, ?, ?, ?, ?)',
        [req.usuario?.id || 1, id, tipo, cantidad, 'entrada', motivo || 'Entrada de stock']
      );
    } catch (movError) {
      console.warn('[Warn] No se pudo registrar movimiento:', movError.message);
    }

    res.json({ 
      message: 'Entrada de stock registrada exitosamente',
      stockAnterior: material[0][meta.field],
      cantidadAgregada: cantidad,
      nuevoStock: nuevoStock
    });
  } catch (error) {
    console.error('[Error] registrarEntradaStock:', error);
    res.status(500).json({ error: 'Error al registrar entrada: ' + error.message });
  }
};

// REGISTRAR SALIDA DE STOCK
const registrarSalidaStock = async (req, res) => {
  logRequest('registrarSalidaStock');
  const { id } = req.params;
  const { cantidad, tipo, motivo } = req.body;

  if (!tipo || !cantidad || cantidad <= 0) {
    return res.status(400).json({ error: 'Tipo y cantidad válida son requeridos' });
  }

  try {
    const meta = detectTableAndField(tipo);
    if (!meta) return res.status(400).json({ error: 'Tipo de material inválido' });

    // Obtener stock actual
    const [material] = await pool.query(`SELECT ${meta.field} FROM ${meta.table} WHERE id = ?`, [id]);
    if (!material.length) return res.status(404).json({ error: 'Material no encontrado' });

    const stockActual = material[0][meta.field];
    if (stockActual < cantidad) {
      return res.status(400).json({ error: 'Stock insuficiente para la salida solicitada' });
    }

    const nuevoStock = stockActual - parseInt(cantidad);

    // Actualizar stock
    await pool.query(`UPDATE ${meta.table} SET ${meta.field} = ? WHERE id = ?`, [nuevoStock, id]);

    // Registrar movimiento
    await pool.query(
      'INSERT INTO MovimientosInventario (usuario_id, material_id, tipo, cantidad, tipo_movimiento, motivo) VALUES (?, ?, ?, ?, ?, ?)',
      [req.usuario.id, id, tipo, -cantidad, 'salida', motivo || 'Salida de stock']
    );

    res.json({ 
      message: 'Salida de stock registrada exitosamente',
      stockAnterior: stockActual,
      cantidadRetirada: cantidad,
      nuevoStock: nuevoStock
    });
  } catch (error) {
    console.error('[Error] registrarSalidaStock:', error);
    res.status(500).json({ error: 'Error al registrar salida: ' + error.message });
  }
};

// CREAR CATEGORÍA
const crearCategoria = async (req, res) => {
  logRequest('crearCategoria');
  const { nombre } = req.body;

  if (!nombre) return res.status(400).json({ error: 'Nombre de categoría requerido' });

  try {
    const [result] = await pool.query('INSERT INTO Categoria (nombre) VALUES (?)', [nombre]);
    res.status(201).json({ 
      message: 'Categoría creada exitosamente', 
      categoriaId: result.insertId 
    });
  } catch (error) {
    console.error('[Error] crearCategoria:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'La categoría ya existe' });
    }
    res.status(500).json({ error: 'Error al crear categoría: ' + error.message });
  }
};

// ACTUALIZAR CATEGORÍA
const actualizarCategoria = async (req, res) => {
  logRequest('actualizarCategoria');
  const { id } = req.params;
  const { nombre } = req.body;

  if (!nombre) return res.status(400).json({ error: 'Nombre de categoría requerido' });

  try {
    const [result] = await pool.query('UPDATE Categoria SET nombre = ? WHERE id = ?', [nombre, id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }

    res.json({ message: 'Categoría actualizada exitosamente' });
  } catch (error) {
    console.error('[Error] actualizarCategoria:', error);
    res.status(500).json({ error: 'Error al actualizar categoría: ' + error.message });
  }
};

// ELIMINAR CATEGORÍA
const eliminarCategoria = async (req, res) => {
  logRequest('eliminarCategoria');
  const { id } = req.params;

  try {
    // Verificar si hay materiales usando esta categoría
    const [materialesUsandoCategoria] = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM MaterialLiquido WHERE categoria_id = ?) +
        (SELECT COUNT(*) FROM MaterialSolido WHERE categoria_id = ?) +
        (SELECT COUNT(*) FROM MaterialEquipo WHERE categoria_id = ?) +
        (SELECT COUNT(*) FROM MaterialLaboratorio WHERE categoria_id = ?) as total
    `, [id, id, id, id]);

    if (materialesUsandoCategoria[0].total > 0) {
      return res.status(400).json({ error: 'No se puede eliminar categoría con materiales asociados' });
    }

    const [result] = await pool.query('DELETE FROM Categoria WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }

    res.json({ message: 'Categoría eliminada exitosamente' });
  } catch (error) {
    console.error('[Error] eliminarCategoria:', error);
    res.status(500).json({ error: 'Error al eliminar categoría: ' + error.message });
  }
};

// OBTENER USUARIOS CON PERMISOS
const getUsuariosConPermisos = async (req, res) => {
  logRequest('getUsuariosConPermisos');
  try {
    const [usuarios] = await pool.query(`
      SELECT 
        u.id,
        u.nombre,
        u.correo_institucional,
        r.nombre as rol,
        u.activo,
        COALESCE(p.acceso_chat, FALSE) as acceso_chat,
        COALESCE(p.modificar_stock, FALSE) as modificar_stock,
        p.fecha_actualizacion
      FROM Usuario u
      JOIN Rol r ON u.rol_id = r.id
      LEFT JOIN PermisosAlmacen p ON u.id = p.usuario_id
      ORDER BY r.id, u.nombre
    `);

    res.json(usuarios);
  } catch (error) {
    console.error('[Error] getUsuariosConPermisos:', error);
    res.status(500).json({ error: 'Error al obtener usuarios: ' + error.message });
  }
};


// ESTADO DEL SISTEMA (sin estado de permisos)
const getEstadoSistema = async (req, res) => {
  logRequest('getEstadoSistema');
  try {
    // Información de la base de datos
    const [dbInfo] = await pool.query('SELECT VERSION() as version, NOW() as servidor_tiempo');
    
    // Contadores generales
    const [contadores] = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM Usuario WHERE activo = 1) as usuarios_activos,
        (SELECT COUNT(*) FROM Solicitud WHERE fecha_solicitud = CURDATE()) as solicitudes_hoy,
        (SELECT COUNT(*) FROM Mensaje WHERE DATE(fecha_envio) = CURDATE()) as mensajes_hoy,
        (SELECT COUNT(*) FROM MovimientosInventario WHERE DATE(fecha_movimiento) = CURDATE()) as movimientos_hoy
    `);

    // Últimas actividades
    const [ultimasActividades] = await pool.query(`
      SELECT 'solicitud' as tipo, fecha_solicitud as fecha, nombre_alumno as detalle
      FROM Solicitud 
      ORDER BY fecha_solicitud DESC 
      LIMIT 5
    `);

    res.json({
      sistema: {
        version_bd: dbInfo[0].version,
        servidor_tiempo: dbInfo[0].servidor_tiempo,
        uptime: process.uptime(),
        memoria_uso: process.memoryUsage()
      },
      actividad_hoy: {
        usuarios_activos: contadores[0].usuarios_activos,
        solicitudes: contadores[0].solicitudes_hoy,
        mensajes: contadores[0].mensajes_hoy,
        movimientos: contadores[0].movimientos_hoy
      },
      ultimas_actividades: ultimasActividades,
      estado: 'OPERATIVO'
    });

  } catch (error) {
    console.error('[Error] getEstadoSistema:', error);
    res.status(500).json({ error: 'Error al obtener estado del sistema: ' + error.message });
  }
};


const verifyImage = async (req, res) => {
  logRequest('verifyImage');
  const { public_id } = req.query;

  if (!public_id) {
    return res.status(400).json({ error: 'public_id es requerido' });
  }

  try {
    await cloudinary.api.resource(public_id);
    res.json({ exists: true });
  } catch (error) {
    if (error.error && error.error.http_code === 404) {
      res.json({ exists: false });
    } else {
      console.error('[Error] verifyImage:', error);
      res.status(500).json({ error: 'Error al verificar imagen: ' + error.message });
    }
  }
};

// Docente: ver solicitudes de alumnos que debe aprobar (solo 'pendiente' asignadas a él)
// (con alias id = s.id para consistencia con el frontend)
const getSolicitudesParaDocenteAprobar = async (req, res) => {
  logRequest('getSolicitudesParaDocenteAprobar');
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token requerido' });

  try {
    await cleanupExpiredSolicitudes();
    const { id: docente_id, rol_id } = jwt.verify(token, process.env.JWT_SECRET);
    if (rol_id !== 2 && rol_id !== 4) return res.status(403).json({ error: 'Solo docentes o admin' });

    const query = `
      SELECT 
        s.id AS id,
        s.id AS solicitud_id,
        s.usuario_id,
        s.fecha_solicitud,
         s.fecha_recoleccion,
        s.fecha_devolucion,
        s.estado,
        s.nombre_alumno,
        s.profesor,
        s.folio,
        si.id  AS item_id,
        si.material_id,
        si.tipo,
        si.cantidad,
        COALESCE(ml.nombre, ms.nombre, me.nombre, mlab.nombre) AS nombre_material,
        g.nombre AS grupo_nombre
      FROM Solicitud s
      JOIN SolicitudItem si ON s.id = si.solicitud_id
      LEFT JOIN MaterialLiquido ml ON si.tipo = 'liquido' AND si.material_id = ml.id
      LEFT JOIN MaterialSolido ms ON si.tipo = 'solido' AND si.material_id = ms.id
      LEFT JOIN MaterialEquipo me ON si.tipo = 'equipo' AND si.material_id = me.id
      LEFT JOIN MaterialLaboratorio mlab ON si.tipo = 'laboratorio' AND si.material_id = mlab.id
      LEFT JOIN Grupo g ON s.grupo_id = g.id
      WHERE s.estado = 'pendiente' AND s.docente_id = ?
      ORDER BY s.fecha_solicitud DESC
    `;

    const [rows] = await pool.query(query, [docente_id]);
    const soloAlumnos = rows.filter(r => !!r.nombre_alumno);
    res.json(soloAlumnos);
  } catch (error) {
    console.error('[Error] getSolicitudesParaDocenteAprobar:', error);
    res.status(500).json({ error: 'Error al obtener solicitudes para aprobar: ' + error.message });
  }
};


// Docente: ver sus propias solicitudes (las que él creó)
// Docente: ver sus propias solicitudes creadas (con alias id = s.id)
const getSolicitudesDocentePropias = async (req, res) => {
  logRequest('getSolicitudesDocentePropias');
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token requerido' });

  try {
    await cleanupExpiredSolicitudes();
    const { id: docente_id, rol_id } = jwt.verify(token, process.env.JWT_SECRET);
    if (rol_id !== 2 && rol_id !== 4) return res.status(403).json({ error: 'Solo docentes o admin' });

    const query = `
      SELECT 
        s.id AS id,
        s.id AS solicitud_id,
        s.usuario_id,
        s.fecha_solicitud,
         s.fecha_recoleccion,
        s.fecha_devolucion,
        s.estado,
        s.nombre_alumno,
        s.profesor,
        s.folio,
        si.id  AS item_id,
        si.material_id,
        si.tipo,
        si.cantidad,
        COALESCE(ml.nombre, ms.nombre, me.nombre, mlab.nombre) AS nombre_material,
        g.nombre AS grupo_nombre
      FROM Solicitud s
      JOIN SolicitudItem si ON s.id = si.solicitud_id
      LEFT JOIN MaterialLiquido ml ON si.tipo = 'liquido' AND si.material_id = ml.id
      LEFT JOIN MaterialSolido ms ON si.tipo = 'solido' AND si.material_id = ms.id
      LEFT JOIN MaterialEquipo me ON si.tipo = 'equipo' AND si.material_id = me.id
      LEFT JOIN MaterialLaboratorio mlab ON si.tipo = 'laboratorio' AND si.material_id = mlab.id
      LEFT JOIN Grupo g ON s.grupo_id = g.id
      WHERE s.usuario_id = ?
      ORDER BY s.fecha_solicitud DESC
    `;

    const [rows] = await pool.query(query, [docente_id]);
    const propiasDocente = rows.filter(r => !r.nombre_alumno);
    res.json(propiasDocente);
  } catch (error) {
    console.error('[Error] getSolicitudesDocentePropias:', error);
    res.status(500).json({ error: 'Error al obtener solicitudes del docente: ' + error.message });
  }
};


// Almacén/Admin: ver todas las solicitudes (con alias id = s.id)
const getSolicitudesParaAlmacen = async (req, res) => {
  logRequest('getSolicitudesParaAlmacen');
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token requerido' });

  try {
    await cleanupExpiredSolicitudes();
    const { rol_id } = jwt.verify(token, process.env.JWT_SECRET);
    if (rol_id !== 3 && rol_id !== 4) {
      return res.status(403).json({ error: 'Solo almacenistas o admin' });
    }

    const query = `
      SELECT 
        s.id AS id,
        s.id AS solicitud_id,
        s.usuario_id,
        s.fecha_solicitud,
        s.fecha_recoleccion,
        s.fecha_devolucion,
        s.estado,
        s.nombre_alumno,
        s.profesor,
        s.folio,
        si.id  AS item_id,
        si.material_id,
        si.tipo,
        si.cantidad,
        COALESCE(ml.nombre, ms.nombre, me.nombre, mlab.nombre) AS nombre_material,
        g.nombre AS grupo_nombre
      FROM Solicitud s
      JOIN SolicitudItem si ON s.id = si.solicitud_id
      LEFT JOIN MaterialLiquido ml ON si.tipo = 'liquido' AND si.material_id = ml.id
      LEFT JOIN MaterialSolido ms ON si.tipo = 'solido' AND si.material_id = ms.id
      LEFT JOIN MaterialEquipo me ON si.tipo = 'equipo' AND si.material_id = me.id
      LEFT JOIN MaterialLaboratorio mlab ON si.tipo = 'laboratorio' AND si.material_id = mlab.id
      LEFT JOIN Grupo g ON s.grupo_id = g.id
      ORDER BY s.fecha_solicitud DESC
    `;

    const [rows] = await pool.query(query);
    res.json(rows);
  } catch (error) {
    console.error('[Error] getSolicitudesParaAlmacen:', error);
    res.status(500).json({ error: 'Error al obtener solicitudes: ' + error.message });
  }
};


/** 
 * Adeudos del usuario (alumno o docente) con nombre del material y unidad
 * GET /api/materials/adeudos
 */
const getAdeudosUsuario = async (req, res) => {
  logRequest('getAdeudosUsuario');
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token requerido' });

  try {
    const { id: usuario_id } = jwt.verify(token, process.env.JWT_SECRET);

    const [rows] = await pool.query(`
      SELECT
        a.id,
        a.solicitud_id,
        a.solicitud_item_id,
        a.usuario_id,
        s.folio,
        a.material_id,
        a.tipo,
        a.cantidad_pendiente AS cantidad,
        COALESCE(ml.nombre, ms.nombre, me.nombre, mlab.nombre) AS nombre_material,
        CASE a.tipo 
          WHEN 'liquido' THEN 'ml'
          WHEN 'solido'  THEN 'g'
          ELSE 'u'
        END AS unidad
      FROM Adeudo a
      JOIN Solicitud s ON s.id = a.solicitud_id
      LEFT JOIN MaterialLiquido ml
  ON TRIM(LOWER(a.tipo)) = 'liquido'     AND a.material_id = ml.id
LEFT JOIN MaterialSolido ms
  ON TRIM(LOWER(a.tipo)) = 'solido'      AND a.material_id = ms.id
LEFT JOIN MaterialEquipo me
  ON TRIM(LOWER(a.tipo)) = 'equipo'      AND a.material_id = me.id
LEFT JOIN MaterialLaboratorio mlab
  ON TRIM(LOWER(a.tipo)) = 'laboratorio' AND a.material_id = mlab.id
      WHERE a.usuario_id = ? AND a.cantidad_pendiente > 0
      ORDER BY s.fecha_solicitud DESC, a.id DESC
    `, [usuario_id]);

    res.json(rows);
  } catch (error) {
    console.error('[Error] getAdeudosUsuario:', error);
    res.status(500).json({ error: 'Error al obtener adeudos: ' + error.message });
  }
};


/**
 * Adeudos del usuario incluyendo fecha_devolucion (para marcar vencidos en UI)
 * GET /api/materials/adeudos/entrega
 */
const getAdeudosConFechaEntrega = async (req, res) => {
  logRequest('getAdeudosConFechaEntrega');
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token requerido' });

  try {
    const { id: usuario_id } = jwt.verify(token, process.env.JWT_SECRET);

    const [rows] = await pool.query(`
      SELECT
        a.id,
        a.solicitud_id,
        a.solicitud_item_id,
        a.usuario_id,
        s.folio,
        a.material_id,
        a.tipo,
        a.cantidad_pendiente AS cantidad,
        COALESCE(ml.nombre, ms.nombre, me.nombre, mlab.nombre) AS nombre_material,
         CASE a.tipo
          WHEN 'liquido' THEN 'ml'
          WHEN 'solido'  THEN 'g'
          ELSE 'u'
        END AS unidad,
        COALESCE(a.fecha_entrega, s.fecha_devolucion) AS fecha_devolucion
      FROM Adeudo a
      JOIN Solicitud s ON s.id = a.solicitud_id
  LEFT JOIN MaterialLiquido ml
  ON TRIM(LOWER(a.tipo)) = 'liquido'     AND a.material_id = ml.id
LEFT JOIN MaterialSolido ms
  ON TRIM(LOWER(a.tipo)) = 'solido'      AND a.material_id = ms.id
LEFT JOIN MaterialEquipo me
  ON TRIM(LOWER(a.tipo)) = 'equipo'      AND a.material_id = me.id
LEFT JOIN MaterialLaboratorio mlab
  ON TRIM(LOWER(a.tipo)) = 'laboratorio' AND a.material_id = mlab.id

      WHERE a.usuario_id = ? AND a.cantidad_pendiente > 0
      ORDER BY s.fecha_solicitud DESC, a.id DESC
    `, [usuario_id]);

    res.json(rows);
  } catch (error) {
    console.error('[Error] getAdeudosConFechaEntrega:', error);
    res.status(500).json({ error: 'Error al obtener adeudos con fecha: ' + error.message });
  }
};


module.exports = {
  // Catálogo de materiales por tipo
  getLiquidos,
  getSolidos,
  getEquipos,
  getLaboratorio,
  getInventarioLiquidosReport,
  getInventarioSolidosReport,
  
  // Materiales generales
  getMaterials,
  getMaterialById,
  
  // CRUD de materiales
  crearMaterial,
  actualizarMaterial,
  eliminarMaterial,
  
  // Gestión de stock
  actualizarStock,
  registrarEntradaStock,
  registrarSalidaStock,
  adjustInventory,
  ajusteMasivoStock,
  getMaterialesStockBajo,
  
  // Solicitudes - CRUD
  crearSolicitudes,
  crearSolicitudConAdeudo,
  getAllSolicitudes,
  getUserSolicitudes,
  getApprovedSolicitudes,
  getPendingSolicitudes,
  getDeliveredSolicitudes,
  getSolicitudDetalle,
  
  // Acciones sobre solicitudes
  approveSolicitud,
  rejectSolicitud,
  deliverSolicitud,
  cancelSolicitud,
  
  // Categorías
  crearCategoria,
  actualizarCategoria,
  eliminarCategoria,
  getCategorias,
  
  // Estadísticas y reportes
  getHistorialMovimientos,
  getHistorialSolicitudes,
  obtenerDocentesParaSolicitud,
  
  // Usuarios y permisos
  getUsuariosConPermisos,
  
  // Sistema y administración
  getEstadoSistema,

  verifyImage,
  getSolicitudesParaDocenteAprobar,
  getSolicitudesDocentePropias,
  getSolicitudesParaAlmacen,

  getAdeudosUsuario,
  getAdeudosConFechaEntrega
};
