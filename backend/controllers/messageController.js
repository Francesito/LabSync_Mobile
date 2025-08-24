// backend/controllers/messageController.js

const pool = require('../config/db');
const { crearNotificacion } = require('../models/notificacion');

/**
 * ==========================================================================================
 * MessageController - LabSync Chat
 * ==========================================================================================
 * Rutas:
 *  - POST   /api/messages/send          => sendMessage
 *  - GET    /api/messages/:userId       => getMessages
 *  - GET    /api/messages/users         => getContactos
 *  - GET    /api/messages/all           => getAllByRole (opcional)
 *  - DELETE /api/messages/cleanup       => cleanupOldMessages (limpieza automática)
 *
 * Nota: usar siempre `req.usuario` (no `req.user`) como setea verificarToken
 * ==========================================================================================
 */

/**
 * Limpiar mensajes antiguos (más de 7 días)
 * Esta función se puede llamar automáticamente o manualmente
 */
const cleanupOldMessages = async () => {
  try {
    const [result] = await pool.query(
      'DELETE FROM Mensaje WHERE fecha_envio < DATE_SUB(NOW(), INTERVAL 7 DAY)'
    );
    console.log(`[Cleanup] Eliminados ${result.affectedRows} mensajes antiguos`);
    return result.affectedRows;
  } catch (error) {
    console.error('[Error] cleanupOldMessages:', error);
    throw error;
  }
};

/**
 * Enviar un mensaje
 * POST /api/messages/send
 * Body: { contenido, receptor_id }
 */
exports.sendMessage = async (req, res) => {
  try {
    // Limpiar mensajes antiguos antes de enviar
    await cleanupOldMessages();

    const { contenido, receptor_id } = req.body;
    const emisor_id = req.usuario.id;

    // Validar contenido
    if (!contenido || !contenido.trim()) {
      return res.status(400).json({ error: 'El contenido del mensaje es requerido' });
    }

    // Validar receptor_id
    if (!receptor_id) {
      return res.status(400).json({ error: 'El receptor es requerido' });
    }

    // 1) Verificar existencia del receptor
    const [receptor] = await pool.query(
      'SELECT id, rol_id FROM Usuario WHERE id = ?',
      [receptor_id]
    );
    if (receptor.length === 0) {
      return res.status(404).json({ error: 'Usuario receptor no encontrado' });
    }

    // 2) Verificar permisos de chat (alumno solo puede hablar con almacenistas y viceversa)
    const emisorRol = req.usuario.rol_id;
    const receptorRol = receptor[0].rol_id;
    
    if (!((emisorRol === 1 && receptorRol === 3) || (emisorRol === 3 && receptorRol === 1))) {
      return res.status(403).json({ error: 'No tienes permisos para enviar mensajes a este usuario' });
    }

    // 3) Insertar el mensaje
    const [result] = await pool.query(
      'INSERT INTO Mensaje (emisor_id, receptor_id, contenido, fecha_envio) VALUES (?, ?, ?, NOW())',
      [emisor_id, receptor_id, contenido.trim()]
    );

    // 4) Recuperar y devolver el mensaje completo
    const [mensaje] = await pool.query(
      `SELECT
         m.id,
         m.emisor_id,
         m.receptor_id,
         m.contenido,
         m.fecha_envio,
         e.nombre AS emisor,
         r.nombre AS receptor
       FROM Mensaje m
       JOIN Usuario e ON m.emisor_id   = e.id
       JOIN Usuario r ON m.receptor_id = r.id
       WHERE m.id = ?`,
      [result.insertId]
    );

      // 5) Crear notificación para el receptor
    try {
      const mensajeNotif = `Nuevo mensaje de ${req.usuario.nombre}`;
      await crearNotificacion(receptor_id, 'mensaje', mensajeNotif);
    } catch (err) {
      console.error('Error al crear notificación de mensaje:', err);
    }
    
    res.status(201).json(mensaje[0]);
  } catch (error) {
    console.error('[Error] sendMessage:', error);
    res.status(500).json({ error: 'Error al enviar mensaje' });
  }
};

/**
 * Obtener todos los mensajes entre el usuario actual y otro usuario
 * GET /api/messages/:userId
 */
exports.getMessages = async (req, res) => {
  try {
    // Limpiar mensajes antiguos antes de obtener
    await cleanupOldMessages();

    const currentUserId = req.usuario.id;
    const { userId } = req.params;

    // Validar que el userId sea válido
    if (!userId || isNaN(userId)) {
      return res.status(400).json({ error: 'ID de usuario inválido' });
    }

    // Verificar que el usuario con el que se quiere chatear existe
    const [targetUser] = await pool.query(
      'SELECT id, rol_id FROM Usuario WHERE id = ?',
      [userId]
    );

    if (targetUser.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Verificar permisos de chat
    const currentUserRol = req.usuario.rol_id;
    const targetUserRol = targetUser[0].rol_id;
    
    if (!((currentUserRol === 1 && targetUserRol === 3) || (currentUserRol === 3 && targetUserRol === 1))) {
      return res.status(403).json({ error: 'No tienes permisos para ver mensajes con este usuario' });
    }

    const [mensajes] = await pool.query(
      `SELECT
         m.id,
         m.emisor_id,
         m.receptor_id,
         m.contenido,
         m.fecha_envio,
         e.nombre AS emisor,
         r.nombre AS receptor
       FROM Mensaje m
       JOIN Usuario e ON m.emisor_id   = e.id
       JOIN Usuario r ON m.receptor_id = r.id
       WHERE (m.emisor_id = ? AND m.receptor_id = ?)
          OR (m.emisor_id = ? AND m.receptor_id = ?)
       ORDER BY m.fecha_envio ASC`,
      [currentUserId, userId, userId, currentUserId]
    );

    res.json(mensajes);
  } catch (error) {
    console.error('[Error] getMessages:', error);
    res.status(500).json({ error: 'Error al obtener mensajes' });
  }
};

/**
 * Obtener lista de contactos:
 *  - Si soy alumno (rol_id=1), veo TODOS los almacenistas
 *  - Si soy almacenista (rol_id=3), veo sólo alumnos con quienes he chateado
 * GET /api/messages/users
 */
exports.getContactos = async (req, res) => {
  try {
    // Limpiar mensajes antiguos antes de obtener contactos
    await cleanupOldMessages();

    const currentUserId = req.usuario.id;
    const rolId = req.usuario.rol_id; // 1 = alumno, 3 = almacen

    // Alumno: ver todos los almacenistas
    if (rolId === 1) {
      const [users] = await pool.query(
        `SELECT u.id, u.nombre, r.nombre AS rol
           FROM Usuario u
           JOIN Rol r ON u.rol_id = r.id
          WHERE u.rol_id = 3
            AND u.id != ?
          ORDER BY u.nombre ASC`,
        [currentUserId]
      );
      return res.json(users);
    }

    // Almacenista: ver sólo alumnos con quienes he chateado
    if (rolId === 3) {
      const [contacts] = await pool.query(
        `SELECT DISTINCT u.id, u.nombre, r.nombre AS rol
           FROM Mensaje m
           JOIN Usuario u
             ON (u.id = m.emisor_id   AND m.receptor_id = ?)
             OR (u.id = m.receptor_id AND m.emisor_id    = ?)
           JOIN Rol r ON u.rol_id = r.id
          WHERE u.rol_id = 1
          ORDER BY u.nombre ASC`,
        [currentUserId, currentUserId]
      );
      return res.json(contacts);
    }

    // Otros roles: no permitido
    res.status(403).json({ error: 'No tienes permiso para usar el chat' });
  } catch (error) {
    console.error('[Error] getContactos:', error);
    res.status(500).json({ error: 'Error al obtener contactos' });
  }
};

/**
 * (Opcional) Obtener TODOS los usuarios de un rol dado
 * GET /api/messages/all?rol=<rol>
 */
exports.getAllByRole = async (req, res) => {
  try {
    const { rol } = req.query;
    const map = { alumno: 1, almacen: 3 };
    
    if (!rol || !map[rol]) {
      return res.status(400).json({ error: 'Parámetro rol debe ser "alumno" o "almacen"' });
    }

    const [rows] = await pool.query(
      `SELECT u.id, u.nombre, r.nombre AS rol
         FROM Usuario u
         JOIN Rol r ON u.rol_id = r.id
        WHERE u.rol_id = ?
          AND u.id != ?
        ORDER BY u.nombre ASC`,
      [map[rol], req.usuario.id]
    );

    res.json(rows);
  } catch (error) {
    console.error('[Error] getAllByRole:', error);
    res.status(500).json({ error: 'Error al obtener usuarios por rol' });
  }
};

/**
 * Endpoint manual para limpiar mensajes antiguos
 * DELETE /api/messages/cleanup
 */
exports.cleanupMessages = async (req, res) => {
  try {
    const deletedCount = await cleanupOldMessages();
    res.json({ 
      message: 'Limpieza completada',
      deletedMessages: deletedCount 
    });
  } catch (error) {
    console.error('[Error] cleanupMessages:', error);
    res.status(500).json({ error: 'Error al limpiar mensajes antiguos' });
  }
};

// Exportar función de limpieza para uso en cron jobs
exports.cleanupOldMessages = cleanupOldMessages;
