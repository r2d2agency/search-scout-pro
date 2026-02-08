const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function initDatabase() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('🔄 Verificando banco de dados...');

    // PRIMEIRO: Adicionar coluna created_by se não existir (antes do schema)
    try {
      await pool.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by UUID;
      `);
      console.log('✅ Coluna created_by verificada');
    } catch (e) {
      // Tabela pode não existir ainda, ignorar
      console.log('ℹ️ Tabela users ainda não existe, será criada pelo schema');
    }

    // Atualizar constraint de role se necessário (antes do schema)
    try {
      await pool.query(`
        ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
        ALTER TABLE users ADD CONSTRAINT users_role_check 
          CHECK (role IN ('superadmin', 'admin', 'user'));
      `);
      console.log('✅ Constraint de role atualizada');
    } catch (e) {
      // Ignorar se tabela não existe
    }

    // Ler e executar o schema (usa IF NOT EXISTS para ser seguro)
    const schemaPath = path.join(__dirname, '..', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    await pool.query(schema);
    console.log('✅ Schema verificado/atualizado');

    // Criar índice para created_by
    try {
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_users_created_by ON users(created_by);
      `);
    } catch (e) {
      // Ignorar
    }

    // Verificar se existe um superadmin
    const superadminCheck = await pool.query(
      "SELECT id FROM users WHERE role = 'superadmin' LIMIT 1"
    );

    if (superadminCheck.rows.length === 0) {
      // Promover o primeiro usuário registrado ou o tnicodemos@gmail.com
      const targetEmail = process.env.SUPERADMIN_EMAIL || 'tnicodemos@gmail.com';
      
      const updateResult = await pool.query(
        "UPDATE users SET role = 'superadmin' WHERE email = $1 RETURNING email",
        [targetEmail]
      );

      if (updateResult.rows.length > 0) {
        console.log(`✅ Usuário ${targetEmail} promovido a superadmin`);
      } else {
        // Se não encontrou, promover o primeiro usuário
        const firstUserResult = await pool.query(
          "UPDATE users SET role = 'superadmin' WHERE id = (SELECT id FROM users ORDER BY created_at LIMIT 1) RETURNING email"
        );
        
        if (firstUserResult.rows.length > 0) {
          console.log(`✅ Primeiro usuário (${firstUserResult.rows[0].email}) promovido a superadmin`);
        }
      }
    } else {
      console.log('✅ Superadmin já existe');
    }

    console.log('✅ Banco de dados inicializado com sucesso!');
    await pool.end();
  } catch (error) {
    console.error('❌ Erro ao inicializar banco:', error.message);
    await pool.end();
    process.exit(1);
  }
}

initDatabase();
