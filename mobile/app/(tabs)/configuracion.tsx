import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Switch,
  useWindowDimensions,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../../lib/auth'; // Adjust path as needed
import { API_URL } from '../../constants/api'; // Adjust path as needed

// Interfaces
interface Usuario {
  id: number;
  nombre: string;
  correo_institucional: string;
  rol: string;
  activo: boolean;
  acceso_chat?: boolean;
  modificar_stock?: boolean;
  solicitudes_count?: number;
  entregas_count?: number;
  grupo_id?: number;
}

interface Estadisticas {
  roles: { rol: string; total: number; activos: number; bloqueados: number }[];
  permisos_almacen: { con_chat: number };
}

interface Grupo {
  id: number;
  nombre: string;
}

const roles = [
  { id: 2, nombre: 'docente' },
  { id: 3, nombre: 'almacen' },
  { id: 4, nombre: 'administrador' },
];

export default function ConfiguracionScreen() {
  const { usuario } = useAuth();
  const [usuariosAlmacen, setUsuariosAlmacen] = useState<Usuario[]>([]);
  const [todosUsuarios, setTodosUsuarios] = useState<Usuario[]>([]);
  const [estadisticas, setEstadisticas] = useState<Estadisticas>({
    roles: [],
    permisos_almacen: { con_chat: 0 },
  });
  const [nuevoUsuario, setNuevoUsuario] = useState({
    nombre: '',
    correo_institucional: '',
    rol_id: '',
  });
  const [correoBloqueo, setCorreoBloqueo] = useState('');
  const [correoDesbloqueo, setCorreoDesbloqueo] = useState('');
  const [correoEliminacion, setCorreoEliminacion] = useState('');
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });
  const [vistaActiva, setVistaActiva] = useState('crear');
  const [searchTerm, setSearchTerm] = useState('');
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [grupoSeleccionado, setGrupoSeleccionado] = useState('');
  const [searchGrupo, setSearchGrupo] = useState('');
  const [usuariosSeleccionados, setUsuariosSeleccionados] = useState<number[]>([]);
  const { width } = useWindowDimensions();
  const isTablet = width > 600;

     useEffect(() => {
    if (!API_URL) {
      console.warn('API_URL no está configurada');
      return;
    }
    if (usuario && usuario.rol_id === 4) {
      cargarUsuariosAlmacen();
      cargarTodosUsuarios();
      cargarEstadisticas();
      cargarGrupos();
    }
  }, [usuario]);

  // Generar contraseña aleatoria
  const generarContrasenaAleatoria = (): string => {
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
      const token = await SecureStore.getItemAsync('token');
      if (!token) {
        mostrarMensaje('error', 'Token no encontrado');
        return;
      }

      const response = await fetch(`${API_URL}/api/admin/usuarios-almacen`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
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
      const token = await SecureStore.getItemAsync('token');
      if (!token) return;

      const response = await fetch(`${API_URL}/api/admin/usuarios`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
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
      const response = await fetch(`${API_URL}/api/grupos`);
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
      const token = await SecureStore.getItemAsync('token');
      if (!token) return;

      const response = await fetch(`${API_URL}/api/admin/estadisticas`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
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
  const agregarUsuario = async () => {
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
      const token = await SecureStore.getItemAsync('token');

      if (!token) {
        mostrarMensaje('error', 'Token no encontrado');
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_URL}/api/admin/crear-usuario`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...nuevoUsuario,
          contrasena: contrasenaAleatoria,
          rol_id: parseInt(nuevoUsuario.rol_id),
        }),
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
      mostrarMensaje('error', 'Error de conexión al crear usuario: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Actualizar permisos de usuario
  const actualizarPermisos = async (usuarioId: number, campo: string, valor: boolean) => {
    try {
      const token = await SecureStore.getItemAsync('token');
      if (!token) {
        mostrarMensaje('error', 'Token no encontrado');
        return;
      }

      const response = await fetch(`${API_URL}/api/admin/actualizar-permisos`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          usuario_id: usuarioId,
          campo,
          valor,
        }),
      });

      if (response.ok) {
        setUsuariosAlmacen((usuarios) =>
          usuarios.map((user) =>
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
  const bloquearUsuario = async () => {
    if (!correoBloqueo) {
      mostrarMensaje('error', 'Ingrese un correo electrónico');
      return;
    }

    setLoading(true);
    try {
      const token = await SecureStore.getItemAsync('token');
      if (!token) {
        mostrarMensaje('error', 'Token no encontrado');
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_URL}/api/admin/bloquear-usuario`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ correo_institucional: correoBloqueo }),
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
  const desbloquearUsuario = async () => {
    if (!correoDesbloqueo) {
      mostrarMensaje('error', 'Ingrese un correo electrónico');
      return;
    }

    setLoading(true);
    try {
      const token = await SecureStore.getItemAsync('token');
      if (!token) {
        mostrarMensaje('error', 'Token no encontrado');
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_URL}/api/admin/desbloquear-usuario`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ correo_institucional: correoDesbloqueo }),
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
  const eliminarUsuario = async () => {
    if (!correoEliminacion) {
      mostrarMensaje('error', 'Ingrese un correo electrónico');
      return;
    }

    Alert.alert(
      'Confirmar Eliminación',
      '¿Está seguro que desea eliminar este usuario? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const token = await SecureStore.getItemAsync('token');
              if (!token) {
                mostrarMensaje('error', 'Token no encontrado');
                setLoading(false);
                return;
              }

              const response = await fetch(`${API_URL}/api/admin/eliminar-usuario`, {
                method: 'DELETE',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ correo_institucional: correoEliminacion }),
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
          },
        },
      ]
    );
  };

  const mostrarMensaje = (tipo: string, texto: string) => {
    setMensaje({ tipo, texto });
    setTimeout(() => setMensaje({ tipo: '', texto: '' }), 5000);
  };

  // Filtrar usuarios
  const usuariosFiltrados = todosUsuarios.filter((usuario) =>
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

  const toggleSeleccion = (id: number) => {
    setUsuariosSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const eliminarUsuariosMasivo = async () => {
    if (usuariosSeleccionados.length === 0) return;
    setLoading(true);
    try {
      const token = await SecureStore.getItemAsync('token');
      if (!token) {
        mostrarMensaje('error', 'Token no encontrado');
        setLoading(false);
        return;
      }
      const response = await fetch(`${API_URL}/api/admin/eliminar-usuarios`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: usuariosSeleccionados }),
      });
      const data = await response.json();
      if (response.ok) {
        mostrarMensaje('success', 'Usuarios eliminados exitosamente');
        setTodosUsuarios((prev) => prev.filter((u) => !usuariosSeleccionados.includes(u.id)));
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

  const getRolColor = (rol: string): { backgroundColor: string; color: string } => {
    switch (rol.toLowerCase()) {
      case 'estudiante':
        return { backgroundColor: '#dbeafe', color: '#1e40af' };
      case 'docente':
        return { backgroundColor: '#dcfce7', color: '#15803d' };
      case 'almacen':
        return { backgroundColor: '#f3e8ff', color: '#6d28d9' };
      case 'administrador':
        return { backgroundColor: '#fee2e2', color: '#b91c1c' };
      default:
        return { backgroundColor: '#f3f4f6', color: '#1e293b' };
    }
  };

  if (!API_URL) {
    return (
      <LinearGradient
        colors={['#f9fafb', '#f3f4f6']}
        style={styles.container}
      >
        <View style={styles.deniedContainer}>
          <View style={styles.deniedIcon}>
            <Ionicons name="alert-circle-outline" size={32} color="#ef4444" />
          </View>
          <Text style={styles.deniedTitle}>Configuración inválida</Text>
          <Text style={styles.deniedText}>API_URL no configurada</Text>
        </View>
      </LinearGradient>
    );
  }

 // Verificar que el usuario es administrador
  if (!usuario || usuario.rol_id !== 4) {
    return (
      <LinearGradient
        colors={['#f9fafb', '#f3f4f6']}
        style={styles.container}
      >
        <View style={styles.deniedContainer}>
          <View style={styles.deniedIcon}>
            <Ionicons name="alert-circle-outline" size={32} color="#ef4444" />
          </View>
          <Text style={styles.deniedTitle}>Acceso Denegado</Text>
          <Text style={styles.deniedText}>No tienes permisos para acceder a esta página.</Text>
        </View>
      </LinearGradient>
    );
  }

  const tabs = [
    { id: 'crear', name: 'Crear Usuario', icon: 'person-add-outline' },
    { id: 'almacen', name: 'Personal Almacén', icon: 'business-outline' },
    { id: 'usuarios', name: 'Todos los Usuarios', icon: 'people-outline' },
    { id: 'acciones', name: 'Acciones', icon: 'settings-outline' },
    { id: 'ajustes', name: 'Ajuste Masivo de Usuarios', icon: 'trash-outline' },
  ];

  const renderTab = ({ item }: { item: { id: string; name: string; icon: string } }) => (
    <TouchableOpacity
      style={[
        styles.tabButton,
        vistaActiva === item.id ? styles.activeTab : styles.inactiveTab,
      ]}
      onPress={() => setVistaActiva(item.id)}
    >
      <Ionicons
        name={item.icon as any}
        size={20}
        color={vistaActiva === item.id ? '#3b82f6' : '#6b7280'}
      />
      <Text
        style={[
          styles.tabText,
          vistaActiva === item.id ? styles.activeTabText : styles.inactiveTabText,
        ]}
      >
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  return (
   <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={['#f9fafb', '#f3f4f6']} style={[styles.container, styles.linearGradientFix]}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View
            style={[
              styles.header,
              { paddingHorizontal: isTablet ? 32 : 16 },
            ]}
          >
            <Text style={styles.headerTitle}>Panel de Administración</Text>
            <Text style={styles.headerSubtitle}>Gestiona usuarios y permisos del sistema</Text>
            <View style={styles.statusBadge}>
              <View style={styles.statusIndicator} />
              <Text style={styles.statusText}>Sistema Activo</Text>
            </View>
          </View>

          {/* Estadísticas Cards */}
          <FlatList
            data={estadisticas.roles}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[
              styles.statsList,
              { paddingHorizontal: isTablet ? 32 : 16 },
            ]}
            renderItem={({ item: rol }) => (
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>{rol.rol}</Text>
                <Text style={styles.statValue}>{rol.total}</Text>
                <View style={styles.statDetails}>
                  <Text style={styles.statActive}>{rol.activos} activos</Text>
                  {rol.bloqueados > 0 && (
                    <Text style={styles.statBlocked}>{rol.bloqueados} bloqueados</Text>
                  )}
                </View>
              </View>
            )}
            keyExtractor={(item) => item.rol}
          />

          {/* Navigation Tabs */}
          <FlatList
            data={tabs}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[
              styles.tabList,
              { paddingHorizontal: isTablet ? 32 : 16 },
            ]}
            renderItem={renderTab}
            keyExtractor={(item) => item.id}
          />

          {/* Mensajes */}
          {mensaje.texto ? (
            <View
              style={[
                styles.messageContainer,
                mensaje.tipo === 'success'
                  ? styles.successMessage
                  : styles.errorMessage,
                { marginHorizontal: isTablet ? 32 : 16 },
              ]}
            >
              <Ionicons
                name={
                  mensaje.tipo === 'success'
                    ? 'checkmark-circle-outline'
                    : 'alert-circle-outline'
                }
                size={20}
                color={mensaje.tipo === 'success' ? '#15803d' : '#b91c1c'}
              />
              <Text style={styles.messageText}>{mensaje.texto}</Text>
            </View>
          ) : null}

         {/* Contenido según vista activa */}
          <View style={[styles.contentContainer, { paddingHorizontal: isTablet ? 32 : 16 }]}>
            {vistaActiva === 'crear' && (
              <View style={styles.section}>
                <View style={styles.sectionIcon}>
                  <Ionicons name="person-add-outline" size={24} color="#ffffff" />
                </View>
                <Text style={styles.sectionTitle}>Crear Nuevo Usuario</Text>
                <Text style={styles.sectionSubtitle}>Agrega un nuevo usuario al sistema</Text>

                <View style={isTablet ? styles.formGrid : styles.formColumn}>
                  <View style={styles.formField}>
                    <Text style={styles.formLabel}>Nombre Completo</Text>
                    <TextInput
                      style={styles.input}
                      value={nuevoUsuario.nombre}
                      onChangeText={(text) => setNuevoUsuario({ ...nuevoUsuario, nombre: text })}
                      placeholder="Nombre completo del usuario"
                    />
                  </View>

                  <View style={styles.formField}>
                    <Text style={styles.formLabel}>Correo Institucional</Text>
                    <TextInput
                      style={styles.input}
                      value={nuevoUsuario.correo_institucional}
                      onChangeText={(text) =>
                        setNuevoUsuario({ ...nuevoUsuario, correo_institucional: text })
                      }
                      placeholder="usuario@utsjr.edu.mx"
                      keyboardType="email-address"
                    />
                  </View>
 <View style={styles.buttonGroup}>
                      {roles.map((rol) => {
                        const selected = nuevoUsuario.rol_id === rol.id.toString();
                        return (
                          <TouchableOpacity
                            key={rol.id}
                            style={[
                              styles.optionButton,
                              selected && styles.optionButtonSelected,
                            ]}
                            onPress={() =>
                              setNuevoUsuario({
                                ...nuevoUsuario,
                                rol_id: rol.id.toString(),
                              })
                            }
                          >
                            <Text
                              style={[
                                styles.optionButtonText,
                                selected && styles.optionButtonTextSelected,
                              ]}
                            >
                              {rol.nombre.charAt(0).toUpperCase() + rol.nombre.slice(1)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
 
                <TouchableOpacity
                  style={styles.submitButton}
                  onPress={agregarUsuario}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                   <View style={styles.submitContent}>
                      <Ionicons name="add-circle-outline" size={20} color="#ffffff" />
                      <Text style={styles.submitText}>Crear Usuario</Text>
                   </View>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {vistaActiva === 'almacen' && (
              <View style={styles.section}>
                <View style={styles.sectionIcon}>
                  <Ionicons name="business-outline" size={24} color="#ffffff" />
                </View>
                <Text style={styles.sectionTitle}>Personal de Almacén</Text>
                <Text style={styles.sectionSubtitle}>
                  Gestiona permisos del personal de almacén ({usuariosAlmacen.length} usuarios)
                </Text>
                <Text style={styles.chatAccess}>
                  Con acceso al chat: {estadisticas.permisos_almacen?.con_chat || 0}
                </Text>

                {usuariosAlmacen.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <View style={styles.emptyIcon}>
                      <Ionicons name="folder-outline" size={48} color="#94a3b8" />
                    </View>
                    <Text style={styles.emptyTitle}>No hay usuarios de almacén</Text>
                    <Text style={styles.emptySubtitle}>Crea un usuario con rol de almacén para comenzar</Text>
                  </View>
                ) : (
                   <View style={styles.listContent}>
                    {usuariosAlmacen.map((user) => (
                      <View key={user.id} style={styles.userCard}>
                        <View style={styles.userHeader}>
                          <View style={styles.userAvatar}>
                            <Text style={styles.avatarText}>{user.nombre.charAt(0).toUpperCase()}</Text>
                          </View>
                          <View style={styles.userInfo}>
                            <Text style={styles.userName}>{user.nombre}</Text>
                            <Text style={styles.userEmail}>{user.correo_institucional}</Text>
                            <View
                              style={[
                                styles.statusBadge,
                                user.activo ? styles.activeStatus : styles.blockedStatus,
                              ]}
                            >
                              <View
                                style={[
                                  styles.statusDot,
                                  user.activo ? styles.activeDot : styles.blockedDot,
                                ]}
                              />
                              <Text style={styles.statusText}>
                                {user.activo ? 'Activo' : 'Bloqueado'}
                              </Text>
                            </View>
                          </View>
                        </View>
                        <View style={styles.permissions}>
                          <View style={styles.permissionItem}>
                            <Text style={styles.permissionLabel}>Acceso al Chat</Text>
                            <Switch
                              value={!!user.acceso_chat}
                              onValueChange={(value) => actualizarPermisos(user.id, 'acceso_chat', value)}
                              trackColor={{ false: '#d1d5db', true: '#3b82f6' }}
                              thumbColor="#ffffff"
                            />
                          </View>
                          <View style={styles.permissionItem}>
                            <Text style={styles.permissionLabel}>Modificar Stock</Text>
                            <Switch
                              value={!!user.modificar_stock}
                              onValueChange={(value) => actualizarPermisos(user.id, 'modificar_stock', value)}
                              trackColor={{ false: '#d1d5db', true: '#22c55e' }}
                              thumbColor="#ffffff"
                            />
                          </View>
                        </View>
                      </View>
                     ))}
                  </View>
                )}
              </View>
            )}

            {vistaActiva === 'usuarios' && (
              <View style={styles.section}>
                <View style={styles.sectionIcon}>
                  <Ionicons name="people-outline" size={24} color="#ffffff" />
                </View>
                <Text style={styles.sectionTitle}>Todos los Usuarios</Text>
                <Text style={styles.sectionSubtitle}>
                  Lista completa de usuarios del sistema ({todosUsuarios.length} usuarios)
                </Text>

                <View style={styles.searchContainer}>
                  <Ionicons name="search-outline" size={20} color="#6b7280" style={styles.searchIcon} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Buscar usuarios por nombre, email o rol..."
                    value={searchTerm}
                    onChangeText={setSearchTerm}
                  />
                </View>

                 {usuariosFiltrados.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Ionicons name="search-outline" size={48} color="#94a3b8" />
                    <Text style={styles.emptyTitle}>No se encontraron usuarios</Text>
                  </View>
                ) : (
                  <View style={styles.listContent}>
                    {usuariosFiltrados.map((user) => (
                      <View key={user.id} style={styles.userRow}>
                        <View style={styles.userHeader}>
                          <View style={styles.userAvatar}>
                            <Text style={styles.avatarText}>{user.nombre.charAt(0).toUpperCase()}</Text>
                          </View>
                          <View style={styles.userInfo}>
                            <Text style={styles.userName}>{user.nombre}</Text>
                            <Text style={styles.userEmail}>{user.correo_institucional}</Text>
                            {user.rol.toLowerCase() === 'estudiante' && (
                              <View style={styles.userStats}>
                                <Text style={styles.statBadge}>
                                  {user.solicitudes_count || 0} solicitudes
                                </Text>
                                <Text style={styles.statBadge}>
                                  {user.entregas_count || 0} entregas
                                </Text>
                              </View>
                            )}
                            {user.rol.toLowerCase() === 'docente' && (
                              <View style={styles.userStats}>
                                <Text style={styles.statBadge}>
                                  {user.entregas_count || 0} reactivos
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                        <View
                          style={[
                            styles.roleBadge,
                            getRolColor(user.rol),
                          ]}
                        >
                          <Text style={styles.roleText}>
                            {user.rol.charAt(0).toUpperCase() + user.rol.slice(1)}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.statusBadge,
                            user.activo ? styles.activeStatus : styles.blockedStatus,
                          ]}
                        >
                          <View
                            style={[
                              styles.statusDot,
                              user.activo ? styles.activeDot : styles.blockedDot,
                            ]}
                          />
                          <Text style={styles.statusText}>
                            {user.activo ? 'Activo' : 'Bloqueado'}
                          </Text>
                        </View>
                        <View style={styles.permissions}>
                          {user.acceso_chat && (
                            <Text style={styles.permissionBadge}>Chat</Text>
                          )}
                          {user.modificar_stock && (
                            <Text style={styles.permissionBadge}>Stock</Text>
                          )}
                        </View>
                      </View>
                 ))}
                  </View>
                )}
              </View>
            )}

            {vistaActiva === 'acciones' && (
              <View style={styles.actionsGrid}>
                {/* Bloquear Usuario */}
                <View style={styles.actionCard}>
                 <View style={[styles.actionIcon, styles.actionIconBlock]}>
                    <Ionicons name="lock-closed-outline" size={24} color="#ffffff" />
                  </View>
                  <Text style={styles.actionTitle}>Bloquear Usuario</Text>
                  <Text style={styles.actionSubtitle}>Impedir acceso al sistema</Text>
                  <TextInput
                    style={styles.actionInput}
                    value={correoBloqueo}
                    onChangeText={setCorreoBloqueo}
                    placeholder="correo@utsjr.edu.mx"
                    keyboardType="email-address"
                  />
                  <TouchableOpacity
                    style={[styles.actionButton, styles.actionButtonBlock]}
                    onPress={bloquearUsuario}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.actionButtonText}>Bloquear Usuario</Text>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Desbloquear Usuario */}
                <View style={styles.actionCard}>
                  <View style={[styles.actionIcon, styles.actionIconUnblock]}>
                    <Ionicons name="lock-open-outline" size={24} color="#ffffff" />
                  </View>
                  <Text style={styles.actionTitle}>Desbloquear Usuario</Text>
                  <Text style={styles.actionSubtitle}>Restaurar acceso al sistema</Text>
                  <TextInput
                    style={styles.actionInput}
                    value={correoDesbloqueo}
                    onChangeText={setCorreoDesbloqueo}
                    placeholder="correo@utsjr.edu.mx"
                    keyboardType="email-address"
                  />
                  <TouchableOpacity
                    style={[styles.actionButton, styles.actionButtonUnblock]}
                    onPress={desbloquearUsuario}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.actionButtonText}>Desbloquear Usuario</Text>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Eliminar Usuario */}
                <View style={styles.actionCard}>
                   <View style={[styles.actionIcon, styles.actionIconDelete]}>
                    <Ionicons name="trash-outline" size={24} color="#ffffff" />
                  </View>
                  <Text style={styles.actionTitle}>Eliminar Usuario</Text>
                  <Text style={styles.actionSubtitle}>⚠️ Acción irreversible</Text>
                  <TextInput
                    style={styles.actionInput}
                    value={correoEliminacion}
                    onChangeText={setCorreoEliminacion}
                    placeholder="correo@utsjr.edu.mx"
                    keyboardType="email-address"
                  />
                  <TouchableOpacity
                    style={[styles.actionButton, styles.actionButtonDelete]}
                    onPress={eliminarUsuario}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.actionButtonText}>Eliminar Usuario</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {vistaActiva === 'ajustes' && (
              <View style={styles.section}>
                <View style={styles.sectionIcon}>
                  <Ionicons name="trash-outline" size={24} color="#ffffff" />
                </View>
                <Text style={styles.sectionTitle}>Ajuste Masivo de Usuarios</Text>
                <Text style={styles.sectionSubtitle}>Elimina varios usuarios por grupo</Text>

                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Grupo</Text>
                   <View style={styles.buttonGroup}>
                    {grupos.map((g) => {
                      const selected = grupoSeleccionado === g.id.toString();
                      return (
                        <TouchableOpacity
                          key={g.id}
                          style={[
                            styles.optionButton,
                            selected && styles.optionButtonSelected,
                          ]}
                          onPress={() => {
                            setGrupoSeleccionado(g.id.toString());
                            setUsuariosSeleccionados([]);
                          }}
                        >
                          <Text
                            style={[
                              styles.optionButtonText,
                              selected && styles.optionButtonTextSelected,
                            ]}
                          >
                            {g.nombre}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {grupoSeleccionado && (
                  <View style={styles.formField}>
                    <Text style={styles.formLabel}>Buscar alumnos</Text>
                    <TextInput
                      style={styles.input}
                      value={searchGrupo}
                      onChangeText={setSearchGrupo}
                      placeholder="Nombre del alumno"
                    />
                  </View>
                )}

                {grupoSeleccionado && (
                  <FlatList
                    data={usuariosGrupoFiltrados}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item: u }) => (
                      <TouchableOpacity
                        style={styles.checkboxRow}
                        onPress={() => toggleSeleccion(u.id)}
                      >
                        <Ionicons
                          name={usuariosSeleccionados.includes(u.id) ? 'checkbox' : 'square-outline'}
                          size={24}
                          color="#3b82f6"
                        />
                        <Text style={styles.checkboxLabel}>{u.nombre}</Text>
                      </TouchableOpacity>
                    )}
                    contentContainerStyle={styles.checkboxList}
                    ListEmptyComponent={
                      <Text style={styles.emptyText}>No se encontraron usuarios</Text>
                    }
                  />
                )}

                {grupoSeleccionado && (
                  <TouchableOpacity
                    style={styles.deleteMassButton}
                    onPress={eliminarUsuariosMasivo}
                    disabled={usuariosSeleccionados.length === 0 || loading}
                  >
                    <Text style={styles.deleteMassText}>Eliminar seleccionados</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 16,
  },
  deniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deniedIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fee2e2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  deniedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ef4444',
    marginBottom: 8,
  },
  deniedText: {
    fontSize: 16,
    color: '#4b5563',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
   contentContainer: {
    paddingBottom: 20,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#6b7280',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22c55e',
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4b5563',
  },
  statsList: {
    paddingBottom: 16,
  },
  statCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
    minWidth: 200,
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1e293b',
    marginTop: 8,
  },
  statDetails: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  statActive: {
    fontSize: 12,
    color: '#22c55e',
    fontWeight: '500',
  },
  statBlocked: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '500',
  },
  tabList: {
    marginBottom: 24,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginRight: 8,
    gap: 8,
  },
  activeTab: {
    backgroundColor: '#dbeafe',
    borderBottomWidth: 2,
    borderBottomColor: '#3b82f6',
  },
  inactiveTab: {
    backgroundColor: '#f3f4f6',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#3b82f6',
  },
  inactiveTabText: {
    color: '#6b7280',
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    gap: 8,
  },
  successMessage: {
    backgroundColor: '#dcfce7',
    borderLeftWidth: 4,
    borderLeftColor: '#22c55e',
  },
  errorMessage: {
    backgroundColor: '#fee2e2',
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  messageText: {
    fontSize: 14,
    color: '#1e293b',
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
    overflow: 'hidden',
  },
  sectionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginTop: 16,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  formGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  formColumn: {
    flexDirection: 'column',
    gap: 16,
  },
  formField: {
    flex: 1,
    minWidth: 200,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4b5563',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9fafb',
  },
 buttonGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  optionButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
    marginRight: 8,
    marginBottom: 8,
  },
  optionButtonSelected: {
    backgroundColor: '#3b82f6',
  },
  optionButtonText: {
    color: '#374151',
    fontWeight: '500',
  },
  optionButtonTextSelected: {
    color: '#ffffff',
  },
  submitButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
  },
   submitContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  linearGradientFix: {
    flex: 1,
    minHeight: '100%',
  },
  submitText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginLeft: 8,
  },
  chatAccess: {
    fontSize: 16,
    color: '#22c55e',
    fontWeight: 'bold',
    marginBottom: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  userCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  userAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  userEmail: {
    fontSize: 14,
    color: '#6b7280',
  },
  userStats: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  statBadge: {
    fontSize: 12,
    color: '#1e40af',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  activeStatus: {
    backgroundColor: '#dcfce7',
  },
  blockedStatus: {
    backgroundColor: '#fee2e2',
  },
  statusTextSmall: { // renamed from statusText to avoid duplicate
    fontSize: 12,
    color: '#1e293b',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  activeDot: {
    backgroundColor: '#22c55e',
  },
  blockedDot: {
    backgroundColor: '#ef4444',
  },
  permissions: {
    flexDirection: 'row',
    gap: 16,
  },
  permissionItem: {
    alignItems: 'center',
  },
  permissionLabel: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
  },
  listContent: {
    paddingBottom: 20,
  },
  userRow: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 8,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '500',
  },
  permissionBadge: {
    fontSize: 12,
    color: '#1e40af',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
     marginBottom: 16,
  },
  actionCard: {
    flex: 1,
    minWidth: 250,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
     marginBottom: 16,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
   actionIconBlock: {
    backgroundColor: '#f59e0b',
  },
  actionIconUnblock: {
    backgroundColor: '#22c55e',
  },
  actionIconDelete: {
    backgroundColor: '#ef4444',
  },
  actionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  actionInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9fafb',
    marginBottom: 16,
  },
  actionButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
     marginTop: 8,
  },
  actionButtonBlock: {
    backgroundColor: '#f59e0b',
  },
  actionButtonUnblock: {
    backgroundColor: '#22c55e',
  },
  actionButtonDelete: {
    backgroundColor: '#ef4444',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  checkboxList: {
    maxHeight: 256,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#1e293b',
  },
  deleteMassButton: {
    backgroundColor: '#ef4444',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteMassText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
});