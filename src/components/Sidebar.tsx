import { NavLink } from 'react-router-dom';
import { 
  Search, 
  Database, 
  LayoutDashboard,
  Users,
  CreditCard,
  DollarSign,
  Key,
  Cog,
  Instagram,
  Flame,
  Building2,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand } from '@/hooks/useBrand';
import defaultLogo from '@/assets/logo.png';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/search', icon: Search, label: 'Pesquisar' },
  { to: '/leads', icon: Database, label: 'Leads Salvos' },
  { to: '/cnpj', icon: Building2, label: 'Consulta CNPJ' },
  { to: '/pricing', icon: DollarSign, label: 'Planos' },
];

const adminItems = [
  { to: '/admin/plans', icon: CreditCard, label: 'Gerenciar Planos' },
  { to: '/admin/users', icon: Users, label: 'Gerenciar Usuários' },
  { to: '/admin', icon: Cog, label: 'Config. Sistema' },
];

const superadminItems = [
  { to: '/admin/serp-keys', icon: Key, label: 'Chaves SERP API' },
  { to: '/admin/apify-keys', icon: Instagram, label: 'Chaves Apify' },
  { to: '/admin/firecrawl-keys', icon: Flame, label: 'Chaves Firecrawl' },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const { user } = useAuth();
  const { brand } = useBrand();

  const isMobileControlled = mobileOpen !== undefined;

  const handleNavClick = () => {
    if (isMobileControlled) onClose?.();
  };

  return (
    <aside className={cn(
      "w-64 border-r border-sidebar-border bg-sidebar h-screen flex flex-col relative overflow-hidden",
      isMobileControlled
        ? cn(
            "fixed top-0 left-0 z-50 transition-transform duration-300",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )
        : "sticky top-0"
    )}>
      {/* Neon gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-neon-cyan/5 via-transparent to-neon-purple/5 pointer-events-none" />
      
      <div className="p-4 border-b border-sidebar-border relative z-10 flex items-center justify-between">
        <div className="flex-1 flex items-center justify-center">
          <img 
            src={brand.logoUrl || defaultLogo} 
            alt="Logo" 
            className="max-h-12 max-w-full object-contain"
          />
        </div>
        {isMobileControlled && (
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
      
      <nav className="flex-1 p-4 overflow-y-auto">
        <ul className="space-y-2">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/'}
                onClick={handleNavClick}
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
              {user?.role === 'superadmin' && superadminItems.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    onClick={handleNavClick}
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
              {adminItems.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    onClick={handleNavClick}
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
      
      <div className="p-4 border-t border-sidebar-border text-center">
        <p className="text-xs text-muted-foreground">R2D2 - TNS</p>
      </div>
    </aside>
  );
}
