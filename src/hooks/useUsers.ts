import { useState, useCallback, useEffect } from 'react';
import { User, UserUsage } from '@/types/user';
import { toast } from '@/hooks/use-toast';

const USERS_KEY = 'lead_extractor_users';
const USAGE_KEY = 'lead_extractor_usage';

export function useUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = () => {
    const saved = localStorage.getItem(USERS_KEY);
    if (saved) {
      setUsers(JSON.parse(saved));
    }
    setIsLoading(false);
  };

  const saveUsers = (newUsers: User[]) => {
    localStorage.setItem(USERS_KEY, JSON.stringify(newUsers));
    setUsers(newUsers);
  };

  const updateUser = useCallback((id: string, updates: Partial<User>) => {
    const newUsers = users.map(u => 
      u.id === id ? { ...u, ...updates } : u
    );
    saveUsers(newUsers);
    
    toast({
      title: 'Usuário atualizado',
      description: 'As alterações foram salvas',
    });
  }, [users]);

  const deleteUser = useCallback((id: string) => {
    const user = users.find(u => u.id === id);
    if (!user) return;
    
    // Não permitir deletar o próprio usuário admin
    if (user.role === 'admin' && users.filter(u => u.role === 'admin').length <= 1) {
      toast({
        title: 'Ação não permitida',
        description: 'Não é possível remover o único administrador',
        variant: 'destructive',
      });
      return;
    }
    
    saveUsers(users.filter(u => u.id !== id));
    
    toast({
      title: 'Usuário removido',
      description: `O usuário "${user.name}" foi removido`,
    });
  }, [users]);

  const changePlan = useCallback((userId: string, planId: string) => {
    updateUser(userId, { planId });
  }, [updateUser]);

  const toggleRole = useCallback((userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    updateUser(userId, { role: newRole });
  }, [users, updateUser]);

  const getUserUsage = useCallback((userId: string): UserUsage | null => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const allUsage: UserUsage[] = JSON.parse(localStorage.getItem(USAGE_KEY) || '[]');
    return allUsage.find(u => u.userId === userId && u.month === currentMonth) || null;
  }, []);

  const resetUserUsage = useCallback((userId: string) => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const allUsage: UserUsage[] = JSON.parse(localStorage.getItem(USAGE_KEY) || '[]');
    
    const index = allUsage.findIndex(u => u.userId === userId && u.month === currentMonth);
    if (index !== -1) {
      allUsage[index] = {
        userId,
        month: currentMonth,
        searchesUsed: 0,
        leadsExtracted: 0,
        whatsappVerified: 0,
      };
      localStorage.setItem(USAGE_KEY, JSON.stringify(allUsage));
      
      toast({
        title: 'Uso resetado',
        description: 'O contador de uso foi zerado',
      });
    }
  }, []);

  return {
    users,
    isLoading,
    updateUser,
    deleteUser,
    changePlan,
    toggleRole,
    getUserUsage,
    resetUserUsage,
  };
}
