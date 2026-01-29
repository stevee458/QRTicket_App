import { useQuery } from "@tanstack/react-query";
import { Redirect } from "wouter";

interface AdminAuthGuardProps {
  children: React.ReactNode;
}

export default function AdminAuthGuard({ children }: AdminAuthGuardProps) {
  const { data: adminSession, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/me"],
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!adminSession?.success) {
    return <Redirect to="/admin/login" />;
  }

  return <>{children}</>;
}
