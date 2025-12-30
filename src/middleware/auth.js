const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

// Middleware para verificar token JWT
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      error: 'Token de acceso requerido',
      message: 'Debes incluir un token de autenticación en el header Authorization'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Obtener información completa del usuario desde la base de datos
    const userResult = await query(
      'SELECT user_id, username, email, role, is_active FROM naxos.users WHERE user_id = $1 AND is_active = true',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        error: 'Token inválido',
        message: 'El usuario asociado al token no existe o está inactivo'
      });
    }

    req.user = userResult.rows[0];
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expirado',
        message: 'Tu sesión ha expirado, por favor inicia sesión nuevamente'
      });
    }
    
    return res.status(403).json({
      error: 'Token inválido',
      message: 'Token de autenticación inválido'
    });
  }
};

// Middleware para verificar roles
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'No autenticado',
        message: 'Debes estar autenticado para acceder a este recurso'
      });
    }

    const userRole = req.user.role;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: `No tienes permisos suficientes. Roles permitidos: ${allowedRoles.join(', ')}`
      });
    }

    next();
  };
};

// Middleware para verificar si es administrador
const requireAdmin = requireRole(['ADMIN']);

// Middleware para verificar si es administrador o manager
const requireManagerOrAdmin = requireRole(['ADMIN', 'MANAGER']);

// Middleware opcional de autenticación (no falla si no hay token)
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userResult = await query(
      'SELECT user_id, username, email, role, is_active FROM naxos.users WHERE user_id = $1 AND is_active = true',
      [decoded.userId]
    );

    if (userResult.rows.length > 0) {
      req.user = userResult.rows[0];
    }
  } catch (error) {
    // Ignorar errores de token opcional
  }
  
  next();
};

module.exports = {
  authenticateToken,
  requireRole,
  requireAdmin,
  requireManagerOrAdmin,
  optionalAuth
};
