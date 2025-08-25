import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Link, router } from 'expo-router';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [groups, setGroups] = useState<{ id: number; nombre: string }[]>([]);
  const [groupId, setGroupId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const API_URL =
    process.env.EXPO_PUBLIC_API_URL ||
    Constants.expoConfig?.extra?.API_URL ||
    '';

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/auth/grupos`);
        const data = Array.isArray(response.data)
          ? response.data
          : response.data?.grupos || [];
        setGroups(data);
      } catch (err: any) {
        console.error('Error fetching groups', err);
        setError(
          err.response?.data?.error || 'Error al cargar grupos'
        );
      }
    };
    fetchGroups();
  }, [API_URL]);

  const handleRegister = async () => {
    if (!groupId) {
      setError('Selecciona tu grupo');
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/auth/register`, {
        nombre: name,
        correo_institucional: email,
        contrasena: password,
        grupo_id: parseInt(groupId),
        rol: 'alumno',
      });
      router.replace('/login');
    } catch (err: any) {
      setError(
        err.response?.data?.error || 'Error al registrarse'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Regístrate</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TextInput
        style={styles.input}
        placeholder="Nombre"
        value={name}
        onChangeText={setName}
      />
      <TextInput
        style={styles.input}
        placeholder="Correo"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <View style={styles.passwordContainer}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="Contraseña"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
        />
        <TouchableOpacity
          onPress={() => setShowPassword(!showPassword)}
          style={styles.eyeButton}
        >
          <Ionicons
            name={showPassword ? 'eye' : 'eye-off'}
            size={20}
            color="grey"
          />
        </TouchableOpacity>
      </View>
      <Text style={styles.groupLabel}>Selecciona tu grupo</Text>
      <View style={styles.groupContainer}>
        {groups.map((g) => (
          <TouchableOpacity
            key={g.id}
            style={[
              styles.groupButton,
              groupId === g.id.toString() && styles.groupButtonActive,
            ]}
            onPress={() => setGroupId(g.id.toString())}
            disabled={loading}
          >
            <Text
              style={
                groupId === g.id.toString()
                  ? styles.groupTextActive
                  : styles.groupText
              }
            >
              {g.nombre}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity
        style={styles.submit}
        onPress={handleRegister}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>Crear cuenta</Text>
        )}
      </TouchableOpacity>
      <Link href="/login" asChild>
        <TouchableOpacity style={styles.link}>
          <Text style={styles.linkText}>Ya tengo cuenta</Text>
        </TouchableOpacity>
      </Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, flexGrow: 1, justifyContent: 'center' },
  title: { fontSize: 24, marginBottom: 16, textAlign: 'center' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 12,
    borderRadius: 4,
  },
  error: { color: 'red', marginBottom: 12, textAlign: 'center' },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  eyeButton: { padding: 8 },
  groupLabel: { marginBottom: 8, fontWeight: '600' },
  groupContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
    justifyContent: 'center',
  },
  groupButton: {
    borderWidth: 1,
    borderColor: '#000',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    margin: 4,
  },
  groupButtonActive: {
    backgroundColor: '#003579',
    borderColor: '#003579',
  },
  groupText: { color: '#000' },
  groupTextActive: { color: '#fff' },
  submit: {
    backgroundColor: '#003579',
    padding: 12,
    borderRadius: 4,
    alignItems: 'center',
  },
  submitText: { color: '#fff', fontWeight: '600' },
  link: { marginTop: 16 },
  linkText: { textAlign: 'center', color: '#0645AD' },
});