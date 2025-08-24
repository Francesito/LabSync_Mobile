'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth';

export default function Configuracion() {
  const { usuario } = useAuth();
  const [usuariosAlmacen, setUsuariosAlmacen] = useState([]);
  const [todosUsuarios, setTodosUsuarios] = useState([]);
  const [estadisticas, setEstadisticas] = useState({ roles: [], permisos_almacen: {} });
  const [nuevoUsuario, setNuevoUsuario] = useState({
    nombre: '',
    correo_institucional: '',
    rol_id: ''
  });
  const [correoBloqueo, setCorreoBloqueo] = useState('');
  const [correoDesbloqueo, setCorreoDesbloqueo] = useState('');
  const [correoEliminacion, setCorreoEliminacion] = useState('');
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });
  const [vistaActiva, setVistaActiva] = useState('crear');
  const [searchTerm, setSearchTerm] = useState('');
  const [grupos, setGrupos] = useState([]);
  const [grupoSeleccionado, setGrupoSeleccionado] = useState('');
  const [searchGrupo, setSearchGrupo] = useState('');
  const [usuariosSeleccionados, setUsuariosSeleccionados] = useState([]);

  const roles = [
    { id: 2, nombre: 'docente' },
    { id: 3, nombre: 'almacen' },
    { id: 4, nombre: 'administrador' }
  ];

  // Verificar que el usuario es administrador
  if (!usuario || usuario.rol_id !== 4) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center bg-white p-8 rounded-2xl shadow-xl border border-gray-200">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-red-600 mb-4">Acceso Denegado</h2>
          <p className="text-gray-600">No tienes permisos para acceder a esta página.</p>
        </div>
      </div>
    );
  }

  // Generar contraseña aleatoria
  const generarContrasenaAleatoria = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let result = '';
    for (let i = 0; i < 12; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // Cargar usuarios de almacén
  const cargarUsuariosAlmacen = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        mostrarMensaje('error', 'Token no encontrado');
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/admin/usuarios-almacen`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setUsuariosAlmacen(data);
      } else {
        console.error('Error response:', response.status, response.statusText);
        mostrarMensaje('error', 'Error al cargar usuarios');
      }
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
      mostrarMensaje('error', 'Error de conexión al cargar usuarios');
    }
  };

  // Cargar todos los usuarios
  const cargarTodosUsuarios = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/admin/usuarios`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTodosUsuarios(data);
      }
    } catch (error) {
      console.error('Error al cargar todos los usuarios:', error);
    }
  };

   // Cargar grupos
  const cargarGrupos = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/grupos`);
      if (response.ok) {
        const data = await response.json();
        setGrupos(data);
      }
    } catch (error) {
      console.error('Error al cargar grupos:', error);
    }
  };
  
  // Cargar estadísticas
  const cargarEstadisticas = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/admin/estadisticas`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setEstadisticas(data);
      }
    } catch (error) {
      console.error('Error al cargar estadísticas:', error);
    }
  };

  // Agregar nuevo usuario
  const agregarUsuario = async (e) => {
    e.preventDefault();
    
    if (!nuevoUsuario.nombre || !nuevoUsuario.correo_institucional || !nuevoUsuario.rol_id) {
      mostrarMensaje('error', 'Todos los campos son obligatorios');
      return;
    }

    if (!nuevoUsuario.correo_institucional.endsWith('@utsjr.edu.mx')) {
      mostrarMensaje('error', 'El correo debe ser institucional (@utsjr.edu.mx)');
      return;
    }

    setLoading(true);
    try {
      const contrasenaAleatoria = generarContrasenaAleatoria();
      const token = localStorage.getItem('token');
      
      if (!token) {
        mostrarMensaje('error', 'Token no encontrado');
        setLoading(false);
        return;
      }
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/admin/crear-usuario`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...nuevoUsuario,
          contrasena: contrasenaAleatoria,
          rol_id: parseInt(nuevoUsuario.rol_id)
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        mostrarMensaje('success', 'Usuario creado exitosamente. Se ha enviado un enlace de restablecimiento de contraseña al correo.');
        setNuevoUsuario({ nombre: '', correo_institucional: '', rol_id: '' });
        cargarUsuariosAlmacen();
        cargarTodosUsuarios();
        cargarEstadisticas();
      } else {
        mostrarMensaje('error', data.error || 'Error al crear usuario');
      }
    } catch (error) {
      console.error('Error al crear usuario:', error);
      mostrarMensaje('error', 'Error de conexión al crear usuario: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Actualizar permisos de usuario
  const actualizarPermisos = async (usuarioId, campo, valor) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        mostrarMensaje('error', 'Token no encontrado');
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/admin/actualizar-permisos`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          usuario_id: usuarioId,
          campo,
          valor
        })
      });

      if (response.ok) {
        setUsuariosAlmacen(usuarios =>
          usuarios.map(user =>
            user.id === usuarioId ? { ...user, [campo]: valor } : user
          )
        );
        mostrarMensaje('success', 'Permisos actualizados correctamente');
      } else {
        const data = await response.json();
        mostrarMensaje('error', data.error || 'Error al actualizar permisos');
      }
    } catch (error) {
      console.error('Error al actualizar permisos:', error);
      mostrarMensaje('error', 'Error de conexión al actualizar permisos');
    }
  };

  // Bloquear usuario
  const bloquearUsuario = async (e) => {
    e.preventDefault();
    
    if (!correoBloqueo) {
      mostrarMensaje('error', 'Ingrese un correo electrónico');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        mostrarMensaje('error', 'Token no encontrado');
        setLoading(false);
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/admin/bloquear-usuario`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ correo_institucional: correoBloqueo })
      });

      const data = await response.json();
      
      if (response.ok) {
        mostrarMensaje('success', 'Usuario bloqueado exitosamente');
        setCorreoBloqueo('');
        cargarUsuariosAlmacen();
        cargarTodosUsuarios();
        cargarEstadisticas();
      } else {
        mostrarMensaje('error', data.error || 'Error al bloquear usuario');
      }
    } catch (error) {
      console.error('Error al bloquear usuario:', error);
      mostrarMensaje('error', 'Error de conexión al bloquear usuario');
    } finally {
      setLoading(false);
    }
  };

  // Desbloquear usuario
  const desbloquearUsuario = async (e) => {
    e.preventDefault();
    
    if (!correoDesbloqueo) {
      mostrarMensaje('error', 'Ingrese un correo electrónico');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        mostrarMensaje('error', 'Token no encontrado');
        setLoading(false);
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/admin/desbloquear-usuario`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ correo_institucional: correoDesbloqueo })
      });

      const data = await response.json();
      
      if (response.ok) {
        mostrarMensaje('success', 'Usuario desbloqueado exitosamente');
        setCorreoDesbloqueo('');
        cargarUsuariosAlmacen();
        cargarTodosUsuarios();
        cargarEstadisticas();
      } else {
        mostrarMensaje('error', data.error || 'Error al desbloquear usuario');
      }
    } catch (error) {
      console.error('Error al desbloquear usuario:', error);
      mostrarMensaje('error', 'Error de conexión al desbloquear usuario');
    } finally {
      setLoading(false);
    }
  };

  // Eliminar usuario
  const eliminarUsuario = async (e) => {
    e.preventDefault();
    
    if (!correoEliminacion) {
      mostrarMensaje('error', 'Ingrese un correo electrónico');
      return;
    }

    if (!confirm('¿Está seguro que desea eliminar este usuario? Esta acción no se puede deshacer.')) {
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        mostrarMensaje('error', 'Token no encontrado');
        setLoading(false);
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/admin/eliminar-usuario`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ correo_institucional: correoEliminacion })
      });

      const data = await response.json();
      
      if (response.ok) {
        mostrarMensaje('success', 'Usuario eliminado exitosamente');
        setCorreoEliminacion('');
        cargarUsuariosAlmacen();
        cargarTodosUsuarios();
        cargarEstadisticas();
      } else {
        mostrarMensaje('error', data.error || 'Error al eliminar usuario');
      }
    } catch (error) {
      console.error('Error al eliminar usuario:', error);
      mostrarMensaje('error', 'Error de conexión al eliminar usuario');
    } finally {
      setLoading(false);
    }
  };

  const mostrarMensaje = (tipo, texto) => {
    setMensaje({ tipo, texto });
    setTimeout(() => setMensaje({ tipo: '', texto: '' }), 5000);
  };

  // Filtrar usuarios
  const usuariosFiltrados = todosUsuarios.filter(usuario =>
    usuario.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    usuario.correo_institucional.toLowerCase().includes(searchTerm.toLowerCase()) ||
    usuario.rol.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const usuariosPorGrupo = todosUsuarios.filter(
    (u) => grupoSeleccionado && u.grupo_id === parseInt(grupoSeleccionado)
  );
  const usuariosGrupoFiltrados = usuariosPorGrupo.filter((u) =>
    u.nombre.toLowerCase().includes(searchGrupo.toLowerCase())
  );

  const toggleSeleccion = (id) => {
    setUsuariosSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const eliminarUsuariosMasivo = async () => {
    if (usuariosSeleccionados.length === 0) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        mostrarMensaje('error', 'Token no encontrado');
        setLoading(false);
        return;
      }
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/admin/eliminar-usuarios`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ids: usuariosSeleccionados })
      });
      const data = await response.json();
      if (response.ok) {
        mostrarMensaje('success', 'Usuarios eliminados exitosamente');
        setTodosUsuarios((prev) => prev.filter(u => !usuariosSeleccionados.includes(u.id)));
        setUsuariosSeleccionados([]);
        cargarEstadisticas();
      } else {
        mostrarMensaje('error', data.error || 'Error al eliminar usuarios');
      }
    } catch (error) {
      console.error('Error al eliminar usuarios:', error);
      mostrarMensaje('error', 'Error de conexión al eliminar usuarios');
    } finally {
      setLoading(false);
    }
  };
  
  const getRolColor = (rol) => {
    switch (rol.toLowerCase()) {
      case 'estudiante':
        return 'bg-blue-100 text-blue-800';
      case 'docente':
        return 'bg-green-100 text-green-800';
      case 'almacen':
        return 'bg-purple-100 text-purple-800';
      case 'administrador':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  useEffect(() => {
    if (usuario && usuario.rol_id === 4) {
      cargarUsuariosAlmacen();
      cargarTodosUsuarios();
      cargarEstadisticas();
      cargarGrupos();
    }
  }, [usuario]);

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
    <main
      className="flex-1 p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Panel de Administración</h1>
            <p className="text-gray-600">Gestiona usuarios y permisos del sistema</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-200">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-gray-700">Sistema Activo</span>
            </div>
          </div>
        </div>

        {/* Estadísticas Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {estadisticas.roles.map((rol) => (
            <div key={rol.rol} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">{rol.rol}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{rol.total}</p>
                  <div className="flex items-center mt-2 space-x-4">
                    <span className="text-xs text-green-600 font-medium">
                      {rol.activos} activos
                    </span>
                    {rol.bloqueados > 0 && (
                      <span className="text-xs text-red-600 font-medium">
                        {rol.bloqueados} bloqueados
                      </span>
                    )}
                  </div>
                </div>
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${getRolColor(rol.rol)}`}>
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 mb-8 overflow-hidden">
          <div className="border-b border-gray-200">
            <nav className="flex">
              {[
                { id: 'crear', name: 'Crear Usuario', icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z' },
                { id: 'almacen', name: 'Personal Almacén', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
                { id: 'usuarios', name: 'Todos los Usuarios', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
                { id: 'acciones', name: 'Acciones', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
                { id: 'ajustes', name: 'Ajuste Masivo de Usuarios', icon: 'M6 18L18 6M6 6l12 12' }
        ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setVistaActiva(tab.id)}
                  className={`flex items-center px-6 py-4 text-sm font-medium transition-colors ${
                    vistaActiva === tab.id
                      ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={tab.icon} />
                  </svg>
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Mensajes */}
        {mensaje.texto && (
          <div className={`mb-6 p-4 rounded-xl border-l-4 backdrop-blur-sm ${
            mensaje.tipo === 'success' 
              ? 'bg-green-50 border-green-500 text-green-700' 
              : 'bg-red-50 border-red-500 text-red-700'
          }`}>
            <div className="flex items-center">
              {mensaje.tipo === 'success' ? (
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
              {mensaje.texto}
            </div>
          </div>
        )}

        {/* Contenido según vista activa */}
        {vistaActiva === 'crear' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <div className="flex items-center mb-8">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Crear Nuevo Usuario</h2>
                <p className="text-gray-600">Agrega un nuevo usuario al sistema</p>
              </div>
            </div>
            
            <form onSubmit={agregarUsuario} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label htmlFor="nombre" className="block text-sm font-semibold text-gray-700 mb-3">
                    Nombre Completo
                  </label>
                  <input
                    type="text"
                    id="nombre"
                    value={nuevoUsuario.nombre}
                    onChange={(e) => setNuevoUsuario({...nuevoUsuario, nombre: e.target.value})}
                    className="w-full px-4 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                    placeholder="Nombre completo del usuario"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="correo" className="block text-sm font-semibold text-gray-700 mb-3">
                    Correo Institucional
                  </label>
                  <input
                    type="email"
                    id="correo"
                    value={nuevoUsuario.correo_institucional}
                    onChange={(e) => setNuevoUsuario({...nuevoUsuario, correo_institucional: e.target.value})}
                    className="w-full px-4 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                    placeholder="usuario@utsjr.edu.mx"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="rol" className="block text-sm font-semibold text-gray-700 mb-3">
                    Rol del Usuario
                  </label>
                  <select
                    id="rol"
                    value={nuevoUsuario.rol_id}
                    onChange={(e) => setNuevoUsuario({...nuevoUsuario, rol_id: e.target.value})}
                    className="w-full px-4 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                    required
                  >
                    <option value="">Seleccionar rol</option>
                    {roles.map(rol => (
                      <option key={rol.id} value={rol.id}>
                        {rol.nombre.charAt(0).toUpperCase() + rol.nombre.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="flex justify-end pt-6">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 text-white px-8 py-4 rounded-xl font-semibold transition-all duration-200 flex items-center space-x-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creando...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Crear Usuario
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {vistaActiva === 'almacen' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-8 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-teal-600 rounded-2xl flex items-center justify-center mr-4">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Personal de Almacén</h2>
                    <p className="text-gray-600">Gestiona permisos del personal de almacén ({usuariosAlmacen.length} usuarios)</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Con acceso al chat</p>
                  <p className="text-2xl font-bold text-green-600">
                    {estadisticas.permisos_almacen?.con_chat || 0}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="divide-y divide-gray-200">
              {usuariosAlmacen.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  <div className="w-20 h-20 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
                    <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No hay usuarios de almacén</h3>
                  <p className="text-gray-500">Crea un usuario con rol de almacén para comenzar</p>
                </div>
              ) : (
                usuariosAlmacen.map((user) => (
                  <div key={user.id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-4">
                          <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg">
                            {user.nombre.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">{user.nombre}</h3>
                            <p className="text-gray-600">{user.correo_institucional}</p>
                            <div className="flex items-center mt-2">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                                user.activo 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                <div className={`w-2 h-2 rounded-full mr-2 ${
                                  user.activo ? 'bg-green-400' : 'bg-red-400'
                                }`}></div>
                                {user.activo ? 'Activo' : 'Bloqueado'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-8">
                        <div className="text-center">
                          <label className="block text-sm font-semibold text-gray-700 mb-3">
                            Acceso al Chat
                          </label>
                          <label className="relative inline-flex items-center cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={user.acceso_chat || false}
                              onChange={(e) => actualizarPermisos(user.id, 'acceso_chat', e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600 shadow-inner group-hover:shadow-lg transition-shadow">
                            </div>
                            <span className="ml-3 text-sm font-medium text-gray-600">
                              {user.acceso_chat ? 'Habilitado' : 'Deshabilitado'}
                            </span>
                          </label>
                        </div>
                        
                        <div className="text-center">
                          <label className="block text-sm font-semibold text-gray-700 mb-3">
                            Modificar Stock
                          </label>
                          <label className="relative inline-flex items-center cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={user.modificar_stock || false}
                              onChange={(e) => actualizarPermisos(user.id, 'modificar_stock', e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-600 shadow-inner group-hover:shadow-lg transition-shadow">
                            </div>
                            <span className="ml-3 text-sm font-medium text-gray-600">
                              {user.modificar_stock ? 'Habilitado' : 'Deshabilitado'}
                            </span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {vistaActiva === 'usuarios' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-8 border-b border-gray-200">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center mr-4">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Todos los Usuarios</h2>
                    <p className="text-gray-600">Lista completa de usuarios del sistema ({todosUsuarios.length} usuarios)</p>
                  </div>
                </div>
              </div>
              
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Buscar usuarios por nombre, email o rol..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl leading-5 bg-gray-50 placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-colors"
                />
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Usuario</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Rol</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Permisos</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {usuariosFiltrados.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-semibold text-sm mr-4">
                            {user.nombre.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-gray-900">{user.nombre}</div>
                            <div className="text-sm text-gray-500">{user.correo_institucional}</div>
                            {user.rol?.toLowerCase() === 'estudiante' && (
                              <div className="mt-1 flex gap-2 flex-wrap">
                                <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs font-medium">
                                  {user.solicitudes_count || 0} solicitudes
                                </span>
                                <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-xs font-medium">
                                  {user.entregas_count || 0} entregas
                                </span>
                              </div>
                            )}
                            {user.rol?.toLowerCase() === 'docente' && (
                              <div className="mt-1 flex gap-2 flex-wrap">
                                <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full text-xs font-medium">
                                  {user.entregas_count || 0} reactivos
                                </span>
                              </div>
                            )}
                          </div>  
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getRolColor(user.rol)}`}>
                          {user.rol.charAt(0).toUpperCase() + user.rol.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                          user.activo 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          <div className={`w-2 h-2 rounded-full mr-2 ${
                            user.activo ? 'bg-green-400' : 'bg-red-400'
                          }`}></div>
                          {user.activo ? 'Activo' : 'Bloqueado'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex space-x-2">
                         {Boolean(user.acceso_chat) && (
                            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                              Chat
                            </span>
                          )}
                         {Boolean(user.modificar_stock) && (
                            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-800">
                              Stock
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {usuariosFiltrados.length === 0 && (
                <div className="p-12 text-center text-gray-500">
                  <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <p>No se encontraron usuarios que coincidan con la búsqueda</p>
                </div>
              )}
            </div>
          </div>
        )}

        {vistaActiva === 'acciones' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Bloquear Usuario */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 hover:shadow-md transition-shadow">
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center mr-4">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Bloquear Usuario</h3>
                  <p className="text-gray-600 text-sm">Impedir acceso al sistema</p>
                </div>
              </div>
              
              <form onSubmit={bloquearUsuario} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Correo del usuario
                  </label>
                  <input
                    type="email"
                    value={correoBloqueo}
                    onChange={(e) => setCorreoBloqueo(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                    placeholder="correo@utsjr.edu.mx"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 disabled:from-gray-400 disabled:to-gray-500 text-white py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Bloqueando...
                    </div>
                  ) : (
                    'Bloquear Usuario'
                  )}
                </button>
              </form>
            </div>

            {/* Desbloquear Usuario */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 hover:shadow-md transition-shadow">
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center mr-4">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Desbloquear Usuario</h3>
                  <p className="text-gray-600 text-sm">Restaurar acceso al sistema</p>
                </div>
              </div>
              
              <form onSubmit={desbloquearUsuario} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Correo del usuario
                  </label>
                  <input
                    type="email"
                    value={correoDesbloqueo}
                    onChange={(e) => setCorreoDesbloqueo(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                    placeholder="correo@utsjr.edu.mx"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:from-gray-400 disabled:to-gray-500 text-white py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Desbloqueando...
                    </div>
                  ) : (
                    'Desbloquear Usuario'
                  )}
                </button>
              </form>
            </div>

            {/* Eliminar Usuario */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 hover:shadow-md transition-shadow">
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-pink-500 rounded-2xl flex items-center justify-center mr-4">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Eliminar Usuario</h3>
                  <p className="text-red-600 text-sm font-semibold">⚠️ Acción irreversible</p>
                </div>
              </div>
              
              <form onSubmit={eliminarUsuario} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Correo del usuario
                  </label>
                  <input
                    type="email"
                    value={correoEliminacion}
                    onChange={(e) => setCorreoEliminacion(e.target.value)}
                    className="w-full px-4 py-3 border border-red-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 bg-red-50 focus:bg-white"
                    placeholder="correo@utsjr.edu.mx"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 disabled:from-gray-400 disabled:to-gray-500 text-white py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Eliminando...
                    </div>
                  ) : (
                    'Eliminar Usuario'
                  )}
                </button>
              </form>
            </div>
          </div>
        )}

      {vistaActiva === 'ajustes' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-purple-600 rounded-2xl flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Ajuste Masivo de Usuarios</h2>
                <p className="text-gray-600">Elimina varios usuarios por grupo</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="md:col-span-1">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Grupo</label>
                <select
                  value={grupoSeleccionado}
                  onChange={(e) => {
                    setGrupoSeleccionado(e.target.value);
                    setUsuariosSeleccionados([]);
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                >
                  <option value="">Seleccione un grupo</option>
                  {grupos.map((g) => (
                    <option key={g.id} value={g.id}>{g.nombre}</option>
                  ))}
                </select>
              </div>

              {grupoSeleccionado && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Buscar alumnos</label>
                  <input
                    type="text"
                    value={searchGrupo}
                    onChange={(e) => setSearchGrupo(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                    placeholder="Nombre del alumno"
                  />
                </div>
              )}
            </div>

            {grupoSeleccionado && (
              <div>
                <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-4 mb-4">
                  {usuariosGrupoFiltrados.map((u) => (
                    <label key={u.id} className="flex items-center space-x-2 mb-2">
                      <input
                        type="checkbox"
                        checked={usuariosSeleccionados.includes(u.id)}
                        onChange={() => toggleSeleccion(u.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{u.nombre}</span>
                    </label>
                  ))}
                  {usuariosGrupoFiltrados.length === 0 && (
                    <p className="text-sm text-gray-500">No se encontraron usuarios</p>
                  )}
                </div>
                <button
                  onClick={eliminarUsuariosMasivo}
                  disabled={usuariosSeleccionados.length === 0 || loading}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md disabled:opacity-50"
                >
                  Eliminar seleccionados
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
