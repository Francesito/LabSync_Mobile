// app/residuos/page.jsx
'use client';

import { useState, useEffect } from 'react';
import { obtenerResiduos, registrarResiduo, eliminarResiduos } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const LABS = [
  'Laboratorio de Química Básica',
  'Lab. de Química Analítica',
  'Lab. de Tecnología Ambiental',
  'Lab. de Fisicoquímica',
  'Lab. de Operaciones Unitarias',
  'Lab. de Análisis Instrumental',
  'Lab. de Microbiología'
];

const RESIDUE_TYPES = [
  { label: 'Químico', value: 'quimico', icon: '⚗️', color: 'text-orange-600' },
  { label: 'Biológico', value: 'biologico', icon: '🧬', color: 'text-green-600' },
  { label: 'Radiactivo', value: 'radiactivo', icon: '☢️', color: 'text-yellow-600' },
  { label: 'Común', value: 'comun', icon: '🗑️', color: 'text-gray-600' }
];

const getTipoLabel = (value) =>
  RESIDUE_TYPES.find((t) => t.value === value)?.label || value;

const getTipoIcon = (value) =>
  RESIDUE_TYPES.find((t) => t.value === value)?.icon || '📋';

const getTipoColor = (value) =>
  RESIDUE_TYPES.find((t) => t.value === value)?.color || 'text-gray-600';

const formatDate = (d) => {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
};

export default function ResiduosPage() {
  const [form, setForm] = useState({
    fecha: formatDate(new Date()),
    laboratorio: '',
    reactivo: '',
    tipo: '',
    cantidad: '',
    unidad: '',
  });

  const [entries, setEntries] = useState([]);
  const [selected, setSelected] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
    const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const { usuario } = useAuth();

  useEffect(() => {
    obtenerResiduos()
      .then((data) => {
       setEntries(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        setEntries([]);
      });
  }, [usuario]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { fecha, laboratorio, reactivo, tipo, cantidad, unidad } = form;

    if (!fecha || !laboratorio || !reactivo || !tipo || !cantidad || !unidad) return;

    setIsLoading(true);
    try {
      const payload = {
        fecha,
        laboratorio,
        reactivo,
        tipo,
        cantidad: parseFloat(cantidad),
        unidad,
      };

      const saved = await registrarResiduo(payload);
      // Asegura que 'saved' tenga un 'id' único
      setEntries((prev) => [saved, ...prev]);
      setForm({
        fecha: formatDate(new Date()),
        laboratorio: '',
        reactivo: '',
        tipo: '',
        cantidad: '',
        unidad: '',
      });
    } catch (err) {
      console.error('Error al registrar residuo:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelect = (id) => {
    setSelected((sel) =>
      sel.includes(id) ? sel.filter((i) => i !== id) : [...sel, id]
    );
  };

  const handleDelete = async () => {
    if (selected.length === 0) return;
    try {
      await eliminarResiduos(selected);
      setEntries((prev) => prev.filter((e) => !selected.includes(e.id)));
      setSelected([]);
    } catch (err) {
      console.error('Error al eliminar residuos:', err);
    }
  };

 const filteredEntries = entries.filter((e) => {
    const date = formatDate(e.fecha);
    if (fromDate && date < fromDate) return false;
    if (toDate && date > toDate) return false;
    return true;
  });

  const handleDownload = () => {
    if (filteredEntries.length === 0) return;
    const headers = ['Fecha', 'Laboratorio', 'Reactivo', 'Tipo', 'Cantidad', 'Unidad'];
  const rows = filteredEntries.map(e => [
      formatDate(e.fecha),
      e.laboratorio,
      e.reactivo,
      getTipoLabel(e.tipo),
      e.cantidad,
      e.unidad
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'residuos.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPDF = () => {
    if (filteredEntries.length === 0) return;
    const doc = new jsPDF();
    const headers = ['Fecha', 'Laboratorio', 'Reactivo', 'Tipo', 'Cantidad', 'Unidad'];
   const rows = filteredEntries.map(e => [
      formatDate(e.fecha),
      e.laboratorio,
      e.reactivo,
      getTipoLabel(e.tipo),
      e.cantidad,
      e.unidad
    ]);
    autoTable(doc, {
      head: [headers],
      body: rows,
    });
    doc.save('residuos.pdf');
  };
  
    const allChecked =
    filteredEntries.length > 0 && filteredEntries.every((e) => selected.includes(e.id));

 if ([3, 4].includes(usuario?.rol_id)) return <p>Acceso denegado</p>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
      {/* Header con animación sutil */}
      <div className="text-center mb-8 transform transition-all duration-700 ease-out">
        <div className="inline-flex items-center gap-3 mb-4">
          <div className="text-4xl animate-pulse">⚠️</div>
          <h1 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
            Bitácora de Residuos Peligrosos
          </h1>
          <div className="text-4xl animate-pulse">⚠️</div>
        </div>
        <div className="w-24 h-1 bg-gradient-to-r from-blue-500 to-green-500 mx-auto rounded-full"></div>
      </div>

      <div className="flex flex-col xl:flex-row gap-8">
        {/* Historial */}
        <section className="flex-1 transform transition-all duration-500 ease-out">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-gray-800 to-gray-700 px-6 py-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📋</span>
                  <h2 className="text-xl font-semibold text-white">Historial de Registros</h2>
                  <span className="bg-blue-500 text-white px-2 py-1 rounded-full text-sm font-medium">
                    {filteredEntries.length}
                  </span>
                </div>
               <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="border rounded px-2 py-1 text-gray-800"
                    />
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="border rounded px-2 py-1 text-gray-800"
                    />
                  </div>
                  <button
                    onClick={handleDownload}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                      disabled={filteredEntries.length === 0}
                  >
                    <span>📊</span>
                    <span className="hidden sm:inline">CSV</span>
                  </button>
                  <button
                    onClick={handleDownloadPDF}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                   disabled={filteredEntries.length === 0}
                  >
                    <span>📄</span>
                    <span className="hidden sm:inline">PDF</span>
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={selected.length === 0}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                  >
                    <span>🗑️</span>
                    <span className="hidden sm:inline">Eliminar</span>
                    {selected.length > 0 && (
                      <span className="bg-red-800 px-2 py-1 rounded-full text-xs">
                        {selected.length}
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6">
              {filteredEntries.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4 opacity-50">📭</div>
                  <p className="text-gray-500 text-lg">No hay residuos registrados aún.</p>
                  <p className="text-gray-400 text-sm mt-2">Comienza registrando tu primer residuo</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b-2 border-gray-200">
                        <th className="px-4 py-3 text-left">
                          <input
                            type="checkbox"
                            checked={allChecked}
                            onChange={(e) =>
                              setSelected(
                                 e.target.checked
                                  ? filteredEntries.map((en) => en.id)
                                  : []
                              )
                            }
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 transition-all duration-200"
                          />
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">📅 Fecha</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">🏢 Laboratorio</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">🧪 Reactivo</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">🏷️ Tipo</th>
                        <th className="px-4 py-3 text-right font-semibold text-gray-700">⚖️ Cantidad</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">📏 Unidad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEntries.map((entry, index) => (
                        <tr
                          key={entry.id}
                          className="border-b hover:bg-blue-50 transition-all duration-200 transform hover:scale-[1.01]"
                          style={{ 
                            animationDelay: `${index * 50}ms`,
                            animation: 'fadeIn 0.5s ease-out forwards'
                          }}
                        >
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selected.includes(entry.id)}
                              onChange={() => toggleSelect(entry.id)}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 transition-all duration-200"
                            />
                          </td>
                          <td className="px-4 py-3 text-gray-800">{formatDate(entry.fecha)}</td>
                          <td className="px-4 py-3 text-gray-800 max-w-xs truncate" title={entry.laboratorio}>
                            {entry.laboratorio}
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-900">{entry.reactivo}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{getTipoIcon(entry.tipo)}</span>
                              <span className={`font-medium ${getTipoColor(entry.tipo)}`}>
                                {getTipoLabel(entry.tipo)}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-medium text-gray-900">
                            {Number(entry.cantidad).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-gray-700 font-medium">{entry.unidad}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Formulario */}
        <div className="xl:w-96">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden transform transition-all duration-500 ease-out hover:shadow-xl">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">➕</span>
                <h3 className="text-xl font-semibold text-white">Nuevo Registro</h3>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-6">
                {/* Fecha */}
                <div className="transform transition-all duration-300 hover:translate-x-1">
                  <label className="flex items-center gap-2 text-sm font-medium mb-2 text-gray-700">
                    <span>📅</span>
                    Fecha *
                  </label>
                  <input
                    type="date"
                    name="fecha"
                    value={form.fecha}
                    onChange={handleChange}
                    className="w-full border border-gray-300 px-4 py-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                    required
                  />
                </div>

                {/* Laboratorio */}
                <div className="transform transition-all duration-300 hover:translate-x-1">
                  <label className="flex items-center gap-2 text-sm font-medium mb-2 text-gray-700">
                    <span>🏢</span>
                    Laboratorio *
                  </label>
                  <select
                    name="laboratorio"
                    value={form.laboratorio}
                    onChange={handleChange}
                    className="w-full border border-gray-300 px-4 py-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white"
                    required
                  >
                    <option value="">-- Seleccionar laboratorio --</option>
                    {LABS.map((lab) => (
                      <option key={lab} value={lab}>
                        {lab}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Reactivo */}
                <div className="transform transition-all duration-300 hover:translate-x-1">
                  <label className="flex items-center gap-2 text-sm font-medium mb-2 text-gray-700">
                    <span>🧪</span>
                    Reactivo *
                  </label>
                  <input
                    type="text"
                    name="reactivo"
                    value={form.reactivo}
                    onChange={handleChange}
                    className="w-full border border-gray-300 px-4 py-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                    placeholder="Nombre del reactivo"
                    required
                  />
                </div>

                {/* Tipo de residuo */}
                <div className="transform transition-all duration-300 hover:translate-x-1">
                  <label className="flex items-center gap-2 text-sm font-medium mb-2 text-gray-700">
                    <span>🏷️</span>
                    Tipo de Residuo *
                  </label>
                  <select
                    name="tipo"
                    value={form.tipo}
                    onChange={handleChange}
                    className="w-full border border-gray-300 px-4 py-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white"
                    required
                  >
                    <option value="">-- Seleccionar tipo --</option>
                    {RESIDUE_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.icon} {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Cantidad */}
                  <div className="transform transition-all duration-300 hover:translate-x-1">
                    <label className="flex items-center gap-2 text-sm font-medium mb-2 text-gray-700">
                      <span>⚖️</span>
                      Cantidad *
                    </label>
                    <input
                      type="number"
                      name="cantidad"
                      value={form.cantidad}
                      onChange={handleChange}
                      step="0.01"
                      className="w-full border border-gray-300 px-4 py-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                      placeholder="0.00"
                      required
                    />
                  </div>

                  {/* Unidad */}
                  <div className="transform transition-all duration-300 hover:translate-x-1">
                    <label className="flex items-center gap-2 text-sm font-medium mb-2 text-gray-700">
                      <span>📏</span>
                      Unidad *
                    </label>
                    <select
                      name="unidad"
                      value={form.unidad}
                      onChange={handleChange}
                      className="w-full border border-gray-300 px-4 py-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white"
                      required
                    >
                      <option value="">-- Unidad --</option>
                      <option value="g">g (gramos)</option>
                      <option value="ml">mL (mililitros)</option>
                      <option value="u">u (unidades)</option>
                    </select>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="mt-8 w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-4 rounded-lg font-semibold transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                    Registrando...
                  </>
                ) : (
                  <>
                    <span>💾</span>
                    Registrar Residuo
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* CSS adicional para la animación fadeIn */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
