import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '@/constants/api';

interface Adeudo {
  id: number;
  nombre_material?: string;
  fecha_entrega?: string;
}

export default function AdeudosScreen() {
  const [adeudos, setAdeudos] = useState<Adeudo[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAdeudos = async () => {
      try {
        const token = await SecureStore.getItemAsync('token');
        const res = await axios.get(`${API_URL}/api/materials/adeudos`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = Array.isArray(res.data) ? res.data : res.data?.adeudos || [];
        setAdeudos(data);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Error al obtener adeudos');
      }
    };
    fetchAdeudos();
  }, []);

  return (
    <View style={styles.container}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={adeudos}
        keyExtractor={(_item, index) => index.toString()}
        renderItem={({ item }) => (
          <Text style={styles.itemText}>
            {item.nombre_material || `Adeudo #${item.id}`}
            {item.fecha_entrega ? ` - entrega: ${item.fecha_entrega}` : ''}
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