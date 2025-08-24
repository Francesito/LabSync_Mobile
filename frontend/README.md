# Frontend

Aplicación web construida con [Next.js](https://nextjs.org).

## Configuración

Copia el archivo `.env.example` a `.env.local` y completa los valores:

```bash
cp .env.example .env.local
```

Variables disponibles:

- `NEXT_PUBLIC_API_URL` – URL pública del backend (por ejemplo `https://tu-backend.onrender.com`).
- `NEXT_PUBLIC_API_KEY` – API key que se enviará en la cabecera `x-api-key`.
- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` – nombre de tu cuenta de Cloudinary para cargar imágenes.

## Desarrollo

Instala las dependencias y levanta el servidor de desarrollo:
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

```bash
npm install
npm run dev
```
