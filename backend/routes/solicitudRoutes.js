//backend/routes/solicitudRoutes.js
const express = require('express');
const router = express.Router();
const solicitudController = require('../controllers/solicitudController.js');
const { 
  verificarToken, 
  verificarRol, 
  verificarAccesoStock,
  requireAdmin 
} = require('../middleware/authMiddleware');

/**
 * ========================================
 * RUTAS PARA ALUMNOS (ROL 1)
 * ========================================
 */

// Crear solicitud con adeudo (solo alumnos)
router.post(
  '/con-adeudo',
  verificarToken,
  verificarRol([1]), // Solo alumnos
  solicitudController.crearSolicitudConAdeudo
);

// Obtener mis solicitudes (solo alumnos ven las suyas)
router.get(
  '/mis-solicitudes',
  verificarToken,
  verificarRol([1]),
  solicitudController.obtenerMisSolicitudes
);

// Cancelar mi solicitud (solo alumnos pueden cancelar las suyas)
router.put(
  '/cancelar/:id',
  verificarToken,
  verificarRol([1]),
  solicitudController.cancelarMiSolicitud
);

/**
 * ========================================
 * RUTAS PARA DOCENTES (ROL 2)
 * ========================================
 */

// Obtener todas las solicitudes (docentes ven todas)
router.get(
  '/todas',
  verificarToken,
  verificarRol([2, 4]), // Docentes y administradores
  solicitudController.obtenerTodasSolicitudes // <- CORREGIDO: era getAllSolicitudes
);

// Obtener solicitudes pendientes de aprobación
router.get(
  '/pendientes-aprobacion',
  verificarToken,
  verificarRol([2, 4]),
  solicitudController.obtenerSolicitudesPendientesAprobacion
);

// Aprobar solicitud (solo docentes y admin)
router.put(
  '/aprobar/:id', 
  verificarToken, 
  verificarRol([2, 4]), // Solo docentes y admin
  solicitudController.aprobarSolicitud
);

// Rechazar solicitud (solo docentes y admin)
router.put(
  '/rechazar/:id', 
  verificarToken, 
  verificarRol([2, 4]), // Solo docentes y admin
  solicitudController.rechazarSolicitud
);

/**
 * ========================================
 * RUTAS PARA ALMACENISTAS (ROL 3) - CON CONTROL DE PERMISOS
 * ========================================
 */

// ✅ RUTAS DE CONSULTA (NO REQUIEREN PERMISOS ESPECIALES)

// Obtener solicitudes aprobadas pendientes de entrega
router.get(
  '/aprobadas-pendientes',
  verificarToken,
  verificarRol([3, 4]),
  solicitudController.obtenerSolicitudesAprobadasPendientes
);

// Obtener solicitudes pendientes de devolución
router.get(
  '/pendientes-devolucion',
  verificarToken,
  verificarRol([3, 4]),
  solicitudController.obtenerSolicitudesPendientesDevolucion
);

// Obtener detalle de una solicitud específica
router.get(
  '/detalle/:id',
  verificarToken,
  verificarRol([3, 4]),
  solicitudController.obtenerDetalleSolicitud
);

// ✅ RUTAS QUE REQUIEREN PERMISOS DE STOCK

// Entregar materiales (requiere permisos de stock)
router.put(
  '/entregar/:id',
  verificarToken,
  verificarAccesoStock, // Verificar permisos de stock
  solicitudController.entregarMateriales
);

// Recibir devolución de materiales (requiere permisos de stock)
router.put(
  '/recibir-devolucion/:id',
  verificarToken,
  verificarAccesoStock, // Verificar permisos de stock
  solicitudController.recibirDevolucion
);

// Cancelar solicitud como almacenista (requiere permisos de stock)
router.put(
  '/cancelar-almacen/:id',
  verificarToken,
  verificarAccesoStock, // Verificar permisos de stock
  solicitudController.cancelarSolicitudAlmacen
);

// Ajustar cantidad en solicitud (requiere permisos de stock)
router.put(
  '/ajustar-cantidad/:id',
  verificarToken,
  verificarAccesoStock, // Verificar permisos de stock
  solicitudController.ajustarCantidadSolicitud
);


// Procesar devolución parcial (requiere permisos de stock)
router.put(
  '/devolucion-parcial/:id',
  verificarToken,
  verificarAccesoStock, // Verificar permisos de stock
  solicitudController.procesarDevolucionParcial
);

/**
 * ========================================
 * RUTAS GENERALES (TODOS LOS ROLES AUTENTICADOS)
 * ========================================
 */

// Obtener solicitudes con token (filtradas por rol)
router.get(
  '/',
  verificarToken,
  solicitudController.obtenerSolicitudes
);

// Obtener una solicitud específica por ID
router.get(
  '/:id',
  verificarToken,
  solicitudController.obtenerSolicitudPorId
);

// Obtener historial de una solicitud
router.get(
  '/:id/historial',
  verificarToken,
  solicitudController.obtenerHistorialSolicitud
);

/**
 * ========================================
 * RUTAS DE MANTENIMIENTO Y LIMPIEZA
 * ========================================
 */

// Limpieza manual de solicitudes viejas (docentes, almacenistas y admin)
router.delete(
  '/limpiar-viejas',
  verificarToken,
  verificarRol([2, 3, 4]), // Docentes, almacenistas y admin
  solicitudController.eliminarSolicitudesViejasHandler
);

// Limpieza automática de solicitudes canceladas (solo admin)
router.delete(
  '/limpiar-canceladas',
  verificarToken,
  requireAdmin,
  solicitudController.limpiarSolicitudesCanceladas
);

/**
 * ========================================
 * RUTAS DE REPORTES POR ROL
 * ========================================
 */

// Reportes para docentes
router.get(
  '/reportes/por-alumno',
  verificarToken,
  verificarRol([2, 4]),
  solicitudController.obtenerReportePorAlumno
);

router.get(
  '/reportes/por-fecha',
  verificarToken,
  verificarRol([2, 4]),
  solicitudController.obtenerReportePorFecha
);

// Reportes para almacenistas
router.get(
  '/reportes/entregas-pendientes',
  verificarToken,
  verificarRol([3, 4]),
  solicitudController.obtenerReporteEntregasPendientes
);

router.get(
  '/reportes/devoluciones-pendientes',
  verificarToken,
  verificarRol([3, 4]),
  solicitudController.obtenerReporteDevolucionesPendientes
);

// Historial de solicitudes (solo admin)
router.get(
  '/historial',
  verificarToken,
  verificarRol([4]),
  solicitudController.obtenerHistorialSolicitudes
);

// Marcar solicitud como vista
router.put(
  '/:id/marcar-vista',
  verificarToken,
  solicitudController.marcarSolicitudVista
);

// Obtener notificaciones pendientes del usuario
router.get(
  '/notificaciones/pendientes',
  verificarToken,
  solicitudController.obtenerNotificacionesPendientes
);

// Informar préstamo vencido
router.post(
  '/:id/informar-vencido',
  verificarToken,
  verificarRol([3]),
  solicitudController.informarPrestamoVencido
);

/**
 * ========================================
 * RUTAS DE BÚSQUEDA Y FILTROS
 * ========================================
 */

// Buscar solicitudes por término
router.get(
  '/buscar/:termino',
  verificarToken,
  solicitudController.buscarSolicitudes
);

// Filtrar solicitudes por múltiples criterios
router.post(
  '/filtrar',
  verificarToken,
  solicitudController.filtrarSolicitudes
);

// Obtener solicitudes por estado específico
router.get(
  '/estado/:estado',
  verificarToken,
  solicitudController.obtenerSolicitudesPorEstado
);

// Obtener solicitudes por rango de fechas
router.get(
  '/rango-fechas/:inicio/:fin',
  verificarToken,
  solicitudController.obtenerSolicitudesPorRangoFechas
);

router.get(
  '/grupo',
  verificarToken,
  solicitudController.obtenerGrupoPorUsuario
);

module.exports = router;
