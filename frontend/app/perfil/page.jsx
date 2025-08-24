'use client';
import { useAuth } from '../../lib/auth';

export default function Perfil() {
  const { usuario } = useAuth();

  const obtenerRol = (rol_id) => {
    switch (rol_id) {
      case 1:
        return 'Alumno';
      case 2:
        return 'Docente';
      case 3:
        return 'Almacén';
      default:
        return 'Desconocido';
    }
  };

  return (
    <div className="bg-white p-4 rounded shadow ml-64">
      <h1 className="text-3xl fw-bold mb-4 text-dark">
        <i className="bi bi-person-badge-fill me-2"></i>Perfil de Usuario
      </h1>

      <div className="bg-light p-4 rounded shadow">
        <h2 className="text-xl fw-semibold mb-3 text-dark">
          <i className="bi bi-info-circle-fill me-2"></i>Información Personal
        </h2>
        <ul className="list-group list-group-flush">
          <li className="list-group-item bg-white">
            <strong>Nombre:</strong> {usuario?.nombre || 'N/A'}
          </li>
          <li className="list-group-item bg-white">
            <strong>Correo:</strong> {usuario?.correo_institucional || 'N/A'}
          </li>
          <li className="list-group-item bg-white">
            <strong>Rol:</strong> {obtenerRol(usuario?.rol_id)}
          </li>
        </ul>
      </div>
    </div>
  );
}
