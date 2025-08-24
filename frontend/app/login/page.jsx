'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';

export default function Login() {
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
   const [isLargeScreen, setIsLargeScreen] = useState(false);
  const router = useRouter();

  useEffect(() => {
  const mediaQuery = window.matchMedia('(min-width: 1320px) and (min-height: 750px)');
  const updateScreen = () => setIsLargeScreen(mediaQuery.matches);
  updateScreen();

  // Compatibilidad con navegadores que aún usan addListener/removeListener
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
    try {
      const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`, {
        correo_institucional: correo,
        contrasena,
      });
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('nombre', response.data.nombre);
      setRedirecting(true);
      router.replace('/catalog');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al iniciar sesión');
    }
  };

   if (redirecting) {
    return <div className="min-vh-100 bg-white"></div>;
  }

  return (
   <div
  className={`min-vh-100 d-flex font-sans position-relative auth-bg ${isLargeScreen ? 'bg-image' : 'bg-gradient'}`}
>

      
      <div className="row w-100 m-0 position-relative min-vh-100 align-items-center" style={{ zIndex: 2 }}>

        {/* Sección derecha - Formulario */}
     <div className={`col-12 col-md-6 ${isLargeScreen ? 'offset-lg-6' : 'mx-auto'} d-flex flex-column justify-content-center p-4 p-md-5`}>
          <div className="w-100" style={{ maxWidth: '500px', margin: '0 auto' }}>
            <div className="mb-4">
              <h2 className="fw-bold text-dark mb-1">Inicia Sesión</h2>
              <p className="text-muted small">Introduce tus credenciales para ingresar a tu cuenta.</p>
            </div>

            {error && (
              <div className="alert alert-danger d-flex align-items-center mb-4 rounded shadow-sm">
                <i className="bi bi-exclamation-triangle-fill me-2"></i>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Email Address */}
              <div className="mb-4">
                <label htmlFor="correo" className="form-label fw-semibold text-dark mb-2">Correo Electrónico</label>
                <input
                  type="email"
                  id="correo"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  className="form-control bg-transparent border-dark text-dark"
                 style={{
  backgroundColor: 'rgba(255,255,255,0.8) !important',
  borderColor: 'rgba(0,0,0,0.3)',
  color: 'black',
  padding: '12px 16px',
  fontSize: '16px'
}}
                  placeholder="ejemplo@utsjr.edu.mx"
                  required
                />
              </div>

              {/* Password */}
              <div className="mb-4">
               <label htmlFor="contrasena" className="form-label fw-semibold text-dark mb-2">Contraseña</label>
                <div className="position-relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="contrasena"
                    value={contrasena}
                    onChange={(e) => setContrasena(e.target.value)}
                    className="form-control bg-transparent border-dark text-dark pe-5"
                   style={{
  backgroundColor: 'rgba(255,255,255,0.8) !important',
  borderColor: 'rgba(0,0,0,0.3)',
  color: 'black',
  padding: '12px 16px',
  fontSize: '16px'
}}
                    placeholder="Ingresa tu contraseña"
                    required
                  />
                  <button
                    type="button"
                    className="btn position-absolute top-50 end-0 translate-middle-y me-3 p-0 border-0 bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ color: 'rgba(0,0,0,0.7)' }}
                  >
                    <i className={`bi ${showPassword ? 'bi-eye-fill' : 'bi-eye-slash-fill'}`}></i>
                  </button>
                </div>
              </div>

              <button 
                type="submit" 
                className="btn w-100 fw-semibold mb-4"
                style={{
                 backgroundColor: '#003579',
                  borderColor: '#003579',
                  color: 'white',
                  borderRadius: '4px',
                  padding: '12px',
                  fontSize: '16px'
                }}
              >
                Iniciar Sesión 
              </button>
            </form>

            <div className="text-center mb-4">
              <Link href="/forgot-password" className="text-dark text-decoration-none">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            <p className="text-center text-muted">
              ¿No tienes cuenta?{' '}
             <Link href="/register" className="text-dark fw-bold text-decoration-none">Regístrate</Link>
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

  .bg-image {
    background-image: url('/background.jpg');
  }

 .bg-gradient {
  background-image: linear-gradient(135deg, #e6f7ec 0%, #ffffff 100%);
}

  .form-control:focus {
    background-color: rgba(255,255,255,0.9) !important;
    border-color: rgba(0,0,0,0.5) !important;
    color: black !important;
    box-shadow: 0 0 0 0.2rem rgba(0,0,0,0.25) !important;
  }

  .form-control::placeholder {
    color: rgba(0,0,0,0.5) !important;
  }
  
  .form-check-input:checked {
    background-color: #003579 !important;
    border-color: #003579 !important;
  }
  
  .form-check-input:focus {
    border-color: rgba(255,255,255,0.5) !important;
    box-shadow: 0 0 0 0.2rem rgba(255,255,255,0.25) !important;
  }
`}</style>

    </div>
  );
}
