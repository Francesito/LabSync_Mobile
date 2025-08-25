import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '@/constants/api';

interface Notificacion {
  id: number;
  mensaje?: string;
  leida?: number;
}

export default function NotificacionesScreen() {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchNotificaciones = async () => {
      try {
        const token = await SecureStore.getItemAsync('token');
        if (!token) return;
        const { data } = await axios.get(`${API_URL}/api/notificaciones`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setNotificaciones(Array.isArray(data) ? data : data?.notificaciones || []);
        if (data.some && data.some((n: any) => !n.leida)) {
          await axios.put(
            `${API_URL}/api/notificaciones/marcar-leidas`,
            {},
            { headers: { Authorization: `Bearer ${token}` } }
          );
          setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: 1 })));
        }
      } catch (err: any) {
        setError(err.response?.data?.error || 'Error al obtener notificaciones');
      }
    };
    fetchNotificaciones();
  }, []);

  return (
    <View style={styles.container}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={notificaciones}
        keyExtractor={(_item, index) => index.toString()}
        renderItem={({ item }) => (
          <Text style={styles.itemText}>
            {item.mensaje || `Notificación #${item.id}`}
          </Text>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  itemText: { color: '#000', marginBottom: 8 },
  error: { color: 'red', marginBottom: 8 },
});