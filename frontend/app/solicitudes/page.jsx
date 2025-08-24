'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import axios from 'axios';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../../lib/auth';

const encabezadoUT = '/universidad.jpg';

/** Badge de estado */
const EstadoBadge = ({ estado }) => {
  const config = {
    'aprobación pendiente': { bg: 'bg-amber-100', text: 'text-amber-800', icon: '⏳' },
    'aprobacion pendiente': { bg: 'bg-amber-100', text: 'text-amber-800', icon: '⏳' }, // fallback sin tilde
    'entrega pendiente':    { bg: 'bg-blue-100',  text: 'text-blue-800',  icon: '📦' },
    'entregada':            { bg: 'bg-green-100', text: 'text-green-800', icon: '✓'  },
    'rechazada':            { bg: 'bg-red-100',   text: 'text-red-800',   icon: '✗'  },
    'cancelado':            { bg: 'bg-gray-100',  text: 'text-gray-800',  icon: '❌' },
    'cancelada':            { bg: 'bg-gray-100',  text: 'text-gray-800',  icon: '❌' },
    'eliminación automática por falta de recolección': { bg: 'bg-red-100', text: 'text-red-800', icon: '⚠️' },
    'eliminacion automatica por falta de recoleccion': { bg: 'bg-red-100', text: 'text-red-800', icon: '⚠️' }, // fallback sin tildes
    'pendiente':            { bg: 'bg-yellow-100',text: 'text-yellow-800',icon: '⏳' } // fallback
  };
  const safe = (estado || '').toLowerCase().trim();
  const { bg, text, icon } = config[safe] || config.pendiente;
  return (
    <span className={`${bg} ${text} inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium shadow-sm transition-all duration-200 hover:scale-105 hover:shadow-md`}>
      <span className="animate-pulse">{icon}</span>
      <span className="capitalize">{estado}</span>
    </span>
  );
};

const SkeletonRow = ({ colCount }) => (
  <tr className="animate-pulse">
    {Array.from({ length: colCount }).map((_, i) => (
      <td key={i} className="px-6 py-4">
        <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 rounded w-24 animate-shimmer" />
      </td>
    ))}
  </tr>
);

const Th = ({ children, icon }) => (
  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider bg-[#003579] first:rounded-tl-lg last:rounded-tr-lg transition-colors duration-200 hover:bg-[#0056b3]">
    <div className="flex items-center gap-2">
      {icon && <span className="text-sm">{icon}</span>}
      {children}
    </div>
  </th>
);

const Td = ({ children, bold = false }) => (
  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 transition-colors duration-200 hover:bg-gray-50">
    <div className={`${bold ? 'font-semibold' : ''} transition-all duration-200`}>
      {children}
    </div>
  </td>
);

const Btn = ({ children, color, onClick, disabled, icon }) => {
  const palette = {
    green:  'bg-green-600 hover:bg-green-700 focus:ring-green-500',
    red:    'bg-red-600 hover:bg-red-700 focus:ring-red-500',
    blue:   'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
    gray:   'bg-gray-600 hover:bg-gray-700 focus:ring-gray-500',
    purple: 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500'
  }[color] || 'bg-slate-600 hover:bg-slate-700 focus:ring-slate-500';
  
  return (
    <button
      type="button"
      className={`${palette} text-white text-sm rounded-lg px-3 py-2 disabled:opacity-60 disabled:cursor-not-allowed 
        transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-1
        shadow-md hover:shadow-lg active:scale-95 flex items-center gap-2`}
      onClick={onClick}
      disabled={disabled}
    >
      {icon && <span className="text-sm">{icon}</span>}
      {children}
    </button>
  );
};

function getUnidad(tipo) {
  return { liquido: 'ml', solido: 'g' }[tipo] || 'u';
}

function toLocalDateStr(date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000)
    .toISOString()
    .split('T')[0];
}

function formatFechaStr(fecha) {
  if (!fecha) return '';
  try {
   const datePart = String(fecha).split('T')[0];
    const [year, month, day] = datePart.split('-');
    return `${day}/${month}/${year}`;
  } catch (e) {
    return '';
  }
}

/** Tabla genérica configurable por columnas */
function TablaSolicitudes({
  titulo,
  data,
  loading,
  showSolicitante = true,
  showEncargado = false,
  showGrupo = false,
  columnasFijas = {},
  usuario,
  onAccion,
  onEntregar,
  onPDF,
  procesandoId
}) {
  const columnas = {
    folio: columnasFijas.folio ?? true,
    solicitante: showSolicitante,
    encargado: showEncargado,
    materiales: columnasFijas.materiales ?? true,
    fecha: columnasFijas.fecha ?? true,
    grupo: showGrupo,
    estado: columnasFijas.estado ?? true,
    acciones: columnasFijas.acciones ?? true,
  };
  const colCount = Object.values(columnas).filter(Boolean).length;
  const today = new Date();
  const todayStr = toLocalDateStr(today);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowStr = toLocalDateStr(tomorrow);
  
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden mb-8 transition-all duration-300 hover:shadow-xl hover:border-blue-300">
      <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-[#003579] to-[#0056b3] text-white flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <span className="text-xl animate-spin-slow">📋</span>
          {titulo}
        </h2>
        <span className="text-sm bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm hover:bg-white/30 transition-colors duration-200">
          {data?.length || 0} registros
        </span>
      </div>

      <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-blue-500 scrollbar-track-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gradient-to-r from-[#003579] to-[#0056b3]">
            <tr>
              {columnas.folio && <Th icon="🏷️">Folio</Th>}
              {columnas.solicitante && <Th icon="👤">Solicitante</Th>}
              {columnas.encargado && <Th icon="👨‍🏫">Encargado</Th>}
              {columnas.materiales && <Th icon="📦">Materiales</Th>}
              {columnas.fecha && <Th icon="📅">Fecha</Th>}
              {columnas.grupo && <Th icon="👥">Grupo</Th>}
              {columnas.estado && <Th icon="📊">Estado</Th>}
              {columnas.acciones && <Th icon="⚡">Acciones</Th>}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              [...Array(5)].map((_, i) => <SkeletonRow key={i} colCount={colCount} />)
            ) : data.length === 0 ? (
              <tr>
                <td className="px-6 py-10 text-center text-gray-500" colSpan={colCount}>
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-4xl opacity-50 animate-bounce">📭</span>
                    <span>No hay solicitudes para mostrar.</span>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((s) => {
                const createDateStr = (s.fecha_solicitud || '').split('T')[0];
                const recoDateStr   = (s.fecha_recoleccion || '').split('T')[0];
                const dateStr = usuario?.rol === 'almacen' ? recoDateStr : createDateStr;
                const isOverdue =
                  recoDateStr && recoDateStr < todayStr && s.estado === 'entrega pendiente';
                const showMsg =
                  usuario?.rol !== 'almacen' &&
                  recoDateStr &&
                  recoDateStr > todayStr &&
                  recoDateStr !== todayStr;
                return (
                  <tr key={s.id} className={`hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200 ${isOverdue ? 'border-2 border-red-500 bg-red-50' : ''}`}>
                    {columnas.folio && <Td bold>{s.folio}</Td>}

                    {columnas.solicitante && (
                      <Td>{s.isDocenteRequest ? s.profesor : s.nombre_alumno}</Td>
                    )}

                    {columnas.encargado && <Td>{s.profesor || ''}</Td>}

                    {columnas.materiales && (
                      <td className="px-6 py-4">
                        <div className="space-y-2">
                          {(s.items || []).map((m) => (
                            <div key={m.item_id} className="text-sm flex items-center gap-2 p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-200 shadow-sm hover:shadow-md">
                              <span className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-2 py-1 rounded-full text-xs font-medium shadow-sm">
                                {m.cantidad} {getUnidad(m.tipo)}
                              </span>
                              <span className="flex-1">{m.nombre_material}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                    )}

                    {columnas.fecha && (
                      <Td>
                        <div className="flex items-center gap-2">
                          <span className="text-sm animate-pulse">📅</span>
                          <span>
                           {dateStr ? formatFechaStr(dateStr) : ''}
                          </span>
                        </div>
                        {isOverdue && (
                          <div className="text-xs text-red-600 mt-1 p-2 bg-red-100 rounded-lg border-l-4 border-red-500 animate-pulse shadow-sm">
                            ⚠️ Ha pasado la fecha.<br />
                            Se eliminará la solicitud dentro de 1 día por falta de recolección
                          </div>
                        )}
                       {showMsg && recoDateStr === tomorrowStr && (
                          <div className="text-xs text-orange-600 mt-1 p-2 bg-orange-100 rounded-lg border-l-4 border-orange-500 shadow-sm">
                            🕒 Entrega para mañana
                          </div>
                        )}
                      </Td>
                    )}

                    {columnas.grupo && <Td>{s.grupo || ''}</Td>}

                    {columnas.estado && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <EstadoBadge estado={isOverdue ? 'cancelada' : s.estado} />
                      </td>
                    )}

                    {columnas.acciones && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {/* Docente: aprobar / rechazar */}
                          {usuario?.rol === 'docente' &&
                            !s.isDocenteRequest &&
                            (s.estado === 'aprobación pendiente') && (
                              <>
                                <Btn
                                  color="green"
                                  icon="✅"
                                  onClick={() => onAccion(s.id, 'aprobar', 'entrega pendiente')}
                                  disabled={procesandoId === s.id}
                                >
                                  Aprobar
                                </Btn>
                                <Btn
                                  color="red"
                                  icon="❌"
                                  onClick={() => onAccion(s.id, 'rechazar', 'rechazada')}
                                  disabled={procesandoId === s.id}
                                >
                                  Rechazar
                                </Btn>
                              </>
                            )}

                          {/* Almacén: Entregar cuando UI = entrega pendiente */}
                          {usuario?.rol === 'almacen' &&
                            s.estado === 'entrega pendiente' &&
                            (s.fecha_recoleccion || '').split('T')[0] === toLocalDateStr(new Date()) && (
                              <Btn
                                color="blue"
                                icon="🚚"
                                onClick={() =>
                                  onEntregar ? onEntregar(s) : onAccion(s.id, 'entregar', 'entregada')
                                }
                                disabled={procesandoId === s.id}
                              >
                                Entregar
                              </Btn>
                            )}

                          {/* Alumno: cancelar si está en aprobación pendiente */}
                          {usuario?.rol === 'alumno' &&
                            (s.estado === 'aprobación pendiente') && (
                              <Btn
                                color="gray"
                                icon="🚫"
                                onClick={() => onAccion(s.id, 'cancelar', 'cancelado')}
                                disabled={procesandoId === s.id}
                              >
                                Cancelar
                              </Btn>
                            )}

                          <Btn
                            color="purple"
                            icon="📄"
                            onClick={() => onPDF(s)}
                            disabled={procesandoId === s.id}
                          >
                            PDF
                          </Btn>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SolicitudesPage() {
  const { usuario } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [grupos, setGrupos] = useState({});
  const [alumnoData, setAlumnoData] = useState([]); // alumno
  const [docAprobar, setDocAprobar] = useState([]); // docente: tabla 1
  const [docMias, setDocMias] = useState([]);       // docente: tabla 2
  const [almAlumnos, setAlmAlumnos] = useState([]); // almacén: tabla 1
  const [almDocentes, setAlmDocentes] = useState([]); // almacén: tabla 2
  const [procesando, setProcesando] = useState(null);
  const [filterDate, setFilterDate] = useState('');
  const [minFilterDate, setMinFilterDate] = useState('');
  const [maxFilterDate, setMaxFilterDate] = useState('');
  const [notice, setNotice] = useState('');
  const [activeTab, setActiveTab] = useState('alumnos');
  const [search, setSearch] = useState('');
  const [modalEntrega, setModalEntrega] = useState(null); // {id, items}
  const [selectedItems, setSelectedItems] = useState([]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 10000);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    const today = new Date();
    let day = today.getDay();
    if (day === 0) { today.setDate(today.getDate() + 1); day = 1; }
    else if (day === 6) { today.setDate(today.getDate() + 2); day = 1; }
    const friday = new Date(today);
    friday.setDate(today.getDate() + (5 - day));
    setMinFilterDate(toLocalDateStr(today));
    setMaxFilterDate(toLocalDateStr(friday));
  }, []);

  useEffect(() => {
    if (usuario === null) return;
    if (!usuario) {
      setError('Inicia sesión para ver solicitudes');
      router.push('/login');
      return;
    }
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Inicia sesión para ver solicitudes');
      router.push('/login');
      return;
    }

    const fetchAll = async () => {
      try {
        setLoading(true);

        // Grupos
        try {
          const g = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/grupos`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const map = g.data.reduce((acc, it) => { acc[it.id] = it.nombre; return acc; }, {});
          setGrupos(map);
        } catch (_) {}

        let alumnoArr = [];
        let docAprobarArr = [];
        let docMiasArr = [];
        let almAlumnosArr = [];
        let almDocentesArr = [];
        
        // Alumno
        if (usuario.rol === 'alumno') {
          const { data } = await axios.get(
            `${process.env.NEXT_PUBLIC_API_URL}/api/materials/usuario/solicitudes`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          alumnoArr = agrupar(data, 'alumno', grupos);
          setAlumnoData(alumnoArr);
        }

        // Docente
        if (usuario.rol === 'docente') {
          const [aprobarRes, miasRes] = await Promise.all([
            axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/materials/solicitudes/docente/aprobar`,
              { headers: { Authorization: `Bearer ${token}` } }),
            axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/materials/solicitudes/docente/mias`,
              { headers: { Authorization: `Bearer ${token}` } })
          ]);
          docAprobarArr = agrupar(aprobarRes.data, 'docente', grupos);
          docMiasArr = agrupar(miasRes.data, 'docente', grupos);
          setDocAprobar(docAprobarArr);
          setDocMias(docMiasArr);
        }

        // Almacén (sin filtrar en cliente; solo mapeo de estado especial)
        if (usuario.rol === 'almacen') {
          const { data } = await axios.get(
            `${process.env.NEXT_PUBLIC_API_URL}/api/materials/solicitudes/almacen`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const grouped = agrupar(data, 'almacen', grupos);
          almAlumnosArr = grouped.filter(s => !s.isDocenteRequest);
          almDocentesArr = grouped.filter(s => s.isDocenteRequest);
          setAlmAlumnos(almAlumnosArr);
          setAlmDocentes(almDocentesArr);
        }

        const todayStr = toLocalDateStr(new Date());
        const mañana = new Date();
        mañana.setDate(mañana.getDate() + 1);
        const mañanaStr = toLocalDateStr(mañana);

        let all = [];
        if (usuario.rol === 'alumno') all = alumnoArr;
        if (usuario.rol === 'docente') all = [...docAprobarArr, ...docMiasArr];
        if (usuario.rol === 'almacen') all = [...almAlumnosArr, ...almDocentesArr];
        const pendientes = all.filter(s => s.estado === 'entrega pendiente');
        const hoyCount = pendientes.filter(s => (s.fecha_recoleccion || '').split('T')[0] === todayStr).length;
        const mañanaCount = pendientes.filter(s => (s.fecha_recoleccion || '').split('T')[0] === mañanaStr).length;
        if (usuario.rol === 'almacen' && pendientes.length > 0) {
          let msg = '';
          if (hoyCount > 0 && mañanaCount > 0) {
            msg = `Tienes ${pendientes.length} solicitudes: ${hoyCount} para entregar hoy y ${mañanaCount} para entregar mañana`;
          } else if (hoyCount > 0) {
            msg = `Tienes ${hoyCount} solicitudes para entregar hoy`;
          } else if (mañanaCount > 0) {
            msg = `Tienes ${mañanaCount} solicitudes para entregar mañana`;
          }
            if (msg) {
            setNotice(msg);
          }
        }
        
        setError('');
      } catch (err) {
        console.error(err);
        setError(err.response?.data?.error || 'Error al cargar solicitudes');
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario]);

  /** Agrupa por solicitud y mapea estados UI; para ALMACÉN lo no entregado/rechazado/cancelado = "entrega pendiente". */
  function agrupar(rows, rolVista, gruposMap) {
    const by = {};
    for (const item of rows) {
      const key = item.solicitud_id ?? item.id;
      if (!key) continue;

      const isDocenteReq = !item.nombre_alumno; // solicitudes de docente no traen nombre_alumno

      if (!by[key]) {
        const rawEstado = String(item.estado || '').toLowerCase().trim();
        const estadoUI = mapEstadoPorRol(rawEstado, isDocenteReq, rolVista);

        by[key] = {
          id: key,
           folio: item.folio || '',
          nombre_alumno: item.nombre_alumno || '',
          profesor: item.profesor || '',
          fecha_solicitud: item.fecha_solicitud,
          fecha_recoleccion: item.fecha_recoleccion,
           fecha_devolucion: item.fecha_devolucion,
          estado: estadoUI,
          rawEstado,
          isDocenteRequest: isDocenteReq,
          grupo: isDocenteReq
            ? ''
            : (item.grupo_nombre || (item.grupo_id && gruposMap[item.grupo_id]) || ''),
          items: []
        };
      }

      const nombreMaterialRaw =
        item?.nombre_material ??
        item?.nombreMaterial ??
        item?.material_nombre ??     // ← alias común en otros endpoints
        item?.materialNombre ??      // ← camelCase
        item?.material ??            // ← a veces solo "material"
        item?.nombre ??              // ← último recurso si el backend lo nombra así
        '';

      if (!nombreMaterialRaw) {
        // Debug temporal para ver qué trae esa fila del endpoint "para aprobar"
        console.debug('Fila sin nombre_material:', item);
      }

      const nombreMaterial = String(nombreMaterialRaw).replace(/_/g, ' ').trim();

      by[key].items.push({
        item_id: item.item_id ?? item.solicitud_item_id ?? `${key}-itm-${by[key].items.length + 1}`,
        nombre_material: nombreMaterial || '(Sin nombre)',
        cantidad: item.cantidad ?? item.cantidad_pedida ?? 0,
        tipo: item.tipo
      });
    }
    return Object.values(by).sort(
      (a, b) => new Date(b.fecha_solicitud) - new Date(a.fecha_solicitud)
    );
  }

  /** Mapeo de estados con sensibilidad al rol que visualiza */
  function mapEstadoPorRol(estadoSQL, isDocenteReq, rolVista) {
    const e = (estadoSQL || '').toLowerCase().trim();

    // Vista de ALMACÉN: regla estricta para evitar "aprobación pendiente" allí
    if (rolVista === 'almacen') {
      if (e === 'entregado') return 'entregada';
      if (e === 'rechazada') return 'rechazada';
      if (e === 'cancelado') return 'cancelado';
      if (e === 'sin recoleccion') return 'eliminación automática por falta de recolección';
      // Cualquier otro (incluido 'aprobada' y un posible 'pendiente') se ve como entrega pendiente
      return 'entrega pendiente';
    }

    // Otras vistas (alumno/docente)
    switch (e) {
      case 'pendiente':
        return isDocenteReq ? 'pendiente' : 'aprobación pendiente';
      case 'aprobada':
        return 'entrega pendiente';
      case 'entregado':
        return 'entregada';
      case 'rechazada':
        return 'rechazada';
      case 'cancelado':
        return 'cancelado';
      case 'sin recoleccion':
        return 'eliminación automática por falta de recolección';
      default:
        return 'pendiente';
    }
  }

  /** Acciones aprobar/rechazar/entregar/cancelar */
  const actualizarEstado = async (id, accion, nuevoEstadoUI, items = []) => {
    if (procesando) return;
    setProcesando(id);
    const token = localStorage.getItem('token');
    try {
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/materials/solicitud/${id}/${accion}`,
        accion === 'entregar' ? { items_entregados: items } : {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Helpers para in-place update
      const apply = (arrSetter) =>
        arrSetter(prev =>
          prev.map(s => {
            if (s.id !== id) return s;
            const ui = nuevoEstadoUI;
            const raw = uiToRaw(ui);
            const updated = { ...s, estado: ui, rawEstado: raw };
            if (accion === 'entregar') {
              const idsEntregados = items.map(i => i.item_id);
              updated.items = (s.items || [])
                .filter(it => idsEntregados.includes(it.item_id))
                .map(it => {
                  const entregado = items.find(i => i.item_id === it.item_id);
                  return {
                    ...it,
                    cantidad: entregado ? entregado.cantidad_entregada : it.cantidad
                  };
                });
            }
            return updated;
          })
        );

      const drop = (arrSetter) => arrSetter(prev => prev.filter(s => s.id !== id));

      if (accion === 'cancelar' || accion === 'rechazar') {
        drop(setAlumnoData);
        drop(setDocAprobar);
        drop(setDocMias);
        drop(setAlmAlumnos);
        drop(setAlmDocentes);
      } else {
        apply(setAlumnoData);
        apply(setDocAprobar);
        apply(setDocMias);
        apply(setAlmAlumnos);
        apply(setAlmDocentes);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || `Error al ${accion} la solicitud`);
    } finally {
      setProcesando(null);
    }
  };

  // Mapea estado UI -> estado SQL crudo
  function uiToRaw(estadoUI) {
    const e = (estadoUI || '').toLowerCase().trim();
    if (e === 'entrega pendiente')        return 'aprobada';
    if (e === 'aprobación pendiente' || e === 'aprobacion pendiente') return 'pendiente';
    if (e === 'entregada')                return 'entregado';
    if (e === 'rechazada')                return 'rechazada';
    if (e === 'cancelado')                return 'cancelado';
    if (e === 'eliminación automática por falta de recolección' || e === 'eliminacion automatica por falta de recoleccion') return 'sin recoleccion';
    return e;
  }

  const filterByDate = (arr) =>
    filterDate
      ? arr.filter(s => (s.fecha_recoleccion || '').split('T')[0] === filterDate)
      : arr;

  const filteredAlmAlumnos = filterByDate(almAlumnos);
  const filteredAlmDocentes = filterByDate(almDocentes);

  const applySearch = (arr, includeGrupo = false) => {
    const term = search.toLowerCase();
    if (!term) return arr;
    return arr.filter(s =>
      s.folio.toLowerCase().includes(term) ||
      (s.nombre_alumno || '').toLowerCase().includes(term) ||
      (s.profesor || '').toLowerCase().includes(term) ||
      (includeGrupo && (s.grupo || '').toLowerCase().includes(term))
    );
  };

  const filteredDocAprobar = applySearch(docAprobar, true);
  const filteredDocMias = applySearch(docMias);
  const searchedAlmAlumnos = applySearch(filteredAlmAlumnos, true);
  const searchedAlmDocentes = applySearch(filteredAlmDocentes);

  const pendientesDocAlumnos = docAprobar.filter(
    s => ['aprobación pendiente', 'aprobacion pendiente'].includes((s.estado || '').toLowerCase())
  ).length;
  const pendientesAlmAlumnos = almAlumnos.filter(s => s.estado === 'entrega pendiente').length;
  const pendientesAlmDocentes = almDocentes.filter(s => s.estado === 'entrega pendiente').length;

  const abrirEntrega = (sol) => {
    setModalEntrega(sol);
    setSelectedItems([]);
  };

  const toggleItem = (id) => {
    setSelectedItems(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const seleccionarTodos = () => {
    if (!modalEntrega) return;
    setSelectedItems(modalEntrega.items.map(i => i.item_id));
  };

  const confirmarEntrega = async () => {
    if (!modalEntrega) return;
    const items = modalEntrega.items
      .filter(i => selectedItems.includes(i.item_id))
      .map(i => ({ item_id: i.item_id, cantidad_entregada: i.cantidad }));
    await actualizarEstado(modalEntrega.id, 'entregar', 'entregada', items);
    setModalEntrega(null);
  };
  
   
  /** PDF */
const descargarPDF = async (vale) => {
  try {
      const token = localStorage.getItem('token');
    if (token && vale?.id) {
      try {
        const { data } = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/api/solicitudes/detalle/${vale.id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        vale = { ...vale, ...data };
      } catch (e) {
        console.error('Error al obtener detalle de solicitud:', e);
      }
    }
    
    const doc = new jsPDF({
     orientation: 'portrait',
      unit: 'mm',
    format: 'a4'
    });

    const toBase64 = async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error('No se pudo cargar la imagen');
      const blob = await res.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    };

    const encabezadoImg = await toBase64(encabezadoUT);

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const marginLeft = margin;
    const primary = [0, 0, 0];
    const secondary = [100, 100, 100];

    // Encabezado - Imagen adaptada y más pequeña
    // Calculamos dimensiones más pequeñas manteniendo proporción
    const maxHeaderWidth = (pageWidth - margin * 2) * 0.4; // 40% del ancho disponible
    const maxHeaderHeight = 40; // altura máxima reducida
    
    // Proporción original aproximada (ajusta según tu imagen real)
    const originalRatio = 3.5; // ancho/alto aproximado
    
    let headerWidth, headerHeight;
    
    // Calculamos el tamaño manteniendo proporción y límites
    if (maxHeaderWidth / originalRatio <= maxHeaderHeight) {
      headerWidth = maxHeaderWidth;
      headerHeight = maxHeaderWidth / originalRatio;
    } else {
      headerHeight = maxHeaderHeight;
      headerWidth = maxHeaderHeight * originalRatio;
    }

    // Escalamos la imagen para evitar distorsiones
    const scale = 0.5;
    headerWidth *= scale;
    headerHeight *= scale;
    
    // Centramos la imagen horizontalmente
    const imageX = (pageWidth - headerWidth) / 2;
    const imageY = 18; // posición Y fija
    
    doc.addImage(encabezadoImg, 'JPG', imageX, imageY, headerWidth, headerHeight);
    
    // Título centrado debajo de la imagen
    const titleY = imageY + headerHeight + 8;
    doc.setFontSize(18);
    doc.setTextColor(...primary);
    doc.setFont('helvetica', 'bold');
    doc.text('VALE DE ALMACÉN', pageWidth / 2, titleY, { align: 'center' });
    
    // Tabla de información principal
    const nombre = vale.isDocenteRequest ? vale.profesor : vale.nombre_alumno;
    const grupo = vale.isDocenteRequest ? '' : (vale.grupo || '');
    const fechaReco = formatFechaStr(vale.fecha_recoleccion);
    const fechaDevolucion = formatFechaStr(vale.fecha_devolucion);

     const headInfo = vale.isDocenteRequest
      ? [['Nombre', 'Folio']]
      : [['Nombre', 'Grupo', 'Folio']];
    const bodyInfo = vale.isDocenteRequest
      ? [[nombre, vale.folio]]
      : [[nombre, grupo, vale.folio]];
    
    autoTable(doc, {
       startY: titleY + 5,
      theme: 'grid',
     head: headInfo,
      body: bodyInfo,
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        halign: 'center'
      },
      bodyStyles: { fontSize: 11, cellPadding: 2 },
      styles: { lineColor: primary, lineWidth: 0.2 },
      margin: { top: 0, bottom: 0, left: margin, right: margin },
      tableWidth: pageWidth - margin * 2
    });

    // Tabla de materiales (10 filas, 4 columnas)
    const startY = doc.lastAutoTable.finalY;
    const items = vale.items || [];
    const rows = [];
    for (let i = 0; i < 10; i++) {
      const left = items[i];
      const right = items[i + 10];
      rows.push([
        left ? `${left.cantidad} ${getUnidad(left.tipo)}` : '',
        left ? left.nombre_material : '',
        right ? `${right.cantidad} ${getUnidad(right.tipo)}` : '',
        right ? right.nombre_material : ''
      ]);
    }

    autoTable(doc, {
      startY,
      theme: 'grid',
      head: [['Cantidad', 'Descripción', 'Cantidad', 'Descripción']],
      body: rows,
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        halign: 'center'
      },
      bodyStyles: { fontSize: 10, cellPadding: 2 },
      styles: { lineColor: primary, lineWidth: 0.2 },
      margin: { top: 0, bottom: 0, left: margin, right: margin },
      tableWidth: pageWidth - margin * 2
    });

    // Sección inferior
    const afterTableY = doc.lastAutoTable.finalY + 4;
    const profesor = vale.profesor || '';

    doc.setFontSize(10);
    doc.setTextColor(...primary);

      // Fechas de recolección y devolución
    doc.setFont('helvetica', 'bold');
    doc.text('Fecha recolección:', marginLeft, afterTableY);
    doc.setFont('helvetica', 'normal');
    doc.text(fechaReco, marginLeft + 40, afterTableY);

    doc.setFont('helvetica', 'bold');
  doc.text('Fecha devolución:', pageWidth / 2, afterTableY);
    doc.setFont('helvetica', 'normal');
   doc.text(fechaDevolucion, pageWidth / 2 + 40, afterTableY);

    let noteY = afterTableY;

    if (!vale.isDocenteRequest) {
      const profesorY = afterTableY + 6;
      doc.setFont('helvetica', 'bold');
      doc.text('Profesor:', marginLeft, profesorY);
      doc.setFont('helvetica', 'normal');
      doc.text(profesor, marginLeft + 25, profesorY);
      noteY = profesorY;
    }

    // Nota
    doc.setFontSize(8);
    doc.setTextColor(...secondary);
    doc.setFont('helvetica', 'normal');
    doc.text(
      'NOTA: LA FIRMA DEL PROFESOR AMPARA CUALQUIER EVENTO DURANTE EL TIEMPO QUE DURE LA PRÁCTICA, FAVOR DE RESPETAR LOS HORARIOS',
      pageWidth / 2,
      noteY + 6,
      { align: 'center', maxWidth: pageWidth - margin * 2 }
    );

    const nombrePDF = vale.isDocenteRequest
      ? `Vale_${vale.folio}_${(vale.profesor || '').replace(/\s+/g, '')}.pdf`
      : `Vale_${vale.folio}_${new Date().toISOString().split('T')[0]}.pdf`;

    doc.save(nombrePDF);
  } catch (err) {
    console.error('Error al generar PDF:', err);
  }
};

  // --- RENDER POR ROL ---
  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-100 min-h-screen font-sans">
      {/* Error con mejor styling */}
      {error && (
        <div className="mb-6 p-4 bg-gradient-to-r from-red-50 to-red-100 border border-red-200 rounded-xl shadow-md animate-shake hover:shadow-lg transition-shadow duration-200">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-red-600 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-shadow duration-200">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-red-800 flex items-center gap-2">
                  <span>⚠️</span> Error
                </h3>
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            </div>
            <button 
              onClick={() => setError('')} 
              className="text-red-500 hover:text-red-700 transition-colors duration-200 hover:scale-110 transform"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ALUMNO */}
      {usuario?.rol === 'alumno' && (
        <TablaSolicitudes
          titulo="Mis solicitudes"
          data={alumnoData}
          loading={loading}
          showSolicitante
          showEncargado={false}
          showGrupo={false} 
          columnasFijas={{ folio: true, materiales: true, fecha: false, estado: true, acciones: true }}
          usuario={usuario}
          onAccion={actualizarEstado}
          onPDF={descargarPDF}
          procesandoId={procesando}
        />
      )}

     {/* DOCENTE */}
{usuario?.rol === 'docente' && (
  <>
  <div className="flex items-center gap-2 mb-4">
        <span>🐺</span>
        <h2 className="text-xl font-bold">Solicitudes de préstamo</h2>
      </div>
    <div className="flex flex-wrap items-center gap-4">
  <div className="relative flex rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 w-full sm:w-auto gap-2">
    <div className="relative flex-1">
      {pendientesDocAlumnos > 0 && (
        <span className="absolute -top-3 -right-3 bg-gradient-to-r from-red-500 to-red-600 text-white text-xs rounded-full px-2 py-1 shadow-lg animate-bounce z-20">
          {pendientesDocAlumnos}
        </span>
      )}
      <button
        className={`w-full px-4 py-2 transition-all duration-200 font-medium min-h-[40px] flex items-center justify-center text-sm ${
          activeTab === 'alumnos'
            ? 'bg-gradient-to-r from-[#003579] to-[#0056b3] text-white shadow-lg transform scale-105'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
         } hover:shadow-inner rounded-lg`}
        onClick={() => setActiveTab('alumnos')}
      >
        <div className="flex items-center gap-2 justify-center">
          <span>🎓</span>
          <span className="whitespace-nowrap">Solicitudes de Alumnos</span>
        </div>
      </button>
    </div>
    <div className="relative flex-1">
      <button
        className={`w-full px-4 py-2 transition-all duration-200 font-medium min-h-[40px] flex items-center justify-center text-sm ${
          activeTab === 'mias' 
            ? 'bg-gradient-to-r from-[#003579] to-[#0056b3] text-white shadow-lg transform scale-105' 
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        } hover:shadow-inner rounded-lg`}
        onClick={() => setActiveTab('mias')}
      >
        <div className="flex items-center gap-2 justify-center">
          <span>👨‍🏫</span>
          <span className="whitespace-nowrap">Mis Solicitudes</span>
        </div>
      </button>
    </div>
  </div>
        <div className="relative flex-1 w-full sm:w-auto">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <span className="text-gray-400 animate-pulse">🔍</span>
        </div>
        <input
          type="text"
          placeholder={activeTab === 'alumnos' ? 'Buscar por nombre, folio o grupo...' : 'Buscar por nombre o folio...'}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white hover:shadow-md"
        />
      </div>
        </div>
    
    {activeTab === 'alumnos' ? (
      <TablaSolicitudes
        titulo="Solicitudes de alumnos para aprobar"
        data={filteredDocAprobar}
        loading={loading}
        showSolicitante
        showEncargado={false}
        showGrupo
        columnasFijas={{ folio: true, materiales: true, fecha: true, estado: true, acciones: true }}
        usuario={usuario}
        onAccion={actualizarEstado}
        onPDF={descargarPDF}
        procesandoId={procesando}
      />
    ) : (
      <TablaSolicitudes
        titulo="Mis solicitudes como docente"
        data={filteredDocMias}
        loading={loading}
        showSolicitante={false}
        showEncargado={false}
        showGrupo={false}
        columnasFijas={{ folio: true, materiales: true, fecha: false, estado: true, acciones: true }}
        usuario={usuario}
        onAccion={actualizarEstado}
        onPDF={descargarPDF}
        procesandoId={procesando}
      />
    )}
  </>
)}

      {/* ALMACÉN */}
      {usuario?.rol === 'almacen' && (
        <>
           <div className="flex items-center gap-2 mb-4">
        <span>🐺</span>
        <h2 className="text-xl font-bold">Solicitudes de préstamo</h2>
      </div>
         <div className="flex flex-wrap items-center gap-4">
  <div className="relative flex rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 w-full sm:w-auto gap-2">
   <div className="relative flex-1">
    {pendientesAlmAlumnos > 0 && (
      <span className="absolute -top-3 -right-3 bg-gradient-to-r from-red-500 to-red-600 text-white text-xs rounded-full px-2 py-1 shadow-lg animate-bounce z-20">
        {pendientesAlmAlumnos}
      </span>
    )}
    <button
      className={`w-full px-4 py-2 transition-all duration-200 font-medium min-h-[40px] flex items-center justify-center text-sm ${
        activeTab === 'alumnos' 
          ? 'bg-gradient-to-r from-[#003579] to-[#0056b3] text-white shadow-lg transform scale-105' 
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      } hover:shadow-inner rounded-lg`}
      onClick={() => setActiveTab('alumnos')}
    >
      <div className="flex items-center gap-2 justify-center">
        <span>🎓</span>
        <span className="whitespace-nowrap">Solicitudes de Alumnos</span>
      </div>
    </button>
  </div>

    <div className="relative flex-1">
      {pendientesAlmDocentes > 0 && (
        <span className="absolute -top-3 -right-3 bg-gradient-to-r from-red-500 to-red-600 text-white text-xs rounded-full px-2 py-1 shadow-lg animate-bounce z-20">
          {pendientesAlmDocentes}
        </span>
      )}
      <button
        className={`w-full px-4 py-2 transition-all duration-200 font-medium min-h-[40px] flex items-center justify-center text-sm ${
          activeTab === 'docentes' 
            ? 'bg-gradient-to-r from-[#003579] to-[#0056b3] text-white shadow-lg transform scale-105' 
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        } hover:shadow-inner rounded-lg`}
        onClick={() => setActiveTab('docentes')}
      >
        <div className="flex items-center gap-2 justify-center">
          <span>👨‍🏫</span>
          <span className="whitespace-nowrap">Solicitudes de Docentes</span>
        </div>
      </button>
    </div>
  </div>
                <div className="relative flex-1 w-full sm:w-auto">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <span className="text-gray-400 animate-pulse">🔍</span>
        </div>
        <input
          type="text"
          placeholder={activeTab === 'alumnos' ? 'Buscar por nombre, folio o grupo...' : 'Buscar por nombre o folio...'}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white hover:shadow-md"
        />
      </div>

            <div className="flex flex-wrap items-center gap-3 bg-gray-50 rounded-lg p-3 hover:shadow-md transition-shadow duration-200 w-full sm:w-auto">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <span>📅</span>
                Filtrar por fecha:
              </label>
              <input
                type="date"
                value={filterDate}
                min={minFilterDate}
                max={maxFilterDate}
                onChange={e => {
                  const v = e.target.value;
                  if (!v) { setFilterDate(''); return; }
                  const d = new Date(v);
                  const day = d.getDay();
                  if (day === 0 || day === 6) return; // evitar fines de semana
                  if (v >= minFilterDate && v <= maxFilterDate) {
                    setFilterDate(v);
                  }
                }}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all duration-200 hover:shadow-sm flex-1"
              />
              {filterDate && (
                <button
                  onClick={() => setFilterDate('')}
                  className="text-sm text-blue-600 hover:text-blue-800 hover:underline transition-colors duration-200 flex items-center gap-1"
                >
                  <span>✖️</span>
                  Limpiar
                </button>
              )}
            </div>
            
       
           {notice && (
            <div className="w-full sm:ml-auto">
              <div className="px-4 py-2 text-sm bg-gradient-to-r from-yellow-100 to-amber-100 border border-yellow-200 text-yellow-800 rounded-xl shadow-sm animate-pulse hover:shadow-md transition-shadow duration-200 flex items-center gap-2">
                <span>🔔</span>
                {notice}
              </div>
            </div>
          )}
          </div>

          {activeTab === 'alumnos' ? (
            <TablaSolicitudes
              titulo="Solicitudes de alumnos"
              data={searchedAlmAlumnos}
              loading={loading}
              showSolicitante
              showEncargado
              showGrupo
              columnasFijas={{ folio: true, materiales: true, fecha: true, estado: true, acciones: true }}
              usuario={usuario}
              onAccion={actualizarEstado}
              onEntregar={abrirEntrega}
              onPDF={descargarPDF}
              procesandoId={procesando}
            />
          ) : (
            <TablaSolicitudes
              titulo="Solicitudes de docentes"
              data={searchedAlmDocentes}
              loading={loading}
              showSolicitante
              showEncargado={false}
              showGrupo={false}
              columnasFijas={{ folio: true, materiales: true, fecha: true, estado: true, acciones: true }}
              usuario={usuario}
              onAccion={actualizarEstado}
              onEntregar={abrirEntrega}
              onPDF={descargarPDF}
              procesandoId={procesando}
            />
          )}
        </>
      )}

      {/* Modal de entrega con mejor styling */}
      {modalEntrega && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn overflow-y-auto">
          <div className="bg-white p-4 sm:p-8 rounded-2xl shadow-2xl max-w-md w-full mx-4 my-8 sm:my-0 transform animate-slideUp border border-gray-200 hover:shadow-3xl transition-shadow duration-300">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-2xl animate-spin-slow">🚚</span>
              <h3 className="text-xl font-bold text-gray-800">Entregar materiales</h3>
            </div>
            
            <div className="space-y-3 mb-6 max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-blue-500 scrollbar-track-gray-200">
              {modalEntrega.items.map(item => (
                <label key={item.item_id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-200 cursor-pointer shadow-sm hover:shadow-md">
                  <input
                    type="checkbox"
                    checked={selectedItems.includes(item.item_id)}
                    onChange={() => toggleItem(item.item_id)}
                    className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 hover:scale-110 transition-transform duration-200"
                  />
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-2 py-1 rounded-full text-xs font-medium shadow-sm hover:shadow-md transition-shadow duration-200">
                        {item.cantidad} {getUnidad(item.tipo)}
                      </span>
                      <span className="font-medium text-gray-800 hover:text-blue-600 transition-colors duration-200">{item.nombre_material}</span>
                    </div>
                  </div>
                </label>
              ))}
            </div>
            
            <div className="flex justify-between mb-6">
              <button 
                onClick={seleccionarTodos} 
                className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors duration-200 flex items-center gap-1 hover:underline"
              >
                <span>✅</span>
                Seleccionar todo
              </button>
              <span className="text-sm text-gray-500 hover:text-gray-700 transition-colors duration-200">
                {selectedItems.length} de {modalEntrega.items.length} seleccionados
              </span>
            </div>
            
            <div className="flex justify-end gap-3 flex-wrap">
              <button 
                onClick={() => setModalEntrega(null)} 
                className="px-6 py-3 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all duration-200 font-medium shadow-sm hover:shadow-md"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmarEntrega} 
                disabled={selectedItems.length === 0}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 font-medium shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 hover:scale-105 transform"
              >
                <span>🚚</span>
                Entregar ({selectedItems.length})
              </button>
            </div>
          </div>
        </div>
      )}
      
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideUp {
          from { 
            opacity: 0; 
            transform: translateY(20px); 
          }
          to { 
            opacity: 1; 
            transform: translateY(0); 
          }
        }
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        
        @keyframes shimmer {
          0% { background-position: -200px 0; }
          100% { background-position: calc(200px + 100%) 0; }
        }

        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
        
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
        
        .animate-shimmer {
          background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
          background-size: 200px 100%;
          animation: shimmer 1.5s infinite;
        }

        .animate-spin-slow {
          animation: spin-slow 10s linear infinite;
        }

        .scrollbar-thin {
          scrollbar-width: thin;
        }
      `}</style>
    </div>
  );
}
