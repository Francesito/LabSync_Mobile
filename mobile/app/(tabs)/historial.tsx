import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  ScrollView,
  useWindowDimensions,
  SafeAreaView,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../../lib/auth';

// Interfaces
interface User {
  rol_id: number;
  [key: string]: any;
}

interface HistorialItem {
  id: number;
  folio: string;
  nombre_display?: string;
  solicitante: string;
  encargado: string;
  fecha_recoleccion: string;
  fecha_devolucion: string;
  estado: string;
  materiales: string;
}

interface MovimientoItem {
  id: number;
  nombre_material: string;
  tipo: string;
  tipo_movimiento: string;
  cantidad: number;
  unidad: string;
  stock_actual: number;
  usuario: string;
  fecha_movimiento: string;
}

export default function HistorialScreen() {
  const { usuario } = useAuth() as { usuario: User | null };
  const [busqueda, setBusqueda] = useState('');
  const [historial, setHistorial] = useState<HistorialItem[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoItem[]>([]);
  const [vista, setVista] = useState<'solicitudes' | 'movimientos'>('solicitudes');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mostrarTodoSolicitudes, setMostrarTodoSolicitudes] = useState(false);
  const [mostrarTodoMovimientos, setMostrarTodoMovimientos] = useState(false);
  const { width } = useWindowDimensions();
  const isTablet = width > 600;
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://labsync-1090.onrender.com';

  const formatearFecha = (fecha: string | null): string => {
    if (!fecha) return '-';
    try {
      const [year, month, day] = fecha.split('T')[0].split('-');
      return `${day}/${month}/${year}`;
    } catch (e) {
      return '-';
    }
  };

  const getEstadoBadgeStyle = (estado: string) => {
    const styles = {
      pendiente: { backgroundColor: '#fefcbf', color: '#b45309' },
      aprobada: { backgroundColor: '#dbeafe', color: '#1e40af' },
      entregado: { backgroundColor: '#d1fae5', color: '#065f46' },
      'devuelto parcial': { backgroundColor: '#fed7aa', color: '#c2410c' },
      'devuelto total': { backgroundColor: '#f3f4f6', color: '#4b5563' },
      cancelado: { backgroundColor: '#fee2e2', color: '#991b1b' },
    };
    return styles[estado as keyof typeof styles] || { backgroundColor: '#f3f4f6', color: '#4b5563' };
  };

  const solicitudesMostradas = mostrarTodoSolicitudes ? historial : historial.slice(0, 8);
  const movimientosMostrados = mostrarTodoMovimientos ? movimientos : movimientos.slice(0, 8);

  useEffect(() => {
    if (!usuario || !usuario.rol_id || ![3, 4].includes(usuario.rol_id)) {
      setError('Acceso denegado. Solo administradores o almacenistas pueden ver el historial.');
      return;
    }

    const cargarDatos = async () => {
      try {
        setLoading(true);
        setError(null);

        const token = await SecureStore.getItemAsync('token');
        if (!token) {
          throw new Error('Token no encontrado');
        }

        const headers = { Authorization: `Bearer ${token}` };
        const params = new URLSearchParams();
        if (busqueda) params.append('busqueda', busqueda);
        const query = params.toString() ? `?${params.toString()}` : '';

        const solicitudesResponse = await fetch(
          `${baseUrl}/api/materials/solicitudes/historial${query}`,
          { headers }
        );
        const movimientosResponse = await fetch(
          `${baseUrl}/api/materials/historial-movimientos${query}`,
          { headers }
        );

        if (!solicitudesResponse.ok) {
          throw new Error(`Error al cargar solicitudes: ${solicitudesResponse.statusText}`);
        }
        if (!movimientosResponse.ok) {
          throw new Error(`Error al cargar movimientos: ${movimientosResponse.statusText}`);
        }

        const solicitudesData = await solicitudesResponse.json();
        const movimientosData = await movimientosResponse.json();

        const historialData = Array.isArray(solicitudesData.historial) ? solicitudesData.historial : [];
        const movimientosParsed = Array.isArray(movimientosData.movimientos)
          ? movimientosData.movimientos
          : Array.isArray(movimientosData)
          ? movimientosData
          : [];

        setHistorial(historialData);
        setMovimientos(movimientosParsed);
        setMostrarTodoSolicitudes(false);
        setMostrarTodoMovimientos(false);
      } catch (err: any) {
        console.error('Error al cargar datos del historial:', err);
        setError(err.message || 'Error al cargar datos. Por favor, verifica tu conexión.');
      } finally {
        setLoading(false);
      }
    };

    const handler = setTimeout(() => {
      cargarDatos();
    }, 300);

    return () => clearTimeout(handler);
  }, [usuario, busqueda, baseUrl]);

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Error</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!usuario || !usuario.rol_id || ![3, 4].includes(usuario.rol_id)) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Acceso Denegado</Text>
          <Text style={styles.errorText}>
            Solo administradores o almacenistas pueden ver el historial del sistema.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={[styles.title, { fontSize: isTablet ? 28 : 24 }]}>
            Historial del Sistema
          </Text>
          <Text style={[styles.subtitle, { fontSize: isTablet ? 14 : 12 }]}>
            {historial.length} solicitudes • {movimientos.length} movimientos
          </Text>
        </View>

        {/* Filtros */}
        <View style={styles.filterContainer}>
          <View style={styles.filterInputContainer}>
            <Text style={[styles.label, { fontSize: isTablet ? 14 : 12 }]}>Buscar</Text>
            <TextInput
              style={[
                styles.input,
                { fontSize: isTablet ? 14 : 12 },
                vista !== 'solicitudes' && styles.inputDisabled,
              ]}
              value={busqueda}
              onChangeText={setBusqueda}
              placeholder="Nombre o folio"
              editable={vista === 'solicitudes'}
            />
          </View>
          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={[
                styles.button,
                vista === 'solicitudes' ? styles.buttonActive : styles.buttonInactive,
              ]}
              onPress={() => setVista('solicitudes')}
            >
              <Text
                style={[
                  styles.buttonText,
                  vista === 'solicitudes' ? styles.buttonTextActive : styles.buttonTextInactive,
                ]}
              >
                Solicitudes
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                vista === 'movimientos' ? styles.buttonActive : styles.buttonInactive,
              ]}
              onPress={() => setVista('movimientos')}
            >
              <Text
                style={[
                  styles.buttonText,
                  vista === 'movimientos' ? styles.buttonTextActive : styles.buttonTextInactive,
                ]}
              >
                Movimientos de Inventario
              </Text>
            </TouchableOpacity>
          </View>
          {busqueda && (
            <TouchableOpacity style={styles.clearButton} onPress={() => setBusqueda('')}>
              <Text style={[styles.clearButtonText, { fontSize: isTablet ? 14 : 12 }]}>
                Limpiar filtro
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#00BCD4" style={styles.loading} />
        ) : (
          <View style={styles.content}>
            {vista === 'solicitudes' ? (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardTitle, { fontSize: isTablet ? 18 : 16 }]}>
                    Historial de Solicitudes
                  </Text>
                  <Text style={[styles.cardSubtitle, { fontSize: isTablet ? 14 : 12 }]}>
                    {historial.length} solicitudes encontradas
                  </Text>
                </View>
                <ScrollView horizontal>
                  <FlatList
                    data={solicitudesMostradas}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item }) => (
                      <View style={styles.tableRow}>
                        <Text
                          key="folio"
                          style={[styles.tableCell, { minWidth: width * 0.15 }]}
                        >
                          {item.folio}
                        </Text>
                        <Text
                          key="solicitante"
                          style={[styles.tableCell, { minWidth: width * 0.25 }]}
                        >
                          {item.nombre_display || item.solicitante}
                        </Text>
                        <Text
                          key="encargado"
                          style={[styles.tableCell, { minWidth: width * 0.25 }]}
                        >
                          {item.encargado}
                        </Text>
                        <Text
                          key="recoleccion"
                          style={[styles.tableCell, { minWidth: width * 0.2 }]}
                        >
                          {formatearFecha(item.fecha_recoleccion)}
                        </Text>
                        <Text
                          key="devolucion"
                          style={[styles.tableCell, { minWidth: width * 0.2 }]}
                        >
                          {formatearFecha(item.fecha_devolucion)}
                        </Text>
                        <View
                          key="estado"
                          style={[styles.tableCell, { minWidth: width * 0.2 }]}
                        >
                          <View style={[styles.badge, getEstadoBadgeStyle(item.estado)]}>
                            <Text style={styles.badgeText}>{item.estado}</Text>
                          </View>
                        </View>
                        <Text
                          key="materiales"
                          style={[styles.tableCell, { minWidth: width * 0.3 }]}
                          numberOfLines={2}
                        >
                          {item.materiales || 'Sin materiales'}
                        </Text>
                      </View>
                    )}
                    ListHeaderComponent={() => (
                      <View style={styles.tableHeader}>
                        <Text
                          key="folio"
                          style={[styles.tableHeaderCell, { minWidth: width * 0.15 }]}
                        >
                          Folio
                        </Text>
                        <Text
                          key="solicitante"
                          style={[styles.tableHeaderCell, { minWidth: width * 0.25 }]}
                        >
                          Solicitante
                        </Text>
                        <Text
                          key="encargado"
                          style={[styles.tableHeaderCell, { minWidth: width * 0.25 }]}
                        >
                          Encargado
                        </Text>
                        <Text
                          key="recoleccion"
                          style={[styles.tableHeaderCell, { minWidth: width * 0.2 }]}
                        >
                          Recolección
                        </Text>
                        <Text
                          key="devolucion"
                          style={[styles.tableHeaderCell, { minWidth: width * 0.2 }]}
                        >
                          Devolución
                        </Text>
                        <Text
                          key="estado"
                          style={[styles.tableHeaderCell, { minWidth: width * 0.2 }]}
                        >
                          Estado
                        </Text>
                        <Text
                          key="materiales"
                          style={[styles.tableHeaderCell, { minWidth: width * 0.3 }]}
                        >
                          Materiales
                        </Text>
                      </View>
                    )}
                    ListEmptyComponent={() => (
                      <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No se encontraron solicitudes</Text>
                      </View>
                    )}
                  />
                </ScrollView>
                {!mostrarTodoSolicitudes && historial.length > 8 && (
                  <TouchableOpacity
                    style={styles.showMore}
                    onPress={() => setMostrarTodoSolicitudes(true)}
                  >
                    <Text style={[styles.showMoreText, { fontSize: isTablet ? 14 : 12 }]}>
                      Mostrar más
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardTitle, { fontSize: isTablet ? 18 : 16 }]}>
                    Movimientos de Inventario
                  </Text>
                  <Text style={[styles.cardSubtitle, { fontSize: isTablet ? 14 : 12 }]}>
                    {movimientos.length} movimientos registrados
                  </Text>
                </View>
                <ScrollView horizontal>
                  <FlatList
                    data={movimientosMostrados}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item }) => (
                      <View style={styles.tableRow}>
                        <Text
                          key="material"
                          style={[styles.tableCell, { minWidth: width * 0.25 }]}
                        >
                          {item.nombre_material || 'Material Desconocido'}
                        </Text>
                        <Text
                          key="tipo"
                          style={[styles.tableCell, { minWidth: width * 0.15, textTransform: 'capitalize' }]}
                        >
                          {item.tipo}
                        </Text>
                        <Text
                          key="movimiento"
                          style={[styles.tableCell, { minWidth: width * 0.2, textTransform: 'capitalize' }]}
                        >
                          {item.tipo_movimiento}
                        </Text>
                        <Text
                          key="cantidad"
                          style={[
                            styles.tableCell,
                            { minWidth: width * 0.15, color: item.cantidad > 0 ? '#16a34a' : '#dc2626' },
                          ]}
                        >
                          {item.cantidad > 0 ? '+' : ''}{item.cantidad} {item.unidad}
                        </Text>
                        <Text
                          key="stock"
                          style={[styles.tableCell, { minWidth: width * 0.15 }]}
                        >
                          {item.stock_actual} {item.unidad}
                        </Text>
                        <Text
                          key="usuario"
                          style={[styles.tableCell, { minWidth: width * 0.25 }]}
                        >
                          {item.usuario || 'Sistema'}
                        </Text>
                        <Text
                          key="fecha"
                          style={[styles.tableCell, { minWidth: width * 0.2 }]}
                        >
                          {formatearFecha(item.fecha_movimiento)}
                        </Text>
                      </View>
                    )}
                    ListHeaderComponent={() => (
                      <View style={styles.tableHeader}>
                        <Text
                          key="material"
                          style={[styles.tableHeaderCell, { minWidth: width * 0.25 }]}
                        >
                          Material
                        </Text>
                        <Text
                          key="tipo"
                          style={[styles.tableHeaderCell, { minWidth: width * 0.15 }]}
                        >
                          Tipo
                        </Text>
                        <Text
                          key="movimiento"
                          style={[styles.tableHeaderCell, { minWidth: width * 0.2 }]}
                        >
                          Movimiento
                        </Text>
                        <Text
                          key="cantidad"
                          style={[styles.tableHeaderCell, { minWidth: width * 0.15 }]}
                        >
                          Cantidad
                        </Text>
                        <Text
                          key="stock"
                          style={[styles.tableHeaderCell, { minWidth: width * 0.15 }]}
                        >
                          Stock Actual
                        </Text>
                        <Text
                          key="usuario"
                          style={[styles.tableHeaderCell, { minWidth: width * 0.25 }]}
                        >
                          Usuario
                        </Text>
                        <Text
                          key="fecha"
                          style={[styles.tableHeaderCell, { minWidth: width * 0.2 }]}
                        >
                          Fecha
                        </Text>
                      </View>
                    )}
                    ListEmptyComponent={() => (
                      <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No se encontraron movimientos</Text>
                      </View>
                    )}
                  />
                </ScrollView>
                {!mostrarTodoMovimientos && movimientos.length > 8 && (
                  <TouchableOpacity
                    style={styles.showMore}
                    onPress={() => setMostrarTodoMovimientos(true)}
                  >
                    <Text style={[styles.showMoreText, { fontSize: isTablet ? 14 : 12 }]}>
                      Mostrar más
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f9fafb', // bg-gray-50
  },
  container: {
    padding: 24,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
    flexWrap: 'wrap',
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827', // text-gray-900
  },
  subtitle: {
    fontSize: 12,
    color: '#4b5563', // text-gray-600
  },
  filterContainer: {
    backgroundColor: '#ffffff', // bg-white
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb', // border-gray-200
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  filterInputContainer: {
    marginRight: 16,
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151', // text-gray-700
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db', // border-gray-300
    borderRadius: 4,
    padding: 8,
    fontSize: 12,
    backgroundColor: '#ffffff',
  },
  inputDisabled: {
    backgroundColor: '#f3f4f6', // disabled:bg-gray-100
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  buttonActive: {
    backgroundColor: '#3b82f6', // bg-blue-500
  },
  buttonInactive: {
    backgroundColor: '#e5e7eb', // bg-gray-200
  },
  buttonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  buttonTextActive: {
    color: '#ffffff', // text-white
  },
  buttonTextInactive: {
    color: '#374151', // text-gray-700
  },
  clearButton: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#f3f4f6', // bg-gray-100
    borderRadius: 4,
    marginLeft: 12,
  },
  clearButtonText: {
    color: '#374151', // text-gray-700
    fontSize: 12,
  },
  content: {
    flex: 1,
    gap: 24,
  },
  card: {
    backgroundColor: '#ffffff', // bg-white
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb', // border-gray-200
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 24,
  },
  cardHeader: {
    padding: 16,
    backgroundColor: '#00BCD4',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb', // border-gray-200
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff', // text-white
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#e5e7eb', // text-gray-200
    marginTop: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#00BCD4',
    padding: 16,
  },
  tableHeaderCell: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff', // text-white
    textAlign: 'center',
    padding: 12,
  },
  tableRow: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb', // divide-gray-200
    backgroundColor: '#ffffff', // bg-white
  },
  tableCell: {
    fontSize: 12,
    color: '#374151', // text-gray-900
    textAlign: 'center',
    padding: 12,
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12,
    color: '#6b7280', // text-gray-500
    textAlign: 'center',
  },
  showMore: {
    padding: 16,
    backgroundColor: '#f9fafb', // bg-gray-50
    alignItems: 'center',
  },
  showMoreText: {
    fontSize: 12,
    color: '#2563eb', // text-blue-600
    textDecorationLine: 'underline',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fef2f2', // bg-red-50
    borderWidth: 1,
    borderColor: '#fecaca', // border-red-200
    borderRadius: 8,
    margin: 16,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#991b1b', // text-red-800
  },
  errorText: {
    fontSize: 12,
    color: '#b91c1c', // text-red-700
    marginTop: 4,
    textAlign: 'center',
  },
  loading: {
    marginVertical: 32,
  },
});