//backend/controllers/authController.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { sendEmail } = require('../utils/email');

// Nueva función para obtener grupos
const obtenerGrupos = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, nombre FROM Grupo ORDER BY nombre');
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener grupos:', error);
    res.status(500).json({ error: 'Error al obtener grupos' });
  }
};

// ✅ NUEVA FUNCIÓN para obtener docentes
const obtenerDocentes = async (req, res) => {
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

const registrarUsuario = async (req, res) => {
  const { nombre, correo_institucional, contrasena, grupo_id } = req.body;

  // Input validation
  if (!nombre || !correo_institucional || !contrasena || !grupo_id) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  if (!correo_institucional.endsWith('@utsjr.edu.mx')) {
    return res.status(400).json({ error: 'Correo institucional inválido' });
  }

  try {
    // Verificar que el usuario no existe
    const [existingUser] = await pool.query('SELECT * FROM Usuario WHERE correo_institucional = ?', [correo_institucional]);
    if (existingUser.length > 0) {
      return res.status(400).json({ error: 'Correo ya registrado' });
    }

    // Verificar que el grupo existe
    const [grupoExists] = await pool.query('SELECT id FROM Grupo WHERE id = ?', [grupo_id]);
    if (grupoExists.length === 0) {
      return res.status(400).json({ error: 'Grupo seleccionado no válido' });
    }

    const hash = await bcrypt.hash(contrasena, 10);
    const token = jwt.sign({ correo_institucional }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // Set default role to alumno (rol_id: 1) y agregar grupo_id
    await pool.query(
      'INSERT INTO Usuario (nombre, correo_institucional, contrasena, rol_id, grupo_id, activo) VALUES (?, ?, ?, ?, ?, FALSE)',
      [nombre, correo_institucional, hash, 1, grupo_id]
    );

    const frontendUrl = process.env.FRONTEND_URL || 'https://labsync-frontend.onrender.com';
    const verifyUrl = `${frontendUrl}/verificar/${token}`;

const verifyHtml = `
  <div style="font-family:Arial, sans-serif; background-color:#f4f6f8; padding:30px;">
    <div style="max-width:500px; margin:auto; background:#ffffff; border-radius:8px; padding:30px; box-shadow:0 2px 8px rgba(0,0,0,0.1);">

      <p style="color:#333333; font-size:16px; line-height:1.5; white-space:pre-line;">
        Hola
        
        Bienvenido a LabSync. Haz clic en el botón de abajo para activar tu cuenta:
      </p>

      <div style="text-align:center; margin:30px 0;">
        <a href="${verifyUrl}" 
           style="display:inline-block;
                  padding:14px 28px;
                  background-color:#000080;
                  color:#ffffff;
                  font-size:16px;
                  font-weight:bold;
                  text-decoration:none;
                  border-radius:6px;">
          Verificar Cuenta
        </a>
      </div>

      <p style="color:#333333; font-size:16px; line-height:1.5;">
        Si no creaste esta cuenta, puedes ignorar este mensaje.
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
      'Verifica tu cuenta',
     `${verifyUrl}`,
      verifyHtml
    );

    res.status(201).json({ mensaje: 'Usuario registrado. Verifica tu correo.' });
  } catch (error) {
    console.error('Error al registrar usuario:', error);
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
};

const verificarCorreo = async (req, res) => {
  const { token } = req.params;

  try {
    const { correo_institucional } = jwt.verify(token, process.env.JWT_SECRET);
    const [result] = await pool.query('UPDATE Usuario SET activo = TRUE WHERE correo_institucional = ?', [correo_institucional]);
    if (result.affectedRows === 0) {
      return res.status(400).json({ error: 'Usuario no encontrado' });
    }
    res.json({ mensaje: 'Correo verificado exitosamente' });
  } catch (error) {
    res.status(400).json({ error: 'Token inválido o expirado' });
  }
};

const iniciarSesion = async (req, res) => {
  const { correo_institucional, contrasena } = req.body;

  // Validar campos requeridos
  if (!correo_institucional || !contrasena) {
    return res.status(400).json({ error: 'Correo y contraseña son obligatorios' });
  }

  try {
    // Incluir información del grupo en la consulta
    const [rows] = await pool.query(`
      SELECT u.*, g.nombre as grupo_nombre 
      FROM Usuario u 
      LEFT JOIN Grupo g ON u.grupo_id = g.id 
      WHERE u.correo_institucional = ?
    `, [correo_institucional]);
    
    if (rows.length === 0) {
      return res.status(400).json({ error: 'Usuario no encontrado' });
    }

    const usuario = rows[0];
    
    // Verificar si el usuario está activo
    if (!usuario.activo) {
      return res.status(400).json({ error: 'Usuario no verificado o bloqueado. Verifica tu correo o contacta al administrador.' });
    }

    // Verificar contraseña
    const esValido = await bcrypt.compare(contrasena, usuario.contrasena);
    if (!esValido) {
      return res.status(400).json({ error: 'Contraseña incorrecta' });
    }

    // Generar token JWT
    const token = jwt.sign(
      {
        id: usuario.id,
        nombre: usuario.nombre,
        correo_institucional: usuario.correo_institucional,
        rol_id: usuario.rol_id,
        grupo_id: usuario.grupo_id
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ 
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        correo: usuario.correo_institucional,
        rol_id: usuario.rol_id,
        grupo_id: usuario.grupo_id,
        grupo_nombre: usuario.grupo_nombre
      }
    });
  } catch (error) {
    console.error('Error al iniciar sesión:', error);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
};

// ✅ FUNCIÓN MEJORADA: Verificar permisos de chat Y stock
const verificarPermisosChat = async (req, res) => {
  try {
    const usuario = req.usuario; // Viene del middleware verificarToken
    
    if (!usuario) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    const userRole = usuario.rol_id;
    
    // Si es alumno (rol_id: 1), siempre tiene acceso al chat pero NO al stock
    if (userRole === 1) {
      return res.json({ 
        acceso_chat: true,
        modificar_stock: false,
        rol: 'alumno'
      });
    }
    
    // Si es docente (rol_id: 2), no tiene acceso al chat ni al stock
    if (userRole === 2) {
      return res.json({ 
        acceso_chat: false,
        modificar_stock: false,
        rol: 'docente'
      });
    }
    
    // Si es almacen (rol_id: 3), verificar permisos en PermisosAlmacen
    if (userRole === 3) {
      const [permisosRows] = await pool.query(
        'SELECT acceso_chat, modificar_stock FROM PermisosAlmacen WHERE usuario_id = ?',
        [usuario.id]
      );
      
      if (permisosRows.length === 0) {
        // Si no hay registro en PermisosAlmacen, denegar acceso por defecto
        return res.json({ 
          acceso_chat: false,
          modificar_stock: false,
          rol: 'almacen'
        });
      }
      
      const permisos = permisosRows[0];
      return res.json({ 
        acceso_chat: Boolean(permisos.acceso_chat),
        modificar_stock: Boolean(permisos.modificar_stock),
        rol: 'almacen'
      });
    }
    
    // Si es administrador (rol_id: 4), tiene todos los permisos
    if (userRole === 4) {
      return res.json({ 
        acceso_chat: true,
        modificar_stock: true,
        rol: 'administrador'
      });
    }
    
    // Rol no reconocido
    return res.json({ 
      acceso_chat: false,
      modificar_stock: false,
      rol: 'unknown'
    });
    
  } catch (error) {
    console.error('Error al verificar permisos de chat:', error);
    res.status(500).json({ error: 'Error al verificar permisos' });
  }
};

// ✅ NUEVA FUNCIÓN: Verificar específicamente permisos de stock
const verificarPermisosStock = async (req, res) => {
  try {
    const usuario = req.usuario; // Viene del middleware verificarToken
    
    if (!usuario) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    const userRole = usuario.rol_id;
    
    // Solo almacén y administradores pueden tener permisos de stock
    if (userRole === 1 || userRole === 2) {
      return res.json({ 
        modificar_stock: false,
        rol: userRole === 1 ? 'alumno' : 'docente',
        mensaje: 'Este rol no tiene acceso a modificar stock'
      });
    }
    
    // Si es almacen (rol_id: 3), verificar permisos específicos
    if (userRole === 3) {
      const [permisosRows] = await pool.query(
        'SELECT modificar_stock FROM PermisosAlmacen WHERE usuario_id = ?',
        [usuario.id]
      );
      
      if (permisosRows.length === 0) {
        return res.json({ 
          modificar_stock: false,
          rol: 'almacen',
          mensaje: 'Permisos no configurados'
        });
      }
      
      const permisos = permisosRows[0];
      return res.json({ 
        modificar_stock: Boolean(permisos.modificar_stock),
        rol: 'almacen',
        mensaje: permisos.modificar_stock ? 'Tienes permisos para modificar stock' : 'No tienes permisos para modificar stock'
      });
    }
    
    // Si es administrador (rol_id: 4), tiene todos los permisos
    if (userRole === 4) {
      return res.json({ 
        modificar_stock: true,
        rol: 'administrador',
        mensaje: 'Administrador tiene todos los permisos'
      });
    }
    
    // Rol no reconocido
    return res.json({ 
      modificar_stock: false,
      rol: 'unknown',
      mensaje: 'Rol no reconocido'
    });
    
  } catch (error) {
    console.error('Error al verificar permisos de stock:', error);
    res.status(500).json({ error: 'Error al verificar permisos de stock' });
  }
};

const forgotPassword = async (req, res) => {
  const { correo_institucional } = req.body;

  if (!correo_institucional) {
    return res.status(400).json({ error: 'Correo institucional requerido' });
  }

  try {
    const [rows] = await pool.query('SELECT * FROM Usuario WHERE correo_institucional = ?', [correo_institucional]);
    if (rows.length === 0) {
      return res.status(400).json({ error: 'Usuario no encontrado' });
    }

    const token = jwt.sign({ correo_institucional }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // Guardar token en la base de datos
    await pool.query(
      'UPDATE Usuario SET reset_token = ?, reset_token_expires = DATE_ADD(NOW(), INTERVAL 1 HOUR) WHERE correo_institucional = ?',
      [token, correo_institucional]
    );

    const frontendUrl = process.env.FRONTEND_URL || 'https://labsync-frontend.onrender.com';
     const resetUrl = `${frontendUrl}/reset-password/${token}`;

const resetHtml = `
  <div style="font-family:Arial, sans-serif; background-color:#f4f6f8; padding:30px;">
    <div style="max-width:500px; margin:auto; background:#ffffff; border-radius:8px; padding:30px; box-shadow:0 2px 8px rgba(0,0,0,0.1);">

      <p style="color:#333333; font-size:16px; line-height:1.5; white-space:pre-line;">
        Hola
        
        Hemos recibido una solicitud para cambiar tu contraseña.
        
        Haz clic en el botón de abajo para continuar con el proceso:
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
          Restablecer Contraseña
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
      'Restablece tu contraseña.',
      ` ${resetUrl}`,
      resetHtml
    );

    res.json({ mensaje: 'Enlace de restablecimiento enviado a tu correo.' });
  } catch (error) {
    console.error('Error al procesar solicitud:', error);
    res.status(500).json({ error: 'Error al procesar la solicitud' });
  }
};

const resetPassword = async (req, res) => {
  const { token } = req.params;
  const { contrasena } = req.body;

  if (!contrasena) {
    return res.status(400).json({ error: 'La nueva contraseña es requerida' });
  }

  if (contrasena.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }

  try {
    // Verificar token JWT
    const { correo_institucional } = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verificar que el token existe en la base de datos y no ha expirado
    const [rows] = await pool.query(
      'SELECT * FROM Usuario WHERE correo_institucional = ? AND reset_token = ? AND reset_token_expires > NOW()',
      [correo_institucional, token]
    );

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Token inválido o expirado' });
    }

    // Actualizar contraseña y limpiar token
    const hash = await bcrypt.hash(contrasena, 10);
    const [result] = await pool.query(
      'UPDATE Usuario SET contrasena = ?, reset_token = NULL, reset_token_expires = NULL WHERE correo_institucional = ?',
      [hash, correo_institucional]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({ error: 'Error al actualizar contraseña' });
    }

    res.json({ mensaje: 'Contraseña restablecida exitosamente' });
  } catch (error) {
    console.error('Error al restablecer contraseña:', error);
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(400).json({ error: 'Token inválido o expirado' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = {
  obtenerGrupos,
  obtenerDocentes, // ✅ Nueva función exportada
  registrarUsuario,
  verificarCorreo,
  iniciarSesion,
  verificarPermisosChat,
  verificarPermisosStock,
  forgotPassword,
  resetPassword
};
