import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  Dimensions,
  ScrollView,
  Platform,
} from 'react-native';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth';
import jsPDF from 'jspdf';
// @ts-ignore
import autoTable from 'jspdf-autotable';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Asset } from 'expo-asset';
import { API_URL } from '@/constants/api'; // Assuming this exists as in the first code

const windowDimensions = Dimensions.get('window');

const encabezadoUT = require('../../assets/universidad.jpg'); // Asume que la imagen está en assets

function getUnidad(tipo: any) {
  return { liquido: 'ml', solido: 'g' }[tipo] || 'u';
}

function toLocalDateStr(date: any) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().split('T')[0];
}

function formatFechaStr(fecha: any) {
  if (!fecha) return '';
  try {
    const datePart = String(fecha).split('T')[0];
    const [year, month, day] = datePart.split('-');
    return `${day}/${month}/${year}`;
  } catch (e) {
    return '';
  }
}

const EstadoBadge = ({ estado }: { estado: any }) => {
  const config = {
    'aprobación pendiente': { bg: '#FEF3C7', text: '#D97706', icon: '⏳' },
    'aprobacion pendiente': { bg: '#FEF3C7', text: '#D97706', icon: '⏳' },
    'entrega pendiente': { bg: '#DBEAFE', text: '#1E40AF', icon: '📦' },
    'entregada': { bg: '#D1FAE5', text: '#065F46', icon: '✓' },
    'rechazada': { bg: '#FEE2E2', text: '#991B1B', icon: '✗' },
    'cancelado': { bg: '#F3F4F6', text: '#1F2937', icon: '❌' },
    'cancelada': { bg: '#F3F4F6', text: '#1F2937', icon: '❌' },
    'eliminación automática por falta de recolección': { bg: '#FEE2E2', text: '#991B1B', icon: '⚠️' },
    'eliminacion automatica por falta de recoleccion': { bg: '#FEE2E2', text: '#991B1B', icon: '⚠️' },
    'pendiente': { bg: '#FEF9C3', text: '#854D0E', icon: '⏳' },
  };
  const safe = (estado || '').toLowerCase().trim();
  const { bg, text, icon } = config[safe as keyof typeof config] || config.pendiente;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={{ color: text }}>{icon} {estado}</Text>
    </View>
  );
};

export default function SolicitudesScreen() {
  const { usuario, loading: authLoading } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [grupos, setGrupos] = useState<any>({});
  const [alumnoData, setAlumnoData] = useState<any[]>([]);
  const [docAprobar, setDocAprobar] = useState<any[]>([]);
  const [docMias, setDocMias] = useState<any[]>([]);
  const [almAlumnos, setAlmAlumnos] = useState<any[]>([]);
  const [almDocentes, setAlmDocentes] = useState<any[]>([]);
  const [procesando, setProcesando] = useState(null);
  const [filterDate, setFilterDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [minFilterDate, setMinFilterDate] = useState('');
  const [maxFilterDate, setMaxFilterDate] = useState('');
  const [notice, setNotice] = useState('');
  const [activeTab, setActiveTab] = useState('alumnos');
  const [search, setSearch] = useState('');
  const [modalEntrega, setModalEntrega] = useState<any>(null);
  const [selectedItems, setSelectedItems] = useState<any[]>([]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 10000);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    const today = new Date();
    let day = today.getDay();
    if (day === 0) {
      today.setDate(today.getDate() + 1);
      day = 1;
    } else if (day === 6) {
      today.setDate(today.getDate() + 2);
      day = 1;
    }
    const friday = new Date(today);
    friday.setDate(today.getDate() + (5 - day));
    setMinFilterDate(toLocalDateStr(today));
    setMaxFilterDate(toLocalDateStr(friday));
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!usuario) {
      setError('Inicia sesión para ver solicitudes');
      router.replace('/login');
      return;
    }
    const initialize = async () => {
      const token = await SecureStore.getItemAsync('token');
      if (!token) {
        setError('Inicia sesión para ver solicitudes');
        router.replace('/login');
        return;
      }

      const fetchAll = async () => {
        try {
          setLoading(true);

          try {
            const g = await axios.get(`${API_URL}/api/grupos`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const map = g.data.reduce((acc: any, it: any) => {
              acc[it.id] = it.nombre;
              return acc;
            }, {});
            setGrupos(map);
          } catch (_) {}

          let alumnoArr: any[] = [];
          let docAprobarArr: any[] = [];
          let docMiasArr: any[] = [];
          let almAlumnosArr: any[] = [];
          let almDocentesArr: any[] = [];

          if (usuario.rol === 'alumno') {
            const { data } = await axios.get(`${API_URL}/api/materials/usuario/solicitudes`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            alumnoArr = agrupar(data, 'alumno', grupos);
            setAlumnoData(alumnoArr);
          }

          if (usuario.rol === 'docente') {
            const [aprobarRes, miasRes] = await Promise.all([
              axios.get(`${API_URL}/api/materials/solicitudes/docente/aprobar`, {
                headers: { Authorization: `Bearer ${token}` },
              }),
              axios.get(`${API_URL}/api/materials/solicitudes/docente/mias`, {
                headers: { Authorization: `Bearer ${token}` },
              }),
            ]);
            docAprobarArr = agrupar(aprobarRes.data, 'docente', grupos);
            docMiasArr = agrupar(miasRes.data, 'docente', grupos);
            setDocAprobar(docAprobarArr);
            setDocMias(docMiasArr);
          }

          if (usuario.rol === 'almacen') {
            const { data } = await axios.get(`${API_URL}/api/materials/solicitudes/almacen`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const grouped = agrupar(data, 'almacen', grupos);
            almAlumnosArr = grouped.filter((s: any) => !s.isDocenteRequest);
            almDocentesArr = grouped.filter((s: any) => s.isDocenteRequest);
            setAlmAlumnos(almAlumnosArr);
            setAlmDocentes(almDocentesArr);
          }

          const todayStr = toLocalDateStr(new Date());
          const manana = new Date();
          manana.setDate(manana.getDate() + 1);
          const mananaStr = toLocalDateStr(manana);

          let all: any[] = [];
          if (usuario.rol === 'alumno') all = alumnoArr;
          if (usuario.rol === 'docente') all = [...docAprobarArr, ...docMiasArr];
          if (usuario.rol === 'almacen') all = [...almAlumnosArr, ...almDocentesArr];
          const pendientes = all.filter((s: any) => s.estado === 'entrega pendiente');
          const hoyCount = pendientes.filter((s: any) => (s.fecha_recoleccion || '').split('T')[0] === todayStr).length;
          const mananaCount = pendientes.filter((s: any) => (s.fecha_recoleccion || '').split('T')[0] === mananaStr).length;
          if (usuario.rol === 'almacen' && pendientes.length > 0) {
            let msg = '';
            if (hoyCount > 0 && mananaCount > 0) {
              msg = `Tienes ${pendientes.length} solicitudes: ${hoyCount} para entregar hoy y ${mananaCount} para entregar mañana`;
            } else if (hoyCount > 0) {
              msg = `Tienes ${hoyCount} solicitudes para entregar hoy`;
            } else if (mananaCount > 0) {
              msg = `Tienes ${mananaCount} solicitudes para entregar mañana`;
            }
            if (msg) {
              setNotice(msg);
            }
          }

          setError('');
        } finally {
          setLoading(false);
        }
      };

      fetchAll();
    };
    initialize();
  }, [authLoading, usuario]);

  function agrupar(rows: any, rolVista: any, gruposMap: any) {
    const by: any = {};
    for (const item of rows) {
      const key = item.solicitud_id ?? item.id;
      if (!key) continue;

      const isDocenteReq = !item.nombre_alumno;

      if (!by[key]) {
        const rawEstado = String(item.estado || '').toLowerCase().trim();
        const estadoUI = mapEstadoPorRol(rawEstado, isDocenteReq, rolVista);

        by[key] = {
          id: key,
          folio: item.folio || '',
          nombre_alumno: item.nombre_alumno || '',
          profesor: item.profesor || '',
          fecha_solicitud: item.fecha_solicitud,
          fecha_recoleccion: item.fecha_recoleccion,
          fecha_devolucion: item.fecha_devolucion,
          estado: estadoUI,
          rawEstado,
          isDocenteRequest: isDocenteReq,
          grupo: isDocenteReq ? '' : (item.grupo_nombre || (item.grupo_id && gruposMap[item.grupo_id]) || ''),
          items: [],
        };
      }

      const nombreMaterialRaw =
        item?.nombre_material ??
        item?.nombreMaterial ??
        item?.material_nombre ??
        item?.materialNombre ??
        item?.material ??
        item?.nombre ??
        '';

      const nombreMaterial = String(nombreMaterialRaw).replace(/_/g, ' ').trim();

      by[key].items.push({
        item_id: item.item_id ?? item.solicitud_item_id ?? `${key}-itm-${by[key].items.length + 1}`,
        nombre_material: nombreMaterial || '(Sin nombre)',
        cantidad: item.cantidad ?? item.cantidad_pedida ?? 0,
        tipo: item.tipo,
      });
    }
    return Object.values(by).sort((a: any, b: any) => new Date(b.fecha_solicitud) - new Date(a.fecha_solicitud));
  }

  function mapEstadoPorRol(estadoSQL: any, isDocenteReq: any, rolVista: any) {
    const e = (estadoSQL || '').toLowerCase().trim();

    if (rolVista === 'almacen') {
      if (e === 'entregado') return 'entregada';
      if (e === 'rechazada') return 'rechazada';
      if (e === 'cancelado') return 'cancelado';
      if (e === 'sin recoleccion') return 'eliminación automática por falta de recolección';
      return 'entrega pendiente';
    }

    switch (e) {
      case 'pendiente':
        return isDocenteReq ? 'pendiente' : 'aprobación pendiente';
      case 'aprobada':
        return 'entrega pendiente';
      case 'entregado':
        return 'entregada';
      case 'rechazada':
        return 'rechazada';
      case 'cancelado':
        return 'cancelado';
      case 'sin recoleccion':
        return 'eliminación automática por falta de recolección';
      default:
        return 'pendiente';
    }
  }

  const actualizarEstado = async (id: any, accion: any, nuevoEstadoUI: any, items: any[] = []) => {
    if (procesando) return;
    setProcesando(id);
    const token = await SecureStore.getItemAsync('token');
    try {
      await axios.post(
        `${API_URL}/api/materials/solicitud/${id}/${accion}`,
        accion === 'entregar' ? { items_entregados: items } : {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const apply = (arrSetter: any) =>
        arrSetter((prev: any[]) =>
          prev.map((s: any) => {
            if (s.id !== id) return s;
            const ui = nuevoEstadoUI;
            const raw = uiToRaw(ui);
            const updated = { ...s, estado: ui, rawEstado: raw };
            if (accion === 'entregar') {
              const idsEntregados = items.map((i) => i.item_id);
              updated.items = (s.items || [])
                .filter((it: any) => idsEntregados.includes(it.item_id))
                .map((it: any) => {
                  const entregado = items.find((i) => i.item_id === it.item_id);
                  return {
                    ...it,
                    cantidad: entregado ? entregado.cantidad_entregada : it.cantidad,
                  };
                });
            }
            return updated;
          })
        );

      const drop = (arrSetter: any) => arrSetter((prev: any[]) => prev.filter((s: any) => s.id !== id));

      if (accion === 'cancelar' || accion === 'rechazar') {
        drop(setAlumnoData);
        drop(setDocAprobar);
        drop(setDocMias);
        drop(setAlmAlumnos);
        drop(setAlmDocentes);
      } else {
        apply(setAlumnoData);
        apply(setDocAprobar);
        apply(setDocMias);
        apply(setAlmAlumnos);
        apply(setAlmDocentes);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || `Error al ${accion} la solicitud`);
    } finally {
      setProcesando(null);
    }
  };

  function uiToRaw(estadoUI: any) {
    const e = (estadoUI || '').toLowerCase().trim();
    if (e === 'entrega pendiente') return 'aprobada';
    if (e === 'aprobación pendiente' || e === 'aprobacion pendiente') return 'pendiente';
    if (e === 'entregada') return 'entregado';
    if (e === 'rechazada') return 'rechazada';
    if (e === 'cancelado') return 'cancelado';
    if (e === 'eliminación automática por falta de recolección' || e === 'eliminacion automatica por falta de recoleccion') return 'sin recoleccion';
    return e;
  }

  const filterByDate = (arr: any[]) =>
    filterDate ? arr.filter((s: any) => (s.fecha_recoleccion || '').split('T')[0] === filterDate) : arr;

  const applySearch = (arr: any[], includeGrupo = false) => {
    const term = search.toLowerCase();
    if (!term) return arr;
    return arr.filter(
      (s: any) =>
        s.folio.toLowerCase().includes(term) ||
        (s.nombre_alumno || '').toLowerCase().includes(term) ||
        (s.profesor || '').toLowerCase().includes(term) ||
        (includeGrupo && (s.grupo || '').toLowerCase().includes(term))
    );
  };

  let dataToShow: any[] = [];
  let showButtons = false;
  let showSearch = false;
  let showDateFilter = false;
  let title = 'Solicitudes de préstamo';

  if (usuario?.rol === 'alumno') {
    dataToShow = alumnoData;
    title = 'Mis solicitudes';
  } else if (usuario?.rol === 'docente') {
    showButtons = true;
    showSearch = true;
    dataToShow = activeTab === 'alumnos' ? applySearch(docAprobar, true) : applySearch(docMias);
  } else if (usuario?.rol === 'almacen') {
    showButtons = true;
    showSearch = true;
    showDateFilter = true;
    const filtered = filterByDate(activeTab === 'alumnos' ? almAlumnos : almDocentes);
    dataToShow = applySearch(filtered, activeTab === 'alumnos');
  }

  const onDateChange = (event: any, selectedDate: any) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      const v = toLocalDateStr(selectedDate);
      const d = new Date(v);
      const day = d.getDay();
      if (day !== 0 && day !== 6 && v >= minFilterDate && v <= maxFilterDate) {
        setFilterDate(v);
      }
    }
  };

  const abrirEntrega = (sol: any) => {
    setModalEntrega(sol);
    setSelectedItems([]);
  };

  const seleccionarTodos = () => {
    if (!modalEntrega) return;
    setSelectedItems(modalEntrega.items.map((i: any) => i.item_id));
  };

  const confirmarEntrega = async () => {
    if (!modalEntrega) return;
    const items = modalEntrega.items
      .filter((i: any) => selectedItems.includes(i.item_id))
      .map((i: any) => ({ item_id: i.item_id, cantidad_entregada: i.cantidad }));
    await actualizarEstado(modalEntrega.id, 'entregar', 'entregada', items);
    setModalEntrega(null);
  };

  const descargarPDF = async (vale: any) => {
    try {
      const token = await SecureStore.getItemAsync('token');
      if (token && vale?.id) {
        try {
          const { data } = await axios.get(`${API_URL}/api/solicitudes/detalle/${vale.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          vale = { ...vale, ...data };
        } catch (e) {
          console.error('Error al obtener detalle de solicitud:', e);
        }
      }

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const asset = Asset.fromModule(encabezadoUT);
      await asset.downloadAsync();
      const localUri = asset.localUri || '';
      const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
      const encabezadoImg = `data:image/jpg;base64,${base64}`;

      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 15;
      const primary = [0, 0, 0];
      const secondary = [100, 100, 100];

      const maxHeaderWidth = (pageWidth - margin * 2) * 0.4;
      const maxHeaderHeight = 40;
      const originalRatio = 3.5; // Adjust as needed

      let headerWidth, headerHeight;
      if (maxHeaderWidth / originalRatio <= maxHeaderHeight) {
        headerWidth = maxHeaderWidth;
        headerHeight = maxHeaderWidth / originalRatio;
      } else {
        headerHeight = maxHeaderHeight;
        headerWidth = maxHeaderHeight * originalRatio;
      }

      const scale = 0.5;
      headerWidth *= scale;
      headerHeight *= scale;

      const imageX = (pageWidth - headerWidth) / 2;
      const imageY = 18;

      doc.addImage(encabezadoImg, 'JPG', imageX, imageY, headerWidth, headerHeight);

      const titleY = imageY + headerHeight + 8;
      doc.setFontSize(18);
      doc.setTextColor(...primary);
      doc.setFont('helvetica', 'bold');
      doc.text('VALE DE ALMACÉN', pageWidth / 2, titleY, { align: 'center' });

      const nombre = vale.isDocenteRequest ? vale.profesor : vale.nombre_alumno;
      const grupo = vale.isDocenteRequest ? '' : (vale.grupo || '');
      const fechaReco = formatFechaStr(vale.fecha_recoleccion);
      const fechaDevolucion = formatFechaStr(vale.fecha_devolucion);

      const headInfo = vale.isDocenteRequest ? [['Nombre', 'Folio']] : [['Nombre', 'Grupo', 'Folio']];
      const bodyInfo = vale.isDocenteRequest ? [[nombre, vale.folio]] : [[nombre, grupo, vale.folio]];

      autoTable(doc, {
        startY: titleY + 5,
        theme: 'grid',
        head: headInfo,
        body: bodyInfo,
        headStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          halign: 'center',
        },
        bodyStyles: { fontSize: 11, cellPadding: 2 },
        styles: { lineColor: primary, lineWidth: 0.2 },
        margin: { top: 0, bottom: 0, left: margin, right: margin },
        tableWidth: pageWidth - margin * 2,
      });

      const startYTable = doc.lastAutoTable.finalY;
      const items = vale.items || [];
      const rows = [];
      for (let i = 0; i < 10; i++) {
        const left = items[i];
        const right = items[i + 10];
        rows.push([
          left ? `${left.cantidad} ${getUnidad(left.tipo)}` : '',
          left ? left.nombre_material : '',
          right ? `${right.cantidad} ${getUnidad(right.tipo)}` : '',
          right ? right.nombre_material : '',
        ]);
      }

      autoTable(doc, {
        startY: startYTable,
        theme: 'grid',
        head: [['Cantidad', 'Descripción', 'Cantidad', 'Descripción']],
        body: rows,
        headStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          halign: 'center',
        },
        bodyStyles: { fontSize: 10, cellPadding: 2 },
        styles: { lineColor: primary, lineWidth: 0.2 },
        margin: { top: 0, bottom: 0, left: margin, right: margin },
        tableWidth: pageWidth - margin * 2,
      });

      const afterTableY = doc.lastAutoTable.finalY + 4;
      const profesor = vale.profesor || '';

      doc.setFontSize(10);
      doc.setTextColor(...primary);

      doc.setFont('helvetica', 'bold');
      doc.text('Fecha recolección:', margin, afterTableY);
      doc.setFont('helvetica', 'normal');
      doc.text(fechaReco, margin + 40, afterTableY);

      doc.setFont('helvetica', 'bold');
      doc.text('Fecha devolución:', pageWidth / 2, afterTableY);
      doc.setFont('helvetica', 'normal');
      doc.text(fechaDevolucion, pageWidth / 2 + 40, afterTableY);

      let noteY = afterTableY;

      if (!vale.isDocenteRequest) {
        const profesorY = afterTableY + 6;
        doc.setFont('helvetica', 'bold');
        doc.text('Profesor:', margin, profesorY);
        doc.setFont('helvetica', 'normal');
        doc.text(profesor, margin + 25, profesorY);
        noteY = profesorY;
      }

      doc.setFontSize(8);
      doc.setTextColor(...secondary);
      doc.setFont('helvetica', 'normal');
      doc.text(
        'NOTA: LA FIRMA DEL PROFESOR AMPARA CUALQUIER EVENTO DURANTE EL TIEMPO QUE DURE LA PRÁCTICA, FAVOR DE RESPETAR LOS HORARIOS',
        pageWidth / 2,
        noteY + 6,
        { align: 'center', maxWidth: pageWidth - margin * 2 }
      );

      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const uri = `${FileSystem.documentDirectory}${vale.folio}.pdf`;
      await FileSystem.writeAsStringAsync(uri, pdfBase64, { encoding: FileSystem.EncodingType.Base64 });
      await Sharing.shareAsync(uri);
    } catch (err: any) {
      console.error('Error al generar PDF:', err);
      Alert.alert('Error', 'No se pudo generar el PDF');
    }
  };

  const renderCard = ({ item: s }: { item: any }) => {
    const createDateStr = (s.fecha_solicitud || '').split('T')[0];
    const recoDateStr = (s.fecha_recoleccion || '').split('T')[0];
    const dateStr = usuario?.rol === 'almacen' ? recoDateStr : createDateStr;
    const todayStr = toLocalDateStr(new Date());
    const isOverdue = recoDateStr && recoDateStr < todayStr && s.estado === 'entrega pendiente';
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = toLocalDateStr(tomorrow);
    const showMsg =
      usuario?.rol !== 'almacen' &&
      recoDateStr &&
      recoDateStr > todayStr &&
      recoDateStr !== todayStr;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Folio: {s.folio}</Text>
          <EstadoBadge estado={isOverdue ? 'cancelada' : s.estado} />
        </View>
        {usuario?.rol !== 'alumno' && s.nombre_alumno && (
          <Text style={styles.cardText}>Solicitante: {s.nombre_alumno}</Text>
        )}
        {s.profesor && <Text style={styles.cardText}>Encargado: {s.profesor}</Text>}
        {s.grupo && <Text style={styles.cardText}>Grupo: {s.grupo}</Text>}
        <Text style={styles.cardText}>Fecha: {formatFechaStr(dateStr)}</Text>
        {isOverdue && (
          <Text style={styles.overdueText}>
            ⚠️ Ha pasado la fecha. Se eliminará la solicitud dentro de 1 día por falta de recolección
          </Text>
        )}
        {showMsg && recoDateStr === tomorrowStr && (
          <Text style={styles.msgText}>🕒 Entrega para mañana</Text>
        )}
        <Text style={styles.cardSubtitle}>Materiales:</Text>
        <ScrollView style={styles.materialsList} nestedScrollEnabled>
          {s.items.map((m: any) => (
            <View key={m.item_id} style={styles.materialItem}>
              <Text>{m.cantidad} {getUnidad(m.tipo)} - {m.nombre_material}</Text>
            </View>
          ))}
        </ScrollView>
        <View style={styles.actions}>
          {usuario?.rol === 'docente' &&
            !s.isDocenteRequest &&
            s.estado === 'aprobación pendiente' && (
              <>
                <TouchableOpacity
                  style={styles.btnGreen}
                  onPress={() => actualizarEstado(s.id, 'aprobar', 'entrega pendiente')}
                  disabled={procesando === s.id}
                >
                  <Text style={styles.btnText}>Aprobar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.btnRed}
                  onPress={() => actualizarEstado(s.id, 'rechazar', 'rechazada')}
                  disabled={procesando === s.id}
                >
                  <Text style={styles.btnText}>Rechazar</Text>
                </TouchableOpacity>
              </>
            )}
          {usuario?.rol === 'almacen' &&
            s.estado === 'entrega pendiente' &&
            (s.fecha_recoleccion || '').split('T')[0] === toLocalDateStr(new Date()) && (
              <TouchableOpacity
                style={styles.btnBlue}
                onPress={() => abrirEntrega(s)}
                disabled={procesando === s.id}
              >
                <Text style={styles.btnText}>Entregar</Text>
              </TouchableOpacity>
            )}
          {usuario?.rol === 'alumno' && s.estado === 'aprobación pendiente' && (
            <TouchableOpacity
              style={styles.btnGray}
              onPress={() => actualizarEstado(s.id, 'cancelar', 'cancelado')}
              disabled={procesando === s.id}
            >
              <Text style={styles.btnText}>Cancelar</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.btnPurple}
            onPress={() => descargarPDF(s)}
            disabled={procesando === s.id}
          >
            <Text style={styles.btnText}>PDF</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading || authLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#003579" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>{title}</Text>
      {showButtons && (
        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'alumnos' && styles.activeTab]}
            onPress={() => setActiveTab('alumnos')}
          >
            <Text style={[styles.tabText, activeTab === 'alumnos' && { color: '#fff' }]}>Solicitudes de Alumnos</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'docentes' && styles.activeTab]}
            onPress={() => setActiveTab('docentes')}
          >
            <Text style={[styles.tabText, activeTab === 'docentes' && { color: '#fff' }]}>Solicitudes de Docentes</Text>
          </TouchableOpacity>
        </View>
      )}
      {showSearch && (
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar..."
          value={search}
          onChangeText={setSearch}
        />
      )}
      {showDateFilter && (
        <TouchableOpacity
          style={styles.dateFilter}
          onPress={() => setShowDatePicker(true)}
        >
          <Text>{filterDate ? formatFechaStr(filterDate) : 'Filtrar por fecha'}</Text>
        </TouchableOpacity>
      )}
      {showDatePicker && (
        <DateTimePicker
          value={new Date()}
          mode="date"
          display="default"
          onChange={onDateChange}
          minimumDate={new Date(minFilterDate)}
          maximumDate={new Date(maxFilterDate)}
        />
      )}
      {notice && <Text style={styles.notice}>{notice}</Text>}
      <FlatList
        data={dataToShow}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderCard}
        contentContainerStyle={styles.list}
      />
      {modalEntrega && (
        <Modal visible={!!modalEntrega} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Entregar materiales</Text>
              <ScrollView>
                {modalEntrega.items.map((item: any) => (
                  <TouchableOpacity
                    key={item.item_id}
                    style={styles.checkboxItem}
                    onPress={() => toggleItem(item.item_id)}
                  >
                    <Ionicons
                      name={selectedItems.includes(item.item_id) ? 'checkbox' : 'square-outline'}
                      size={24}
                      color="#003579"
                    />
                    <Text>{item.cantidad} {getUnidad(item.tipo)} - {item.nombre_material}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity style={styles.selectAll} onPress={seleccionarTodos}>
                <Text>Seleccionar todo</Text>
              </TouchableOpacity>
              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.btnSecondary} onPress={() => setModalEntrega(null)}>
                  <Text>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btnPrimary, selectedItems.length === 0 && styles.disabled]}
                  disabled={selectedItems.length === 0}
                  onPress={confirmarEntrega}
                >
                  <Text>Entregar</Text>
                </TouchableOpacity>
              </View>
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
    padding: 16,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    color: '#003579',
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  tabButton: {
    padding: 12,
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 8,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#003579',
  },
  tabText: {
    color: '#000',
    fontWeight: '600',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  dateFilter: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  notice: {
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    color: '#D97706',
  },
  list: {
    paddingBottom: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    width: '100%',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  badge: {
    padding: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardText: {
    fontSize: 14,
    marginBottom: 4,
  },
  overdueText: {
    color: '#ef4444',
    fontSize: 12,
    marginBottom: 8,
  },
  msgText: {
    color: '#f59e0b',
    fontSize: 12,
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  materialsList: {
    maxHeight: 150,
  },
  materialItem: {
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    gap: 8,
  },
  btnGreen: {
    backgroundColor: '#16a34a',
    padding: 8,
    borderRadius: 8,
  },
  btnRed: {
    backgroundColor: '#ef4444',
    padding: 8,
    borderRadius: 8,
  },
  btnBlue: {
    backgroundColor: '#3b82f6',
    padding: 8,
    borderRadius: 8,
  },
  btnGray: {
    backgroundColor: '#6b7280',
    padding: 8,
    borderRadius: 8,
  },
  btnPurple: {
    backgroundColor: '#8b5cf6',
    padding: 8,
    borderRadius: 8,
  },
  btnText: {
    color: '#fff',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  checkboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  selectAll: {
    alignItems: 'center',
    marginVertical: 8,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  btnSecondary: {
    padding: 12,
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
  },
  btnPrimary: {
    padding: 12,
    backgroundColor: '#003579',
    borderRadius: 8,
  },
  disabled: {
    opacity: 0.5,
  },
  errorText: {
    color: '#ef4444',
    textAlign: 'center',
    marginTop: 20,
  },
});