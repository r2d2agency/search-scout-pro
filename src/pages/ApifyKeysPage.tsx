import { useState, useEffect } from 'react';
import { Key, Plus, Trash2, Edit2, RotateCcw, Loader2, Instagram } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { apifyKeysApi } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';

interface ApifyKey {
  id: string;
  name: string;
  api_key_masked: string;
  is_active: boolean;
  usage_count: number;
  monthly_limit: number;
  last_used_at: string | null;
  created_at: string;
}

export default function ApifyKeysPage() {
  const { user } = useAuth();
  const [keys, setKeys] = useState<ApifyKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<ApifyKey | null>(null);
  
  // Form state
  const [formName, setFormName] = useState('');
  const [formApiKey, setFormApiKey] = useState('');
  const [formMonthlyLimit, setFormMonthlyLimit] = useState('100');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user?.role === 'superadmin') {
      loadKeys();
    }
  }, [user]);

  const loadKeys = async () => {
    try {
      const data = await apifyKeysApi.list();
      setKeys(data);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar chaves',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Verificar se é superadmin
  if (user?.role !== 'superadmin') {
    return <Navigate to="/" replace />;
  }

  const handleOpenDialog = (key?: ApifyKey) => {
    if (key) {
      setEditingKey(key);
      setFormName(key.name);
      setFormApiKey('');
      setFormMonthlyLimit(key.monthly_limit.toString());
    } else {
      setEditingKey(null);
      setFormName('');
      setFormApiKey('');
      setFormMonthlyLimit('100');
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast({ title: 'Nome é obrigatório', variant: 'destructive' });
      return;
    }
    if (!editingKey && !formApiKey.trim()) {
      toast({ title: 'API Key é obrigatória', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      if (editingKey) {
        await apifyKeysApi.update(editingKey.id, {
          name: formName,
          ...(formApiKey && { apiKey: formApiKey }),
          monthlyLimit: parseInt(formMonthlyLimit),
        });
        toast({ title: 'Chave atualizada com sucesso!' });
      } else {
        await apifyKeysApi.create({
          name: formName,
          apiKey: formApiKey,
          monthlyLimit: parseInt(formMonthlyLimit),
        });
        toast({ title: 'Chave adicionada com sucesso!' });
      }
      
      setIsDialogOpen(false);
      loadKeys();
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (key: ApifyKey) => {
    try {
      await apifyKeysApi.update(key.id, { isActive: !key.is_active });
      loadKeys();
      toast({ 
        title: key.is_active ? 'Chave desativada' : 'Chave ativada',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (key: ApifyKey) => {
    if (!confirm(`Tem certeza que deseja remover a chave "${key.name}"?`)) {
      return;
    }

    try {
      await apifyKeysApi.delete(key.id);
      loadKeys();
      toast({ title: 'Chave removida com sucesso!' });
    } catch (error: any) {
      toast({
        title: 'Erro ao remover',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleResetUsage = async () => {
    if (!confirm('Tem certeza que deseja resetar os contadores de uso de todas as chaves?')) {
      return;
    }

    try {
      await apifyKeysApi.resetUsage();
      loadKeys();
      toast({ title: 'Contadores resetados com sucesso!' });
    } catch (error: any) {
      toast({
        title: 'Erro ao resetar',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const totalUsage = keys.reduce((acc, k) => acc + k.usage_count, 0);
  const totalLimit = keys.reduce((acc, k) => acc + k.monthly_limit, 0);
  const activeKeys = keys.filter(k => k.is_active).length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight neon-text-cyan flex items-center gap-2">
            <Instagram className="h-8 w-8" />
            Chaves Apify (Instagram)
          </h1>
          <p className="text-muted-foreground">Gerencie múltiplas chaves com rotação automática para buscas no Instagram</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleResetUsage}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Resetar Uso
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Chave
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingKey ? 'Editar Chave' : 'Nova Chave Apify'}</DialogTitle>
                <DialogDescription>
                  {editingKey 
                    ? 'Atualize as informações da chave. Deixe a API Key em branco para manter a atual.'
                    : 'Adicione uma nova chave do Apify para o sistema usar nas pesquisas do Instagram.'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Chave</Label>
                  <Input
                    id="name"
                    placeholder="Ex: Conta Principal, Backup 1..."
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apiKey">
                    API Token {editingKey && '(deixe em branco para manter)'}
                  </Label>
                  <Input
                    id="apiKey"
                    type="password"
                    placeholder="Seu token do Apify (apify_api_...)"
                    value={formApiKey}
                    onChange={(e) => setFormApiKey(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Encontre seu token em: apify.com → Settings → Integrations → API Token
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="limit">Limite Mensal de Buscas</Label>
                  <Input
                    id="limit"
                    type="number"
                    placeholder="100"
                    value={formMonthlyLimit}
                    onChange={(e) => setFormMonthlyLimit(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Plano Free do Apify: ~$5/mês ≈ 500-1000 buscas
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingKey ? 'Salvar' : 'Adicionar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="neon-border">
          <CardHeader className="pb-2">
            <CardDescription>Total de Chaves</CardDescription>
            <CardTitle className="text-2xl">{keys.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {activeKeys} ativas, {keys.length - activeKeys} inativas
            </p>
          </CardContent>
        </Card>
        
        <Card className="neon-border">
          <CardHeader className="pb-2">
            <CardDescription>Uso Total do Mês</CardDescription>
            <CardTitle className="text-2xl">{totalUsage} / {totalLimit}</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress 
              value={totalLimit > 0 ? (totalUsage / totalLimit) * 100 : 0} 
              className="h-2"
            />
          </CardContent>
        </Card>
        
        <Card className="neon-border">
          <CardHeader className="pb-2">
            <CardDescription>Capacidade Disponível</CardDescription>
            <CardTitle className="text-2xl">{totalLimit - totalUsage}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              buscas restantes no Instagram
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Keys Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Chaves Cadastradas ({keys.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : keys.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Instagram className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma chave Apify cadastrada</p>
              <p className="text-sm">Clique em "Nova Chave" para adicionar</p>
              <p className="text-xs mt-2">Crie uma conta gratuita em apify.com</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>API Token</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Uso do Mês</TableHead>
                  <TableHead>Último Uso</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.name}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {key.api_key_masked}
                      </code>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={key.is_active}
                          onCheckedChange={() => handleToggleActive(key)}
                        />
                        <Badge variant={key.is_active ? 'default' : 'secondary'}>
                          {key.is_active ? 'Ativa' : 'Inativa'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm">
                          {key.usage_count} / {key.monthly_limit}
                        </div>
                        <Progress 
                          value={(key.usage_count / key.monthly_limit) * 100} 
                          className="h-1.5 w-20"
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      {key.last_used_at 
                        ? new Date(key.last_used_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
                        : '-'
                      }
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(key)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(key)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
