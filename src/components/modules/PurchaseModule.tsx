import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useBusinessAuth } from '@/hooks/useBusinessAuth';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { Plus, Truck, ShoppingCart, Building2, Package, TrendingUp, AlertCircle, BarChart3 } from 'lucide-react';
import { SupplierForm } from '@/components/forms/SupplierForm';
import { SupplierTable } from '@/components/tables/SupplierTable';
import { PurchaseOrderForm } from '@/components/forms/PurchaseOrderForm';
import { PurchaseOrderTable } from '@/components/tables/PurchaseOrderTable';
import { GRNForm } from '@/components/forms/GRNForm';
import { GRNTable } from '@/components/tables/GRNTable';
import { PurchaseOrderDetailsDialog } from '@/components/dialogs/PurchaseOrderDetailsDialog';
import { StatsCard } from '@/components/ui/stats-card';
import { MobileOptimizedModule } from '@/components/ui/mobile-optimized-module';
import { PullToRefresh } from '@/components/ui/pull-to-refresh';
import { LoadingWrapper, StatsSkeleton, TableSkeleton } from '@/components/ui/loading-skeleton';

interface Supplier {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  contact_person: string | null;
  gst_number: string | null;
  is_active: boolean;
  created_at: string;
}

interface PurchaseOrder {
  id: string;
  po_number: string;
  status: string;
  order_date: string;
  expected_date?: string;
  total_amount: number;
  currency: string;
  supplier: {
    name: string;
  };
  created_at: string;
  notes?: string;
}

export function PurchaseModule() {
  const { user, profile } = useAuth();
  const { hasEditAccess } = useBusinessAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const canEdit = hasEditAccess('purchases');
  
  // State management
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [grns, setGRNs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Stats state
  const [stats, setStats] = useState({
    openPOs: { count: 0, value: 0 },
    recentGRNs: { count: 0, value: 0 },
    overduePOs: { count: 0, value: 0, details: [] as any[] }
  });
  
  // Dialog states
  const [showAddSupplierDialog, setShowAddSupplierDialog] = useState(false);
  const [showEditSupplierDialog, setShowEditSupplierDialog] = useState(false);
  const [showViewSupplierDialog, setShowViewSupplierDialog] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [showAddPODialog, setShowAddPODialog] = useState(false);
  const [showEditPODialog, setShowEditPODialog] = useState(false);
  const [showViewPODialog, setShowViewPODialog] = useState(false);
  const [selectedPO, setSelectedPO] = useState<any>(null);
  const [showAddGRNDialog, setShowAddGRNDialog] = useState(false);
  const [showEditGRNDialog, setShowEditGRNDialog] = useState(false);
  const [showViewGRNDialog, setShowViewGRNDialog] = useState(false);
  const [selectedGRN, setSelectedGRN] = useState<any>(null);
  const [refreshGRNTrigger, setRefreshGRNTrigger] = useState(0);

  // Fetch data
  useEffect(() => {
    if (profile?.company_id) {
      fetchSuppliers();
      fetchPurchaseOrders();
      fetchGRNs();
      fetchStats();
    }
  }, [profile?.company_id]);

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('company_id', profile?.company_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  const fetchPurchaseOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          supplier:suppliers(name),
          purchase_order_items:purchase_order_items(*)
        `)
        .eq('company_id', profile?.company_id)
        .order('order_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPurchaseOrders(data || []);
    } catch (error) {
      console.error('Error fetching purchase orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGRNs = async () => {
    try {
      const { data, error } = await supabase
        .from('grn_header')
        .select(`
          *,
          grn_line_items(*)
        `)
        .eq('company_id', profile?.company_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setGRNs(data || []);
    } catch (error) {
      console.error('Error fetching GRNs:', error);
      toast({
        title: "Error",
        description: "Failed to fetch GRNs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    if (!profile?.company_id) return;

    try {
      // Fetch open PO stats
      const { data: openPOs, error: openPOError } = await supabase
        .from('purchase_orders')
        .select('total_amount')
        .eq('company_id', profile.company_id)
        .in('status', ['draft', 'open', 'partially_received']);

      if (openPOError) throw openPOError;

      const openPOStats = {
        count: openPOs?.length || 0,
        value: openPOs?.reduce((sum, po) => sum + (po.total_amount || 0), 0) || 0
      };

      // Fetch recent GRN stats (last 15 days)
      const fifteenDaysAgo = new Date();
      fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
      
      const { data: recentGRNs, error: grnError } = await supabase
        .from('grn_header')
        .select('total_amount')
        .eq('company_id', profile.company_id)
        .gte('created_at', fifteenDaysAgo.toISOString());

      if (grnError) throw grnError;

      const recentGRNStats = {
        count: recentGRNs?.length || 0,
        value: recentGRNs?.reduce((sum, grn) => sum + (grn.total_amount || 0), 0) || 0
      };

      // Fetch overdue POs
      const today = new Date().toISOString().split('T')[0];
      const { data: overduePOs, error: overdueError } = await supabase
        .from('purchase_orders')
        .select(`
          po_number,
          total_amount,
          expected_date,
          supplier:suppliers(name)
        `)
        .eq('company_id', profile.company_id)
        .lt('expected_date', today)
        .neq('status', 'closed');

      if (overdueError) throw overdueError;

      const overduePOStats = {
        count: overduePOs?.length || 0,
        value: overduePOs?.reduce((sum, po) => sum + (po.total_amount || 0), 0) || 0,
        details: overduePOs || []
      };

      setStats({
        openPOs: openPOStats,
        recentGRNs: recentGRNStats,
        overduePOs: overduePOStats
      });

    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  // Supplier handlers
  const handleAddSupplier = async (supplierData: any) => {
    try {
      const { error } = await supabase
        .from('suppliers')
        .insert({
          ...supplierData,
          company_id: profile?.company_id
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Supplier added successfully",
      });

      setShowAddSupplierDialog(false);
      fetchSuppliers();
    } catch (error) {
      console.error('Error adding supplier:', error);
      toast({
        title: "Error",
        description: "Failed to add supplier",
        variant: "destructive",
      });
    }
  };

  const handleEditSupplier = async (supplierData: any) => {
    if (!selectedSupplier) return;

    try {
      const { error } = await supabase
        .from('suppliers')
        .update(supplierData)
        .eq('id', selectedSupplier.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Supplier updated successfully",
      });

      setShowEditSupplierDialog(false);
      setSelectedSupplier(null);
      fetchSuppliers();
    } catch (error) {
      console.error('Error updating supplier:', error);
      toast({
        title: "Error",
        description: "Failed to update supplier",
        variant: "destructive",
      });
    }
  };

  const handleDeleteSupplier = async (supplierId: string) => {
    if (!confirm('Are you sure you want to delete this supplier?')) return;

    try {
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', supplierId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Supplier deleted successfully",
      });

      fetchSuppliers();
    } catch (error) {
      console.error('Error deleting supplier:', error);
      toast({
        title: "Error",
        description: "Failed to delete supplier",
        variant: "destructive",
      });
    }
  };

  // Purchase Order handlers
  const handleAddPurchaseOrder = async (poData: any) => {
    try {
      // Separate items from purchase order data
      const { items, ...purchaseOrderData } = poData;
      
      // Generate PO number if not provided
      if (!purchaseOrderData.po_number) {
        const { data: poNumber, error: poNumberError } = await supabase
          .rpc('generate_po_number', { comp_id: profile?.company_id });
        
        if (poNumberError) throw poNumberError;
        purchaseOrderData.po_number = poNumber;
      }

      const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .insert({
          ...purchaseOrderData,
          company_id: profile?.company_id,
          created_by: profile?.id,
        })
        .select()
        .single();

      if (poError) throw poError;

      if (items && items.length > 0) {
        const { error: itemsError } = await supabase
          .from('purchase_order_items')
          .insert(
            items.map((item: any) => ({
              ...item,
              purchase_order_id: po.id,
            }))
          );

        if (itemsError) throw itemsError;
      }

      toast({
        title: "Success",
        description: "Purchase order created successfully",
      });

      setShowAddPODialog(false);
      fetchPurchaseOrders();
    } catch (error) {
      console.error('Error creating purchase order:', error);
      toast({
        title: "Error",
        description: "Failed to create purchase order",
        variant: "destructive",
      });
    }
  };

  const handleEditPurchaseOrder = async (poData: any) => {
    if (!selectedPO) return;

    try {
      // Separate items from purchase order data
      const { items, ...purchaseOrderData } = poData;
      
      const { error: poError } = await supabase
        .from('purchase_orders')
        .update(purchaseOrderData)
        .eq('id', selectedPO.id);

      if (poError) throw poError;

      if (items && items.length > 0) {
        // Delete existing items
        const { error: deleteError } = await supabase
          .from('purchase_order_items')
          .delete()
          .eq('purchase_order_id', selectedPO.id);

        if (deleteError) throw deleteError;

        // Insert updated items
        const { error: itemsError } = await supabase
          .from('purchase_order_items')
          .insert(
            items.map((item: any) => ({
              ...item,
              purchase_order_id: selectedPO.id,
            }))
          );

        if (itemsError) throw itemsError;
      }

      toast({
        title: "Success",
        description: "Purchase order updated successfully",
      });

      setShowEditPODialog(false);
      setSelectedPO(null);
      fetchPurchaseOrders();
    } catch (error) {
      console.error('Error updating purchase order:', error);
      toast({
        title: "Error",
        description: "Failed to update purchase order",
        variant: "destructive",
      });
    }
  };

  const handleDeletePurchaseOrder = async (poId: string) => {
    if (!confirm('Are you sure you want to delete this purchase order?')) return;

    try {
      const { error } = await supabase
        .from('purchase_orders')
        .delete()
        .eq('id', poId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Purchase order deleted successfully",
      });

      fetchPurchaseOrders();
    } catch (error) {
      console.error('Error deleting purchase order:', error);
      toast({
        title: "Error",
        description: "Failed to delete purchase order",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto px-6 pt-8 relative z-10">
        {/* Enhanced Stats Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="group hover:scale-105 transition-all duration-300 animate-fade-in">
            <Card className="border-0 shadow-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-transparent"></div>
              <CardContent className="p-6 relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                    <ShoppingCart className="h-8 w-8" />
                  </div>
                  <TrendingUp className="h-5 w-5 text-blue-200" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-blue-100">Open Purchase Orders</h3>
                  <div className="text-3xl font-bold">{stats.openPOs.count}</div>
                  <p className="text-sm text-blue-200">₹{stats.openPOs.value.toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="group hover:scale-105 transition-all duration-300 animate-fade-in delay-100">
            <Card className="border-0 shadow-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/20 to-transparent"></div>
              <CardContent className="p-6 relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                    <Package className="h-8 w-8" />
                  </div>
                  <BarChart3 className="h-5 w-5 text-emerald-200" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-emerald-100">Recent GRNs (15 days)</h3>
                  <div className="text-3xl font-bold">{stats.recentGRNs.count}</div>
                  <p className="text-sm text-emerald-200">₹{stats.recentGRNs.value.toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="group hover:scale-105 transition-all duration-300 animate-fade-in delay-200">
            <Card className="border-0 shadow-xl bg-gradient-to-br from-red-500 to-red-600 text-white overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-r from-red-400/20 to-transparent"></div>
              <CardContent className="p-6 relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                    <AlertCircle className="h-8 w-8" />
                  </div>
                  <div className="animate-pulse">
                    <div className="h-2 w-2 bg-red-200 rounded-full"></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-red-100">Overdue Purchase Orders</h3>
                  <div className="text-3xl font-bold">{stats.overduePOs.count}</div>
                  <p className="text-xs text-red-200 line-clamp-2">
                    {stats.overduePOs.details.length > 0 
                      ? `${stats.overduePOs.details.slice(0, 2).map((po: any) => `${po.po_number} (${po.supplier?.name || 'Unknown'})`).join(', ')}${stats.overduePOs.details.length > 2 ? '...' : ''}`
                      : `₹${stats.overduePOs.value.toLocaleString()}`
                    }
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Enhanced Tabs Section */}
        <Card className="shadow-2xl border-0 bg-white/80 backdrop-blur-sm animate-fade-in delay-300">
          <CardContent className="p-0">
            <Tabs defaultValue="suppliers" className="w-full">
              <div className="bg-gradient-to-r from-slate-50 to-slate-100 px-6 py-4 border-b">
                <TabsList className="grid w-full grid-cols-3 bg-white shadow-lg border-0 p-1 rounded-xl">
                  <TabsTrigger 
                    value="suppliers" 
                    className="flex items-center gap-3 px-6 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300"
                  >
                    <Building2 className="h-4 w-4" />
                    <span className="font-medium">Suppliers</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="purchase-orders" 
                    className="flex items-center gap-3 px-6 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300"
                  >
                    <ShoppingCart className="h-4 w-4" />
                    <span className="font-medium">Purchase Orders</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="grn" 
                    className="flex items-center gap-3 px-6 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300"
                  >
                    <Package className="h-4 w-4" />
                    <span className="font-medium">Goods Receipt Notes</span>
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Suppliers Tab */}
              <TabsContent value="suppliers" className="mt-0">
                <div className="bg-gradient-to-br from-blue-50/50 to-indigo-50/50 p-8">
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 mb-8">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Building2 className="h-6 w-6 text-blue-600" />
                        </div>
                        <h2 className="text-3xl font-bold text-gray-900">Suppliers</h2>
                      </div>
                      <p className="text-gray-600 text-lg">Manage your supplier relationships and vendor information</p>
                    </div>
                    {canEdit && (
                      <Button 
                        onClick={() => setShowAddSupplierDialog(true)} 
                        className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl transition-all duration-300 px-6 py-3 text-lg gap-3"
                      >
                        <Plus className="h-5 w-5" />
                        Add New Supplier
                      </Button>
                    )}
                  </div>
                  <div className="bg-white rounded-xl shadow-lg border-0">
                    <SupplierTable
                      suppliers={suppliers}
                      onView={(supplier) => {
                        setSelectedSupplier(supplier);
                        setShowViewSupplierDialog(true);
                      }}
                      onEdit={canEdit ? (supplier) => {
                        setSelectedSupplier(supplier);
                        setShowEditSupplierDialog(true);
                      } : undefined}
                      onCreate={() => setShowAddSupplierDialog(true)}
                      onDelete={canEdit ? async (supplierId) => {
                        if (!confirm('Are you sure you want to delete this supplier?')) return;
                        try {
                          const { error } = await supabase.from('suppliers').delete().eq('id', supplierId);
                          if (error) throw error;
                          toast({ title: "Success", description: "Supplier deleted successfully" });
                          fetchSuppliers();
                        } catch (error) {
                          console.error('Error deleting supplier:', error);
                          toast({ title: "Error", description: "Failed to delete supplier", variant: "destructive" });
                        }
                      } : undefined}
                      loading={loading}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Purchase Orders Tab */}
              <TabsContent value="purchase-orders" className="mt-0">
                <div className="bg-gradient-to-br from-emerald-50/50 to-green-50/50 p-8">
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 mb-8">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 rounded-lg">
                          <ShoppingCart className="h-6 w-6 text-emerald-600" />
                        </div>
                        <h2 className="text-3xl font-bold text-gray-900">Purchase Orders</h2>
                      </div>
                      <p className="text-gray-600 text-lg">Create and manage purchase orders for your suppliers</p>
                    </div>
                    {canEdit && (
                      <Button 
                        onClick={() => setShowAddPODialog(true)} 
                        className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-lg hover:shadow-xl transition-all duration-300 px-6 py-3 text-lg gap-3"
                      >
                        <Plus className="h-5 w-5" />
                        Create Purchase Order
                      </Button>
                    )}
                  </div>
                  <div className="bg-white rounded-xl shadow-lg border-0">
                    <PurchaseOrderTable
                      purchaseOrders={purchaseOrders}
                      onView={(po) => {
                        setSelectedPO(po);
                        setShowViewPODialog(true);
                      }}
                      onEdit={canEdit ? (po) => {
                        setSelectedPO(po);
                        setShowEditPODialog(true);
                      } : undefined}
                      onDelete={canEdit ? handleDeletePurchaseOrder : undefined}
                      loading={loading}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* GRN Tab */}
              <TabsContent value="grn" className="mt-0">
                <div className="bg-gradient-to-br from-purple-50/50 to-pink-50/50 p-8">
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 mb-8">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                          <Package className="h-6 w-6 text-purple-600" />
                        </div>
                        <h2 className="text-3xl font-bold text-gray-900">Goods Receipt Notes</h2>
                      </div>
                      <p className="text-gray-600 text-lg">Record and manage received goods from purchase orders</p>
                    </div>
                    {canEdit && (
                      <Button 
                        onClick={() => setShowAddGRNDialog(true)} 
                        className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 shadow-lg hover:shadow-xl transition-all duration-300 px-6 py-3 text-lg gap-3"
                      >
                        <Plus className="h-5 w-5" />
                        Create GRN
                      </Button>
                    )}
                  </div>
                  <div className="bg-white rounded-xl shadow-lg border-0">
                    <GRNTable
                      refreshTrigger={refreshGRNTrigger}
                      onView={(grn) => {
                        setSelectedGRN(grn);
                        setShowViewGRNDialog(true);
                      }}
                      onEdit={(grn) => {
                        setSelectedGRN(grn);
                        setShowEditGRNDialog(true);
                      }}
                      onDelete={async (grnId) => {
                        if (!confirm('Are you sure you want to delete this GRN?')) return;
                        try {
                          const { error } = await supabase.from('grn_header').delete().eq('id', grnId);
                          if (error) throw error;
                          toast({ title: "Success", description: "GRN deleted successfully" });
                          setRefreshGRNTrigger(prev => prev + 1);
                        } catch (error) {
                          console.error('Error deleting GRN:', error);
                          toast({ title: "Error", description: "Failed to delete GRN", variant: "destructive" });
                        }
                      }}
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Add Supplier Dialog */}
      <Dialog open={showAddSupplierDialog} onOpenChange={setShowAddSupplierDialog}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-white to-blue-50/30 border-0 shadow-2xl">
          <DialogHeader className="pb-6 border-b border-blue-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Building2 className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold text-gray-900">Add New Supplier</DialogTitle>
                <DialogDescription className="text-gray-600 mt-1">Enter supplier information to add them to your vendor list</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="mt-6">
            <SupplierForm
              onSubmit={handleAddSupplier}
              onCancel={() => setShowAddSupplierDialog(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Enhanced Add Purchase Order Dialog */}
      <Dialog open={showAddPODialog} onOpenChange={setShowAddPODialog}>
        <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto bg-gradient-to-br from-white to-emerald-50/30 border-0 shadow-2xl">
          <DialogHeader className="pb-6 border-b border-emerald-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <ShoppingCart className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold text-gray-900">Create Purchase Order</DialogTitle>
                <DialogDescription className="text-gray-600 mt-1">Create a new purchase order for your supplier</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="mt-6">
            <PurchaseOrderForm
              onSubmit={handleAddPurchaseOrder}
              onCancel={() => setShowAddPODialog(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Enhanced Add GRN Dialog */}
      <Dialog open={showAddGRNDialog} onOpenChange={setShowAddGRNDialog}>
        <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto bg-gradient-to-br from-white to-purple-50/30 border-0 shadow-2xl">
          <DialogHeader className="pb-6 border-b border-purple-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Package className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold text-gray-900">Create GRN</DialogTitle>
                <DialogDescription className="text-gray-600 mt-1">Record received goods from purchase orders</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="mt-6">
            <GRNForm
              onSubmit={async (data) => {
                try {
                  // Calculate totals from line items
                  const totals = data.items.reduce(
                    (acc: any, item: any) => ({
                      totalOrderedQty: acc.totalOrderedQty + (item.ordered_quantity || 0),
                      totalReceivedQty: acc.totalReceivedQty + (item.received_quantity || 0),
                      totalAcceptedQty: acc.totalAcceptedQty + (item.accepted_quantity || 0),
                      totalRejectedQty: acc.totalRejectedQty + (item.rejected_quantity || 0),
                      subtotalAmount: acc.subtotalAmount + ((item.accepted_quantity || 0) * (item.unit_price || 0)),
                      totalDiscountAmount: acc.totalDiscountAmount + (item.discount_amount || 0),
                      totalTaxAmount: acc.totalTaxAmount + (item.total_tax_amount || 0),
                      totalAmount: acc.totalAmount + (item.line_total || 0),
                    }),
                    {
                      totalOrderedQty: 0,
                      totalReceivedQty: 0,
                      totalAcceptedQty: 0,
                      totalRejectedQty: 0,
                      subtotalAmount: 0,
                      totalDiscountAmount: 0,
                      totalTaxAmount: 0,
                      totalAmount: 0,
                    }
                  );

                  console.log('Creating GRN with data:', data);
                  
                  // Validate all items have warehouse_id and bin_id
                  const invalidItems = data.items?.filter(item => 
                    !item.warehouse_id || !item.bin_id || !item.product_id
                  );
                  
                  if (invalidItems?.length > 0) {
                    console.error('Invalid items found:', invalidItems);
                    throw new Error(`Invalid items found: ${invalidItems.map(i => i.product_name || 'Unknown').join(', ')} - missing warehouse, bin, or product ID`);
                  }

                  const { data: grn, error } = await supabase
                    .from('grn_header')
                    .insert({
                      company_id: profile?.company_id,
                      purchase_order_id: data.purchase_order_id,
                      supplier_id: data.supplier_id,
                      supplier_name: data.supplier_name,
                      grn_date: data.grn_date,
                      supplier_invoice_number: data.supplier_invoice_number,
                      supplier_invoice_date: data.supplier_invoice_date || null,
                      remarks: data.remarks,
                      status: data.status === 'received' ? 'accepted' : data.status,
                      total_ordered_quantity: totals.totalOrderedQty,
                      total_received_quantity: totals.totalReceivedQty,
                      total_accepted_quantity: totals.totalAcceptedQty,
                      total_rejected_quantity: totals.totalRejectedQty,
                      subtotal_amount: totals.subtotalAmount,
                      total_discount_amount: totals.totalDiscountAmount,
                      total_tax_amount: totals.totalTaxAmount,
                      total_amount: totals.totalAmount,
                      created_by: profile?.id,
                      grn_number: '' // Will be auto-generated by trigger
                    } as any)
                    .select()
                    .single();

                  if (error) {
                    console.error('GRN Header creation error:', error);
                    throw error;
                  }

                  console.log('GRN Header created:', grn);

                  if (data.items?.length > 0) {
                    const itemsToInsert = data.items.map((item) => ({
                      grn_header_id: grn.id,
                      product_id: item.product_id,
                      product_name: item.product_name,
                      product_sku: item.product_sku,
                      unit_of_measure: item.unit_of_measure,
                      ordered_quantity: item.ordered_quantity,
                      received_quantity: item.received_quantity,
                      accepted_quantity: item.accepted_quantity,
                      rejected_quantity: item.rejected_quantity,
                      unit_price: item.unit_price,
                      discount_percentage: item.discount_percentage || 0,
                      discount_amount: item.discount_amount || 0,
                      warehouse_id: item.warehouse_id,
                      bin_id: item.bin_id,
                      hsn_sac_code: item.hsn_sac_code,
                      cgst_rate: item.cgst_rate || 0,
                      cgst_amount: item.cgst_amount || 0,
                      sgst_rate: item.sgst_rate || 0,
                      sgst_amount: item.sgst_amount || 0,
                      igst_rate: item.igst_rate || 0,
                      igst_amount: item.igst_amount || 0,
                      total_tax_amount: item.total_tax_amount || 0,
                      line_total: item.line_total || 0,
                    }));
                    
                    console.log('Inserting GRN line items:', itemsToInsert);
                    const { error: itemsError } = await supabase
                      .from('grn_line_items')
                      .insert(itemsToInsert);
                    if (itemsError) {
                      console.error('GRN Line items creation error:', itemsError);
                      throw itemsError;
                    }
                  }

                  console.log('GRN creation completed successfully');
                  toast({ 
                    title: "Success", 
                    description: `GRN created successfully${grn.grn_number ? ` (GRN: ${grn.grn_number})` : ''}. Inventory has been updated.` 
                  });
                  setShowAddGRNDialog(false);
                  setRefreshGRNTrigger(prev => prev + 1);
                  fetchGRNs();
                  fetchPurchaseOrders(); // Refresh PO list to update status
                } catch (error) {
                  console.error('Error creating GRN:', error);
                  toast({ 
                    title: "Error", 
                    description: "Failed to create GRN. Please check that all products are properly selected.", 
                    variant: "destructive" 
                  });
                }
              }}
              onCancel={() => setShowAddGRNDialog(false)}
              mode="create"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Supplier Dialog */}
      <Dialog open={showEditSupplierDialog} onOpenChange={setShowEditSupplierDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Supplier</DialogTitle>
            <DialogDescription>Update supplier information</DialogDescription>
          </DialogHeader>
          <SupplierForm
            supplier={selectedSupplier}
            onSubmit={handleEditSupplier}
            onCancel={() => {
              setShowEditSupplierDialog(false);
              setSelectedSupplier(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* View Supplier Dialog */}
      <Dialog open={showViewSupplierDialog} onOpenChange={setShowViewSupplierDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Supplier Details</DialogTitle>
            <DialogDescription>View supplier information</DialogDescription>
          </DialogHeader>
          <SupplierForm
            supplier={selectedSupplier}
            onSubmit={() => Promise.resolve()}
            onCancel={() => {
              setShowViewSupplierDialog(false);
              setSelectedSupplier(null);
            }}
            readOnly={true}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Purchase Order Dialog */}
      <Dialog open={showEditPODialog} onOpenChange={setShowEditPODialog}>
        <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Purchase Order</DialogTitle>
            <DialogDescription>Update purchase order details</DialogDescription>
          </DialogHeader>
          <PurchaseOrderForm
            purchaseOrder={selectedPO}
            onSubmit={handleEditPurchaseOrder}
            onCancel={() => {
              setShowEditPODialog(false);
              setSelectedPO(null);
            }}
            mode="edit"
          />
        </DialogContent>
      </Dialog>

      {/* View Purchase Order Dialog */}
      <Dialog open={showViewPODialog} onOpenChange={setShowViewPODialog}>
        <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Purchase Order Details</DialogTitle>
            <DialogDescription>View purchase order information</DialogDescription>
          </DialogHeader>
          <PurchaseOrderForm
            purchaseOrder={selectedPO}
            onSubmit={() => Promise.resolve()}
            onCancel={() => {
              setShowViewPODialog(false);
              setSelectedPO(null);
            }}
            readOnly={true}
            mode="view"
          />
        </DialogContent>
      </Dialog>

      {/* Edit GRN Dialog */}
      <Dialog open={showEditGRNDialog} onOpenChange={setShowEditGRNDialog}>
        <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit GRN</DialogTitle>
            <DialogDescription>Update received quantities and details</DialogDescription>
          </DialogHeader>
          <GRNForm
            grn={selectedGRN}
            onSubmit={async (grnData) => {
              try {
                // Recalculate totals from line items
                const totals = (grnData.items || []).reduce(
                  (acc: any, item: any) => ({
                    totalOrderedQty: acc.totalOrderedQty + (item.ordered_quantity || 0),
                    totalReceivedQty: acc.totalReceivedQty + (item.received_quantity || 0),
                    totalAcceptedQty: acc.totalAcceptedQty + (item.accepted_quantity || 0),
                    totalRejectedQty: acc.totalRejectedQty + (item.rejected_quantity || 0),
                    subtotalAmount: acc.subtotalAmount + ((item.accepted_quantity || 0) * (item.unit_price || 0)),
                    totalDiscountAmount: acc.totalDiscountAmount + (item.discount_amount || 0),
                    totalTaxAmount: acc.totalTaxAmount + (item.total_tax_amount || 0),
                    totalAmount: acc.totalAmount + (item.line_total || 0),
                  }),
                  {
                    totalOrderedQty: 0,
                    totalReceivedQty: 0,
                    totalAcceptedQty: 0,
                    totalRejectedQty: 0,
                    subtotalAmount: 0,
                    totalDiscountAmount: 0,
                    totalTaxAmount: 0,
                    totalAmount: 0,
                  }
                );

                // Update GRN header (exclude items array)
                const { error: headerError } = await supabase
                  .from('grn_header')
                  .update({
                    purchase_order_id: grnData.purchase_order_id,
                    supplier_id: grnData.supplier_id,
                    supplier_name: grnData.supplier_name,
                    grn_date: grnData.grn_date,
                    supplier_invoice_number: grnData.supplier_invoice_number,
                    supplier_invoice_date: grnData.supplier_invoice_date,
                    remarks: grnData.remarks,
                    status: grnData.status === 'received' ? 'accepted' : grnData.status,
                    total_ordered_quantity: totals.totalOrderedQty,
                    total_received_quantity: totals.totalReceivedQty,
                    total_accepted_quantity: totals.totalAcceptedQty,
                    total_rejected_quantity: totals.totalRejectedQty,
                    subtotal_amount: totals.subtotalAmount,
                    total_discount_amount: totals.totalDiscountAmount,
                    total_tax_amount: totals.totalTaxAmount,
                    total_amount: totals.totalAmount,
                  } as any)
                  .eq('id', selectedGRN.id);

                if (headerError) throw headerError;

                // Replace line items
                if (Array.isArray(grnData.items)) {
                  const { error: delErr } = await supabase
                    .from('grn_line_items')
                    .delete()
                    .eq('grn_header_id', selectedGRN.id);
                  if (delErr) throw delErr;

                  const itemsToInsert = grnData.items.map((item: any) => ({
                    grn_header_id: selectedGRN.id,
                    product_id: item.product_id,
                    product_name: item.product_name,
                    product_sku: item.product_sku,
                    unit_of_measure: item.unit_of_measure,
                    ordered_quantity: item.ordered_quantity,
                    received_quantity: item.received_quantity,
                    accepted_quantity: item.accepted_quantity,
                    rejected_quantity: item.rejected_quantity,
                    unit_price: item.unit_price,
                    discount_percentage: item.discount_percentage || 0,
                    discount_amount: item.discount_amount || 0,
                    warehouse_id: item.warehouse_id,
                    bin_id: item.bin_id,
                    hsn_sac_code: item.hsn_sac_code,
                    cgst_rate: item.cgst_rate || 0,
                    cgst_amount: item.cgst_amount || 0,
                    sgst_rate: item.sgst_rate || 0,
                    sgst_amount: item.sgst_amount || 0,
                    igst_rate: item.igst_rate || 0,
                    igst_amount: item.igst_amount || 0,
                    total_tax_amount: item.total_tax_amount || 0,
                    line_total: item.line_total || 0,
                  }));

                  if (itemsToInsert.length > 0) {
                    const { error: insErr } = await supabase
                      .from('grn_line_items')
                      .insert(itemsToInsert);
                    if (insErr) throw insErr;
                  }
                }
                
                toast({ title: 'Success', description: 'GRN updated successfully' });
                setShowEditGRNDialog(false);
                setSelectedGRN(null);
                setRefreshGRNTrigger(prev => prev + 1);
                fetchPurchaseOrders(); // Refresh PO list to update status
              } catch (error) {
                console.error('Error updating GRN:', error);
                toast({ title: 'Error', description: 'Failed to update GRN', variant: 'destructive' });
              }
            }}
            onCancel={() => {
              setShowEditGRNDialog(false);
              setSelectedGRN(null);
            }}
            mode="edit"
          />
        </DialogContent>
      </Dialog>

      {/* View GRN Dialog */}
      <Dialog open={showViewGRNDialog} onOpenChange={setShowViewGRNDialog}>
        <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>GRN Details</DialogTitle>
            <DialogDescription>Review received goods information</DialogDescription>
          </DialogHeader>
          <GRNForm
            grn={selectedGRN}
            onSubmit={() => Promise.resolve()}
            onCancel={() => {
              setShowViewGRNDialog(false);
              setSelectedGRN(null);
            }}
            readOnly={true}
            mode="view"
          />
        </DialogContent>
      </Dialog>

      {/* Purchase Order Details Dialog */}
      <PurchaseOrderDetailsDialog
        purchaseOrder={selectedPO}
        open={showViewPODialog}
        onOpenChange={setShowViewPODialog}
      />
    </div>
  );
}

export default PurchaseModule;