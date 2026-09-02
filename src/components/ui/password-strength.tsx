import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Check, X } from 'lucide-react';

interface PasswordStrengthProps {
  password: string;
}

export const PasswordStrength: React.FC<PasswordStrengthProps> = ({ password }) => {
  const requirements = [
    { test: (pwd: string) => pwd.length >= 8, text: 'At least 8 characters' },
    { test: (pwd: string) => /[A-Z]/.test(pwd), text: 'One uppercase letter' },
    { test: (pwd: string) => /[a-z]/.test(pwd), text: 'One lowercase letter' },
    { test: (pwd: string) => /\d/.test(pwd), text: 'One number' },
    { test: (pwd: string) => /[!@#$%^&*(),.?":{}|<>]/.test(pwd), text: 'One special character' },
  ];

  const passedRequirements = requirements.filter(req => req.test(password));
  const strength = (passedRequirements.length / requirements.length) * 100;

  const getStrengthText = () => {
    if (strength === 0) return '';
    if (strength < 40) return 'Weak';
    if (strength < 80) return 'Medium';
    return 'Strong';
  };

  const getStrengthColor = () => {
    if (strength < 40) return 'bg-destructive';
    if (strength < 80) return 'bg-warning';
    return 'bg-success';
  };

  if (!password) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Password strength</span>
        <span className={`font-medium ${
          strength < 40 ? 'text-destructive' : 
          strength < 80 ? 'text-warning' : 
          'text-success'
        }`}>
          {getStrengthText()}
        </span>
      </div>
      
      <Progress value={strength} className="h-2" />
      
      <div className="space-y-1">
        {requirements.map((req, index) => (
          <div key={index} className="flex items-center text-xs">
            {req.test(password) ? (
              <Check className="h-3 w-3 text-success mr-2" />
            ) : (
              <X className="h-3 w-3 text-muted-foreground mr-2" />
            )}
            <span className={req.test(password) ? 'text-success' : 'text-muted-foreground'}>
              {req.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};