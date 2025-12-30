const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { testConnection } = require('./config/database');

// Importar rutas
const authRoutes = require('./routes/auth');
const productsRoutes = require('./routes/products');
const inventoryRoutes = require('./routes/inventory');
const salesRoutes = require('./routes/sales');
const shiftsRoutes = require('./routes/shifts');
const reportsRoutes = require('./routes/reports');

// Importar controlador de productos para ruta pública
const ProductsController = require('./controllers/productsController');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware de seguridad
app.use(helmet());

// Configuración de CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // límite de requests por ventana
  message: {
    error: 'Demasiadas requests desde esta IP, intenta nuevamente en 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Middlewares generales
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rutas de salud
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Sistema Naxos POS - Backend funcionando correctamente',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Ruta raíz
app.get('/', (req, res) => {
  res.json({
    message: 'Bienvenido al Sistema POS Naxos - Backend API',
    version: '1.0.0',
    documentation: '/api/docs',
    endpoints: {
      auth: '/api/auth',
      products: '/api/products',
      inventory: '/api/inventory',
      sales: '/api/sales',
      shifts: '/api/shifts',
      reports: '/api/reports',
      public: {
        menu: '/api/public/menu'
      }
    }
  });
});

// Rutas públicas (sin autenticación)
app.get('/api/public/menu', ProductsController.getPublicMenu);

// Rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/shifts', shiftsRoutes);
app.use('/api/reports', reportsRoutes);

// Middleware para rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint no encontrado',
    message: `La ruta ${req.originalUrl} no existe en este servidor`
  });
});

// Middleware global de manejo de errores
app.use((err, req, res, next) => {
  console.error('Error global:', err.stack);
  
  // Error de validación de Joi
  if (err.isJoi) {
    return res.status(400).json({
      error: 'Error de validación',
      message: err.details.map(detail => detail.message).join(', ')
    });
  }
  
  // Error de base de datos
  if (err.code && err.code.startsWith('23')) {
    return res.status(400).json({
      error: 'Error de base de datos',
      message: 'Violación de restricciones de la base de datos'
    });
  }
  
  // Error por defecto
  res.status(500).json({
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Algo salió mal'
  });
});

// Inicializar el servidor
const startServer = async () => {
  try {
    // Probar conexión a la base de datos
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('❌ No se pudo conectar a la base de datos');
      process.exit(1);
    }
    
    // Iniciar servidor
    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
      console.log(`📊 Entorno: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🌐 URL: http://localhost:${PORT}`);
      console.log(`📚 API Docs: http://localhost:${PORT}/api/docs`);
    });
  } catch (error) {
    console.error('❌ Error iniciando el servidor:', error);
    process.exit(1);
  }
};

// Manejar cierre graceful
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM recibido, cerrando servidor...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT recibido, cerrando servidor...');
  process.exit(0);
});

// Iniciar el servidor
startServer();

module.exports = app;
