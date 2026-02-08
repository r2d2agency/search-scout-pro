import { useState, useCallback, useEffect } from 'react';
import { Plan } from '@/types/user';
import { toast } from '@/hooks/use-toast';
import { plansApi } from '@/lib/apiClient';

export function usePlans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadPlans = useCallback(async () => {
    try {
      const data = await plansApi.list();
      setPlans(data);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar planos',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const createPlan = useCallback(async (plan: Omit<Plan, 'id' | 'createdAt'>) => {
    try {
      const newPlan = await plansApi.create(plan);
      setPlans(prev => [...prev, newPlan]);
      
      toast({
        title: 'Plano criado',
        description: `O plano "${plan.name}" foi criado com sucesso`,
      });
      
      return newPlan;
    } catch (error: any) {
      toast({
        title: 'Erro ao criar plano',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
  }, []);

  const updatePlan = useCallback(async (id: string, updates: Partial<Plan>) => {
    try {
      const updatedPlan = await plansApi.update(id, updates);
      setPlans(prev => prev.map(p => p.id === id ? updatedPlan : p));
      
      toast({
        title: 'Plano atualizado',
        description: 'As alterações foram salvas',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar plano',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
  }, []);

  const deletePlan = useCallback(async (id: string) => {
    const plan = plans.find(p => p.id === id);
    if (!plan) return;
    
    try {
      await plansApi.delete(id);
      setPlans(prev => prev.filter(p => p.id !== id));
      
      toast({
        title: 'Plano removido',
        description: `O plano "${plan.name}" foi removido`,
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao remover plano',
        description: error.message,
        variant: 'destructive',
      });
    }
  }, [plans]);

  const togglePlanStatus = useCallback(async (id: string) => {
    const plan = plans.find(p => p.id === id);
    if (!plan) return;
    
    await updatePlan(id, { isActive: !plan.isActive });
  }, [plans, updatePlan]);

  return {
    plans,
    isLoading,
    createPlan,
    updatePlan,
    deletePlan,
    togglePlanStatus,
    refetch: loadPlans,
  };
}
