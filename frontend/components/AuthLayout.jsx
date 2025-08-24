//frontend/components/AuthLayout.js
'use client';
import { AuthProvider, useAuth } from '../lib/auth';
import Sidebar from './Sidebar';
import { useState } from 'react';

function AuthenticatedLayout({ children }) {
  const { usuario } = useAuth();
  const isAuthenticated = !!usuario;
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  if (!isAuthenticated) {
    // Para páginas no autenticadas (login/registro), renderizar directamente sin contenedores
    return children;
  }

  // Para páginas autenticadas, mostrar el sidebar fijo
  return (
     <>
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
     <main
        className="w-full overflow-x-hidden p-3 md:p-4 transition-all duration-300"
        style={{
          marginLeft: isSidebarOpen ? '16rem' : '0',
          width: isSidebarOpen ? 'calc(100% - 16rem)' : '100%'
        }}
      >
        <div className="container-fluid bg-white bg-opacity-95 rounded-4 shadow-lg p-3 md:p-4 min-vh-100">
          {children}
        </div>
      </main>
    </>
  );
}

export default function AuthLayout({ children }) {
  return (
    <AuthProvider>
      <AuthenticatedLayout>{children}</AuthenticatedLayout>
    </AuthProvider>
  );
}
