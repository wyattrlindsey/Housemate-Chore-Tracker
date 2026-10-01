import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import ListPage from '@/pages/list';
import CalendarPage from '@/pages/calendar';
import HousematesPage from '@/pages/housemates';
import { StoreProvider } from '@/store/store';
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <StoreProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <ChoreEditorProvider>
              <Router />
            </ChoreEditorProvider>
          </WouterRouter>
        </StoreProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
