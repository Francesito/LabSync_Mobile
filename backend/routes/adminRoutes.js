// routes/adminRoutes.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { sendEmail } = require('../utils/email');
const { verificarToken, requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

// Middleware para verificar que es administrador
router.use(verificarToken);
router.use(requireAdmin);

// Generar contraseña aleatoria
const generarContrasenaAleatoria = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// ==================== GESTIÓN DE USUARIOS ====================

// Crear nuevo usuario
router.post('/crear-usuario', async (req, res) => {
  const { nombre, correo_institucional, rol_id, contrasena } = req.body;

  console.log('Datos recibidos:', { nombre, correo_institucional, rol_id, contrasena });

  // Validaciones
  if (!nombre || !correo_institucional || !rol_id) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  if (!correo_institucional.endsWith('@utsjr.edu.mx')) {
    return res.status(400).json({ error: 'Correo institucional inválido' });
  }

  // Solo permitir roles de docente, almacen y administrador
  if (![2, 3, 4].includes(parseInt(rol_id))) {
    return res.status(400).json({ error: 'Rol no válido' });
  }

  try {
    // Verificar si el usuario ya existe
    const [existingUser] = await pool.query(
      'SELECT * FROM Usuario WHERE correo_institucional = ?', 
      [correo_institucional]
    );
    
    if (existingUser.length > 0) {
      return res.status(400).json({ error: 'El correo ya está registrado' });
    }

    // Generar contraseña si no se proporciona
    const passwordToUse = contrasena || generarContrasenaAleatoria();
    const hash = await bcrypt.hash(passwordToUse, 10);

    console.log('Creando usuario con hash:', hash.substring(0, 20) + '...');

    // Crear usuario activo
    const [result] = await pool.query(
      'INSERT INTO Usuario (nombre, correo_institucional, contrasena, rol_id, activo) VALUES (?, ?, ?, ?, TRUE)',
      [nombre, correo_institucional, hash, parseInt(rol_id)]
    );

    console.log('Usuario creado con ID:', result.insertId);

    // Si es usuario de almacén, crear registro en tabla de permisos
    if (parseInt(rol_id) === 3) {
      try {
        await pool.query(
          'INSERT INTO PermisosAlmacen (usuario_id, acceso_chat, modificar_stock) VALUES (?, FALSE, FALSE)',
          [result.insertId]
        );
        console.log('Permisos de almacén creados');
      } catch (permissionError) {
        console.error('Error al crear permisos de almacén:', permissionError);
        // No fallar la creación del usuario por esto
      }
    }

    // Generar token para reset de contraseña
    const resetToken = jwt.sign(
      { correo_institucional }, 
      process.env.JWT_SECRET, 
      { expiresIn: '24h' }
    );

    // Actualizar usuario con token de reset
    await pool.query(
      'UPDATE Usuario SET reset_token = ?, reset_token_expires = DATE_ADD(NOW(), INTERVAL 24 HOUR) WHERE id = ?',
      [resetToken, result.insertId]
    );

    // Enviar correo con enlace para establecer contraseña
    try {
      const frontendUrl = process.env.FRONTEND_URL || 'https://labsync-frontend.onrender.com';
     const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;
      const emailText = `Cuenta creada - Establece tu contraseña: ${resetUrl}`;
      const cleanName = nombre.replace(/\b(Almacen|Docente|Administrador)\b/gi, '').trim();
  const emailHtml = `
  <div style="font-family:Arial, sans-serif; background-color:#f4f6f8; padding:30px;">
    <div style="max-width:500px; margin:auto; background:#ffffff; border-radius:8px; padding:30px; box-shadow:0 2px 8px rgba(0,0,0,0.1);">

      <p style="color:#333333; font-size:16px; line-height:1.5; white-space:pre-line;">
        Hola ${cleanName},
        
        Se ha creado una cuenta para ti en el sistema LabSync.
        
        Para establecer tu contraseña, haz clic en el botón de abajo:
      </p>

      <div style="text-align:center; margin:30px 0;">
        <a href="${resetUrl}" 
           style="display:inline-block;
                  padding:14px 28px;
                  background-color:#000080;
                  color:#ffffff;
                  font-size:16px;
                  font-weight:bold;
                  text-decoration:none;
                  border-radius:6px;">
          Establecer Contraseña
        </a>
      </div>

      <p style="color:#333333; font-size:16px; line-height:1.5;">
        Este enlace expirará en 24 horas.
      </p>

      <p style="color:#333333; font-size:14px; margin-top:40px; text-align:right; font-style:italic;">
        Saludos,<br>
        Equipo LabSync
      </p>
    </div>
  </div>
`;


      await sendEmail(
        correo_institucional,
        'Cuenta creada - Establece tu contraseña',
        emailText,
        emailHtml
      );
      console.log('Correo enviado exitosamente');
    } catch (emailError) {
      console.error('Error al enviar correo:', emailError);
      // No fallar la creación del usuario por error de correo
    }

    res.status(201).json({ 
      mensaje: 'Usuario creado exitosamente. Se ha enviado un enlace para establecer la contraseña.',
      usuario_id: result.insertId
    });

  } catch (error) {
    console.error('Error al crear usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
  }
});

// Obtener usuarios de almacén
router.get('/usuarios-almacen', async (req, res) => {
  try {
    const [usuarios] = await pool.query(`
      SELECT 
        u.id,
        u.nombre,
        u.correo_institucional,
        u.activo,
        COALESCE(p.acceso_chat, FALSE) as acceso_chat,
        COALESCE(p.modificar_stock, FALSE) as modificar_stock
      FROM Usuario u
      LEFT JOIN PermisosAlmacen p ON u.id = p.usuario_id
      WHERE u.rol_id = 3
      ORDER BY u.nombre ASC
    `);

    res.json(usuarios);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ==================== GESTIÓN DE PERMISOS ====================

// ✅ Actualizar permisos de usuario (MEJORADO para manejar ambos permisos)
router.put('/actualizar-permisos', async (req, res) => {
  const { usuario_id, campo, valor } = req.body;

  if (!usuario_id || !campo || valor === undefined) {
    return res.status(400).json({ error: 'Datos incompletos' });
  }

  // Validar campos permitidos
  const camposPermitidos = ['acceso_chat', 'modificar_stock'];
  if (!camposPermitidos.includes(campo)) {
    return res.status(400).json({ error: 'Campo no válido' });
  }

  try {
    // Verificar que el usuario existe y es de almacén
    const [usuario] = await pool.query(
      'SELECT * FROM Usuario WHERE id = ? AND rol_id = 3',
      [usuario_id]
    );

    if (usuario.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Verificar si ya existe registro de permisos
    const [permisos] = await pool.query(
      'SELECT * FROM PermisosAlmacen WHERE usuario_id = ?',
      [usuario_id]
    );

    if (permisos.length === 0) {
      // Crear registro de permisos
      await pool.query(
        'INSERT INTO PermisosAlmacen (usuario_id, acceso_chat, modificar_stock) VALUES (?, ?, ?)',
        [usuario_id, campo === 'acceso_chat' ? valor : false, campo === 'modificar_stock' ? valor : false]
      );
    } else {
      // Actualizar permiso existente
      await pool.query(
        `UPDATE PermisosAlmacen SET ${campo} = ? WHERE usuario_id = ?`,
        [valor, usuario_id]
      );
    }

    res.json({ mensaje: `Permiso ${campo} actualizado correctamente` });

  } catch (error) {
    console.error('Error al actualizar permisos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ✅ NUEVA RUTA: Actualizar múltiples permisos a la vez
router.put('/actualizar-todos-permisos', async (req, res) => {
  const { usuario_id, acceso_chat, modificar_stock } = req.body;

  if (!usuario_id || acceso_chat === undefined || modificar_stock === undefined) {
    return res.status(400).json({ error: 'Datos incompletos' });
  }

  try {
    // Verificar que el usuario existe y es de almacén
    const [usuario] = await pool.query(
      'SELECT * FROM Usuario WHERE id = ? AND rol_id = 3',
      [usuario_id]
    );

    if (usuario.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Verificar si ya existe registro de permisos
    const [permisos] = await pool.query(
      'SELECT * FROM PermisosAlmacen WHERE usuario_id = ?',
      [usuario_id]
    );

    if (permisos.length === 0) {
      // Crear registro de permisos
      await pool.query(
        'INSERT INTO PermisosAlmacen (usuario_id, acceso_chat, modificar_stock) VALUES (?, ?, ?)',
        [usuario_id, acceso_chat, modificar_stock]
      );
    } else {
      // Actualizar permisos existentes
      await pool.query(
        'UPDATE PermisosAlmacen SET acceso_chat = ?, modificar_stock = ? WHERE usuario_id = ?',
        [acceso_chat, modificar_stock, usuario_id]
      );
    }

    res.json({ mensaje: 'Permisos actualizados correctamente' });

  } catch (error) {
    console.error('Error al actualizar permisos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ✅ NUEVA RUTA: Obtener permisos específicos de un usuario
router.get('/permisos-usuario/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const [permisos] = await pool.query(`
      SELECT 
        u.id,
        u.nombre,
        u.correo_institucional,
        u.rol_id,
        COALESCE(p.acceso_chat, FALSE) as acceso_chat,
        COALESCE(p.modificar_stock, FALSE) as modificar_stock
      FROM Usuario u
      LEFT JOIN PermisosAlmacen p ON u.id = p.usuario_id
      WHERE u.id = ?
    `, [userId]);

    if (permisos.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(permisos[0]);
  } catch (error) {
    console.error('Error al obtener permisos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ==================== GESTIÓN DE ESTADO DE USUARIOS ====================

// Bloquear usuario
router.put('/bloquear-usuario', async (req, res) => {
  const { correo_institucional } = req.body;

  if (!correo_institucional) {
    return res.status(400).json({ error: 'Correo institucional requerido' });
  }

  try {
    const [result] = await pool.query(
      'UPDATE Usuario SET activo = FALSE WHERE correo_institucional = ?',
      [correo_institucional]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ mensaje: 'Usuario bloqueado exitosamente' });

  } catch (error) {
    console.error('Error al bloquear usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Desbloquear usuario
router.put('/desbloquear-usuario', async (req, res) => {
  const { correo_institucional } = req.body;

  if (!correo_institucional) {
    return res.status(400).json({ error: 'Correo institucional requerido' });
  }

  try {
    const [result] = await pool.query(
      'UPDATE Usuario SET activo = TRUE WHERE correo_institucional = ?',
      [correo_institucional]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ mensaje: 'Usuario desbloqueado exitosamente' });

  } catch (error) {
    console.error('Error al desbloquear usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Eliminar usuario
// Eliminar usuario
router.delete('/eliminar-usuario', async (req, res) => {
  const { correo_institucional } = req.body;

  if (!correo_institucional) {
    return res.status(400).json({ error: 'Correo institucional requerido' });
  }

  let connection; // For transaction management

  try {
    // Start a transaction
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Get the user
    const [usuario] = await connection.query(
      'SELECT id, rol_id FROM Usuario WHERE correo_institucional = ?',
      [correo_institucional]
    );

    if (usuario.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const usuarioId = usuario[0].id;

    // Prevent deleting administrators (security measure)
    if (usuario[0].rol_id === 4) {
      await connection.rollback();
      return res.status(400).json({ error: 'No se puede eliminar un usuario administrador' });
    }

    // Step 1: Delete related records from SolicitudItem
    const [solicitudes] = await connection.query(
      'SELECT id FROM Solicitud WHERE usuario_id = ? OR docente_id = ?',
      [usuarioId, usuarioId]
    );

    if (solicitudes.length > 0) {
      const solicitudIds = solicitudes.map(s => s.id);
      await connection.query(
        'DELETE FROM SolicitudItem WHERE solicitud_id IN (?)',
        [solicitudIds]
      );
    }

    // Step 2: Delete related records from PermisosAlmacen
    await connection.query('DELETE FROM PermisosAlmacen WHERE usuario_id = ?', [usuarioId]);

    // Step 3: Delete the user (this will cascade to Solicitud due to ON DELETE CASCADE)
    await connection.query('DELETE FROM Usuario WHERE id = ?', [usuarioId]);

    // Commit the transaction
    await connection.commit();
    res.json({ mensaje: 'Usuario eliminado exitosamente' });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
  } finally {
    if (connection) connection.release();
  }
});

// Eliminar múltiples usuarios por IDs
router.delete('/eliminar-usuarios', async (req, res) => {
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'IDs de usuarios requeridos' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Evitar eliminar administradores
    const [admins] = await connection.query(
      'SELECT id FROM Usuario WHERE id IN (?) AND rol_id = 4',
      [ids]
    );
    if (admins.length > 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'No se pueden eliminar usuarios administradores' });
    }

    // Solicitudes relacionadas
    const [solicitudes] = await connection.query(
      'SELECT id FROM Solicitud WHERE usuario_id IN (?) OR docente_id IN (?)',
      [ids, ids]
    );
    if (solicitudes.length > 0) {
      const solicitudIds = solicitudes.map(s => s.id);
      await connection.query(
        'DELETE FROM SolicitudItem WHERE solicitud_id IN (?)',
        [solicitudIds]
      );
    }

    await connection.query('DELETE FROM PermisosAlmacen WHERE usuario_id IN (?)', [ids]);
    await connection.query('DELETE FROM Usuario WHERE id IN (?)', [ids]);

    await connection.commit();
    res.json({ mensaje: 'Usuarios eliminados exitosamente' });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error al eliminar usuarios:', error);
    res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
  } finally {
    if (connection) connection.release();
  }
});


// ==================== CONSULTAS Y REPORTES ====================

// Obtener todos los usuarios (para estadísticas)
router.get('/usuarios', async (req, res) => {
  try {
    const [usuarios] = await pool.query(`
      SELECT 
        u.id,
        u.nombre,
        u.correo_institucional,
        u.activo,
         u.grupo_id,
        g.nombre AS grupo_nombre,
        r.nombre as rol,
        CASE 
          WHEN u.rol_id = 3 THEN COALESCE(p.acceso_chat, FALSE)
          WHEN u.rol_id = 1 THEN TRUE
          WHEN u.rol_id = 4 THEN TRUE
          ELSE FALSE
        END as acceso_chat,
        CASE 
          WHEN u.rol_id = 3 THEN COALESCE(p.modificar_stock, FALSE)
          WHEN u.rol_id = 4 THEN TRUE
          ELSE FALSE
      END as modificar_stock,
        CASE
          WHEN u.rol_id = 1 THEN (
            SELECT COUNT(*) FROM Solicitud WHERE usuario_id = u.id
          )
          ELSE NULL
        END AS solicitudes_count,
        CASE
          WHEN u.rol_id = 1 THEN (
            SELECT COUNT(*)
            FROM SolicitudItem si
            JOIN Solicitud s ON si.solicitud_id = s.id
            WHERE s.usuario_id = u.id
          )
          WHEN u.rol_id = 2 THEN (
            SELECT COUNT(*)
            FROM SolicitudItem si
            JOIN Solicitud s ON si.solicitud_id = s.id
            WHERE s.usuario_id = u.id AND s.nombre_alumno IS NULL
          )
          ELSE NULL
        END AS entregas_count
      FROM Usuario u
      JOIN Rol r ON u.rol_id = r.id
      LEFT JOIN PermisosAlmacen p ON u.id = p.usuario_id AND u.rol_id = 3
      LEFT JOIN Grupo g ON u.grupo_id = g.id
      ORDER BY u.nombre ASC
    `);

    res.json(usuarios);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener estadísticas de usuarios
router.get('/estadisticas', async (req, res) => {
  try {
    const [stats] = await pool.query(`
      SELECT 
        r.nombre as rol,
        COUNT(u.id) as total,
        SUM(CASE WHEN u.activo = TRUE THEN 1 ELSE 0 END) as activos,
        SUM(CASE WHEN u.activo = FALSE THEN 1 ELSE 0 END) as bloqueados
      FROM Rol r
      LEFT JOIN Usuario u ON r.id = u.rol_id
      GROUP BY r.id, r.nombre
      ORDER BY r.id
    `);

    // ✅ NUEVA: Estadísticas adicionales de permisos de almacén
    const [permisosStats] = await pool.query(`
      SELECT 
        COUNT(*) as total_almacen,
        SUM(CASE WHEN acceso_chat = TRUE THEN 1 ELSE 0 END) as con_chat,
        SUM(CASE WHEN modificar_stock = TRUE THEN 1 ELSE 0 END) as con_stock
      FROM PermisosAlmacen p
      JOIN Usuario u ON p.usuario_id = u.id
      WHERE u.activo = TRUE
    `);

    res.json({
      roles: stats,
      permisos_almacen: permisosStats[0] || { total_almacen: 0, con_chat: 0, con_stock: 0 }
    });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
