import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { useAuth } from "@/hooks/useAuth";

import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import QuoteRequest from "@/pages/QuoteRequest";
import QuoteDetails from "@/pages/QuoteDetails";
import AdminPanel from "@/pages/AdminPanel";
import Certifications from "@/pages/Certifications";
import PostProcessing from "@/pages/PostProcessing";
import MassProduction from "@/pages/MassProduction";
import TargetPriceQuote from "@/pages/TargetPriceQuote";
import NotFound from "@/pages/not-found";

// Koruma Kalkanı
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <div className="flex h-screen items-center justify-center">Yükleniyor...</div>;

  if (!isAuthenticated) {
    window.location.href = "/login";
    return null;
  }

  return <Component />;
}

function Router() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <Switch>
      {/* 1. EN ÖZEL ROTALAR (En Üste Koyduk) */}
      {/* Admin rotasını en başa koyuyoruz ki diğerleri onu ezmesin */}
      <Route path="/admin" component={() => <ProtectedRoute component={AdminPanel} />} />

      {/* 2. PUBLIC SAYFALAR */}
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      
      {/* 3. DASHBOARD VE ALT SAYFALARI */}
      {/* Dashboard detay sayfalarını ana dashboard'dan önce yazmak daha güvenlidir */}
      <Route path="/dashboard/quotes/:id" component={() => <ProtectedRoute component={QuoteDetails} />} />
      <Route path="/dashboard/:rest*" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
      
      {/* 4. DİĞER KORUMALI SAYFALAR */}
      <Route path="/quote-request" component={() => <ProtectedRoute component={QuoteRequest} />} />
      <Route path="/target-price-quote" component={() => <ProtectedRoute component={TargetPriceQuote} />} />

      {/* 5. DİĞER PUBLIC SAYFALAR */}
      <Route path="/certifications" component={Certifications} />
      <Route path="/post-processing" component={PostProcessing} />
      <Route path="/mass-production" component={MassProduction} />

      {/* 6. ANASAYFA (En Sona Yakın) */}
      <Route path="/" component={Landing} />

      {/* 7. HATA SAYFASI (En Son) */}
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}
