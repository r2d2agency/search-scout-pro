import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function Layout() {
  return (
    <div className="flex min-h-screen bg-background relative">
      {/* Background grid pattern */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,hsl(240_15%_15%/0.5)_1px,transparent_1px),linear-gradient(to_bottom,hsl(240_15%_15%/0.5)_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />
      {/* Subtle radial gradient overlay */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,hsl(180_100%_50%/0.05),transparent_50%),radial-gradient(ellipse_at_bottom_right,hsl(320_100%_60%/0.05),transparent_50%)] pointer-events-none" />
      <Sidebar />
      <div className="flex-1 flex flex-col relative z-10">
        <Header />
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
