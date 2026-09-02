import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Users, Package, TrendingUp, Shield, Globe, ArrowRight, Building2, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Index = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: Building2,
      title: "Multi-Business Support",
      description: "Manage multiple businesses under one account with separate data isolation."
    },
    {
      icon: Package,
      title: "Advanced Inventory Tracking",
      description: "Real-time stock levels, automatic reorder points, and comprehensive reporting."
    },
    {
      icon: Users,
      title: "Vendor Management",
      description: "Streamline supplier relationships with integrated purchase order management."
    },
    {
      icon: Shield,
      title: "Role-Based Access Control",
      description: "Secure user management with customizable permissions for team members."
    },
    {
      icon: TrendingUp,
      title: "Analytics & Reports",
      description: "Powerful insights with customizable dashboards and detailed analytics."
    },
    {
      icon: Globe,
      title: "Cloud-Based Access",
      description: "Access your inventory data securely from anywhere, anytime."
    }
  ];

  const pricingPlans = [
    {
      name: "Monthly",
      price: "₹2,500",
      period: "/month",
      description: "Perfect for getting started",
      features: [
        "Unlimited products & inventory",
        "Multi-business support",
        "Role-based access control",
        "Advanced reporting",
        "Email support",
        "Cloud backup"
      ],
      popular: false,
      planType: "monthly"
    },
    {
      name: "Yearly",
      price: "₹24,000",
      period: "/year",
      description: "Best value - Save ₹6,000 annually",
      features: [
        "Everything in Monthly plan",
        "Priority support",
        "Advanced analytics",
        "Custom integrations",
        "Dedicated account manager",
        "Free data migration"
      ],
      popular: true,
      planType: "yearly"
    }
  ];

  const handleSubscribe = (planType: string) => {
    navigate(`/subscribe/${planType}`);
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="content-container section-padding">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Package className="h-8 w-8 text-primary" />
              <span className="text-2xl font-bold text-foreground">InventoryPro</span>
            </div>
            <Button onClick={() => navigate('/auth')} variant="outline">
              Sign In
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="section-padding py-20">
        <div className="content-container">
          <div className="text-center space-y-6 animate-fade-up">
            <Badge variant="secondary" className="mb-4">
              Trusted by 1000+ businesses
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold text-foreground max-w-4xl mx-auto">
              Transform Your Inventory Management
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Streamline operations, reduce costs, and boost efficiency with our comprehensive 
              inventory management solution designed for modern businesses.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
              <Button 
                size="lg" 
                className="btn-gradient text-lg px-8"
                onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Get Started <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" className="text-lg px-8">
                Watch Demo
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="section-padding py-20 bg-muted/30">
        <div className="content-container">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Everything You Need to Succeed
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Powerful features designed to streamline your inventory operations
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 stagger-animation">
            {features.map((feature, index) => (
              <Card key={index} className="card-interactive border-0 shadow-card">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="section-padding py-20">
        <div className="content-container">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Choose the plan that works best for your business
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {pricingPlans.map((plan, index) => (
              <Card 
                key={index} 
                className={`card-interactive relative ${
                  plan.popular 
                    ? 'border-primary shadow-elevated ring-2 ring-primary/20' 
                    : 'border-border shadow-card'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground">
                      <Star className="w-3 h-3 mr-1" />
                      Most Popular
                    </Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-8">
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                  <CardDescription className="text-base mt-2">
                    {plan.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {plan.features.map((feature, featureIndex) => (
                    <div key={featureIndex} className="flex items-center space-x-3">
                      <Check className="h-5 w-5 text-success flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </CardContent>
                <CardFooter>
                  <Button 
                    className={`w-full text-lg ${
                      plan.popular ? 'btn-gradient' : ''
                    }`}
                    variant={plan.popular ? "default" : "outline"}
                    size="lg"
                    onClick={() => handleSubscribe(plan.planType)}
                  >
                    Subscribe Now
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/50">
        <div className="content-container section-padding">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <Package className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold">InventoryPro</span>
            </div>
            <p className="text-muted-foreground">
              © 2024 InventoryPro. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;