import { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, TouchableOpacity } from 'react-native';
import { Link, router } from 'expo-router';
import axios from 'axios';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleRegister = async () => {
    try {
      await axios.post(`${process.env.EXPO_PUBLIC_API_URL}/api/auth/register`, {
        nombre: name,
        correo_institucional: email,
        contrasena: password,
      });
      router.replace('/login');
    } catch {
      setError('Error al registrarse');
    }
  };

  return (
    <View style={styles.container}>
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
      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Button title="Crear cuenta" onPress={handleRegister} />
      <Link href="/login" asChild>
        <TouchableOpacity style={styles.link}>
          <Text style={styles.linkText}>Ya tengo cuenta</Text>
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
  link: { marginTop: 16 },
  linkText: { textAlign: 'center', color: '#0645AD' },
});