import { useState, useCallback, useEffect } from 'react';
import { UserUsage, Plan } from '@/types/user';
import { useAuth } from '@/contexts/AuthContext';
import { usersApi, plansApi, leadsApi } from '@/lib/apiClient';
import { toast } from '@/hooks/use-toast';

export function useUsage() {
  const { user } = useAuth();
  const [usage, setUsage] = useState<UserUsage | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUsage = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      const [usageData, plansData] = await Promise.all([
        usersApi.getUsage(user.id),
        plansApi.list(),
      ]);

      setUsage(usageData);
      
      const userPlan = plansData.find(p => p.id === user.planId);
      setPlan(userPlan || null);
    } catch (error: any) {
      console.error('Erro ao carregar uso:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadUsage();
  }, [loadUsage]);

  const checkLimit = useCallback(async (type: 'search' | 'leads' | 'whatsapp', count = 1): Promise<boolean> => {
    try {
      const { allowed } = await leadsApi.checkLimit(type, count);
      
      if (!allowed) {
        toast({
          title: 'Limite atingido',
          description: `Você atingiu o limite de ${type === 'search' ? 'pesquisas' : type === 'leads' ? 'leads' : 'verificações WhatsApp'} do seu plano.`,
          variant: 'destructive',
        });
      }
      
      return allowed;
    } catch (error) {
      return false;
    }
  }, []);

  const getUsagePercentage = useCallback((type: 'search' | 'leads' | 'whatsapp'): number => {
    if (!usage || !plan) return 0;

    const used = type === 'search' ? usage.searchesUsed :
                 type === 'leads' ? usage.leadsExtracted : usage.whatsappVerified;
    const limit = type === 'search' ? plan.monthlySearches :
                  type === 'leads' ? plan.monthlyLeads : plan.whatsappVerifications;

    return Math.min(100, (used / limit) * 100);
  }, [usage, plan]);

  return {
    usage,
    plan,
    isLoading,
    checkLimit,
    getUsagePercentage,
    refetch: loadUsage,
  };
}
