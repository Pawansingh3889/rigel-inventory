import React from 'react';
import { Button } from '@/components/ui/button';
import { Search, User, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useBusinessAuth } from '@/hooks/useBusinessAuth';
import { useIsMobile } from '@/hooks/use-mobile';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  showSearch?: boolean;
  showWelcome?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  actions,
  showSearch = true,
  showWelcome = false
}) => {
  const { user, profile, signOut } = useAuth();
  const { businessUser } = useBusinessAuth();
  const isMobile = useIsMobile();

  return (
    <header className="bg-gradient-primary border-b border-border/50 sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-gradient-primary/95">
      <div className="px-4 md:px-6 py-3 md:py-4">
        <div className="flex items-center justify-between">
          {/* Left Section - Title/Welcome */}
          <div className="flex-1 min-w-0">
            {showWelcome ? (
              <div className="space-y-1">
                <h1 className="text-lg md:text-2xl font-bold text-foreground truncate">
                  {profile?.first_name ? `Welcome back, ${profile.first_name}!` : 'Welcome back!'} 👋
                </h1>
                <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">
                  Here's what's happening with your business today
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <h1 className="text-lg md:text-xl font-semibold text-foreground truncate">
                  {title}
                </h1>
                {subtitle && (
                  <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">
                    {subtitle}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Center Section - Company Badge (Hidden on mobile) */}
          {!isMobile && (
            <div className="flex-shrink-0 mx-8">
              <div className="bg-background/20 backdrop-blur border border-border/30 rounded-lg px-3 py-2">
                <div className="text-xs text-foreground/80 font-medium">
                  Company: ACME Corp
                </div>
                <div className="text-xs text-muted-foreground">
                  ID: 12345
                </div>
              </div>
            </div>
          )}

          {/* Right Section - Actions */}
          <div className="flex items-center gap-2 md:gap-3">
            {actions}
            
            {user ? (
              <Button
                onClick={signOut}
                variant="ghost"
                size={isMobile ? "sm" : "sm"}
                className="text-foreground hover:bg-background/20 min-h-[44px] md:min-h-auto"
              >
                <LogOut className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Sign Out</span>
              </Button>
            ) : (
              <Button variant="ghost" size={isMobile ? "sm" : "sm"} className="min-h-[44px] md:min-h-auto">
                <User className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Sign In</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};