
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../constants/api';

const API = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ====== Tipos y constantes (Residuo) ======
export type TipoResiduo = 'quimico' | 'biologico' | 'radiactivo' | 'comun';
export type UnidadResiduo = 'ml' | 'g' | 'u';

export interface Residuo {
  id: number;
  usuario_id: number;
  fecha: string;          // 'YYYY-MM-DD'
  laboratorio: string;
  reactivo: string;
  tipo: TipoResiduo;
  cantidad: number;       // decimal(10,2) -> number
  unidad: UnidadResiduo;
}

export interface CrearResiduoPayload {
  // usuario_id puede venir del backend vía token; inclúyelo si tu API lo exige en body
  usuario_id?: number;
  fecha?: string | Date;        // si no envías, se auto-completa con hoy (YYYY-MM-DD)
  laboratorio: string;
  reactivo: string;
  tipo: TipoResiduo;
  cantidad: number;             // usa número; el backend lo guarda con 2 decimales
  unidad: UnidadResiduo;
}

const TIPOS_RESIDUO: readonly TipoResiduo[] = ['quimico', 'biologico', 'radiactivo', 'comun'] as const;
const UNIDADES_RESIDUO: readonly UnidadResiduo[] = ['ml', 'g', 'u'] as const;

const toYMD = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function ensureYMD(fecha?: string | Date): string {
  if (!fecha) return toYMD(new Date());
  if (fecha instanceof Date) return toYMD(fecha);
  // si ya viene 'YYYY-MM-DD', respétalo
  return fecha.split('T')[0];
}

function normalizeResiduoRow(row: any): Residuo {
  return {
    id: Number(row.id),
    usuario_id: Number(row.usuario_id),
    fecha: String(row.fecha),
    laboratorio: String(row.laboratorio),
    reactivo: String(row.reactivo),
    tipo: row.tipo as TipoResiduo,
    cantidad: Number(row.cantidad),
    unidad: row.unidad as UnidadResiduo,
  };
}

function normalizeResiduosResponse(raw: any): Residuo[] {
  const arr = Array.isArray(raw) ? raw : Array.isArray(raw?.residuos) ? raw.residuos : [];
  return arr.map(normalizeResiduoRow);
}

// ====== Funciones de Residuos ======

export async function obtenerResiduos(): Promise<Residuo[]> {
  const token = await SecureStore.getItemAsync('token');
  if (!token) throw new Error('No hay token de autenticación');

  const { data } = await API.get('/residuos', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return normalizeResiduosResponse(data);
}

export async function registrarResiduo(payload: CrearResiduoPayload): Promise<Residuo> {
  const token = await SecureStore.getItemAsync('token');
  if (!token) throw new Error('No hay token de autenticación');

  // Validaciones acordes al esquema
  if (!payload.laboratorio?.trim()) throw new Error('El laboratorio es obligatorio');
  if (!payload.reactivo?.trim()) throw new Error('El reactivo es obligatorio');
  if (!TIPOS_RESIDUO.includes(payload.tipo)) throw new Error(`Tipo inválido. Usa: ${TIPOS_RESIDUO.join(', ')}`);
  if (!UNIDADES_RESIDUO.includes(payload.unidad)) throw new Error(`Unidad inválida. Usa: ${UNIDADES_RESIDUO.join(', ')}`);
  if (!(payload.cantidad > 0)) throw new Error('La cantidad debe ser mayor a 0');

  const body = {
    ...payload,
    fecha: ensureYMD(payload.fecha),
  };

  const { data } = await API.post('/residuos', body, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });

  // La mayoría de APIs devuelven el registro creado; normalizamos por si viene envuelto
  return Array.isArray(data) ? normalizeResiduoRow(data[0]) : (data?.residuo ? normalizeResiduoRow(data.residuo) : normalizeResiduoRow(data));
}

export async function eliminarResiduos(ids: number[]): Promise<{ eliminados: number; ids: number[] }> {
  const token = await SecureStore.getItemAsync('token');
  if (!token) throw new Error('No hay token de autenticación');
  if (!Array.isArray(ids) || ids.length === 0) throw new Error('Proporciona al menos un ID');

  const { data } = await API.delete('/residuos', {
    headers: { Authorization: `Bearer ${token}` },
    data: { ids },
  });

  const eliminados = Number(data?.deleted ?? data?.eliminados ?? ids.length);
  return { eliminados, ids };
}


export async function obtenerPrestamosEntregados(): Promise<any[]> {
  const token = await SecureStore.getItemAsync('token');
  if (!token) throw new Error('No hay token de autenticación');
  console.log('Token usado:', token);
  console.log('URL de la API:', `${API_URL}/api/materials/solicitudes/entregadas`);
  const { data } = await API.get('/materials/solicitudes/entregadas', {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('Préstamos entregados obtenidos:', data);
  return data;
}

export async function obtenerDetalleSolicitud(solicitudId: number) {
  const token = await SecureStore.getItemAsync('token');
  if (!token) throw new Error('No hay token de autenticación');
  const { data } = await API.get(`/materials/solicitudes/${solicitudId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

export async function registrarDevolucion(solicitudId: number, itemsDevueltos: any[]) {
  const token = await SecureStore.getItemAsync('token');
  if (!token) throw new Error('No hay token de autenticación');
  const { data } = await API.put(
    `/solicitudes/recibir-devolucion/${solicitudId}`,
    { items_devueltos: itemsDevueltos },
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  return data;
}

export async function informarPrestamoVencido(solicitudId: number) {
  const token = await SecureStore.getItemAsync('token');
  if (!token) throw new Error('No hay token de autenticación');
  const { data } = await API.post(
    `/solicitudes/${solicitudId}/informar-vencido`,
    {},
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  return data;
}

export async function obtenerGrupos(): Promise<any[]> {
  const { data } = await API.get('/grupos');
  return data;
}

