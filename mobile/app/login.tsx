import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
// eslint-disable-next-line import/no-unresolved
import { SvgXml } from 'react-native-svg';
import { Link, router } from 'expo-router';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../constants/api';
import { wolfSvg } from '../constants/wolfSvg';
import { LinearGradient } from 'expo-linear-gradient';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, {
        correo_institucional: email,
        contrasena: password,
      });
      await SecureStore.setItemAsync('token', response.data.token);
       // El backend devuelve la información del usuario dentro de `usuario`
      const nombre = response.data.usuario?.nombre || '';
      await SecureStore.setItemAsync('nombre', nombre);
      // Guardamos el objeto completo del usuario para futuras consultas
     const user = response.data.usuario;
      if (user && !user.rol && user.rol_id) {
        const map: Record<number, string> = {
          1: 'alumno',
          2: 'docente',
          3: 'almacen',
          4: 'administrador',
        };
        user.rol = map[user.rol_id] ?? user.rol;
      }
      await SecureStore.setItemAsync('usuario', JSON.stringify(user));
      router.replace('/(tabs)/catalogo');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al iniciar sesión');
    }
  };

  return (
     <View style={styles.container}>
     <LinearGradient
        colors={['rgba(0,53,121,0.8)', 'transparent']}
        style={styles.gradientTop}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,53,121,0.8)']}
        style={styles.gradientBottom}
        pointerEvents="none"
      />
      <View style={styles.formContainer}>
       <SvgXml xml={wolfSvg} width={100} height={150} style={styles.logo} />
        <Text style={styles.title}>Inicia Sesión</Text>
        <Text style={styles.subtitle}>
          Introduce tus credenciales para ingresar a tu cuenta.
        </Text>

        {error ? (
          <View style={styles.errorContainer}>
            <Ionicons
              name="alert-circle"
              size={20}
              color="#dc3545"
              style={styles.errorIcon}
            />
            <Text style={styles.error}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Correo Electrónico</Text>
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

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Contraseña</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Ingresa tu contraseña"
              placeholderTextColor="rgba(0,0,0,0.5)"
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
                color="rgba(0,0,0,0.7)"
              />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.submit} onPress={handleLogin}>
          <Text style={styles.submitText}>Iniciar Sesión</Text>
        </TouchableOpacity>

        <Link href="/forgot-password" asChild>
          <TouchableOpacity style={styles.link}>
            <Text style={styles.linkText}>¿Olvidaste tu contraseña?</Text>
          </TouchableOpacity>
        </Link>

       <View style={styles.registerContainer}>
          <Text style={styles.registerText}>¿No tienes cuenta? </Text>
          <Link href="/register" asChild>
            <TouchableOpacity>
               <Text style={[styles.registerText, styles.linkText, { fontWeight: 'bold' }]}>Regístrate</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
     </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
      backgroundColor: '#fff',
  },
  formContainer: {
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
    paddingVertical: 24,
  },
   logo: {
    alignSelf: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
     color: '#003579',
    marginBottom: 4,
    textAlign: 'left',
  },
  subtitle: {
    fontSize: 14,
    color: '#003579',
    marginBottom: 24,
    textAlign: 'left',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8d7da',
    padding: 10,
    borderRadius: 4,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  errorIcon: {
    marginRight: 8,
  },
  error: {
    color: '#dc3545',
    fontSize: 14,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.3)',
    color: '#000',
    padding: 12,
    fontSize: 16,
    borderRadius: 4,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eyeButton: {
    padding: 8,
    position: 'absolute',
    right: 8,
    top: '50%',
    transform: [{ translateY: -14 }],
  },
  submit: {
    backgroundColor: '#003579',
    padding: 12,
    borderRadius: 4,
    marginBottom: 24,
  },
  submitText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 16,
  },
  link: {
    marginBottom: 24,
  },
  linkText: {
    color: '#000',
    fontSize: 14,
  },
  registerText: {
    color: 'rgba(0,0,0,0.5)',
    fontSize: 14,
  },
    registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
 gradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  gradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
  },
});