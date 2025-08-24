//middleware/uploadMiddleware.js
const multer = require('multer');
const cloudinary = require('../config/cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Función para determinar la carpeta según el tipo de material  
const getFolderByType = (tipo) => {
  switch (tipo) {
    case 'liquido':     return 'materialLiquido';
    case 'solido':      return 'materialSolido';
    case 'equipo':      return 'materialEquipo';
    case 'laboratorio': return 'materialLaboratorio';
    default:            return 'materiales';
  }
};

// Configuración de almacenamiento en Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const tipo   = req.body.tipo || req.query.tipo;
    const nombre = req.body.nombre || `material_${Date.now()}`;
    const nombreLimpio = nombre
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    return {
      folder: getFolderByType(tipo),
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      public_id: nombreLimpio,
      transformation: [
        { width: 800, height: 600, crop: 'limit' },
        { quality: 'auto' }
      ]
    };
  },
});

// Configuración de multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB máximo
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de imagen'), false);
    }
  }
});

// Middleware para manejar errores de multer
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'El archivo es demasiado grande. Máximo 5MB.' });
    }
    return res.status(400).json({ error: 'Error al subir archivo: ' + err.message });
  } else if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
};

module.exports = {
  upload,
  handleUploadError,
  getFolderByType
};
