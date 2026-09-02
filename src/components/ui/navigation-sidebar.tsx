import React from 'react';
import { cn } from '@/lib/utils';
import { 
  BarChart3, 
  Package, 
  ShoppingCart, 
  FileText, 
  RotateCcw, 
  CreditCard, 
  TrendingUp, 
  MapPin, 
  Bot, 
  Users, 
  Building2 
} from 'lucide-react';

interface NavigationSidebarProps {
  activeView?: string;
  onNavigate: (view: string) => void;
  className?: string;
}

interface NavigationItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

const navigationItems: NavigationItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'purchase', label: 'Purchase', icon: ShoppingCart },
  { id: 'sales', label: 'Sales', icon: FileText },
  { id: 'returns', label: 'Returns', icon: RotateCcw },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'reports', label: 'Reports', icon: TrendingUp },
  { id: 'tracking', label: 'Track & Trace', icon: MapPin },
  { id: 'ai', label: 'AI Assistant', icon: Bot },
  { id: 'users', label: 'Team Management', icon: Users },
  { id: 'profile', label: 'Company Profile', icon: Building2 },
];

export const NavigationSidebar: React.FC<NavigationSidebarProps> = ({
  activeView = 'dashboard',
  onNavigate,
  className
}) => {
  return (
    <div className={cn(
      "w-64 bg-background border-r border-border flex flex-col h-full",
      className
    )}>
      <div className="p-3 sm:p-4 border-b border-border">
        <h2 className="text-base sm:text-lg font-semibold text-foreground">Navigation</h2>
      </div>
      
      <nav className="flex-1 p-2">
        <ul className="space-y-1">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            
            return (
              <li key={item.id}>
                <button
                  onClick={() => onNavigate(item.id)}
                  className={cn(
                    "w-full flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-3 text-sm rounded-md transition-colors text-left min-h-[48px]",
                    isActive 
                      ? "bg-primary text-primary-foreground font-medium" 
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
};