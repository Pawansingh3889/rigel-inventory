import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeft, Check, CreditCard } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';


const Subscribe = () => {
  const { planType } = useParams<{ planType: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const planDetails = {
    monthly: {
      name: "Monthly Plan",
      price: "₹2,500",
      period: "/month",
      amount: 2500,
      description: "Perfect for getting started"
    },
    yearly: {
      name: "Yearly Plan", 
      price: "₹24,000",
      period: "/year",
      amount: 24000,
      description: "Best value - Save ₹6,000 annually"
    }
  };

  const currentPlan = planDetails[planType as keyof typeof planDetails];

  if (!currentPlan) {
    navigate('/');
    return null;
  }

  const handlePayment = async () => {
    setIsLoading(true);

    // Simulate payment processing (2 seconds)
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Always simulate success
    const paymentStatus = "SUCCESS";

    toast({
      title: "✅ Payment successful!",
      description: "Please complete your Business Registration.",
    });

    // Redirect to business registration
    setTimeout(() => {
      navigate('/register/business?txn=DEV-SUCCESS');
    }, 1000);

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <div className="content-container section-padding py-20">
        <div className="max-w-2xl mx-auto">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/')}
            className="mb-8"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Plans
          </Button>

          <Card className="shadow-elevated">
            <CardHeader className="text-center">
              <Badge variant="secondary" className="w-fit mx-auto mb-4">
                Selected Plan
              </Badge>
              <CardTitle className="text-3xl">{currentPlan.name}</CardTitle>
              <div className="mt-4">
                <span className="text-5xl font-bold text-primary">{currentPlan.price}</span>
                <span className="text-muted-foreground text-lg">{currentPlan.period}</span>
              </div>
              <CardDescription className="text-lg mt-4">
                {currentPlan.description}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="bg-muted/50 p-6 rounded-lg">
                <h3 className="font-semibold mb-4">What's Included:</h3>
                <div className="space-y-3">
                  {[
                    "Unlimited products & inventory tracking",
                    "Multi-business support",
                    "Role-based access control", 
                    "Advanced reporting & analytics",
                    "Email support",
                    "Cloud backup & security",
                    ...(planType === 'yearly' ? [
                      "Priority support",
                      "Custom integrations",
                      "Dedicated account manager"
                    ] : [])
                  ].map((feature, index) => (
                    <div key={index} className="flex items-center space-x-3">
                      <Check className="h-5 w-5 text-success flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-6">
                <div className="flex justify-between items-center text-lg font-semibold mb-6">
                  <span>Total Amount:</span>
                  <span className="text-primary">{currentPlan.price}</span>
                </div>

                <Button 
                  className="w-full btn-gradient text-lg py-6"
                  size="lg"
                  onClick={handlePayment}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Processing Payment...
                    </>
                  ) : (
                    <>
                      <CreditCard className="mr-2 h-5 w-5" />
                      Pay Securely
                    </>
                  )}
                </Button>

                <p className="text-xs text-muted-foreground text-center mt-4">
                  Secure payment processing. Your card information is encrypted and protected.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Subscribe;