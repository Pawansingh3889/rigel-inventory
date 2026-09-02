import React from 'react';
import { useBusinessAuth } from '@/hooks/useBusinessAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent } from '@/components/ui/select';

interface PermissionWrapperProps {
  section: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface PermissionInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  section: string;
}

interface PermissionTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  section: string;
}

interface PermissionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  section: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  children: React.ReactNode;
}

interface PermissionSelectProps {
  section: string;
  children: React.ReactNode;
  [key: string]: any;
}

// Main wrapper component that shows access denied message for read-only users
export function PermissionWrapper({ section, children, fallback }: PermissionWrapperProps) {
  const { hasAccess } = useBusinessAuth();
  
  if (!hasAccess(section)) {
    return fallback || (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-muted-foreground mb-2">Access Denied</h2>
          <p className="text-muted-foreground">You don't have permission to access this section.</p>
        </div>
      </div>
    );
  }
  
  return <>{children}</>;
}

// Permission-aware Input component
export function PermissionInput({ section, ...props }: PermissionInputProps) {
  const { hasEditAccess } = useBusinessAuth();
  const canEdit = hasEditAccess(section);
  
  return <Input {...props} disabled={!canEdit || props.disabled} readOnly={!canEdit || props.readOnly} />;
}

// Permission-aware Textarea component
export function PermissionTextarea({ section, ...props }: PermissionTextareaProps) {
  const { hasEditAccess } = useBusinessAuth();
  const canEdit = hasEditAccess(section);
  
  return <Textarea {...props} disabled={!canEdit || props.disabled} readOnly={!canEdit || props.readOnly} />;
}

// Permission-aware Button component
export function PermissionButton({ section, variant = "default", size = "default", children, ...props }: PermissionButtonProps) {
  const { hasEditAccess } = useBusinessAuth();
  const canEdit = hasEditAccess(section);
  
  return (
    <Button 
      variant={variant} 
      size={size} 
      {...props} 
      disabled={!canEdit || props.disabled}
    >
      {children}
    </Button>
  );
}

// Permission-aware Select component  
export function PermissionSelect({ section, children, ...props }: PermissionSelectProps) {
  const { hasEditAccess } = useBusinessAuth();
  const canEdit = hasEditAccess(section);
  
  return (
    <Select {...props} disabled={!canEdit || props.disabled}>
      {children}
    </Select>
  );
}