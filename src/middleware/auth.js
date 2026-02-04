const jwt = require('jsonwebtoken');
const { User } = require('../models');

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const parts = typeof authHeader === 'string' ? authHeader.split(' ') : [];
  const token = parts.length === 2 && /^Bearer$/i.test(parts[0]) ? parts[1] : null;

  if (!token) {
    return res.status(401).json({
      error: 'Token de acceso requerido',
      message: 'Debes incluir un token de autenticación en el header Authorization',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const userId = decoded.userId || decoded.user_id || decoded.id || decoded.sub;

    if (!userId) {
      return res.status(401).json({
        error: 'Token inválido',
        message: 'El token no contiene un identificador de usuario válido',
      });
    }

    const user = await User.findOne({
      where: { user_id: userId, is_active: true },
      attributes: ['user_id', 'username', 'email', 'role', 'is_active'],
    });

    if (!user) {
      return res.status(401).json({
        error: 'Token inválido',
        message: 'El usuario asociado al token no existe o está inactivo',
      });
    }

    req.user = user;
    return next();
  } catch (error) {
    console.error('JWT verify failed:', error?.name, error?.message);

    if (error?.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expirado',
        message: 'Tu sesión ha expirado, por favor inicia sesión nuevamente',
      });
    }

    return res.status(403).json({
      error: 'Token inválido',
      message: `Token inválido: ${error?.name || 'Error'} - ${error?.message || 'Sin mensaje'}`,
    });
  }
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'No autenticado',
        message: 'Debes estar autenticado para acceder a este recurso',
      });
    }

    const userRole = req.user.role;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: `No tienes permisos suficientes. Roles permitidos: ${allowedRoles.join(', ')}`,
      });
    }

    return next();
  };
};

const requireAdmin = requireRole(['ADMIN']);

const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const parts = typeof authHeader === 'string' ? authHeader.split(' ') : [];
  const token = parts.length === 2 && /^Bearer$/i.test(parts[0]) ? parts[1] : null;

  if (!token) return next();

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId || decoded.user_id || decoded.id || decoded.sub;
    if (!userId) return next();

    const user = await User.findOne({
      where: { user_id: userId, is_active: true },
      attributes: ['user_id', 'username', 'email', 'role', 'is_active'],
    });

    if (user) req.user = user;
  } catch (error) {
    console.error('Optional JWT verify failed:', error?.name, error?.message);
  }

  return next();
};

module.exports = {
  authenticateToken,
  requireRole,
  requireAdmin,
  optionalAuth,
};
