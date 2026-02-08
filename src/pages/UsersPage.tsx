import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUsers } from '@/hooks/useUsers';
import { usePlans } from '@/hooks/usePlans';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Users, MoreHorizontal, Shield, ShieldOff, Trash2, UserPlus, Loader2, Crown } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { usersApi } from '@/lib/apiClient';
import { toast } from '@/hooks/use-toast';

const UsersPage = () => {
  const { user: currentUser } = useAuth();
  const { users, updateUser, deleteUser, refetch } = useUsers();
  const { plans } = usePlans();
  const [userUsage, setUserUsage] = useState<Record<string, any>>({});
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user',
    planId: 'free',
  });

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd/MM/yyyy", { locale: ptBR });
  };

  const getPlanName = (planId: string) => {
    const plan = plans.find(p => p.id === planId);
    return plan?.name || planId;
  };

  const getPlanLimits = (planId: string) => {
    return plans.find(p => p.id === planId);
  };

  const changePlan = (userId: string, planId: string) => {
    updateUser(userId, { planId });
  };

  const toggleRole = (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    updateUser(userId, { role: newRole });
  };

  const getUserUsage = (userId: string) => {
    return userUsage[userId] || null;
  };

  const handleCreateUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.password) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    try {
      await usersApi.create(newUser);
      toast({
        title: 'Usuário criado',
        description: `${newUser.name} foi criado com sucesso`,
      });
      setIsCreateOpen(false);
      setNewUser({ name: '', email: '', password: '', role: 'user', planId: 'free' });
      refetch();
    } catch (error) {
      toast({
        title: 'Erro ao criar usuário',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const getRoleBadge = (role: 'superadmin' | 'admin' | 'user') => {
    switch (role) {
      case 'superadmin':
        return <Badge variant="default" className="bg-amber-500 hover:bg-amber-600"><Crown className="h-3 w-3 mr-1" />Super</Badge>;
      case 'admin':
        return <Badge variant="default"><Shield className="h-3 w-3 mr-1" />Admin</Badge>;
      default:
        return null;
    }
  };

  // Verificar se tem permissão
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
  const isSuperAdmin = currentUser?.role === 'superadmin';

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Acesso Restrito</CardTitle>
            <CardDescription>
              Você não tem permissão para acessar esta página
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gerenciar Usuários</h1>
          <p className="text-muted-foreground">
            {isSuperAdmin ? 'Visualize e gerencie todos os usuários' : 'Visualize e gerencie os usuários que você criou'}
          </p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Novo Usuário</DialogTitle>
              <DialogDescription>
                Preencha os dados para criar um novo usuário
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={newUser.name}
                  onChange={(e) => setNewUser(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Nome completo"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="email@exemplo.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha *</Label>
                <Input
                  id="password"
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Senha segura"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Plano</Label>
                  <Select
                    value={newUser.planId}
                    onValueChange={(value) => setNewUser(prev => ({ ...prev, planId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {plans.filter(p => p.isActive).map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Papel</Label>
                  <Select
                    value={newUser.role}
                    onValueChange={(value) => setNewUser(prev => ({ ...prev, role: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">Usuário</SelectItem>
                      {isSuperAdmin && <SelectItem value="admin">Admin</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateUser} disabled={isCreating}>
                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar Usuário
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Usuários ({users.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Uso do Mês</TableHead>
                <TableHead>Cadastro</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const usage = getUserUsage(user.id);
                const planLimits = getPlanLimits(user.planId);
                const canEdit = isSuperAdmin || user.createdBy === currentUser?.id;
                
                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="font-medium">{user.name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                        {getRoleBadge(user.role)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={user.planId}
                        onValueChange={(value) => changePlan(user.id, value)}
                        disabled={!canEdit}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {plans.filter(p => p.isActive).map((plan) => (
                            <SelectItem key={plan.id} value={plan.id}>
                              {plan.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {usage && planLimits ? (
                        <div className="space-y-1 w-48">
                          <div className="flex justify-between text-xs">
                            <span>Pesquisas</span>
                            <span>{usage.searchesUsed}/{planLimits.monthlySearches}</span>
                          </div>
                          <Progress 
                            value={(usage.searchesUsed / planLimits.monthlySearches) * 100} 
                            className="h-1"
                          />
                          <div className="flex justify-between text-xs">
                            <span>Leads</span>
                            <span>{usage.leadsExtracted}/{planLimits.monthlyLeads}</span>
                          </div>
                          <Progress 
                            value={(usage.leadsExtracted / planLimits.monthlyLeads) * 100} 
                            className="h-1"
                          />
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Sem uso</span>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(user.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      {canEdit && user.role !== 'superadmin' && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {isSuperAdmin && (
                              <DropdownMenuItem onClick={() => toggleRole(user.id, user.role)}>
                                {user.role === 'admin' ? (
                                  <>
                                    <ShieldOff className="mr-2 h-4 w-4" />
                                    Remover Admin
                                  </>
                                ) : (
                                  <>
                                    <Shield className="mr-2 h-4 w-4" />
                                    Tornar Admin
                                  </>
                                )}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => deleteUser(user.id)}
                              className="text-destructive"
                              disabled={user.id === currentUser?.id}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Excluir Usuário
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum usuário cadastrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default UsersPage;
