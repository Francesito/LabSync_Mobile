//backend/routes/materialRoutes.js

const express = require('express');
const router = express.Router();
const materialController = require('../controllers/materialController');
const { upload, handleUploadError } = require('../middleware/uploadMiddleware');
const solicitudController = require('../controllers/solicitudController');
const { 
  verificarToken, 
  verificarRol, 
  verificarAccesoStock,
  requireAdmin,
  requireAlmacen
} = require('../middleware/authMiddleware');

/**
 * ========================
 * RUTAS PÚBLICAS (SOLO LECTURA)
 * ========================
 */
// Lista todos los materiales (las 4 subtablas unidas) - LECTURA
router.get('/', verificarToken, materialController.getMaterials);

// ✅ NUEVA RUTA: Obtener docentes para selección en solicitudes
router.get('/docentes', verificarToken, materialController.obtenerDocentesParaSolicitud);

// Obtener un material específico por ID y TIPO - LECTURA
// Ejemplo: GET /api/materials/123?tipo=liquido



// Rutas específicas para listar por tipo - LECTURA
router.get('/tipo/liquidos', verificarToken, materialController.getLiquidos);
router.get('/tipo/solidos', verificarToken, materialController.getSolidos);
router.get('/tipo/equipos', verificarToken, materialController.getEquipos);
router.get('/tipo/laboratorio', verificarToken, materialController.getLaboratorio);
router.get('/categorias', verificarToken, materialController.getCategorias);
router.get('/verify-image', verificarToken, materialController.verifyImage);

// Inventario para reportes (almacenistas y administradores)
router.get(
  '/inventario/liquidos',
  verificarToken,
  verificarRol([3, 4]),
  materialController.getInventarioLiquidosReport
);

router.get(
  '/inventario/solidos',
  verificarToken,
  verificarRol([3, 4]),
  materialController.getInventarioSolidosReport
);

/**
 * ========================
 * RUTAS PARA ALUMNOS (ROL 1) Y DOCENTES (ROL 2)
 * ========================
 */
// Crear solicitud agrupada (alumno o docente)
// El body debe incluir tipo en cada objeto de materiales
router.post(
  '/solicitudes',
  verificarToken,
  verificarRol([1, 2]),
  materialController.crearSolicitudes
);

// Crear solicitud con adeudo (solo alumno)
// Body también incluye tipo
router.post(
  '/solicitud-adeudo',
  verificarToken,
  verificarRol([1]),
  materialController.crearSolicitudConAdeudo
);

// Obtener solicitudes propias (alumno)
router.get(
  '/usuario/solicitudes',
  verificarToken,
  verificarRol([1]),
  materialController.getUserSolicitudes
);

// ✅ ADEUDOS (alumno y docente)
router.get(
  '/adeudos',
  verificarToken,
  verificarRol([1, 2]),
  materialController.getAdeudosUsuario
);

router.get(
  '/adeudos/entrega',
  verificarToken,
  verificarRol([1, 2]),
  materialController.getAdeudosConFechaEntrega
);

/**
 * ========================
 * RUTAS PARA DOCENTES (ROL 2)
 * ========================
 */
// Listar solicitudes pendientes
router.get(
  '/solicitudes/pendientes',
  verificarToken,
  verificarRol([2]),
  materialController.getPendingSolicitudes
);

// Obtener TODAS las solicitudes (para docente)
router.get(
  '/solicitudes/todas',
  verificarToken,
  verificarRol([2]),
  materialController.getAllSolicitudes
);

// Aprobar o rechazar solicitudes por ID
router.post(
  '/solicitud/:id/aprobar',
  verificarToken,
  verificarRol([2]),
  materialController.approveSolicitud
);

router.post(
  '/solicitud/:id/rechazar',
  verificarToken,
  verificarRol([2]),
  materialController.rejectSolicitud
);

/**
 * ========================
 * RUTAS PARA ALMACENISTAS (ROL 3) - CON CONTROL DE PERMISOS DE STOCK
 * ========================
 */
// Listar solicitudes aprobadas (solo lectura, sin permisos especiales)
router.get(
  '/solicitudes/aprobadas',
  verificarToken,
  verificarRol([3]),
  materialController.getApprovedSolicitudes
);

// ✅ RUTAS QUE REQUIEREN PERMISOS DE STOCK

// Marcar como entregada (requiere permisos de stock)
router.post(
  '/solicitud/:id/entregar',
  verificarToken,
  requireAlmacen,
  materialController.deliverSolicitud
);

// Cancelar solicitud (almacenista requiere permisos de stock)
router.post(
  '/solicitud/:id/cancelar',
  verificarToken,
  (req, res, next) => {
    if (req.usuario.rol_id === 1) {
      return verificarRol([1])(req, res, next); // Verifica rol de alumno
    }
    if (req.usuario.rol_id === 3) {
      return verificarAccesoStock(req, res, next); // Usa el array completo
    }
    return res.status(403).json({ error: 'No tienes permisos para cancelar solicitudes' });
  },
  materialController.cancelSolicitud
);

// Ajustar inventario (requiere permisos de stock)
router.post(
  '/material/:id/ajustar',
  verificarToken,
  verificarAccesoStock, // Verificar permisos de stock
  materialController.adjustInventory
);

// ✅ NUEVAS RUTAS PARA GESTIÓN DE STOCK

// Crear nuevo material (requiere permisos de stock)
router.post(
  '/crear',
  verificarToken,
  verificarAccesoStock,
  upload.single('imagen'), // Campo de archivo en el formulario
  handleUploadError,
  materialController.crearMaterial
);

router.post(
  '/crear-con-imagen',
  verificarToken,
  verificarAccesoStock,
  (req, res, next) => {
    // Middleware personalizado para validar que nombre y tipo estén presentes antes del upload
    const { nombre, tipo } = req.body;
    if (!nombre || !tipo) {
      return res.status(400).json({ error: 'Nombre y tipo son requeridos antes de subir imagen' });
    }
    next();
  },
  upload.single('imagen'),
  handleUploadError,
  materialController.crearMaterial
);

// Actualizar material existente (requiere permisos de stock)
router.put(
  '/:id/actualizar',
  verificarToken,
  verificarAccesoStock,
  upload.single('imagen'), // Imagen opcional para actualización
  handleUploadError,
  materialController.actualizarMaterial
);

// Eliminar material (requiere permisos de stock)
router.delete(
  '/:id/eliminar',
  verificarToken,
  verificarAccesoStock,
  materialController.eliminarMaterial
);

// Actualizar stock específico de un material (requiere permisos de stock)
router.patch(
  '/:id/stock',
  verificarToken,
  verificarAccesoStock,
  materialController.actualizarStock
);

// Registrar entrada de stock (requiere permisos de stock)
router.post(
  '/:id/entrada',
  verificarToken,
  verificarAccesoStock,
  materialController.registrarEntradaStock
);

// Registrar salida de stock (requiere permisos de stock)
router.post(
  '/:id/salida',
  verificarToken,
  verificarAccesoStock,
  materialController.registrarSalidaStock
);

// Ajuste masivo de stock (solo personal de almacén con permisos)
router.post(
  '/ajuste-masivo',
  verificarToken,
  verificarRol([3]),
  verificarAccesoStock,
  materialController.ajusteMasivoStock
);

/**
 * ========================
 * RUTAS DE CONSULTA PARA ALMACENISTAS (SIN PERMISOS ESPECIALES)
 * ========================
 */
// Listar solicitudes entregadas (solo almacenistas - lectura)
router.get(
  '/solicitudes/entregadas',
  verificarToken,
  verificarRol([3]),
  materialController.getDeliveredSolicitudes
);

router.get(
  '/solicitudes/almacen',
  verificarToken,
  verificarRol([3, 4]),
  solicitudController.obtenerSolicitudesAprobadasPendientes
);

// Historial de solicitudes (almacén y admin)
router.get(
  '/solicitudes/historial',
  verificarToken,
  verificarRol([3, 4]),
  materialController.getHistorialSolicitudes
);

// Detalle de una solicitud entregada (almacenista - lectura)
router.get(
  '/solicitudes/:id',
  verificarToken,
  verificarRol([3]),
  materialController.getSolicitudDetalle
);

// Obtener historial de movimientos de stock (almacenista - lectura)
router.get(
  '/historial-movimientos',
  verificarToken,
  verificarRol([3, 4]),
  materialController.getHistorialMovimientos
);

// Obtener materiales con stock bajo (almacenista - lectura)
router.get(
  '/stock-bajo',
  verificarToken,
  verificarRol([3, 4]),
  materialController.getMaterialesStockBajo
);

/**
 * ========================
 * RUTAS SOLO PARA ADMINISTRADORES (ROL 4)
 * ========================
 */
// Crear categorías de materiales (solo admin)
router.post(
  '/categorias',
  verificarToken,
  requireAdmin,
  materialController.crearCategoria
);

// Actualizar categorías (solo admin)
router.put(
  '/categorias/:id',
  verificarToken,
  requireAdmin,
  materialController.actualizarCategoria
);

// Eliminar categorías (solo admin)
router.delete(
  '/categorias/:id',
  verificarToken,
  requireAdmin,
  materialController.eliminarCategoria
);

// Obtener todos los usuarios con sus permisos (solo admin)
router.get(
  '/usuarios-permisos',
  verificarToken,
  requireAdmin,
  materialController.getUsuariosConPermisos
);

// Obtener estado del sistema de materiales (admin)
router.get(
  '/estado-sistema',
  verificarToken,
  requireAdmin,
  materialController.getEstadoSistema
);

// Solicitudes de alumnos que el docente debe aprobar
router.get(
  '/solicitudes/docente/aprobar',
  verificarToken,
  verificarRol([2, 4]),
  materialController.getSolicitudesParaDocenteAprobar
);

// Solicitudes creadas por el propio docente
router.get(
  '/solicitudes/docente/mias',
  verificarToken,
  verificarRol([2, 4]),
  materialController.getSolicitudesDocentePropias
);

router.get('/:id', verificarToken, materialController.getMaterialById);


module.exports = router;
