const express = require('express');
const db = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Listar todos os planos
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM plans ORDER BY price ASC'
    );

    const plans = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      monthlySearches: row.monthly_searches,
      monthlyLeads: row.monthly_leads,
      whatsappVerifications: row.whatsapp_verifications,
      price: parseFloat(row.price),
      features: row.features,
      isActive: row.is_active,
      createdAt: row.created_at
    }));

    res.json(plans);
  } catch (error) {
    console.error('Erro ao listar planos:', error);
    res.status(500).json({ message: 'Erro ao buscar planos' });
  }
});

// Criar plano (admin only)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { 
      name, description, monthlySearches, monthlyLeads, 
      whatsappVerifications, price, features, isActive 
    } = req.body;

    const id = name.toLowerCase().replace(/\s+/g, '-');

    const result = await db.query(
      `INSERT INTO plans (id, name, description, monthly_searches, monthly_leads, 
        whatsapp_verifications, price, features, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [id, name, description, monthlySearches, monthlyLeads, 
       whatsappVerifications, price, JSON.stringify(features), isActive ?? true]
    );

    const plan = result.rows[0];
    res.status(201).json({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      monthlySearches: plan.monthly_searches,
      monthlyLeads: plan.monthly_leads,
      whatsappVerifications: plan.whatsapp_verifications,
      price: parseFloat(plan.price),
      features: plan.features,
      isActive: plan.is_active,
      createdAt: plan.created_at
    });
  } catch (error) {
    console.error('Erro ao criar plano:', error);
    res.status(500).json({ message: 'Erro ao criar plano' });
  }
});

// Atualizar plano (admin only)
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, description, monthlySearches, monthlyLeads, 
      whatsappVerifications, price, features, isActive 
    } = req.body;

    const result = await db.query(
      `UPDATE plans SET 
        name = $1, description = $2, monthly_searches = $3, monthly_leads = $4,
        whatsapp_verifications = $5, price = $6, features = $7, is_active = $8
       WHERE id = $9
       RETURNING *`,
      [name, description, monthlySearches, monthlyLeads, 
       whatsappVerifications, price, JSON.stringify(features), isActive, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Plano não encontrado' });
    }

    const plan = result.rows[0];
    res.json({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      monthlySearches: plan.monthly_searches,
      monthlyLeads: plan.monthly_leads,
      whatsappVerifications: plan.whatsapp_verifications,
      price: parseFloat(plan.price),
      features: plan.features,
      isActive: plan.is_active,
      createdAt: plan.created_at
    });
  } catch (error) {
    console.error('Erro ao atualizar plano:', error);
    res.status(500).json({ message: 'Erro ao atualizar plano' });
  }
});

// Deletar plano (admin only)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (id === 'free') {
      return res.status(400).json({ message: 'O plano gratuito não pode ser removido' });
    }

    // Verificar se há usuários usando o plano
    const usersWithPlan = await db.query(
      'SELECT COUNT(*) FROM users WHERE plan_id = $1',
      [id]
    );

    if (parseInt(usersWithPlan.rows[0].count) > 0) {
      return res.status(400).json({ 
        message: 'Não é possível remover um plano com usuários ativos' 
      });
    }

    const result = await db.query('DELETE FROM plans WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Plano não encontrado' });
    }

    res.json({ message: 'Plano removido com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar plano:', error);
    res.status(500).json({ message: 'Erro ao remover plano' });
  }
});

module.exports = router;
