import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Plan, UserUsage } from '@/types/user';
import { toast } from '@/hooks/use-toast';

const USAGE_KEY = 'lead_extractor_usage';
const PLANS_KEY = 'lead_extractor_plans';

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function useUsage() {
  const { user } = useAuth();
  const [usage, setUsage] = useState<UserUsage | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);

  useEffect(() => {
    if (!user) {
      setUsage(null);
      setPlan(null);
      return;
    }

    // Carregar plano do usuário
    const plans: Plan[] = JSON.parse(localStorage.getItem(PLANS_KEY) || '[]');
    const userPlan = plans.find(p => p.id === user.planId);
    setPlan(userPlan || null);

    // Carregar ou criar uso do mês atual
    const currentMonth = getCurrentMonth();
    const allUsage: UserUsage[] = JSON.parse(localStorage.getItem(USAGE_KEY) || '[]');
    let userUsage = allUsage.find(u => u.userId === user.id && u.month === currentMonth);

    if (!userUsage) {
      userUsage = {
        userId: user.id,
        month: currentMonth,
        searchesUsed: 0,
        leadsExtracted: 0,
        whatsappVerified: 0,
      };
      allUsage.push(userUsage);
      localStorage.setItem(USAGE_KEY, JSON.stringify(allUsage));
    }

    setUsage(userUsage);
  }, [user]);

  const updateUsage = useCallback((updates: Partial<UserUsage>) => {
    if (!user || !usage) return;

    const allUsage: UserUsage[] = JSON.parse(localStorage.getItem(USAGE_KEY) || '[]');
    const index = allUsage.findIndex(u => u.userId === user.id && u.month === usage.month);
    
    if (index !== -1) {
      allUsage[index] = { ...allUsage[index], ...updates };
      localStorage.setItem(USAGE_KEY, JSON.stringify(allUsage));
      setUsage(allUsage[index]);
    }
  }, [user, usage]);

  const canSearch = useCallback((): boolean => {
    if (!usage || !plan) return false;
    return usage.searchesUsed < plan.monthlySearches;
  }, [usage, plan]);

  const canExtractLeads = useCallback((count: number = 1): boolean => {
    if (!usage || !plan) return false;
    return usage.leadsExtracted + count <= plan.monthlyLeads;
  }, [usage, plan]);

  const canVerifyWhatsApp = useCallback((count: number = 1): boolean => {
    if (!usage || !plan) return false;
    return usage.whatsappVerified + count <= plan.whatsappVerifications;
  }, [usage, plan]);

  const incrementSearch = useCallback(() => {
    if (!usage) return;
    updateUsage({ searchesUsed: usage.searchesUsed + 1 });
  }, [usage, updateUsage]);

  const incrementLeads = useCallback((count: number) => {
    if (!usage) return;
    updateUsage({ leadsExtracted: usage.leadsExtracted + count });
  }, [usage, updateUsage]);

  const incrementWhatsApp = useCallback((count: number = 1) => {
    if (!usage) return;
    updateUsage({ whatsappVerified: usage.whatsappVerified + count });
  }, [usage, updateUsage]);

  const checkLimit = useCallback((type: 'search' | 'leads' | 'whatsapp', count: number = 1): boolean => {
    let allowed = false;
    let limitName = '';
    
    switch (type) {
      case 'search':
        allowed = canSearch();
        limitName = 'pesquisas';
        break;
      case 'leads':
        allowed = canExtractLeads(count);
        limitName = 'leads';
        break;
      case 'whatsapp':
        allowed = canVerifyWhatsApp(count);
        limitName = 'verificações WhatsApp';
        break;
    }

    if (!allowed) {
      toast({
        title: 'Limite atingido',
        description: `Você atingiu o limite de ${limitName} do seu plano. Faça upgrade para continuar.`,
        variant: 'destructive',
      });
    }

    return allowed;
  }, [canSearch, canExtractLeads, canVerifyWhatsApp]);

  const getUsagePercentage = useCallback((type: 'search' | 'leads' | 'whatsapp'): number => {
    if (!usage || !plan) return 0;
    
    switch (type) {
      case 'search':
        return (usage.searchesUsed / plan.monthlySearches) * 100;
      case 'leads':
        return (usage.leadsExtracted / plan.monthlyLeads) * 100;
      case 'whatsapp':
        return (usage.whatsappVerified / plan.whatsappVerifications) * 100;
      default:
        return 0;
    }
  }, [usage, plan]);

  return {
    usage,
    plan,
    canSearch,
    canExtractLeads,
    canVerifyWhatsApp,
    incrementSearch,
    incrementLeads,
    incrementWhatsApp,
    checkLimit,
    getUsagePercentage,
  };
}
