import React from 'react';
import { Header } from '@/components/ui/header';
import { NavigationSidebar } from '@/components/ui/navigation-sidebar';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useBusinessAuth } from '@/hooks/useBusinessAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  headerActions?: React.ReactNode;
  showSearch?: boolean;
  showWelcome?: boolean;
  activeView?: string;
  onNavigate?: (view: string) => void;
  className?: string;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  title,
  subtitle,
  headerActions,
  showSearch = true,
  showWelcome = false,
  activeView = 'dashboard',
  onNavigate = () => {},
  className,
}) => {
  const { user } = useAuth();
  const { businessUser } = useBusinessAuth();
  const isMobile = useIsMobile();
  const emailToShow = user?.email || businessUser?.email || '';
  const roleLabel = (businessUser?.access_type === 'ADMIN' || businessUser?.access_type === 'OWNER') ? 'Admin' : 'User';
  
  const MobileMenu = () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <NavigationSidebar 
          activeView={activeView} 
          onNavigate={onNavigate}
          className="border-0"
        />
      </SheetContent>
    </Sheet>
  );

  return (
    <div className="flex flex-col min-h-screen">
      <Header 
        title={title} 
        subtitle={subtitle} 
        actions={
          <div className="flex items-center gap-2">
            <MobileMenu />
            {headerActions}
          </div>
        }
        showSearch={showSearch}
        showWelcome={showWelcome}
      />
      <div className="flex flex-1">
        {/* Desktop Sidebar */}
        <NavigationSidebar 
          activeView={activeView} 
          onNavigate={onNavigate}
          className="hidden md:flex flex-shrink-0"
        />
        <main className={cn('flex-1 bg-gradient-subtle', className)}>
          <div className="section-padding content-container">
            <div className="animate-fade-up">
              {children}
            </div>
          </div>
        </main>
      </div>
      <aside aria-label="current-user" className="hidden lg:block fixed left-4 bottom-4 text-xs text-muted-foreground bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border border-border rounded-md px-3 py-2 shadow z-50">
        <span className="truncate max-w-[200px] inline-block">{emailToShow || 'Signed out'}</span>
        <span className="mx-2">•</span>
        <span>{roleLabel}</span>
      </aside>
    </div>
  );
};