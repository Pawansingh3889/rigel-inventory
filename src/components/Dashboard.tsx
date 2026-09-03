import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useBusinessAuth } from '@/hooks/useBusinessAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { StatsCard } from '@/components/ui/stats-card';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  Package,
  ShoppingCart,
  FileText,
  CreditCard,
  BarChart3,
  MapPin,
  Bot,
  LogOut,
  User,
  Building2,
  Menu,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Activity,
  Plus,
  RotateCcw,
  Loader2
} from 'lucide-react';
import { InventoryModule } from '@/components/modules/InventoryModule';
import { PurchaseModule } from '@/components/modules/PurchaseModule';
import SalesModule from '@/components/modules/SalesModule';
import { PaymentsModule } from '@/components/modules/PaymentsModule';
import { ReportsModule } from '@/components/modules/ReportsModule';
import { TrackingModule } from '@/components/modules/TrackingModule';
import { AIAssistant } from '@/components/modules/AIAssistant';
import { CompanyProfile } from '@/components/CompanyProfile';
import { ReturnsModule } from '@/components/modules/ReturnsModule';

type ActiveModule = 'dashboard' | 'inventory' | 'purchase' | 'sales' | 'returns' | 'payments' | 'reports' | 'tracking' | 'ai' | 'users' | 'profile';

export default function Dashboard() {
  const { user, profile, company, signOut, loading } = useAuth();
  // Call all hooks unconditionally at the top to preserve hook order
  const { hasAccess, isOwnerOrAdmin } = useBusinessAuth();
  const [activeModule, setActiveModule] = useState<ActiveModule>('dashboard');
  const [inventoryStats, setInventoryStats] = useState({
    totalSKUs: 0,
    totalUnits: 0,
    totalCost: 0
  });

  // Navigation handler to convert string to ActiveModule
  const handleNavigation = (view: string) => {
    if (view === 'dashboard' || view === 'inventory' || view === 'purchase' || view === 'sales' || 
        view === 'returns' || view === 'payments' || view === 'reports' || view === 'tracking' || 
        view === 'ai' || view === 'users' || view === 'profile') {
      setActiveModule(view as ActiveModule);
    }
  };

  // moved early returns below hooks

  useEffect(() => {
    if (activeModule === 'dashboard' && user) {
      fetchInventoryStats();
    }
  }, [activeModule, user]);

  const fetchInventoryStats = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('stock_quantity, cost_price, is_active');

      if (error) {
        console.error('Error fetching inventory stats:', error);
        return;
      }

      const activeProducts = data?.filter(product => product.is_active) || [];
      const totalSKUs = activeProducts.length;
      const totalUnits = activeProducts.reduce((sum, product) => sum + (product.stock_quantity || 0), 0);
      const totalCost = activeProducts.reduce((sum, product) => sum + ((product.stock_quantity || 0) * (product.cost_price || 0)), 0);

      setInventoryStats({
        totalSKUs,
        totalUnits,
        totalCost
      });
    } catch (error) {
      console.error('Error fetching inventory stats:', error);
    }
  };

  console.log('Dashboard render:', { user: !!user, profile: !!profile, company: !!company, loading, activeModule });

  // Early returns AFTER hooks are declared to preserve hook order
  if (loading) {
    console.log('Dashboard loading...');
    return (
      <div className="min-h-screen flex items-center justify-center" role="status" aria-live="polite">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
        <span className="sr-only">Loading your workspace</span>
      </div>
    );
  }

  if (!user) {
    console.log('No user, redirecting to auth');
    return <Navigate to="/auth" replace />;
  }

  const renderActiveModule = () => {
    console.log('Rendering active module:', activeModule);
    
    switch (activeModule) {
      case 'inventory':
        if (!hasAccess('inventory')) {
          return (
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-muted-foreground mb-2">Access Denied</h2>
                <p className="text-muted-foreground">You don't have permission to access Inventory.</p>
                <Button onClick={() => setActiveModule('dashboard')} className="mt-4">Back to Dashboard</Button>
              </div>
            </div>
          );
        }
        return (
          <DashboardLayout
            title="Inventory Management"
            subtitle="Manage your products and stock levels"
            showWelcome={false}
            activeView="inventory"
            onNavigate={handleNavigation}
            headerActions={
              <Button onClick={() => setActiveModule('dashboard')} variant="outline">
                Back to Dashboard
              </Button>
            }
          >
            <InventoryModule />
          </DashboardLayout>
        );
      case 'purchase':
        return (
          <DashboardLayout
            title="Purchase Orders"
            subtitle="Create and manage purchase orders"
            activeView="purchase"
            onNavigate={handleNavigation}
            headerActions={
              <Button onClick={() => setActiveModule('dashboard')} variant="outline">
                Back to Dashboard
              </Button>
            }
          >
            <PurchaseModule />
          </DashboardLayout>
        );
      case 'sales':
        return (
          <DashboardLayout
            title="Sales Orders"
            subtitle="Process sales and manage customers"
            activeView="sales"
            onNavigate={handleNavigation}
            headerActions={
              <Button onClick={() => setActiveModule('dashboard')} variant="outline">
                Back to Dashboard
              </Button>
            }
          >
            <SalesModule />
          </DashboardLayout>
        );
      case 'returns':
        return (
          <DashboardLayout
            title="Returns Management"
            subtitle="Handle return orders and credit notes"
            activeView="returns"
            onNavigate={handleNavigation}
            headerActions={
              <Button onClick={() => setActiveModule('dashboard')} variant="outline">
                Back to Dashboard
              </Button>
            }
          >
            <ReturnsModule />
          </DashboardLayout>
        );
      case 'payments':
        return (
          <DashboardLayout
            title="Payment Management"
            subtitle="Track payments and financial transactions"
            activeView="payments"
            onNavigate={handleNavigation}
            headerActions={
              <Button onClick={() => setActiveModule('dashboard')} variant="outline">
                Back to Dashboard
              </Button>
            }
          >
            <PaymentsModule />
          </DashboardLayout>
        );
      case 'reports':
        return (
          <DashboardLayout
            title="Reports & Analytics"
            subtitle="View business insights and reports"
            activeView="reports"
            onNavigate={handleNavigation}
            headerActions={
              <Button onClick={() => setActiveModule('dashboard')} variant="outline">
                Back to Dashboard
              </Button>
            }
          >
            <ReportsModule />
          </DashboardLayout>
        );
      case 'tracking':
        return (
          <DashboardLayout
            title="Track & Trace"
            subtitle="Monitor order status and shipments"
            activeView="tracking"
            onNavigate={handleNavigation}
            headerActions={
              <Button onClick={() => setActiveModule('dashboard')} variant="outline">
                Back to Dashboard
              </Button>
            }
          >
            <TrackingModule />
          </DashboardLayout>
        );
      case 'ai':
        return (
          <DashboardLayout
            title="AI Assistant"
            subtitle="Get intelligent business insights and assistance"
            activeView="ai"
            onNavigate={handleNavigation}
            headerActions={
              <Button onClick={() => setActiveModule('dashboard')} variant="outline">
                Back to Dashboard
              </Button>
            }
          >
            <AIAssistant />
          </DashboardLayout>
        );
      case 'users':
        // Navigate to User Management page instead of forcing a full reload
        return <Navigate to="/user-management" replace />;
      case 'profile':
        return (
          <DashboardLayout
            title="Company Profile"
            subtitle="Manage your company information and settings"
            activeView="profile"
            onNavigate={handleNavigation}
            headerActions={
              <Button onClick={() => setActiveModule('dashboard')} variant="outline">
                Back to Dashboard
              </Button>
            }
          >
            <CompanyProfile />
          </DashboardLayout>
        );
      default:
        return (
          <div className="space-y-6">
            {/* Key Metrics Grid - Mobile Optimized */}
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 stagger-animation">
              <StatsCard
                title="Total Revenue"
                value="$0"
                subtitle="Start selling to see revenue"
                icon={DollarSign}
                variant="primary"
                trend={{ value: 0, label: "from last month" }}
              />
              
              <StatsCard
                title="Active Products"
                value="0"
                subtitle="No products added yet"
                icon={Package}
                variant="secondary"
              />
              
              <StatsCard
                title="Orders Today"
                value="0"
                subtitle="No orders yet"
                icon={ShoppingCart}
                variant="accent"
              />
              
              <StatsCard
                title="Inventory"
                value={`${inventoryStats.totalSKUs} SKUs`}
                subtitle={`Total Units: ${inventoryStats.totalUnits} | Total Cost: ₹${inventoryStats.totalCost.toFixed(2)}`}
                icon={Package}
                variant="default"
              />
            </div>

            {/* Quick Actions Grid - Mobile Optimized */}
            <div className="grid gap-3 sm:gap-4 grid-cols-1 lg:grid-cols-3">
              {/* Inventory Card */}
              <Card className="card-interactive card-elevated">
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 sm:p-3 rounded-xl bg-primary/10 text-primary flex-shrink-0">
                      <Package className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base sm:text-lg">Inventory Management</CardTitle>
                      <CardDescription className="text-sm">Manage products and stock levels</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <Button 
                    onClick={() => setActiveModule('inventory')}
                    className="w-full btn-gradient min-h-[48px] text-sm sm:text-base"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Products
                  </Button>
                </CardContent>
              </Card>

              {/* Purchase Card */}
              <Card className="card-interactive card-elevated">
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 sm:p-3 rounded-xl bg-secondary/10 text-secondary flex-shrink-0">
                      <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base sm:text-lg">Purchase Orders</CardTitle>
                      <CardDescription className="text-sm">Create and manage purchase orders</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <Button 
                    onClick={() => setActiveModule('purchase')}
                    variant="outline"
                    className="w-full min-h-[48px] text-sm sm:text-base"
                  >
                    Create Order
                  </Button>
                </CardContent>
              </Card>

              {/* Sales Card */}
              <Card className="card-interactive card-elevated">
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 sm:p-3 rounded-xl bg-accent/10 text-accent flex-shrink-0">
                      <FileText className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base sm:text-lg">Sales Orders</CardTitle>
                      <CardDescription className="text-sm">Process sales and invoicing</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <Button 
                    onClick={() => setActiveModule('sales')}
                    variant="outline"
                    className="w-full min-h-[48px] text-sm sm:text-base"
                  >
                    New Sale
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Business Insights - Mobile Optimized */}
            <div className="grid gap-3 sm:gap-4 grid-cols-1 lg:grid-cols-2">
              <Card className="card-elevated">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <Activity className="h-4 w-4 sm:h-5 sm:w-5" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-6 sm:py-8 text-muted-foreground">
                    <Activity className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 opacity-50" />
                    <p className="text-sm sm:text-base">No recent activity</p>
                    <p className="text-xs sm:text-sm">Your business activities will appear here</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-elevated">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <Bot className="h-4 w-4 sm:h-5 sm:w-5" />
                    AI Assistant
                  </CardTitle>
                  <CardDescription className="text-sm">Get insights and assistance</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 sm:space-y-4">
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Ask me anything about your business operations, analytics, or how to use this system.
                    </p>
                    <Button 
                      onClick={() => setActiveModule('ai')}
                      className="w-full min-h-[48px] text-sm sm:text-base"
                      variant="outline"
                    >
                      <Bot className="h-4 w-4 mr-2" />
                      Start Conversation
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        );
    }
  };

  console.log('About to render main dashboard layout');

  // For dashboard view, use DashboardLayout with navigation sidebar
  if (activeModule === 'dashboard') {
    return (
      <DashboardLayout
        title="Dashboard"
        subtitle="Overview & Analytics"
        activeView="dashboard"
        onNavigate={handleNavigation}
        showWelcome={false}
      >
        {renderActiveModule()}
      </DashboardLayout>
    );
  }

  // For other modules, render them directly (they handle their own layout)
  return renderActiveModule();
}