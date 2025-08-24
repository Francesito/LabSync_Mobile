const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Importar rutas existentes
const adeudoRoutes = require('./routes/adeudoRoutes'); 
const authRoutes = require('./routes/authRoutes');
const materialRoutes = require('./routes/materialRoutes');
const messageRoutes = require('./routes/messageRoutes');
const solicitudRoutes = require('./routes/solicitudRoutes');
const { obtenerGrupos } = require('./controllers/authController'); 


// Importar nueva ruta de administrador
const adminRoutes = require('./routes/adminRoutes');
const residuoRoutes = require('./routes/residuoRoutes');
const notificacionRoutes = require('./routes/notificacionRoutes');

const pool = require('./config/db');
const { eliminarSolicitudesViejas, cancelarSolicitudesVencidas } = require('./controllers/solicitudController');
const { crearNotificacion } = require('./models/notificacion');

const app = express();

// ==================== MIDDLEWARES ====================
// CORS configurado para permitir el frontend y manejar preflights
const allowedOrigins = [
  'https://labsync-frontend.onrender.com', // Frontend en producción
  'http://localhost:3000',                 // Desarrollo local
  'https://localhost:3000'                 // Desarrollo local con HTTPS
];

const corsOptions = {
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
// Manejo explícito de solicitudes preflight
app.options('*', cors(corsOptions));

app.use(express.json());

// ==================== RUTA DE PRUEBA ====================
// Ruta para verificar que el backend funciona
app.get('/', (req, res) => {
  res.json({ 
    message: '🚀 LabSync Backend funcionando correctamente',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '2.0.0 - Con control de permisos de stock'
  });
});

// Ruta de salud para verificar la conexión a la BD
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    
    // ✅ NUEVO: Verificar también la tabla de permisos
    const [permisosCount] = await pool.query('SELECT COUNT(*) as total FROM PermisosAlmacen');
    
    res.json({ 
      status: 'OK', 
      database: 'Connected',
      permisos_configurados: permisosCount[0].total,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'ERROR', 
      database: 'Disconnected',
      error: error.message 
    });
  }
});

// ==================== RUTAS DE LA API ====================
// Rutas existentes (con mejoras de permisos)
app.use('/api/auth', authRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/solicitudes', solicitudRoutes);
app.use('/api/adeudos', adeudoRoutes);
app.use('/api/residuos', residuoRoutes);
app.use('/api/notificaciones', notificacionRoutes);

// Nueva ruta de administrador (con gestión de permisos completa)
app.use('/api/admin', adminRoutes);

// ==================== INICIALIZACIÓN DE ROLES ====================
const initializeRoles = async () => {
  try {
    // Actualizado para incluir el rol de administrador
    await pool.query(`
      INSERT IGNORE INTO Rol (id, nombre) VALUES
      (1, 'alumno'),
      (2, 'docente'),
      (3, 'almacen'),
      (4, 'administrador');
    `);
    console.log('✅ Roles inicializados correctamente');
  } catch (error) {
    console.error('❌ Error inicializando roles:', error);
  }
};

// ==================== INICIALIZACIÓN DE TABLA PERMISOS ====================
const initializePermisosTable = async () => {
  try {
    // Verificar y crear tabla PermisosAlmacen si no existe
    await pool.query(`
      CREATE TABLE IF NOT EXISTS PermisosAlmacen (
        id INT NOT NULL AUTO_INCREMENT,
        usuario_id INT NOT NULL,
        acceso_chat TINYINT(1) DEFAULT 0,
        modificar_stock TINYINT(1) DEFAULT 0,
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY unique_usuario (usuario_id),
        KEY idx_permisos_usuario (usuario_id),
        CONSTRAINT PermisosAlmacen_ibfk_1 FOREIGN KEY (usuario_id) REFERENCES Usuario(id) ON DELETE CASCADE
      );
    `);

    // Insertar permisos por defecto para usuarios de almacén existentes
    await pool.query(`
      INSERT IGNORE INTO PermisosAlmacen (usuario_id, acceso_chat, modificar_stock)
      SELECT id, 0, 0 
      FROM Usuario 
      WHERE rol_id = 3 
    `);

    // Eliminar permisos de administradores
    await pool.query(`
      DELETE FROM PermisosAlmacen 
      WHERE usuario_id IN (SELECT id FROM Usuario WHERE rol_id = 4);
    `);

    // Mostrar estadísticas
    const [stats] = await pool.query(`
      SELECT 
        COUNT(*) as total_permisos,
        SUM(acceso_chat) as con_chat,
        SUM(modificar_stock) as con_stock
      FROM PermisosAlmacen
    `);

    console.log('✅ Tabla PermisosAlmacen inicializada correctamente');
    console.log(`📊 Permisos configurados: ${stats[0].total_permisos} usuarios de almacén`);
    console.log(`💬 Con acceso a chat: ${stats[0].con_chat}`);
    console.log(`📦 Con acceso a stock: ${stats[0].con_stock}`);
  } catch (error) {
    console.error('❌ Error inicializando tabla PermisosAlmacen:', error);
  }
};

// ==================== INICIALIZACIÓN DE TABLA RESIDUOS ====================
const initializeResiduoTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS Residuo (
        id INT NOT NULL AUTO_INCREMENT,
         usuario_id INT NOT NULL,
        fecha DATE NOT NULL,
        laboratorio VARCHAR(100) NOT NULL,
        reactivo VARCHAR(100) NOT NULL,
        tipo ENUM('quimico','biologico','radiactivo','comun') NOT NULL,
        cantidad DECIMAL(10,2) NOT NULL,
        unidad ENUM('ml','g','u') NOT NULL,
       PRIMARY KEY (id),
        KEY usuario_id (usuario_id),
        CONSTRAINT Residuo_ibfk_1 FOREIGN KEY (usuario_id) REFERENCES Usuario(id) ON DELETE CASCADE
      );
    `);
    console.log('✅ Tabla Residuo inicializada correctamente');
  } catch (error) {
    console.error('❌ Error inicializando tabla Residuo:', error);
  }
};

// ==================== INICIALIZACIÓN DE TABLA NOTIFICACIONES ====================
const initializeNotificacionTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS Notificacion (
        id INT NOT NULL AUTO_INCREMENT,
        usuario_id INT NOT NULL,
        tipo VARCHAR(50) NOT NULL,
        mensaje VARCHAR(255) NOT NULL,
        fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        leida TINYINT(1) DEFAULT 0,
        PRIMARY KEY (id),
        KEY usuario_id (usuario_id),
        CONSTRAINT Notificacion_ibfk_1 FOREIGN KEY (usuario_id) REFERENCES Usuario(id) ON DELETE CASCADE
      );
    `);
      // Asegura que la columna 'leida' exista en instalaciones previas
   const [columns] = await pool.query(
      "SHOW COLUMNS FROM Notificacion LIKE 'leida'"
    );
    if (columns.length === 0) {
      await pool.query(
        "ALTER TABLE Notificacion ADD COLUMN leida TINYINT(1) DEFAULT 0"
      );
    }
    console.log('✅ Tabla Notificacion inicializada correctamente');
  } catch (error) {
    console.error('❌ Error inicializando tabla Notificacion:', error);
  }
};

// ==================== CRONJOB: LIMPIAR SOLICITUDES VIEJAS ====================
// Se ejecuta cada 24 horas para borrar solicitudes con más de 7 días
const startSolicitudCleanupJob = () => {
  setInterval(async () => {
    console.log('🗑️ Ejecutando limpieza automática de solicitudes viejas...');
    await eliminarSolicitudesViejas();
  }, 24 * 60 * 60 * 1000); // Cada 24 horas
};

// Cancelar solicitudes cuya fecha de recolección ya pasó
const startSolicitudAutoCancelJob = () => {
  setInterval(async () => {
    console.log('⏰ Revisando solicitudes vencidas...');
    await cancelarSolicitudesVencidas();
  }, 60 * 60 * 1000); // Cada hora
};

// ✅ NUEVO: CRONJOB para limpiar mensajes antiguos
const startMessageCleanupJob = () => {
  setInterval(async () => {
    console.log('🗑️ Ejecutando limpieza automática de mensajes antiguos...');
    try {
      // Verificar si la función existe antes de llamarla
      const { cleanupOldMessages } = require('./controllers/messageController');
      if (typeof cleanupOldMessages === 'function') {
        const deletedCount = await cleanupOldMessages();
        console.log(`✅ Eliminados ${deletedCount} mensajes antiguos`);
      } else {
        console.log('⚠️ Función cleanupOldMessages no disponible');
      }
    } catch (error) {
      console.error('❌ Error en limpieza de mensajes:', error);
    }
  }, 12 * 60 * 60 * 1000); // Cada 12 horas
};

// Recordatorios de devolución de material (diario)
const startReturnReminderJob = () => {
  setInterval(async () => {
    try {
      const [solicitudes] = await pool.query(
        `SELECT id, usuario_id, docente_id, profesor
         FROM Solicitud
         WHERE fecha_devolucion = DATE_ADD(CURDATE(), INTERVAL 1 DAY)`
      );

      if (solicitudes.length === 0) return;

      const [almacenistas] = await pool.query(
        `SELECT u.id FROM Usuario u
         JOIN PermisosAlmacen p ON u.id = p.usuario_id
         WHERE u.rol_id = 3 AND p.modificar_stock = TRUE`
      );

      for (const s of solicitudes) {
        const mensaje = `Recuerda devolver el material de la solicitud ${s.id} mañana`;
        await crearNotificacion(s.usuario_id, 'recordatorio_devolucion', mensaje);
        if (s.docente_id) {
          await crearNotificacion(s.docente_id, 'recordatorio_devolucion', mensaje);
        } else if (s.profesor) {
          const [doc] = await pool.query(
            'SELECT id FROM Usuario WHERE nombre = ? AND rol_id = 2 LIMIT 1',
            [s.profesor]
          );
          if (doc.length) {
            await crearNotificacion(doc[0].id, 'recordatorio_devolucion', mensaje);
          }
        }
        for (const a of almacenistas) {
          await crearNotificacion(a.id, 'recordatorio_devolucion', mensaje);
        }
      }
    } catch (err) {
      console.error('❌ Error enviando recordatorios de devolución:', err);
    }
  }, 24 * 60 * 60 * 1000); // Cada 24 horas
};

// Alertas de stock bajo (cada 6 horas)
const startLowStockAlertJob = () => {
  setInterval(async () => {
    try {
      const threshold = 10;
      const tablas = [
        { tabla: 'MaterialLiquido', campo: 'cantidad_disponible_ml' },
        { tabla: 'MaterialSolido', campo: 'cantidad_disponible_g' },
        { tabla: 'MaterialEquipo', campo: 'cantidad_disponible_u' },
        { tabla: 'MaterialLaboratorio', campo: 'cantidad_disponible' }
      ];

      let materialesBajos = [];
      for (const t of tablas) {
        const [rows] = await pool.query(
          `SELECT nombre, ${t.campo} AS stock FROM ${t.tabla} WHERE ${t.campo} < ?`,
          [threshold]
        );
        materialesBajos = materialesBajos.concat(rows);
      }

      if (materialesBajos.length === 0) return;

      const [almacenistas] = await pool.query(
        `SELECT u.id FROM Usuario u
         JOIN PermisosAlmacen p ON u.id = p.usuario_id
         WHERE u.rol_id = 3 AND p.modificar_stock = TRUE`
      );

      for (const a of almacenistas) {
        for (const m of materialesBajos) {
          await crearNotificacion(
            a.id,
            'stock_bajo',
            `Stock bajo de ${m.nombre}: ${m.stock}`
          );
        }
      }
    } catch (err) {
      console.error('❌ Error verificando stock bajo:', err);
    }
  }, 6 * 60 * 60 * 1000); // Cada 6 horas
};

// Limpiar notificaciones antiguas (3 días)
const startNotificationCleanupJob = () => {
  setInterval(async () => {
    try {
      await pool.query(
        'DELETE FROM Notificacion WHERE fecha < DATE_SUB(NOW(), INTERVAL 3 DAY)'
      );
    } catch (err) {
      console.error('❌ Error limpiando notificaciones:', err);
    }
  }, 24 * 60 * 60 * 1000); // Cada 24 horas
};

app.get('/api/grupos', obtenerGrupos);

// ==================== MANEJO DE ERRORES 404 ====================
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Ruta no encontrada',
    path: req.originalUrl,
    method: req.method,
    disponibles: [
      '/api/auth/*',
      '/api/materials/*',
      '/api/messages/*', 
      '/api/solicitudes/*',
      '/api/adeudos/*',
      '/api/admin/*'
    ]
  });
});

// ==================== MANEJO DE ERRORES GLOBALES ====================
app.use((error, req, res, next) => {
  console.error('Error no manejado:', error);
  res.status(500).json({
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Algo salió mal'
  });
});

// ==================== INICIAR SERVIDOR ====================
const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Servidor LabSync corriendo en puerto ${PORT}`);
  console.log(`🌐 URL: https://labsync-1090.onrender.com`);
  console.log(`📅 Fecha de inicio: ${new Date().toISOString()}`);
  
  console.log('🔧 Inicializando sistema...');
  
  // Intentar conectar a la base de datos con reintentos
  const connectWithRetry = async (retries = 5) => {
    for (let i = 0; i < retries; i++) {
      try {
        console.log(`🔄 Intento de conexión ${i + 1}/${retries}...`);
        await pool.query('SELECT 1');
        console.log('✅ Conexión a base de datos establecida');
        
        // Solo inicializar si la conexión es exitosa
        await initializeRoles();
        await initializePermisosTable();
        await initializeResiduoTable();
        await initializeNotificacionTable();
        break;
      } catch (error) {
        console.error(`❌ Error de conexión intento ${i + 1}:`, error.message);
        
        if (i === retries - 1) {
          console.error('❌ No se pudo establecer conexión después de varios intentos');
          console.log('⚠️ Servidor iniciado SIN conexión a base de datos');
        } else {
          console.log(`⏳ Reintentando en 3 segundos...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    }
  };
  
  await connectWithRetry();
  
  // Iniciar trabajos programados
  console.log('⏰ Iniciando trabajos programados...');
  startSolicitudCleanupJob();
  startMessageCleanupJob();
  startSolicitudAutoCancelJob();
  startReturnReminderJob();
  startLowStockAlertJob();
  startNotificationCleanupJob();
  
  console.log('✅ Sistema LabSync inicializado');
  console.log('🔐 Funcionalidades de permisos:');
  console.log('   - Control de acceso a chat por usuario');
  console.log('   - Control de acceso a modificación de stock');
  console.log('   - Gestión completa de permisos desde panel admin');
});
