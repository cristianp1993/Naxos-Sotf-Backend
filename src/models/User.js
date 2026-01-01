const bcrypt = require('bcryptjs');
const { query } = require('../config/database');

/**
 * Modelo User para el Sistema POS Naxos
 * Maneja todas las operaciones relacionadas con usuarios
 */
class User {
  
  /**
   * Crear un nuevo usuario
   * @param {Object} userData - Datos del usuario
   * @param {string} userData.username - Nombre de usuario
   * @param {string} userData.email - Email del usuario
   * @param {string} userData.password - Contraseña en texto plano
   * @param {string} userData.role - Rol del usuario (ADMIN, MANAGER, CASHIER, VIEWER)
   * @param {boolean} userData.is_active - Si el usuario está activo
   * @returns {Object} Usuario creado
   */
  static async create(userData) {
    try {
      const { username, email, password, role = 'CASHIER', is_active = true } = userData;
      
      // Verificar si el usuario ya existe
      const existingUser = await query(
        'SELECT user_id FROM naxos.users WHERE username = $1 OR email = $2',
        [username, email]
      );

      if (existingUser.rows.length > 0) {
        throw new Error('El usuario ya existe');
      }

      // Encriptar contraseña
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Crear usuario
      const newUserResult = await query(
        `INSERT INTO naxos.users (username, email, password_hash, role, is_active) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING user_id, username, email, role, is_active, created_at, updated_at`,
        [username, email, passwordHash, role, is_active]
      );

      return newUserResult.rows[0];

    } catch (error) {
      console.error('Error creando usuario:', error);
      throw error;
    }
  }

  /**
   * Buscar usuario por ID
   * @param {number} userId - ID del usuario
   * @returns {Object|null} Usuario encontrado o null
   */
  static async findById(userId) {
    try {
      const result = await query(
        'SELECT user_id, username, email, role, is_active, created_at, updated_at FROM naxos.users WHERE user_id = $1',
        [userId]
      );

      return result.rows[0] || null;
    } catch (error) {
      console.error('Error buscando usuario por ID:', error);
      throw error;
    }
  }

  /**
   * Buscar usuario por username
   * @param {string} username - Nombre de usuario
   * @returns {Object|null} Usuario encontrado o null
   */
  static async findByUsername(username) {
    try {
      const result = await query(
        'SELECT user_id, username, email, password_hash, role, is_active, created_at, updated_at FROM naxos.users WHERE username = $1',
        [username]
      );

      return result.rows[0] || null;
    } catch (error) {
      console.error('Error buscando usuario por username:', error);
      throw error;
    }
  }

  /**
   * Verificar credenciales de usuario
   * @param {string} username - Nombre de usuario
   * @param {string} password - Contraseña en texto plano
   * @returns {Object|null} Usuario si las credenciales son válidas, null si no
   */
  static async authenticate(username, password) {
    try {
      const user = await this.findByUsername(username);
      
      if (!user || !user.is_active) {
        return null;
      }

      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        return null;
      }

      // Remover password_hash del objeto de respuesta
      const { password_hash, ...userWithoutPassword } = user;
      return userWithoutPassword;
    } catch (error) {
      console.error('Error autenticando usuario:', error);
      throw error;
    }
  }

  /**
   * Listar todos los usuarios
   * @param {Object} options - Opciones de paginación
   * @param {number} options.page - Página (default: 1)
   * @param {number} options.limit - Límite por página (default: 10)
   * @returns {Object} Lista de usuarios con información de paginación
   */
  static async findAll(options = {}) {
    try {
      const page = parseInt(options.page) || 1;
      const limit = parseInt(options.limit) || 10;
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

      return {
        users: usersResult.rows,
        pagination: {
          current_page: page,
          per_page: limit,
          total,
          total_pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('Error listando usuarios:', error);
      throw error;
    }
  }

  /**
   * Actualizar usuario
   * @param {number} userId - ID del usuario
   * @param {Object} updateData - Datos a actualizar
   * @returns {Object} Usuario actualizado
   */
  static async update(userId, updateData) {
    try {
      const allowedFields = ['username', 'email', 'password', 'role', 'is_active'];
      const updateFields = [];
      const values = [];
      let paramCount = 1;

      // Construir query dinámica
      for (const [key, value] of Object.entries(updateData)) {
        if (allowedFields.includes(key)) {
          if (key === 'password') {
            // Encriptar nueva contraseña si se proporciona
            const saltRounds = 12;
            const passwordHash = await bcrypt.hash(value, saltRounds);
            updateFields.push(`password_hash = $${paramCount++}`);
            values.push(passwordHash);
          } else {
            updateFields.push(`${key} = $${paramCount++}`);
            values.push(value);
          }
        }
      }

      if (updateFields.length === 0) {
        throw new Error('No hay campos válidos para actualizar');
      }

      // Agregar updated_at
      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

      values.push(userId);

      const queryText = `
        UPDATE naxos.users 
        SET ${updateFields.join(', ')} 
        WHERE user_id = $${paramCount} 
        RETURNING user_id, username, email, role, is_active, created_at, updated_at
      `;

      const result = await query(queryText, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error actualizando usuario:', error);
      throw error;
    }
  }

  /**
   * Eliminar usuario (soft delete)
   * @param {number} userId - ID del usuario
   * @returns {boolean} true si se eliminó correctamente
   */
  static async delete(userId) {
    try {
      // Soft delete: marcar como inactivo
      await query(
        'UPDATE naxos.users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1',
        [userId]
      );

      return true;
    } catch (error) {
      console.error('Error eliminando usuario:', error);
      throw error;
    }
  }

  /**
   * Cambiar contraseña
   * @param {number} userId - ID del usuario
   * @param {string} newPassword - Nueva contraseña
   * @returns {boolean} true si se cambió correctamente
   */
  static async changePassword(userId, newPassword) {
    try {
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(newPassword, saltRounds);

      await query(
        'UPDATE naxos.users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
        [passwordHash, userId]
      );

      return true;
    } catch (error) {
      console.error('Error cambiando contraseña:', error);
      throw error;
    }
  }
}

module.exports = User;
