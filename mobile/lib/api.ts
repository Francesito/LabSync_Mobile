
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
