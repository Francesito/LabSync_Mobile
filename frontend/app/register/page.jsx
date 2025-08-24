'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';

export default function Register() {
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [grupoId, setGrupoId] = useState('');
  const [grupos, setGrupos] = useState([]);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  const router = useRouter();

  // Cargar grupos al montar el componente
  useEffect(() => {
    const cargarGrupos = async () => {
      try {
        const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/grupos`);
        setGrupos(response.data);
      } catch (err) {
        console.error('Error al cargar grupos:', err);
        setError('Error al cargar los grupos disponibles');
      }
    };

    cargarGrupos();
  }, []);

 useEffect(() => {
  const mediaQuery = window.matchMedia('(min-width: 1320px) and (min-height: 750px)');
  const updateScreen = () => setIsLargeScreen(mediaQuery.matches);
  updateScreen();

  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', updateScreen);
    return () => mediaQuery.removeEventListener('change', updateScreen);
  } else {
    mediaQuery.addListener(updateScreen);
    return () => mediaQuery.removeListener(updateScreen);
  }
}, []);

  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!grupoId) {
      setError('Por favor selecciona tu grupo');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/register`, {
        nombre,
        correo_institucional: correo,
        contrasena,
        grupo_id: parseInt(grupoId),
        rol: 'alumno', // Set default role to alumno
      });
      
      alert('Usuario registrado. Verifica tu correo.');
      router.push('/login');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrar usuario');
    } finally {
      setLoading(false);
    }
  };

  const handleGrupoSelect = (id) => {
    setGrupoId(id);
  };

  return (
 <div
  className={`min-vh-100 d-flex font-sans position-relative auth-bg ${isLargeScreen ? 'bg-image' : 'bg-gradient'}`}
>

      <div className="row w-100 m-0 position-relative" style={{ zIndex: 2 }}>
        {/* Sección derecha - Formulario */}
         <div className={`col-12 col-md-6 ${isLargeScreen ? 'offset-md-6' : 'mx-auto'} d-flex flex-column justify-content-center p-4 p-md-5`}>
          <div className="w-100" style={{ maxWidth: '500px', margin: '0 auto' }}>
            <div className="mb-4">
              <h2 className="fw-bold text-dark mb-1">Crear cuenta</h2>
              <p className="text-dark-50 small">Completa los datos para crear tu cuenta en LabSync</p>
            </div>

            {error && (
              <div className="alert alert-danger d-flex align-items-center mb-4 rounded shadow-sm">
                <i className="bi bi-exclamation-triangle-fill me-2"></i>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Nombre */}
              <div className="mb-4">
                <label htmlFor="nombre" className="form-label fw-semibold text-dark mb-2">Nombre Completo</label>
                <input
                  type="text"
                  id="nombre"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="form-control bg-white border-dark text-dark"
                  style={{
                    backgroundColor: '#ffffff',
                    borderColor: '#000000',
                    color: '#000000',
                    padding: '12px 16px',
                    fontSize: '16px'
                  }}
                  placeholder="Ingresa tu nombre"
                  required
                  disabled={loading}
                />
              </div>

              {/* Correo */}
              <div className="mb-4">
                <label htmlFor="correo" className="form-label fw-semibold text-dark mb-2">Correo Institucional</label>
                <input
                  type="email"
                  id="correo"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  className="form-control bg-white border-dark text-dark"
                  style={{
                    backgroundColor: '#ffffff',
                    borderColor: '#000000',
                    color: '#000000',
                    padding: '12px 16px',
                    fontSize: '16px'
                  }}
                  placeholder="ejemplo@utsjr.edu.mx"
                  required
                  disabled={loading}
                />
              </div>

              {/* Contraseña */}
              <div className="mb-4">
                <label htmlFor="contrasena" className="form-label fw-semibold text-dark mb-2">Contraseña</label>
                <div className="position-relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="contrasena"
                    value={contrasena}
                    onChange={(e) => setContrasena(e.target.value)}
                    className="form-control bg-white border-dark text-dark pe-5"
                    style={{
                      backgroundColor: '#ffffff',
                      borderColor: '#000000',
                      color: '#000000',
                      padding: '12px 16px',
                      fontSize: '16px'
                    }}
                    placeholder="Crea una contraseña"
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="btn position-absolute top-50 end-0 translate-middle-y me-3 p-0 border-0 bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ color: '#000000' }}
                    disabled={loading}
                  >
                    <i className={`bi ${showPassword ? 'bi-eye-fill' : 'bi-eye-slash-fill'}`}></i>
                  </button>
                </div>
              </div>

              {/* Selección de Grupo */}
              <div className="mb-4">
                <label className="form-label fw-semibold text-dark mb-3">Selecciona tu Grupo</label>
                <div className="row g-2">
                  {grupos.map((grupo) => (
                    <div key={grupo.id} className="col-6 col-md-4">
                      <button
                        type="button"
                        onClick={() => handleGrupoSelect(grupo.id.toString())}
                        className="btn w-100 text-center border border-2 fw-semibold"
                        style={{
                         backgroundColor: grupoId === grupo.id.toString() ? '#003579' : '#ffffff',
                          borderColor: grupoId === grupo.id.toString() ? '#003579' : '#000000',
                          color: grupoId === grupo.id.toString() ? '#ffffff' : '#000000',
                          padding: '10px 8px',
                          fontSize: '14px',
                          borderRadius: '4px',
                          transition: 'all 0.2s ease'
                        }}
                        disabled={loading}
                      >
                        {grupo.nombre}
                      </button>
                    </div>
                  ))}
                </div>
                {!grupoId && (
                  <small className="text-muted mt-2 d-block">* Selecciona el grupo al que perteneces</small>
                )}
              </div>

              <button 
                type="submit" 
                className="btn w-100 fw-semibold mb-4"
                style={{
                  backgroundColor: '#003579',
                  borderColor: '#003579',
                  color: '#ffffff',
                  borderRadius: '4px',
                  padding: '12px',
                  fontSize: '16px',
                  opacity: loading ? 0.7 : 1
                }}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Creando cuenta...
                  </>
                ) : (
                  'Crear cuenta'
                )}
              </button>
            </form>

            <p className="text-center text-dark-50">
              ¿Ya tienes cuenta?{' '}
              <Link href="/login" className="text-dark fw-bold text-decoration-none">Inicia sesión</Link>
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
     .auth-bg {
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

.bg-gradient {
  background-image: linear-gradient(135deg, #e6f7ec 0%, #ffffff 100%);
}
        
        .form-control:focus {
          background-color: #ffffff !important;
          border-color: #000000 !important;
          color: #000000 !important;
          box-shadow: 0 0 0 0.2rem rgba(0,0,0,0.25) !important;
        }
        
        .form-control::placeholder {
          color: #6c757d !important;
        }

        .btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .btn:disabled {
          cursor: not-allowed;
        }

        .bg-image {
  background-image: url('/background.jpg');
}
      `}</style>
    </div>
  );
}
