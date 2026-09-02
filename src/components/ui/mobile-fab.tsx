import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Plus, X } from 'lucide-react';

interface FABAction {
  id: string;
  label: string;
  icon: React.ElementType;
  onClick: () => void;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary';
}

interface MobileFABProps {
  actions: FABAction[];
  className?: string;
  disabled?: boolean;
}

export const MobileFAB: React.FC<MobileFABProps> = ({
  actions,
  className,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);

  if (actions.length === 0) return null;

  // Single action - show directly
  if (actions.length === 1) {
    const action = actions[0];
    return (
      <div className={cn(
        "fixed bottom-6 right-6 z-50",
        className
      )}>
        <Button
          size="lg"
          className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-200"
          onClick={action.onClick}
          disabled={disabled}
        >
          <action.icon className="h-6 w-6" />
        </Button>
      </div>
    );
  }

  // Multiple actions - show expandable FAB
  return (
    <div className={cn("fixed bottom-6 right-6 z-50", className)}>
      {/* Action Buttons */}
      <div className={cn(
        "flex flex-col-reverse gap-3 mb-3 transition-all duration-300 ease-out",
        isOpen ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
      )}>
        {actions.map((action, index) => (
          <div
            key={action.id}
            className={cn(
              "flex items-center gap-3 transition-all duration-300 ease-out",
              isOpen ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
            )}
            style={{
              transitionDelay: isOpen ? `${index * 50}ms` : `${(actions.length - index - 1) * 30}ms`
            }}
          >
            {/* Label */}
            <div className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border rounded-lg px-3 py-2 shadow-md">
              <span className="text-sm font-medium whitespace-nowrap">
                {action.label}
              </span>
            </div>
            
            {/* Action Button */}
            <Button
              size="lg"
              variant={action.variant || 'default'}
              className="h-12 w-12 rounded-full shadow-md hover:shadow-lg transition-all duration-200"
              onClick={() => {
                action.onClick();
                setIsOpen(false);
              }}
              disabled={disabled}
            >
              <action.icon className="h-5 w-5" />
            </Button>
          </div>
        ))}
      </div>

      {/* Main FAB Button */}
      <Button
        size="lg"
        className={cn(
          "h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-300",
          isOpen && "rotate-45"
        )}
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <Plus className="h-6 w-6" />
        )}
      </Button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-background/20 backdrop-blur-sm -z-10"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

// Hook for managing FAB state
export const useMobileFAB = () => {
  const [isOpen, setIsOpen] = useState(false);

  const close = () => setIsOpen(false);
  const toggle = () => setIsOpen(prev => !prev);

  return {
    isOpen,
    close,
    toggle,
    setIsOpen
  };
};