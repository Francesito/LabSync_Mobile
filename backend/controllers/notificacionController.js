const {
  crearNotificacion,
  obtenerNotificacionesPorUsuario,
  eliminarNotificacion,
eliminarNotificacionesUsuario,
  marcarNotificacionesLeidas
} = require('../models/notificacion');

const obtenerNotificaciones = async (req, res) => {
  try {
    const notificaciones = await obtenerNotificacionesPorUsuario(req.usuario.id);
    res.json(notificaciones);
  } catch (error) {
    console.error('Error al obtener notificaciones:', error);
    res.status(500).json({ error: 'Error al obtener notificaciones' });
  }
};

const eliminar = async (req, res) => {
  const { id } = req.params;
  try {
    await eliminarNotificacion(id, req.usuario.id);
    res.json({ mensaje: 'Notificación eliminada' });
  } catch (error) {
    console.error('Error al eliminar notificación:', error);
    res.status(500).json({ error: 'Error al eliminar notificación' });
  }
};

const eliminarTodas = async (req, res) => {
  try {
    await eliminarNotificacionesUsuario(req.usuario.id);
    res.json({ mensaje: 'Notificaciones eliminadas' });
  } catch (error) {
    console.error('Error al eliminar todas las notificaciones:', error);
    res.status(500).json({ error: 'Error al eliminar todas las notificaciones' });
  }
};

const marcarLeidas = async (req, res) => {
  try {
    await marcarNotificacionesLeidas(req.usuario.id);
    res.json({ mensaje: 'Notificaciones marcadas como leídas' });
  } catch (error) {
    console.error('Error al marcar notificaciones como leídas:', error);
    res.status(500).json({ error: 'Error al marcar notificaciones como leídas' });
  }
};

module.exports = {
  crearNotificacion,
  obtenerNotificaciones,
  eliminar,
  eliminarTodas,
  marcarLeidas
};
