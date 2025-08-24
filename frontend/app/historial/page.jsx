'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../lib/auth';

export default function Historial() {
  const { usuario } = useAuth();
  const [busqueda, setBusqueda] = useState('');
  const [historial, setHistorial] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [vista, setVista] = useState('solicitudes');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mostrarTodoSolicitudes, setMostrarTodoSolicitudes] = useState(false);
  const [mostrarTodoMovimientos, setMostrarTodoMovimientos] = useState(false);
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';

  const formatearFecha = (fecha) => {
    if (!fecha) return '-';
    try {
    const [year, month, day] = fecha.split('T')[0].split('-');
      return `${day}/${month}/${year}`;
    } catch (e) {
      return '-';
    }
  };

  const getEstadoBadgeClass = (estado) => {
    const classes = {
      'pendiente': 'bg-yellow-100 text-yellow-800',
      'aprobada': 'bg-blue-100 text-blue-800',
      'entregado': 'bg-green-100 text-green-800',
      'devuelto parcial': 'bg-orange-100 text-orange-800',
      'devuelto total': 'bg-gray-100 text-gray-800',
      'cancelado': 'bg-red-100 text-red-800'
    };
    return classes[estado] || 'bg-gray-100 text-gray-800';
  };

  const solicitudesMostradas = mostrarTodoSolicitudes ? historial : historial.slice(0, 8);
  const movimientosMostrados = mostrarTodoMovimientos ? movimientos : movimientos.slice(0, 8);
  
  useEffect(() => {
    // Verificar permisos - almacén (3) o administradores (4)
    if (!usuario || ![3, 4].includes(usuario.rol_id)) {
      setError('Acceso denegado. Solo administradores o almacenistas pueden ver el historial.');
      return;
    }

    const cargarDatos = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('Token no encontrado');
        }

        const headers = { Authorization: `Bearer ${token}` };
        const params = new URLSearchParams();
        if (busqueda) params.append('busqueda', busqueda);
        const query = params.toString() ? `?${params.toString()}` : '';

        const solicitudesPromise = axios.get(
          `${baseUrl}/api/materials/solicitudes/historial${query}`,
          { headers }
        );

        const movimientosPromise = axios.get(
          `${baseUrl}/api/materials/historial-movimientos${query}`,
          { headers }
        );

        const [solRes, movRes] = await Promise.all([
          solicitudesPromise,
          movimientosPromise
        ]);

        const historialData = solRes.data.historial || [];
        const movimientosData = movRes.data.movimientos || movRes.data || [];

        setHistorial(historialData);
        setMovimientos(movimientosData);
        setMostrarTodoSolicitudes(false);
        setMostrarTodoMovimientos(false);
      } catch (err) {
        console.error('Error al cargar datos del historial:', err);
        setError(err.response?.data?.error || err.message || 'Error al cargar datos');
      } finally {
        setLoading(false);
      }
    };

    const handler = setTimeout(() => {
      cargarDatos();
    }, 300);

    return () => clearTimeout(handler);
  }, [usuario, busqueda, baseUrl]);

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="text-red-800 font-medium">Error</div>
          <div className="text-red-700 mt-1">{error}</div>
        </div>
      </div>
    );
  }

  // Verificación adicional por si acaso
  if (!usuario || ![3, 4].includes(usuario.rol_id)) {
    return (
      <div className="p-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="text-yellow-800 font-medium">Acceso Denegado</div>
          <div className="text-yellow-700 mt-1">Solo administradores o almacenistas pueden ver el historial del sistema.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-screen font-sans space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Historial del Sistema</h1>
        <div className="text-sm text-gray-600">
          {historial.length} solicitudes • {movimientos.length} movimientos
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block mb-1 font-medium text-sm text-gray-700">Buscar</label>
            <input
              type="text"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Nombre o folio"
              disabled={vista === 'movimientos'}
              className="border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setVista('solicitudes')}
              className={`px-4 py-2 rounded ${vista === 'solicitudes' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'} hover:bg-blue-600 hover:text-white transition-colors`}
            >
              Solicitudes
            </button>
            <button
              onClick={() => setVista('movimientos')}
              className={`px-4 py-2 rounded ${vista === 'movimientos' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'} hover:bg-blue-600 hover:text-white transition-colors`}
            >
              Movimientos de Inventario
            </button>
          </div>
          {busqueda && (
            <button
              onClick={() => setBusqueda('')}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors text-sm"
            >
              Limpiar filtro
            </button>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {vista === 'solicitudes' ? (
          <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
            <div className="px-4 py-3 border-b bg-[#00BCD4] text-white">
              <h2 className="font-semibold text-lg">Historial de Solicitudes</h2>
              <p className="text-sm mt-1">
                {historial.length} solicitudes encontradas
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-[#00BCD4] text-white">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider">Folio</th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider">Solicitante</th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider">Encargado</th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider">Recolección</th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider">Devolución</th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider">Estado</th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider">Materiales</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {solicitudesMostradas.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-3 py-8 text-center text-gray-500">
                        No se encontraron solicitudes
                      </td>
                    </tr>
                  ) : (
                    solicitudesMostradas.map(h => (
                      <tr key={h.id} className="hover:bg-gray-50">
                        <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{h.folio}</td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{h.nombre_display || h.solicitante}</td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{h.encargado}</td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{formatearFecha(h.fecha_recoleccion)}</td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{formatearFecha(h.fecha_devolucion)}</td>
                        <td className="px-3 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getEstadoBadgeClass(h.estado)}`}>
                            {h.estado}
                          </span>
                        </td>
                         <td className="px-3 py-4 text-sm text-gray-900 max-w-xs whitespace-pre-line break-words" title={h.materiales}>
                          {h.materiales || 'Sin materiales'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {(!mostrarTodoSolicitudes && historial.length > 8) && (
              <div className="px-4 py-2 bg-gray-50 text-center">
                <button
                  onClick={() => setMostrarTodoSolicitudes(true)}
                  className="text-blue-600 hover:underline text-sm"
                >
                  Mostrar más
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
            <div className="px-4 py-3 border-b bg-[#00BCD4] text-white">
              <h2 className="font-semibold text-lg">Movimientos de Inventario</h2>
              <p className="text-sm mt-1">
                {movimientos.length} movimientos registrados
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-[#00BCD4] text-white">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider">Material</th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider">Tipo</th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider">Movimiento</th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider">Cantidad</th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider">Stock Actual</th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider">Usuario</th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider">Fecha</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {movimientosMostrados.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-3 py-8 text-center text-gray-500">
                        No se encontraron movimientos
                      </td>
                    </tr>
                  ) : (
                    movimientosMostrados.map(m => (
                      <tr key={m.id} className="hover:bg-gray-50">
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{m.nombre_material || 'Material Desconocido'}</td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">{m.tipo}</td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">{m.tipo_movimiento}</td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className={m.cantidad > 0 ? 'text-green-600' : 'text-red-600'}>
                            {m.cantidad > 0 ? '+' : ''}{m.cantidad} {m.unidad}
                          </span>
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{m.stock_actual} {m.unidad}</td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{m.usuario || 'Sistema'}</td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{formatearFecha(m.fecha_movimiento)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {(!mostrarTodoMovimientos && movimientos.length > 8) && (
              <div className="px-4 py-2 bg-gray-50 text-center">
                <button
                  onClick={() => setMostrarTodoMovimientos(true)}
                  className="text-blue-600 hover:underline text-sm"
                >
                  Mostrar más
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
