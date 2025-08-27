import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  useWindowDimensions,
  SafeAreaView,
} from 'react-native';
// eslint-disable-next-line import/no-unresolved
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  obtenerResiduos,
  registrarResiduo,
  eliminarResiduos,
  TipoResiduo,
  UnidadResiduo,
  CrearResiduoPayload,
} from '../../lib/api'; // Adjust path as needed
import { useAuth } from '@/lib/auth'; // Adjust path as needed

const LABS = [
  'Laboratorio de Química Básica',
  'Lab. de Química Analítica',
  'Lab. de Tecnología Ambiental',
  'Lab. de Fisicoquímica',
  'Lab. de Operaciones Unitarias',
  'Lab. de Análisis Instrumental',
  'Lab. de Microbiología',
];

const RESIDUE_TYPES = [
  { label: 'Químico', value: 'quimico', icon: 'flask-outline', color: '#ea580c' },
  { label: 'Biológico', value: 'biologico', icon: 'git-network-outline', color: '#15803d' },
  { label: 'Radiactivo', value: 'radiactivo', icon: 'nuclear-outline', color: '#d97706' },
  { label: 'Común', value: 'comun', icon: 'trash-outline', color: '#4b5563' },
];

const UNITS = [
  { label: 'g', value: 'g' },
  { label: 'mL', value: 'ml' },
  { label: 'u', value: 'u' },
];

const getTipoLabel = (value: string): string =>
  RESIDUE_TYPES.find((t) => t.value === value)?.label || value;

import type { IconProps } from '@expo/vector-icons/build/createIconSet';
type IoniconName = IconProps<string>['name'];

const getTipoIcon = (value: string): IoniconName =>
  RESIDUE_TYPES.find((t) => t.value === value)?.icon as IoniconName || 'clipboard-outline';

const getTipoColor = (value: string): string =>
  RESIDUE_TYPES.find((t) => t.value === value)?.color || '#4b5563';

const formatDate = (d: Date | string): string => {
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
};

const startOfWeek = (d: Date): Date => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // Monday as first day
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
};

const addDays = (d: Date, days: number): Date => {
  const date = new Date(d);
  date.setDate(date.getDate() + days);
  return date;
};

const WeekDateSelector = ({
  date,
  onSelect,
}: {
  date: Date | undefined;
  onSelect: (d: Date) => void;
}) => {
  const todayStart = startOfWeek(new Date());
  const [weekStart, setWeekStart] = useState(startOfWeek(date || new Date()));

  useEffect(() => {
    if (date) {
      setWeekStart(startOfWeek(date));
    }
  }, [date]);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const isCurrentWeek = weekStart >= todayStart;

  return (
    <View style={styles.weekSelector}>
      <TouchableOpacity
        onPress={() => setWeekStart(addDays(weekStart, -7))}
        style={styles.weekArrow}
      >
        <Ionicons name="chevron-back" size={20} color="#4b5563" />
      </TouchableOpacity>
      <View style={styles.weekDays}>
        {days.map((d) => {
          const selected = date && formatDate(d) === formatDate(date);
          return (
            <TouchableOpacity
              key={d.toISOString()}
              onPress={() => onSelect(new Date(d))}
              style={[
                styles.dayButton,
                selected && styles.daySelected,
              ]}
            >
              <Text
                style={[
                  styles.dayMonth,
                  selected && styles.daySelectedText,
                ]}
              >
                {d.toLocaleString('es-ES', { month: 'long' })}
              </Text>
              <Text
                style={[
                  styles.dayNumber,
                  selected && styles.daySelectedText,
                ]}
              >
                {d.getDate()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <TouchableOpacity
        onPress={() => setWeekStart(addDays(weekStart, 7))}
        style={styles.weekArrow}
        disabled={isCurrentWeek}
      >
        <Ionicons
          name="chevron-forward"
          size={20}
          color={isCurrentWeek ? '#9ca3af' : '#4b5563'}
        />
      </TouchableOpacity>
    </View>
  );
};

interface Residuo {
  id: number;
  fecha: string;
  laboratorio: string;
  reactivo: string;
    tipo: TipoResiduo;
  cantidad: number;
  unidad: UnidadResiduo;
}

export default function ResiduosScreen() {
  const { usuario } = useAuth();
  
    type FormState = {
    fecha: Date;
    laboratorio: string;
    reactivo: string;
    tipo: TipoResiduo | '';
    cantidad: string;
    unidad: UnidadResiduo | '';
  };

  const [form, setForm] = useState<FormState>({
    fecha: new Date(),
    laboratorio: '',
    reactivo: '',
   tipo: '' as FormState['tipo'],
    cantidad: '',
     unidad: '' as FormState['unidad'],
  });
  const [entries, setEntries] = useState<Residuo[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { width } = useWindowDimensions();
  const isTablet = width > 600;

  useEffect(() => {
    if (!usuario) return;
    obtenerResiduos()
      .then((data: Residuo[]) => {
        setEntries(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        setEntries([]);
      });
  }, [usuario]);

  const handleFormChange = (name: string, value: any) => {
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async () => {
    const { fecha, laboratorio, reactivo, tipo, cantidad, unidad } = form;

    if (!fecha || !laboratorio || !reactivo || !tipo || !cantidad || !unidad) {
      Alert.alert('Error', 'Todos los campos son requeridos');
      return;
    }

    setIsLoading(true);
    try {
       const payload: CrearResiduoPayload = {
        fecha: formatDate(fecha),
        laboratorio,
        reactivo,
          tipo: tipo as TipoResiduo,
        cantidad: parseFloat(cantidad),
        unidad: unidad as UnidadResiduo,
      };

      const saved = await registrarResiduo(payload);
      setEntries((prev) => [saved, ...prev]);
      setForm({
        fecha: new Date(),
        laboratorio: '',
        reactivo: '',
        tipo: '' as FormState['tipo'],
        cantidad: '',
           unidad: '' as FormState['unidad'],
      });
    } catch (err) {
      console.error('Error al registrar residuo:', err);
      Alert.alert('Error', 'No se pudo registrar el residuo');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelect = (id: number) => {
    setSelected((sel) =>
      sel.includes(id) ? sel.filter((i) => i !== id) : [...sel, id]
    );
  };

  const handleDelete = async () => {
    if (selected.length === 0) return;
    try {
      await eliminarResiduos(selected);
      setEntries((prev) => prev.filter((e) => !selected.includes(e.id)));
      setSelected([]);
    } catch (err) {
      console.error('Error al eliminar residuos:', err);
      Alert.alert('Error', 'No se pudieron eliminar los residuos');
    }
  };

  const selectedEntries = entries.filter((e) => selected.includes(e.id));

  const handleDownloadCSV = async () => {
     if (selectedEntries.length === 0) return;

    const headers = ['Fecha', 'Laboratorio', 'Reactivo', 'Tipo', 'Cantidad', 'Unidad'];
     const rows = selectedEntries.map((e) => [
      formatDate(e.fecha),
      e.laboratorio,
      e.reactivo,
      getTipoLabel(e.tipo),
      e.cantidad.toString(),
      e.unidad,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const path = `${FileSystem.documentDirectory}residuos.csv`;
    await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
    await Sharing.shareAsync(path);
  };

  const handleDownloadPDF = async () => {
    if (selectedEntries.length === 0) return;

    const html = `
      <html>
        <body>
          <h1>Bitácora de Residuos Peligrosos</h1>
          <table style="width:100%; border-collapse: collapse;">
            <thead>
              <tr>
                <th style="border: 1px solid black; padding: 8px;">Fecha</th>
                <th style="border: 1px solid black; padding: 8px;">Laboratorio</th>
                <th style="border: 1px solid black; padding: 8px;">Reactivo</th>
                <th style="border: 1px solid black; padding: 8px;">Tipo</th>
                <th style="border: 1px solid black; padding: 8px;">Cantidad</th>
                <th style="border: 1px solid black; padding: 8px;">Unidad</th>
              </tr>
            </thead>
            <tbody>
                ${selectedEntries
                .map(
                  (e) => `
                <tr>
                  <td style="border: 1px solid black; padding: 8px;">${formatDate(e.fecha)}</td>
                  <td style="border: 1px solid black; padding: 8px;">${e.laboratorio}</td>
                  <td style="border: 1px solid black; padding: 8px;">${e.reactivo}</td>
                  <td style="border: 1px solid black; padding: 8px;">${getTipoLabel(e.tipo)}</td>
                  <td style="border: 1px solid black; padding: 8px;">${e.cantidad}</td>
                  <td style="border: 1px solid black; padding: 8px;">${e.unidad}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const { uri } = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(uri);
  };

  const allChecked =
   entries.length > 0 && entries.every((e) => selected.includes(e.id));

  const toggleAll = () => {
    setSelected(allChecked ? [] : entries.map((en) => en.id));
  };

  if (![1, 2].includes(usuario?.rol_id)) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Acceso denegado</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={['#f9fafb', '#f3f4f6']}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={[styles.header, { paddingHorizontal: isTablet ? 32 : 16 }]}>
            <Ionicons name="warning-outline" size={32} color="#1e293b" />
            <Text style={styles.headerTitle}>Bitácora de Residuos Peligrosos</Text>
            <Ionicons name="warning-outline" size={32} color="#1e293b" />
          </View>

          {/* Form Section */}
          <View style={[styles.section, { padding: isTablet ? 32 : 16 }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="add-circle-outline" size={24} color="#ffffff" />
              <Text style={styles.sectionTitle}>Nuevo Registro</Text>
            </View>
            <View style={styles.form}>
              {/* Fecha */}
              <View style={styles.formField}>
                <View style={styles.labelContainer}>
                  <Ionicons name="calendar-outline" size={20} color="#4b5563" />
                  <Text style={styles.label}>Fecha *</Text>
                </View>
                <WeekDateSelector
                  date={form.fecha}
                  onSelect={(d) => handleFormChange('fecha', d)}
                />
              </View>

              {/* Laboratorio */}
              <View style={styles.formField}>
                <View style={styles.labelContainer}>
                  <Ionicons name="business-outline" size={20} color="#4b5563" />
                  <Text style={styles.label}>Laboratorio *</Text>
                </View>
               <View style={styles.buttonRow}>
                  {LABS.map((lab) => (
                    <TouchableOpacity
                      key={lab}
                      style={[
                        styles.optionButton,
                        form.laboratorio === lab && styles.optionButtonSelected,
                      ]}
                      onPress={() => handleFormChange('laboratorio', lab)}
                    >
                      <Text
                        style={[
                          styles.optionButtonText,
                          form.laboratorio === lab && styles.optionButtonTextSelected,
                        ]}
                      >
                        {lab}
                      </Text>
                    </TouchableOpacity>
                  ))}
                     </View>
              </View>

              {/* Reactivo */}
              <View style={styles.formField}>
                <View style={styles.labelContainer}>
                  <Ionicons name="flask-outline" size={20} color="#4b5563" />
                  <Text style={styles.label}>Reactivo *</Text>
                </View>
                <TextInput
                  style={styles.input}
                  value={form.reactivo}
                  onChangeText={(value) => handleFormChange('reactivo', value)}
                  placeholder="Nombre del reactivo"
                />
              </View>

              {/* Tipo */}
              <View style={styles.formField}>
                <View style={styles.labelContainer}>
                  <Ionicons name="pricetag-outline" size={20} color="#4b5563" />
                  <Text style={styles.label}>Tipo de Residuo *</Text>
                </View>
               <View style={styles.buttonRow}>
                  {RESIDUE_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type.value}
                      style={[
                        styles.optionButton,
                        form.tipo === type.value && styles.optionButtonSelected,
                      ]}
                      onPress={() => handleFormChange('tipo', type.value)}
                    >
                      <Ionicons
                        name={type.icon as React.ComponentProps<typeof Ionicons>['name']}
                        size={16}
                        color={form.tipo === type.value ? '#ffffff' : type.color}
                      />
                      <Text
                        style={[
                          styles.optionButtonText,
                          form.tipo === type.value && styles.optionButtonTextSelected,
                        ]}
                      >
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
               </View>
              </View>

              {/* Cantidad y Unidad */}
              <View style={styles.row}>
                <View style={[styles.formField, { flex: 1, marginRight: 8 }]}>
                  <View style={styles.labelContainer}>
                    <Ionicons name="scale-outline" size={20} color="#4b5563" />
                    <Text style={styles.label}>Cantidad *</Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    value={form.cantidad}
                    onChangeText={(value) => handleFormChange('cantidad', value)}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                  />
                </View>
                <View style={[styles.formField, { flex: 1 }]}>
                  <View style={styles.labelContainer}>
                    <Ionicons name="resize-outline" size={20} color="#4b5563" />
                    <Text style={styles.label}>Unidad *</Text>
                  </View>
                <View style={styles.buttonRow}>
                    {UNITS.map((u) => (
                      <TouchableOpacity
                        key={u.value}
                        style={[
                          styles.optionButton,
                          form.unidad === u.value && styles.optionButtonSelected,
                        ]}
                        onPress={() => handleFormChange('unidad', u.value as UnidadResiduo)}
                      >
                        <Text
                          style={[
                            styles.optionButtonText,
                            form.unidad === u.value && styles.optionButtonTextSelected,
                          ]}
                        >
                          {u.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleSubmit}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="save-outline" size={20} color="#ffffff" />
                    <Text style={styles.submitText}>Registrar Residuo</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* History Section */}
          <View style={[styles.section, { padding: isTablet ? 32 : 16 }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="list-outline" size={24} color="#ffffff" />
              <Text style={styles.sectionTitle}>Historial de Registros</Text>
             <Text style={styles.countBadge}>{entries.length}</Text>
            </View>

           {/* Actions */}
              <View style={styles.actions}>
                <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.actionButton, selected.length === 0 && styles.disabledButton]}
                  onPress={handleDownloadCSV}
                  disabled={selected.length === 0}
                >
                  <Ionicons name="document-text-outline" size={20} color="#ffffff" />
                  <Text style={styles.actionText}>CSV</Text>
                </TouchableOpacity>
                <TouchableOpacity
                 style={[styles.actionButton, selected.length === 0 && styles.disabledButton]}
                  onPress={handleDownloadPDF}
                 disabled={selected.length === 0}
                >
                  <Ionicons name="document-outline" size={20} color="#ffffff" />
                  <Text style={styles.actionText}>PDF</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, selected.length === 0 && styles.disabledButton, { backgroundColor: '#dc2626' }]}
                  onPress={handleDelete}
                  disabled={selected.length === 0}
                >
                  <Ionicons name="trash-outline" size={20} color="#ffffff" />
                  <Text style={styles.actionText}>Eliminar</Text>
                  {selected.length > 0 && (
                    <Text style={styles.selectedCount}>{selected.length}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

             {entries.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="mail-open-outline" size={64} color="#94a3b8" />
                  <Text style={styles.emptyTitle}>No hay residuos registrados aún.</Text>
                  <Text style={styles.emptySubtitle}>Comienza registrando tu primer residuo</Text>
                </View>
              ) : (
                <View style={styles.listContent}>
                  <TouchableOpacity style={styles.selectAll} onPress={toggleAll}>
                    <Ionicons
                      name={allChecked ? 'checkbox' : 'square-outline'}
                      size={24}
                      color="#3b82f6"
                    />
                    <Text style={styles.selectAllText}>Seleccionar Todo</Text>
                  </TouchableOpacity>
               {entries.map((item) => (
                    <View key={item.id} style={[styles.card, { width: isTablet ? '80%' : '100%', alignSelf: 'center' }]}>
                      <TouchableOpacity
                        style={styles.checkbox}
                        onPress={() => toggleSelect(item.id)}
                      >
                        <Ionicons
                          name={selected.includes(item.id) ? 'checkbox' : 'square-outline'}
                          size={24}
                          color="#3b82f6"
                        />
                      </TouchableOpacity>
                      <View style={styles.cardContent}>
                        <View style={styles.cardRow}>
                          <Ionicons name="calendar-outline" size={20} color="#4b5563" />
                          <Text style={styles.cardText}>{formatDate(item.fecha)}</Text>
                        </View>
                        <View style={styles.cardRow}>
                          <Ionicons name="business-outline" size={20} color="#4b5563" />
                          <Text style={styles.cardText}>{item.laboratorio}</Text>
                        </View>
                        <View style={styles.cardRow}>
                          <Ionicons name="flask-outline" size={20} color="#4b5563" />
                          <Text style={styles.cardBoldText}>{item.reactivo}</Text>
                        </View>
                        <View style={styles.cardRow}>
                          <Ionicons name={getTipoIcon(item.tipo) as React.ComponentProps<typeof Ionicons>['name']} size={20} color={getTipoColor(item.tipo)} />
                          <Text style={[styles.cardBoldText, { color: getTipoColor(item.tipo) }]}>
                            {getTipoLabel(item.tipo)}
                          </Text>
                        </View>
                        <View style={styles.cardRow}>
                          <Ionicons name="scale-outline" size={20} color="#4b5563" />
                          <Text style={styles.cardBoldText}>{Number(item.cantidad).toFixed(2)}</Text>
                        </View>
                        <View style={styles.cardRow}>
                          <Ionicons name="resize-outline" size={20} color="#4b5563" />
                          <Text style={styles.cardText}>{item.unidad}</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
            </ScrollView>
        </LinearGradient>
      </SafeAreaView>
    );
  }

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e40af',
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  countBadge: {
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '500',
  },
  form: {
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  formField: {
    marginBottom: 16,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4b5563',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  inputText: {
    fontSize: 16,
    color: '#1e293b',
  },
 row: {
    flexDirection: 'row',
    gap: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
   gap: 4,
  },
 optionButtonSelected: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  optionButtonText: {
    color: '#1e293b',
    fontSize: 14,
  },
  optionButtonTextSelected: {
    color: '#ffffff',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e40af',
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  submitText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  actions: {
    marginBottom: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
  actionText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
  },
  selectedCount: {
    backgroundColor: '#ef4444',
    color: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 12,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4b5563',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  selectAll: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    gap: 8,
  },
  selectAllText: {
    fontSize: 16,
    color: '#1e293b',
  },
  listContent: {
    paddingBottom: 20,
  },
   weekSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  weekArrow: {
    padding: 4,
  },
  weekDays: {
    flexDirection: 'row',
    flex: 1,
    justifyContent: 'space-between',
    gap: 4,
  },
  dayButton: {
    flex: 1,
    alignItems: 'center',
    padding: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
  },
  daySelected: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  dayMonth: {
    fontSize: 10,
    color: '#4b5563',
    textTransform: 'capitalize',
  },
  dayNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  daySelectedText: {
    color: '#ffffff',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    marginRight: 16,
  },
  cardContent: {
    flex: 1,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  cardText: {
    fontSize: 14,
    color: '#4b5563',
  },
  cardBoldText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  errorText: {
    fontSize: 18,
    color: '#ef4444',
    textAlign: 'center',
    marginTop: 32,
  },
});