'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { useAuth } from '../../lib/auth';
import './estilos.css';

function toLocalDateStr(date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000)
    .toISOString()
    .split('T')[0];
}

export default function Catalog() {
  const { usuario } = useAuth();
  const router = useRouter();

  const [allMaterials, setAllMaterials] = useState([]);
  const [selectedCart, setSelectedCart] = useState([]);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
    const [showMassAdjustModal, setShowMassAdjustModal] = useState(false);  
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [materialToAdjust, setMaterialToAdjust] = useState(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [detailAmount, setDetailAmount] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRiesgoFisico, setSelectedRiesgoFisico] = useState('');
  const [selectedRiesgoSalud, setSelectedRiesgoSalud] = useState('');
  const [lowStockMaterials, setLowStockMaterials] = useState([]);
  const [docentes, setDocentes] = useState([]);
  const [selectedDocenteId, setSelectedDocenteId] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [minPickupDate, setMinPickupDate] = useState('');
  const [maxPickupDate, setMaxPickupDate] = useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
    const [massAdjustments, setMassAdjustments] = useState({});
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
    imagenFile: null,
  });
  const [addError, setAddError] = useState('');

  const [userPermissions, setUserPermissions] = useState({
    acceso_chat: false,
    modificar_stock: false,
    rol: null,
  });
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const [permissionsError, setPermissionsError] = useState('');
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const [showCart, setShowCart] = useState(true);
  
  const LOW_STOCK_THRESHOLD = 50;
  const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'tu-cloud-name';

    useEffect(() => {
    const checkScreen = () => {
      const small =
        window.innerWidth <= 920 && window.innerHeight <= 920;
      setIsSmallScreen(small);
    };
    checkScreen();
    window.addEventListener('resize', checkScreen);
    return () => window.removeEventListener('resize', checkScreen);
  }, []);

  useEffect(() => {
    if (isSmallScreen) {
      setShowCart(false);
    } else {
      setShowCart(true);
    }
  }, [isSmallScreen]);

    const getFormattedDate = (d) => d.toISOString().split('T')[0];

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

   const computeWeekEnd = (date) => {
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

  // Cargar permisos del usuario
  const loadUserPermissions = async () => {
    try {
      setPermissionsLoading(true);
      const token = localStorage.getItem('token');

      if (!token) {
        router.push('/login');
        return;
      }

      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/auth/permisos-stock`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setUserPermissions({
        acceso_chat: response.data.acceso_chat || false,
        modificar_stock: response.data.modificar_stock || false,
        rol: response.data.rol,
      });

      setPermissionsError('');
    } catch (error) {
      console.error('Error al cargar permisos:', error);
      setPermissionsError('Error al verificar permisos de usuario');

      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        router.push('/login');
      } else if (error.response?.status === 403) {
        setPermissionsError('Usuario bloqueado. Contacta al administrador.');
      }
    } finally {
      setPermissionsLoading(false);
    }
  };

  // Cargar lista de docentes
  const loadDocentes = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/materials/docentes`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setDocentes(response.data);
      if (userPermissions.rol === 'docente') {
        setSelectedDocenteId(usuario.id.toString());
      } else{
        setSelectedDocenteId('');
      }
    } catch (error) {
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

  const handlePermissionError = (action) => {
    const messages = {
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
    if (!window.confirm('¿Seguro que quieres eliminar este material?')) return;
    try {
      await makeSecureApiCall(
        `${process.env.NEXT_PUBLIC_API_URL}/api/materials/${materialToAdjust.id}/eliminar?tipo=${materialToAdjust.tipo}`,
        { method: 'DELETE' }
      );
      setShowAdjustModal(false);
      await fetchMaterials();
    } catch (err) {
      console.error('Error al eliminar material:', err);
      setError('No se pudo eliminar el material.');
    }
  };

  const makeSecureApiCall = async (url, options = {}) => {
    try {
      const token = localStorage.getItem('token');
      const config = {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${token}`,
        },
      };

      const response = await axios(url, config);
      return response;
    } catch (error) {
      if (error.response?.status === 403) {
        if (error.response.data?.error?.includes('permisos de stock')) {
          handlePermissionError('modify_stock');
        } else if (error.response.data?.error?.includes('solicitudes')) {
          handlePermissionError('make_request');
        } else {
          setError('No tienes permisos para realizar esta acción.');
        }
      } else if (error.response?.status === 401) {
        localStorage.removeItem('token');
        router.push('/login');
      } else {
        setError('Error al procesar la solicitud: ' + (error.response?.data?.error || error.message));
      }
      throw error;
    }
  };

  useEffect(() => {
    if (!usuario) {
      router.push('/login');
      return;
    }

    const initializeComponent = async () => {
      await loadUserPermissions();
    };

    initializeComponent();
  }, [usuario, router]);

  useEffect(() => {
    if (userPermissions.rol) {
      Promise.all([fetchMaterials(), loadDocentes()]);
    }
  }, [userPermissions.rol]);

  const fetchMaterials = async () => {
    try {
      setLoading(true);

      const [liquidoRes, solidoRes, laboratorioRes, equipoRes] = await Promise.all([
        makeSecureApiCall(`${process.env.NEXT_PUBLIC_API_URL}/api/materials/tipo/liquidos`),
        makeSecureApiCall(`${process.env.NEXT_PUBLIC_API_URL}/api/materials/tipo/solidos`),
        makeSecureApiCall(`${process.env.NEXT_PUBLIC_API_URL}/api/materials/tipo/laboratorio`),
        makeSecureApiCall(`${process.env.NEXT_PUBLIC_API_URL}/api/materials/tipo/equipos`),
      ]);

      const liquidos = liquidoRes.data.map((m) => ({
        ...m,
        tipo: 'liquido',
        cantidad: m.cantidad_disponible_ml ?? 0,
      }));

      const solidos = solidoRes.data.map((m) => ({
        ...m,
        tipo: 'solido',
        cantidad: m.cantidad_disponible_g ?? 0,
      }));

      const laboratorio = laboratorioRes.data.map((m) => ({
        ...m,
        tipo: 'laboratorio',
        cantidad: m.cantidad_disponible ?? 0,
      }));

      const equipos = equipoRes.data.map((m) => ({
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
    } catch (err) {
      console.error('Error al cargar materiales:', err);
      if (!err.response || err.response.status !== 403) {
        setError('Error al cargar el catálogo');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatName = (name) =>
    name
      ? name
          .replace(/_/g, ' ')
          .split(' ')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ')
      : '';

  const normalizeImageName = (name) =>
    name
      ? name
          .replace(/[,]/g, '')
          .replace(/\s+/g, '_')
          .replace(/[^a-zA-Z0-9_]/g, '')
          .toLowerCase()
      : '';

  const getUnidad = (tipo) => {
    if (tipo === 'liquido') return 'ml';
    if (tipo === 'solido') return 'g';
    if (tipo === 'laboratorio' || tipo === 'equipo') return 'unidades';
    return 'unidades';
  };

  const getImagePath = async (material) => {
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

  const parseRiesgos = (riesgosString) => {
    if (!riesgosString || riesgosString.trim() === '') return [];
    return riesgosString.split(';').filter((r) => r.trim());
  };

  const getRiesgoColor = (riesgo) => {
    const colorMap = {
      Inflamable: 'bg-red-100 text-red-800',
      Oxidante: 'bg-orange-100 text-orange-800',
      'Corrosivo para metales': 'bg-gray-100 text-gray-800',
      'Reacciona violentamente con agua': 'bg-purple-100 text-purple-800',
      'Tóxico agudo': 'bg-red-200 text-red-900',
      Cancerígeno: 'bg-black text-white',
      'Corrosivo para la piel': 'bg-yellow-100 text-yellow-800',
      Irritante: 'bg-blue-100 text-blue-800',
      Sensibilizante: 'bg-pink-100 text-pink-800',
      'Peligroso para el medio ambiente acuático': 'bg-green-100 text-green-800',
      Persistente: 'bg-teal-100 text-teal-800',
    };
    return colorMap[riesgo] || 'bg-gray-100 text-gray-600';
  };

  const getRiesgoIcon = (riesgo) => {
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
    return iconMap[riesgo] || '⚪';
  };

  const getMaxRiesgoLevel = (material) => {
    const allRiesgos = [
      ...parseRiesgos(material.riesgos_fisicos),
      ...parseRiesgos(material.riesgos_salud),
      ...parseRiesgos(material.riesgos_ambientales),
    ];

    if (allRiesgos.includes('Cancerígeno') || allRiesgos.includes('Tóxico agudo')) return 4;
    if (allRiesgos.includes('Corrosivo para la piel') || allRiesgos.includes('Inflamable')) return 3;
    if (allRiesgos.includes('Irritante') || allRiesgos.includes('Oxidante')) return 2;
    if (allRiesgos.length > 0) return 1;
    return 0;
  };

  const displayStock = (material) => {
    if (canModifyStock()) {
      return `${material.cantidad} ${getUnidad(material.tipo)}`;
    } else {
      return material.cantidad > 0 ? 'Disponible' : 'Agotado';
    }
  };

  const getStockColor = (material) => {
    if (!canModifyStock()) {
      return material.cantidad > 0 ? 'text-green-600' : 'text-red-600';
    }

    if (material.cantidad === 0) return 'text-red-600';
    if (material.cantidad <= LOW_STOCK_THRESHOLD) return 'text-orange-600';
    return 'text-green-600';
  };

  const addToCart = (material, cantidad) => {
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

  const removeFromCart = (id, tipo) => {
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

    const cartContent = (
    <div className="cart-container">
      <div className="cart-header">
        <h4>Carrito de Solicitud</h4>
        <small>
          {totalItems} {totalItems === 1 ? 'material' : 'materiales'} seleccionados
        </small>
      </div>
      <div className="cart-body">
        {selectedCart.length === 0 ? (
          <div className="empty-cart">
            <div className="empty-cart-icon">🛒</div>
            <p>Carrito vacío</p>
            <small>Selecciona materiales para crear un vale</small>
          </div>
        ) : (
          <>
            {selectedCart.map((item) => (
              <div key={`${item.tipo}-${item.id}`} className="cart-item">
                <div>
                  <div className="cart-item-name">{formatName(item.nombre)}</div>
                  <div className="cart-item-quantity">
                    {item.cantidad} {getUnidad(item.tipo)} ({item.tipo})
                  </div>
                </div>
                <button
                  className="btn-remove"
                  onClick={() => removeFromCart(item.id, item.tipo)}
                  disabled={!canMakeRequests()}
                >
                  ×
                </button>
              </div>
            ))}
          </>
        )}
      </div>
      {selectedCart.length > 0 && (
        <div className="p-4">
          <button
            className="btn-create-vale"
            onClick={() => setShowRequestModal(true)}
            disabled={selectedCart.length === 0 || totalItems === 0 || !canMakeRequests()}
          >
            Crear Vale
          </button>
          <button
            className="btn-clear mt-3"
            onClick={vaciarSeleccion}
            disabled={selectedCart.length === 0 || !canMakeRequests()}
          >
            Vaciar Selección
          </button>
        </div>
      )}
    </div>
  );

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
      const selectedDocente = docentes.find((doc) => doc.id === docenteIdToUse);
      if (!selectedDocente) {
        setError('Docente seleccionado no válido.');
         setIsSubmittingRequest(false);
        return;
      }

      await makeSecureApiCall(`${process.env.NEXT_PUBLIC_API_URL}/api/materials/solicitudes`, {
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
      router.push('/solicitudes');
    } catch (err) {
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

  const handleAdjustClick = (material) => {
    if (!canModifyStock()) {
      handlePermissionError('adjust_stock');
      return;
    }
    setMaterialToAdjust(material);
    setAdjustAmount('');
    setShowAdjustModal(true);
    setError('');
  };

  const handleDetailClick = (material, e) => {
    e.stopPropagation();
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
        `${process.env.NEXT_PUBLIC_API_URL}/api/materials/material/${materialToAdjust.id}/ajustar`,
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
    } catch (err) {
      console.error('Error al ajustar inventario:', err);
      setError('No se pudo ajustar el stock');
    }
  };

   const handleMassAdjustChange = (material, value) => {
    const delta = parseInt(value, 10);
    const key = `${material.id}-${material.tipo}`;
    if (isNaN(delta) || delta === 0) {
      setMassAdjustments((prev) => {
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
    setMassAdjustments((prev) => ({
      ...prev,
      [key]: { id: material.id, tipo: material.tipo, nombre: material.nombre, cantidad: delta },
    }));
  };

  const removeMassAdjustment = (key) => {
    setMassAdjustments((prev) => {
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
        `${process.env.NEXT_PUBLIC_API_URL}/api/materials/ajuste-masivo`,
        {
          method: 'POST',
          data: { ajustes: ajustes.map(({ id, tipo, cantidad }) => ({ id, tipo, cantidad })) },
        }
      );
      setMassAdjustments({});
      setMassSearchTerm('');
      setMassError('');
      setShowMassAdjustModal(false);
      await fetchMaterials();
    } catch (err) {
      console.error('Error en ajuste masivo:', err);
      setMassError(err.response?.data?.error || 'No se pudo ajustar el stock');
    }
  };
  
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setAddError('');
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
      formData.append('imagen', imagenFile);

      await makeSecureApiCall(`${process.env.NEXT_PUBLIC_API_URL}/api/materials/crear`, {
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
    } catch (err) {
      console.error('Error al crear material:', err);
      setAddError(err.response?.data?.error || err.message);
    }
  };

  const dismissLowStockAlert = (materialId, tipo) => {
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
      <div className="loading-container">
        <div className="loading-content">
          <div className="spinner"></div>
          <div className="loading-text">
            {permissionsLoading ? 'Verificando permisos...' : 'Cargando catálogo...'}
          </div>
        </div>
      </div>
    );
  }

  if (permissionsError) {
    return (
      <div className="error-container">
        <div className="error-content">
          <div className="error-icon">⚠️</div>
          <h2 className="error-title">Error de Permisos</h2>
          <p className="error-message">{permissionsError}</p>
          <button
            className="retry-button"
            onClick={() => {
              setPermissionsError('');
              loadUserPermissions();
            }}
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="catalog-container">
    <div className="d-flex gap-4 align-items-start">
        <div className="flex-grow-1">
          <div className="main-card">
            <div className="header-section">
              {userPermissions.rol === 'almacen' && userPermissions.modificar_stock && (
             <div className="header-buttons">
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="btn-add-material"
                  >
                    Agregar Material/Reactivo
                  </button>
                  <button
                    onClick={() => setShowMassAdjustModal(true)}
                    className="btn-mass-adjust"
                  >
                    Ajuste Masivo
                  </button>
                </div>
              )}
              <h1>Catálogo de Materiales</h1>
            </div>

         {userPermissions.rol === 'almacen' && canModifyStock() && lowStockMaterials.length > 0 && (
              <div className="low-stock-alerts">
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      background: '#f59e0b',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: '0.75rem',
                    }}
                  >
                    <span style={{ color: 'white', fontSize: '16px', fontWeight: 'bold' }}>
                      !
                    </span>
                  </div>
                  <div>
                    <h4 style={{ margin: 0, color: '#92400e', fontSize: '1.125rem', fontWeight: '600' }}>
                      Advertencia de Stock Bajo
                    </h4>
                    <p style={{ margin: 0, color: '#b45309', fontSize: '0.9rem' }}>
                      Materiales con stock por debajo de {LOW_STOCK_THRESHOLD} unidades:
                    </p>
                  </div>
                </div>

                {lowStockMaterials.map((material) => (
                  <div key={`${material.tipo}-${material.id}`} className="low-stock-item">
                    <div className="low-stock-content">
                      <div className="low-stock-material">
                        {formatName(material.nombre)} ({material.tipo})
                      </div>
                      <div className="low-stock-quantity">
                        Stock: {material.cantidad} {getUnidad(material.tipo)}
                      </div>
                    </div>
                    <button
                      className="dismiss-btn"
                      onClick={() => dismissLowStockAlert(material.id, material.tipo)}
                      title="Descartar alerta"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="search-filter-container">
              <input
                type="text"
                className="form-control search-input"
                placeholder="Buscar materiales..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />

              {userPermissions.rol !== 'alumno' && (
                <>
                  <select
                    className="filter-select"
                    value={selectedRiesgoFisico}
                    onChange={(e) => setSelectedRiesgoFisico(e.target.value)}
                  >
                    <option value="">Todos los riesgos físicos</option>
                    <option value="Inflamable">🔥 Inflamable</option>
                    <option value="Oxidante">⚗️ Oxidante</option>
                    <option value="Corrosivo para metales">🛠️ Corrosivo para metales</option>
                    <option value="Reacciona violentamente con agua">💥 Reactivo con agua</option>
                  </select>

                  <select
                    className="filter-select"
                    value={selectedRiesgoSalud}
                    onChange={(e) => setSelectedRiesgoSalud(e.target.value)}
                  >
                    <option value="">Todos los riesgos de salud</option>
                    <option value="Tóxico agudo">☠️ Tóxico agudo</option>
                    <option value="Cancerígeno">⚠️ Cancerígeno</option>
                    <option value="Corrosivo para la piel">🧪 Corrosivo</option>
                    <option value="Irritante">⚡ Irritante</option>
                    <option value="Sensibilizante">🤧 Sensibilizante</option>
                  </select>
                </>
              )}
            </div>

            <div className="p-0">
              {error && (
                <div className="alert-custom mx-4 mt-3">
                  {error}
                </div>
              )}

              {loading ? (
                <div className="loading-spinner">
                  <div className="spinner"></div>
                </div>
              ) : (
                <div className="material-grid">
                  {filteredMaterials.length === 0 ? (
                    <p style={{ padding: '1.5rem', fontSize: '1.125rem', color: '#6b7280' }}>
                      No se encontraron materiales.
                    </p>
                  ) : (
                    filteredMaterials.map((material) => (
                      <div
                        key={`${material.tipo}-${material.id}`}
                        className={`material-card ${
                          userPermissions.rol === 'almacen' && userPermissions.modificar_stock
                            ? 'clickable'
                            : canViewDetails()
                            ? 'clickable'
                            : 'non-clickable'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (userPermissions.rol === 'almacen' && userPermissions.modificar_stock) {
                            handleAdjustClick(material);
                          } else {
                            handleDetailClick(material, e);
                          }
                        }}
                      >
                        <img
                          src={material.imagen_url || ''}
                          alt={material.nombre}
                          className="material-image"
                          onError={(e) => (e.target.style.display = 'none')}
                        />
                        <div className="material-card-content">
                          <div className="material-card-name">{formatName(material.nombre)}</div>
                          <span className={`material-card-type type-${material.tipo}`}>
                            {material.tipo}
                          </span>
                          <div className={`material-card-stock ${getStockColor(material)}`}>
                            {displayStock(material)}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

     {(userPermissions.rol === 'alumno' || userPermissions.rol === 'docente') && (
 <>
    {isSmallScreen ? (
      <>
        <button
          className="cart-toggle"
          onClick={() => setShowCart((prev) => !prev)}
        >
          Carrito de solicitudes
        </button>
        {showCart && <div className="cart-overlay">{cartContent}</div>}
      </>
    ) : (
      <div className="cart-sticky">{cartContent}</div>
    )}
  </>
)}

      </div>

      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content-custom" style={{ maxWidth: '1000px', width: '95%' }}>
            <div className="modal-header-custom">
              <h5 className="modal-title">Agregar Material / Reactivo</h5>
              <button
                className="btn-close btn-close-white"
                onClick={() => setShowAddModal(false)}
              />
            </div>
            <form className="modal-body p-4" onSubmit={handleAddSubmit}>
              {addError && <div className="alert-custom mb-3">{addError}</div>}

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">¿Es Reactivo o Material? *</label>
                  <select
                    className="form-control"
                    value={newMaterial.tipoGeneral}
                    onChange={(e) => setNewMaterial({ ...newMaterial, tipoGeneral: e.target.value, subTipo: '' })}
                    required
                  >
                    <option value="Reactivo">Reactivo</option>
                    <option value="Material">Material</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Categoría específica *</label>
                  <select
                    className="form-control"
                    value={newMaterial.subTipo}
                    onChange={(e) => setNewMaterial({ ...newMaterial, subTipo: e.target.value })}
                    required
                  >
                    <option value="">-- Selecciona --</option>
                    {newMaterial.tipoGeneral === 'Reactivo' ? (
                      <>
                        <option value="liquido">Líquido</option>
                        <option value="solido">Sólido</option>
                      </>
                    ) : (
                      <>
                        <option value="equipo">Equipo</option>
                        <option value="laboratorio">Laboratorio</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Nombre *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={newMaterial.nombre}
                    onChange={(e) => setNewMaterial({ ...newMaterial, nombre: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Cantidad inicial {newMaterial.subTipo === 'liquido' ? '(ml)' : newMaterial.subTipo === 'solido' ? '(g)' : '(unidades)'} *
                  </label>
                  <input
                    type="number"
                    className="form-control"
                    min="0"
                    value={newMaterial.cantidad_inicial}
                    onChange={(e) => setNewMaterial({ ...newMaterial, cantidad_inicial: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Estado *</label>
                  <select
                    className="form-control"
                    value={newMaterial.estado}
                    onChange={(e) => setNewMaterial({ ...newMaterial, estado: e.target.value })}
                    required
                  >
                    <option value="disponible">Disponible</option>
                    {newMaterial.tipoGeneral === 'Reactivo' && (
                      <option value="no disponible">No disponible</option>
                    )}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Imagen (.jpg) *</label>
                  <input
                    type="file"
                    accept=".jpg"
                    className="form-control"
                    onChange={(e) => setNewMaterial({ ...newMaterial, imagenFile: e.target.files[0] })}
                    required
                  />
                </div>

                <div className="form-group full-width">
                  <label className="form-label">Descripción</label>
                  <textarea
                    className="form-control"
                    value={newMaterial.descripcion}
                    onChange={(e) => setNewMaterial({ ...newMaterial, descripcion: e.target.value })}
                    rows="2"
                  />
                </div>

                {newMaterial.tipoGeneral === 'Reactivo' && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Riesgos Físicos</label>
                      <textarea
                        className="form-control"
                        placeholder="Separar con ; (ej. Inflamable;Oxidante)"
                        value={newMaterial.riesgos_fisicos}
                        onChange={(e) => setNewMaterial({ ...newMaterial, riesgos_fisicos: e.target.value })}
                        rows="2"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Riesgos Salud</label>
                      <textarea
                        className="form-control"
                        placeholder="Separar con ; (ej. Tóxico agudo;Irritante)"
                        value={newMaterial.riesgos_salud}
                        onChange={(e) => setNewMaterial({ ...newMaterial, riesgos_salud: e.target.value })}
                        rows="2"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Riesgos Ambientales</label>
                      <textarea
                        className="form-control"
                        placeholder="Separar con ; (ej. Persistente)"
                        value={newMaterial.riesgos_ambientales}
                        onChange={(e) => setNewMaterial({ ...newMaterial, riesgos_ambientales: e.target.value })}
                        rows="2"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="modal-footer-custom">
                <button type="button" className="btn-secondary-custom" onClick={() => setShowAddModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-create-vale">
                  Crear
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

       {showMassAdjustModal && (
        <div className="modal-overlay">
          <div className="modal-content-custom" style={{ maxWidth: '800px', width: '90%' }}>
            <div className="modal-header-custom">
              <h5 className="modal-title">Ajuste Masivo de Inventario</h5>
              <button
                className="btn-close btn-close-white"
                onClick={() => setShowMassAdjustModal(false)}
              />
            </div>
            <div className="modal-body p-4">
              {massError && <div className="alert-custom mb-3">{massError}</div>}
              <input
                type="text"
                className="form-control mb-3"
                placeholder="Buscar..."
                value={massSearchTerm}
                onChange={(e) => setMassSearchTerm(e.target.value)}
              />
              <div className="mass-adjust-grid">
                {allMaterials
                  .filter((m) =>
                    formatName(m.nombre)
                      .toLowerCase()
                      .includes(massSearchTerm.toLowerCase())
                  )
                  .map((m) => {
                    const key = `${m.id}-${m.tipo}`;
                    return (
                      <div key={key} className="mass-adjust-item">
                        <span>{formatName(m.nombre)}</span>
                        <input
                          type="number"
                          className="mass-input"
                          placeholder={getUnidad(m.tipo)}
                          value={massAdjustments[key]?.cantidad ?? ''}
                          onChange={(e) => handleMassAdjustChange(m, e.target.value)}
                        />
                      </div>
                    );
                  })}
              </div>
              {Object.values(massAdjustments).length > 0 && (
                <div className="mass-tags mt-3">
                  {Object.values(massAdjustments).map((a) => {
                    const key = `${a.id}-${a.tipo}`;
                    return (
                      <span key={key} className="ajuste-tag">
                        {`${formatName(a.nombre)} ${a.cantidad} ${getUnidad(a.tipo)}`}
                        <button
                          type="button"
                          className="tag-remove"
                          aria-label="Eliminar"
                          onClick={() => removeMassAdjustment(key)}
                        >
                          &times;
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="modal-footer-custom">
              <button
                className="btn-secondary-custom"
                onClick={() => setShowMassAdjustModal(false)}
              >
                Cancelar
              </button>
              <button
                className="btn-adjust btn-w-md"
                onClick={handleMassAdjustSubmit}
                disabled={Object.values(massAdjustments).length === 0}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
      
      {showRequestModal && (
        <div className="modal-overlay">
          <div className="modal-content-custom">
            <div className="modal-header-custom">
              <h5 className="modal-title">Confirmar Solicitud</h5>
              <button
                className="btn-close btn-close-white"
                onClick={() => setShowRequestModal(false)}
              ></button>
            </div>
            <div className="modal-body p-4">
              {error && <div className="alert-custom mb-3">{error}</div>}
              <div className="info-alert mb-4">
                Estás a punto de crear un vale con los siguientes materiales:
              </div>
              <div className="request-summary">
                {selectedCart.map((item, index) => (
                  <div key={`${item.tipo}-${item.id}-${index}`} className="request-item">
                    <div>
                      <span className="fw-semibold">{formatName(item.nombre)}</span>
                      <small className="d-block">{item.tipo}</small>
                    </div>
                    <span className="fw-bold">{item.cantidad} {getUnidad(item.tipo)}</span>
                  </div>
                ))}
              </div>
              {userPermissions.rol !== 'docente' && (
                <div className="mb-3 mt-4">
                  <label className="form-label">Selecciona el docente encargado *</label>
                  <select
                    className="form-control"
                    value={selectedDocenteId}
                    onChange={(e) => setSelectedDocenteId(e.target.value)}
                    required
                  >
                    <option value="" disabled>-- Selecciona un docente --</option>
                    {docentes.map((docente) => (
                      <option key={docente.id} value={docente.id}>
                        {formatName(docente.nombre)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {userPermissions.rol === 'docente' && (
                <div className="info-alert mt-4">
                  Como docente, tú serás el encargado de esta solicitud.
                </div>
              )}
              {userPermissions.rol !== 'docente' && (
                <div className="security-alert mt-4">
                  Esta solicitud será revisada por el docente seleccionado antes de ser aprobada.
                </div>
              )}
              <div className="mt-4">
                <label className="form-label">Fecha de recolección *</label>
                <input
                  type="date"
                  className="form-control"
                  min={minPickupDate}
                  max={maxPickupDate}
                  value={pickupDate}
                  onChange={(e) => {
                   let v = e.target.value;
                    if (v && v > maxPickupDate) v = maxPickupDate;
                    setPickupDate(v);
                    if (returnDate && v > returnDate) {
                      setReturnDate('');
                    }
                  }}
                />
                <small className="text-muted">
                  Debes solicitar con al menos 24 horas de anticipación. Solicitudes después de las 9 PM se procesarán un día hábil adicional.
                </small>
              </div>
              <div className="mt-3">
                <label className="form-label">Fecha de entrega *</label>
                <input
                  type="date"
                  className="form-control"
                  min={pickupDate || minPickupDate}
                  max={maxPickupDate}
                  value={returnDate}
                 onChange={(e) => {
                    const v = e.target.value;
                    if (!v || v <= maxPickupDate) setReturnDate(v);
                  }}
                />
              </div>
            </div>
            <div className="modal-footer-custom">
              <button
                className="btn-secondary-custom"
                onClick={() => setShowRequestModal(false)}
              >
                Cancelar
              </button>
              <button
                className="btn-create-vale"
                onClick={handleSubmitRequest}
                disabled={
                  !canMakeRequests() ||
                  (userPermissions.rol !== 'docente' && !selectedDocenteId) ||
                  isSubmittingRequest
                }
              >
                {isSubmittingRequest ? 'Enviando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAdjustModal && materialToAdjust && (
  <div className="modal-overlay">
    <div className="modal-content-custom">
      <div className="modal-header-custom">
        <h5 className="modal-title">Ajustar Inventario: {formatName(materialToAdjust.nombre)}</h5>
        <button
          className="btn-close btn-close-white"
          onClick={() => setShowAdjustModal(false)}
        ></button>
      </div>
      <div className="modal-body p-4">
        {error && <div className="alert-custom mb-3">{error}</div>}
        {!canModifyStock() && (
          <div className="alert-custom mb-3">
            ⚠️ No tienes permisos para modificar el stock. Esta funcionalidad está restringida.
          </div>
        )}
        <div className="mb-3">
          <label className="form-label">
            Stock actual: {materialToAdjust.cantidad} {getUnidad(materialToAdjust.tipo)}
          </label>
          <input
            type="number"
            className="form-control mt-2"
            value={adjustAmount}
            onChange={(e) => setAdjustAmount(e.target.value)}
            placeholder="Añade o quita stock"
            disabled={!canModifyStock()}
          />
        </div>
      </div>
 {(() => {
        const delta = parseInt(adjustAmount, 10);
        const newStock =
          materialToAdjust && !isNaN(delta) ? materialToAdjust.cantidad + delta : null;
        const disableGuardar =
          adjustAmount === '' || isNaN(delta) || newStock < 0 || !canModifyStock();

        return (
          <div className="modal-footer-custom">
            <div className="footer-actions">
              {/* Izquierda: Cancelar */}
              <div className="footer-col-left">
                <button
                  type="button"
                  className="btn-secondary-custom btn-w-sm"
                  onClick={() => setShowAdjustModal(false)}
                >
                  Cancelar
                </button>
              </div>

              {/* Centro: Guardar */}
              <div className="footer-col-center">
                <button
                  className="btn-adjust btn-w-md"
                  onClick={handleAdjustSubmit}
                  disabled={disableGuardar}
                >
                  Guardar
                </button>
              </div>

              {/* Derecha: Eliminar */}
              <div className="footer-col-right">
                <button
                  type="button"
                  className="btn-danger btn-w-sm"
                  onClick={handleDeleteMaterial}
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  </div>
)}


      {showDetailModal && selectedMaterial && (
        <div className="modal-overlay">
          <div className="modal-content-custom">
            <div className="modal-header-custom">
              <h5 className="modal-title">Detalles: {formatName(selectedMaterial.nombre)}</h5>
              <button
                className="btn-close btn-close-white"
                onClick={() => setShowDetailModal(false)}
              ></button>
            </div>
            <div className="modal-body p-4 align-items-start">
              {error && <div className="alert-custom mb-3">{error}</div>}

              {!canViewDetails() && (
                <div className="security-alert mb-3">
                  ⚠️ Vista limitada: Como {userPermissions.rol}, solo puedes consultar la información básica del material.
                </div>
              )}

              <img
                src={selectedMaterial.imagen_url || ''}
                alt={formatName(selectedMaterial.nombre)}
                className="detail-image"
                loading="lazy"
                onError={(e) => (e.target.style.display = 'none')}
              />
              <h5 className="mt-4">Información</h5>
              <p className="text-muted">
                Tipo: {selectedMaterial.tipo}
                <br />
                Stock: {displayStock(selectedMaterial)}
              </p>

              {userPermissions.rol === 'administrador' && (
                <div className="info-alert mt-3">
                  Como administrador, puedes ver toda la información pero no puedes realizar solicitudes ni modificar directamente el stock desde este módulo.
                </div>
              )}

              {userPermissions.rol === 'almacen' && !userPermissions.modificar_stock && (
                <div className="security-alert mt-3">
                  Tienes permisos limitados de almacén. Para modificar stock o realizar solicitudes, contacta al administrador.
                </div>
              )}

              {selectedMaterial.riesgos_fisicos ||
              selectedMaterial.riesgos_salud ||
              selectedMaterial.riesgos_ambientales ? (
                <div>
                  <h5 className="mt-4">Riesgos</h5>
                  <div className="riesgos-container">
                    {parseRiesgos(selectedMaterial.riesgos_fisicos).map((riesgo) => (
                      <span key={riesgo} className={`riesgo-badge ${getRiesgoColor(riesgo)}`}>
                        {getRiesgoIcon(riesgo)} {riesgo}
                      </span>
                    ))}
                    {parseRiesgos(selectedMaterial.riesgos_salud).map((riesgo) => (
                      <span key={riesgo} className={`riesgo-badge ${getRiesgoColor(riesgo)}`}>
                        {getRiesgoIcon(riesgo)} {riesgo}
                      </span>
                    ))}
                    {parseRiesgos(selectedMaterial.riesgos_ambientales).map((riesgo) => (
                      <span key={riesgo} className={`riesgo-badge ${getRiesgoColor(riesgo)}`}>
                        {getRiesgoIcon(riesgo)} {riesgo}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="no-risks mt-4">No se han registrado riesgos para este material.</p>
              )}

              {canMakeRequests() && canViewDetails() && (
                <div className="mt-4">
                  <label className="form-label">Cantidad a solicitar</label>
                  <input
                    type="number"
                    className="form-control mt-2"
                    value={detailAmount}
                    onChange={(e) => setDetailAmount(e.target.value)}
                    placeholder="Ingresa cantidad"
                    min="1"
                    max={selectedMaterial.cantidad}
                    disabled={selectedMaterial.cantidad === 0}
                  />
                  <button
                    className="btn-add-to-cart mt-3"
                    onClick={() => addToCart(selectedMaterial, detailAmount)}
                    disabled={
                      !detailAmount ||
                      parseInt(detailAmount) <= 0 ||
                      parseInt(detailAmount) > selectedMaterial.cantidad ||
                      selectedMaterial.cantidad === 0 ||
                      !canMakeRequests()
                    }
                  >
                    {selectedMaterial.cantidad === 0 ? 'Material Agotado' : 'Añadir al carrito'}
                  </button>

                  {userPermissions.rol === 'alumno' && (
                    <div className="info-alert mt-3">
                      💡 Como alumno, tu solicitud necesitará aprobación docente antes de procesarse.
                    </div>
                  )}

                  {userPermissions.rol === 'docente' && (
                    <div className="info-alert mt-3">
                      ⚡ Como docente, tu solicitud será aprobada automáticamente.
                    </div>
                  )}

                  {userPermissions.rol === 'almacen' && userPermissions.modificar_stock && (
                    <div className="info-alert mt-3">
                      🔧 Como personal de almacén con permisos, puedes tanto solicitar materiales como ajustar el inventario.
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer-custom">
              <button
                className="btn-secondary-custom"
                onClick={() => setShowDetailModal(false)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
