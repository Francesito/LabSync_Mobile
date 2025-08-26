import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
  Dimensions,
  useWindowDimensions,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { API_URL } from '@/constants/api';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const HEADER_HEIGHT = 60;

// Enable LayoutAnimation on Android
if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

// Interfaces
interface RawAdeudo {
  solicitud_id: number;
  solicitud_item_id: number;
  material_id: number;
  tipo: string;
  folio?: string;
  nombre_material?: string;
  nombreMaterial?: string;
  material_nombre?: string;
  materialNombre?: string;
  nombre?: string;
  cantidad?: number;
  cantidad_pendiente?: number;
  unidad?: string;
  fecha_devolucion?: string | null;
  fecha_entrega?: string | null;
}

interface Adeudo {
  solicitud_id: number;
  solicitud_item_id: number;
  material_id: number;
  tipo: string;
  folio: string;
  nombre_material: string;
  cantidad: number;
  unidad: string;
  fecha_devolucion: string | null;
}

interface GroupedAdeudo {
  folio: string;
  fecha_devolucion: string | null;
  items: Adeudo[];
}

// Normalization function
function normalizarAdeudo(a: RawAdeudo): Adeudo {
  const rawNombre =
    a.nombre_material ??
    a.nombreMaterial ??
    a.material_nombre ??
    a.materialNombre ??
    a.nombre ??
    '';

  const nombrePlano = String(rawNombre || '').trim().replace(/_/g, ' ');

  return {
    solicitud_id: a.solicitud_id,
    solicitud_item_id: a.solicitud_item_id,
    material_id: a.material_id,
    tipo: a.tipo,
    folio: a.folio || '—',
    nombre_material: nombrePlano || '(Sin nombre)',
    cantidad: a.cantidad ?? a.cantidad_pendiente ?? 0,
    unidad: a.unidad || 'u',
    fecha_devolucion: a.fecha_devolucion || a.fecha_entrega || null,
  };
}

// Date parsing and formatting
const parseDate = (str: string | null): Date | null => {
  if (!str) return null;
 const normalized = str.replace(' ', 'T');
  const date = new Date(normalized);
  return isNaN(date.getTime()) ? null : date;
};

const formatDate = (str: string | null): string => {
  const date = parseDate(str);
  if (!date) return 'Sin fecha';
  return date.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const getDaysUntilDue = (dateString: string | null): number | null => {
  const dueDate = parseDate(dateString);
  if (!dueDate) return null;

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dueDateStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

  const diffTime = dueDateStart.getTime() - todayStart.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
};

const isOverdue = (dateString: string | null): boolean => {
  const daysUntil = getDaysUntilDue(dateString);
  return daysUntil !== null && daysUntil < 0;
};

const isNearDue = (dateString: string | null): boolean => {
  const daysUntil = getDaysUntilDue(dateString);
  return daysUntil !== null && daysUntil >= 0 && daysUntil <= 3;
};

const getStatusColor = (dateString: string | null): string => {
  const daysUntil = getDaysUntilDue(dateString);
  if (daysUntil === null) return '#6b7280'; // gray
  if (daysUntil < 0) return '#b91c1c'; // red
  if (daysUntil === 0) return '#ea580c'; // orange
  if (daysUntil <= 3) return '#d97706'; // yellow
  return '#15803d'; // green
};

const getStatusText = (dateString: string | null): string => {
  const daysUntil = getDaysUntilDue(dateString);
  if (daysUntil === null) return 'Sin fecha';
  if (daysUntil < 0) return `Vencido (${Math.abs(daysUntil)} días)`;
  if (daysUntil === 0) return 'Vence hoy';
  if (daysUntil <= 3) return `Vence en ${daysUntil} días`;
  return `${daysUntil} días restantes`;
};

export default function AdeudosScreen() {
  const [adeudos, setAdeudos] = useState<Adeudo[]>([]);
  const [groupedAdeudos, setGroupedAdeudos] = useState<GroupedAdeudo[]>([]);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [expandedFolios, setExpandedFolios] = useState<Set<string>>(new Set());
  const { width } = useWindowDimensions(); // For responsiveness

  useEffect(() => {
    const fetchAdeudos = async () => {
      try {
        setLoading(true);
        const token = await SecureStore.getItemAsync('token');
       // Include return dates by calling the entrega endpoint
        const res = await axios.get(`${API_URL}/api/materials/adeudos/entrega`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        let data: RawAdeudo[] = Array.isArray(res.data) ? res.data : res.data?.adeudos || [];
        const normalized = data.map(normalizarAdeudo);

        // Group by folio
        const groups: { [folio: string]: GroupedAdeudo } = {};
        normalized.forEach((item) => {
          if (!groups[item.folio]) {
            groups[item.folio] = {
              folio: item.folio,
              fecha_devolucion: item.fecha_devolucion,
              items: [],
            };
             } else if (!groups[item.folio].fecha_devolucion && item.fecha_devolucion) {
            groups[item.folio].fecha_devolucion = item.fecha_devolucion;
          }
          groups[item.folio].items.push(item);
        });
        setGroupedAdeudos(Object.values(groups));
        setAdeudos(normalized);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Error al obtener adeudos');
      } finally {
        setLoading(false);
      }
    };
    fetchAdeudos();
  }, []);

  const toggleExpand = (folio: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedFolios((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(folio)) {
        newSet.delete(folio);
      } else {
        newSet.add(folio);
      }
      return newSet;
    });
  };

  const renderItem = ({ item }: { item: GroupedAdeudo }) => {
    const isExpanded = expandedFolios.has(item.folio);
     const displayDate = item.fecha_devolucion || item.items[0]?.fecha_devolucion || null;
    const statusColor = getStatusColor(displayDate);
    const isTablet = width > 600; // Responsive check

    return (
      <Pressable
        onPress={() => toggleExpand(item.folio)}
        style={[
          styles.card,
          { width: isTablet ? '80%' : '100%', alignSelf: 'center' },
          isOverdue(displayDate) && styles.overdueCard,
          isNearDue(displayDate) && !isOverdue(displayDate) && styles.nearDueCard,
        ]}
      >
        <View style={styles.cardHeader}>
          <Ionicons name="document-text-outline" size={24} color="#3b82f6" />
          <View style={styles.cardHeaderText}>
            <Text style={styles.folioText}>Folio: {item.folio}</Text>
            <Text style={styles.dateText}>Devolución: {formatDate(displayDate)}</Text>
          </View>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={24}
            color="#4b5563"
          />
        </View>
        <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
          <Ionicons name="time-outline" size={16} color={statusColor} />
          <Text style={[styles.statusText, { color: statusColor }]}>
             {getStatusText(displayDate)}
          </Text>
        </View>
        {isExpanded && (
          <View style={styles.detailsContainer}>
            {item.items.map((detail, index) => (
              <View key={index} style={styles.detailItem}>
                <Ionicons name="cube-outline" size={20} color="#3b82f6" />
                <Text style={styles.detailText}>
                  {detail.nombre_material} - {detail.cantidad} {detail.unidad}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Pressable>
    );
  };

  if (loading) {
    return (
      <LinearGradient
        colors={['#f8fafc', '#eff6ff', '#e0e7ff']}
        style={[styles.container, { paddingTop: HEADER_HEIGHT + 16 }]}
      >
        <ActivityIndicator size="large" color="#3b82f6" />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={['#f8fafc', '#eff6ff', '#e0e7ff']}
       style={[styles.container, { paddingTop: HEADER_HEIGHT + 16 }]}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Adeudos</Text>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!error && groupedAdeudos.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="checkmark-circle-outline" size={80} color="#10b981" />
          <Text style={styles.emptyTitle}>¡Bien Hecho!</Text>
          <Text style={styles.emptyText}>
            No tienes adeudos pendientes en este momento.
          </Text>
        </View>
      ) : (
        <FlatList
          data={groupedAdeudos}
          keyExtractor={(item) => item.folio}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
        />
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  listContent: {
    paddingBottom: 20,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HEADER_HEIGHT,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    zIndex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  overdueCard: {
    backgroundColor: 'rgba(254, 226, 226, 0.5)',
  },
  nearDueCard: {
    backgroundColor: 'rgba(254, 243, 199, 0.5)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardHeaderText: {
    flex: 1,
    marginLeft: 12,
  },
  folioText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  dateText: {
    fontSize: 14,
    color: '#4b5563',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  statusText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '500',
  },
  detailsContainer: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 8,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  detailText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#374151',
  },
  error: {
    color: 'red',
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#4b5563',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
  },
});