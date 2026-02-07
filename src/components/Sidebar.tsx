import { NavLink } from 'react-router-dom';
import { Search, Settings, Database, BarChart3, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/search', icon: Search, label: 'Pesquisar' },
  { to: '/leads', icon: Database, label: 'Leads Salvos' },
  { to: '/admin', icon: Settings, label: 'Configurações' },
];

export function Sidebar() {
  return (
    <aside className="w-64 border-r bg-sidebar h-screen sticky top-0 flex flex-col">
      <div className="p-6 border-b">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary">
            <BarChart3 className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-sidebar-foreground">Lead Extractor</h1>
            <p className="text-xs text-sidebar-foreground/60">SERP + Evolution</p>
          </div>
        </div>
      </div>
      
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                    'text-sidebar-foreground hover:bg-sidebar-accent',
                    isActive && 'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary'
                  )
                }
              >
                <item.icon className="h-5 w-5" />
                <span className="font-medium">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      
      <div className="p-4 border-t">
        <p className="text-xs text-sidebar-foreground/60 text-center">
          Deploy: Easypanel + PostgreSQL
        </p>
      </div>
    </aside>
  );
}
