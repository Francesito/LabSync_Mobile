'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';

export default function VerificarCuenta() {
  const { token } = useParams();
  const router = useRouter();
  const [message, setMessage] = useState('Verificando tu cuenta...');

  useEffect(() => {
    const verificarCuenta = async () => {
      try {
        const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/verify/${token}`);
        setMessage(response.data.mensaje || 'Cuenta verificada exitosamente. Redirigiendo al login...');
        setTimeout(() => router.push('/login'), 3000);
      } catch (error) {
        console.error('Error en el frontend:', error.response?.data || error.message);
        setMessage(error.response?.data?.error || 'Error al verificar la cuenta. Intenta de nuevo o contacta al soporte.');
      }
    };
    if (token) {
      verificarCuenta();
    }
  }, [token, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded shadow-md text-center">
        <h2 className="text-2xl font-bold mb-4">{message}</h2>
      </div>
    </div>
  );
}
