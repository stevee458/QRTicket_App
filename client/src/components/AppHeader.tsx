import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AppHeader() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const isAdminRoute = location.startsWith("/admin") && location !== "/admin/login";

  const { data: adminSession } = useQuery<any>({
    queryKey: ["/api/admin/me"],
    enabled: isAdminRoute,
    retry: false,
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/logout");
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/me"] });
      toast({
        title: "Logged out",
        description: "You have been logged out successfully",
      });
      navigate("/admin/login");
    },
  });

  const navItems = [
    { path: "/driver", label: "Driver" },
    { path: "/admin", label: "Admin" },
    { path: "/parent", label: "Parent" },
  ];

  const isAdminLoggedIn = adminSession?.success;

  return (
    <header className="border-b bg-card">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">QRTicket App</h1>
          </div>
          
          <div className="flex items-center gap-4">
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
            
            {isAdminLoggedIn && isAdminRoute && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
                data-testid="button-admin-logout"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
