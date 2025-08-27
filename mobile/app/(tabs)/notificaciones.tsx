import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  useWindowDimensions,
  SafeAreaView,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { API_URL } from '@/constants/api';

// Interface for notification
interface Notificacion {
  id: number;
  mensaje: string;
  leida: number;
  fecha: string;
}

// Date formatting function
const formatDate = (fecha: string): string => {
  return new Date(fecha).toLocaleString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function NotificacionesScreen() {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const { width } = useWindowDimensions(); // For responsiveness
  const isTablet = width > 600;

  useEffect(() => {
    const fetchNotificaciones = async () => {
      try {
        const token = await SecureStore.getItemAsync('token');
        if (!token) {
          setError('Debes iniciar sesión para ver tus notificaciones');
          setLoading(false);
          return;
        }

        setLoading(true);
        const { data } = await axios.get<Notificacion[] | { notificaciones: Notificacion[] }>(`${API_URL}/api/notificaciones`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        let normalizedData: Notificacion[] = [];
        if (Array.isArray(data)) {
          normalizedData = data;
        } else if (data && typeof data === 'object' && 'notificaciones' in data && Array.isArray(data.notificaciones)) {
          normalizedData = data.notificaciones;
        }
        setNotificaciones(normalizedData);

        if (normalizedData.some((n: Notificacion) => !n.leida)) {
          await axios.put(
            `${API_URL}/api/notificaciones/marcar-leidas`,
            {},
            { headers: { Authorization: `Bearer ${token}` } }
          );
          setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: 1 })));
        }
      } catch (err: any) {
        console.error('Error al cargar notificaciones:', err);
        setError(err.response?.data?.error || 'Error al obtener notificaciones');
      } finally {
        setLoading(false);
      }
    };
    fetchNotificaciones();
  }, []);

  const eliminar = async (id: number) => {
    try {
      const token = await SecureStore.getItemAsync('token');
      if (!token) {
        setError('Token de autenticación no encontrado');
        return;
      }

      await axios.delete(`${API_URL}/api/notificaciones/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotificaciones((prev) => prev.filter((n) => n.id !== id));
    } catch (err: any) {
      console.error('Error al eliminar notificación:', err);
      setError(err.response?.data?.error || 'Error al eliminar notificación');
    }
  };

  const unread = notificaciones.filter((n) => !n.leida);
  const read = notificaciones.filter((n) => n.leida);

  const renderNotificacion = ({ item }: { item: Notificacion }) => {
    const isUnread = !item.leida;
    return (
      <View
        style={[
          styles.card,
          { width: isTablet ? '80%' : '100%', alignSelf: 'center' },
          isUnread ? styles.unreadCard : styles.readCard,
        ]}
      >
        <View style={styles.cardContent}>
          <View style={styles.iconContainer}>
            <Ionicons
              name={isUnread ? 'notifications' : 'checkmark-circle'}
              size={24}
              color="#ffffff"
            />
          </View>
          <View style={styles.textContainer}>
            <Text style={[styles.messageText, isUnread ? styles.unreadText : styles.readText]}>
              {item.mensaje}
            </Text>
            <View style={styles.dateContainer}>
              <Ionicons name="time-outline" size={16} color="#6b7280" />
              <Text style={styles.dateText}>{formatDate(item.fecha)}</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => eliminar(item.id)}
            style={styles.deleteButton}
          >
            <Ionicons name="trash-outline" size={20} color="#6b7280" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <LinearGradient
        colors={['#f8fafc', '#e2e8f0']}
        style={styles.container}
      >
        <ActivityIndicator size="large" color="#4f46e5" />
      </LinearGradient>
    );
  }

  if (error) {
    return (
      <LinearGradient
        colors={['#f8fafc', '#e2e8f0']}
        style={styles.container}
      >
        <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
        <Text style={styles.errorTitle}>Error</Text>
        <Text style={styles.errorText}>{error}</Text>
      </LinearGradient>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={['#f8fafc', '#e2e8f0']}
        style={styles.container}
      >
        <View style={[styles.header, { paddingHorizontal: isTablet ? 32 : 16 }]}>
          <View style={styles.headerIcon}>
            <Ionicons name="notifications-outline" size={40} color="#ffffff" />
          </View>
          <Text style={styles.headerTitle}>Notificaciones</Text>
          <Text style={styles.headerSubtitle}>
            {notificaciones.length === 0
              ? 'No tienes notificaciones'
              : `${notificaciones.length} ${notificaciones.length === 1 ? 'notificación' : 'notificaciones'}`}
          </Text>
        </View>

        {notificaciones.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <Ionicons name="mail-open-outline" size={48} color="#94a3b8" />
            </View>
            <Text style={styles.emptyTitle}>¡Todo al día!</Text>
            <Text style={styles.emptyText}>No tienes notificaciones pendientes.</Text>
          </View>
        ) : (
          <FlatList
            data={notificaciones}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderNotificacion}
            contentContainerStyle={[styles.listContent, { paddingHorizontal: isTablet ? 32 : 16 }]}
            ListHeaderComponent={
              <>
                {unread.length > 0 && (
                  <View style={styles.sectionHeader}>
                    <View style={styles.unreadIndicator} />
                    <Text style={styles.sectionTitle}>Nuevas ({unread.length})</Text>
                  </View>
                )}
                {read.length > 0 && (
                  <View style={[styles.sectionHeader, { marginTop: unread.length > 0 ? 24 : 0 }]}>
                    <View style={styles.readIndicator} />
                    <Text style={styles.sectionTitle}>Anteriores ({read.length})</Text>
                  </View>
                )}
              </>
            }
          />
        )}
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
    paddingTop: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  headerIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4f46e5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#64748b',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  unreadIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10b981',
    marginRight: 8,
  },
  readIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#94a3b8',
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  unreadCard: {
    borderWidth: 1,
    borderColor: '#10b981',
  },
  readCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    opacity: 0.8,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#4f46e5', // Default for unread, overridden in read
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
  },
  messageText: {
    fontSize: 16,
    marginBottom: 8,
  },
  unreadText: {
    color: '#1e293b',
    fontWeight: '500',
  },
  readText: {
    color: '#475569',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 8,
  },
  deleteButton: {
    padding: 8,
    borderRadius: 999,
    backgroundColor: '#f1f5f9',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ef4444',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
  },
});