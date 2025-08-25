import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export default function ReportesScreen() {
  const [roleId, setRoleId] = useState<number | null>(null);

  useEffect(() => {
    const loadRole = async () => {
      const userStr = await SecureStore.getItemAsync('usuario');
      if (userStr) {
        try {
          const parsed = JSON.parse(userStr);
          setRoleId(parsed.rol_id);
        } catch {
          setRoleId(null);
        }
      } else {
        setRoleId(null);
      }
    };
    loadRole();
  }, []);

  if (roleId === null) return null;
  if (![3, 4].includes(roleId)) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>Acceso denegado</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Reportes</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  text: { color: '#000' },
  error: { color: 'red' },
});