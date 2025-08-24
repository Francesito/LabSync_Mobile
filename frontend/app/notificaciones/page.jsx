'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';

export default function Notificaciones() {
  const [notificaciones, setNotificaciones] = useState([]);
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  useEffect(() => {
    if (!token) return;
    const cargar = async () => {
      try {
        const { data } = await axios.get(
        `${baseUrl}/api/notificaciones`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setNotificaciones(data);
        
        if (data.some(n => !n.leida)) {
          await axios.put(
            `${baseUrl}/api/notificaciones/marcar-leidas`,
            {},
            { headers: { Authorization: `Bearer ${token}` } }
          );
           setNotificaciones(prev => prev.map(n => ({ ...n, leida: 1 })));
        }
      } catch (err) {
        console.error('Error al cargar notificaciones:', err);
      }
    };
    cargar();
    }, [token]);

  const eliminar = async (id) => {
    try {
      await axios.delete(`${baseUrl}/api/notificaciones/${id}`, {
     headers: { Authorization: `Bearer ${token}` }
      });
      setNotificaciones(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.error('Error al eliminar notificación:', err);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <div className="text-center">
            <div className="mb-8">
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mb-6 shadow-lg">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <h1 className="text-4xl font-bold text-slate-800 mb-4">Notificaciones</h1>
              <p className="text-slate-600 text-lg">Debes iniciar sesión para ver tus notificaciones.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const unread = notificaciones.filter(n => !n.leida);
  const read = notificaciones.filter(n => n.leida);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="w-20 h-20 mx-auto bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mb-6 shadow-lg">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-slate-800 mb-2">Notificaciones</h1>
          <p className="text-slate-600">
            {notificaciones.length === 0 
              ? "No tienes notificaciones" 
              : `${notificaciones.length} ${notificaciones.length === 1 ? 'notificación' : 'notificaciones'}`
            }
          </p>
        </div>

        {notificaciones.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 mx-auto bg-slate-200 rounded-full flex items-center justify-center mb-6">
              <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-slate-700 mb-2">¡Todo al día!</h3>
            <p className="text-slate-500">No tienes notificaciones pendientes.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Notificaciones No Leídas */}
            {unread.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full animate-pulse"></div>
                  <h2 className="text-xl font-bold text-slate-800">
                    Nuevas ({unread.length})
                  </h2>
                </div>
                <div className="space-y-4">
                  {unread.map(n => (
                    <div
                      key={n.id}
                      className="group bg-white/80 backdrop-blur-sm border border-emerald-200 rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all duration-300 hover:scale-[1.02] hover:border-emerald-300"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex gap-4 flex-1">
                          <div className="flex-shrink-0">
                            <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-emerald-500 rounded-full flex items-center justify-center shadow-lg">
                              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                              </svg>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-slate-800 font-medium leading-relaxed mb-3">
                              {n.mensaje}
                            </p>
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {new Date(n.fecha).toLocaleString('es-ES', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => eliminar(n.id)}
                          className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all duration-200 flex items-center justify-center group-hover:scale-110"
                          title="Eliminar notificación"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notificaciones Leídas */}
            {read.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-slate-400 rounded-full"></div>
                  <h2 className="text-xl font-bold text-slate-800">
                    Anteriores ({read.length})
                  </h2>
                </div>
                <div className="space-y-4">
                  {read.map(n => (
                    <div
                      key={n.id}
                      className="group bg-white/60 backdrop-blur-sm border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300 hover:scale-[1.01] hover:border-slate-300"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex gap-4 flex-1">
                          <div className="flex-shrink-0">
                            <div className="w-12 h-12 bg-gradient-to-br from-slate-400 to-slate-500 rounded-full flex items-center justify-center shadow-md">
                              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-slate-700 font-medium leading-relaxed mb-3 opacity-80">
                              {n.mensaje}
                            </p>
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {new Date(n.fecha).toLocaleString('es-ES', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => eliminar(n.id)}
                          className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all duration-200 flex items-center justify-center group-hover:scale-110"
                          title="Eliminar notificación"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
