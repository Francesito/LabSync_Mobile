import { useEffect, useState, useRef } from 'react';
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
  Image,
  Animated,
  PanResponder,
  Keyboard,
} from 'react-native';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
// eslint-disable-next-line import/no-unresolved
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { API_URL } from '@/constants/api';
import { useAuth } from '../../lib/auth';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const windowDimensions = Dimensions.get('window');

function toLocalDateStr(date: Date): string {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().split('T')[0];
}

export default function CatalogoScreen() {
  const router = useRouter();
  const { usuario, loading: authLoading } = useAuth();
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
  const [showCartModal, setShowCartModal] = useState(false);
  const [screenWidth, setScreenWidth] = useState(windowDimensions.width);
  const [screenHeight, setScreenHeight] = useState(windowDimensions.height);
 const initialCartPos = { x: screenWidth - 80, y: 20 };
  const cartPosition = useRef(new Animated.ValueXY(initialCartPos)).current;
  const [cartPos, setCartPos] = useState(initialCartPos);
  
  useEffect(() => {
    const id = cartPosition.addListener(({ x, y }) => setCartPos({ x, y }));
    return () => cartPosition.removeListener(id);
  }, [cartPosition]);

    const resetCartPosition = () => {
    const start = { x: screenWidth - 80, y: 20 };
    cartPosition.setValue(start);
    setCartPos(start);
  };

  const closeCartModal = () => {
    setShowCartModal(false);
    resetCartPosition();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
         cartPosition.stopAnimation();
        cartPosition.setOffset({ x: cartPos.x, y: cartPos.y });
        cartPosition.setValue({ x: 0, y: 0 });
      },
     onPanResponderMove: Animated.event(
        [null, { dx: cartPosition.x, dy: cartPosition.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        cartPosition.flattenOffset();
         Animated.timing(cartPosition, {
          toValue: {
            x: Math.max(0, Math.min(cartPos.x, screenWidth - 60)),
            y: Math.max(0, Math.min(cartPos.y, screenHeight - 60)),
          },
           duration: 100,
          useNativeDriver: false,
        }).start();
      },
    })
  ).current;

  const LOW_STOCK_THRESHOLD = 50;
  const CLOUDINARY_CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || 'tu-cloud-name';

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenWidth(window.width);
      setScreenHeight(window.height);
    });
    return () => subscription?.remove();
  }, []);

  const getFormattedDate = (d: Date) => d.toISOString().split('T')[0];

  const computeMinPickupDate = () => {
    const now = new Date();
    let d = new Date(now);
    const day = d.getDay();
    const hour = d.getHours();

    if (day === 6) {
      d.setDate(d.getDate() + 2);
    } else if (day === 0) {
      d.setDate(d.getDate() + (hour >= 21 ? 2 : 1));
    } else {
      d.setDate(d.getDate() + (hour >= 21 ? 2 : 1));
      if (d.getDay() === 6) d.setDate(d.getDate() + 2);
      if (d.getDay() === 0) d.setDate(d.getDate() + 1);
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
        setSelectedDocenteId(usuario?.id ? usuario.id.toString() : '');
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
    if (authLoading) return;

    if (!usuario) {
      router.replace('/login');
      return;
    }

    const initializeComponent = async () => {
      await loadUserPermissions();
    };

    initializeComponent();
  }, [usuario, authLoading]);

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

    const docenteIdToUse =
      userPermissions.rol === 'docente' ? usuario?.id : parseInt(selectedDocenteId, 10);
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
          nombre_alumno: userPermissions.rol === 'alumno' ? formatName(usuario?.nombre ?? '') : null,
        },
      });

      setSelectedCart([]);
      setPickupDate('');
      setReturnDate('');
      setShowRequestModal(false);
      setSelectedDocenteId(
        userPermissions.rol === 'docente' ? usuario?.id?.toString() || '' : ''
      );
      router.replace('/solicitudes');
    } catch (err: any) {
      console.error('Error al enviar solicitud:', err);
      setError('Error al enviar la solicitud: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsSubmittingRequest(false);
    }
  };

   const filteredMaterials = allMaterials.filter((m) =>
    formatName(m.nombre).toLowerCase().includes(searchTerm.toLowerCase())
  );

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
     const sanitized = value.replace(/[^0-9-]/g, '');
    const delta = parseInt(sanitized, 10);
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

    const handleDetailAmountChange = (value: string) => {
    setDetailAmount(value.replace(/[^0-9]/g, ''));
  };

  const handleAdjustAmountChange = (value: string) => {
    setAdjustAmount(value.replace(/[^0-9-]/g, ''));
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
        type: imagenFile.type || 'image/jpeg',
        name: imagenFile.name || 'image.jpg',
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

 const cardWidth = (screenWidth - 32 - 16) / 3; // Padding 16 sides, gap 8 between cards

   const filteredMassMaterials = allMaterials.filter((m) =>
    formatName(m.nombre).toLowerCase().includes(massSearchTerm.toLowerCase())
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.safeArea}>
        <LinearGradient colors={['#003579', '#00509e']} style={styles.container}>
          <View style={styles.headerSection}>
            {userPermissions.rol === 'almacen' && userPermissions.modificar_stock && (
              <View style={styles.headerButtons}>
                <TouchableOpacity style={styles.btnAddMaterial} onPress={() => setShowAddModal(true)}>
                  <Text style={styles.btnText}>Agregar Material/Reactivo</Text>
                </TouchableOpacity>
               <TouchableOpacity
                  style={styles.btnMassAdjust}
                  onPress={() => {
                    setShowMassAdjustModal(true);
                  }}
                >
                  <Text style={styles.btnText}>Ajuste Masivo</Text>
                </TouchableOpacity>
              </View>
            )}
            <Text style={styles.headerTitle}>Catálogo de Materiales</Text>
          </View>

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
                    { width: cardWidth },
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
                  activeOpacity={0.7}
                >
                  <Image
                   source={
                      item.imagen_url
                        ? { uri: item.imagen_url }
                        : require('../../assets/images/react-logo.png')
                    }
                    style={styles.materialImage}
                    resizeMode="contain"
                  />
                  <View style={styles.materialCardContent}>
                    <Text style={styles.materialCardName} numberOfLines={2} ellipsizeMode="tail">{formatName(item.nombre)}</Text>
                    <Text style={[styles.materialCardType, { backgroundColor: getTypeColor(item.tipo).backgroundColor, color: getTypeColor(item.tipo).color }]}>
                      {item.tipo}
                    </Text>
                     <Text style={[styles.materialCardStock, { color: getStockColor(item) }]}> {displayStock(item)}</Text>
                  </View>
                </TouchableOpacity>
              )}
              numColumns={3}
              contentContainerStyle={styles.materialGrid}
             columnWrapperStyle={{ justifyContent: 'center' }}
              ListHeaderComponent={(
                <>
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
                      {lowStockMaterials.map((item) => (
                        <View key={`${item.tipo}-${item.id}`} style={styles.lowStockItem}>
                          <View style={styles.lowStockContent}>
                            <Text style={styles.lowStockMaterial}>
                              {formatName(item.nombre)} ({item.tipo})
                            </Text>
                            <Text style={styles.lowStockQuantity}>
                              Stock: {item.cantidad} {getUnidad(item.tipo)}
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={styles.dismissBtn}
                            onPress={() => dismissLowStockAlert(item.id, item.tipo)}
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
                        returnKeyType="done"
                      onSubmitEditing={Keyboard.dismiss}
                    />
                  </View>
                  {error && <Text style={styles.alertCustom}>{error}</Text>}
                </>
              )}
            />
          )}

          {(userPermissions.rol === 'alumno' || userPermissions.rol === 'docente') && (
              <Animated.View
              style={[
                styles.floatingCart,
                {
                  transform: [{ translateX: cartPosition.x }, { translateY: cartPosition.y }],
                },
              ]}
              {...panResponder.panHandlers}
            >
              <TouchableOpacity onPress={() => setShowCartModal(true)}>
                <Ionicons name="cart" size={32} color="#fff" />
                {totalItems > 0 && (
                  <View style={styles.cartBadge}>
                    <Text style={styles.cartBadgeText}>{totalItems}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>
          )}

          <Modal visible={showCartModal} animationType="fade" transparent={true} onRequestClose={closeCartModal}>
            <View style={styles.modalOverlay}>
              <View style={styles.cartContainer}>
                <View style={styles.cartHeader}>
                 <View>
                    <Text style={styles.cartHeaderTitle}>Carrito de Solicitud</Text>
                    <Text style={styles.cartHeaderSmall}>
                      {totalItems} {totalItems === 1 ? 'material' : 'materiales'} seleccionados
                    </Text>
                  </View>
                  <TouchableOpacity onPress={closeCartModal}>
                    <Ionicons name="close" size={24} color="#003579" />
                  </TouchableOpacity>
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
                      onPress={() => {
                       closeCartModal();
                        setShowRequestModal(true);
                      }}
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
               <TouchableOpacity style={styles.btnSecondaryCustom} onPress={closeCartModal}>
                  <Text style={styles.btnSecondaryText}>Cerrar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          <Modal visible={showDetailModal} animationType="fade" transparent={true} onRequestClose={() => setShowDetailModal(false)}>
            <View style={styles.modalOverlay}>
             <View style={styles.modalContentCustom}>
                <View style={styles.modalHeaderCustom}>
                  <Text style={styles.modalTitle}>Detalles: {formatName(selectedMaterial?.nombre || '')}</Text>
                  <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                    <Ionicons name="close" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>
                <View style={styles.modalBody}>
                  {error && <Text style={styles.alertCustom}>{error}</Text>}
                  {!canViewDetails() && (
                    <Text style={styles.securityAlert}>
                      ⚠️ Vista limitada: Como {userPermissions.rol}, solo puedes consultar la información básica del material.
                    </Text>
                  )}
                  <Image
                   source={
                      selectedMaterial?.imagen_url
                        ? { uri: selectedMaterial.imagen_url }
                        : require('../../assets/images/react-logo.png')
                    }
                    style={styles.detailImage}
                    resizeMode="contain"
                  />
                  <Text style={styles.modalBodyH5}>Información</Text>
                  <Text style={styles.textMuted}>
                    Tipo: {selectedMaterial?.tipo}
                    {'\n'}
                    Stock: {displayStock(selectedMaterial || {})}
                  </Text>

                  {selectedMaterial && (selectedMaterial.riesgos_fisicos || selectedMaterial.riesgos_salud || selectedMaterial.riesgos_ambientales) ? (
                    <View>
                      <Text style={styles.modalBodyH5}>Riesgos</Text>
                      <View style={styles.riesgosContainer}>
                        {parseRiesgos(selectedMaterial.riesgos_fisicos || '').map((riesgo) => (
                          <View key={riesgo} style={[styles.riesgoBadge, { backgroundColor: getRiesgoColor(riesgo).backgroundColor }]}>
                            <Text style={{ color: getRiesgoColor(riesgo).color }}>{getRiesgoIcon(riesgo)} {riesgo}</Text>
                          </View>
                        ))}
                        {parseRiesgos(selectedMaterial.riesgos_salud || '').map((riesgo) => (
                          <View key={riesgo} style={[styles.riesgoBadge, { backgroundColor: getRiesgoColor(riesgo).backgroundColor }]}>
                            <Text style={{ color: getRiesgoColor(riesgo).color }}>{getRiesgoIcon(riesgo)} {riesgo}</Text>
                          </View>
                        ))}
                        {parseRiesgos(selectedMaterial.riesgos_ambientales || '').map((riesgo) => (
                          <View key={riesgo} style={[styles.riesgoBadge, { backgroundColor: getRiesgoColor(riesgo).backgroundColor }]}>
                            <Text style={{ color: getRiesgoColor(riesgo).color }}>{getRiesgoIcon(riesgo)} {riesgo}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : (
                    <Text style={styles.noRisks}>No se han registrado riesgos para este material.</Text>
                  )}

                  {canMakeRequests() && canViewDetails() && (
                    <View style={styles.requestForm}>
                      <Text style={styles.formLabel}>Cantidad a solicitar</Text>
                      <TextInput
                        style={styles.quantityInput}
                        value={detailAmount}
                     onChangeText={handleDetailAmountChange}
                        placeholder="Ingresa cantidad"
                       keyboardType="default"
                        returnKeyType="done"
                        onSubmitEditing={Keyboard.dismiss}
                        editable={selectedMaterial?.cantidad !== 0}
                      />
                      <TouchableOpacity
                        style={styles.btnAddToCart}
                        onPress={() => addToCart(selectedMaterial, detailAmount)}
                        disabled={
                          !detailAmount ||
                          parseInt(detailAmount) <= 0 ||
                          parseInt(detailAmount) > (selectedMaterial?.cantidad || 0) ||
                          selectedMaterial?.cantidad === 0 ||
                          !canMakeRequests()
                        }
                      >
                        <Text style={styles.btnText}>
                          {selectedMaterial?.cantidad === 0 ? 'Material Agotado' : 'Añadir al carrito'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
                <View style={styles.modalFooterCustom}>
                  <TouchableOpacity style={styles.btnSecondaryCustom} onPress={() => setShowDetailModal(false)}>
                    <Text style={styles.btnSecondaryText}>Cerrar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          <Modal visible={showRequestModal} animationType="fade" transparent={true} onRequestClose={() => setShowRequestModal(false)}>
            <View style={styles.modalOverlay}>
             <View style={styles.modalContentCustom}>
                <View style={styles.modalHeaderCustom}>
                  <Text style={styles.modalTitle}>Confirmar Solicitud</Text>
                  <TouchableOpacity onPress={() => setShowRequestModal(false)}>
                    <Ionicons name="close" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>
                <View style={styles.modalBody}>
                  {error && <Text style={styles.alertCustom}>{error}</Text>}
                  <Text style={styles.infoAlert}>Estás a punto de crear un vale con los siguientes materiales:</Text>
                  {selectedCart.map((item) => (
                    <View key={`${item.tipo}-${item.id}`} style={styles.requestItem}>
                      <Text style={styles.fontSemibold}>{formatName(item.nombre)}</Text>
                      <Text style={styles.fontRegular}>{item.tipo}</Text>
                      <Text style={styles.fontBold}>{item.cantidad} {getUnidad(item.tipo)}</Text>
                    </View>
                  ))}
                  {userPermissions.rol !== 'docente' && (
                    <View>
                      <Text style={styles.formLabel}>Selecciona el docente encargado *</Text>
                      <TextInput
                        style={styles.formControl}
                        value={selectedDocenteId}
                        onChangeText={setSelectedDocenteId}
                      />
                    </View>
                  )}
                  {/* Add date pickers for pickup and return */}
                </View>
                <View style={styles.modalFooterCustom}>
                  <TouchableOpacity style={styles.btnSecondaryCustom} onPress={() => setShowRequestModal(false)}>
                    <Text style={styles.btnSecondaryText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.btnCreateVale} onPress={handleSubmitRequest} disabled={isSubmittingRequest}>
                    <Text style={styles.btnText}>{isSubmittingRequest ? 'Enviando...' : 'Confirmar'}</Text>
                  </TouchableOpacity>
                </View>
             </View>
            </View>
          </Modal>

          <Modal visible={showAdjustModal} animationType="fade" transparent={true} onRequestClose={() => setShowAdjustModal(false)}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContentCustom}>
                <View style={styles.modalHeaderCustom}>
                  <Text style={styles.modalTitle}>Ajustar Inventario: {formatName(materialToAdjust?.nombre || '')}</Text>
                  <TouchableOpacity onPress={() => setShowAdjustModal(false)}>
                    <Ionicons name="close" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>
                <View style={styles.modalBody}>
                  {error && <Text style={styles.alertCustom}>{error}</Text>}
                  {!canModifyStock() && (
                    <Text style={styles.alertCustom}>
                      ⚠️ No tienes permisos para modificar el stock. Esta funcionalidad está restringida.
                    </Text>
                  )}
                  <Text style={styles.formLabel}>
                    Stock actual: {materialToAdjust?.cantidad} {getUnidad(materialToAdjust?.tipo || '')}
                  </Text>
                  <TextInput
                    style={styles.formControl}
                    value={adjustAmount}
                    onChangeText={handleAdjustAmountChange}
                    placeholder="Añade o quita stock"
                     keyboardType="default"
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                    editable={canModifyStock()}
                  />
                </View>
                <View style={styles.modalFooterCustom}>
                  <TouchableOpacity style={styles.btnSecondaryCustom} onPress={() => setShowAdjustModal(false)}>
                    <Text style={styles.btnSecondaryText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.btnCreateVale} onPress={handleAdjustSubmit}>
                    <Text style={styles.btnText}>Guardar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.btnDanger} onPress={handleDeleteMaterial}>
                    <Text style={styles.btnText}>Eliminar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

           <Modal
            visible={showMassAdjustModal}
            animationType="fade"
            transparent={true}
             onRequestClose={() => setShowMassAdjustModal(false)}
             >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContentCustom}>
                <View style={styles.modalHeaderCustom}>
                  <Text style={styles.modalTitle}>Ajuste Masivo de Inventario</Text>
                       <TouchableOpacity onPress={() => setShowMassAdjustModal(false)}>
                    <Ionicons name="close" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>
                <View style={styles.modalBody}>
                  {massError && <Text style={styles.alertCustom}>{massError}</Text>}
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Buscar..."
                    value={massSearchTerm}
                    onChangeText={setMassSearchTerm}
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                  />
                  <FlatList
                   data={filteredMassMaterials}
                    keyExtractor={(item) => `${item.tipo}-${item.id}`}
                    renderItem={({ item }) => (
                      <View style={styles.massAdjustItem}>
                        <Text style={styles.fontRegular}>{formatName(item.nombre)}</Text>
                        <TextInput
                          style={styles.massInput}
                          placeholder={getUnidad(item.tipo)}
                          value={massAdjustments[`${item.id}-${item.tipo}`]?.cantidad?.toString() ?? ''}
                          onChangeText={(value) => handleMassAdjustChange(item, value)}
                           keyboardType="default"
                          returnKeyType="done"
                          onSubmitEditing={Keyboard.dismiss}
                        />
                      </View>
                    )}
                    style={styles.massList}
                  />
                  {Object.values(massAdjustments).length > 0 && (
                    <View style={styles.massTags}>
                      {Object.values(massAdjustments).map((a: any) => {
                        const key = `${a.id}-${a.tipo}`;
                        return (
                          <View key={key} style={styles.ajusteTag}>
                            <Text style={styles.fontRegular}>{`${formatName(a.nombre)} ${a.cantidad} ${getUnidad(a.tipo)}`}</Text>
                            <TouchableOpacity style={styles.tagRemove} onPress={() => removeMassAdjustment(key)}>
                              <Text>&times;</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
                <View style={styles.modalFooterCustom}>
                  <TouchableOpacity
                    style={styles.btnSecondaryCustom}
                      onPress={() => setShowMassAdjustModal(false)}
                  >
                    <Text style={styles.btnSecondaryText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.btnCreateVale} onPress={handleMassAdjustSubmit} disabled={Object.values(massAdjustments).length === 0}>
                    <Text style={styles.btnText}>Guardar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          <Modal visible={showAddModal} animationType="fade" transparent={true} onRequestClose={() => setShowAddModal(false)}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContentCustom}>
                <View style={styles.modalHeaderCustom}>
                  <Text style={styles.modalTitle}>Agregar Material / Reactivo</Text>
                  <TouchableOpacity onPress={() => setShowAddModal(false)}>
                    <Ionicons name="close" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: 16 }}>
                  {addError && <Text style={styles.alertCustom}>{addError}</Text>}
                  <Text style={styles.formLabel}>¿Es Reactivo o Material? *</Text>
                  <TextInput
                    style={styles.formControl}
                    value={newMaterial.tipoGeneral}
                    onChangeText={(value) => setNewMaterial({ ...newMaterial, tipoGeneral: value, subTipo: '' })}
                  />
                  <Text style={styles.formLabel}>Categoría específica *</Text>
                  <TextInput
                    style={styles.formControl}
                    value={newMaterial.subTipo}
                    onChangeText={(value) => setNewMaterial({ ...newMaterial, subTipo: value })}
                  />
                  <Text style={styles.formLabel}>Nombre *</Text>
                  <TextInput
                    style={styles.formControl}
                    value={newMaterial.nombre}
                    onChangeText={(value) => setNewMaterial({ ...newMaterial, nombre: value })}
                  />
                  <Text style={styles.formLabel}>
                    Cantidad inicial {newMaterial.subTipo === 'liquido' ? '(ml)' : newMaterial.subTipo === 'solido' ? '(g)' : '(unidades)'} *
                  </Text>
                  <TextInput
                    style={styles.formControl}
                    value={newMaterial.cantidad_inicial}
                    onChangeText={(value) =>
                      setNewMaterial({
                        ...newMaterial,
                        cantidad_inicial: value.replace(/[^0-9]/g, ''),
                      })
                    }
                    keyboardType="default"
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                  />
                  <Text style={styles.formLabel}>Estado *</Text>
                  <TextInput
                    style={styles.formControl}
                    value={newMaterial.estado}
                    onChangeText={(value) => setNewMaterial({ ...newMaterial, estado: value })}
                  />
                  <Text style={styles.formLabel}>Imagen (.jpg) *</Text>
                  {/* Implement image picker here */}
                  <Text style={styles.formLabel}>Descripción</Text>
                  <TextInput
                    style={styles.formControl}
                    value={newMaterial.descripcion}
                    onChangeText={(value) => setNewMaterial({ ...newMaterial, descripcion: value })}
                    multiline
                  />
                  {newMaterial.tipoGeneral === 'Reactivo' && (
                    <>
                      <Text style={styles.formLabel}>Riesgos Físicos</Text>
                      <TextInput
                        style={styles.formControl}
                        value={newMaterial.riesgos_fisicos}
                        onChangeText={(value) => setNewMaterial({ ...newMaterial, riesgos_fisicos: value })}
                        multiline
                      />
                      <Text style={styles.formLabel}>Riesgos Salud</Text>
                      <TextInput
                        style={styles.formControl}
                        value={newMaterial.riesgos_salud}
                        onChangeText={(value) => setNewMaterial({ ...newMaterial, riesgos_salud: value })}
                        multiline
                      />
                      <Text style={styles.formLabel}>Riesgos Ambientales</Text>
                      <TextInput
                        style={styles.formControl}
                        value={newMaterial.riesgos_ambientales}
                        onChangeText={(value) => setNewMaterial({ ...newMaterial, riesgos_ambientales: value })}
                        multiline
                      />
                    </>
                  )}
                 <View style={styles.modalFooterCustom}>
                    <TouchableOpacity style={styles.btnSecondaryCustom} onPress={() => setShowAddModal(false)}>
                      <Text style={styles.btnSecondaryText}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btnCreateVale} onPress={handleAddSubmit}>
                      <Text style={styles.btnText}>Crear</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            </View>
          </Modal>
        </LinearGradient>
      </SafeAreaView>
    </GestureHandlerRootView>
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
  requestItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  headerSection: {
    padding: 16,
    flexDirection: 'row',
     flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
     marginBottom: 8,
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
  btnSecondaryText: {
    color: '#003579',
    fontWeight: '600',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
     textAlign: 'center',
    width: '100%',
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
   paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    width: '100%',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#fff',
      width: '100%',
    marginBottom: 12,
  },
  filterSelect: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  loadingSpinner: {
    justifyContent: 'center',
    alignItems: 'center',
    height: 300,
  },
  materialGrid: {
    padding: 16,
      alignItems: 'center',
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
    elevation: 2,
  },
  materialCardClickable: {
    // In RN, use activeOpacity on TouchableOpacity
  },
  materialCardNonClickable: {
    opacity: 0.85,
  },
  materialImage: {
    width: '100%',
      height: ((Dimensions.get('window').width - 32 - 16) / 3) * 0.8, 
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  materialCardContent: {
    padding: 8,
  },
  materialCardName: {
    fontWeight: '600',
    color: '#1f2937',
    fontSize: 12,
    marginBottom: 4,
    textAlign: 'center',
  },
  materialCardType: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    fontSize: 10,
    fontWeight: '500',
    marginBottom: 2,
    alignSelf: 'center',
  },
  materialCardStock: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
  },
  floatingCart: {
    position: 'absolute',
    backgroundColor: '#003579',
    borderRadius: 30,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 1001,
  },
  cartBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  cartBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
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
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    width: '90%',
    maxWidth: 600,
    maxHeight: '90%',
    padding: 16,
  },
  modalHeaderCustom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  modalBody: {
    padding: 16,
     flexShrink: 1,
  },
  modalFooterCustom: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
    padding: 16,
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
  formLabel: {
    color: '#374151',
    fontWeight: '600',
    marginBottom: 8,
    fontSize: 14,
  },
  formControl: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  detailImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  textMuted: {
    color: '#00509e',
    fontSize: 14,
  },
  modalBodyH5: {
    color: '#1f2937',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  riesgosContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  riesgoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    margin: 4,
  },
  noRisks: {
    color: '#00509e',
    fontSize: 14,
    fontStyle: 'italic',
  },
  requestForm: {
    marginTop: 16,
  },
  quantityInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 4,
    padding: 8,
    textAlign: 'center',
    fontSize: 14,
    width: 80,
    marginBottom: 12,
  },
  btnAddToCart: {
    backgroundColor: '#003579',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  btnSecondaryCustom: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  btnCreateVale: {
    backgroundColor: '#003579',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  btnClear: {
    backgroundColor: '#f59e0b',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  btnDanger: {
    backgroundColor: '#ef4444',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  cartContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '90%',
    maxHeight: '80%',
  },
  cartHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
      flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    borderRadius: 10,
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
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  emptyCart: {
    alignItems: 'center',
    paddingVertical: 24,
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
  infoAlert: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 6,
    padding: 12,
    color: '#1e40af',
    fontSize: 14,
    marginBottom: 12,
  },
  securityAlert: {
    backgroundColor: '#fef7cd',
    borderWidth: 1,
    borderColor: '#fbbf24',
    borderRadius: 6,
    padding: 12,
    color: '#92400e',
    fontSize: 14,
    marginBottom: 12,
  },
  massAdjustItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
  },
  massInput: {
    width: 80,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 4,
    padding: 8,
    fontSize: 14,
  },
  massList: {
    maxHeight: 250,
  },
  massTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  ajusteTag: {
    backgroundColor: '#e0f2fe',
    padding: 8,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tagRemove: {
    padding: 4,
  },
  fontRegular: {
    fontSize: 14,
    color: '#1f2937',
  },
  fontSemibold: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  fontBold: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
  },
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
});