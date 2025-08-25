import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Alert,
  Platform,
  Image,
} from 'react-native';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { API_URL } from '@/constants/api';
// Assuming useAuth is adapted for React Native; if not, use context or similar
import { useAuth } from '@/lib/auth'; // Adapt this import as needed

const { width, height } = Dimensions.get('window');

function toLocalDateStr(date: Date): string {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().split('T')[0];
}

export default function CatalogoScreen() {
  const { usuario } = useAuth();
  const [allMaterials, setAllMaterials] = useState<any[]>([]);
  const [selectedCart, setSelectedCart] = useState<any[]>([]);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showMassAdjustModal, setShowMassAdjustModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<any>(null);
  const [materialToAdjust, setMaterialToAdjust] = useState<any>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [detailAmount, setDetailAmount] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRiesgoFisico, setSelectedRiesgoFisico] = useState('');
  const [selectedRiesgoSalud, setSelectedRiesgoSalud] = useState('');
  const [lowStockMaterials, setLowStockMaterials] = useState<any[]>([]);
  const [docentes, setDocentes] = useState<any[]>([]);
  const [selectedDocenteId, setSelectedDocenteId] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [minPickupDate, setMinPickupDate] = useState('');
  const [maxPickupDate, setMaxPickupDate] = useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [massAdjustments, setMassAdjustments] = useState<any>({});
  const [massSearchTerm, setMassSearchTerm] = useState('');
  const [massError, setMassError] = useState('');
  const [newMaterial, setNewMaterial] = useState({
    tipoGeneral: 'Reactivo',
    subTipo: '',
    nombre: '',
    descripcion: '',
    cantidad_inicial: '',
    estado: 'disponible',
    riesgos_fisicos: '',
    riesgos_salud: '',
    riesgos_ambientales: '',
    imagenFile: null as any,
  });
  const [addError, setAddError] = useState('');
  const [userPermissions, setUserPermissions] = useState({
    acceso_chat: false,
    modificar_stock: false,
    rol: null as string | null,
  });
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const [permissionsError, setPermissionsError] = useState('');
  const [showCart, setShowCart] = useState(width > 768); // Show cart by default on larger screens
  const [showDatePicker, setShowDatePicker] = useState({ pickup: false, return: false });
  const [tempDate, setTempDate] = useState(new Date());

  const LOW_STOCK_THRESHOLD = 50;
  const CLOUDINARY_CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || 'tu-cloud-name';

  useEffect(() => {
    const updateDimensions = () => {
      const newWidth = Dimensions.get('window').width;
      setShowCart(newWidth > 768);
    };
    const subscription = Dimensions.addEventListener('change', updateDimensions);
    return () => subscription?.remove();
  }, []);

  const getFormattedDate = (d: Date) => d.toISOString().split('T')[0];

  const computeMinPickupDate = () => {
    const now = new Date();
    let d = new Date(now);
    const day = d.getDay();
    const hour = d.getHours();

    if (day === 6) {
      d.setDate(d.getDate() + 2); // sábado -> lunes
    } else if (day === 0) {
      d.setDate(d.getDate() + (hour >= 21 ? 2 : 1)); // domingo
    } else {
      d.setDate(d.getDate() + (hour >= 21 ? 2 : 1)); // lunes-viernes
      if (d.getDay() === 6) d.setDate(d.getDate() + 2); // cae en sábado
      if (d.getDay() === 0) d.setDate(d.getDate() + 1); // cae en domingo
    }
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const computeWeekEnd = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = (5 - day + 7) % 7;
    d.setDate(d.getDate() + diff);
    return d;
  };

  useEffect(() => {
    const minDate = computeMinPickupDate();
    setMinPickupDate(getFormattedDate(minDate));
    const weekEnd = computeWeekEnd(minDate);
    setMaxPickupDate(getFormattedDate(weekEnd));
  }, []);

  const loadUserPermissions = async () => {
    try {
      setPermissionsLoading(true);
      const token = await SecureStore.getItemAsync('token');

      if (!token) {
        // Redirect to login; in RN, use router
        router.replace('/login');
        return;
      }

      const response = await axios.get(
        `${API_URL}/api/auth/permisos-stock`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setUserPermissions({
        acceso_chat: response.data.acceso_chat || false,
        modificar_stock: response.data.modificar_stock || false,
        rol: response.data.rol,
      });

      setPermissionsError('');
    } catch (error: any) {
      console.error('Error al cargar permisos:', error);
      setPermissionsError('Error al verificar permisos de usuario');

      if (error.response?.status === 401) {
        await SecureStore.deleteItemAsync('token');
        router.replace('/login');
      } else if (error.response?.status === 403) {
        setPermissionsError('Usuario bloqueado. Contacta al administrador.');
      }
    } finally {
      setPermissionsLoading(false);
    }
  };

  const loadDocentes = async () => {
    try {
      const token = await SecureStore.getItemAsync('token');
      const response = await axios.get(
        `${API_URL}/api/materials/docentes`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setDocentes(response.data);
      if (userPermissions.rol === 'docente') {
        setSelectedDocenteId(usuario.id.toString());
      } else {
        setSelectedDocenteId('');
      }
    } catch (error: any) {
      console.error('Error al cargar docentes:', error);
      setError('No se pudieron cargar los docentes. Intenta de nuevo.');
    }
  };

  const canModifyStock = () => {
    if (userPermissions.rol === 'administrador') return true;
    if (userPermissions.rol === 'almacen' && userPermissions.modificar_stock) return true;
    return false;
  };

  const canMakeRequests = () => {
    return userPermissions.rol === 'alumno' || userPermissions.rol === 'docente';
  };

  const canViewDetails = () => {
    if (userPermissions.rol === 'administrador') return false;
    if (userPermissions.rol === 'almacen' && !userPermissions.modificar_stock) return false;
    return true;
  };

  const handlePermissionError = (action: string) => {
    const messages: { [key: string]: string } = {
      modify_stock: 'No tienes permisos para modificar el stock. Contacta al administrador.',
      make_request: 'No tienes permisos para realizar solicitudes.',
      view_details: 'No tienes permisos para ver los detalles de este material.',
      adjust_stock: 'Solo usuarios con permisos de stock pueden ajustar inventario.',
      low_stock_alerts: 'Solo usuarios con permisos de stock pueden gestionar alertas.',
    };

    setError(messages[action] || 'No tienes permisos para realizar esta acción.');
    setTimeout(() => setError(''), 5000);
  };

  const handleDeleteMaterial = async () => {
    Alert.alert('Confirmar', '¿Seguro que quieres eliminar este material?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        onPress: async () => {
          try {
            await makeSecureApiCall(
              `${API_URL}/api/materials/${materialToAdjust.id}/eliminar?tipo=${materialToAdjust.tipo}`,
              { method: 'DELETE' }
            );
            setShowAdjustModal(false);
            await fetchMaterials();
          } catch (err) {
            console.error('Error al eliminar material:', err);
            setError('No se pudo eliminar el material.');
          }
        },
      },
    ]);
  };

  const makeSecureApiCall = async (url: string, options: any = {}) => {
    try {
      const token = await SecureStore.getItemAsync('token');
      const config = {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${token}`,
        },
      };

      const response = await axios(url, config);
      return response;
    } catch (error: any) {
      if (error.response?.status === 403) {
        if (error.response.data?.error?.includes('permisos de stock')) {
          handlePermissionError('modify_stock');
        } else if (error.response.data?.error?.includes('solicitudes')) {
          handlePermissionError('make_request');
        } else {
          setError('No tienes permisos para realizar esta acción.');
        }
      } else if (error.response?.status === 401) {
        await SecureStore.deleteItemAsync('token');
        router.replace('/login');
      } else {
        setError('Error al procesar la solicitud: ' + (error.response?.data?.error || error.message));
      }
      throw error;
    }
  };

  useEffect(() => {
    if (!usuario) {
      router.replace('/login');
      return;
    }

    const initializeComponent = async () => {
      await loadUserPermissions();
    };

    initializeComponent();
  }, [usuario]);

  useEffect(() => {
    if (userPermissions.rol) {
      Promise.all([fetchMaterials(), loadDocentes()]);
    }
  }, [userPermissions.rol]);

  const fetchMaterials = async () => {
    try {
      setLoading(true);

      const [liquidoRes, solidoRes, laboratorioRes, equipoRes] = await Promise.all([
        makeSecureApiCall(`${API_URL}/api/materials/tipo/liquidos`),
        makeSecureApiCall(`${API_URL}/api/materials/tipo/solidos`),
        makeSecureApiCall(`${API_URL}/api/materials/tipo/laboratorio`),
        makeSecureApiCall(`${API_URL}/api/materials/tipo/equipos`),
      ]);

      const liquidos = liquidoRes.data.map((m: any) => ({
        ...m,
        tipo: 'liquido',
        cantidad: m.cantidad_disponible_ml ?? 0,
      }));

      const solidos = solidoRes.data.map((m: any) => ({
        ...m,
        tipo: 'solido',
        cantidad: m.cantidad_disponible_g ?? 0,
      }));

      const laboratorio = laboratorioRes.data.map((m: any) => ({
        ...m,
        tipo: 'laboratorio',
        cantidad: m.cantidad_disponible ?? 0,
      }));

      const equipos = equipoRes.data.map((m: any) => ({
        ...m,
        tipo: 'equipo',
        cantidad: m.cantidad_disponible_u ?? 0,
        riesgos_fisicos: '',
        riesgos_salud: '',
        riesgos_ambientales: '',
      }));

      let all = [...liquidos, ...solidos, ...laboratorio, ...equipos];

      if (userPermissions.rol === 'alumno') {
        all = all.filter((m) => m.tipo === 'laboratorio' || m.tipo === 'equipo');
      } else if (userPermissions.rol === 'docente') {
        all = all.filter((m) => m.tipo === 'liquido' || m.tipo === 'solido');
      }

      setAllMaterials(all);

      if (canModifyStock()) {
        const lowStock = all.filter(
          (material) =>
            (material.tipo === 'liquido' || material.tipo === 'solido') &&
            material.cantidad > 0 &&
            material.cantidad <= LOW_STOCK_THRESHOLD
        );
        setLowStockMaterials(lowStock);
      }
    } catch (err: any) {
      console.error('Error al cargar materiales:', err);
      if (!err.response || err.response.status !== 403) {
        setError('Error al cargar el catálogo');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatName = (name: string) =>
    name
      ? name
          .replace(/_/g, ' ')
          .split(' ')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ')
      : '';

  const normalizeImageName = (name: string) =>
    name
      ? name
          .replace(/[,]/g, '')
          .replace(/\s+/g, '_')
          .replace(/[^a-zA-Z0-9_]/g, '')
          .toLowerCase()
      : '';

  const getUnidad = (tipo: string) => {
    if (tipo === 'liquido') return 'ml';
    if (tipo === 'solido') return 'g';
    if (tipo === 'laboratorio' || tipo === 'equipo') return 'unidades';
    return 'unidades';
  };

  const getImagePath = async (material: any) => {
    if (material.imagen) {
      try {
        const folder =
          material.tipo === 'laboratorio'
            ? 'materialLaboratorio'
            : material.tipo === 'liquido'
            ? 'materialLiquido'
            : material.tipo === 'solido'
            ? 'materialSolido'
            : 'materialEquipo';
        const response = await fetch(
          `/api/materials/verify-image?public_id=materiales-laboratorio/${folder}/${material.nombre.toLowerCase().trim()}`
        );
        const data = await response.json();
        if (data.exists) {
          return material.imagen;
        }
      } catch (error) {
        console.error('[Error] Verificando imagen:', error);
      }
    }
    return '';
  };

  const parseRiesgos = (riesgosString: string) => {
    if (!riesgosString || riesgosString.trim() === '') return [];
    return riesgosString.split(';').filter((r) => r.trim());
  };

  const getRiesgoColor = (riesgo: string) => {
    const colorMap = {
      Inflamable: { backgroundColor: '#fee2e2', color: '#991b1b' },
      Oxidante: { backgroundColor: '#ffedd5', color: '#9a3412' },
      'Corrosivo para metales': { backgroundColor: '#f3f4f6', color: '#1f2937' },
      'Reacciona violentamente con agua': { backgroundColor: '#f3e8ff', color: '#6b21a8' },
      'Tóxico agudo': { backgroundColor: '#fecaca', color: '#7f1d1d' },
      Cancerígeno: { backgroundColor: '#000000', color: '#ffffff' },
      'Corrosivo para la piel': { backgroundColor: '#fef3c7', color: '#92400e' },
      Irritante: { backgroundColor: '#dbeafe', color: '#1e40af' },
      Sensibilizante: { backgroundColor: '#fce7f3', color: '#be185d' },
      'Peligroso para el medio ambiente acuático': { backgroundColor: '#dcfce7', color: '#166534' },
      Persistente: { backgroundColor: '#ccfbf1', color: '#115e59' },
    };
    return colorMap[riesgo as keyof typeof colorMap] || { backgroundColor: '#f3f4f6', color: '#4b5563' };
  };

  const getRiesgoIcon = (riesgo: string) => {
    const iconMap = {
      Inflamable: '🔥',
      Oxidante: '⚗️',
      'Corrosivo para metales': '🛠️',
      'Reacciona violentamente con agua': '💥',
      'Tóxico agudo': '☠️',
      Cancerígeno: '⚠️',
      'Corrosivo para la piel': '🧪',
      Irritante: '⚡',
      Sensibilizante: '🤧',
      'Peligroso para el medio ambiente acuático': '🐟',
      Persistente: '🌱',
    };
    return iconMap[riesgo as keyof typeof iconMap] || '⚪';
  };

  const getMaxRiesgoLevel = (material: any) => {
    const allRiesgos = [
      ...parseRiesgos(material.riesgos_fisicos || ''),
      ...parseRiesgos(material.riesgos_salud || ''),
      ...parseRiesgos(material.riesgos_ambientales || ''),
    ];

    if (allRiesgos.includes('Cancerígeno') || allRiesgos.includes('Tóxico agudo')) return 4;
    if (allRiesgos.includes('Corrosivo para la piel') || allRiesgos.includes('Inflamable')) return 3;
    if (allRiesgos.includes('Irritante') || allRiesgos.includes('Oxidante')) return 2;
    if (allRiesgos.length > 0) return 1;
    return 0;
  };

  const displayStock = (material: any) => {
    if (canModifyStock()) {
      return `${material.cantidad} ${getUnidad(material.tipo)}`;
    } else {
      return material.cantidad > 0 ? 'Disponible' : 'Agotado';
    }
  };

  const getStockColor = (material: any) => {
    if (!canModifyStock()) {
      return material.cantidad > 0 ? '#16a34a' : '#ef4444';
    }

    if (material.cantidad === 0) return '#ef4444';
    if (material.cantidad <= LOW_STOCK_THRESHOLD) return '#f59e0b';
    return '#16a34a';
  };

  const addToCart = (material: any, cantidad: string) => {
    if (!canMakeRequests()) {
      handlePermissionError('make_request');
      return;
    }

    const cantidadNum = parseInt(cantidad) || 0;
    if (cantidadNum <= 0) {
      setError(`Ingresa una cantidad válida para ${formatName(material.nombre)}`);
      return;
    }

    if (cantidadNum > material.cantidad) {
      setError(`No hay suficiente stock de ${formatName(material.nombre)}`);
      return;
    }

    setSelectedCart((prev) => {
      const exists = prev.find((item) => item.id === material.id && item.tipo === material.tipo);
      if (exists) {
        return prev.map((item) =>
          item.id === material.id && item.tipo === material.tipo
            ? { ...item, cantidad: cantidadNum }
            : item
        );
      }
      return [...prev, { ...material, cantidad: cantidadNum }];
    });
    setError('');
    setShowDetailModal(false);
    setDetailAmount('');
  };

  const removeFromCart = (id: number, tipo: string) => {
    if (!canMakeRequests()) {
      handlePermissionError('make_request');
      return;
    }
    setSelectedCart((prev) => prev.filter((item) => !(item.id === id && item.tipo === tipo)));
  };

  const vaciarSeleccion = () => {
    if (!canMakeRequests()) {
      handlePermissionError('make_request');
      return;
    }
    setSelectedCart([]);
    setError('');
  };

  const totalItems = selectedCart.reduce((sum, item) => sum + (item.cantidad || 0), 0);

  const handleSubmitRequest = async () => {
    if (isSubmittingRequest) return;

    if (!canMakeRequests()) {
      handlePermissionError('make_request');
      return;
    }

    if (selectedCart.length === 0 || totalItems === 0) {
      setError('Selecciona al menos un material con cantidad válida.');
      return;
    }

    if (!pickupDate || !returnDate) {
      setError('Selecciona fechas de recolección y entrega.');
      return;
    }

    let docenteIdToUse = userPermissions.rol === 'docente' ? usuario.id : parseInt(selectedDocenteId);
    if (userPermissions.rol !== 'docente' && !docenteIdToUse) {
      setError('Debes seleccionar un docente encargado.');
      return;
    }

    try {
      setIsSubmittingRequest(true);
      const selectedDocente = docentes.find((doc: any) => doc.id === docenteIdToUse);
      if (!selectedDocente) {
        setError('Docente seleccionado no válido.');
        setIsSubmittingRequest(false);
        return;
      }

      await makeSecureApiCall(`${API_URL}/api/materials/solicitudes`, {
        method: 'POST',
        data: {
          materiales: selectedCart.map((item) => ({
            material_id: item.id,
            cantidad: item.cantidad,
            tipo: item.tipo,
          })),
          motivo: 'Solicitud desde catálogo',
          fecha_solicitud: toLocalDateStr(new Date()),
          fecha_recoleccion: pickupDate,
          fecha_devolucion: returnDate,
          aprobar_automatico: userPermissions.rol === 'docente',
          docente_id: docenteIdToUse,
          nombre_alumno: userPermissions.rol === 'alumno' ? formatName(usuario.nombre) : null,
        },
      });

      setSelectedCart([]);
      setPickupDate('');
      setReturnDate('');
      setShowRequestModal(false);
      setSelectedDocenteId(
        userPermissions.rol === 'docente' ? usuario.id.toString() : ''
      );
      router.replace('/solicitudes');
    } catch (err: any) {
      console.error('Error al enviar solicitud:', err);
      setError('Error al enviar la solicitud: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const filteredMaterials = allMaterials.filter((m) => {
    const matchesSearch = formatName(m.nombre).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRiesgoFisico =
      selectedRiesgoFisico === '' || (m.riesgos_fisicos && m.riesgos_fisicos.includes(selectedRiesgoFisico));
    const matchesRiesgoSalud =
      selectedRiesgoSalud === '' || (m.riesgos_salud && m.riesgos_salud.includes(selectedRiesgoSalud));

    return matchesSearch && matchesRiesgoFisico && matchesRiesgoSalud;
  });

  const handleAdjustClick = (material: any) => {
    if (!canModifyStock()) {
      handlePermissionError('adjust_stock');
      return;
    }
    setMaterialToAdjust(material);
    setAdjustAmount('');
    setShowAdjustModal(true);
    setError('');
  };

  const handleDetailClick = (material: any) => {
    if (!canViewDetails()) {
      return;
    }
    setSelectedMaterial(material);
    setDetailAmount('');
    setShowDetailModal(true);
    setError('');
  };

  const handleAdjustSubmit = async () => {
    if (!materialToAdjust || !canModifyStock()) {
      handlePermissionError('adjust_stock');
      return;
    }

    const delta = parseInt(adjustAmount, 10);
    if (isNaN(delta)) {
      setError('Ingresa un número válido');
      return;
    }

    const newStock = materialToAdjust.cantidad + delta;
    if (newStock < 0) {
      setError('El stock no puede quedar en negativo');
      return;
    }

    try {
      await makeSecureApiCall(
        `${API_URL}/api/materials/material/${materialToAdjust.id}/ajustar`,
        {
          method: 'POST',
          data: {
            cantidad: newStock,
            tipo: materialToAdjust.tipo,
          },
        }
      );

      setAllMaterials((prev) =>
        prev.map((item) =>
          item.id === materialToAdjust.id && item.tipo === materialToAdjust.tipo
            ? { ...item, cantidad: newStock }
            : item
        )
      );

      setShowAdjustModal(false);
      setAdjustAmount('');
      setError('');
    } catch (err: any) {
      console.error('Error al ajustar inventario:', err);
      setError('No se pudo ajustar el stock');
    }
  };

  const handleMassAdjustChange = (material: any, value: string) => {
    const delta = parseInt(value, 10);
    const key = `${material.id}-${material.tipo}`;
    if (isNaN(delta) || delta === 0) {
      setMassAdjustments((prev: any) => {
        const { [key]: _, ...rest } = prev;
        return rest;
      });
      return;
    }
    if (delta < 0 && Math.abs(delta) > material.cantidad) {
      setMassError(
        `No puedes restar más de ${material.cantidad} ${getUnidad(material.tipo)} de ${formatName(material.nombre)}`
      );
      return;
    }
    setMassError('');
    setMassAdjustments((prev: any) => ({
      ...prev,
      [key]: { id: material.id, tipo: material.tipo, nombre: material.nombre, cantidad: delta },
    }));
  };

  const removeMassAdjustment = (key: string) => {
    setMassAdjustments((prev: any) => {
      const { [key]: _, ...rest } = prev;
      return rest;
    });
  };

  const handleMassAdjustSubmit = async () => {
    const ajustes = Object.values(massAdjustments);
    if (ajustes.length === 0) return;

    if (!(userPermissions.rol === 'almacen' && userPermissions.modificar_stock)) {
      handlePermissionError('adjust_stock');
      return;
    }

    try {
      await makeSecureApiCall(
        `${API_URL}/api/materials/ajuste-masivo`,
        {
          method: 'POST',
          data: { ajustes: ajustes.map(({ id, tipo, cantidad }: any) => ({ id, tipo, cantidad })) },
        }
      );
      setMassAdjustments({});
      setMassSearchTerm('');
      setMassError('');
      setShowMassAdjustModal(false);
      await fetchMaterials();
    } catch (err: any) {
      console.error('Error en ajuste masivo:', err);
      setMassError(err.response?.data?.error || 'No se pudo ajustar el stock');
    }
  };

  const handleAddSubmit = async () => {
    const {
      tipoGeneral,
      subTipo,
      nombre,
      descripcion,
      cantidad_inicial,
      estado,
      riesgos_fisicos,
      riesgos_salud,
      riesgos_ambientales,
      imagenFile,
    } = newMaterial;

    if (!subTipo || !nombre || !cantidad_inicial || !imagenFile) {
      setAddError('Completa todos los campos obligatorios');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('tipo', subTipo);
      formData.append('nombre', nombre);
      formData.append('descripcion', descripcion);
      formData.append('cantidad_inicial', cantidad_inicial);
      formData.append('estado', estado);
      if (tipoGeneral === 'Reactivo') {
        formData.append('riesgos_fisicos', riesgos_fisicos);
        formData.append('riesgos_salud', riesgos_salud);
        formData.append('riesgos_ambientales', riesgos_ambientales);
      }
      formData.append('imagen', {
        uri: imagenFile.uri,
        type: imagenFile.type,
        name: imagenFile.name,
      } as any);

      await makeSecureApiCall(`${API_URL}/api/materials/crear`, {
        method: 'POST',
        data: formData,
      });

      setShowAddModal(false);
      setNewMaterial({
        tipoGeneral: 'Reactivo',
        subTipo: '',
        nombre: '',
        descripcion: '',
        cantidad_inicial: '',
        estado: 'disponible',
        riesgos_fisicos: '',
        riesgos_salud: '',
        riesgos_ambientales: '',
        imagenFile: null,
      });
      await fetchMaterials();
    } catch (err: any) {
      console.error('Error al crear material:', err);
      setAddError(err.response?.data?.error || err.message);
    }
  };

  const dismissLowStockAlert = (materialId: number, tipo: string) => {
    if (!canModifyStock()) {
      handlePermissionError('low_stock_alerts');
      return;
    }
    setLowStockMaterials((prev) =>
      prev.filter((material) => !(material.id === materialId && material.tipo === tipo))
    );
  };

  if (permissionsLoading || loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color="#003579" />
          <Text style={styles.loadingText}>
            {permissionsLoading ? 'Verificando permisos...' : 'Cargando catálogo...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (permissionsError) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <View style={styles.errorContent}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Error de Permisos</Text>
          <Text style={styles.errorMessage}>{permissionsError}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setPermissionsError('');
              loadUserPermissions();
            }}
          >
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const numColumns = Math.floor(width / (width > 768 ? 250 : 180)); // Responsive columns

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={['#003579', '#00509e']} style={styles.container}>
        <View style={styles.headerSection}>
          {userPermissions.rol === 'almacen' && userPermissions.modificar_stock && (
            <View style={styles.headerButtons}>
              <TouchableOpacity style={styles.btnAddMaterial} onPress={() => setShowAddModal(true)}>
                <Text style={styles.btnText}>Agregar Material/Reactivo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnMassAdjust} onPress={() => setShowMassAdjustModal(true)}>
                <Text style={styles.btnText}>Ajuste Masivo</Text>
              </TouchableOpacity>
            </View>
          )}
          <Text style={styles.headerTitle}>Catálogo de Materiales</Text>
        </View>

        {userPermissions.rol === 'almacen' && canModifyStock() && lowStockMaterials.length > 0 && (
          <View style={styles.lowStockAlerts}>
            <View style={styles.lowStockHeader}>
              <View style={styles.lowStockIconContainer}>
                <Text style={styles.lowStockIcon}>!</Text>
              </View>
              <View>
                <Text style={styles.lowStockTitle}>Advertencia de Stock Bajo</Text>
                <Text style={styles.lowStockSubtitle}>
                  Materiales con stock por debajo de {LOW_STOCK_THRESHOLD} unidades:
                </Text>
              </View>
            </View>
            {lowStockMaterials.map((material) => (
              <View key={`${material.tipo}-${material.id}`} style={styles.lowStockItem}>
                <View style={styles.lowStockContent}>
                  <Text style={styles.lowStockMaterial}>
                    {formatName(material.nombre)} ({material.tipo})
                  </Text>
                  <Text style={styles.lowStockQuantity}>
                    Stock: {material.cantidad} {getUnidad(material.tipo)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.dismissBtn}
                  onPress={() => dismissLowStockAlert(material.id, material.tipo)}
                >
                  <Text style={styles.dismissBtnText}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <View style={styles.searchFilterContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar materiales..."
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
          {userPermissions.rol !== 'alumno' && (
            <>
              <TextInput
                style={styles.filterSelect}
                placeholder="Todos los riesgos físicos"
                value={selectedRiesgoFisico}
                onChangeText={setSelectedRiesgoFisico}
              />
              <TextInput
                style={styles.filterSelect}
                placeholder="Todos los riesgos de salud"
                value={selectedRiesgoSalud}
                onChangeText={setSelectedRiesgoSalud}
              />
            </>
          )}
        </View>

        {error && <Text style={styles.alertCustom}>{error}</Text>}

        {loading ? (
          <View style={styles.loadingSpinner}>
            <ActivityIndicator size="large" color="#003579" />
          </View>
        ) : (
          <FlatList
            data={filteredMaterials}
            keyExtractor={(item) => `${item.tipo}-${item.id}`}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.materialCard,
                  (userPermissions.rol === 'almacen' && userPermissions.modificar_stock) || canViewDetails()
                    ? styles.materialCardClickable
                    : styles.materialCardNonClickable,
                ]}
                onPress={() => {
                  if (userPermissions.rol === 'almacen' && userPermissions.modificar_stock) {
                    handleAdjustClick(item);
                  } else {
                    handleDetailClick(item);
                  }
                }}
              >
                <Image
                  source={{ uri: item.imagen_url || '' }}
                  style={styles.materialImage}
                  resizeMode="contain"
                />
                <View style={styles.materialCardContent}>
                  <Text style={styles.materialCardName}>{formatName(item.nombre)}</Text>
                  <Text style={[styles.materialCardType, { backgroundColor: getTypeColor(item.tipo).backgroundColor, color: getTypeColor(item.tipo).color }]}>
                    {item.tipo}
                  </Text>
                  <Text style={[styles.materialCardStock, { color: getStockColor(item) }]}>
                    {displayStock(item)}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            numColumns={numColumns}
            contentContainerStyle={styles.materialGrid}
            key={numColumns} // Re-render when columns change
          />
        )}

        {(userPermissions.rol === 'alumno' || userPermissions.rol === 'docente') && (
          <TouchableOpacity style={styles.cartToggle} onPress={() => setShowCart(!showCart)}>
            <Text style={styles.cartToggleText}>Carrito de solicitudes</Text>
          </TouchableOpacity>
        )}

        <Modal visible={showCart} animationType="slide" transparent={true}>
          <View style={styles.cartOverlay}>
            <View style={styles.cartContainer}>
              <View style={styles.cartHeader}>
                <Text style={styles.cartHeaderTitle}>Carrito de Solicitud</Text>
                <Text style={styles.cartHeaderSmall}>
                  {totalItems} {totalItems === 1 ? 'material' : 'materiales'} seleccionados
                </Text>
              </View>
              <ScrollView style={styles.cartBody}>
                {selectedCart.length === 0 ? (
                  <View style={styles.emptyCart}>
                    <Text style={styles.emptyCartIcon}>🛒</Text>
                    <Text style={styles.emptyCartText}>Carrito vacío</Text>
                    <Text style={styles.emptyCartSmall}>Selecciona materiales para crear un vale</Text>
                  </View>
                ) : (
                  selectedCart.map((item) => (
                    <View key={`${item.tipo}-${item.id}`} style={styles.cartItem}>
                      <View>
                        <Text style={styles.cartItemName}>{formatName(item.nombre)}</Text>
                        <Text style={styles.cartItemQuantity}>
                          {item.cantidad} {getUnidad(item.tipo)} ({item.tipo})
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.btnRemove}
                        onPress={() => removeFromCart(item.id, item.tipo)}
                        disabled={!canMakeRequests()}
                      >
                        <Text style={styles.btnRemoveText}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </ScrollView>
              {selectedCart.length > 0 && (
                <View style={styles.cartFooter}>
                  <TouchableOpacity
                    style={styles.btnCreateVale}
                    onPress={() => setShowRequestModal(true)}
                    disabled={selectedCart.length === 0 || totalItems === 0 || !canMakeRequests()}
                  >
                    <Text style={styles.btnText}>Crear Vale</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.btnClear}
                    onPress={vaciarSeleccion}
                    disabled={selectedCart.length === 0 || !canMakeRequests()}
                  >
                    <Text style={styles.btnText}>Vaciar Selección</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </Modal>

        <Modal visible={showAddModal} animationType="fade" transparent={true}>
          <View style={styles.modalOverlay}>
            <ScrollView contentContainerStyle={styles.modalContentCustom}>
              <View style={styles.modalHeaderCustom}>
                <Text style={styles.modalTitle}>Agregar Material / Reactivo</Text>
                <TouchableOpacity onPress={() => setShowAddModal(false)}>
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              <View style={styles.modalBody}>
                {addError && <Text style={styles.alertCustom}>{addError}</Text>}
                {/* Adapt form inputs for newMaterial */}
                {/* Note: File upload in RN requires expo-image-picker or similar; assume implemented */}
                {/* ... Add all form fields similarly ... */}
              </View>
              <View style={styles.modalFooterCustom}>
                <TouchableOpacity style={styles.btnSecondaryCustom} onPress={() => setShowAddModal(false)}>
                  <Text style={styles.btnText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnCreateVale} onPress={handleAddSubmit}>
                  <Text style={styles.btnText}>Crear</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </Modal>

        {/* Similarly implement other modals: showMassAdjustModal, showRequestModal, showAdjustModal, showDetailModal */}
        {/* For date pickers in modals, use DateTimePicker */}
        {/* Example for pickupDate in showRequestModal: */}
        {/* <TouchableOpacity onPress={() => setShowDatePicker({ ...showDatePicker, pickup: true })}> */}
        {/*   <Text>Select Date</Text> */}
        {/* </TouchableOpacity> */}
        {/* {showDatePicker.pickup && ( */}
        {/*   <DateTimePicker */}
        {/*     value={tempDate} */}
        {/*     mode="date" */}
        {/*     display={Platform.OS === 'ios' ? 'spinner' : 'default'} */}
        {/*     onChange={(event, selected) => { */}
        {/*       setShowDatePicker({ ...showDatePicker, pickup: Platform.OS === 'ios' }); */}
        {/*       if (selected) setPickupDate(getFormattedDate(selected)); */}
        {/*     }} */}
        {/*   /> */}
        {/* )} */}
        {/* Repeat for returnDate */}

        {/* Ensure all modals are implemented with similar structure */}
      </LinearGradient>
    </SafeAreaView>
  );
}

const getTypeColor = (tipo: string) => {
  switch (tipo) {
    case 'liquido':
      return { backgroundColor: '#dbeafe', color: '#1e40af' };
    case 'solido':
      return { backgroundColor: '#fef3c7', color: '#92400e' };
    case 'laboratorio':
      return { backgroundColor: '#e0e7ff', color: '#4338ca' };
    case 'equipo':
      return { backgroundColor: '#d1fae5', color: '#065f46' };
    default:
      return { backgroundColor: '#f3f4f6', color: '#1f2937' };
  }
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: width > 768 ? 24 : 16,
  },
  headerSection: {
    padding: 16,
    flexDirection: width > 768 ? 'row' : 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  btnAddMaterial: {
    backgroundColor: '#00c16e',
    padding: 10,
    borderRadius: 6,
  },
  btnMassAdjust: {
    backgroundColor: '#3b82f6',
    padding: 10,
    borderRadius: 6,
  },
  btnText: {
    color: '#fff',
    fontWeight: '600',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  lowStockAlerts: {
    backgroundColor: '#fef7cd',
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
    padding: 16,
    marginBottom: 16,
    borderRadius: 6,
  },
  lowStockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  lowStockIconContainer: {
    width: 28,
    height: 28,
    backgroundColor: '#f59e0b',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  lowStockIcon: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  lowStockTitle: {
    color: '#92400e',
    fontSize: 18,
    fontWeight: '600',
  },
  lowStockSubtitle: {
    color: '#b45309',
    fontSize: 14,
  },
  lowStockItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
  },
  lowStockContent: {
    flex: 1,
  },
  lowStockMaterial: {
    color: '#92400e',
    fontWeight: '600',
    fontSize: 14,
  },
  lowStockQuantity: {
    color: '#b45309',
    fontSize: 12,
  },
  dismissBtn: {
    backgroundColor: 'transparent',
    padding: 8,
  },
  dismissBtnText: {
    color: '#92400e',
    fontSize: 18,
  },
  searchFilterContainer: {
    flexDirection: width > 768 ? 'row' : 'column',
    gap: 8,
    padding: 16,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  filterSelect: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  materialGrid: {
    padding: 16,
  },
  materialCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    margin: 8,
    width: width / numColumns - 16, // Responsive width
  },
  materialCardClickable: {
    // Add hover-like if needed, but in RN use active opacity
  },
  materialCardNonClickable: {
    opacity: 0.85,
  },
  materialImage: {
    width: '100%',
    height: 140,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  materialCardContent: {
    padding: 16,
  },
  materialCardName: {
    fontWeight: '600',
    color: '#1f2937',
    fontSize: 14,
    marginBottom: 8,
  },
  materialCardType: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 4,
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  materialCardStock: {
    fontSize: 12,
    fontWeight: '500',
  },
  cartToggle: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: '#003579',
    padding: 12,
    borderRadius: 6,
    zIndex: 1001,
  },
  cartToggleText: {
    color: '#fff',
    fontWeight: '600',
  },
  cartOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  cartContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    height: '80%',
  },
  cartHeader: {
    padding: 16,
  },
  cartHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#003579',
  },
  cartHeaderSmall: {
    fontSize: 12,
    color: '#00509e',
  },
  cartBody: {
    padding: 16,
  },
  cartItem: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cartItemName: {
    fontWeight: '600',
    color: '#1f2937',
    fontSize: 14,
  },
  cartItemQuantity: {
    color: '#00509e',
    fontSize: 12,
  },
  btnRemove: {
    backgroundColor: '#ef4444',
    borderRadius: 4,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnRemoveText: {
    color: '#fff',
    fontSize: 18,
  },
  cartFooter: {
    padding: 16,
    gap: 8,
  },
  btnCreateVale: {
    backgroundColor: '#003579',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  btnClear: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 16,
  },
  modalContentCustom: {
    backgroundColor: '#fff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    width: '90%',
    maxWidth: width > 768 ? 600 : width - 32,
    maxHeight: '90%',
  },
  modalHeaderCustom: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  modalBody: {
    padding: 16,
  },
  modalFooterCustom: {
    padding: 16,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  // Add more styles for modals as needed
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingContent: {
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 32,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  loadingText: {
    color: '#003579',
    fontSize: 16,
    fontWeight: '500',
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  errorContent: {
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 40,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    maxWidth: 500,
  },
  errorIcon: {
    fontSize: 48,
    color: '#ef4444',
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 12,
  },
  errorMessage: {
    color: '#00509e',
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#003579',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 6,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyCart: {
    alignItems: 'center',
    paddingVertical: 24,
    color: '#00509e',
  },
  emptyCartIcon: {
    fontSize: 40,
    marginBottom: 12,
    opacity: 0.4,
  },
  emptyCartText: {
    fontWeight: '600',
    color: '#003579',
    marginBottom: 4,
    fontSize: 14,
  },
  emptyCartSmall: {
    color: '#9ca3af',
    fontSize: 12,
  },
  alertCustom: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 6,
    padding: 12,
    marginBottom: 12,
    color: '#dc2626',
    fontSize: 14,
  },
  // ... Add remaining styles adapted from CSS, using RN equivalents for shadows, transitions (use Animated if needed), etc.
});