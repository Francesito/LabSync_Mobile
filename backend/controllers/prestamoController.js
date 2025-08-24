// backend/controllers/prestamoController.js
const pool = require('../config/db');

const crearPrestamo = async (req, res) => {
  const { usuario_id, material_id, fecha_prestamo, fecha_devolucion } = req.body;
  try {
    const [adeudos] = await pool.query('SELECT * FROM Adeudo WHERE usuario_id = ? AND pagado = FALSE', [usuario_id]);
    if (adeudos.length > 0) {
      return res.status(400).json({ error: 'Usuario con adeudos pendientes' });
    }

    await pool.query(
      'INSERT INTO Prestamo (usuario_id, material_id, fecha_prestamo, fecha_devolucion, estado) VALUES (?, ?, ?, ?, ?)',
      [usuario_id, material_id, fecha_prestamo, fecha_devolucion, 'activo']
    );
    await pool.query('UPDATE Material SET estado = ? WHERE id = ?', ['prestado', material_id]);
    res.status(201).json({ mensaje: 'Préstamo creado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear préstamo' });
  }
};

const devolverMaterial = async (req, res) => {
  const { id } = req.params;
  const { fecha_devolucion } = req.body;
  try {
    const [prestamo] = await pool.query('SELECT * FROM Prestamo WHERE id = ?', [id]);
    if (prestamo.length === 0) {
      return res.status(404).json({ error: 'Préstamo no encontrado' });
    }

    const fechaVencimiento = new Date(prestamo[0].fecha_devolucion);
    const fechaActual = new Date(fecha_devolucion);
    if (fechaActual > fechaVencimiento) {
      await pool.query(
        'INSERT INTO Adeudo (usuario_id, monto, tipo, fecha, pagado) VALUES (?, ?, ?, ?, ?)',
        [prestamo[0].usuario_id, 50.00, 'retraso', new Date(), false]
      );
    }

    await pool.query('UPDATE Prestamo SET estado = ?, fecha_devolucion = ? WHERE id = ?', ['devuelto', fecha_devolucion, id]);
    await pool.query('UPDATE Material SET estado = ? WHERE id = ?', ['disponible', prestamo[0].material_id]);
    res.json({ mensaje: 'Material devuelto' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al devolver material' });
  }
};

const obtenerPrestamos = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.*, u.nombre as usuario, m.nombre as material 
      FROM Prestamo p 
      JOIN Usuario u ON p.usuario_id = u.id 
      JOIN Material m ON p.material_id = m.id
    `);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener préstamos' });
  }
};

module.exports = { crearPrestamo, devolverMaterial, obtenerPrestamos };