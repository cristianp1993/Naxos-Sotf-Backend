const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const Joi = require('joi');

// Esquemas de validación
const loginSchema = Joi.object({
  username: Joi.string().min(3).max(50).required(),
  password: Joi.string().min(6).required()
});

const registerSchema = Joi.object({
  username: Joi.string().min(3).max(50).required(),
  email: Joi.string().email().optional(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid('ADMIN', 'MANAGER', 'CASHIER', 'VIEWER').default('CASHIER')
});

// Controlador de autenticación
class AuthController {

  // Login de usuario
  static async login(req, res) {
    try {
      console.log(' Login request received:', req.body);

      // Validar datos de entrada
      const { error, value } = loginSchema.validate(req.body);
      if (error) {
        console.log(' Validation error:', error.details[0].message);
        return res.status(400).json({
          error: 'Datos de entrada inválidos',
          message: error.details[0].message
        });
      }

      const { username, password } = value;
      console.log(' Searching for user:', username);

      // Buscar usuario en la base de datos
      const userResult = await query(
        'SELECT user_id, username, email, password_hash, role, is_active FROM naxos.users WHERE username = $1',
        [username]
      );

      if (userResult.rows.length === 0) {
        console.log(' User not found');
        return res.status(401).json({
          error: 'Credenciales inválidas',
          message: 'Usuario o contraseña incorrectos'
        });
      }

      const user = userResult.rows[0];
      console.log(' User data:', {
        user_id: user.user_id,
        username: user.username,
        is_active: user.is_active,
        hasPasswordHash: !!user.password_hash,
        passwordHashLength: user.password_hash?.length || 0
      });

      // Verificar si el usuario está activo
      if (!user.is_active) {
        console.log(' User is inactive');
        return res.status(401).json({
          error: 'Usuario inactivo',
          message: 'Tu cuenta ha sido desactivada. Contacta al administrador.'
        });
      }

      // Verificar contraseña
      console.log(' Comparing password...');
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      console.log('✅ Password comparison result:', isPasswordValid);

      if (!isPasswordValid) {
        console.log(' Password mismatch');
        return res.status(401).json({
          error: 'Credenciales inválidas',
          message: 'Usuario o contraseña incorrectos'
        });
      }

      // Verificar JWT_SECRET
      if (!process.env.JWT_SECRET) {
        console.error(' JWT_SECRET is not defined in environment variables');
        return res.status(500).json({
          error: 'Error interno del servidor',
          message: 'Configuración de seguridad incompleta'
        });
      }

      // Generar token JWT
      const token = jwt.sign(
        {
          userId: user.user_id,
          username: user.username,
          role: user.role
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
      );

      console.log(' Login successful for user:', username);

      // Respuesta exitosa
      return res.status(200).json({
        message: 'Login exitoso',
        token,
        user: {
          user_id: user.user_id,
          username: user.username,
          email: user.email,
          role: user.role
        }
      });

    } catch (error) {
      console.error(' Error in login:', error);
      return res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo procesar el login'
      });
    }
  }

  // Registro de usuario (solo para ADMIN)
  static async register(req, res) {
    try {
      // Validar datos de entrada
      const { error, value } = registerSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'Datos de entrada inválidos',
          message: error.details[0].message
        });
      }

      const { username, email, password, role } = value;

      // Verificar si el usuario ya existe
      const existingUser = await query(
        'SELECT user_id FROM naxos.users WHERE username = $1 OR email = $2',
        [username, email]
      );

      if (existingUser.rows.length > 0) {
        return res.status(409).json({
          error: 'Usuario ya existe',
          message: 'Ya existe un usuario con ese nombre de usuario o email'
        });
      }

      // Encriptar contraseña
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Crear usuario
      const newUserResult = await query(
        'INSERT INTO naxos.users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING user_id, username, email, role, created_at',
        [username, email, passwordHash, role]
      );

      const newUser = newUserResult.rows[0];

      res.status(201).json({
        message: 'Usuario creado exitosamente',
        user: {
          user_id: newUser.user_id,
          username: newUser.username,
          email: newUser.email,
          role: newUser.role,
          created_at: newUser.created_at
        }
      });

    } catch (error) {
      console.error('Error en registro:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo crear el usuario'
      });
    }
  }

  // Obtener información del usuario actual
  static async getProfile(req, res) {
    try {
      const userId = req.user.user_id;

      const userResult = await query(
        'SELECT user_id, username, email, role, is_active, created_at, updated_at FROM naxos.users WHERE user_id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          error: 'Usuario no encontrado',
          message: 'El usuario especificado no existe'
        });
      }

      const user = userResult.rows[0];

      res.status(200).json({
        message: 'Perfil obtenido exitosamente',
        user
      });

    } catch (error) {
      console.error('Error obteniendo perfil:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo obtener el perfil del usuario'
      });
    }
  }

  // Cambiar contraseña
  static async changePassword(req, res) {
    try {
      const changePasswordSchema = Joi.object({
        currentPassword: Joi.string().required(),
        newPassword: Joi.string().min(6).required()
      });

      const { error, value } = changePasswordSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'Datos de entrada inválidos',
          message: error.details[0].message
        });
      }

      const { currentPassword, newPassword } = value;
      const userId = req.user.user_id;

      // Obtener hash actual de la contraseña
      const userResult = await query(
        'SELECT password_hash FROM naxos.users WHERE user_id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          error: 'Usuario no encontrado',
          message: 'El usuario especificado no existe'
        });
      }

      const user = userResult.rows[0];

      // Verificar contraseña actual
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isCurrentPasswordValid) {
        return res.status(401).json({
          error: 'Contraseña actual incorrecta',
          message: 'La contraseña actual que ingresaste es incorrecta'
        });
      }

      // Encriptar nueva contraseña
      const saltRounds = 12;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

      // Actualizar contraseña
      await query(
        'UPDATE naxos.users SET password_hash = $1 WHERE user_id = $2',
        [newPasswordHash, userId]
      );

      res.status(200).json({
        message: 'Contraseña cambiada exitosamente'
      });

    } catch (error) {
      console.error('Error cambiando contraseña:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo cambiar la contraseña'
      });
    }
  }

  // Listar usuarios (solo para ADMIN)
  static async getUsers(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;

      const usersResult = await query(
        `SELECT user_id, username, email, role, is_active, created_at, updated_at 
         FROM naxos.users 
         ORDER BY created_at DESC 
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      // Obtener total de usuarios
      const countResult = await query('SELECT COUNT(*) as total FROM naxos.users');
      const total = parseInt(countResult.rows[0].total);

      res.status(200).json({
        message: 'Usuarios obtenidos exitosamente',
        users: usersResult.rows,
        pagination: {
          current_page: page,
          per_page: limit,
          total,
          total_pages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      console.error('Error obteniendo usuarios:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudieron obtener los usuarios'
      });
    }
  }
}

module.exports = AuthController;
