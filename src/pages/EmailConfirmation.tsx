import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, XCircle, Loader2, Mail } from 'lucide-react';

const EmailConfirmation = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const token = searchParams.get('token');
  const email = searchParams.get('email');

  useEffect(() => {
    const verifyEmail = async () => {
      if (!token || !email) {
        setError('Invalid confirmation link');
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('verify-email-confirmation', {
          body: {
            email: decodeURIComponent(email),
            token
          }
        });

        if (error) throw error;

        if (data?.success) {
          setIsVerified(true);
          toast({
            title: "Email Confirmed!",
            description: "You can now complete your business registration."
          });
        } else {
          throw new Error(data?.error || 'Email verification failed');
        }
      } catch (error: any) {
        setError(error.message);
        toast({
          title: "Verification Failed",
          description: error.message,
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    verifyEmail();
  }, [token, email, toast]);

  const handleContinue = () => {
    navigate('/register/business?txn=DEV-SUCCESS&email_verified=true');
  };

  const handleResend = () => {
    navigate('/register/business?txn=DEV-SUCCESS');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <Card className="max-w-md mx-4 shadow-elevated">
          <CardHeader className="text-center">
            <Loader2 className="h-12 w-12 text-primary mx-auto mb-4 animate-spin" />
            <CardTitle>Verifying Email</CardTitle>
            <CardDescription>
              Please wait while we confirm your email address...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
      <Card className="max-w-md mx-4 shadow-elevated">
        <CardHeader className="text-center">
          {isVerified ? (
            <>
              <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-success" />
              </div>
              <CardTitle className="text-2xl text-success">Email Confirmed!</CardTitle>
              <CardDescription>
                Your email address has been successfully verified
              </CardDescription>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle className="h-8 w-8 text-destructive" />
              </div>
              <CardTitle className="text-2xl text-destructive">Verification Failed</CardTitle>
              <CardDescription>
                {error || 'Unable to verify your email address'}
              </CardDescription>
            </>
          )}
        </CardHeader>
        
        <CardContent className="text-center space-y-4">
          {isVerified ? (
            <Button onClick={handleContinue} className="w-full btn-gradient">
              Continue Registration
            </Button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                The confirmation link may have expired or been used already.
              </p>
              <Button onClick={handleResend} variant="outline" className="w-full">
                <Mail className="mr-2 h-4 w-4" />
                Request New Confirmation
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailConfirmation;