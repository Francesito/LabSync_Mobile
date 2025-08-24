// authMiddleware.js
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const verificarToken = async (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Acceso no autorizado. Token requerido.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Buscar el usuario en la base de datos para obtener su información completa
    const [usuarios] = await pool.query(
      'SELECT id, rol_id, nombre, correo_institucional, activo FROM Usuario WHERE id = ?',
      [decoded.id]
    );

    if (!usuarios.length) {
      return res.status(401).json({ error: 'Usuario no encontrado.' });
    }

    const usuario = usuarios[0];
    if (!usuario.activo) {
      return res.status(403).json({ error: 'Usuario bloqueado. Contacta al administrador.' });
    }
    req.usuario = usuario;
    
    req.user = usuario;
    
    next();
  } catch (error) {
    console.error('Error al verificar token:', error);
    return res.status(401).json({ error: 'Token inválido o expirado.' });
  }
};

// Tu función existente de verificar rol (SIN CAMBIOS)
const verificarRol = (rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.usuario || !rolesPermitidos.includes(req.usuario.rol_id)) {
      return res.status(403).json({ error: 'Acceso prohibido para tu rol.' });
    }
    next();
  };
};

const authenticateToken = verificarToken; // Alias para compatibilidad

const requireAdmin = (req, res, next) => {
  if (!req.usuario || req.usuario.rol_id !== 4) {
    return res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de administrador.' });
  }
  next();
};

const requireAlmacen = (req, res, next) => {
  if (!req.usuario || ![3, 4].includes(req.usuario.rol_id)) {
    return res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de almacén.' });
  }
  next();
};

const requireDocente = (req, res, next) => {
  if (!req.usuario || ![2, 4].includes(req.usuario.rol_id)) {
    return res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de docente.' });
  }
  next();
};

const verificarPermisosAlmacen = (permisoRequerido) => {
  return async (req, res, next) => {
    // Solo aplica a usuarios de almacén (rol 3)
    if (req.usuario.rol_id !== 3) {
      return next(); // Los administradores tienen todos los permisos
    }

    try {
      const [permisos] = await pool.query(
        'SELECT acceso_chat, modificar_stock FROM PermisosAlmacen WHERE usuario_id = ?',
        [req.usuario.id]
      );

      if (permisos.length === 0) {
        return res.status(403).json({ error: 'Permisos no configurados. Contacta al administrador.' });
      }

      const permiso = permisos[0];

      if (permisoRequerido === 'chat' && !permiso.acceso_chat) {
        return res.status(403).json({ error: 'No tienes permisos para acceder al chat.' });
      }

      if (permisoRequerido === 'stock' && !permiso.modificar_stock) {
        return res.status(403).json({ error: 'No tienes permisos para modificar el stock.' });
      }

      next();
    } catch (error) {
      console.error('Error verificando permisos de almacén:', error);
      return res.status(500).json({ error: 'Error interno del servidor.' });
    }
  };
};

const verificarMultiplesRoles = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.usuario || !rolesPermitidos.includes(req.usuario.rol_id)) {
      return res.status(403).json({ error: 'Acceso prohibido para tu rol.' });
    }
    next();
  };
};

const verificarAccesoStock = [
  (req, res, next) => {
    // Solo almacén y administradores pueden modificar stock
    if (!req.usuario || ![3, 4].includes(req.usuario.rol_id)) {
      return res.status(403).json({ error: 'Acceso denegado. Solo personal de almacén puede modificar stock.' });
    }
    next();
  },
  verificarPermisosAlmacen('stock') 
];

module.exports = {
  verificarToken,
  verificarRol,
  authenticateToken,
  requireAdmin,
  requireAlmacen,
  requireDocente,
  verificarPermisosAlmacen,
  verificarMultiplesRoles,
  verificarAccesoStock
};
