//frontend/components/Sidebar.jsx
'use client';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../lib/auth';
import { useEffect, useState } from 'react';
import axios from 'axios';
export default function Sidebar({ isOpen, setIsOpen }) {
  const router = useRouter();
   const pathname = usePathname();
  const { usuario, setUsuario } = useAuth();
 const [notifCount, setNotifCount] = useState(0);
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';

  useEffect(() => {
    if (!usuario) return;
    const cargar = async () => {
      try {
        const { data } = await axios.get(`${baseUrl}/api/notificaciones`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
      setNotifCount(data.filter(n => !n.leida).length);
      } catch (err) {
        console.error('Error al cargar notificaciones:', err);
      }
    };
    cargar();
  }, [usuario, pathname]);

  useEffect(() => {
    if (pathname === '/notificaciones') {
      setNotifCount(0);
    }
  }, [pathname]);

const handleNavClick = () => {
    // Mantener el sidebar abierto al navegar
  if (setIsOpen) setIsOpen(true);
};

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUsuario(null);
    router.push('/login');
  };

  if (!usuario) return null;

// Visibilidad por rol:
// Docente (2): catálogo, solicitudes, adeudos
// Alumno  (1): catálogo, solicitudes, adeudos, residuos, chat
// Almacén (3): catálogo, solicitudes, préstamos, residuos, chat
// Admin   (4): catálogo, configuración, residuos
  const navItems = [
    { 
      href: '/catalog', 
      label: 'Catálogo', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
      visible: [1, 2, 3, 4].includes(usuario.rol_id),
      color: 'blue',
    },
    { 
      href: '/solicitudes', 
      label: 'Solicitudes', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      visible: [1, 2, 3].includes(usuario.rol_id), // alumno, docente, almacén
      color: 'emerald',
    },
    {
      href: '/adeudos',
      label: 'Adeudos',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      visible: [1, 2].includes(usuario.rol_id), // alumno, docente
      color: 'amber',
    },
    {
      href: '/residuos',
      label: 'Residuos',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M3 6h18M8 6v12a2 2 0 002 2h4a2 2 0 002-2V6M10 10h4M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
        </svg>
      ),
    visible: usuario.rol_id === 1, // solo alumno
      color: 'emerald',
    },
    {
      href: '/prestamos',
      label: 'Préstamos',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      ),
      visible: usuario.rol_id === 3, // solo almacén
      color: 'purple',
    },
    {
      href: '/chat',
      label: 'Chat',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
      visible: [1, 3].includes(usuario.rol_id), // alumno y almacén (docente y admin no)
      color: 'indigo',
    },
    {
      href: '/reportes',
      label: 'Reportes',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v2H7a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v3" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h5l-1.5 2M17 16l-1.5-2" />
        </svg>
      ),
      visible: [3,4].includes(usuario.rol_id), // almacén y admin
      color: 'indigo',
    },
    {
      href: '/configuracion',
      label: 'Configuración',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94 1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      visible: usuario.rol_id === 4, // solo admin
      color: 'rose',
    },
        {
      href: '/historial',
      label: 'Historial',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
     visible: [3, 4].includes(usuario.rol_id),
      color: 'blue',
    },
     {
      href: '/notificaciones',
      label: 'Notificaciones',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
      ),
      visible: [1, 2, 3].includes(usuario.rol_id),
      color: 'blue',
    },
  ];

  const getInitials = (nombre) => {
    if (!nombre) return 'U';
    return nombre.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
  };

  const getRoleName = (rolId) => {
    const roles = {
      1: 'Alumno',
      2: 'Docente',
      3: 'Almacén',
      4: 'Administrador'
    };
    return roles[rolId] || 'Usuario';
  };

  const getRoleColor = (rolId) => {
    const colors = {
      1: 'from-blue-500 to-blue-600',
      2: 'from-emerald-500 to-emerald-600',
      3: 'from-purple-500 to-purple-600',
      4: 'from-rose-500 to-rose-600'
    };
    return colors[rolId] || 'from-gray-500 to-gray-600';
  };

  const getItemColorClasses = (color) => {
    const colorMap = {
      blue: 'hover:bg-white hover:text-blue-700 hover:shadow-md group-hover:text-blue-500',
      emerald: 'hover:bg-white hover:text-emerald-700 hover:shadow-md group-hover:text-emerald-500',
      amber: 'hover:bg-white hover:text-amber-700 hover:shadow-md group-hover:text-amber-500',
      purple: 'hover:bg-white hover:text-purple-700 hover:shadow-md group-hover:text-purple-500',
      indigo: 'hover:bg-white hover:text-indigo-700 hover:shadow-md group-hover:text-indigo-500',
      rose: 'hover:bg-white hover:text-rose-700 hover:shadow-md group-hover:text-rose-500',
    };
    return colorMap[color] || 'hover:bg-white hover:text-gray-700 hover:shadow-md group-hover:text-gray-500';
  };

  return (
 <>
      <button
        onClick={() => setIsOpen(!isOpen)}
       className="fixed top-4 z-50 bg-[#003579] text-white rounded-full p-1 transition-all duration-300"
        style={{ left: isOpen ? '16rem' : '0.5rem' }}
      >
        {isOpen ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M12.293 4.293a1 1 0 011.414 1.414L9.414 10l4.293 4.293a1 1 0 01-1.414 1.414l-5-5a1 1 0 010-1.414l5-5z"
              clipRule="evenodd"
            />
          </svg>
           ) : (
          <svg className="w-4 h-4 transform rotate-180" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M12.293 4.293a1 1 0 011.414 1.414L9.414 10l4.293 4.293a1 1 0 01-1.414 1.414l-5-5a1 1 0 010-1.414l5-5z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </button>

         <aside
        className="fixed top-0 left-0 h-screen flex flex-col overflow-y-auto transition-all duration-300"
        style={{
         backgroundColor: '#003579',
          width: isOpen ? '16rem' : '0',
          zIndex: 40,
        }}
      >
      {/* Header */}
      <div className="p-6 border-b border-gray-600">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${getRoleColor(usuario.rol_id)} flex items-center justify-center shadow-md ring-2 ring-white ring-opacity-20`}>
              <span className="text-sm font-bold text-white">
                {getInitials(usuario.nombre)}
              </span>
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-white"></div>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white truncate">
              {usuario.nombre}
            </h3>
            <p className="text-xs text-gray-300 truncate mt-1">
              {getRoleName(usuario.rol_id)}
            </p>
          </div>
        </div>
      </div>

      {/* Navegación */}
      <nav className="flex-1 p-4 space-y-2">
        {navItems
          .filter(item => item.visible === undefined || item.visible)
          .map(({ href, label, icon, color }) => (
            <Link
              key={href}
              href={href}
               onClick={handleNavClick}
              className={`group flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-200 rounded-xl transition-all duration-300 hover:transform hover:scale-105 ${getItemColorClasses(color)}`}
            >
             <span className={`text-gray-300 transition-colors duration-300 relative ${
                color === 'blue' ? 'group-hover:text-blue-500' :
                color === 'emerald' ? 'group-hover:text-emerald-500' :
                color === 'amber' ? 'group-hover:text-amber-500' :
                color === 'purple' ? 'group-hover:text-purple-500' :
                color === 'indigo' ? 'group-hover:text-indigo-500' :
                color === 'rose' ? 'group-hover:text-rose-500' : 'group-hover:text-gray-500'}`}>
                {icon}
               {href === '/notificaciones' && notifCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs rounded-full px-1">
                    {notifCount}
                  </span>
                )}
              </span>
              <span className="font-medium">{label}</span>
            </Link>
          ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-600">
        <button
          onClick={handleLogout}
          className="group flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-gray-200 hover:text-red-400 hover:bg-white hover:shadow-md rounded-xl transition-all duration-300 hover:transform hover:scale-105"
        >
          <svg className="w-5 h-5 text-gray-300 group-hover:text-red-400 transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span className="font-medium">Cerrar Sesión</span>
        </button>
      </div>
</aside>
    </>
  );
}
