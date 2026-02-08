import { NavLink } from 'react-router-dom';
import { 
  Search, 
  Settings, 
  Database, 
  LayoutDashboard,
  Users,
  CreditCard,
  DollarSign,
  Sparkles,
  Key,
  Cog
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand } from '@/hooks/useBrand';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/search', icon: Search, label: 'Pesquisar' },
  { to: '/leads', icon: Database, label: 'Leads Salvos' },
  { to: '/settings', icon: Settings, label: 'Configurações' },
  { to: '/pricing', icon: DollarSign, label: 'Planos' },
];

const adminItems = [
  { to: '/admin/plans', icon: CreditCard, label: 'Gerenciar Planos' },
  { to: '/admin/users', icon: Users, label: 'Gerenciar Usuários' },
  { to: '/admin', icon: Cog, label: 'Config. Sistema' },
];

const superadminItems = [
  { to: '/admin/serp-keys', icon: Key, label: 'Chaves SERP API' },
];

export function Sidebar() {
  const { user } = useAuth();
  const { brand } = useBrand();

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
              {/* Superadmin-only items */}
              {user?.role === 'superadmin' && superadminItems.map((item) => (
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
              {/* Admin + Superadmin items */}
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
      
    </aside>
  );
}
