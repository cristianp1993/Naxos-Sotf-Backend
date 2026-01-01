/**
 * Archivo central de rutas del Sistema POS Naxos
 * Este archivo centraliza todas las rutas del backend
 * El servidor Express solo interactúa con este archivo
 */

// Importar todas las rutas
const authRoutes = require('./auth');
const productsRoutes = require('./products');
const inventoryRoutes = require('./inventory');
const salesRoutes = require('./sales');
const shiftsRoutes = require('./shifts');
const reportsRoutes = require('./reports');

// Nuevas rutas reestructuradas con Sequelize
const categoriesRoutes = require('./categories');
const variantsRoutes = require('./variants');
const pricesRoutes = require('./prices');
const flavorsRoutes = require('./flavors');
const menuRoutes = require('./menu');

// Rutas de product_flavors
const productFlavorsRoutes = require('./productFlavors');

// Exportar todas las rutas centralizadas
module.exports = {
  auth: authRoutes,
  products: productsRoutes,
  inventory: inventoryRoutes,
  sales: salesRoutes,
  shifts: shiftsRoutes,
  reports: reportsRoutes,
  // Nuevas rutas independientes
  categories: categoriesRoutes,
  variants: variantsRoutes,
  prices: pricesRoutes,
  flavors: flavorsRoutes,
  menu: menuRoutes,
  // Product flavors routes
  productFlavors: productFlavorsRoutes
};
