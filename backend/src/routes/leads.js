const express = require('express');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Helper para incrementar uso
async function incrementUsage(userId, type, count = 1) {
  const month = new Date().toISOString().slice(0, 7);
  
  await db.query(
    `INSERT INTO user_usage (user_id, month, searches_used, leads_extracted, whatsapp_verified)
     VALUES ($1, $2, 0, 0, 0)
     ON CONFLICT (user_id, month) DO NOTHING`,
    [userId, month]
  );

  const column = type === 'search' ? 'searches_used' : 
                 type === 'leads' ? 'leads_extracted' : 'whatsapp_verified';
  
  await db.query(
    `UPDATE user_usage SET ${column} = ${column} + $1 WHERE user_id = $2 AND month = $3`,
    [count, userId, month]
  );
}

// Helper para verificar limite
async function checkLimit(userId, type, count = 1) {
  const month = new Date().toISOString().slice(0, 7);
  
  const userResult = await db.query('SELECT plan_id FROM users WHERE id = $1', [userId]);
  const planId = userResult.rows[0]?.plan_id || 'free';
  
  const planResult = await db.query(
    'SELECT monthly_searches, monthly_leads, whatsapp_verifications FROM plans WHERE id = $1',
    [planId]
  );
  
  const plan = planResult.rows[0];
  const limit = type === 'search' ? plan.monthly_searches :
                type === 'leads' ? plan.monthly_leads : plan.whatsapp_verifications;
  
  const usageResult = await db.query(
    `SELECT searches_used, leads_extracted, whatsapp_verified FROM user_usage 
     WHERE user_id = $1 AND month = $2`,
    [userId, month]
  );
  
  const usage = usageResult.rows[0] || { searches_used: 0, leads_extracted: 0, whatsapp_verified: 0 };
  const used = type === 'search' ? usage.searches_used :
               type === 'leads' ? usage.leads_extracted : usage.whatsapp_verified;
  
  return (used + count) <= limit;
}

// Listar leads do usuário
router.get('/', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 30 } = req.query;
    const offset = (page - 1) * limit;

    const result = await db.query(
      `SELECT * FROM leads WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );

    const countResult = await db.query(
      'SELECT COUNT(*) FROM leads WHERE user_id = $1',
      [req.user.id]
    );

    const leads = result.rows.map(row => ({
      id: row.id,
      company: row.company,
      website: row.website,
      phone: row.phone,
      whatsapp: row.whatsapp,
      email: row.email,
      whatsappValid: row.whatsapp_valid,
      source: row.source,
      searchTerm: row.search_term,
      createdAt: row.created_at
    }));

    res.json({
      leads,
      total: parseInt(countResult.rows[0].count)
    });
  } catch (error) {
    console.error('Erro ao listar leads:', error);
    res.status(500).json({ message: 'Erro ao buscar leads' });
  }
});

// Salvar lead
router.post('/', authenticate, async (req, res) => {
  try {
    const canSave = await checkLimit(req.user.id, 'leads', 1);
    if (!canSave) {
      return res.status(403).json({ message: 'Limite de leads atingido para este mês' });
    }

    const { company, website, phone, whatsapp, email, whatsappValid, source, searchTerm } = req.body;

    const result = await db.query(
      `INSERT INTO leads (user_id, company, website, phone, whatsapp, email, whatsapp_valid, source, search_term)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [req.user.id, company, website, phone, whatsapp, email, whatsappValid, source, searchTerm]
    );

    await incrementUsage(req.user.id, 'leads', 1);

    const lead = result.rows[0];
    res.status(201).json({
      id: lead.id,
      company: lead.company,
      website: lead.website,
      phone: lead.phone,
      whatsapp: lead.whatsapp,
      email: lead.email,
      whatsappValid: lead.whatsapp_valid,
      source: lead.source,
      searchTerm: lead.search_term,
      createdAt: lead.created_at
    });
  } catch (error) {
    console.error('Erro ao salvar lead:', error);
    res.status(500).json({ message: 'Erro ao salvar lead' });
  }
});

// Salvar múltiplos leads
router.post('/bulk', authenticate, async (req, res) => {
  try {
    const { leads } = req.body;
    const count = leads.length;

    const canSave = await checkLimit(req.user.id, 'leads', count);
    if (!canSave) {
      return res.status(403).json({ message: 'Limite de leads atingido para este mês' });
    }

    const savedLeads = [];
    for (const lead of leads) {
      const result = await db.query(
        `INSERT INTO leads (user_id, company, website, phone, whatsapp, email, whatsapp_valid, source, search_term)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [req.user.id, lead.company, lead.website, lead.phone, lead.whatsapp, 
         lead.email, lead.whatsappValid, lead.source, lead.searchTerm]
      );
      savedLeads.push(result.rows[0]);
    }

    await incrementUsage(req.user.id, 'leads', count);

    res.status(201).json(savedLeads.map(lead => ({
      id: lead.id,
      company: lead.company,
      website: lead.website,
      phone: lead.phone,
      whatsapp: lead.whatsapp,
      email: lead.email,
      whatsappValid: lead.whatsapp_valid,
      source: lead.source,
      searchTerm: lead.search_term,
      createdAt: lead.created_at
    })));
  } catch (error) {
    console.error('Erro ao salvar leads:', error);
    res.status(500).json({ message: 'Erro ao salvar leads' });
  }
});

// Deletar lead
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM leads WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Lead não encontrado' });
    }

    res.json({ message: 'Lead removido com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar lead:', error);
    res.status(500).json({ message: 'Erro ao remover lead' });
  }
});

// Verificar limite antes de pesquisar
router.post('/check-limit', authenticate, async (req, res) => {
  try {
    const { type, count = 1 } = req.body;
    const canProceed = await checkLimit(req.user.id, type, count);
    res.json({ allowed: canProceed });
  } catch (error) {
    console.error('Erro ao verificar limite:', error);
    res.status(500).json({ message: 'Erro ao verificar limite' });
  }
});

module.exports = router;
