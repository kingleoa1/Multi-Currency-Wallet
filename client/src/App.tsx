import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Auth from "@/pages/auth";
import Dashboard from "@/pages/dashboard";
import WalletDetails from "@/pages/wallet-details";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

function Router() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [, navigate] = useLocation();

  useEffect(() => {
    // Check authentication status on initial load
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/session', {
          credentials: 'include'
        });
        const data = await res.json();
        setAuthenticated(data.authenticated);
        
        // Redirect to login if not authenticated and trying to access protected routes
        if (!data.authenticated && window.location.pathname !== '/auth') {
          navigate('/auth');
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        setAuthenticated(false);
        navigate('/auth');
      }
    };
    
    checkAuth();
  }, [navigate]);

  // Show nothing until authentication status is determined
  if (authenticated === null) {
    return null;
  }

  return (
    <Switch>
      <Route path="/auth">
        {authenticated ? navigate('/') : <Auth />}
      </Route>
      <Route path="/">
        {authenticated ? <Dashboard /> : navigate('/auth')}
      </Route>
      <Route path="/wallet/:id">
        {authenticated ? <WalletDetails /> : navigate('/auth')}
      </Route>
      <Route><NotFound /></Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
