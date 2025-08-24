// Este archivo debe ser un componente de servidor, por eso no usamos 'use client'

import './globals.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import { AuthProvider } from '../lib/auth';
import ClientLayout from '../components/ClientLayout';

export const metadata = {
  title: 'LabSync',
  description: 'Sistema de gestión de materiales de laboratorio',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="bg-gradient-to-br from-gray-900 to-blue-900 min-vh-100">
        <AuthProvider>
          <ClientLayout>{children}</ClientLayout>
        </AuthProvider>
        <script
          src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"
          async
        />
      </body>
    </html>
  );
}
