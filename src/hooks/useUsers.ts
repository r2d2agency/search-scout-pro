import { useState, useCallback, useEffect } from 'react';
import { User } from '@/types/user';
import { toast } from '@/hooks/use-toast';
import { usersApi } from '@/lib/apiClient';

export function useUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadUsers = useCallback(async () => {
    try {
      const data = await usersApi.list();
      setUsers(data);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar usuários',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const updateUser = useCallback(async (id: string, updates: Partial<User>) => {
    try {
      const updatedUser = await usersApi.update(id, updates);
      setUsers(prev => prev.map(u => u.id === id ? updatedUser : u));
      
      toast({
        title: 'Usuário atualizado',
        description: 'As alterações foram salvas',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar usuário',
        description: error.message,
        variant: 'destructive',
      });
    }
  }, []);

  const deleteUser = useCallback(async (id: string) => {
    const user = users.find(u => u.id === id);
    if (!user) return;

    try {
      await usersApi.delete(id);
      setUsers(prev => prev.filter(u => u.id !== id));
      
      toast({
        title: 'Usuário removido',
        description: `O usuário "${user.name}" foi removido`,
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao remover usuário',
        description: error.message,
        variant: 'destructive',
      });
    }
  }, [users]);

  return {
    users,
    isLoading,
    updateUser,
    deleteUser,
    refetch: loadUsers,
  };
}
