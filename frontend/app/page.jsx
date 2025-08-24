'use client';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth';
import { useEffect } from 'react';

export default function Home() {
  const { usuario } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (usuario) {
      router.push('/catalog');
    } else {
      router.push('/login');
    }
  }, [usuario, router]);

  return null;
}