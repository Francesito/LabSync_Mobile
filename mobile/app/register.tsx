import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Link, router } from 'expo-router';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { API_URL } from '../constants/api';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [groups, setGroups] = useState<{ id: number; nombre: string }[]>([]);
  const [groupId, setGroupId] = useState('');
  const [loading, setLoading] = useState(false);

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
        setError(err.response?.data?.error || 'Error al cargar grupos');
      }
    };
    fetchGroups();
  }, []);

  const handleRegister = async () => {
    if (!groupId) {
      setError('Por favor selecciona tu grupo');
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
      alert('Usuario registrado. Verifica tu correo.');
      router.replace('/login');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al registrarse');
    } finally {
      setLoading(false);
    }
  };

  return (
   <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formContainer}>
            <View style={styles.header}>
              <Text style={styles.title}>Crear cuenta</Text>
              <Text style={styles.subtitle}>
                Completa los datos para crear tu cuenta en LabSync
              </Text>
            </View>

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
              <Text style={styles.label}>Nombre Completo</Text>
              <TextInput
                style={styles.input}
                placeholder="Ingresa tu nombre"
                placeholderTextColor="rgba(0,0,0,0.5)"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                editable={!loading}
              />
            </View>

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
                editable={!loading}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Contraseña</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Crea una contraseña"
                  placeholderTextColor="rgba(0,0,0,0.5)"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  editable={!loading}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                  disabled={loading}
                >
                  <Ionicons
                    name={showPassword ? 'eye' : 'eye-off'}
                    size={20}
                    color="rgba(0,0,0,0.7)"
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Selecciona tu Grupo</Text>
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
              {!groupId && (
                <Text style={styles.groupHint}>
                  * Selecciona el grupo al que perteneces
                </Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.submit, { opacity: loading ? 0.7 : 1 }]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitText}>Crear cuenta</Text>
              )}
            </TouchableOpacity>

          <View style={styles.loginContainer}>
              <Text style={styles.loginText}>¿Ya tienes cuenta? </Text>
              <Link href="/login" asChild>
                <TouchableOpacity>
                 <Text style={[styles.loginText, styles.linkText, { fontWeight: 'bold' }]}> 
                    Inicia sesión
                  </Text>
                </TouchableOpacity>
              </Link>
             </View>
          </View>
        </ScrollView>
        </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  formContainer: {
    width: '100%',
    maxWidth: Dimensions.get('window').width * 0.9, // 90% of screen width
    alignSelf: 'center',
    backgroundColor: '#fff',
    padding: 16,
  },
 header: {
    marginBottom: 24,
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
    width: '100%',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#000000',
    color: '#000',
    padding: 12,
    fontSize: 16,
    borderRadius: 4,
    width: '100%',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  eyeButton: {
    padding: 8,
    position: 'absolute',
    right: 8,
    top: '50%',
    transform: [{ translateY: -14 }],
  },
  groupContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
  },
  groupButton: {
    borderWidth: 2,
    borderColor: '#000000',
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 4,
     marginBottom: 8,
    flexBasis: '30%', // 3 buttons per row
    maxWidth: '30%',
    alignItems: 'center',
  },
  groupButtonActive: {
    backgroundColor: '#003579',
    borderColor: '#003579',
  },
  groupText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },
  groupTextActive: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  groupHint: {
    fontSize: 12,
    color: 'rgba(0,0,0,0.5)',
    marginTop: 8,
  },
  submit: {
    backgroundColor: '#003579',
    padding: 12,
    borderRadius: 4,
    alignItems: 'center',
    marginBottom: 24,
    width: '100%',
  },
  submitText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  loginText: {
    color: 'rgba(0,0,0,0.5)',
    fontSize: 14,
  },
  linkText: {
    color: '#000',
    fontSize: 14,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
});