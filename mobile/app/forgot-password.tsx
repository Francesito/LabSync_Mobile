import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ImageBackground,
} from 'react-native';
import { router } from 'expo-router';
import axios from 'axios';
import { API_URL } from '../constants/api';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    try {
      const response = await axios.post(`${API_URL}/api/auth/forgot-password`, {
        correo_institucional: email,
      });
      setMessage(
        response.data.mensaje || 'Enlace de restablecimiento enviado a tu correo.'
      );
      setError('');
      setTimeout(() => router.replace('/login'), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al procesar la solicitud');
      setMessage('');
    }
  };

  return (
    <ImageBackground
      source={require('../assets/fondo1.png')}
      style={styles.container}
      resizeMode="cover"
    >
      <View style={styles.formContainer}>
        <Text style={styles.title}>Recuperar Contraseña</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.message}>{message}</Text> : null}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Correo Institucional</Text>
          <TextInput
            style={styles.input}
            placeholder="ejemplo@utsjr.edu.mx"
            placeholderTextColor="rgba(0,0,0,0.5)"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>
        <TouchableOpacity style={styles.submit} onPress={handleSubmit}>
          <Text style={styles.submitText}>Enviar Enlace</Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  formContainer: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: 24,
    borderRadius: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    color: '#000',
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    color: '#000',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.3)',
    padding: 12,
    borderRadius: 4,
    color: '#000',
  },
  submit: {
    backgroundColor: '#003579',
    padding: 12,
    borderRadius: 4,
  },
  submitText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 16,
  },
  error: {
    color: '#dc3545',
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    color: '#28a745',
    marginBottom: 16,
    textAlign: 'center',
  },
});