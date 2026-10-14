import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import NotFound from '@/pages/not-found';
import ListPage from '@/pages/list';
import CalendarPage from '@/pages/calendar';
import HousematesPage from '@/pages/housemates';
import AuthPage, { AuthFrame, ResetPasswordPage } from '@/pages/auth';
import OnboardingPage from '@/pages/onboarding';
import { StoreProvider, useStore } from '@/store/store';
import { AuthProvider, useAuth } from '@/auth/auth';
import { ChoreEditorProvider } from '@/components/hm/chore-dialog';
import { AppShell } from '@/components/hm/app-shell';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient();

function Router() {
  return (
    <AppShell>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={ListPage} />
          <Route path="/calendar" component={CalendarPage} />
          <Route path="/housemates" component={HousematesPage} />
          <Route path="/reset-password" component={ListPage} />
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </AppShell>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function FullSkeleton() {
  return (
    <div className="min-h-[100dvh] bg-background" aria-busy="true" data-testid="skeleton-app">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Skeleton className="h-9 w-9 rounded-xl" />
        <Skeleton className="h-5 w-32 rounded-lg" />
      </div>
      <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
        <Skeleton className="h-9 w-48 rounded-xl" />
        <div className="mt-8 grid gap-3 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
        </div>
      </div>
    </div>
  );
}

function HouseGate() {
  const { houses, housesError, housesLoading, reloadHouses, currentHouse } = useStore();
  const { signOut } = useAuth();
  if (houses === null) {
    if (housesError && !housesLoading) {
      return (
        <AuthFrame title="Couldn't load your houses" subtitle={housesError}>
          <div className="flex gap-2">
            <Button onClick={() => { void reloadHouses(); }} className="flex-1 rounded-xl" data-testid="button-retry-houses">
              <RefreshCw className="mr-1.5 h-4 w-4" /> Try again
            </Button>
            <Button variant="outline" onClick={() => { void signOut().catch(() => undefined); }} className="rounded-xl" data-testid="button-signout-error">Sign out</Button>
          </div>
        </AuthFrame>
      );
    }
    return <FullSkeleton />;
  }
  if (houses.length === 0) return <OnboardingPage />;
  return (
    <ChoreEditorProvider key={currentHouse?.id ?? 'none'}>
      <Router />
    </ChoreEditorProvider>
  );
}

function AuthGate() {
  const { session, loading, recovery } = useAuth();
  if (loading) return <FullSkeleton />;
  if (recovery) return <ResetPasswordPage />;
  if (!session) return <AuthPage />;
  return (
    <StoreProvider key={session.user.id} userId={session.user.id}>
      <HouseGate />
    </StoreProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <AuthGate />
          </WouterRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
