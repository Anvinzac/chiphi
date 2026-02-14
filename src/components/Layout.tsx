import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Receipt } from "lucide-react";

const navItems = [
  { to: "/", label: "Daily Input", icon: Receipt },
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background font-body">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="font-display text-2xl text-primary">Mìsè</span>
            <span className="hidden text-xs text-muted-foreground sm:block">expense tracker</span>
          </Link>

          <nav className="flex items-center gap-1" role="navigation" aria-label="Main navigation">
            {navItems.map(({ to, label, icon: Icon }) => {
              const active = location.pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="container py-8">
        {children}
      </main>
    </div>
  );
}
