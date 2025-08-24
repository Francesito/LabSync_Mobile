'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import axios from 'axios';

export default function Chat() {
  const { usuario } = useAuth();
  const [contactos, setContactos] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [nuevoMensaje, setNuevoMensaje] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMensajes, setLoadingMensajes] = useState(false);
  const [enviandoMensaje, setEnviandoMensaje] = useState(false);
  const [permisos, setPermisos] = useState(null);
  const [loadingPermisos, setLoadingPermisos] = useState(true);
  const router = useRouter();
  const chatContainerRef = useRef(null);

  const BASE = `${process.env.NEXT_PUBLIC_API_URL}/api`;

  // Verificar permisos de chat al cargar el componente
  useEffect(() => {
    if (!usuario) {
      return;
    }

    verificarPermisosChat();
  }, [usuario, router]);

  // Cargar contactos solo si tiene permisos
  useEffect(() => {
    if (!usuario || !permisos) {
      return;
    }

    // Verificar permisos básicos
    if (!permisos.acceso_chat) {
      let mensajeError = 'No tienes acceso al chat';
      
      if (permisos.rol === 'docente') {
        mensajeError = 'Los docentes no tienen acceso al chat';
      } else if (permisos.rol === 'almacen') {
        mensajeError = 'No tienes permisos de chat habilitados. Contacta al administrador.';
      }
      
      setError(mensajeError);
      return;
    }

    cargarContactos();
  }, [usuario, permisos, router]);

  async function verificarPermisosChat() {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Token de autenticación no encontrado');
      router.push('/login');
      return;
    }

    try {
      setLoadingPermisos(true);
      setError('');

      const { data } = await axios.get(
        `${BASE}/auth/permisos-chat`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      setPermisos(data);
    } catch (err) {
      console.error('[Chat] verificarPermisosChat:', err);
      if (err.response?.status === 401) {
        setError('Sesión expirada. Inicia sesión nuevamente');
        localStorage.removeItem('token');
        router.push('/login');
      } else if (err.response?.status === 403) {
        setError('No tienes permisos para acceder al chat');
      } else {
        setError(err.response?.data?.error || 'Error al verificar permisos');
      }
    } finally {
      setLoadingPermisos(false);
    }
  }

  async function cargarContactos() {
    if (!permisos || !permisos.acceso_chat) {
      setError('No tienes permiso para cargar los contactos');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      setError('Token de autenticación no encontrado');
      router.push('/login');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const { data } = await axios.get(
        `${BASE}/messages/users`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Obtener último mensaje para cada contacto
      const contactosConUltimoMensaje = await Promise.all(
        data.map(async (contacto) => {
          try {
            const { data: mensajesContacto } = await axios.get(
              `${BASE}/messages/${contacto.id}`,
              {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              }
            );

            const ultimoMensaje = mensajesContacto[mensajesContacto.length - 1];
            return {
              ...contacto,
              ultimoMensaje: ultimoMensaje || null
            };
          } catch (error) {
            return {
              ...contacto,
              ultimoMensaje: null
            };
          }
        })
      );

      // Ordenar por último mensaje más reciente
      contactosConUltimoMensaje.sort((a, b) => {
        if (!a.ultimoMensaje && !b.ultimoMensaje) return 0;
        if (!a.ultimoMensaje) return 1;
        if (!b.ultimoMensaje) return -1;
        return new Date(b.ultimoMensaje.fecha_envio) - new Date(a.ultimoMensaje.fecha_envio);
      });

      setContactos(contactosConUltimoMensaje);

      if (contactosConUltimoMensaje.length === 0 && permisos.rol === 'almacen') {
        setError('No hay alumnos que hayan iniciado conversación contigo aún');
      }
    } catch (err) {
      console.error('[Chat] cargarContactos:', err);
      if (err.response?.status === 401) {
        setError('Sesión expirada. Inicia sesión nuevamente');
        localStorage.removeItem('token');
        router.push('/login');
      } else if (err.response?.status === 403) {
        setError('No tienes permisos para ver los contactos');
      } else {
        setError(err.response?.data?.error || 'Error al cargar contactos');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (selectedUser && permisos && permisos.acceso_chat) {
      cargarMensajes();
    }
  }, [selectedUser, permisos]);

  async function cargarMensajes() {
    if (!permisos || !permisos.acceso_chat) {
      setError('No tienes permiso para cargar los mensajes');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      setError('Token de autenticación no encontrado');
      router.push('/login');
      return;
    }

    try {
      setLoadingMensajes(true);
      setError('');

      const { data } = await axios.get(
        `${BASE}/messages/${selectedUser.id}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      setMensajes(data);
    } catch (err) {
      console.error('[Chat] cargarMensajes:', err);
      if (err.response?.status === 401) {
        setError('Sesión expirada. Inicia sesión nuevamente');
        localStorage.removeItem('token');
        router.push('/login');
      } else if (err.response?.status === 403) {
        setError('No tienes permisos para ver mensajes con este usuario');
      } else {
        setError(err.response?.data?.error || 'Error al cargar mensajes');
      }
    } finally {
      setLoadingMensajes(false);
    }
  }

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [mensajes]);

  async function handleEnviarMensaje() {
    if (!permisos || !permisos.acceso_chat) {
      setError('No tienes permiso para enviar mensajes');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      setError('Token de autenticación no encontrado');
      router.push('/login');
      return;
    }

    if (!nuevoMensaje.trim()) {
      setError('Escribe un mensaje antes de enviar');
      return;
    }

    if (!selectedUser) {
      setError('Selecciona un usuario para enviar el mensaje');
      return;
    }

    try {
      setError('');
      setEnviandoMensaje(true);

      const { data } = await axios.post(
        `${BASE}/messages/send`,
        {
          contenido: nuevoMensaje.trim(),
          receptor_id: selectedUser.id
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Agregar el mensaje a la lista local
      setMensajes(prevMensajes => [...prevMensajes, data]);
      setNuevoMensaje('');

      // Actualizar el último mensaje en la lista de contactos sin recargar todo
      setContactos(prevContactos => {
        const contactosActualizados = prevContactos.map(contacto => {
          if (contacto.id === selectedUser.id) {
            return {
              ...contacto,
              ultimoMensaje: data
            };
          }
          return contacto;
        });

        // Reordenar para poner el contacto actualizado al principio
        return contactosActualizados.sort((a, b) => {
          if (!a.ultimoMensaje && !b.ultimoMensaje) return 0;
          if (!a.ultimoMensaje) return 1;
          if (!b.ultimoMensaje) return -1;
          return new Date(b.ultimoMensaje.fecha_envio) - new Date(a.ultimoMensaje.fecha_envio);
        });
      });
    } catch (err) {
      console.error('[Chat] handleEnviarMensaje:', err);
      if (err.response?.status === 401) {
        setError('Sesión expirada. Inicia sesión nuevamente');
        localStorage.removeItem('token');
        router.push('/login');
      } else if (err.response?.status === 403) {
        setError('No tienes permisos para enviar mensajes a este usuario');
      } else {
        setError(err.response?.data?.error || 'Error al enviar mensaje');
      }
    } finally {
      setEnviandoMensaje(false);
    }
  }

  function handleKeyPress(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEnviarMensaje();
    }
  }

  function formatearFecha(fecha) {
    const ahora = new Date();
    const fechaMensaje = new Date(fecha);
    const diferencia = ahora - fechaMensaje;
    const diasDiferencia = Math.floor(diferencia / (1000 * 60 * 60 * 24));

    if (diasDiferencia === 0) {
      return fechaMensaje.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      });
    } else if (diasDiferencia === 1) {
      return 'Ayer';
    } else if (diasDiferencia < 7) {
      return fechaMensaje.toLocaleDateString('es-ES', { weekday: 'short' });
    } else {
      return fechaMensaje.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit'
      });
    }
  }

  function formatearHoraMensaje(fecha) {
    return new Date(fecha).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function truncarMensaje(mensaje, maxLength = 40) {
    if (!mensaje) return '';
    return mensaje.length > maxLength ? mensaje.substring(0, maxLength) + '...' : mensaje;
  }

  // Loading inicial mientras se verifican permisos
  if (!usuario || loadingPermisos) {
    return (
      <div className="bg-gray-100 min-h-screen">
        <div className="flex items-center justify-center h-screen">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
            <p className="text-gray-600">
              {!usuario ? 'Verificando autenticación...' : 'Verificando permisos de chat...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Mostrar mensaje de acceso denegado si no tiene permisos
  if (!permisos || !permisos.acceso_chat) {
    return (
      <div className="bg-gray-100 min-h-screen">
        <div className="flex items-center justify-center h-screen">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center max-w-md">
            <svg className="w-16 h-16 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Acceso Denegado</h3>
            <p className="text-gray-600 mb-4">
              {error || 'No tienes permisos para acceder al chat'}
            </p>
            {permisos && permisos.rol === 'almacen' && (
              <p className="text-sm text-gray-500">
                Contacta al administrador para solicitar permisos de chat.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
  <div className="bg-gray-100 min-h-screen">
      <div className="flex h-screen bg-gray-100">
        {/* Panel de contactos - Estilo WhatsApp */}
        <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col">
          {/* Header del panel de contactos */}
          <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold text-xs">
                    {usuario?.nombre?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900 text-base">Chats</h2>
                  <p className="text-xs text-gray-500">
                    {permisos?.rol === 'alumno' ? 'Almacenistas' : 'Alumnos'}
                  </p>
                </div>
              </div>
              <button
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                onClick={cargarContactos}
                disabled={loading || !permisos || !permisos.acceso_chat}
              >
                <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>

          {/* Lista de contactos */}
          <div className="flex-1 overflow-y-auto">
            {error && (
              <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              </div>
            )}

            {loading ? (
              <div className="p-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-3 p-3 mb-2 animate-pulse">
                    <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-100 rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : contactos.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 px-4">
                <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-center">
                  {permisos?.rol === 'alumno'
                    ? 'No hay almacenistas disponibles'
                    : 'No hay conversaciones iniciadas aún'
                  }
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {contactos.map((contacto) => (
                  <div
                    key={contacto.id}
                    className={`flex items-center p-2.5 hover:bg-gray-50 cursor-pointer transition-colors ${
                      selectedUser?.id === contacto.id ? 'bg-green-50 border-r-4 border-green-500' : ''
                    }`}
                    onClick={() => {
                      if (!permisos || !permisos.acceso_chat) {
                        setError('No tienes permiso para seleccionar un contacto');
                        return;
                      }
                      setSelectedUser(contacto);
                    }}
                  >
                    <div className="relative">
                      <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-semibold text-sm">
                          {contacto.nombre.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      {contacto.rol === 'almacen' && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                      )}
                    </div>

                    <div className="ml-3 flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900 truncate text-sm">
                          {contacto.nombre}
                        </h3>
                        {contacto.ultimoMensaje && (
                          <span className="text-xs text-gray-500 ml-2">
                            {formatearFecha(contacto.ultimoMensaje.fecha_envio)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between mt-0.5">
                        <p className="text-xs text-gray-600 truncate">
                          {contacto.ultimoMensaje ? (
                            truncarMensaje(contacto.ultimoMensaje.contenido)
                          ) : (
                            <span className="text-gray-400 italic">Sin mensajes</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Panel de chat */}
        <div className="flex-1 flex flex-col bg-white">
          {selectedUser ? (
            <>
              {/* Header del chat */}
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex-shrink-0">
                <div className="flex items-center">
                  <div className="w-9 h-9 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center mr-3">
                    <span className="text-white font-semibold text-sm">
                      {selectedUser.nombre.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">{selectedUser.nombre}</h3>
                    <p className="text-xs text-gray-500 capitalize">{selectedUser.rol}</p>
                  </div>
                </div>
              </div>

              {/* Área de mensajes */}
              <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto p-3 bg-gray-50"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23f0f0f0' fill-opacity='0.3'%3E%3Cpath d='M20 20c0-11.046-8.954-20-20-20s-20 8.954-20 20 8.954 20 20 20 20-8.954 20-20zm-30 0c0-5.523 4.477-10 10-10s10 4.477 10 10-4.477 10-10 10-10-4.477-10-10z'/%3E%3C/g%3E%3C/svg%3E")`
                }}
              >
                {loadingMensajes ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="bg-white rounded-lg shadow-md p-6 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-3"></div>
                      <p className="text-gray-600">Cargando conversación...</p>
                    </div>
                  </div>
                ) : mensajes.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="bg-white rounded-lg shadow-md p-8 text-center max-w-md">
                      <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Inicia la conversación</h3>
                      <p className="text-gray-600">Envía un mensaje para comenzar a chatear.</p>
                      <p className="text-sm text-gray-500 mt-2">Los mensajes se eliminan automáticamente después de 7 días</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {mensajes.map((mensaje, index) => {
                      const esMio = mensaje.emisor_id === usuario?.id;
                      const mostrarFecha = index === 0 ||
                        new Date(mensajes[index - 1].fecha_envio).toDateString() !== new Date(mensaje.fecha_envio).toDateString();

                      return (
                        <div key={mensaje.id}>
                          {mostrarFecha && (
                            <div className="flex justify-center my-3">
                              <span className="bg-white px-2.5 py-1 rounded-full text-xs text-gray-500 shadow-sm">
                                {new Date(mensaje.fecha_envio).toLocaleDateString('es-ES', {
                                  weekday: 'long',
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })}
                              </span>
                            </div>
                          )}

                          <div className={`flex ${esMio ? 'justify-end' : 'justify-start'}`}>
                            <div
                              className={`max-w-xs lg:max-w-md px-3 py-2 rounded-lg shadow-sm ${
                                esMio
                                  ? 'bg-green-500 text-white rounded-br-none'
                                  : 'bg-white text-gray-900 rounded-bl-none border'
                              }`}
                            >
                              <p className="text-sm leading-relaxed">{mensaje.contenido}</p>
                              <div className={`flex items-center justify-end mt-1 ${
                                esMio ? 'text-green-100' : 'text-gray-500'
                              }`}>
                                <span className="text-xs">
                                  {formatearHoraMensaje(mensaje.fecha_envio)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {enviandoMensaje && (
                      <div className="flex justify-end">
                        <div className="max-w-xs lg:max-w-md px-3 py-2 rounded-lg rounded-br-none bg-green-500 text-white shadow-sm opacity-70">
                          <p className="text-sm">{nuevoMensaje}</p>
                          <div className="flex items-center justify-end mt-1">
                            <div className="animate-spin rounded-full h-3 w-3 border-b border-white"></div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Input de mensaje */}
              <div className="bg-white border-t border-gray-200 p-4 flex-shrink-0">
                <div className="flex items-end space-x-3">
                  <div className="flex-1 relative">
                    <textarea
                      rows={1}
                      className="w-full px-4 py-3 border border-gray-300 rounded-full resize-none focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-gray-50 text-gray-900 placeholder-gray-500 text-sm"
                      placeholder="Escribe un mensaje..."
                      value={nuevoMensaje}
                      onChange={(e) => {
                        if (!permisos || !permisos.acceso_chat) {
                          setError('No tienes permiso para escribir mensajes');
                          return;
                        }
                        setNuevoMensaje(e.target.value);
                        // Auto-resize textarea
                        e.target.style.height = 'inherit';
                        e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                      }}
                      onKeyPress={handleKeyPress}
                      disabled={loadingMensajes || enviandoMensaje || !permisos || !permisos.acceso_chat}
                      style={{ minHeight: '48px', maxHeight: '120px' }}
                    />
                  </div>
                  <button
                    className={`p-3 rounded-full transition-all duration-200 flex-shrink-0 ${
                      nuevoMensaje.trim() && !enviandoMensaje && permisos && permisos.acceso_chat
                        ? 'bg-green-500 hover:bg-green-600 text-white shadow-lg hover:shadow-xl'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                    onClick={handleEnviarMensaje}
                    disabled={!nuevoMensaje.trim() || loadingMensajes || enviandoMensaje || !permisos || !permisos.acceso_chat}
                  >
                    {enviandoMensaje ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full bg-gray-50">
              <div className="text-center">
                <svg className="w-24 h-24 text-gray-300 mx-auto mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <h3 className="text-2xl font-semibold text-gray-900 mb-2">Bienvenido al Chat</h3>
                <p className="text-gray-600 mb-4">
                  {contactos.length === 0
                    ? 'No hay contactos disponibles'
                    : 'Selecciona un contacto para comenzar a chatear'
                  }
                </p>
                <p className="text-sm text-gray-500">
                  {permisos?.rol === 'alumno'
                    ? 'Puedes chatear con cualquier almacenista'
                    : 'Solo puedes ver alumnos que te hayan escrito'
                  }
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
