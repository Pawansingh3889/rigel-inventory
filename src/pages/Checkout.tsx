import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { 
  CheckCircle, 
  Shield, 
  Users, 
  BarChart3, 
  FileText, 
  CreditCard,
  Loader2 
} from 'lucide-react';

const Checkout = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const features = [
    { icon: Users, text: "Multi-user business access" },
    { icon: BarChart3, text: "Advanced reporting & analytics" },
    { icon: FileText, text: "Document management" },
    { icon: Shield, text: "Enterprise-grade security" },
  ];

  const handlePayment = async () => {
    setIsProcessing(true);
    
    // Simulate payment processing (2 seconds)
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Always simulate success
    const paymentStatus = "SUCCESS";
    
    toast({
      title: "✅ Payment successful!",
      description: "Please complete your Business Registration.",
    });
    
    // Direct client-side navigation
    setTimeout(() => {
      navigate('/register/business?txn=DEV-SUCCESS');
    }, 1000);
    
    setIsProcessing(false);
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <div className="content-container section-padding py-20">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <Badge variant="secondary" className="mb-4">
              Secure Checkout
            </Badge>
            <h1 className="text-4xl font-bold mb-4">Complete Your Purchase</h1>
            <p className="text-xl text-muted-foreground">
              Join thousands of businesses already using our platform
            </p>
          </div>

          <Card className="shadow-elevated">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Business Plan</span>
                <Badge className="bg-primary">Most Popular</Badge>
              </CardTitle>
              <CardDescription>
                Everything you need to manage your business operations
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Pricing */}
              <div className="text-center py-6 bg-muted/30 rounded-lg">
                <div className="text-4xl font-bold text-primary">₹2,999</div>
                <div className="text-muted-foreground">per month</div>
                <div className="text-sm text-muted-foreground mt-2">
                  Cancel anytime • 30-day money back guarantee
                </div>
              </div>

              <Separator />

              {/* Features */}
              <div>
                <h3 className="font-semibold mb-4 flex items-center">
                  <CheckCircle className="h-5 w-5 text-success mr-2" />
                  What's Included
                </h3>
                <div className="grid grid-cols-1 gap-3">
                  {features.map((feature, index) => (
                    <div key={index} className="flex items-center text-sm">
                      <feature.icon className="h-4 w-4 text-primary mr-3" />
                      {feature.text}
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Payment Security */}
              <div className="flex items-center justify-center space-x-4 text-sm text-muted-foreground">
                <div className="flex items-center">
                  <Shield className="h-4 w-4 mr-1" />
                  Secure Payment
                </div>
                <div className="flex items-center">
                  <CreditCard className="h-4 w-4 mr-1" />
                  256-bit SSL
                </div>
              </div>

              {/* Payment Button */}
              <Button
                onClick={handlePayment}
                disabled={isProcessing}
                className="w-full btn-gradient text-lg py-6"
                size="lg"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Processing Payment...
                  </>
                ) : (
                  <>
                    <CreditCard className="mr-2 h-5 w-5" />
                    Pay Securely - ₹2,999
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                By clicking "Pay Securely", you agree to our Terms of Service and Privacy Policy.
                You will be charged ₹2,999 monthly until you cancel.
              </p>
            </CardContent>
          </Card>

          {/* Back to Plans */}
          <div className="text-center mt-6">
            <Button
              variant="ghost"
              onClick={() => navigate('/')}
              disabled={isProcessing}
            >
              ← Back to Plans
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;