import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Loader2, 
  Mail, 
  Building2,
  User,
  ArrowLeft,
  CheckCircle
} from 'lucide-react';

const GatedForgotPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formData, setFormData] = useState({
    businessRefNo: '',
    email: '',
    username: ''
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    const { businessRefNo, email, username } = formData;

    if (!businessRefNo.trim()) {
      toast({ title: "Business ID is required", variant: "destructive" });
      return false;
    }

    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      toast({ title: "Valid email address is required", variant: "destructive" });
      return false;
    }

    if (!username.trim()) {
      toast({ title: "Username is required", variant: "destructive" });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('forgot-password', {
        body: {
          businessRefNo: formData.businessRefNo.trim(),
          email: formData.email.trim(),
          username: formData.username.trim()
        }
      });

      if (error) throw error;

      if (data?.success) {
        setIsSuccess(true);
        toast({
          title: "Reset Link Sent!",
          description: "Please check your email for password reset instructions."
        });
      } else {
        throw new Error(data?.error || 'Failed to send reset link');
      }
    } catch (error: any) {
      toast({
        title: "Request Failed",
        description: error.message || "Please verify your information and try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="content-container w-full max-w-md mx-4">
          <Card className="shadow-elevated">
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-success" />
              </div>
              <CardTitle className="text-2xl text-success">Email Sent!</CardTitle>
              <CardDescription>
                Password reset instructions have been sent to your email
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <div className="bg-muted/50 p-4 rounded-lg text-left">
                <h4 className="font-medium mb-2">Next Steps:</h4>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Check your email inbox</li>
                  <li>Click the password reset link</li>
                  <li>Enter your new password</li>
                  <li>Sign in with your new credentials</li>
                </ol>
              </div>
              <p className="text-xs text-muted-foreground">
                The reset link will expire in 15 minutes. If you don't see the email, check your spam folder.
              </p>
              <Button 
                onClick={() => navigate('/gated-signin')}
                className="w-full"
              >
                Back to Sign In
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
            <Mail className="h-12 w-12 text-primary mx-auto mb-4" />
            <CardTitle className="text-3xl">Reset Password</CardTitle>
            <CardDescription className="text-lg">
              Enter your business details to receive a password reset link
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="businessRefNo" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Business ID
                </Label>
                <Input
                  id="businessRefNo"
                  value={formData.businessRefNo}
                  onChange={(e) => handleInputChange('businessRefNo', e.target.value)}
                  placeholder="BUS-20250827-ABC12"
                  required
                  className="font-mono"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Registered Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="business@example.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="username" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Username
                </Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                  placeholder="admin.user"
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full btn-gradient text-lg py-6"
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Sending Reset Link...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-5 w-5" />
                    Send Reset Link
                  </>
                )}
              </Button>
            </form>

            <div className="text-center mt-6">
              <Button
                variant="link"
                onClick={() => navigate('/gated-signin')}
                className="text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Sign In
              </Button>
            </div>

            <div className="bg-muted/50 p-4 rounded-lg mt-6">
              <p className="text-xs text-muted-foreground">
                <strong>Security Note:</strong> For your protection, we'll only send a reset link if all the provided information matches our records.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default GatedForgotPassword;