import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, LoginCredentials, RegisterData } from '@/types/user';
import { toast } from '@/hooks/use-toast';
import { authApi, setAuthToken, getAuthToken } from '@/lib/apiClient';

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Carregar usuário se tiver token salvo
    const token = getAuthToken();
    if (token) {
      authApi.me()
        .then((userData) => {
          setUser(userData);
        })
        .catch(() => {
          setAuthToken(null);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (credentials: LoginCredentials): Promise<boolean> => {
    setIsLoading(true);
    
    try {
      const { user: userData } = await authApi.login(credentials.email, credentials.password);
      setUser(userData);
      
      toast({
        title: 'Bem-vindo!',
        description: `Olá, ${userData.name}`,
      });
      
      return true;
    } catch (error: any) {
      toast({
        title: 'Erro no login',
        description: error.message || 'Credenciais inválidas',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterData): Promise<boolean> => {
    setIsLoading(true);
    
    try {
      const { user: userData } = await authApi.register(data.email, data.password, data.name);
      setUser(userData);
      
      toast({
        title: 'Conta criada!',
        description: 'Bem-vindo ao Lead Extractor',
      });
      
      return true;
    } catch (error: any) {
      toast({
        title: 'Erro no cadastro',
        description: error.message || 'Não foi possível criar a conta',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    authApi.logout();
    setUser(null);
    toast({
      title: 'Até logo!',
      description: 'Você saiu da sua conta',
    });
  };

  const updateUser = (updates: Partial<User>) => {
    if (!user) return;
    setUser({ ...user, ...updates });
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
