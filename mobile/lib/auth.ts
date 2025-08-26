import { useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

interface Usuario {
  id?: number;
  nombre?: string;
  [key: string]: any;
}

/**
 * Simple hook to obtain the authenticated user stored in SecureStore.
 * This avoids runtime errors in screens that expect `useAuth` to exist.
 */
export function useAuth() {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
 const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUsuario = async () => {
      try {
        const stored = await SecureStore.getItemAsync('usuario');
        if (stored) {
           const parsed = JSON.parse(stored);
          if (!parsed.rol && parsed.rol_id) {
            const map: Record<number, string> = {
              1: 'alumno',
              2: 'docente',
              3: 'almacen',
              4: 'administrador',
            };
            parsed.rol = map[parsed.rol_id] ?? parsed.rol;
          }
          setUsuario(parsed);
        } else {
          setUsuario(null);
        }
      } catch (err) {
        // ignore read errors
        setUsuario(null);
      } finally {
        setLoading(false);
      }
    };
    loadUsuario();
  }, []);

   return { usuario, loading };
}