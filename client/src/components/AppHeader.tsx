import { Link, useLocation } from "wouter";

export default function AppHeader() {
  const [location] = useLocation();

  const navItems = [
    { path: "/driver", label: "Driver" },
    { path: "/admin", label: "Admin" },
    { path: "/parent", label: "Parent" },
  ];

  return (
    <header className="border-b bg-card">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">QRTicket App</h1>
          </div>
          
          <nav className="flex gap-1">
            {navItems.map((item) => {
              const isActive = location.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  data-testid={`link-nav-${item.label.toLowerCase()}`}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors hover-elevate ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
