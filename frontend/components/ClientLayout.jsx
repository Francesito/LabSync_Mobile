//frontend/components/ClientLayout.jsx
'use client';
import { useAuth } from '../lib/auth';
import Sidebar from './Sidebar';
import { useState, useEffect } from 'react';

export default function ClientLayout({ children }) {
  const { usuario } = useAuth();
  const isAuthenticated = !!usuario;
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

   useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  if (!isAuthenticated) {
    // Para páginas no autenticadas (login/registro), renderizar directamente sin contenedores
    return children;
  }

   // Para páginas autenticadas, usar el layout con sidebar fijo
    return (
      <>
        <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
        <main
         className={`overflow-x-hidden p-3 md:p-4 animate-fade-in transition-all duration-300 ${
            isSidebarOpen ? 'md:ml-64 md:w-[calc(100vw-16rem)]' : 'w-screen'
          }`}
        >
          <div className="container-fluid bg-white bg-opacity-95 rounded-4 shadow-lg p-3 md:p-4 min-vh-100">
            {children}
          </div>
        </main>
      </>
    );
  }
