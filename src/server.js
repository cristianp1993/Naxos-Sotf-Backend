const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Importar rutas desde el archivo central
const routes = require('./routes');

// Importar controlador de menú para ruta pública
const MenuController = require('./controllers/menuController');
const DashboardController = require('./controllers/dashboardController');

// Importar configuración de base de datos Sequelize
const { testConnection, syncModels } = require('./config/database-sequelize');

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
    message: 'Bienvenido a Naxos - Backend API',
    version: '1.0.0',
    documentation: '/api/docs',
    endpoints: {
      auth: '/api/auth',
      products: '/api/products',
      inventory: '/api/inventory',
      sales: '/api/sales',
      shifts: '/api/shifts',
      reports: '/api/reports',
      // Nuevas rutas reestructuradas
      categories: '/api/categories',
      variants: '/api/variants',
      prices: '/api/prices',
      flavors: '/api/flavors',
      menu: '/api/menu',
      expenses: '/api/expenses'
    }
  });
});

// Rutas de la API - usando el archivo central de rutas
app.use('/api/auth', routes.auth);
app.use('/api/products', routes.products);
app.use('/api/inventory', routes.inventory);
app.use('/api/sales', routes.sales);
app.use('/api/shifts', routes.shifts);
app.use('/api/reports', routes.reports);

// Nuevas rutas reestructuradas con Sequelize
app.use('/api/categories', routes.categories);
app.use('/api/variants', routes.variants);
app.use('/api/prices', routes.prices);
app.use('/api/flavors', routes.flavors);
app.use('/api/menu', routes.menu);
app.use('/api/expenses', routes.expenses);

// Rutas de dashboard
app.get('/api/dashboard/stats', DashboardController.getStats);

// Rutas de product flavors (debe estar en /api porque ya incluye /products en las rutas)
app.use('/api/product-flavors', routes.productFlavors);


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
    
    // Sincronizar modelos con la base de datos
    console.log('🔄 Sincronizando modelos con la base de datos...');
    const modelsSynced = await syncModels();
    if (!modelsSynced) {
      console.error('❌ No se pudieron sincronizar los modelos');
      process.exit(1);
    }
    
    // Iniciar servidor
    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
      console.log(`📊 Entorno: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🌐 URL: http://localhost:${PORT}`);
      console.log(`📚 API Docs: http://localhost:${PORT}/api/docs`);
      console.log(`🍹 Menú público: http://localhost:${PORT}/api/menu/public`);
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
