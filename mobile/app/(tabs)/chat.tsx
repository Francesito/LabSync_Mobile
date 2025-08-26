import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  LayoutAnimation,
  UIManager,
  useWindowDimensions,
  SafeAreaView,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth'; // Assuming this is adapted for React Native
import { API_URL } from '@/constants/api';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

// Interfaces
interface Usuario {
  id: number;
  nombre: string;
  rol: string;
}

interface Permisos {
  acceso_chat: boolean;
  rol: string;
}

interface Contacto extends Usuario {
  ultimoMensaje: Mensaje | null;
}

interface Mensaje {
  id: number;
  emisor_id: number;
  receptor_id: number;
  contenido: string;
  fecha_envio: string;
}

interface RawContacto {
  id: number;
  nombre: string;
  rol: string;
}

// Base API URL for requests
const BASE = `${API_URL}/api`;

// Date formatting functions
const formatearFecha = (fecha: string): string => {
  const ahora = new Date();
  const fechaMensaje = new Date(fecha);
  const diferencia = ahora.getTime() - fechaMensaje.getTime();
  const diasDiferencia = Math.floor(diferencia / (1000 * 60 * 60 * 24));

  if (diasDiferencia === 0) {
    return fechaMensaje.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  } else if (diasDiferencia === 1) {
    return 'Ayer';
  } else if (diasDiferencia < 7) {
    return fechaMensaje.toLocaleDateString('es-ES', { weekday: 'short' });
  } else {
    return fechaMensaje.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
    });
  }
};

const formatearHoraMensaje = (fecha: string): string => {
  return new Date(fecha).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatearFechaCompleta = (fecha: string): string => {
  return new Date(fecha).toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const truncarMensaje = (mensaje: string, maxLength: number = 40): string => {
  if (!mensaje) return '';
  return mensaje.length > maxLength ? mensaje.substring(0, maxLength) + '...' : mensaje;
};

export default function ChatScreen() {
  const { usuario } = useAuth();
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [selectedUser, setSelectedUser] = useState<Contacto | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [nuevoMensaje, setNuevoMensaje] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingMensajes, setLoadingMensajes] = useState<boolean>(false);
  const [enviandoMensaje, setEnviandoMensaje] = useState<boolean>(false);
  const [permisos, setPermisos] = useState<Permisos | null>(null);
  const [loadingPermisos, setLoadingPermisos] = useState<boolean>(true);
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  const { width, height } = useWindowDimensions(); // For responsiveness
  const isTablet = width > 600;

  // Verificar permisos de chat al cargar el componente
  useEffect(() => {
    if (!usuario) {
      return;
    }

    verificarPermisosChat();
  }, [usuario]);

  // Cargar contactos solo si tiene permisos
  useEffect(() => {
    if (!usuario || !permisos) {
      return;
    }

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
  }, [usuario, permisos]);

  async function verificarPermisosChat() {
    const token = await SecureStore.getItemAsync('token');
    if (!token) {
      setError('Token de autenticación no encontrado');
      router.push('/login');
      return;
    }

    try {
      setLoadingPermisos(true);
      setError('');

      const { data } = await axios.get<Permisos>(`${BASE}/auth/permisos-chat`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      setPermisos(data);
    } catch (err: any) {
      console.error('[Chat] verificarPermisosChat:', err);
    if (!err.response) {
        // Error de red o servidor inaccesible
        if (usuario?.rol === 'alumno') {
          // Los alumnos siempre tienen acceso al chat
          setPermisos({ acceso_chat: true, rol: usuario.rol });
        } else {
          setPermisos({ acceso_chat: false, rol: usuario?.rol || 'desconocido' });
          setError('No se pudo verificar permisos de chat');
        }
      } else if (err.response?.status === 401) {
        setError('Sesión expirada. Inicia sesión nuevamente');
        await SecureStore.deleteItemAsync('token');
        router.push('/login');
      } else if (err.response?.status === 403) {
        setError('No tienes permisos para acceder al chat');
         setPermisos({ acceso_chat: false, rol: usuario?.rol || 'desconocido' });
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

    const token = await SecureStore.getItemAsync('token');
    if (!token) {
      setError('Token de autenticación no encontrado');
      router.push('/login');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const { data: rawContactos } = await axios.get<RawContacto[]>(`${BASE}/messages/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      // Obtener último mensaje para cada contacto
      const contactosConUltimoMensaje = await Promise.all(
        rawContactos.map(async (contacto) => {
          try {
            const { data: mensajesContacto } = await axios.get<Mensaje[]>(`${BASE}/messages/${contacto.id}`, {
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            });

            const ultimoMensaje = mensajesContacto[mensajesContacto.length - 1] || null;
            return {
              ...contacto,
              ultimoMensaje,
            };
          } catch (error) {
            return {
              ...contacto,
              ultimoMensaje: null,
            };
          }
        })
      );

      // Ordenar por último mensaje más reciente
      contactosConUltimoMensaje.sort((a, b) => {
        if (!a.ultimoMensaje && !b.ultimoMensaje) return 0;
        if (!a.ultimoMensaje) return 1;
        if (!b.ultimoMensaje) return -1;
        return new Date(b.ultimoMensaje.fecha_envio).getTime() - new Date(a.ultimoMensaje.fecha_envio).getTime();
      });

      setContactos(contactosConUltimoMensaje);

      if (contactosConUltimoMensaje.length === 0 && permisos.rol === 'almacen') {
        setError('No hay alumnos que hayan iniciado conversación contigo aún');
      }
    } catch (err: any) {
      console.error('[Chat] cargarContactos:', err);
      if (err.response?.status === 401) {
        setError('Sesión expirada. Inicia sesión nuevamente');
        await SecureStore.deleteItemAsync('token');
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

    const token = await SecureStore.getItemAsync('token');
    if (!token) {
      setError('Token de autenticación no encontrado');
      router.push('/login');
      return;
    }

    try {
      setLoadingMensajes(true);
      setError('');

      const { data } = await axios.get<Mensaje[]>(`${BASE}/messages/${selectedUser?.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      setMensajes(data);
    } catch (err: any) {
      console.error('[Chat] cargarMensajes:', err);
      if (err.response?.status === 401) {
        setError('Sesión expirada. Inicia sesión nuevamente');
        await SecureStore.deleteItemAsync('token');
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
    if (flatListRef.current && mensajes.length > 0) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  }, [mensajes]);

  async function handleEnviarMensaje() {
    if (!permisos || !permisos.acceso_chat) {
      setError('No tienes permiso para enviar mensajes');
      return;
    }

    const token = await SecureStore.getItemAsync('token');
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

      const { data: mensajeEnviado } = await axios.post<Mensaje>(`${BASE}/messages/send`, {
        contenido: nuevoMensaje.trim(),
        receptor_id: selectedUser.id,
      }, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      // Agregar el mensaje a la lista local
      setMensajes((prevMensajes) => [...prevMensajes, mensajeEnviado]);
      setNuevoMensaje('');

      // Actualizar el último mensaje en la lista de contactos sin recargar todo
      setContactos((prevContactos) => {
        const contactosActualizados = prevContactos.map((contacto) => {
          if (contacto.id === selectedUser.id) {
            return {
              ...contacto,
              ultimoMensaje: mensajeEnviado,
            };
          }
          return contacto;
        });

        // Reordenar para poner el contacto actualizado al principio
        return contactosActualizados.sort((a, b) => {
          if (!a.ultimoMensaje && !b.ultimoMensaje) return 0;
          if (!a.ultimoMensaje) return 1;
          if (!b.ultimoMensaje) return -1;
          return new Date(b.ultimoMensaje.fecha_envio).getTime() - new Date(a.ultimoMensaje.fecha_envio).getTime();
        });
      });
    } catch (err: any) {
      console.error('[Chat] handleEnviarMensaje:', err);
      if (err.response?.status === 401) {
        setError('Sesión expirada. Inicia sesión nuevamente');
        await SecureStore.deleteItemAsync('token');
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

  // Loading inicial mientras se verifican permisos
  if (!usuario || loadingPermisos) {
    return (
      <LinearGradient colors={['#f3f4f6', '#f3f4f6']} style={styles.container}>
        <ActivityIndicator size="large" color="#22c55e" />
        <Text style={styles.loadingText}>
          {!usuario ? 'Verificando autenticación...' : 'Verificando permisos de chat...'}
        </Text>
      </LinearGradient>
    );
  }

  // Mostrar mensaje de acceso denegado si no tiene permisos
  if (!permisos || !permisos.acceso_chat) {
    if (permisos?.rol === 'almacen') {
      return (
        <View style={styles.noAccessContainer}>
          <Text style={styles.noAccessText}>Sin acceso, contacta al administrador</Text>
        </View>
      );
    }

    return (
      <LinearGradient colors={['#f3f4f6', '#f3f4f6']} style={styles.container}>
        <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
        <Text style={styles.errorTitle}>Acceso Denegado</Text>
        <Text style={styles.errorText}>{error || 'No tienes permisos para acceder al chat'}</Text>
      </LinearGradient>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <LinearGradient colors={['#f3f4f6', '#f3f4f6']} style={styles.container}>
          {selectedUser ? (
            // Chat View
            <View style={styles.chatContainer}>
              {/* Chat Header */}
              <View style={[styles.chatHeader, { flexDirection: isTablet ? 'row' : 'row' }]}>
                <TouchableOpacity onPress={() => setSelectedUser(null)} style={styles.backButton}>
                  <Ionicons name="arrow-back" size={24} color="#111827" />
                </TouchableOpacity>
                <View style={styles.chatHeaderContent}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{selectedUser.nombre.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View>
                    <Text style={styles.contactName}>{selectedUser.nombre}</Text>
                    <Text style={styles.contactRole}>{selectedUser.rol}</Text>
                  </View>
                </View>
              </View>

              {/* Messages List */}
              <FlatList
                ref={flatListRef}
                data={mensajes}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item, index }) => {
                  const esMio = item.emisor_id === usuario?.id;
                  const mostrarFecha =
                    index === 0 ||
                    new Date(mensajes[index - 1].fecha_envio).toDateString() !==
                      new Date(item.fecha_envio).toDateString();

                  return (
                    <View>
                      {mostrarFecha && (
                        <View style={styles.dateSeparator}>
                          <Text style={styles.dateText}>{formatearFechaCompleta(item.fecha_envio)}</Text>
                        </View>
                      )}
                      <View style={[styles.messageContainer, esMio ? styles.messageRight : styles.messageLeft]}>
                        <View style={[styles.messageBubble, esMio ? styles.myMessage : styles.otherMessage]}>
                          <Text style={[styles.messageText, esMio ? styles.myMessageText : styles.otherMessageText]}>
                            {item.contenido}
                          </Text>
                          <Text style={[styles.messageTime, esMio ? styles.myMessageTime : styles.otherMessageTime]}>
                            {formatearHoraMensaje(item.fecha_envio)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                }}
                contentContainerStyle={styles.messageListContent}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
              />

              {/* Message Input */}
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Escribe un mensaje..."
                  value={nuevoMensaje}
                  onChangeText={setNuevoMensaje}
                  multiline
                  editable={!loadingMensajes && !enviandoMensaje && !!permisos && permisos.acceso_chat}
                />
                <TouchableOpacity
                  style={[
                    styles.sendButton,
                    (!nuevoMensaje.trim() || loadingMensajes || enviandoMensaje || !permisos || !permisos.acceso_chat) && styles.sendButtonDisabled,
                  ]}
                  onPress={handleEnviarMensaje}
                  disabled={!nuevoMensaje.trim() || loadingMensajes || enviandoMensaje || !permisos || !permisos.acceso_chat}
                >
                  {enviandoMensaje ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Ionicons name="send" size={20} color="#ffffff" />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            // Contact List View
            <View style={styles.listContainer}>
              {/* Contacts Header */}
              <View style={styles.listHeader}>
                <View style={styles.userInfo}>
                  <View style={styles.userAvatar}>
                    <Text style={styles.userAvatarText}>{usuario?.nombre?.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View>
                    <Text style={styles.chatsTitle}>Chats</Text>
                    <Text style={styles.chatsSubtitle}>
                      {permisos?.rol === 'alumno' ? 'Almacenistas' : 'Alumnos'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={cargarContactos}
                  disabled={loading || !permisos || !permisos.acceso_chat}
                  style={styles.refreshButton}
                >
                  <Ionicons name="refresh" size={20} color="#4b5563" />
                </TouchableOpacity>
              </View>

              {/* Contacts List */}
              <FlatList
                data={contactos}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.contactItem}
                    onPress={() => {
                      if (!permisos || !permisos.acceso_chat) {
                        setError('No tienes permiso para seleccionar un contacto');
                        return;
                      }
                      setSelectedUser(item);
                    }}
                  >
                    <View style={styles.contactAvatar}>
                      <Text style={styles.contactAvatarText}>{item.nombre.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={styles.contactInfo}>
                      <View style={styles.contactHeader}>
                        <Text style={styles.contactName}>{item.nombre}</Text>
                        {item.ultimoMensaje && (
                          <Text style={styles.contactTime}>{formatearFecha(item.ultimoMensaje.fecha_envio)}</Text>
                        )}
                      </View>
                      <Text style={styles.contactLastMessage}>
                        {item.ultimoMensaje ? truncarMensaje(item.ultimoMensaje.contenido) : 'Sin mensajes'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
                contentContainerStyle={styles.listContent}
              />
            </View>
          )}
        </LinearGradient>
      </KeyboardAvoidingView>
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
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#4b5563',
    textAlign: 'center',
  },
  errorTitle: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  errorText: {
    marginTop: 8,
    fontSize: 16,
    color: '#4b5563',
    textAlign: 'center',
  },
  errorSubText: {
    marginTop: 8,
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  noAccessContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    padding: 20,
  },
  noAccessText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
  },
  contactRole: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  listContainer: {
    flex: 1,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#22c55e',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  chatsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  chatsSubtitle: {
    fontSize: 12,
    color: '#6b7280',
  },
  refreshButton: {
    padding: 8,
  },
  listContent: {
    paddingBottom: 20,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    backgroundColor: '#ffffff',
  },
  contactAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#22c55e',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  contactAvatarText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  contactInfo: {
    flex: 1,
  },
  contactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  contactName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  contactTime: {
    fontSize: 12,
    color: '#6b7280',
  },
  contactLastMessage: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  chatContainer: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  backButton: {
    paddingRight: 16,
  },
  chatHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#22c55e',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  messageListContent: {
    padding: 16,
  },
  dateSeparator: {
    alignItems: 'center',
    marginVertical: 12,
  },
  dateText: {
    fontSize: 12,
    color: '#6b7280',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  messageContainer: {
    marginBottom: 8,
  },
  messageRight: {
    alignItems: 'flex-end',
  },
  messageLeft: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 20,
  },
  myMessage: {
    backgroundColor: '#22c55e',
  },
  otherMessage: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  messageText: {
    fontSize: 16,
  },
  myMessageText: {
    color: '#ffffff',
  },
  otherMessageText: {
    color: '#111827',
  },
  messageTime: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'right',
  },
  myMessageTime: {
    color: '#dcfce7',
  },
  otherMessageTime: {
    color: '#6b7280',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    maxHeight: 120,
  },
  sendButton: {
    marginLeft: 12,
    backgroundColor: '#22c55e',
    borderRadius: 999,
    padding: 12,
  },
  sendButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
});