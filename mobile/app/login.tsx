import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Link, router } from 'expo-router';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    try {
      const response = await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/api/auth/login`,
        {
          correo_institucional: email,
          contrasena: password,
        }
      );
      await SecureStore.setItemAsync('token', response.data.token);
      await SecureStore.setItemAsync('nombre', response.data.nombre);
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(
        err.response?.data?.error || 'Error al iniciar sesión'
      );
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Inicia Sesión</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
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
      <TouchableOpacity style={styles.submit} onPress={handleLogin}>
        <Text style={styles.submitText}>Entrar</Text>
      </TouchableOpacity>
      <Link href="/register" asChild>
        <TouchableOpacity style={styles.link}>
          <Text style={styles.linkText}>Crear cuenta</Text>
        </TouchableOpacity>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 16 },
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
  submit: {
    backgroundColor: '#003579',
    padding: 12,
    borderRadius: 4,
  },
  submitText: { color: '#fff', textAlign: 'center', fontWeight: '600' },
  link: { marginTop: 16 },
  linkText: { textAlign: 'center', color: '#0645AD' },
});