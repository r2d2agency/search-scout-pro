const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function initDatabase() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
  });

  try {
    // Verificar se as tabelas já existem
    const checkResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);

    if (checkResult.rows[0].exists) {
      console.log('✅ Banco de dados já inicializado');
      await pool.end();
      return;
    }

    console.log('🔄 Inicializando banco de dados...');

    // Ler e executar o schema
    const schemaPath = path.join(__dirname, '..', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    await pool.query(schema);

    console.log('✅ Schema executado com sucesso!');
    await pool.end();
  } catch (error) {
    console.error('❌ Erro ao inicializar banco:', error.message);
    await pool.end();
    process.exit(1);
  }
}

initDatabase();
