import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePlans } from '@/hooks/usePlans';
import { Plan } from '@/types/user';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
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
import { Plus, Edit, Trash2, CreditCard } from 'lucide-react';

const PlansPage = () => {
  const { user } = useAuth();
  const { plans, createPlan, updatePlan, deletePlan, togglePlanStatus } = usePlans();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    monthlySearches: 10,
    monthlyLeads: 50,
    whatsappVerifications: 20,
    price: 0,
    features: '',
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      monthlySearches: 10,
      monthlyLeads: 50,
      whatsappVerifications: 20,
      price: 0,
      features: '',
    });
    setEditingPlan(null);
  };

  const handleEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      description: plan.description,
      monthlySearches: plan.monthlySearches,
      monthlyLeads: plan.monthlyLeads,
      whatsappVerifications: plan.whatsappVerifications,
      price: plan.price,
      features: plan.features.join('\n'),
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const planData = {
      name: formData.name,
      description: formData.description,
      monthlySearches: formData.monthlySearches,
      monthlyLeads: formData.monthlyLeads,
      whatsappVerifications: formData.whatsappVerifications,
      price: formData.price,
      features: formData.features.split('\n').filter(f => f.trim()),
      isActive: true,
    };

    if (editingPlan) {
      updatePlan(editingPlan.id, planData);
    } else {
      createPlan(planData);
    }

    setIsDialogOpen(false);
    resetForm();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (user?.role !== 'admin' && user?.role !== 'superadmin') {
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gerenciar Planos</h1>
          <p className="text-muted-foreground">
            Configure os planos de assinatura e limites
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Plano
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>
                  {editingPlan ? 'Editar Plano' : 'Criar Plano'}
                </DialogTitle>
                <DialogDescription>
                  Configure os detalhes e limites do plano
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Plano</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Profissional"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Breve descrição do plano"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="price">Preço Mensal (R$)</Label>
                  <Input
                    id="price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="searches">Pesquisas/mês</Label>
                    <Input
                      id="searches"
                      type="number"
                      min="0"
                      value={formData.monthlySearches}
                      onChange={(e) => setFormData({ ...formData, monthlySearches: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="leads">Leads/mês</Label>
                    <Input
                      id="leads"
                      type="number"
                      min="0"
                      value={formData.monthlyLeads}
                      onChange={(e) => setFormData({ ...formData, monthlyLeads: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="whatsapp">WhatsApp/mês</Label>
                    <Input
                      id="whatsapp"
                      type="number"
                      min="0"
                      value={formData.whatsappVerifications}
                      onChange={(e) => setFormData({ ...formData, whatsappVerifications: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="features">Recursos (um por linha)</Label>
                  <Textarea
                    id="features"
                    value={formData.features}
                    onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                    placeholder="Ex: Suporte prioritário&#10;API access"
                    rows={3}
                  />
                </div>
              </div>
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingPlan ? 'Salvar' : 'Criar'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Planos Cadastrados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plano</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead className="text-center">Pesquisas</TableHead>
                <TableHead className="text-center">Leads</TableHead>
                <TableHead className="text-center">WhatsApp</TableHead>
                <TableHead className="text-center">Ativo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{plan.name}</p>
                      <p className="text-xs text-muted-foreground">{plan.description}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {plan.price === 0 ? (
                      <Badge variant="secondary">Grátis</Badge>
                    ) : (
                      formatCurrency(plan.price)
                    )}
                  </TableCell>
                  <TableCell className="text-center">{plan.monthlySearches}</TableCell>
                  <TableCell className="text-center">{plan.monthlyLeads}</TableCell>
                  <TableCell className="text-center">{plan.whatsappVerifications}</TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={plan.isActive}
                      onCheckedChange={() => togglePlanStatus(plan.id)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(plan)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deletePlan(plan.id)}
                        disabled={plan.id === 'free'}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default PlansPage;
