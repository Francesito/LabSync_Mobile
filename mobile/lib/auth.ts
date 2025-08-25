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
          setUsuario(JSON.parse(stored));
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