'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import { obtenerAdeudos, obtenerAdeudosConFechaEntrega } from '../../lib/api';

// Iconos SVG mejorados
const FileTextIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const PackageIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
);

const HashIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
  </svg>
);

const AlertTriangleIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.664-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg className="w-20 h-20 mx-auto text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const CalendarIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const ClockIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const LoadingSpinner = () => (
  <div className="flex items-center justify-center p-16">
    <div className="relative">
      <div className="w-16 h-16 border-4 border-slate-200 rounded-full animate-spin"></div>
      <div className="absolute top-0 left-0 w-16 h-16 border-4 border-transparent border-t-blue-600 rounded-full animate-spin"></div>
    </div>
  </div>
);

/* ===========================
   Normalización mínima
   (mapea exactamente lo que
   devuelve el backend)
   =========================== */
function normalizarAdeudo(a) {
  // cubrir posibles nombres según cómo lo envíe el backend
  const rawNombre =
    a.nombre_material ??
    a.nombreMaterial ??
    a.material_nombre ??
    a.materialNombre ??
    a.nombre ??
    '';

  const nombrePlano = String(rawNombre || '').trim().replace(/_/g, ' ');

  return {
    solicitud_id: a.solicitud_id,
    solicitud_item_id: a.solicitud_item_id,
    material_id: a.material_id,
    tipo: a.tipo,
    folio: a.folio || '—',
    nombre_material: nombrePlano || '(Sin nombre)',
    cantidad: a.cantidad ?? a.cantidad_pendiente ?? 0,
    unidad: a.unidad || 'u',
    fecha_devolucion: a.fecha_devolucion || a.fecha_entrega || null,
  };
}

const parseDate = (str) => {
  if (!str) return null;
  // normalizar a YYYY-MM-DD para evitar desfase por zona horaria
  const [y, m, d] = str.split('T')[0].split('-');
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return isNaN(date) ? null : date;
};

const formatDate = (str) => {
  const date = parseDate(str);
  if (!date) return 'Sin fecha';
  
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(date);
};

const getDaysUntilDue = (dateString) => {
  const dueDate = parseDate(dateString);
  if (!dueDate) return null;
  
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dueDateStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  
  const diffTime = dueDateStart - todayStart;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
};

export default function Adeudos() {
  const { usuario } = useAuth();
  const [adeudos, setAdeudos] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (usuario === null) return;

    if (!usuario) {
      router.push('/login');
      return;
    }

    if (!['alumno', 'docente'].includes(usuario.rol)) {
      setError('Acceso denegado');
      setLoading(false);
      return;
    }

    const loadAdeudos = async () => {
      try {
        setLoading(true);

        // Primero intenta con fecha_devolucion; si no existe el endpoint, usa el básico
        let data;
        try {
          data = await obtenerAdeudosConFechaEntrega();
        } catch {
          data = await obtenerAdeudos();
        }

        const lista = Array.isArray(data) ? data.map(normalizarAdeudo) : [];
        setAdeudos(lista);
        setError('');
      } catch (err) {
        console.error('Error al cargar adeudos:', err);
        setError('No se pudo cargar adeudos');
      } finally {
        setLoading(false);
      }
    };

    loadAdeudos();
  }, [usuario, router]);

  const isOverdue = (dateString) => {
    const daysUntil = getDaysUntilDue(dateString);
    return daysUntil !== null && daysUntil < 0;
  };

  const isNearDue = (dateString) => {
    const daysUntil = getDaysUntilDue(dateString);
    return daysUntil !== null && daysUntil >= 0 && daysUntil <= 3;
  };

  const getStatusBadge = (dateString) => {
    const daysUntil = getDaysUntilDue(dateString);
    
    if (daysUntil === null) {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
          <ClockIcon />
          <span className="ml-1">Sin fecha</span>
        </span>
      );
    }
    
    if (daysUntil < 0) {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
          <ClockIcon />
          <span className="ml-1">Vencido ({Math.abs(daysUntil)} días)</span>
        </span>
      );
    }
    
    if (daysUntil === 0) {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
          <ClockIcon />
          <span className="ml-1">Vence hoy</span>
        </span>
      );
    }
    
    if (daysUntil <= 3) {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
          <ClockIcon />
          <span className="ml-1">Vence en {daysUntil} días</span>
        </span>
      );
    }
    
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
        <ClockIcon />
        <span className="ml-1">{daysUntil} días restantes</span>
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="container mx-auto px-4 py-8">
          <div className="bg-white/70 backdrop-blur-sm rounded-3xl shadow-lg border border-white/20">
            <LoadingSpinner />
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header moderno */}
        <div className="mb-12 text-center">
          
          <h1 className="text-5xl font-black text-gray-900 mb-4 bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
            Adeudos Pendientes
          </h1>
          
          <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Mantén el control total de todos tus materiales pendientes de entrega con nuestra interfaz moderna y intuitiva
          </p>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-red-200 p-8 mb-8">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangleIcon />
              </div>
            </div>
            <div className="text-center">
              <h3 className="text-xl font-semibold text-red-800 mb-2">Error al cargar datos</h3>
              <p className="text-red-600">{error}</p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!error && adeudos.length === 0 && (
          <div className="bg-white/70 backdrop-blur-sm rounded-3xl shadow-lg border border-white/20 p-16 text-center">
            <CheckCircleIcon />
            <h3 className="text-3xl font-bold text-gray-900 mb-4 mt-6">
              ¡Bien Hecho!
            </h3>
            <p className="text-xl text-gray-600 mb-8 max-w-md mx-auto">
              No tienes adeudos pendientes en este momento. Mantén esta buena práctica.
            </p>
            <div className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-full font-medium shadow-lg">
              ✨ Todas las entregas al día
            </div>
          </div>
        )}

        {/* Tabla moderna de adeudos */}
        {!error && adeudos.length > 0 && (
          <div className="bg-white/70 backdrop-blur-sm rounded-3xl shadow-lg border border-white/20 overflow-hidden">
            {/* Header de la tabla */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-8 py-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <PackageIcon />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">
                      Materiales Pendientes
                    </h3>
                    <p className="text-slate-300">
                      {adeudos.length} {adeudos.length === 1 ? 'elemento' : 'elementos'} en total
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabla */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-8 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      <div className="flex items-center space-x-2">
                        <HashIcon />
                        <span>Folio</span>
                      </div>
                    </th>
                    <th className="px-8 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      <div className="flex items-center space-x-2">
                        <PackageIcon />
                        <span>Material</span>
                      </div>
                    </th>
                    <th className="px-8 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Cantidad
                    </th>
                    <th className="px-8 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      <div className="flex items-center justify-center space-x-2">
                        <CalendarIcon />
                        <span>Fecha de Entrega</span>
                      </div>
                    </th>
                    <th className="px-8 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white/50 divide-y divide-gray-200">
                  {adeudos.map((a, index) => (
                    <tr
                      key={`${a.solicitud_id}-${a.solicitud_item_id}-${index}`}
                      className={`hover:bg-white/70 transition-all duration-300 group ${
                        isOverdue(a.fecha_devolucion) ? 'bg-red-50/50' : ''
                      } ${
                        isNearDue(a.fecha_devolucion) && !isOverdue(a.fecha_devolucion) ? 'bg-orange-50/50' : ''
                      }`}
                    >
                      <td className="px-8 py-6 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mr-4 group-hover:bg-blue-200 transition-colors">
                            <FileTextIcon />
                          </div>
                          <div className="text-sm font-semibold text-gray-900">
                            {a.folio}
                          </div>
                        </div>
                      </td>

                      <td className="px-8 py-6">
                        <div className="text-base font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                          {a.nombre_material}
                        </div>
                      </td>

                      <td className="px-8 py-6 text-center">
                        <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold bg-blue-100 text-blue-800 group-hover:bg-blue-200 transition-colors">
                          {a.cantidad} {a.unidad}
                        </span>
                      </td>

                      <td className="px-8 py-6 text-center">
                        <div className="text-sm font-medium text-gray-900">
                          {formatDate(a.fecha_devolucion)}
                        </div>
                      </td>

                      <td className="px-8 py-6 text-center">
                        {getStatusBadge(a.fecha_devolucion)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer de la tabla */}
            <div className="bg-gray-50/50 px-8 py-4 border-t border-gray-200">
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>
                  Mostrando {adeudos.length} de {adeudos.length} elementos
                </span>
                <span>
                  Última actualización: {new Date().toLocaleTimeString()}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Estilos personalizados mejorados */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.8s ease-out;
        }

        .animate-slideIn {
          animation: slideIn 0.6s ease-out;
        }

        .animate-float {
          animation: float 3s ease-in-out infinite;
        }

        /* Efectos de glassmorphism */
        .backdrop-blur-sm {
          backdrop-filter: blur(8px);
        }

        /* Hover effects mejorados */
        .group:hover .transition-all {
          transform: translateY(-2px);
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
        }

        /* Gradientes de texto */
        .bg-clip-text {
          -webkit-background-clip: text;
          background-clip: text;
        }

        /* Animaciones suaves para elementos */
        * {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* Scrollbar personalizada */
        .overflow-x-auto::-webkit-scrollbar {
          height: 8px;
        }

        .overflow-x-auto::-webkit-scrollbar-track {
          background: rgba(156, 163, 175, 0.1);
          border-radius: 4px;
        }

        .overflow-x-auto::-webkit-scrollbar-thumb {
          background: rgba(156, 163, 175, 0.3);
          border-radius: 4px;
        }

        .overflow-x-auto::-webkit-scrollbar-thumb:hover {
          background: rgba(156, 163, 175, 0.5);
        }
      `}</style>
    </div>
  );
}
