import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, LoginCredentials, RegisterData, Plan, UserUsage } from '@/types/user';
import { toast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<boolean>;
  register: (data: RegisterData) => Promise<boolean>;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USERS_KEY = 'lead_extractor_users';
const CURRENT_USER_KEY = 'lead_extractor_current_user';
const PLANS_KEY = 'lead_extractor_plans';

// Planos padrão
const defaultPlans: Plan[] = [
  {
    id: 'free',
    name: 'Gratuito',
    description: 'Para começar a explorar',
    monthlySearches: 10,
    monthlyLeads: 50,
    whatsappVerifications: 20,
    price: 0,
    features: ['10 pesquisas/mês', '50 leads/mês', '20 verificações WhatsApp'],
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'pro',
    name: 'Profissional',
    description: 'Para profissionais de vendas',
    monthlySearches: 100,
    monthlyLeads: 500,
    whatsappVerifications: 300,
    price: 97,
    features: ['100 pesquisas/mês', '500 leads/mês', '300 verificações WhatsApp', 'Suporte prioritário'],
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'enterprise',
    name: 'Empresarial',
    description: 'Para equipes e empresas',
    monthlySearches: 1000,
    monthlyLeads: 5000,
    whatsappVerifications: 3000,
    price: 297,
    features: ['1000 pesquisas/mês', '5000 leads/mês', '3000 verificações WhatsApp', 'API access', 'Suporte 24/7'],
    isActive: true,
    createdAt: new Date().toISOString(),
  },
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Inicializar planos padrão
    const existingPlans = localStorage.getItem(PLANS_KEY);
    if (!existingPlans) {
      localStorage.setItem(PLANS_KEY, JSON.stringify(defaultPlans));
    }

    // Carregar usuário atual
    const savedUser = localStorage.getItem(CURRENT_USER_KEY);
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem(CURRENT_USER_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const getUsers = (): User[] => {
    const saved = localStorage.getItem(USERS_KEY);
    return saved ? JSON.parse(saved) : [];
  };

  const saveUsers = (users: User[]) => {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  };

  const login = async (credentials: LoginCredentials): Promise<boolean> => {
    setIsLoading(true);
    
    try {
      // Simular delay de API
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const users = getUsers();
      const foundUser = users.find(u => u.email === credentials.email);
      
      if (!foundUser) {
        toast({
          title: 'Erro no login',
          description: 'Usuário não encontrado',
          variant: 'destructive',
        });
        return false;
      }

      // TODO: Verificar senha com backend real
      // Por agora, aceitar qualquer senha
      
      setUser(foundUser);
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(foundUser));
      
      toast({
        title: 'Bem-vindo!',
        description: `Olá, ${foundUser.name}`,
      });
      
      return true;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterData): Promise<boolean> => {
    setIsLoading(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const users = getUsers();
      
      if (users.find(u => u.email === data.email)) {
        toast({
          title: 'Erro no cadastro',
          description: 'Este email já está cadastrado',
          variant: 'destructive',
        });
        return false;
      }

      const newUser: User = {
        id: crypto.randomUUID(),
        email: data.email,
        name: data.name,
        role: users.length === 0 ? 'admin' : 'user', // Primeiro usuário é admin
        planId: 'free',
        createdAt: new Date().toISOString(),
      };

      saveUsers([...users, newUser]);
      setUser(newUser);
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(newUser));
      
      toast({
        title: 'Conta criada!',
        description: 'Bem-vindo ao Lead Extractor',
      });
      
      return true;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(CURRENT_USER_KEY);
    toast({
      title: 'Até logo!',
      description: 'Você saiu da sua conta',
    });
  };

  const updateUser = (updates: Partial<User>) => {
    if (!user) return;
    
    const updatedUser = { ...user, ...updates };
    setUser(updatedUser);
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updatedUser));
    
    const users = getUsers();
    const index = users.findIndex(u => u.id === user.id);
    if (index !== -1) {
      users[index] = updatedUser;
      saveUsers(users);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
