import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppHeader from "@/components/AppHeader";
import Driver from "@/pages/driver";
import Admin from "@/pages/admin";
import AdminSearch from "@/pages/admin-search";
import Parent from "@/pages/parent";
import Registration from "@/pages/registration";
import RegisterTransport from "@/pages/register-transport";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/">
        <Redirect to="/admin" />
      </Route>
      <Route path="/driver" component={Driver} />
      <Route path="/admin" component={Admin} />
      <Route path="/admin/register" component={Registration} />
      <Route path="/admin/register-transport" component={RegisterTransport} />
      <Route path="/admin/search" component={AdminSearch} />
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
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
