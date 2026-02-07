const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sequelize } = require('../config/database-sequelize');
const Joi = require('joi');

// Esquemas de validación
const loginSchema = Joi.object({
  username: Joi.string().min(3).max(50).required(),
  password: Joi.string().min(6).required(),
});

const registerSchema = Joi.object({
  username: Joi.string().min(3).max(50).required(),
  email: Joi.string().email().allow(null, '').optional(),
  name: Joi.string().min(3).max(255).allow(null, '').optional(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid('ADMIN', 'CASHIER').default('ADMIN'),
});

class AuthController {
  // Login de usuario
  static async login(req, res) {
    try {
      console.log('Login request received:', req.body);

      // Validar datos de entrada
      const { error, value } = loginSchema.validate(req.body);
      if (error) {
        console.log('Validation error:', error.details[0].message);
        return res.status(400).json({
          error: 'Datos de entrada inválidos',
          message: error.details[0].message,
        });
      }

      const { username, password } = value;
      console.log('Searching for user:', username);

      // Buscar usuario (Sequelize)
      const [rows] = await sequelize.query(
        `
        SELECT user_id, username, email, name, password_hash, role, is_active
        FROM naxos.users
        WHERE username = :username
        LIMIT 1
        `,
        {
          replacements: { username },
        }
      );

      if (!rows || rows.length === 0) {
        console.log('User not found');
        return res.status(401).json({
          error: 'Credenciales inválidas',
          message: 'Usuario o contraseña incorrectos',
        });
      }

      const user = rows[0];
      console.log('User data:', {
        user_id: user.user_id,
        username: user.username,
        is_active: user.is_active,
        hasPasswordHash: !!user.password_hash,
        passwordHashLength: user.password_hash?.length || 0,
      });

      // Verificar si el usuario está activo
      if (!user.is_active) {
        console.log('User is inactive');
        return res.status(401).json({
          error: 'Usuario inactivo',
          message: 'Tu cuenta ha sido desactivada. Contacta al administrador.',
        });
      }

      // Verificar contraseña
      console.log('Comparing password...');
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      console.log('Password comparison result:', isPasswordValid);

      if (!isPasswordValid) {
        console.log('Password mismatch');
        return res.status(401).json({
          error: 'Credenciales inválidas',
          message: 'Usuario o contraseña incorrectos',
        });
      }

      // Verificar JWT_SECRET
      if (!process.env.JWT_SECRET) {
        console.error('JWT_SECRET is not defined in environment variables');
        return res.status(500).json({
          error: 'Error interno del servidor',
          message: 'Configuración de seguridad incompleta',
        });
      }

      // Generar token JWT
      const token = jwt.sign(
        {
          userId: user.user_id,
          username: user.username,
          role: user.role,
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
      );

      console.log('Login successful for user:', username);

      return res.status(200).json({
        message: 'Login exitoso',
        token,
        user: {
          user_id: user.user_id,
          username: user.username,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      });
    } catch (err) {
      console.error('Error in login:', err);
      return res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo procesar el login',
      });
    }
  }

  // Registro de usuario (solo para ADMIN)
  static async register(req, res) {
    try {
      const { error, value } = registerSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'Datos de entrada inválidos',
          message: error.details[0].message,
        });
      }

      const { username, email, name, password, role } = value;

      // Verificar si el usuario ya existe
      const [existing] = await sequelize.query(
        `
        SELECT user_id
        FROM naxos.users
        WHERE username = :username OR (email IS NOT NULL AND email = :email)
        LIMIT 1
        `,
        { replacements: { username, email: email || null } }
      );

      if (existing && existing.length > 0) {
        return res.status(409).json({
          error: 'Usuario ya existe',
          message: 'Ya existe un usuario con ese nombre de usuario o email',
        });
      }

      // Encriptar contraseña
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Crear usuario
      const [inserted] = await sequelize.query(
        `
        INSERT INTO naxos.users (username, email, name, password_hash, role, is_active)
        VALUES (:username, :email, :name, :password_hash, :role, :is_active)
        RETURNING user_id, username, email, name, role, is_active, created_at
        `,
        {
          replacements: {
            username,
            email: email || null,
            name: name || null,
            password_hash: passwordHash,
            role: role || 'ADMIN',
            is_active: true,
          },
        }
      );

      const newUser = inserted[0];

      return res.status(201).json({
        message: 'Usuario creado exitosamente',
        user: {
          user_id: newUser.user_id,
          username: newUser.username,
          email: newUser.email,
          name: newUser.name,
          role: newUser.role,
          is_active: newUser.is_active,
          created_at: newUser.created_at,
        },
      });
    } catch (err) {
      console.error('Error en registro:', err);
      return res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo crear el usuario',
      });
    }
  }

  // Obtener información del usuario actual
  static async getProfile(req, res) {
    try {
      // OJO: en tu JWT guardas userId, aquí normalizo ambos
      const userId = req.user?.user_id || req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          error: 'No autorizado',
          message: 'No se encontró el usuario autenticado',
        });
      }

      const [rows] = await sequelize.query(
        `
        SELECT user_id, username, email, name, role, is_active, created_at, updated_at
        FROM naxos.users
        WHERE user_id = :userId
        LIMIT 1
        `,
        { replacements: { userId } }
      );

      if (!rows || rows.length === 0) {
        return res.status(404).json({
          error: 'Usuario no encontrado',
          message: 'El usuario especificado no existe',
        });
      }

      return res.status(200).json({
        message: 'Perfil obtenido exitosamente',
        user: rows[0],
      });
    } catch (err) {
      console.error('Error obteniendo perfil:', err);
      return res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo obtener el perfil del usuario',
      });
    }
  }

  // Cambiar contraseña
  static async changePassword(req, res) {
    try {
      const changePasswordSchema = Joi.object({
        currentPassword: Joi.string().required(),
        newPassword: Joi.string().min(6).required(),
      });

      const { error, value } = changePasswordSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'Datos de entrada inválidos',
          message: error.details[0].message,
        });
      }

      const { currentPassword, newPassword } = value;
      const userId = req.user?.user_id || req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          error: 'No autorizado',
          message: 'No se encontró el usuario autenticado',
        });
      }

      // Obtener hash actual
      const [rows] = await sequelize.query(
        `
        SELECT password_hash
        FROM naxos.users
        WHERE user_id = :userId
        LIMIT 1
        `,
        { replacements: { userId } }
      );

      if (!rows || rows.length === 0) {
        return res.status(404).json({
          error: 'Usuario no encontrado',
          message: 'El usuario especificado no existe',
        });
      }

      const user = rows[0];

      // Verificar contraseña actual
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isCurrentPasswordValid) {
        return res.status(401).json({
          error: 'Contraseña actual incorrecta',
          message: 'La contraseña actual que ingresaste es incorrecta',
        });
      }

      // Hash nueva
      const saltRounds = 12;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

      // Actualizar
      await sequelize.query(
        `
        UPDATE naxos.users
        SET password_hash = :password_hash, updated_at = NOW()
        WHERE user_id = :userId
        `,
        { replacements: { password_hash: newPasswordHash, userId } }
      );

      return res.status(200).json({
        message: 'Contraseña cambiada exitosamente',
      });
    } catch (err) {
      console.error('Error cambiando contraseña:', err);
      return res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo cambiar la contraseña',
      });
    }
  }

  // Listar usuarios (solo para ADMIN)
  static async getUsers(req, res) {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 10;
      const offset = (page - 1) * limit;

      const [users] = await sequelize.query(
        `
        SELECT user_id, username, email, name, role, is_active, created_at, updated_at
        FROM naxos.users
        ORDER BY created_at DESC
        LIMIT :limit OFFSET :offset
        `,
        { replacements: { limit, offset } }
      );

      const [countRows] = await sequelize.query(
        `SELECT COUNT(*)::int AS total FROM naxos.users`
      );

      const total = countRows?.[0]?.total ?? 0;

      return res.status(200).json({
        message: 'Usuarios obtenidos exitosamente',
        users,
        pagination: {
          current_page: page,
          per_page: limit,
          total,
          total_pages: Math.ceil(total / limit),
        },
      });
    } catch (err) {
      console.error('Error obteniendo usuarios:', err);
      return res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudieron obtener los usuarios',
      });
    }
  }

  // Actualizar usuario (solo para ADMIN)
  static async updateUser(req, res) {
    try {
      const { userId } = req.params;
      const { username, email, name, role, is_active } = req.body;

      // Validar datos de entrada
      const updateSchema = Joi.object({
        username: Joi.string().min(3).max(50).optional(),
        email: Joi.string().email().allow(null, '').optional(),
        name: Joi.string().min(3).max(255).allow(null, '').optional(),
        role: Joi.string().valid('ADMIN', 'CASHIER').optional(),
        is_active: Joi.boolean().optional(),
      });

      const { error, value } = updateSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'Datos de entrada inválidos',
          message: error.details[0].message,
        });
      }

      // Verificar si el usuario existe
      const [existingUser] = await sequelize.query(
        `
        SELECT user_id
        FROM naxos.users
        WHERE user_id = :userId
        LIMIT 1
        `,
        { replacements: { userId } }
      );

      if (!existingUser || existingUser.length === 0) {
        return res.status(404).json({
          error: 'Usuario no encontrado',
          message: 'El usuario especificado no existe',
        });
      }

      // Si se está actualizando username o email, verificar que no existan
      if (value.username || value.email) {
        const [duplicateCheck] = await sequelize.query(
          `
          SELECT user_id
          FROM naxos.users
          WHERE (username = :username OR (email IS NOT NULL AND email = :email))
          AND user_id != :userId
          LIMIT 1
          `,
          {
            replacements: {
              username: value.username || '',
              email: value.email || null,
              userId,
            },
          }
        );

        if (duplicateCheck && duplicateCheck.length > 0) {
          return res.status(409).json({
            error: 'Conflicto de datos',
            message: 'Ya existe otro usuario con ese nombre de usuario o email',
          });
        }
      }

      // Construir dinámicamente la consulta de actualización
      const updateFields = [];
      const updateValues = { userId };

      if (value.username !== undefined) {
        updateFields.push('username = :username');
        updateValues.username = value.username;
      }
      if (value.email !== undefined) {
        updateFields.push('email = :email');
        updateValues.email = value.email || null;
      }
      if (value.name !== undefined) {
        updateFields.push('name = :name');
        updateValues.name = value.name || null;
      }
      if (value.role !== undefined) {
        updateFields.push('role = :role');
        updateValues.role = value.role;
      }
      if (value.is_active !== undefined) {
        updateFields.push('is_active = :is_active');
        updateValues.is_active = value.is_active;
      }

      if (updateFields.length === 0) {
        return res.status(400).json({
          error: 'Sin datos para actualizar',
          message: 'No se proporcionaron campos válidos para actualizar',
        });
      }

      updateFields.push('updated_at = NOW()');

      // Ejecutar actualización
      const [updated] = await sequelize.query(
        `
        UPDATE naxos.users
        SET ${updateFields.join(', ')}
        WHERE user_id = :userId
        RETURNING user_id, username, email, name, role, is_active, created_at, updated_at
        `,
        { replacements: updateValues }
      );

      const updatedUser = updated[0];

      return res.status(200).json({
        message: 'Usuario actualizado exitosamente',
        user: updatedUser,
      });
    } catch (err) {
      console.error('Error actualizando usuario:', err);
      return res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo actualizar el usuario',
      });
    }
  }

  // Eliminar usuario (solo para ADMIN)
  static async deleteUser(req, res) {
    try {
      const { userId } = req.params;

      // Verificar si el usuario existe
      const [existingUser] = await sequelize.query(
        `
        SELECT user_id, username
        FROM naxos.users
        WHERE user_id = :userId
        LIMIT 1
        `,
        { replacements: { userId } }
      );

      if (!existingUser || existingUser.length === 0) {
        return res.status(404).json({
          error: 'Usuario no encontrado',
          message: 'El usuario especificado no existe',
        });
      }

      // Evitar que un usuario se elimine a sí mismo
      const currentUserId = req.user?.user_id || req.user?.userId;
      if (userId === currentUserId) {
        return res.status(400).json({
          error: 'Operación no permitida',
          message: 'No puedes eliminar tu propio usuario',
        });
      }

      // Eliminar usuario
      await sequelize.query(
        `
        DELETE FROM naxos.users
        WHERE user_id = :userId
        `,
        { replacements: { userId } }
      );

      return res.status(200).json({
        message: 'Usuario eliminado exitosamente',
      });
    } catch (err) {
      console.error('Error eliminando usuario:', err);
      return res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo eliminar el usuario',
      });
    }
  }
}

module.exports = AuthController;
