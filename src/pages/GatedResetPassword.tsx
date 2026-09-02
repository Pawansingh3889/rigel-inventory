import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Loader2, 
  Lock, 
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';

const GatedResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: ''
  });

  const token = searchParams.get('token');

  // Redirect if no token
  useEffect(() => {
    if (!token) {
      toast({
        title: "Invalid Reset Link",
        description: "The password reset link is invalid or has expired.",
        variant: "destructive"
      });
      navigate('/gated-forgot-password');
    }
  }, [token, navigate, toast]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    const { newPassword, confirmPassword } = formData;

    if (!newPassword) {
      toast({ title: "New password is required", variant: "destructive" });
      return false;
    }

    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(newPassword)) {
      toast({ 
        title: "Password Requirements Not Met", 
        description: "Password must be at least 8 characters with uppercase, lowercase, number, and special character.",
        variant: "destructive" 
      });
      return false;
    }

    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm() || !token) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('reset-password', {
        body: {
          token,
          newPassword: formData.newPassword
        }
      });

      if (error) throw error;

      if (data?.success) {
        setIsSuccess(true);
        toast({
          title: "Password Reset Successful!",
          description: "Your password has been updated. You can now sign in."
        });
      } else {
        throw new Error(data?.error || 'Password reset failed');
      }
    } catch (error: any) {
      toast({
        title: "Reset Failed",
        description: error.message || "The reset link may have expired. Please request a new one.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getPasswordStrength = (password: string) => {
    const checks = [
      { test: /.{8,}/, label: "At least 8 characters" },
      { test: /[a-z]/, label: "Lowercase letter" },
      { test: /[A-Z]/, label: "Uppercase letter" },
      { test: /\d/, label: "Number" },
      { test: /[@$!%*?&]/, label: "Special character" }
    ];

    return checks.map(check => ({
      ...check,
      met: check.test.test(password)
    }));
  };

  const passwordChecks = getPasswordStrength(formData.newPassword);
  const allChecksPassed = passwordChecks.every(check => check.met);

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="content-container w-full max-w-md mx-4">
          <Card className="shadow-elevated">
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-success" />
              </div>
              <CardTitle className="text-2xl text-success">Password Updated!</CardTitle>
              <CardDescription>
                Your password has been successfully reset
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                You can now sign in to your business portal with your new password.
              </p>
              <Button 
                onClick={() => navigate('/gated-signin')}
                className="w-full btn-gradient"
              >
                Sign In Now
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
      <div className="content-container w-full max-w-md mx-4">
        <Card className="shadow-elevated">
          <CardHeader className="text-center">
            <Lock className="h-12 w-12 text-primary mx-auto mb-4" />
            <CardTitle className="text-3xl">Set New Password</CardTitle>
            <CardDescription className="text-lg">
              Choose a strong password for your business account
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showPassword ? "text" : "password"}
                    value={formData.newPassword}
                    onChange={(e) => handleInputChange('newPassword', e.target.value)}
                    placeholder="Enter new password"
                    required
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {/* Password Requirements */}
                {formData.newPassword && (
                  <div className="mt-3 space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Password Requirements:</p>
                    <div className="space-y-1">
                      {passwordChecks.map((check, index) => (
                        <div key={index} className="flex items-center text-xs">
                          {check.met ? (
                            <CheckCircle className="h-3 w-3 text-success mr-2" />
                          ) : (
                            <AlertCircle className="h-3 w-3 text-muted-foreground mr-2" />
                          )}
                          <span className={check.met ? "text-success" : "text-muted-foreground"}>
                            {check.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                    placeholder="Confirm new password"
                    required
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                
                {formData.confirmPassword && formData.newPassword !== formData.confirmPassword && (
                  <p className="text-xs text-destructive flex items-center">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Passwords do not match
                  </p>
                )}
              </div>

              <Button
                type="submit"
                disabled={isLoading || !allChecksPassed}
                className="w-full btn-gradient text-lg py-6"
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Updating Password...
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-5 w-5" />
                    Update Password
                  </>
                )}
              </Button>
            </form>

            <div className="bg-muted/50 p-4 rounded-lg mt-6">
              <p className="text-xs text-muted-foreground">
                <strong>Security Tip:</strong> Choose a unique password that you don't use for other accounts. Consider using a password manager to generate and store strong passwords.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default GatedResetPassword;