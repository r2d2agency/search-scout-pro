import { useAuth } from '@/contexts/AuthContext';
import { usePlans } from '@/hooks/usePlans';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const PricingPage = () => {
  const { user, updateUser } = useAuth();
  const { plans } = usePlans();
  
  const activePlans = plans.filter(p => p.isActive);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleSelectPlan = (planId: string) => {
    if (!user) {
      toast({
        title: 'Faça login',
        description: 'Você precisa estar logado para escolher um plano',
        variant: 'destructive',
      });
      return;
    }

    // TODO: Integrar com sistema de pagamento
    updateUser({ planId });
    
    toast({
      title: 'Plano atualizado!',
      description: 'Seu plano foi alterado com sucesso',
    });
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Escolha seu Plano</h1>
        <p className="text-muted-foreground mt-2">
          Selecione o melhor plano para suas necessidades
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {activePlans.map((plan) => {
          const isCurrentPlan = user?.planId === plan.id;
          const isPopular = plan.id === 'pro';
          
          return (
            <Card 
              key={plan.id} 
              className={`relative ${isPopular ? 'border-primary shadow-lg scale-105' : ''}`}
            >
              {isPopular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                  Mais Popular
                </Badge>
              )}
              
              <CardHeader className="text-center">
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="pt-4">
                  {plan.price === 0 ? (
                    <span className="text-4xl font-bold">Grátis</span>
                  ) : (
                    <>
                      <span className="text-4xl font-bold">{formatCurrency(plan.price)}</span>
                      <span className="text-muted-foreground">/mês</span>
                    </>
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Pesquisas/mês</span>
                    <span className="font-medium">{plan.monthlySearches}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Leads/mês</span>
                    <span className="font-medium">{plan.monthlyLeads}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Verificações WhatsApp</span>
                    <span className="font-medium">{plan.whatsappVerifications}</span>
                  </div>
                </div>
                
                <div className="border-t pt-4 space-y-2">
                  {plan.features.map((feature, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
              
              <CardFooter>
                <Button 
                  className="w-full"
                  variant={isCurrentPlan ? 'outline' : isPopular ? 'default' : 'secondary'}
                  disabled={isCurrentPlan}
                  onClick={() => handleSelectPlan(plan.id)}
                >
                  {isCurrentPlan ? 'Plano Atual' : 'Selecionar'}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default PricingPage;
