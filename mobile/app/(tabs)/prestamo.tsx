import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '@/constants/api';

interface Prestamo {
  id: number;
  descripcion?: string;
}

export default function PrestamoScreen() {
  const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchPrestamos = async () => {
      try {
        const token = await SecureStore.getItemAsync('token');
        const res = await axios.get(`${API_URL}/api/prestamos`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = Array.isArray(res.data)
          ? res.data
          : res.data?.prestamos || [];
        setPrestamos(data);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Error al obtener préstamos');
      }
    };

    fetchPrestamos();
  }, []);

  return (
    <View style={styles.container}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={prestamos}
        keyExtractor={(_item, index) => index.toString()}
        renderItem={({ item }) => (
          <Text style={styles.itemText}>{item.descripcion || `Préstamo #${item.id}`}</Text>
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