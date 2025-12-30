# Sistema POS Naxos - Backend

Backend completo para el sistema de punto de venta (POS) de Naxos, desarrollado en Node.js con Express y PostgreSQL.

## 🍹 Descripción

Este backend maneja un sistema completo de POS para un negocio de bebidas que incluye:
- **Granizados** (producto estrella): 4 tamaños (Mini 8oz, Pequeño 10oz, Mediano 16oz, Grande 24oz)
- **Sodas**
- **Cervezas** 
- **Cuates** (solos y arreglados)

## ✨ Características Principales

- 🛒 **Gestión de Ventas**: Crear, modificar y procesar ventas completas
- 📦 **Control de Inventario**: Stock en tiempo real con movimientos automáticos
- 💰 **Cierre Diario**: Sistema de turnos con cierre automático y reportes
- 📊 **Reportes Avanzados**: Ventas, inventario, productos más vendidos
- 👥 **Gestión de Usuarios**: Roles (ADMIN, MANAGER, CASHIER, VIEWER)
- 🔐 **Autenticación JWT**: Sistema seguro de login
- 📱 **API RESTful**: Endpoints bien estructurados

## 🏗️ Arquitectura

```
src/
├── config/
│   └── database.js          # Configuración PostgreSQL
├── controllers/
│   ├── authController.js    # Autenticación y usuarios
│   ├── productsController.js # Productos, variantes, precios
│   ├── inventoryController.js # Inventario y movimientos
│   ├── salesController.js   # Ventas y pagos
│   ├── shiftsController.js  # Turnos y cierre diario
│   └── reportsController.js # Reportes y analytics
├── middleware/
│   └── auth.js             # Middleware de autenticación
├── routes/
│   ├── auth.js            # Rutas de autenticación
│   ├── products.js        # Rutas de productos
│   ├── inventory.js       # Rutas de inventario
│   ├── sales.js          # Rutas de ventas
│   ├── shifts.js         # Rutas de turnos
│   └── reports.js        # Rutas de reportes
└── server.js             # Servidor principal
```

## 🚀 Instalación y Configuración

### Prerrequisitos

- Node.js (v16 o superior)
- PostgreSQL (v13 o superior)
- pnpm (gestor de paquetes)

### 1. Clonar e instalar dependencias

```bash
cd Naxos-Backend
pnpm install
```

### 2. Configurar variables de entorno

Editar el archivo `.env`:

```env
# Servidor
PORT=3000
NODE_ENV=development

# Base de datos PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=naxos_pos
DB_USER=postgres
DB_PASSWORD=tu_password_aqui

# JWT
JWT_SECRET=tu_jwt_secret_aqui_muy_seguro
JWT_EXPIRES_IN=24h

# CORS
CORS_ORIGIN=http://localhost:3001

# Rate limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 3. Configurar la base de datos

Ejecuta el script SQL proporcionado para crear el esquema completo:

```bash
psql -U postgres -d naxos_pos -f database_schema.sql
```

### 4. Ejecutar el servidor

```bash
# Desarrollo
pnpm run dev

# Producción
pnpm start
```

## 📚 Endpoints de la API

### 🔐 Autenticación
- `POST /api/auth/login` - Iniciar sesión
- `POST /api/auth/register` - Registrar usuario (solo ADMIN)
- `GET /api/auth/profile` - Obtener perfil del usuario
- `PUT /api/auth/change-password` - Cambiar contraseña
- `GET /api/auth/users` - Listar usuarios (solo ADMIN)

### 📦 Productos
- `GET /api/products` - Listar productos
- `POST /api/products` - Crear producto (ADMIN/MANAGER)
- `GET /api/products/:id` - Obtener producto específico
- `GET /api/products/categories` - Listar categorías
- `POST /api/products/categories` - Crear categoría
- `POST /api/products/variants` - Crear variante
- `POST /api/products/prices` - Crear precio

### 📊 Inventario
- `GET /api/inventory/locations` - Listar ubicaciones
- `GET /api/inventory/locations/:id/stock` - Stock por ubicación
- `PUT /api/inventory/stock` - Actualizar stock
- `POST /api/inventory/movements` - Registrar movimiento
- `GET /api/inventory/movements/history` - Historial de movimientos

### 💰 Ventas
- `POST /api/sales` - Crear nueva venta
- `GET /api/sales` - Listar ventas
- `GET /api/sales/:id` - Obtener venta específica
- `POST /api/sales/:id/items` - Agregar item a venta
- `POST /api/sales/:id/payments` - Procesar pago
- `DELETE /api/sales/:id/cancel` - Cancelar venta

### ⏰ Turnos
- `POST /api/shifts` - Abrir turno
- `GET /api/shifts/active/:locationId` - Obtener turno activo
- `PUT /api/shifts/:id/close` - Cerrar turno
- `GET /api/shifts` - Historial de turnos

### 📈 Reportes
- `GET /api/reports/dashboard` - Dashboard general
- `GET /api/reports/sales` - Reporte de ventas
- `GET /api/reports/stock` - Reporte de stock
- `GET /api/reports/products` - Reporte de productos

## 💡 Flujo de Trabajo Típico

### 1. Configuración Inicial
```bash
# 1. Crear usuario administrador
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password123","role":"ADMIN"}'

# 2. Crear ubicación principal
curl -X POST http://localhost:3000/api/inventory/locations \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Principal"}'
```

### 2. Configurar Productos
```bash
# Crear categoría Granizados
curl -X POST http://localhost:3000/api/products/categories \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Granizados"}'

# Crear producto Granizado
curl -X POST http://localhost:3000/api/products \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"category_id":1,"name":"Granizado"}'

# Crear variantes (Mini, Pequeño, Mediano, Grande)
```

### 3. Flujo de Venta Diaria
```bash
# 1. Abrir turno
curl -X POST http://localhost:3000/api/shifts \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"location_id":1,"opening_float":100}'

# 2. Crear venta
curl -X POST http://localhost:3000/api/sales \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"location_id":1}'

# 3. Agregar items a la venta
curl -X POST http://localhost:3000/api/sales/1/items \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"variant_id":1,"quantity":2}'

# 4. Procesar pago
curl -X POST http://localhost:3000/api/sales/1/payments \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"method":"CASH","amount":24.00}'

# 5. Cerrar turno
curl -X PUT http://localhost:3000/api/shifts/1/close \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"closing_cash_counted":124.00}'
```

## 🔒 Sistema de Roles

- **ADMIN**: Acceso completo al sistema
- **MANAGER**: Gestión de productos, inventario, reportes
- **CASHIER**: Procesar ventas, abrir/cerrar turnos
- **VIEWER**: Solo lectura de reportes

## 📊 Funcionalidades Especiales

### Cierre Diario Automático
- Al pagar una venta, se crean automáticamente movimientos de inventario
- El cierre de turno genera reportes detallados
- Control de diferencias de caja

### Gestión de Precios
- Sistema de precios con vigencia temporal
- Precio automático si no se especifica en la venta

### Reportes Avanzados
- Productos más vendidos por período
- Análisis de movimientos de inventario
- Rendimiento de turnos
- Dashboard en tiempo real

## 🛠️ Tecnologías Utilizadas

- **Node.js** - Runtime de JavaScript
- **Express.js** - Framework web
- **PostgreSQL** - Base de datos
- **JWT** - Autenticación
- **bcryptjs** - Encriptación de contraseñas
- **Joi** - Validación de datos
- **Helmet** - Seguridad HTTP
- **CORS** - Cross-Origin Resource Sharing

## 📝 Notas Importantes

1. **Base de Datos**: El esquema está optimizado para PostgreSQL con triggers y funciones
2. **Inventario**: Se actualiza automáticamente con cada venta
3. **Precios**: Sistema flexible con vigencia temporal
4. **Turnos**: Requeridos para procesar ventas
5. **Seguridad**: Rate limiting y validación en todos los endpoints

## 🤝 Contribución

Este backend está diseñado específicamente para el negocio Naxos. Para modificaciones o mejoras, asegúrate de mantener la compatibilidad con el esquema de base de datos existente.

## 📞 Soporte

Para soporte técnico o consultas sobre la implementación, contacta al equipo de desarrollo.
