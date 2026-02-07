import { useState, useCallback, useEffect } from 'react';
import { Plan } from '@/types/user';
import { toast } from '@/hooks/use-toast';

const PLANS_KEY = 'lead_extractor_plans';

export function usePlans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = () => {
    const saved = localStorage.getItem(PLANS_KEY);
    if (saved) {
      setPlans(JSON.parse(saved));
    }
    setIsLoading(false);
  };

  const savePlans = (newPlans: Plan[]) => {
    localStorage.setItem(PLANS_KEY, JSON.stringify(newPlans));
    setPlans(newPlans);
  };

  const createPlan = useCallback((plan: Omit<Plan, 'id' | 'createdAt'>) => {
    const newPlan: Plan = {
      ...plan,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    
    savePlans([...plans, newPlan]);
    
    toast({
      title: 'Plano criado',
      description: `O plano "${plan.name}" foi criado com sucesso`,
    });
    
    return newPlan;
  }, [plans]);

  const updatePlan = useCallback((id: string, updates: Partial<Plan>) => {
    const newPlans = plans.map(p => 
      p.id === id ? { ...p, ...updates } : p
    );
    savePlans(newPlans);
    
    toast({
      title: 'Plano atualizado',
      description: 'As alterações foram salvas',
    });
  }, [plans]);

  const deletePlan = useCallback((id: string) => {
    const plan = plans.find(p => p.id === id);
    if (!plan) return;
    
    // Não permitir deletar plano gratuito
    if (id === 'free') {
      toast({
        title: 'Ação não permitida',
        description: 'O plano gratuito não pode ser removido',
        variant: 'destructive',
      });
      return;
    }
    
    savePlans(plans.filter(p => p.id !== id));
    
    toast({
      title: 'Plano removido',
      description: `O plano "${plan.name}" foi removido`,
    });
  }, [plans]);

  const togglePlanStatus = useCallback((id: string) => {
    const newPlans = plans.map(p => 
      p.id === id ? { ...p, isActive: !p.isActive } : p
    );
    savePlans(newPlans);
  }, [plans]);

  return {
    plans,
    isLoading,
    createPlan,
    updatePlan,
    deletePlan,
    togglePlanStatus,
  };
}
