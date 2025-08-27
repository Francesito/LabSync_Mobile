import React, { useEffect, useState } from 'react';
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
  useWindowDimensions,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { useAuth } from '@/lib/auth';
import {
  obtenerResiduos,
  obtenerAdeudosGlobal,
  obtenerGrupos,
  obtenerInventarioLiquidos,
  obtenerInventarioSolidos,
} from '@/lib/api';

// Interfaces
interface HistorialItem {
  nombre: string;
  grupo: string;
  registros: {
    fecha: string;
    laboratorio: string;
    reactivo: string;
    tipo: string;
    cantidad: number;
    unidad: string;
  }[];
}

interface GrupoItem {
  nombre: string;
  adeudos: {
    cantidad: number;
    unidad: string;
    nombre_material: string;
    solicitante: string;
  }[];
}

interface InventarioItem {
  nombre: string;
  cantidad_inicial: number;
  unidad: string;
  consumos: { [mes: string]: number };
  existencia_final: number;
  total_consumido: number;
}

interface InventarioData {
  meses: string[];
  datos: InventarioItem[];
}

export default function ReportesScreen() {
  const { usuario } = useAuth();

  const [historial, setHistorial] = useState<HistorialItem[]>([]);
  const [showHistorialModal, setShowHistorialModal] = useState(false);

  const [grupos, setGrupos] = useState<GrupoItem[]>([]);
  const [showGruposModal, setShowGruposModal] = useState(false);
  const [grupoDetalle, setGrupoDetalle] = useState<GrupoItem | null>(null);
  const [showGrupoAdeudosModal, setShowGrupoAdeudosModal] = useState(false);

  const [inventarioLiquidos, setInventarioLiquidos] = useState<InventarioData>({ meses: [], datos: [] });
  const [showLiquidosModal, setShowLiquidosModal] = useState(false);

  const [inventarioSolidos, setInventarioSolidos] = useState<InventarioData>({ meses: [], datos: [] });
  const [showSolidosModal, setShowSolidosModal] = useState(false);

  const [searchHistorial, setSearchHistorial] = useState('');
  const [searchLiquidos, setSearchLiquidos] = useState('');
  const [searchSolidos, setSearchSolidos] = useState('');

  const [loading, setLoading] = useState(true);
  const { width } = useWindowDimensions();
  const isTablet = width > 600;

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Load historial residuos
        const residuosData = await obtenerResiduos();
        const grouped: { [key: string]: HistorialItem } = {};
        (Array.isArray(residuosData) ? residuosData : []).forEach((e) => {
          const fecha = e.fecha ? new Date(e.fecha).toISOString().split('T')[0] : '';
          const key = `${e.nombre || ''}-${e.grupo || ''}`;
          if (!grouped[key]) {
            grouped[key] = { nombre: e.nombre || '', grupo: e.grupo || '', registros: [] };
          }
          grouped[key].registros.push({
            fecha,
            laboratorio: e.laboratorio || '',
            reactivo: e.reactivo || '',
            tipo: e.tipo || '',
            cantidad: e.cantidad || 0,
            unidad: e.unidad || '',
          });
        });
        setHistorial(Object.values(grouped));

        // Load grupos y adeudos
        const [gruposRes, adeudosRes] = await Promise.all([obtenerGrupos(), obtenerAdeudosGlobal()]);
        const listaGrupos = Array.isArray(gruposRes) ? gruposRes : [];
        const adeudos = Array.isArray(adeudosRes) ? adeudosRes : [];
        const groupedAdeudos: { [key: string]: any[] } = {};
        adeudos.forEach((a) => {
          const g = a.grupo || 'Sin grupo';
          if (!groupedAdeudos[g]) groupedAdeudos[g] = [];
          const rawNombre =
            a.nombre_material ??
            a.nombreMaterial ??
            a.material_nombre ??
            a.materialNombre ??
            a.material ??
            a.nombre ??
            '';
          const nombre = String(rawNombre || '').trim().replace(/_/g, ' ');
          groupedAdeudos[g].push({
            cantidad: a.cantidad,
            unidad: a.unidad,
            nombre_material: nombre || '(Sin nombre)',
            solicitante: a.solicitante,
          });
        });
        const allGrupos = listaGrupos.map((g) => ({
          nombre: g.nombre,
          adeudos: groupedAdeudos[g.nombre] || [],
        }));
        Object.keys(groupedAdeudos).forEach((g) => {
          if (!allGrupos.some((gr) => gr.nombre === g)) {
            allGrupos.push({ nombre: g, adeudos: groupedAdeudos[g] });
          }
        });
        setGrupos(allGrupos);

        // Load inventario liquidos
        const liquidosData = await obtenerInventarioLiquidos();
        setInventarioLiquidos({
          meses: liquidosData.meses || [],
          datos: Array.isArray(liquidosData.datos) ? liquidosData.datos : [],
        });

        // Load inventario solidos
        const solidosData = await obtenerInventarioSolidos();
        setInventarioSolidos({
          meses: solidosData.meses || [],
          datos: Array.isArray(solidosData.datos) ? solidosData.datos : [],
        });
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const downloadHistorialCSV = async (registros: any[], nombre: string) => {
    const headers = ['Fecha', 'Laboratorio', 'Reactivo', 'Tipo', 'Cantidad', 'Unidad'];
    const rows = registros.map((r) => [r.fecha, r.laboratorio, r.reactivo, r.tipo, r.cantidad, r.unidad]);
    const csv = [headers.join(','), ...rows.map((r: string[]) => r.join(','))].join('\n');

    const path = `${FileSystem.documentDirectory}${nombre}_residuos.csv`;
    await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
    await Sharing.shareAsync(path);
  };

  const downloadHistorialPDF = async (registros: any[], nombre: string) => {
    const html = `
      <html>
        <body>
          <h1>${nombre} Residuos</h1>
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
              ${registros.map((r) => `
                <tr>
                  <td style="border: 1px solid black; padding: 8px;">${r.fecha}</td>
                  <td style="border: 1px solid black; padding: 8px;">${r.laboratorio}</td>
                  <td style="border: 1px solid black; padding: 8px;">${r.reactivo}</td>
                  <td style="border: 1px solid black; padding: 8px;">${r.tipo}</td>
                  <td style="border: 1px solid black; padding: 8px;">${r.cantidad}</td>
                  <td style="border: 1px solid black; padding: 8px;">${r.unidad}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const { uri } = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(uri);
  };

  const filteredHistorial = historial.filter((h) =>
    `${h.nombre} ${h.grupo}`.toLowerCase().includes(searchHistorial.toLowerCase())
  );

  const filteredLiquidos = inventarioLiquidos.datos.filter((r) =>
    r.nombre.replace(/_/g, ' ').toLowerCase().includes(searchLiquidos.toLowerCase())
  );

  const filteredSolidos = inventarioSolidos.datos.filter((r) =>
    r.nombre.replace(/_/g, ' ').toLowerCase().includes(searchSolidos.toLowerCase())
  );

  const downloadAdeudosPDF = async () => {
    if (!grupoDetalle) return;
    const html = `
      <html>
        <body>
          <h1>Adeudos de ${grupoDetalle.nombre}</h1>
          <table style="width:100%; border-collapse: collapse;">
            <thead>
              <tr>
                <th style="border: 1px solid black; padding: 8px;">Cantidad</th>
                <th style="border: 1px solid black; padding: 8px;">Material</th>
                <th style="border: 1px solid black; padding: 8px;">Solicitante</th>
              </tr>
            </thead>
            <tbody>
              ${grupoDetalle.adeudos.map((a) => `
                <tr>
                  <td style="border: 1px solid black; padding: 8px;">${a.cantidad} ${a.unidad}</td>
                  <td style="border: 1px solid black; padding: 8px;">${a.nombre_material}</td>
                  <td style="border: 1px solid black; padding: 8px;">${a.solicitante}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const { uri } = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(uri);
  };

  const downloadInventarioLiquidosPDF = async () => {
    const html = `
      <html>
        <body>
          <h1>Inventario Reactivos Líquidos</h1>
          <table style="width:100%; border-collapse: collapse;">
            <thead>
              <tr>
                <th style="border: 1px solid black; padding: 8px;">Reactivo</th>
                <th style="border: 1px solid black; padding: 8px;">Cantidad</th>
                ${inventarioLiquidos.meses.map((m) => `<th style="border: 1px solid black; padding: 8px;">${m}</th>`).join('')}
                <th style="border: 1px solid black; padding: 8px;">Existencia Final</th>
                <th style="border: 1px solid black; padding: 8px;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${filteredLiquidos.map((r) => `
                <tr>
                  <td style="border: 1px solid black; padding: 8px;">${r.nombre.replace(/_/g, ' ')}</td>
                  <td style="border: 1px solid black; padding: 8px;">${r.cantidad_inicial} ${r.unidad}</td>
                  ${inventarioLiquidos.meses.map((m) => `<td style="border: 1px solid black; padding: 8px;">${r.consumos[m] || 0}</td>`).join('')}
                  <td style="border: 1px solid black; padding: 8px;">${r.existencia_final} ${r.unidad}</td>
                  <td style="border: 1px solid black; padding: 8px;">${r.total_consumido} ${r.unidad}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const { uri } = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(uri);
  };

  const downloadInventarioSolidosPDF = async () => {
    const html = `
      <html>
        <body>
          <h1>Inventario Reactivos Sólidos</h1>
          <table style="width:100%; border-collapse: collapse;">
            <thead>
              <tr>
                <th style="border: 1px solid black; padding: 8px;">Reactivo</th>
                <th style="border: 1px solid black; padding: 8px;">Cantidad</th>
                ${inventarioSolidos.meses.map((m) => `<th style="border: 1px solid black; padding: 8px;">${m}</th>`).join('')}
                <th style="border: 1px solid black; padding: 8px;">Existencia Final</th>
                <th style="border: 1px solid black; padding: 8px;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${filteredSolidos.map((r) => `
                <tr>
                  <td style="border: 1px solid black; padding: 8px;">${r.nombre.replace(/_/g, ' ')}</td>
                  <td style="border: 1px solid black; padding: 8px;">${r.cantidad_inicial} ${r.unidad}</td>
                  ${inventarioSolidos.meses.map((m) => `<td style="border: 1px solid black; padding: 8px;">${r.consumos[m] || 0}</td>`).join('')}
                  <td style="border: 1px solid black; padding: 8px;">${r.existencia_final} ${r.unidad}</td>
                  <td style="border: 1px solid black; padding: 8px;">${r.total_consumido} ${r.unidad}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const { uri } = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(uri);
  };

  if (![3, 4].includes(usuario?.rol_id)) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LinearGradient colors={['#f9fafb', '#f3f4f6']} style={styles.container}>
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={24} color="#ef4444" style={styles.errorIcon} />
            <Text style={styles.errorText}>Acceso denegado</Text>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={['#f9fafb', '#f3f4f6']} style={styles.container}>
        {loading ? (
          <ActivityIndicator size="large" color="#3b82f6" style={styles.loading} />
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Text style={[styles.title, { fontSize: isTablet ? 28 : 20 }]}>Reportes</Text>

            {/* Historial de Residuos */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleContainer}>
                  <Ionicons name="trash-outline" size={20} color="#3b82f6" style={styles.icon} />
                  <Text style={[styles.cardTitle, { color: '#3b82f6' }]}>Historial de Residuos</Text>
                </View>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Grupo, Nombre..."
                  value={searchHistorial}
                  onChangeText={setSearchHistorial}
                />
              </View>
              {filteredHistorial.length === 0 ? (
                <View style={styles.noDataContainer}>
                  <Ionicons name="information-circle-outline" size={20} color="#6b7280" style={styles.icon} />
                  <Text style={styles.noData}>No hay registros.</Text>
                </View>
              ) : (
                <>
                  <View>
                    <View style={[styles.tableHeader, { backgroundColor: '#3b82f6' }]}>
                      <Text style={[styles.tableHeaderCell, { color: '#ffffff', minWidth: 150 }]}>Nombre</Text>
                      <Text style={[styles.tableHeaderCell, { color: '#ffffff', minWidth: 100 }]}>Grupo</Text>
                      <Text style={[styles.tableHeaderCell, { color: '#ffffff', minWidth: 100 }]}>Acciones</Text>
                    </View>
                    {filteredHistorial.slice(0, 5).map((h, idx) => (
                      <View style={[styles.tableRow, { borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }]} key={idx}>
                        <Text style={[styles.tableCell, { minWidth: 150 }]}>{h.nombre}</Text>
                        <Text style={[styles.tableCell, { minWidth: 100 }]}>{h.grupo}</Text>
                        <View style={[styles.actionButtons, { minWidth: 100 }]}>
                          <TouchableOpacity onPress={() => downloadHistorialCSV(h.registros, h.nombre)}>
                            <Ionicons name="download-outline" size={20} color="#3b82f6" />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => downloadHistorialPDF(h.registros, h.nombre)}>
                            <Ionicons name="document-text-outline" size={20} color="#22c55e" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                  {filteredHistorial.length > 5 && (
                    <TouchableOpacity style={styles.showMore} onPress={() => setShowHistorialModal(true)}>
                      <Ionicons name="chevron-down-outline" size={16} color="#3b82f6" style={styles.icon} />
                      <Text style={styles.showMoreText}>Mostrar más</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>

            {/* Grupos con Adeudos */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleContainer}>
                  <Ionicons name="people-outline" size={20} color="#14b8a6" style={styles.icon} />
                  <Text style={[styles.cardTitle, { color: '#14b8a6' }]}>Grupos con Adeudos</Text>
                </View>
              </View>
              {grupos.length === 0 ? (
                <View style={styles.noDataContainer}>
                  <Ionicons name="information-circle-outline" size={20} color="#6b7280" style={styles.icon} />
                  <Text style={styles.noData}>No hay grupos.</Text>
                </View>
              ) : (
                <>
                  <View>
                    <View style={[styles.tableHeader, { backgroundColor: '#14b8a6' }]}>
                      <Text style={[styles.tableHeaderCell, { color: '#ffffff', minWidth: 150 }]}>Nombre</Text>
                    </View>
                    {grupos.slice(0, 5).map((g, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={[styles.tableRow, grupoDetalle?.nombre === g.nombre ? styles.tableRowActive : null, { borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }]}
                        onPress={() => setGrupoDetalle(g)}
                      >
                        <Text style={[styles.tableCell, { minWidth: 150 }]}>{g.nombre}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {grupos.length > 5 && (
                    <TouchableOpacity style={styles.showMore} onPress={() => setShowGruposModal(true)}>
                      <Ionicons name="chevron-down-outline" size={16} color="#3b82f6" style={styles.icon} />
                      <Text style={styles.showMoreText}>Mostrar más</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>

            {/* Adeudos del Grupo Seleccionado */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleContainer}>
                  <Ionicons name="list-outline" size={20} color="#14b8a6" style={styles.icon} />
                  <Text style={[styles.cardTitle, { color: '#14b8a6' }]}>
                    {grupoDetalle ? `Adeudos de ${grupoDetalle.nombre}` : 'Adeudos del Grupo Seleccionado'}
                  </Text>
                </View>
                {grupoDetalle && grupoDetalle.adeudos.length > 0 && (
                  <TouchableOpacity onPress={downloadAdeudosPDF}>
                    <Ionicons name="document-text-outline" size={20} color="#ef4444" />
                  </TouchableOpacity>
                )}
              </View>
              {grupoDetalle ? (
                grupoDetalle.adeudos.length === 0 ? (
                  <View style={styles.noDataContainer}>
                    <Ionicons name="information-circle-outline" size={20} color="#6b7280" style={styles.icon} />
                    <Text style={styles.noData}>Sin adeudos</Text>
                  </View>
                ) : (
                  <>
                    <View>
                      <View style={[styles.tableHeader, { backgroundColor: '#14b8a6' }]}>
                        <Text style={[styles.tableHeaderCell, { color: '#ffffff', minWidth: 100 }]}>Cantidad</Text>
                        <Text style={[styles.tableHeaderCell, { color: '#ffffff', minWidth: 150 }]}>Material</Text>
                        <Text style={[styles.tableHeaderCell, { color: '#ffffff', minWidth: 150 }]}>Solicitante</Text>
                      </View>
                      {grupoDetalle.adeudos.slice(0, 5).map((a, idx) => (
                        <View style={[styles.tableRow, { borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }]} key={idx}>
                          <Text style={[styles.tableCell, { minWidth: 100 }]}>{a.cantidad} {a.unidad}</Text>
                          <Text style={[styles.tableCell, { minWidth: 150 }]}>{a.nombre_material}</Text>
                          <Text style={[styles.tableCell, { minWidth: 150 }]}>{a.solicitante}</Text>
                        </View>
                      ))}
                    </View>
                    {grupoDetalle.adeudos.length > 5 && (
                      <TouchableOpacity style={styles.showMore} onPress={() => setShowGrupoAdeudosModal(true)}>
                        <Ionicons name="chevron-down-outline" size={16} color="#3b82f6" style={styles.icon} />
                        <Text style={styles.showMoreText}>Ver más</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )
              ) : (
                <View style={styles.noDataContainer}>
                  <Ionicons name="information-circle-outline" size={20} color="#6b7280" style={styles.icon} />
                  <Text style={styles.noData}>Selecciona un grupo para ver los adeudos</Text>
                </View>
              )}
            </View>

            {/* Inventario Reactivos Líquidos */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleContainer}>
                  <Ionicons name="water-outline" size={20} color="#06b6d4" style={styles.icon} />
                  <Text style={[styles.cardTitle, { color: '#06b6d4' }]}>Inventario Reactivos Líquidos</Text>
                </View>
                <View style={styles.cardHeaderActions}>
                  <TouchableOpacity onPress={downloadInventarioLiquidosPDF} disabled={filteredLiquidos.length === 0}>
                    <Ionicons name="document-text-outline" size={20} color="#ef4444" />
                  </TouchableOpacity>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Reactivo..."
                    value={searchLiquidos}
                    onChangeText={setSearchLiquidos}
                  />
                </View>
              </View>
              {filteredLiquidos.length === 0 ? (
                <View style={styles.noDataContainer}>
                  <Ionicons name="information-circle-outline" size={20} color="#6b7280" style={styles.icon} />
                  <Text style={styles.noData}>No hay registros.</Text>
                </View>
              ) : (
                <>
                  <ScrollView horizontal>
                    <View>
                      <View style={[styles.tableHeader, { backgroundColor: '#06b6d4' }]}>
                        <Text style={[styles.tableHeaderCell, { color: '#ffffff', minWidth: 150 }]}>Reactivo</Text>
                        <Text style={[styles.tableHeaderCell, { color: '#ffffff', minWidth: 100 }]}>Cantidad</Text>
                        {inventarioLiquidos.meses.map((m) => (
                          <Text key={m} style={[styles.tableHeaderCell, { color: '#ffffff', minWidth: 100 }]}>
                            {m}
                          </Text>
                        ))}
                        <Text style={[styles.tableHeaderCell, { color: '#ffffff', minWidth: 100 }]}>Existencia Final</Text>
                        <Text style={[styles.tableHeaderCell, { color: '#ffffff', minWidth: 100 }]}>Total</Text>
                      </View>
                      {filteredLiquidos.slice(0, 5).map((r, idx) => (
                        <View style={[styles.tableRow, { borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }]} key={idx}>
                          <Text style={[styles.tableCell, { minWidth: 150 }]}>{r.nombre.replace(/_/g, ' ')}</Text>
                          <Text style={[styles.tableCell, { minWidth: 100 }]}>{r.cantidad_inicial} {r.unidad}</Text>
                          {inventarioLiquidos.meses.map((m) => (
                            <Text key={m} style={[styles.tableCell, { minWidth: 100 }]}>
                              {r.consumos[m] || 0}
                            </Text>
                          ))}
                          <Text style={[styles.tableCell, { minWidth: 100 }]}>{r.existencia_final} {r.unidad}</Text>
                          <Text style={[styles.tableCell, { minWidth: 100 }]}>{r.total_consumido} {r.unidad}</Text>
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                  {filteredLiquidos.length > 5 && (
                    <TouchableOpacity style={styles.showMore} onPress={() => setShowLiquidosModal(true)}>
                      <Ionicons name="chevron-down-outline" size={16} color="#3b82f6" style={styles.icon} />
                      <Text style={styles.showMoreText}>Mostrar más</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>

            {/* Inventario Reactivos Sólidos */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleContainer}>
                  <Ionicons name="cube-outline" size={20} color="#8b5cf6" style={styles.icon} />
                  <Text style={[styles.cardTitle, { color: '#8b5cf6' }]}>Inventario Reactivos Sólidos</Text>
                </View>
                <View style={styles.cardHeaderActions}>
                  <TouchableOpacity onPress={downloadInventarioSolidosPDF} disabled={filteredSolidos.length === 0}>
                    <Ionicons name="document-text-outline" size={20} color="#ef4444" />
                  </TouchableOpacity>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Reactivo..."
                    value={searchSolidos}
                    onChangeText={setSearchSolidos}
                  />
                </View>
              </View>
              {filteredSolidos.length === 0 ? (
                <View style={styles.noDataContainer}>
                  <Ionicons name="information-circle-outline" size={20} color="#6b7280" style={styles.icon} />
                  <Text style={styles.noData}>No hay registros.</Text>
                </View>
              ) : (
                <>
                  <ScrollView horizontal>
                    <View>
                      <View style={[styles.tableHeader, { backgroundColor: '#8b5cf6' }]}>
                        <Text style={[styles.tableHeaderCell, { color: '#ffffff', minWidth: 150 }]}>Reactivo</Text>
                        <Text style={[styles.tableHeaderCell, { color: '#ffffff', minWidth: 100 }]}>Cantidad</Text>
                        {inventarioSolidos.meses.map((m) => (
                          <Text key={m} style={[styles.tableHeaderCell, { color: '#ffffff', minWidth: 100 }]}>
                            {m}
                          </Text>
                        ))}
                        <Text style={[styles.tableHeaderCell, { color: '#ffffff', minWidth: 100 }]}>Existencia Final</Text>
                        <Text style={[styles.tableHeaderCell, { color: '#ffffff', minWidth: 100 }]}>Total</Text>
                      </View>
                      {filteredSolidos.slice(0, 5).map((r, idx) => (
                        <View style={[styles.tableRow, { borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }]} key={idx}>
                          <Text style={[styles.tableCell, { minWidth: 150 }]}>{r.nombre.replace(/_/g, ' ')}</Text>
                          <Text style={[styles.tableCell, { minWidth: 100 }]}>{r.cantidad_inicial} {r.unidad}</Text>
                          {inventarioSolidos.meses.map((m) => (
                            <Text key={m} style={[styles.tableCell, { minWidth: 100 }]}>
                              {r.consumos[m] || 0}
                            </Text>
                          ))}
                          <Text style={[styles.tableCell, { minWidth: 100 }]}>{r.existencia_final} {r.unidad}</Text>
                          <Text style={[styles.tableCell, { minWidth: 100 }]}>{r.total_consumido} {r.unidad}</Text>
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                  {filteredSolidos.length > 5 && (
                    <TouchableOpacity style={styles.showMore} onPress={() => setShowSolidosModal(true)}>
                      <Ionicons name="chevron-down-outline" size={16} color="#3b82f6" style={styles.icon} />
                      <Text style={styles.showMoreText}>Mostrar más</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          </ScrollView>
        )}
      </LinearGradient>

      {/* Modal Historial de Residuos */}
      <Modal
        visible={showHistorialModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowHistorialModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { maxWidth: isTablet ? '80%' : '90%' }]}>
            <View style={styles.modalHeader}>
              <View style={styles.cardTitleContainer}>
                <Ionicons name="trash-outline" size={20} color="#3b82f6" style={styles.icon} />
                <Text style={[styles.modalTitle, { color: '#3b82f6' }]}>Historial de Residuos</Text>
              </View>
              <TouchableOpacity onPress={() => setShowHistorialModal(false)}>
                <Ionicons name="close" size={24} color="#ef4444" />
              </TouchableOpacity>
            </View>
            <View>
              <View style={[styles.tableHeader, { backgroundColor: '#3b82f6' }]}>
                <Text style={[styles.tableHeaderCell, { color: '#ffffff', minWidth: 150 }]}>Nombre</Text>
                <Text style={[styles.tableHeaderCell, { color: '#ffffff', minWidth: 100 }]}>Grupo</Text>
                <Text style={[styles.tableHeaderCell, { color: '#ffffff', minWidth: 100 }]}>Acciones</Text>
              </View>
              {filteredHistorial.map((h, idx) => (
                <View style={[styles.tableRow, { borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }]} key={idx}>
                  <Text style={[styles.tableCell, { minWidth: 150 }]}>{h.nombre}</Text>
                  <Text style={[styles.tableCell, { minWidth: 100 }]}>{h.grupo}</Text>
                  <View style={[styles.actionButtons, { minWidth: 100 }]}>
                    <TouchableOpacity onPress={() => downloadHistorialCSV(h.registros, h.nombre)}>
                      <Ionicons name="download-outline" size={20} color="#3b82f6" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => downloadHistorialPDF(h.registros, h.nombre)}>
                      <Ionicons name="document-text-outline" size={20} color="#22c55e" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Grupos */}
      <Modal
        visible={showGruposModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowGruposModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { maxWidth: isTablet ? '80%' : '90%' }]}>
            <View style={styles.modalHeader}>
              <View style={styles.cardTitleContainer}>
                <Ionicons name="people-outline" size={20} color="#14b8a6" style={styles.icon} />
                <Text style={[styles.modalTitle, { color: '#14b8a6' }]}>Grupos</Text>
              </View>
              <TouchableOpacity onPress={() => setShowGruposModal(false)}>
                <Ionicons name="close" size={24} color="#ef4444" />
              </TouchableOpacity>
            </View>
            <View>
              <View style={[styles.tableHeader, { backgroundColor: '#14b8a6' }]}>
                <Text style={[styles.tableHeaderCell, { color: '#ffffff', minWidth: 150 }]}>Nombre</Text>
              </View>
              {grupos.map((g, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[styles.tableRow, { borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }]}
                  onPress={() => {
                    setGrupoDetalle(g);
                    setShowGruposModal(false);
                  }}
                >
                  <Text style={[styles.tableCell, { minWidth: 150 }]}>{g.nombre}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Adeudos del Grupo */}
      <Modal
        visible={showGrupoAdeudosModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowGrupoAdeudosModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { maxWidth: isTablet ? '80%' : '90%' }]}>
            <View style={styles.modalHeader}>
              <View style={styles.cardTitleContainer}>
                <Ionicons name="list-outline" size={20} color="#14b8a6" style={styles.icon} />
                <Text style={[styles.modalTitle, { color: '#14b8a6' }]}>{grupoDetalle?.nombre}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowGrupoAdeudosModal(false)}>
                <Ionicons name="close" size={24} color="#ef4444" />
              </TouchableOpacity>
            </View>
            <View>
              <View style={[styles.tableHeader, { backgroundColor: '#14b8a6' }]}>
                <Text style={[styles.tableHeaderCell, { color: '#ffffff', minWidth: 100 }]}>Cantidad</Text>
                <Text style={[styles.tableHeaderCell, { color: '#ffffff', minWidth: 150 }]}>Material</Text>
                <Text style={[styles.tableHeaderCell, { color: '#ffffff', minWidth: 150 }]}>Solicitante</Text>
              </View>
              {grupoDetalle?.adeudos.map((a, idx) => (
                <View style={[styles.tableRow, { borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }]} key={idx}>
                  <Text style={[styles.tableCell, { minWidth: 100 }]}>{a.cantidad} {a.unidad}</Text>
                  <Text style={[styles.tableCell, { minWidth: 150 }]}>{a.nombre_material}</Text>
                  <Text style={[styles.tableCell, { minWidth: 150 }]}>{a.solicitante}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Inventario Reactivos Líquidos */}
      <Modal
        visible={showLiquidosModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowLiquidosModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { maxWidth: isTablet ? '80%' : '90%' }]}>
            <View style={styles.modalHeader}>
              <View style={styles.cardTitleContainer}>
                <Ionicons name="water-outline" size={20} color="#06b6d4" style={styles.icon} />
                <Text style={[styles.modalTitle, { color: '#06b6d4' }]}>Inventario Reactivos Líquidos</Text>
              </View>
              <TouchableOpacity onPress={() => setShowLiquidosModal(false)}>
                <Ionicons name="close" size={24} color="#ef4444" />
              </TouchableOpacity>
            </View>
            <ScrollView horizontal>
              <ScrollView>
                <View>
                  <View style={[styles.tableHeader, { backgroundColor: '#06b6d4' }]}>
                    <Text style={[styles.tableHeaderCell, { color: '#ffffff', minWidth: 150 }]}>Reactivo</Text>
                    <Text style={[styles.tableHeaderCell, { color: '#ffffff', minWidth: 100 }]}>Cantidad</Text>
                    {inventarioLiquidos.meses.map((m) => (
                      <Text key={m} style={[styles.tableHeaderCell, { color: '#ffffff', minWidth: 100 }]}>
                        {m}
                      </Text>
                    ))}
                    <Text style={[styles.tableHeaderCell, { color: '#ffffff', minWidth: 100 }]}>Existencia Final</Text>
                    <Text style={[styles.tableHeaderCell, { color: '#ffffff', minWidth: 100 }]}>Total</Text>
                  </View>
                  {filteredLiquidos.length === 0 ? (
                    <View style={styles.noDataContainer}>
                      <Ionicons name="information-circle-outline" size={20} color="#6b7280" style={styles.icon} />
                      <Text style={styles.noData}>No hay registros.</Text>
                    </View>
                  ) : (
                    filteredLiquidos.map((r, idx) => (
                      <View style={[styles.tableRow, { borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }]} key={idx}>
                        <Text style={[styles.tableCell, { minWidth: 150 }]}>{r.nombre.replace(/_/g, ' ')}</Text>
                        <Text style={[styles.tableCell, { minWidth: 100 }]}>{r.cantidad_inicial} {r.unidad}</Text>
                        {inventarioLiquidos.meses.map((m) => (
                          <Text key={m} style={[styles.tableCell, { minWidth: 100 }]}>
                            {r.consumos[m] || 0}
                          </Text>
                        ))}
                        <Text style={[styles.tableCell, { minWidth: 100 }]}>{r.existencia_final} {r.unidad}</Text>
                        <Text style={[styles.tableCell, { minWidth: 100 }]}>{r.total_consumido} {r.unidad}</Text>
                      </View>
                    ))
                  )}
                </View>
              </ScrollView>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal Inventario Reactivos Sólidos */}
      <Modal
        visible={showSolidosModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSolidosModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { maxWidth: isTablet ? '80%' : '90%' }]}>
            <View style={styles.modalHeader}>
              <View style={styles.cardTitleContainer}>
                <Ionicons name="cube-outline" size={20} color="#8b5cf6" style={styles.icon} />
                <Text style={[styles.modalTitle, { color: '#8b5cf6' }]}>Inventario Reactivos Sólidos</Text>
              </View>
              <TouchableOpacity onPress={() => setShowSolidosModal(false)}>
                <Ionicons name="close" size={24} color="#ef4444" />
              </TouchableOpacity>
            </View>
            <ScrollView horizontal>
              <ScrollView>
                <View>
                  <View style={[styles.tableHeader, { backgroundColor: '#8b5cf6' }]}>
                    <Text style={[styles.tableHeaderCell, { color: '#ffffff', minWidth: 150 }]}>Reactivo</Text>
                    <Text style={[styles.tableHeaderCell, { color: '#ffffff', minWidth: 100 }]}>Cantidad</Text>
                    {inventarioSolidos.meses.map((m) => (
                      <Text key={m} style={[styles.tableHeaderCell, { color: '#ffffff', minWidth: 100 }]}>
                        {m}
                      </Text>
                    ))}
                    <Text style={[styles.tableHeaderCell, { color: '#ffffff', minWidth: 100 }]}>Existencia Final</Text>
                    <Text style={[styles.tableHeaderCell, { color: '#ffffff', minWidth: 100 }]}>Total</Text>
                  </View>
                  {filteredSolidos.length === 0 ? (
                    <View style={styles.noDataContainer}>
                      <Ionicons name="information-circle-outline" size={20} color="#6b7280" style={styles.icon} />
                      <Text style={styles.noData}>No hay registros.</Text>
                    </View>
                  ) : (
                    filteredSolidos.map((r, idx) => (
                      <View style={[styles.tableRow, { borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }]} key={idx}>
                        <Text style={[styles.tableCell, { minWidth: 150 }]}>{r.nombre.replace(/_/g, ' ')}</Text>
                        <Text style={[styles.tableCell, { minWidth: 100 }]}>{r.cantidad_inicial} {r.unidad}</Text>
                        {inventarioSolidos.meses.map((m) => (
                          <Text key={m} style={[styles.tableCell, { minWidth: 100 }]}>
                            {r.consumos[m] || 0}
                          </Text>
                        ))}
                        <Text style={[styles.tableCell, { minWidth: 100 }]}>{r.existencia_final} {r.unidad}</Text>
                        <Text style={[styles.tableCell, { minWidth: 100 }]}>{r.total_consumido} {r.unidad}</Text>
                      </View>
                    ))
                  )}
                </View>
              </ScrollView>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#f9fafb', // Fallback background color
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
  },
  title: {
    fontSize: 20, // Reduced for mobile, matches max-width: 576px
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#1e293b',
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 10,
    padding: 12, // Reduced for mobile, matches max-width: 768px
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  cardTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 16, // Reduced for mobile
    fontWeight: 'bold',
    marginLeft: 8,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 8,
    padding: 8,
    fontSize: 12, // Reduced for mobile
    maxWidth: 160, // Adjusted for smaller screens
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  noDataContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  noData: {
    fontSize: 12, // Reduced for mobile
    color: '#6b7280',
    textAlign: 'center',
    marginLeft: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  tableHeaderCell: {
    flex: 1,
    fontSize: 12, // Reduced for mobile
    fontWeight: 'bold',
    textAlign: 'center',
    padding: 8,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tableRowActive: {
    backgroundColor: 'rgba(20, 184, 166, 0.2)',
  },
  tableCell: {
    flex: 1,
    fontSize: 12, // Reduced for mobile
    color: '#4b5563',
    textAlign: 'center',
    padding: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  showMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  showMoreText: {
    fontSize: 12, // Reduced for mobile
    color: '#3b82f6',
    textDecorationLine: 'underline',
    marginLeft: 4,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  modalContent: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 10,
    padding: 12, // Reduced for mobile
    maxHeight: '80%',
    width: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 16, // Reduced for mobile
    fontWeight: 'bold',
    marginLeft: 8,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  errorText: {
    fontSize: 16, // Reduced for mobile
    color: '#ef4444',
    marginLeft: 8,
  },
  icon: {
    marginRight: 4,
  },
  errorIcon: {
    marginRight: 8,
  },
});