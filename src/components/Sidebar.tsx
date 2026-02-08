import { NavLink, useNavigate } from 'react-router-dom';
import { 
  Search, 
  Settings, 
  Database, 
  BarChart3, 
  LayoutDashboard,
  Users,
  CreditCard,
  DollarSign,
  LogOut,
  User,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand } from '@/hooks/useBrand';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/search', icon: Search, label: 'Pesquisar' },
  { to: '/leads', icon: Database, label: 'Leads Salvos' },
  { to: '/pricing', icon: DollarSign, label: 'Planos' },
];

const adminItems = [
  { to: '/admin/plans', icon: CreditCard, label: 'Gerenciar Planos' },
  { to: '/admin/users', icon: Users, label: 'Gerenciar Usuários' },
  { to: '/admin', icon: Settings, label: 'Configurações' },
];

export function Sidebar() {
  const { user, isAuthenticated, logout } = useAuth();
  const { brand } = useBrand();
  const navigate = useNavigate();

  return (
    <aside className="w-64 border-r border-sidebar-border bg-sidebar h-screen sticky top-0 flex flex-col relative overflow-hidden">
      {/* Neon gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-neon-cyan/5 via-transparent to-neon-purple/5 pointer-events-none" />
      <div className="p-6 border-b border-sidebar-border relative z-10">
        <div className="flex items-center gap-3">
          {brand.logoUrl ? (
            <div className="w-10 h-10 rounded-lg overflow-hidden neon-glow-cyan">
              <img 
                src={brand.logoUrl} 
                alt="Logo" 
                className="w-full h-full object-contain"
              />
            </div>
          ) : (
            <div className="p-2 rounded-lg bg-primary neon-glow-cyan">
              <Sparkles className="h-6 w-6 text-primary-foreground" />
            </div>
          )}
          <div>
            <h1 className="font-bold text-lg text-primary neon-text-cyan logo-text tracking-wider">
              {brand.appName}
            </h1>
            <p className="text-xs text-muted-foreground">{brand.appSubtitle}</p>
          </div>
        </div>
      </div>
      
      <nav className="flex-1 p-4 overflow-y-auto">
        <ul className="space-y-2">
          {navItems.map((item) => (
            <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300',
                      'text-sidebar-foreground hover:bg-sidebar-accent hover:text-primary',
                      isActive && 'bg-primary/10 text-primary neon-border'
                    )
                  }
                >
                  <item.icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                </NavLink>
            </li>
          ))}
        </ul>

        {(user?.role === 'admin' || user?.role === 'superadmin') && (
          <>
            <div className="my-4 px-3">
              <p className="text-xs font-semibold text-accent uppercase tracking-wider neon-text-pink">
                Administração
              </p>
            </div>
            <ul className="space-y-2">
              {adminItems.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300',
                        'text-sidebar-foreground hover:bg-sidebar-accent hover:text-accent',
                        isActive && 'bg-accent/10 text-accent neon-border-pink'
                      )
                    }
                  >
                    <item.icon className="h-5 w-5" />
                    <span className="font-medium">{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </>
        )}
      </nav>
      
      <div className="p-4 border-t">
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-start gap-3">
                <div className="p-1.5 rounded-full bg-primary/10">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium truncate">{user.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
                {(user.role === 'admin' || user.role === 'superadmin') && (
                  <Badge variant="secondary" className="text-xs">
                    {user.role === 'superadmin' ? 'Super' : 'Admin'}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => navigate('/pricing')}>
                <CreditCard className="mr-2 h-4 w-4" />
                Meu Plano
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </aside>
  );
}
