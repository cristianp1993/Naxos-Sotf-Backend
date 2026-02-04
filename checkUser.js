const { sequelize } = require('./src/config/database-sequelize');

async function checkUser() {
  try {
    const [users] = await sequelize.query('SELECT user_id, username, email, role, is_active FROM naxos.users LIMIT 5');
    console.log('Usuarios en la base de datos:');
    console.table(users);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkUser();
