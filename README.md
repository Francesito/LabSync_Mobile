# LabSync

Monorepositorio con los proyectos de **backend**, **frontend** y **mobile**.

## Estructura

- `backend/`: API en Express para gestión de materiales y usuarios.
- `frontend/`: aplicación web en Next.js.
- `mobile/`: app móvil construida con Expo.

## Variables de entorno

### Backend
Crea un archivo `.env` (consulta `backend/.env.example`) con:

- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- `EMAIL_USER`, `EMAIL_PASS`
- `JWT_SECRET`
- `PORT`
- `FRONTEND_URL` (opcional, para enlaces en correos)

### Frontend
Configura las variables en `.env` (ver `frontend/.env.example`):

- `NEXT_PUBLIC_API_URL` – URL pública del backend
- `NEXT_PUBLIC_API_KEY` – clave de API opcional
- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` – nombre de tu cuenta en Cloudinary

### Mobile
La app Expo lee la URL del backend desde `.env` (ver `mobile/.env.example`):

- `EXPO_PUBLIC_API_URL` – URL pública del backend

## Desarrollo local

1. **Backend**
   ```bash
   cd backend
   npm install
   npm start
   ```
2. **Frontend**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
3. **Mobile**
   ```bash
   cd mobile
   npm install
   npx expo start --tunnel
   ```
   Usa la app **Expo Go** para escanear el código QR.
