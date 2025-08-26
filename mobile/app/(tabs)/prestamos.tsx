import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { obtenerPrestamosEntregados, obtenerDetalleSolicitud, registrarDevolucion, informarPrestamoVencido, obtenerGrupos } from '@/lib/api';

// Get window dimensions for responsive design
const window = Dimensions.get('window');
const isTablet = window.width >= 600; // Consider screens >= 600px as tablets

// Interfaces for TypeScript type safety
interface Prestamo {
  solicitud_id: number;
  folio: string;
  nombre_alumno?: string;
  profesor?: string;
  fecha_devolucion?: string;
  grupo?: string;
}

interface Detalle {
  solicitud_id: number;
  folio: string;
  nombre_alumno?: string;
  profesor?: string;
  fecha_recoleccion?: string;
  items: DetalleItem[];
}

interface DetalleItem {
  item_id: number;
  nombre_material: string;
  cantidad: number;
  tipo: 'liquido' | 'solido' | 'otro';
  devolver: number;
  entregado: boolean;
}

interface Grupo {
  nombre: string;
}

// Utility functions
const parseDate = (str: string | undefined): Date | null => {
  if (!str) return null;
  const [y, m, d] = str.split('T')[0].split('-');
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return isNaN(date.getTime()) ? null : date;
};

const formatDate = (str: string | undefined): string => {
  const date = parseDate(str);
  return date ? date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Sin fecha';
};

const isOverdue = (str: string | undefined): boolean => {
  const date = parseDate(str);
  if (!date) return false;
  const today = new Date();
  return date < new Date(today.getFullYear(), today.getMonth(), today.getDate());
};

const formatMaterialName = (name: string | undefined): string => {
  if (!name) return '';
  return name.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
};

export default function PrestamosScreen() {
  const { usuario, loading: authLoading } = useAuth();
  const router = useRouter();
  const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'vencidas' | 'proximas' | ''>('');
  const [groupFilter, setGroupFilter] = useState('');
  const [groups, setGroups] = useState<string[]>([]);
    const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  const [informados, setInformados] = useState<number[]>([]);
  const [selectedSolicitud, setSelectedSolicitud] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);


  // Load prestamos and groups on mount
  useEffect(() => {
    console.log('Cargando PrestamosScreen');
    console.log('Usuario:', usuario);
    console.log('Rol:', usuario?.rol);
    console.log('authLoading:', authLoading);
    if (authLoading) return;
    if (!usuario) {
      setError('Inicia sesión para ver préstamos');
      console.log('Redirigiendo a /login: usuario no encontrado');
      router.replace('/login');
      return;
    }
    if (usuario.rol !== 'almacen') {
      setError('Acceso restringido a almacenistas');
      console.log('Redirigiendo a /login: rol no es almacen');
      router.replace('/login');
      return;
    }
    console.log('Llamando a loadPrestamos');
    loadPrestamos();
  }, [usuario, authLoading]);

  const loadPrestamos = async (): Promise<Prestamo[]> => {
    console.log('Iniciando loadPrestamos');
    setLoading(true);
    try {
      const data = await obtenerPrestamosEntregados();
      console.log('Datos de préstamos obtenidos:', data);
      const grouped = Object.values(
        data.reduce((acc: { [key: number]: Prestamo }, item) => {
          if (!acc[item.solicitud_id]) {
            acc[item.solicitud_id] = {
              solicitud_id: item.solicitud_id,
              folio: item.folio,
              nombre_alumno: item.nombre_alumno,
              profesor: item.profesor,
              fecha_devolucion: item.fecha_devolucion,
              grupo: item.grupo_nombre,
            };
          }
          return acc;
        }, {})
      );
      console.log('Préstamos agrupados:', grouped);
      setPrestamos(grouped);
      const gruposDB = await obtenerGrupos();
      console.log('Grupos obtenidos:', gruposDB);
      setGroups(gruposDB.map((g) => g.nombre));
      return grouped;
    } catch (err: any) {
      console.error('Error en loadPrestamos:', err);
      console.log('Detalles del error:', {
        message: err.message,
        status: err.response?.status,
        data: err.response?.data,
        url: err.config?.url,
      });
      setError(
        err.response?.status === 404
          ? 'La ruta de la API no se encuentra. Verifica la configuración del servidor.'
          : err.response?.data?.error || 'No se pudieron cargar los préstamos entregados'
      );
      return [];
    } finally {
      console.log('Finalizando loadPrestamos');
      setLoading(false);
    }
  };

  const onRefresh = async () => {
  console.log('Usuario hizo pull-to-refresh');
  setRefreshing(true);
  await loadPrestamos();
  setRefreshing(false);
};


  // Filter and sort prestamos
  const filtered = prestamos
    .filter(
      (p) =>
        p.folio.toLowerCase().includes(filter.toLowerCase()) ||
        (p.nombre_alumno || p.profesor || '').toLowerCase().includes(filter.toLowerCase())
    )
    .filter((p) => (groupFilter ? p.grupo === groupFilter : true))
    .filter((p) => {
      if (statusFilter === 'vencidas') return isOverdue(p.fecha_devolucion);
      return true;
    });

  const sorted =
    statusFilter === 'proximas'
      ? [...filtered].sort((a, b) => (parseDate(a.fecha_devolucion)?.getTime() || 0) - (parseDate(b.fecha_devolucion)?.getTime() || 0))
      : filtered;

  const resetFilters = () => {
    console.log('Restableciendo filtros');
    setFilter('');
    setStatusFilter('');
    setGroupFilter('');
    setShowGroupDropdown(false);
  };

  const openModal = async (solicitud_id: number) => {
    console.log('Abriendo modal para solicitud:', solicitud_id);
    setSelectedSolicitud(solicitud_id);
    setShowModal(true);
    setDetalle(null);
    try {
      const det = await obtenerDetalleSolicitud(solicitud_id);
      console.log('Detalle cargado:', det);
      det.items = det.items.map((i: DetalleItem) => ({ ...i, devolver: 0, entregado: false }));
      setDetalle(det);
    } catch (err: any) {
      console.error('Error en openModal:', err);
      setError(err.response?.data?.error || 'No se pudo obtener el detalle del préstamo');
      closeModal();
    }
  };

  const closeModal = () => {
    console.log('Cerrando modal');
    setShowModal(false);
    setDetalle(null);
    setSelectedSolicitud(null);
  };

  const handleInformar = async (id: number) => {
    console.log('Iniciando handleInformar para solicitud:', id);
    try {
      await informarPrestamoVencido(id);
      setInformados((prev) => [...prev, id]);
      Alert.alert('Éxito', 'Notificación enviada');
      console.log('Notificación enviada exitosamente');
    } catch (err: any) {
      console.error('Error en handleInformar:', err);
      setError(err.response?.data?.error || 'No se pudo enviar la notificación');
    }
  };

  const handleSave = async () => {
    if (!detalle || !selectedSolicitud) {
      console.log('handleSave: detalle o selectedSolicitud no están definidos');
      return;
    }
    console.log('Iniciando handleSave para solicitud:', selectedSolicitud);
    setSaving(true);
    try {
      const esAlumno = !!detalle.nombre_alumno;
      const devoluciones = detalle.items
        .filter((item) => (esAlumno ? item.devolver > 0 : item.entregado))
        .map((item) => ({
          item_id: item.item_id,
          cantidad_devuelta: esAlumno ? item.devolver : item.entregado ? item.cantidad : 0,
        }));

      console.log('Devoluciones a registrar:', devoluciones);
      if (devoluciones.length === 0) {
        console.log('No hay devoluciones para registrar');
        setSaving(false);
        return;
      }

      await registrarDevolucion(selectedSolicitud, devoluciones);
      console.log('Devolución registrada, recargando préstamos');
      const grouped = await loadPrestamos();
      console.log('Préstamos recargados:', grouped);
      if (!grouped.some((g) => g.solicitud_id === selectedSolicitud)) {
        console.log('Solicitud ya no existe, cerrando modal');
        closeModal();
        return;
      }

      const nuevoDetalle = await obtenerDetalleSolicitud(selectedSolicitud);
      console.log('Nuevo detalle cargado:', nuevoDetalle);
      nuevoDetalle.items = nuevoDetalle.items.map((i: DetalleItem) => ({
        ...i,
        devolver: 0,
        entregado: false,
      }));
      if (nuevoDetalle.items.length === 0) {
        console.log('No hay más items, cerrando modal');
        closeModal();
        return;
      }
      setDetalle(nuevoDetalle);
      console.log('Detalle actualizado:', nuevoDetalle);
    } catch (err: any) {
      console.error('Error en handleSave:', err);
      setError(err.response?.data?.error || 'No se pudo guardar la devolución');
    } finally {
      console.log('Finalizando handleSave');
      setSaving(false);
    }
  };

  const renderPrestamoCard = ({ item: sol }: { item: Prestamo }) => {
    const overdue = isOverdue(sol.fecha_devolucion);
    const nombre = sol.nombre_alumno || sol.profesor || 'Sin nombre';

    return (
      <TouchableOpacity
        style={[styles.card, overdue && styles.cardOverdue]}
        onPress={() => openModal(sol.solicitud_id)}
        activeOpacity={0.8}
      >
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIcon}>
              <Ionicons name="document-text-outline" size={isTablet ? 24 : 20} color="#fff" />
            </View>
            <Ionicons name="chevron-forward" size={isTablet ? 20 : 16} color="#94a3b8" />
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {sol.folio}
            </Text>
            <View style={styles.cardRow}>
              <Ionicons name="person-outline" size={isTablet ? 16 : 14} color="#475569" />
              <Text style={styles.cardText} numberOfLines={1}>
                {nombre}
              </Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.cardText}>
                Devolver: {formatDate(sol.fecha_devolucion)}
              </Text>
            </View>
            {overdue && (
              <View style={styles.overdueContainer}>
                <View style={styles.overdueBadge}>
                  <Text style={styles.overdueText}>⚠️ Vencido</Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.informButton,
                    informados.includes(sol.solicitud_id) && styles.informButtonDisabled,
                  ]}
                  onPress={() => handleInformar(sol.solicitud_id)}
                  disabled={informados.includes(sol.solicitud_id)}
                >
                  <Text style={styles.informButtonText}>
                    {informados.includes(sol.solicitud_id) ? 'Informado' : 'Informar'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderModalItem = (item: DetalleItem) => {
    const esAlumno = !!detalle?.nombre_alumno;
    return (
      <View key={item.item_id} style={styles.modalItem}>
        <View style={styles.modalItemContent}>
          <View style={styles.modalItemIcon}>
            <Ionicons name="flask-outline" size={isTablet ? 16 : 14} color="#475569" />
          </View>
          <View style={styles.modalItemInfo}>
            <Text style={styles.modalItemName} numberOfLines={1}>
              {formatMaterialName(item.nombre_material)}
            </Text>
            <View style={styles.modalItemRow}>
              <Text style={styles.modalItemText}>
                {item.cantidad}
              </Text>
              <View style={styles.modalItemUnit}>
                <Text style={styles.modalItemUnitText}>
                  {item.tipo === 'liquido' ? 'ml' : item.tipo === 'solido' ? 'g' : 'u'}
                </Text>
              </View>
            </View>
          </View>
        </View>
        {esAlumno ? (
          <View style={styles.modalItemInput}>
            <Text style={styles.modalItemLabel}>Devolver</Text>
            <TextInput
              style={styles.modalItemNumberInput}
              keyboardType="numeric"
              value={item.devolver.toString()}
              onChangeText={(text) => {
                const val = parseInt(text || '0', 10);
                item.devolver = Math.min(Math.max(val, 0), item.cantidad);
                setDetalle({ ...detalle! });
              }}
            />
            <Text style={styles.modalItemMax}>/{item.cantidad}</Text>
          </View>
        ) : (
          <View style={styles.modalItemInput}>
            <Text style={styles.modalItemLabel}>Entregado</Text>
            <TouchableOpacity
              onPress={() => {
                item.entregado = !item.entregado;
                setDetalle({ ...detalle! });
              }}
            >
              <Ionicons
                name={item.entregado ? 'checkbox' : 'square-outline'}
                size={isTablet ? 24 : 20}
                color="#003579"
              />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  if (authLoading || loading) {
    console.log('Mostrando pantalla de carga: authLoading:', authLoading, 'loading:', loading);
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#003579" />
      </SafeAreaView>
    );
  }

  if (error) {
    console.log('Mostrando error:', error);
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
      </SafeAreaView>
    );
  }

  console.log('Renderizando pantalla principal, préstamos:', prestamos);
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerIcon}>
            <Ionicons name="document-text-outline" size={isTablet ? 32 : 24} color="#fff" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Préstamos Entregados</Text>
            <Text style={styles.headerSubtitle}>Gestiona las devoluciones de materiales</Text>
          </View>
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filterContainer}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={isTablet ? 20 : 16} color="#94a3b8" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por folio o nombre..."
            value={filter}
            onChangeText={setFilter}
          />
        </View>
        <View style={styles.filterButtons}>
          <TouchableOpacity
            style={[styles.filterButton, statusFilter === 'vencidas' && styles.filterButtonActive]}
            onPress={() => setStatusFilter(statusFilter === 'vencidas' ? '' : 'vencidas')}
          >
            <Text style={[styles.filterButtonText, statusFilter === 'vencidas' && styles.filterButtonTextActive]}>
              Vencidas
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, statusFilter === 'proximas' && styles.filterButtonActive]}
            onPress={() => setStatusFilter(statusFilter === 'proximas' ? '' : 'proximas')}
          >
            <Text style={[styles.filterButtonText, statusFilter === 'proximas' && styles.filterButtonTextActive]}>
              Próximas a vencer
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.filterSelectContainer}>
          <View style={styles.groupSelect}>
            <TextInput
              style={styles.groupSelectInput}
              value={groupFilter}
              placeholder="Todos los grupos"
              selectTextOnFocus={false}
              editable={false}
               onPressIn={() => setShowGroupDropdown(!showGroupDropdown)}
            />
            <Ionicons name="chevron-down" size={isTablet ? 20 : 16} color="#003579" style={styles.groupSelectIcon} />
            {groupFilter ? (
              <TouchableOpacity
                style={styles.groupClearButton}
                onPress={() => {
                  setGroupFilter('');
                  setShowGroupDropdown(false);
                }}
              >
                <Ionicons name="close" size={isTablet ? 20 : 16} color="#003579" />
              </TouchableOpacity>
            ) : null}
             {showGroupDropdown && (
              <ScrollView style={styles.groupDropdown}>
                <TouchableOpacity
                  style={styles.groupOption}
                  onPress={() => {
                    setGroupFilter('');
                    setShowGroupDropdown(false);
                  }}
                >
                  <Text style={styles.groupOptionText}>Todos los grupos</Text>
                </TouchableOpacity>
                {groups.map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={styles.groupOption}
                    onPress={() => {
                      setGroupFilter(g);
                      setShowGroupDropdown(false);
                    }}
                  >
                    <Text style={styles.groupOptionText}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
          <TouchableOpacity style={styles.clearButton} onPress={resetFilters}>
            <Text style={styles.clearButtonText}>Limpiar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Prestamos List */}
      {sorted.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons name="document-text-outline" size={isTablet ? 48 : 40} color="#94a3b8" />
          </View>
          <Text style={styles.emptyTitle}>No hay préstamos</Text>
          <Text style={styles.emptySubtitle}>No se encontraron préstamos entregados</Text>
        </View>
      ) : (
        <FlatList
  data={sorted}
  keyExtractor={(item) => item.solicitud_id.toString()}
  renderItem={renderPrestamoCard}
  contentContainerStyle={styles.list}
  numColumns={isTablet ? 2 : 1}
  columnWrapperStyle={isTablet ? styles.columnWrapper : null}
  refreshControl={
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      // Opcional: personalización visual
      colors={['#003579']}   // Android
      tintColor="#003579"    // iOS
      title="Actualizando..."// iOS
    />
  }
/>

      )}

      {/* Modal */}
      {showModal && (
        <Modal visible={showModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderContent}>
                  <View style={styles.modalHeaderIcon}>
                    <Ionicons name="document-text-outline" size={isTablet ? 24 : 20} color="#fff" />
                  </View>
                  <Text style={styles.modalHeaderTitle}>Detalle del Préstamo</Text>
                </View>
                <TouchableOpacity onPress={closeModal}>
                  <Ionicons name="close" size={isTablet ? 24 : 20} color="#cbd5e1" />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalBody}>
                {!detalle ? (
                  <View style={styles.modalLoading}>
                    <ActivityIndicator size="large" color="#003579" />
                    <Text style={styles.modalLoadingText}>Cargando detalles del préstamo...</Text>
                  </View>
                ) : (
                  <>
                    {/* Modal Info Cards */}
                    <View style={styles.modalInfoContainer}>
                      <View style={styles.modalInfoCard}>
                        <View style={styles.modalInfoIcon}>
                          <Ionicons name="document-outline" size={isTablet ? 16 : 14} color="#fff" />
                        </View>
                        <View>
                          <Text style={styles.modalInfoLabel}>Folio</Text>
                          <Text style={styles.modalInfoValue} numberOfLines={1}>
                            {detalle.folio}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.modalInfoCard}>
                        <View style={styles.modalInfoIcon}>
                          <Ionicons name="calendar-outline" size={isTablet ? 16 : 14} color="#fff" />
                        </View>
                        <View>
                          <Text style={styles.modalInfoLabel}>Recolección</Text>
                          <Text style={styles.modalInfoValue} numberOfLines={1}>
                            {formatDate(detalle.fecha_recoleccion)}
                          </Text>
                        </View>
                      </View>
                      {detalle.nombre_alumno && (
                        <View style={styles.modalInfoCard}>
                          <View style={styles.modalInfoIcon}>
                            <Ionicons name="person-outline" size={isTablet ? 16 : 14} color="#fff" />
                          </View>
                          <View>
                            <Text style={styles.modalInfoLabel}>Alumno</Text>
                            <Text style={styles.modalInfoValue} numberOfLines={1}>
                              {detalle.nombre_alumno}
                            </Text>
                          </View>
                        </View>
                      )}
                      {detalle.profesor && (
                        <View style={styles.modalInfoCard}>
                          <View style={styles.modalInfoIcon}>
                            <Ionicons name="school-outline" size={isTablet ? 16 : 14} color="#fff" />
                          </View>
                          <View>
                            <Text style={styles.modalInfoLabel}>Profesor</Text>
                            <Text style={styles.modalInfoValue} numberOfLines={1}>
                              {detalle.profesor}
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>

                    {/* Modal Items */}
                    <View style={styles.modalItemsContainer}>
                      <View style={styles.modalItemsHeader}>
                        <Ionicons name="cube-outline" size={isTablet ? 16 : 14} color="#475569" />
                        <Text style={styles.modalItemsTitle}>Materiales por Devolver</Text>
                      </View>
                      {detalle.items.map(renderModalItem)}
                    </View>

                    {/* Modal Actions */}
                    <View style={styles.modalActions}>
                      <TouchableOpacity style={styles.modalCancelButton} onPress={closeModal}>
                        <Text style={styles.modalCancelButtonText}>Cancelar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.modalSaveButton, saving && styles.modalSaveButtonDisabled]}
                        onPress={handleSave}
                        disabled={saving}
                      >
                        {saving ? (
                          <>
                            <ActivityIndicator size="small" color="#fff" />
                            <Text style={styles.modalSaveButtonText}>Guardando...</Text>
                          </>
                        ) : (
                          <>
                            <Ionicons name="checkmark" size={isTablet ? 16 : 14} color="#fff" />
                            <Text style={styles.modalSaveButtonText}>Guardar</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#003579',
    padding: window.width * 0.04,
    paddingTop: window.width * 0.06,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    backgroundColor: '#002e63',
    padding: isTablet ? 12 : 8,
    borderRadius: isTablet ? 12 : 8,
    marginRight: isTablet ? 12 : 8,
  },
  headerTitle: {
    fontSize: isTablet ? 28 : 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: isTablet ? 16 : 14,
    color: '#e2e8f0',
    marginTop: isTablet ? 4 : 2,
  },
  filterContainer: {
    padding: window.width * 0.04,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: isTablet ? 12 : 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: isTablet ? 12 : 8,
  },
  searchIcon: {
    marginLeft: isTablet ? 12 : 8,
  },
  searchInput: {
    flex: 1,
    padding: isTablet ? 12 : 8,
    fontSize: isTablet ? 16 : 14,
    color: '#1e293b',
  },
  filterButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: isTablet ? 12 : 8,
  },
  filterButton: {
    paddingVertical: isTablet ? 10 : 8,
    paddingHorizontal: isTablet ? 16 : 12,
    borderRadius: isTablet ? 12 : 8,
    borderWidth: 1,
    borderColor: '#003579',
    backgroundColor: '#fff',
    marginRight: isTablet ? 12 : 8,
    marginBottom: isTablet ? 8 : 4,
  },
  filterButtonActive: {
    backgroundColor: '#003579',
  },
  filterButtonText: {
    fontSize: isTablet ? 14 : 12,
    color: '#003579',
    fontWeight: '600',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  filterSelectContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupSelect: {
    flex: 1,
    position: 'relative',
    marginRight: isTablet ? 12 : 8,
  },
  groupSelectInput: {
    backgroundColor: '#fff',
    borderRadius: isTablet ? 12 : 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: isTablet ? 12 : 8,
    fontSize: isTablet ? 14 : 12,
    color: '#003579',
  },
  groupSelectIcon: {
    position: 'absolute',
    right: isTablet ? 12 : 8,
    top: '50%',
    transform: [{ translateY: isTablet ? -10 : -8 }],
  },
  groupClearButton: {
    position: 'absolute',
    right: isTablet ? 32 : 24,
    top: '50%',
    transform: [{ translateY: isTablet ? -10 : -8 }],
  },
  groupDropdown: {
    position: 'absolute',
    top: isTablet ? 48 : 40,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: isTablet ? 12 : 8,
    zIndex: 10,
    maxHeight: isTablet ? 200 : 150,
  },
  groupOption: {
    paddingVertical: isTablet ? 12 : 8,
    paddingHorizontal: isTablet ? 12 : 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  groupOptionText: {
    fontSize: isTablet ? 14 : 12,
    color: '#003579',
  },
  clearButton: {
    paddingVertical: isTablet ? 10 : 8,
    paddingHorizontal: isTablet ? 16 : 12,
    borderRadius: isTablet ? 12 : 8,
    borderWidth: 1,
    borderColor: '#003579',
    backgroundColor: '#fff',
  },
  clearButtonText: {
    fontSize: isTablet ? 14 : 12,
    color: '#003579',
    fontWeight: '600',
  },
  list: {
    padding: window.width * 0.04,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: isTablet ? 12 : 8,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    marginBottom: isTablet ? 12 : 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    width: isTablet ? '48%' : '100%',
  },
  cardOverdue: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  cardContent: {
    padding: isTablet ? 16 : 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: isTablet ? 12 : 8,
  },
  cardIcon: {
    backgroundColor: '#002e63',
    padding: isTablet ? 8 : 6,
    borderRadius: isTablet ? 8 : 6,
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    fontSize: isTablet ? 20 : 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: isTablet ? 8 : 4,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: isTablet ? 8 : 4,
  },
  cardText: {
    fontSize: isTablet ? 14 : 12,
    color: '#475569',
    marginLeft: isTablet ? 8 : 4,
  },
  overdueContainer: {
    flexDirection: isTablet ? 'row' : 'column',
    alignItems: isTablet ? 'center' : 'flex-start',
    marginTop: isTablet ? 8 : 4,
  },
  overdueBadge: {
    backgroundColor: '#fee2e2',
    paddingVertical: isTablet ? 4 : 2,
    paddingHorizontal: isTablet ? 8 : 6,
    borderRadius: isTablet ? 8 : 6,
    marginRight: isTablet ? 8 : 0,
    marginBottom: isTablet ? 0 : 4,
  },
  overdueText: {
    fontSize: isTablet ? 12 : 10,
    color: '#b91c1c',
    fontWeight: '600',
  },
  informButton: {
    backgroundColor: '#dc2626',
    paddingVertical: isTablet ? 6 : 4,
    paddingHorizontal: isTablet ? 12 : 8,
    borderRadius: isTablet ? 8 : 6,
    alignItems: 'center',
  },
  informButtonDisabled: {
    opacity: 0.5,
  },
  informButtonText: {
    fontSize: isTablet ? 12 : 10,
    color: '#fff',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: window.width * 0.04,
  },
  emptyIcon: {
    backgroundColor: '#f1f5f9',
    padding: isTablet ? 16 : 12,
    borderRadius: isTablet ? 12 : 8,
    marginBottom: isTablet ? 12 : 8,
  },
  emptyTitle: {
    fontSize: isTablet ? 20 : 18,
    fontWeight: '600',
    color: '#475569',
    marginBottom: isTablet ? 8 : 4,
  },
  emptySubtitle: {
    fontSize: isTablet ? 16 : 14,
    color: '#64748b',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: window.width * 0.04,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: isTablet ? 12 : 8,
    width: '95%',
    maxHeight: '90%',
    overflow: 'hidden',
  },
  modalHeader: {
    backgroundColor: '#003579',
    padding: isTablet ? 16 : 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modalHeaderIcon: {
    backgroundColor: '#002e63',
    padding: isTablet ? 8 : 6,
    borderRadius: isTablet ? 8 : 6,
    marginRight: isTablet ? 12 : 8,
  },
  modalHeaderTitle: {
    fontSize: isTablet ? 20 : 18,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  modalBody: {
    maxHeight: window.height * 0.8,
  },
  modalLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: isTablet ? 32 : 24,
  },
  modalLoadingText: {
    fontSize: isTablet ? 16 : 14,
    color: '#475569',
    marginTop: isTablet ? 12 : 8,
  },
  modalInfoContainer: {
    flexDirection: isTablet ? 'row' : 'column',
    flexWrap: 'wrap',
    padding: isTablet ? 16 : 12,
  },
  modalInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: isTablet ? 12 : 8,
    padding: isTablet ? 12 : 8,
    marginBottom: isTablet ? 8 : 4,
    marginRight: isTablet ? 8 : 0,
    flex: isTablet ? 1 : undefined,
    minWidth: isTablet ? 200 : undefined,
  },
  modalInfoIcon: {
    backgroundColor: '#002e63',
    padding: isTablet ? 8 : 6,
    borderRadius: isTablet ? 8 : 6,
    marginRight: isTablet ? 12 : 8,
  },
  modalInfoLabel: {
    fontSize: isTablet ? 12 : 10,
    color: '#64748b',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  modalInfoValue: {
    fontSize: isTablet ? 14 : 12,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  modalItemsContainer: {
    backgroundColor: '#fff',
    borderRadius: isTablet ? 12 : 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    margin: isTablet ? 16 : 12,
    overflow: 'hidden',
  },
  modalItemsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    padding: isTablet ? 12 : 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalItemsTitle: {
    fontSize: isTablet ? 16 : 14,
    fontWeight: '600',
    color: '#1e293b',
    marginLeft: isTablet ? 8 : 4,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: isTablet ? 12 : 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modalItemIcon: {
    backgroundColor: '#f1f5f9',
    padding: isTablet ? 8 : 6,
    borderRadius: isTablet ? 8 : 6,
    marginRight: isTablet ? 12 : 8,
  },
  modalItemInfo: {
    flex: 1,
  },
  modalItemName: {
    fontSize: isTablet ? 14 : 12,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: isTablet ? 4 : 2,
  },
  modalItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalItemText: {
    fontSize: isTablet ? 12 : 10,
    color: '#475569',
  },
  modalItemUnit: {
    backgroundColor: '#e5e7eb',
    paddingVertical: isTablet ? 2 : 1,
    paddingHorizontal: isTablet ? 6 : 4,
    borderRadius: isTablet ? 6 : 4,
    marginLeft: isTablet ? 8 : 4,
  },
  modalItemUnitText: {
    fontSize: isTablet ? 12 : 10,
    color: '#1e293b',
    fontWeight: '600',
  },
  modalItemInput: {
    alignItems: 'center',
  },
  modalItemLabel: {
    fontSize: isTablet ? 12 : 10,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: isTablet ? 4 : 2,
  },
  modalItemNumberInput: {
    width: isTablet ? 60 : 50,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: isTablet ? 8 : 6,
    padding: isTablet ? 6 : 4,
    textAlign: 'center',
    fontSize: isTablet ? 12 : 10,
    color: '#1e293b',
  },
  modalItemMax: {
    fontSize: isTablet ? 12 : 10,
    color: '#94a3b8',
    marginTop: isTablet ? 4 : 2,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: isTablet ? 16 : 12,
  },
  modalCancelButton: {
    paddingVertical: isTablet ? 10 : 8,
    paddingHorizontal: isTablet ? 16 : 12,
    borderRadius: isTablet ? 12 : 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    marginRight: isTablet ? 12 : 8,
  },
  modalCancelButtonText: {
    fontSize: isTablet ? 14 : 12,
    color: '#1e293b',
    fontWeight: '600',
  },
  modalSaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: isTablet ? 10 : 8,
    paddingHorizontal: isTablet ? 16 : 12,
    borderRadius: isTablet ? 12 : 8,
    backgroundColor: '#003579',
  },
  modalSaveButtonDisabled: {
    opacity: 0.5,
  },
  modalSaveButtonText: {
    fontSize: isTablet ? 14 : 12,
    color: '#fff',
    fontWeight: '600',
    marginLeft: isTablet ? 8 : 4,
  },
  errorText: {
    fontSize: isTablet ? 16 : 14,
    color: '#ef4444',
    textAlign: 'center',
    marginTop: window.height * 0.1,
  },
});