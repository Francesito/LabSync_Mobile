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
      <View style={styles.container}>
        <Text style={styles.errorText}>Acceso denegado</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={['#f9fafb', '#f3f4f6']} style={styles.container}>
        {loading ? (
          <ActivityIndicator size="large" color="#3b82f6" style={styles.loading} />
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Text style={[styles.title, { fontSize: isTablet ? 32 : 24 }]}>Reportes</Text>

            <View style={styles.row}>
              {/* Historial de Residuos */}
              <View style={[styles.card, { flex: isTablet ? 0.3 : 1 }]}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Historial de Residuos</Text>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Grupo, Nombre..."
                    value={searchHistorial}
                    onChangeText={setSearchHistorial}
                  />
                </View>
                {filteredHistorial.length === 0 ? (
                  <Text style={styles.noData}>No hay registros.</Text>
                ) : (
                  <>
                    <View>
                      <View style={styles.tableHeader}>
                        <Text style={styles.tableHeaderCell}>Nombre</Text>
                        <Text style={styles.tableHeaderCell}>Grupo</Text>
                        <Text style={styles.tableHeaderCell}>Acciones</Text>
                      </View>
                      {filteredHistorial.slice(0, 5).map((h, idx) => (
                        <View style={styles.tableRow} key={idx}>
                          <Text style={styles.tableCell}>{h.nombre}</Text>
                          <Text style={styles.tableCell}>{h.grupo}</Text>
                          <View style={styles.actionButtons}>
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
                        <Text style={styles.showMoreText}>Mostrar más</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>

              {/* Grupos con Adeudos */}
              <View style={[styles.card, { flex: isTablet ? 0.3 : 1 }]}>
                <Text style={styles.cardTitle}>Grupos con Adeudos</Text>
                {grupos.length === 0 ? (
                  <Text style={styles.noData}>No hay grupos.</Text>
                ) : (
                  <>
                    <View>
                      <View style={styles.tableHeader}>
                        <Text style={styles.tableHeaderCell}>Nombre</Text>
                      </View>
                      {grupos.slice(0, 5).map((g, idx) => (
                        <TouchableOpacity
                          key={idx}
                          style={styles.tableRow}
                          onPress={() => setGrupoDetalle(g)}
                        >
                          <Text style={styles.tableCell}>{g.nombre}</Text>
                        </TouchableOpacity>
                       ))}
                    </View>
                    {grupos.length > 5 && (
                      <TouchableOpacity style={styles.showMore} onPress={() => setShowGruposModal(true)}>
                        <Text style={styles.showMoreText}>Mostrar más</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>

              {/* Adeudos del Grupo Seleccionado */}
              <View style={[styles.card, { flex: isTablet ? 0.3 : 1 }]}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>
                    {grupoDetalle ? `Adeudos de ${grupoDetalle.nombre}` : 'Adeudos del Grupo Seleccionado'}
                  </Text>
                  {grupoDetalle && grupoDetalle.adeudos.length > 0 && (
                    <TouchableOpacity onPress={downloadAdeudosPDF}>
                      <Ionicons name="download-outline" size={20} color="#ef4444" />
                    </TouchableOpacity>
                  )}
                </View>
                {grupoDetalle ? (
                  grupoDetalle.adeudos.length === 0 ? (
                    <Text style={styles.noData}>Sin adeudos</Text>
                  ) : (
                    <>
                     <View>
                        <View style={styles.tableHeader}>
                          <Text style={styles.tableHeaderCell}>Cantidad</Text>
                          <Text style={styles.tableHeaderCell}>Material</Text>
                          <Text style={styles.tableHeaderCell}>Solicitante</Text>
                        </View>
                        {grupoDetalle.adeudos.slice(0, 5).map((a, idx) => (
                          <View style={styles.tableRow} key={idx}>
                            <Text style={styles.tableCell}>
                              {a.cantidad} {a.unidad}
                            </Text>
                            <Text style={styles.tableCell}>{a.nombre_material}</Text>
                            <Text style={styles.tableCell}>{a.solicitante}</Text>
                          </View>
                      ))}
                      </View>
                      {grupoDetalle.adeudos.length > 5 && (
                       <TouchableOpacity
                          style={styles.showMore}
                          onPress={() => setShowGrupoAdeudosModal(true)}
                        >
                          <Text style={styles.showMoreText}>Ver más</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )
                ) : (
                  <Text style={styles.noData}>Selecciona un grupo para ver los adeudos</Text>
                )}
              </View>
            </View>

            {/* Inventario Reactivos Líquidos */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Inventario Reactivos Líquidos</Text>
                <TouchableOpacity onPress={downloadInventarioLiquidosPDF} disabled={filteredLiquidos.length === 0}>
                  <Ionicons name="download-outline" size={20} color="#ef4444" />
                </TouchableOpacity>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Reactivo..."
                  value={searchLiquidos}
                  onChangeText={setSearchLiquidos}
                />
              </View>
              {filteredLiquidos.length === 0 ? (
                <Text style={styles.noData}>No hay registros.</Text>
              ) : (
                <>
                  <ScrollView horizontal>
                    <View>
                      <View style={styles.tableHeader}>
                        <Text style={styles.tableHeaderCell}>Reactivo</Text>
                        <Text style={styles.tableHeaderCell}>Cantidad</Text>
                        {inventarioLiquidos.meses.map((m) => (
                          <Text key={m} style={styles.tableHeaderCell}>
                            {m}
                          </Text>
                        ))}
                        <Text style={styles.tableHeaderCell}>Existencia Final</Text>
                        <Text style={styles.tableHeaderCell}>Total</Text>
                      </View>
                      {filteredLiquidos.slice(0, 5).map((r, idx) => (
                        <View style={styles.tableRow} key={idx}>
                          <Text style={styles.tableCell}>{r.nombre.replace(/_/g, ' ')}</Text>
                          <Text style={styles.tableCell}>
                            {r.cantidad_inicial} {r.unidad}
                          </Text>
                          {inventarioLiquidos.meses.map((m) => (
                            <Text key={m} style={styles.tableCell}>
                              {r.consumos[m] || 0}
                            </Text>
                          ))}
                         <Text style={styles.tableCell}>
                            {r.existencia_final} {r.unidad}
                          </Text>
                          <Text style={styles.tableCell}>
                            {r.total_consumido} {r.unidad}
                          </Text>
                        </View>
                     ))}
                    </View>
                  </ScrollView>
                  {filteredLiquidos.length > 5 && (
                    <TouchableOpacity style={styles.showMore} onPress={() => setShowLiquidosModal(true)}>
                      <Text style={styles.showMoreText}>Mostrar más</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>

            {/* Inventario Reactivos Sólidos */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Inventario Reactivos Sólidos</Text>
                <TouchableOpacity onPress={downloadInventarioSolidosPDF} disabled={filteredSolidos.length === 0}>
                  <Ionicons name="download-outline" size={20} color="#ef4444" />
                </TouchableOpacity>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Reactivo..."
                  value={searchSolidos}
                  onChangeText={setSearchSolidos}
                />
              </View>
              {filteredSolidos.length === 0 ? (
                <Text style={styles.noData}>No hay registros.</Text>
              ) : (
                <>
                  <ScrollView horizontal>
                    <View>
                      <View style={styles.tableHeader}>
                        <Text style={styles.tableHeaderCell}>Reactivo</Text>
                        <Text style={styles.tableHeaderCell}>Cantidad</Text>
                        {inventarioSolidos.meses.map((m) => (
                          <Text key={m} style={styles.tableHeaderCell}>
                            {m}
                          </Text>
                        ))}
                        <Text style={styles.tableHeaderCell}>Existencia Final</Text>
                        <Text style={styles.tableHeaderCell}>Total</Text>
                      </View>
                      {filteredSolidos.slice(0, 5).map((r, idx) => (
                        <View style={styles.tableRow} key={idx}>
                          <Text style={styles.tableCell}>{r.nombre.replace(/_/g, ' ')}</Text>
                         <Text style={styles.tableCell}>
                            {r.cantidad_inicial} {r.unidad}
                          </Text>
                          {inventarioSolidos.meses.map((m) => (
                            <Text key={m} style={styles.tableCell}>
                              {r.consumos[m] || 0}
                            </Text>
                          ))}
                        <Text style={styles.tableCell}>
                            {r.existencia_final} {r.unidad}
                          </Text>
                          <Text style={styles.tableCell}>
                            {r.total_consumido} {r.unidad}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                  {filteredSolidos.length > 5 && (
                    <TouchableOpacity style={styles.showMore} onPress={() => setShowSolidosModal(true)}>
                      <Text style={styles.showMoreText}>Mostrar más</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          </ScrollView>
        )}
      </LinearGradient>

      {/* Modales */}
      <Modal
        visible={showHistorialModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowHistorialModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Historial de Residuos</Text>
              <TouchableOpacity onPress={() => setShowHistorialModal(false)}>
                <Ionicons name="close" size={24} color="#ef4444" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={filteredHistorial}
              keyExtractor={(_, idx) => idx.toString()}
              renderItem={({ item: h }) => (
                <View style={styles.tableRow}>
                  <Text style={styles.tableCell}>{h.nombre}</Text>
                  <Text style={styles.tableCell}>{h.grupo}</Text>
                  <View style={styles.actionButtons}>
                    <TouchableOpacity onPress={() => downloadHistorialCSV(h.registros, h.nombre)}>
                      <Ionicons name="download-outline" size={20} color="#3b82f6" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => downloadHistorialPDF(h.registros, h.nombre)}>
                      <Ionicons name="document-text-outline" size={20} color="#22c55e" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              ListHeaderComponent={
                <View style={styles.tableHeader}>
                  <Text style={styles.tableHeaderCell}>Nombre</Text>
                  <Text style={styles.tableHeaderCell}>Grupo</Text>
                  <Text style={styles.tableHeaderCell}>Acciones</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={showGruposModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowGruposModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Grupos</Text>
              <TouchableOpacity onPress={() => setShowGruposModal(false)}>
                <Ionicons name="close" size={24} color="#ef4444" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={grupos}
              keyExtractor={(_, idx) => idx.toString()}
              renderItem={({ item: g }) => (
                <TouchableOpacity style={styles.tableRow} onPress={() => {
                  setGrupoDetalle(g);
                  setShowGruposModal(false);
                }}>
                  <Text style={styles.tableCell}>{g.nombre}</Text>
                </TouchableOpacity>
              )}
              ListHeaderComponent={
                <View style={styles.tableHeader}>
                  <Text style={styles.tableHeaderCell}>Nombre</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={showGrupoAdeudosModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowGrupoAdeudosModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{grupoDetalle?.nombre}</Text>
              <TouchableOpacity onPress={() => setShowGrupoAdeudosModal(false)}>
                <Ionicons name="close" size={24} color="#ef4444" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={grupoDetalle?.adeudos || []}
              keyExtractor={(_, idx) => idx.toString()}
              renderItem={({ item: a }) => (
                <View style={styles.tableRow}>
                  <Text style={styles.tableCell}>{a.cantidad} {a.unidad}</Text>
                  <Text style={styles.tableCell}>{a.nombre_material}</Text>
                  <Text style={styles.tableCell}>{a.solicitante}</Text>
                </View>
              )}
              ListHeaderComponent={
                <View style={styles.tableHeader}>
                  <Text style={styles.tableHeaderCell}>Cantidad</Text>
                  <Text style={styles.tableHeaderCell}>Material</Text>
                  <Text style={styles.tableHeaderCell}>Solicitante</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={showLiquidosModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowLiquidosModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Inventario Reactivos Líquidos</Text>
              <TouchableOpacity onPress={() => setShowLiquidosModal(false)}>
                <Ionicons name="close" size={24} color="#ef4444" />
              </TouchableOpacity>
            </View>
            <ScrollView horizontal>
              <FlatList
                data={filteredLiquidos}
                keyExtractor={(_, idx) => idx.toString()}
                renderItem={({ item: r }) => (
                  <View style={styles.tableRow}>
                    <Text style={styles.tableCell}>{r.nombre.replace(/_/g, ' ')}</Text>
                    <Text style={styles.tableCell}>{r.cantidad_inicial} {r.unidad}</Text>
                    {inventarioLiquidos.meses.map((m) => (
                      <Text key={m} style={styles.tableCell}>
                        {r.consumos[m] || 0}
                      </Text>
                    ))}
                    <Text style={styles.tableCell}>{r.existencia_final} {r.unidad}</Text>
                    <Text style={styles.tableCell}>{r.total_consumido} {r.unidad}</Text>
                  </View>
                )}
                ListHeaderComponent={
                  <View style={styles.tableHeader}>
                    <Text style={styles.tableHeaderCell}>Reactivo</Text>
                    <Text style={styles.tableHeaderCell}>Cantidad</Text>
                    {inventarioLiquidos.meses.map((m) => (
                      <Text key={m} style={styles.tableHeaderCell}>
                        {m}
                      </Text>
                    ))}
                    <Text style={styles.tableHeaderCell}>Existencia Final</Text>
                    <Text style={styles.tableHeaderCell}>Total</Text>
                  </View>
                }
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showSolidosModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSolidosModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Inventario Reactivos Sólidos</Text>
              <TouchableOpacity onPress={() => setShowSolidosModal(false)}>
                <Ionicons name="close" size={24} color="#ef4444" />
              </TouchableOpacity>
            </View>
            <ScrollView horizontal>
              <FlatList
                data={filteredSolidos}
                keyExtractor={(_, idx) => idx.toString()}
                renderItem={({ item: r }) => (
                  <View style={styles.tableRow}>
                    <Text style={styles.tableCell}>{r.nombre.replace(/_/g, ' ')}</Text>
                    <Text style={styles.tableCell}>{r.cantidad_inicial} {r.unidad}</Text>
                    {inventarioSolidos.meses.map((m) => (
                      <Text key={m} style={styles.tableCell}>
                        {r.consumos[m] || 0}
                      </Text>
                    ))}
                    <Text style={styles.tableCell}>{r.existencia_final} {r.unidad}</Text>
                    <Text style={styles.tableCell}>{r.total_consumido} {r.unidad}</Text>
                  </View>
                )}
                ListHeaderComponent={
                  <View style={styles.tableHeader}>
                    <Text style={styles.tableHeaderCell}>Reactivo</Text>
                    <Text style={styles.tableHeaderCell}>Cantidad</Text>
                    {inventarioSolidos.meses.map((m) => (
                      <Text key={m} style={styles.tableHeaderCell}>
                        {m}
                      </Text>
                    ))}
                    <Text style={styles.tableHeaderCell}>Existencia Final</Text>
                    <Text style={styles.tableHeaderCell}>Total</Text>
                  </View>
                }
              />
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
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 24,
    color: '#1e293b',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 16,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 15,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 8,
    fontSize: 14,
    flex: 1,
    maxWidth: 200,
    marginLeft: 8,
  },
  noData: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#dbeafe',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  tableHeaderCell: {
    flex: 1,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tableCell: {
    flex: 1,
    fontSize: 14,
    color: '#4b5563',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  showMore: {
    alignItems: 'center',
    marginTop: 8,
  },
  showMoreText: {
    fontSize: 14,
    color: '#3b82f6',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 15,
    padding: 16,
    maxWidth: '90%',
    maxHeight: '80%',
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
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