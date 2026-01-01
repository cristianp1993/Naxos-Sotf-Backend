const bcrypt = require('bcryptjs');
const { query } = require('../src/config/database');

/**
 * Script para crear el primer usuario administrador
 * Credenciales:
 * - username: 1053824943
 * - email: laura.824943@gmail.com
 * - password: 123456
 * - role: ADMIN
 * - is_active: true
 */

async function createAdminUser() {
  try {
    console.log('🔄 Creando usuario administrador...');
    
    // Datos del usuario
    const userData = {
      username: '1053824943',
      email: 'laura.824943@gmail.com',
      password: '123456',
      role: 'ADMIN', // Rol en mayúsculas según el esquema de validación
      is_active: true
    };

    // Verificar si el usuario ya existe
    console.log('🔍 Verificando si el usuario ya existe...');
    const existingUser = await query(
      'SELECT user_id, username, email FROM naxos.users WHERE username = $1 OR email = $2',
      [userData.username, userData.email]
    );

    if (existingUser.rows.length > 0) {
      console.log('⚠️  El usuario ya existe:', existingUser.rows[0]);
      return;
    }

    // Encriptar contraseña
    console.log('🔐 Encriptando contraseña...');
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(userData.password, saltRounds);

    // Crear usuario
    console.log('💾 Creando usuario en la base de datos...');
    const newUserResult = await query(
      `INSERT INTO naxos.users (username, email, password_hash, role, is_active) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING user_id, username, email, role, is_active, created_at`,
      [userData.username, userData.email, passwordHash, userData.role, userData.is_active]
    );

    const newUser = newUserResult.rows[0];

    console.log('✅ Usuario administrador creado exitosamente!');
    console.log('📊 Datos del usuario creado:');
    console.log(`   - ID: ${newUser.user_id}`);
    console.log(`   - Username: ${newUser.username}`);
    console.log(`   - Email: ${newUser.email}`);
    console.log(`   - Rol: ${newUser.role}`);
    console.log(`   - Activo: ${newUser.is_active}`);
    console.log(`   - Creado: ${newUser.created_at}`);
    console.log('');
    console.log('🔑 Credenciales de acceso:');
    console.log(`   - Usuario: ${userData.username}`);
    console.log(`   - Contraseña: ${userData.password}`);
    console.log('🔒 ¡Importante! Cambia la contraseña después del primer login');

  } catch (error) {
    console.error('❌ Error creando usuario administrador:', error.message);
    console.error('Detalles del error:', error);
    process.exit(1);
  } finally {
    // Cerrar conexión a la base de datos
    const { pool } = require('../src/config/database');
    await pool.end();
    console.log('🔌 Conexión a la base de datos cerrada');
  }
}

// Ejecutar el script
if (require.main === module) {
  createAdminUser()
    .then(() => {
      console.log('🎉 Script completado exitosamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Error fatal:', error);
      process.exit(1);
    });
}

module.exports = createAdminUser;
