const { getResiduos, createResiduo, deleteResiduos } = require('../models/residuo');

const obtenerResiduos = async (req, res) => {
  try {
  const residuos = await getResiduos(req.usuario);
    res.json(residuos);
  } catch (error) {
    console.error('[Error] obtenerResiduos:', error);
    res.status(500).json({ error: 'Error al obtener residuos: ' + error.message });
  }
};

const registrarResiduo = async (req, res) => {
  const { fecha, laboratorio, reactivo, tipo, cantidad, unidad } = req.body;
  if (!fecha || !laboratorio || !reactivo || !tipo || !cantidad || !unidad) {
    return res.status(400).json({ error: 'Faltan datos obligatorios' });
  }
  try {
   const usuario_id = req.usuario?.id;
    if (!usuario_id) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }
    const nuevo = await createResiduo({ usuario_id, fecha, laboratorio, reactivo, tipo, cantidad, unidad });
    res.status(201).json(nuevo);
  } catch (error) {
    console.error('[Error] registrarResiduo:', error);
    res.status(500).json({ error: 'Error al registrar residuo: ' + error.message });
  }
};

const eliminarResiduos = async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'No se proporcionaron IDs' });
  }
  try {
    await deleteResiduos(ids);
    res.json({ mensaje: 'Residuos eliminados correctamente' });
  } catch (error) {
    console.error('[Error] eliminarResiduos:', error);
    res.status(500).json({ error: 'Error al eliminar residuos: ' + error.message });
  }
};

module.exports = { obtenerResiduos, registrarResiduo, eliminarResiduos };
