import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppHeader from "@/components/AppHeader";
import AdminAuthGuard from "@/components/AdminAuthGuard";
import { InstallPrompt } from "@/components/InstallPrompt";
import Driver from "@/pages/driver";
import Venue from "@/pages/venue";
import Admin from "@/pages/admin";
import AdminLogin from "@/pages/admin-login";
import AdminSearch from "@/pages/admin-search";
import Parent from "@/pages/parent";
import Registration from "@/pages/registration";
import RegisterTransport from "@/pages/register-transport";
import RegisterVenue from "@/pages/register-venue";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/">
        <Redirect to="/admin" />
      </Route>
      <Route path="/driver" component={Driver} />
      <Route path="/venue" component={Venue} />
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin">
        <AdminAuthGuard>
          <Admin />
        </AdminAuthGuard>
      </Route>
      <Route path="/admin/register">
        <AdminAuthGuard>
          <Registration />
        </AdminAuthGuard>
      </Route>
      <Route path="/admin/register-transport">
        <AdminAuthGuard>
          <RegisterTransport />
        </AdminAuthGuard>
      </Route>
      <Route path="/admin/register-venue">
        <AdminAuthGuard>
          <RegisterVenue />
        </AdminAuthGuard>
      </Route>
      <Route path="/admin/search">
        <AdminAuthGuard>
          <AdminSearch />
        </AdminAuthGuard>
      </Route>
      <Route path="/parent" component={Parent} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen flex flex-col">
          <AppHeader />
          <main className="flex-1">
            <Router />
          </main>
        </div>
        <Toaster />
        <InstallPrompt />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
