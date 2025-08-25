import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '@/constants/api';

interface Residuo {
  id: number;
  reactivo?: string;
}

export default function ResiduoScreen() {
  const [residuos, setResiduos] = useState<Residuo[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchResiduos = async () => {
      try {
        const token = await SecureStore.getItemAsync('token');
        const res = await axios.get(`${API_URL}/api/residuos`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = Array.isArray(res.data)
          ? res.data
          : res.data?.residuos || [];
        setResiduos(data);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Error al obtener residuos');
      }
    };

    fetchResiduos();
  }, []);

  return (
    <View style={styles.container}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={residuos}
        keyExtractor={(_item, index) => index.toString()}
        renderItem={({ item }) => (
          <Text style={styles.itemText}>{item.reactivo || `Residuo #${item.id}`}</Text>
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
