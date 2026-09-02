import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, FileText, Clock, Package2, Users } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useBusinessAuth } from '@/hooks/useBusinessAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from '@/components/ui/card';
import { StatsCard } from '@/components/ui/stats-card';

// Import table and form components
import { CustomerTable } from '@/components/tables/CustomerTable';
import { CustomerForm } from '@/components/forms/CustomerForm';
import { SalesOrderTable } from '@/components/tables/SalesOrderTable';
import { SalesOrderForm } from '@/components/forms/SalesOrderForm';
import { SalesInvoiceForm } from '@/components/forms/SalesInvoiceForm';
import { SalesInvoiceTable } from '@/components/tables/SalesInvoiceTable';
import { SalesOrderDetailsDialog } from '../dialogs/SalesOrderDetailsDialog';

export default function SalesModule() {
  const { user, company, profile } = useAuth();
  const { hasEditAccess } = useBusinessAuth();
  const canEdit = hasEditAccess('sales');
  
  // State for all modules
  const [customers, setCustomers] = useState([]);
  const [salesOrders, setSalesOrders] = useState([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Sales metrics state
  const [salesMetrics, setSalesMetrics] = useState({
    pending_orders_count: 0,
    pending_orders_value: 0,
    total_backorder_units: 0,
    total_backorder_value: 0
  });
  const [topBackorderItems, setTopBackorderItems] = useState([]);
  const [topBackorderCustomers, setTopBackorderCustomers] = useState([]);
  
  // Dialog states
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [showSalesOrderDialog, setShowSalesOrderDialog] = useState(false);
  const [showSalesInvoiceDialog, setShowSalesInvoiceDialog] = useState(false);
  
  // Editing states
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [editingSalesOrder, setEditingSalesOrder] = useState(null);
  const [editingSalesInvoice, setEditingSalesInvoice] = useState(null);
  const [viewingSalesOrder, setViewingSalesOrder] = useState(null);
  const [viewingSalesInvoice, setViewingSalesInvoice] = useState(null);
  
  const [loading, setLoading] = useState(false);

  // Fetch functions
  const fetchCustomers = async () => {
    if (!company?.id) return;

    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast({
        title: "Error",
        description: "Failed to fetch customers",
        variant: "destructive",
      });
    }
  };

  const fetchSalesOrders = async () => {
    if (!company?.id) return;

    try {
      const { data, error } = await supabase.rpc(
        'get_sales_orders_with_delivery_summary',
        { p_company_id: company.id }
      );

      if (error) throw error;
      setSalesOrders(data || []);
    } catch (error) {
      console.error('Error fetching sales orders:', error);
      toast({
        title: "Error",
        description: "Failed to fetch sales orders",
        variant: "destructive",
      });
    }
  };

  // Fetch sales metrics
  const fetchSalesMetrics = async () => {
    if (!company?.id) return;

    try {
      const { data: metrics, error: metricsError } = await supabase.rpc(
        'get_sales_metrics',
        { p_company_id: company.id }
      );

      if (metricsError) throw metricsError;
      if (metrics?.[0]) {
        setSalesMetrics(metrics[0]);
      }

      const { data: items, error: itemsError } = await supabase.rpc(
        'get_top_backorder_items',
        { p_company_id: company.id, p_limit: 5 }
      );

      if (itemsError) throw itemsError;
      setTopBackorderItems(items || []);

      const { data: customers, error: customersError } = await supabase.rpc(
        'get_top_backorder_customers',
        { p_company_id: company.id, p_limit: 5 }
      );

      if (customersError) throw customersError;
      setTopBackorderCustomers(customers || []);
    } catch (error) {
      console.error('Error fetching sales metrics:', error);
      toast({
        title: "Error",
        description: "Failed to fetch sales metrics",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (company?.id) {
      fetchCustomers();
      fetchSalesOrders();
      fetchSalesMetrics();
    }
  }, [company?.id, refreshTrigger]);

  // Customer handlers
  const handleOpenCustomerDialog = () => {
    if (!canEdit) {
      toast({ title: 'Permission denied', description: "You don't have edit access to Sales.", variant: 'destructive' });
      return;
    }
    setEditingCustomer(null);
    setShowCustomerDialog(true);
  };

  const handleEditCustomer = (customer: any) => {
    setEditingCustomer(customer);
    setShowCustomerDialog(true);
  };

  const handleDeleteCustomer = async (customer: any) => {
    if (!company?.id) return;
    if (!canEdit) {
      toast({ title: 'Permission denied', description: "You don't have edit access to Sales.", variant: 'destructive' });
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', customer.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Customer deleted successfully",
      });
      fetchCustomers();
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast({
        title: "Error",
        description: "Failed to delete customer",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerSubmit = async (customerData: any) => {
    if (!company?.id) return;
    if (!canEdit) {
      toast({ title: 'Permission denied', description: "You don't have edit access to Sales.", variant: 'destructive' });
      return;
    }

    try {
      setLoading(true);
      const payload = {
        ...customerData,
        company_id: company.id,
      };

      if (editingCustomer) {
        const { error } = await supabase
          .from('customers')
          .update(payload)
          .eq('id', editingCustomer.id);

        if (error) throw error;
        toast({
          title: "Success",
          description: "Customer updated successfully",
        });
      } else {
        const { error } = await supabase
          .from('customers')
          .insert([payload]);

        if (error) throw error;
        toast({
          title: "Success",
          description: "Customer created successfully",
        });
      }

      fetchCustomers();
      setShowCustomerDialog(false);
      setEditingCustomer(null);
    } catch (error) {
      console.error('Error saving customer:', error);
      toast({
        title: "Error",
        description: "Failed to save customer",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Sales Order handlers
  const handleCreateSalesOrder = () => {
    setEditingSalesOrder(null);
    setShowSalesOrderDialog(true);
  };

  const handleCreateSalesInvoice = () => {
    setEditingSalesInvoice(null);
    setShowSalesInvoiceDialog(true);
  };

  const handleEditSalesOrder = async (salesOrder: any) => {
    try {
      setLoading(true);
      
      // Fetch complete sales order with items
      const { data: completeOrder, error } = await supabase
        .from('sales_orders')
        .select(`
          *,
          customers!inner(
            name,
            customer_ref
          ),
          sales_order_items (
            *
          )
        `)
        .eq('id', salesOrder.id)
        .single();

      if (error) throw error;

      setEditingSalesOrder(completeOrder);
      setShowSalesOrderDialog(true);
    } catch (error) {
      console.error('Error fetching sales order for edit:', error);
      toast({
        title: "Error",
        description: "Failed to load sales order details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditSalesInvoice = async (salesInvoice: any) => {
    try {
      setLoading(true);
      
      // Fetch complete sales invoice with items
      const { data: completeInvoice, error } = await supabase
        .from('sales_invoices')
        .select(`
          *,
          sales_invoice_items (
            *
          )
        `)
        .eq('id', salesInvoice.id)
        .single();

      if (error) throw error;

      setEditingSalesInvoice(completeInvoice);
      setShowSalesInvoiceDialog(true);
    } catch (error) {
      console.error('Error fetching sales invoice for edit:', error);
      toast({
        title: "Error",
        description: "Failed to load sales invoice details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSalesOrder = async (salesOrder: any) => {
    if (!company?.id) return;
    if (!canEdit) {
      toast({ title: 'Permission denied', description: "You don't have edit access to Sales.", variant: 'destructive' });
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .from('sales_orders')
        .delete()
        .eq('id', salesOrder.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Sales order deleted successfully",
      });

      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Error deleting sales order:', error);
      toast({
        title: "Error",
        description: "Failed to delete sales order",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewSalesInvoice = (salesInvoice: any) => {
    setViewingSalesInvoice(salesInvoice);
  };

  const handleViewSalesOrder = (salesOrder: any) => {
    setViewingSalesOrder(salesOrder);
  };

  const handleSalesInvoiceSubmit = async (data: any) => {
    console.log('🎯 SalesModule: handleSalesInvoiceSubmit called', { 
      hasCompany: !!company?.id, 
      hasProfile: !!profile?.id,
      editingInvoice: !!editingSalesInvoice 
    });
    
    if (!company?.id) return;
    if (!profile?.id) {
      toast({ title: 'Error', description: "Profile not found. Please try logging in again.", variant: 'destructive' });
      return;
    }
    
    try {
      setLoading(true);
      
      // Separate items from header data to avoid column error
      const { items, ...headerData } = data;
      
      // Convert empty date strings to null
      const processedHeaderData = {
        ...headerData,
        due_date: headerData.due_date || null,
        invoice_date: headerData.invoice_date || null,
      };
      
      const invoiceData = {
        ...processedHeaderData,
        company_id: company.id,
        created_by: profile.id,
      };

      let result;
      if (editingSalesInvoice) {
        // Update existing invoice
        const { data: updatedInvoice, error: invoiceError } = await supabase
          .from('sales_invoices')
          .update(invoiceData)
          .eq('id', editingSalesInvoice.id)
          .select()
          .single();

        if (invoiceError) throw invoiceError;

        // Delete existing invoice items
        const { error: deleteError } = await supabase
          .from('sales_invoice_items')
          .delete()
          .eq('sales_invoice_id', editingSalesInvoice.id);

        if (deleteError) throw deleteError;

        // Insert updated invoice items
        const invoiceItems = items.map((item: any) => ({
          sales_invoice_id: editingSalesInvoice.id,
          ...item,
          warehouse_id: data.default_warehouse_id,
          bin_id: data.default_bin_id,
          backorder_quantity: item.quantity_ordered - item.quantity_invoiced,
          line_subtotal: item.quantity_invoiced * item.unit_price,
          discount_amount: (item.quantity_invoiced * item.unit_price * item.discount_percentage) / 100,
          cgst_amount: ((item.quantity_invoiced * item.unit_price) * item.cgst_rate) / 100,
          sgst_amount: ((item.quantity_invoiced * item.unit_price) * item.sgst_rate) / 100,
          igst_amount: ((item.quantity_invoiced * item.unit_price) * item.igst_rate) / 100,
          tax_amount: ((item.quantity_invoiced * item.unit_price) * (item.cgst_rate + item.sgst_rate + item.igst_rate)) / 100,
          line_total: (item.quantity_invoiced * item.unit_price) + ((item.quantity_invoiced * item.unit_price) * (item.cgst_rate + item.sgst_rate + item.igst_rate)) / 100 - ((item.quantity_invoiced * item.unit_price * item.discount_percentage) / 100),
        }));

        const { error: itemsError } = await supabase
          .from('sales_invoice_items')
          .insert(invoiceItems);

        if (itemsError) throw itemsError;

        // Process inventory if status changed to posted/finalized
        const statusChanged = editingSalesInvoice.status !== updatedInvoice.status;
        if (statusChanged && updatedInvoice.status === 'finalized') {
          const { data: processResult, error: processError } = await supabase.rpc(
            'process_sales_invoice', 
            { p_invoice_id: updatedInvoice.id }
          );

          if (processError) {
            console.error('Error processing sales invoice:', processError);
            toast({
              title: "Warning",
              description: "Invoice updated but inventory processing failed. Please check inventory levels.",
              variant: "destructive",
            });
          } else if (processResult && typeof processResult === 'object' && processResult !== null && 'success' in processResult && !(processResult as any).success) {
            console.error('Sales invoice processing failed:', processResult);
            toast({
              title: "Warning", 
              description: "Invoice updated but inventory processing failed. Please check inventory levels.",
              variant: "destructive",
            });
          }
        }

        result = updatedInvoice;
      } else {
        // Create new invoice
        const { data: newInvoice, error: invoiceError } = await supabase
          .from('sales_invoices')
          .insert(invoiceData)
          .select()
          .single();

        if (invoiceError) {
          console.error('Invoice creation error:', invoiceError);
          throw invoiceError;
        }

        // Insert invoice items
        const invoiceItems = items.map((item: any) => ({
          sales_invoice_id: newInvoice.id,
          ...item,
          warehouse_id: data.default_warehouse_id,
          bin_id: data.default_bin_id,
          backorder_quantity: item.quantity_ordered - item.quantity_invoiced,
          line_subtotal: item.quantity_invoiced * item.unit_price,
          discount_amount: (item.quantity_invoiced * item.unit_price * item.discount_percentage) / 100,
          cgst_amount: ((item.quantity_invoiced * item.unit_price) * item.cgst_rate) / 100,
          sgst_amount: ((item.quantity_invoiced * item.unit_price) * item.sgst_rate) / 100,
          igst_amount: ((item.quantity_invoiced * item.unit_price) * item.igst_rate) / 100,
          tax_amount: ((item.quantity_invoiced * item.unit_price) * (item.cgst_rate + item.sgst_rate + item.igst_rate)) / 100,
          line_total: (item.quantity_invoiced * item.unit_price) + ((item.quantity_invoiced * item.unit_price) * (item.cgst_rate + item.sgst_rate + item.igst_rate)) / 100 - ((item.quantity_invoiced * item.unit_price * item.discount_percentage) / 100),
        }));

        const { error: itemsError } = await supabase
          .from('sales_invoice_items')
          .insert(invoiceItems);

        if (itemsError) {
          console.error('Invoice items creation error:', itemsError);
          throw itemsError;
        }

        // Process inventory and sales order updates if status is finalized
        if (newInvoice.status === 'finalized') {
          const { data: processResult, error: processError } = await supabase.rpc(
            'process_sales_invoice', 
            { p_invoice_id: newInvoice.id }
          );

          if (processError) {
            console.error('Error processing sales invoice:', processError);
          } else if (processResult && typeof processResult === 'object' && processResult !== null && 'success' in processResult && !(processResult as any).success) {
            console.error('Sales invoice processing failed:', processResult);
          }
        }

        result = newInvoice;
      }

      console.log('✅ SalesModule: Invoice operation completed, closing dialog...');
      setShowSalesInvoiceDialog(false);
      setEditingSalesInvoice(null);
      setRefreshTrigger(prev => prev + 1);
      
      // Refresh sales orders and metrics to update quantity tracking
      fetchSalesOrders();
      fetchSalesMetrics();

      console.log('📢 SalesModule: Showing success toast');
      toast({
        title: "Success",
        description: `Sales invoice ${editingSalesInvoice ? 'updated' : 'created'} successfully`,
      });
    } catch (error: any) {
      console.error('❌ SalesModule: Error saving sales invoice:', error);
      
      let errorMessage = `Failed to ${editingSalesInvoice ? 'update' : 'create'} sales invoice`;
      if (error?.message) {
        errorMessage += `: ${error.message}`;
      }
      
      console.log('📢 SalesModule: Showing error toast');
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      console.log('🏁 SalesModule: handleSalesInvoiceSubmit finished');
    }
  };

  const handleSalesOrderSubmit = async (data: any) => {
    if (!company?.id) return;
    if (!profile?.id) {
      toast({ title: 'Error', description: "Profile not found. Please try logging in again.", variant: 'destructive' });
      return;
    }
    if (!canEdit) {
      toast({ title: 'Permission denied', description: "You don't have edit access to Sales.", variant: 'destructive' });
      return;
    }

    try {
      setLoading(true);
      const { orderData, lineItems } = data;
      
      // Convert empty date strings to null
      const processedOrderData = {
        ...orderData,
        expected_delivery_date: orderData.expected_delivery_date || null,
        delivery_date: orderData.delivery_date || null,
      };
      
      const salesOrderPayload = {
        ...processedOrderData,
        company_id: company.id,
        created_by: profile.id,
      };

      let result;
      if (editingSalesOrder) {
        const { data: updatedOrder, error } = await supabase
          .from('sales_orders')
          .update(salesOrderPayload)
          .eq('id', editingSalesOrder.id)
          .select()
          .single();

        if (error) throw error;
        result = updatedOrder;

        // Delete existing items
        await supabase
          .from('sales_order_items')
          .delete()
          .eq('sales_order_id', result.id);
      } else {
        const { data: newOrder, error } = await supabase
          .from('sales_orders')
          .insert([salesOrderPayload])
          .select()
          .single();

        if (error) throw error;
        result = newOrder;
      }

      // Insert line items
      if (lineItems?.length > 0) {
        const itemsToInsert = lineItems.map((item: any) => ({
          sales_order_id: result.id,
          product_id: item.product_id,
          item_description: item.item_description,
          hsn_sac_code: item.hsn_sac_code,
          stock_on_hand: item.stock_on_hand || 0,
          ordered_quantity: item.ordered_quantity || item.quantity,
          back_order_quantity: item.back_order_quantity || 0,
          quantity: item.quantity,
          unit_of_measure: item.unit_of_measure,
          unit_price: item.unit_price,
          discount_percentage: item.discount_percentage,
          discount_amount: item.discount_amount,
          cgst_rate: item.cgst_rate,
          sgst_rate: item.sgst_rate,
          igst_rate: item.igst_rate,
          cgst_amount: item.cgst_amount,
          sgst_amount: item.sgst_amount,
          igst_amount: item.igst_amount,
          total_price: item.total_price,
          warehouse_id: orderData.default_warehouse_id,
          bin_id: orderData.default_bin_id,
        }));

        const { error: itemsError } = await supabase
          .from('sales_order_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      toast({
        title: "Success",
        description: editingSalesOrder ? "Sales order updated successfully" : "Sales order created successfully",
      });

      fetchSalesOrders();
      fetchSalesMetrics();
      setShowSalesOrderDialog(false);
      setEditingSalesOrder(null);
    } catch (error) {
      console.error('Error saving sales order:', error);
      toast({
        title: "Error",
        description: "Failed to save sales order",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sales Metrics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Pending Sales Orders"
          value={salesMetrics.pending_orders_count}
          subtitle={`₹${salesMetrics.pending_orders_value?.toLocaleString() || '0'}`}
          icon={FileText}
          variant="primary"
        />
        
        <StatsCard
          title="Total Back-orders"
          value={salesMetrics.total_backorder_units}
          subtitle={`₹${salesMetrics.total_backorder_value?.toLocaleString() || '0'}`}
          icon={Clock}
          variant="secondary"
        />
        
        <Card className="card-interactive">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Top 5 Backordered Items</p>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {topBackorderItems.length > 0 ? (
                    topBackorderItems.map((item, index) => (
                      <div key={index} className="text-xs">
                        <span className="font-medium">{item.product_name}</span>
                        <span className="text-muted-foreground ml-1">({item.total_backorder_qty})</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">No backordered items</p>
                  )}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-background/50">
                <Package2 className="h-6 w-6 text-accent" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-interactive">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Top 5 Customers by Backorder</p>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {topBackorderCustomers.length > 0 ? (
                    topBackorderCustomers.map((customer, index) => (
                      <div key={index} className="text-xs">
                        <span className="font-medium">{customer.customer_name}</span>
                        <span className="text-muted-foreground ml-1">₹{customer.total_backorder_amount?.toLocaleString()}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">No customer backorders</p>
                  )}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-background/50">
                <Users className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="customers" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="sales-orders">Sales Orders</TabsTrigger>
          <TabsTrigger value="invoices">Sales Invoices</TabsTrigger>
        </TabsList>

        {/* Customers Tab */}
        <TabsContent value="customers" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Customer Management</h3>
            <Button onClick={handleOpenCustomerDialog} disabled={!canEdit}>
              <Plus className="h-4 w-4 mr-2" />
              Add Customer
            </Button>
          </div>
          <CustomerTable
            customers={customers}
            onEdit={(customer) => { 
              if (!canEdit) { 
                toast({ title: 'Permission denied', description: "You don't have edit access to Sales.", variant: 'destructive' }); 
                return; 
              } 
              handleEditCustomer(customer);
            }}
            onDelete={(customer) => { 
              if (!canEdit) { 
                toast({ title: 'Permission denied', description: "You don't have edit access to Sales.", variant: 'destructive' }); 
                return; 
              } 
              handleDeleteCustomer(customer);
            }}
            loading={loading}
          />
        </TabsContent>

        {/* Sales Orders Tab */}
        <TabsContent value="sales-orders" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Sales Order Management</h3>
            <Button onClick={handleCreateSalesOrder} disabled={!canEdit}>
              <Plus className="h-4 w-4 mr-2" />
              Create Sales Order
            </Button>
          </div>
          <Card>
            <CardContent className="p-6">
              <SalesOrderTable
                salesOrders={salesOrders}
                onView={handleViewSalesOrder}
                onEdit={(order) => { 
                  if (!canEdit) { 
                    toast({ title: 'Permission denied', description: "You don't have edit access to Sales.", variant: 'destructive' }); 
                    return; 
                  } 
                  handleEditSalesOrder(order);
                }}
                onDelete={(order) => { 
                  if (!canEdit) { 
                    toast({ title: 'Permission denied', description: "You don't have edit access to Sales.", variant: 'destructive' }); 
                    return; 
                  } 
                  handleDeleteSalesOrder(order);
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sales Invoices Tab */}
        <TabsContent value="invoices" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Sales Invoices</h3>
            <Button onClick={handleCreateSalesInvoice}>
              <Plus className="mr-2 h-4 w-4" />
              Create Invoice
            </Button>
          </div>
          
          <Card>
            <CardContent className="p-6">
              <SalesInvoiceTable
                refreshTrigger={refreshTrigger}
                onEdit={handleEditSalesInvoice}
                onView={handleViewSalesInvoice}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Customer Dialog */}
      <Dialog open={showCustomerDialog} onOpenChange={setShowCustomerDialog}>
        <DialogContent className="sm:max-w-[80%] md:max-w-[70%] lg:max-w-[60%] xl:max-w-[50%] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCustomer ? 'Edit Customer' : 'Add Customer'}</DialogTitle>
          </DialogHeader>
          <CustomerForm
            customer={editingCustomer}
            onSubmit={handleCustomerSubmit}
            onCancel={() => {
              setShowCustomerDialog(false);
              setEditingCustomer(null);
            }}
            readOnly={!canEdit}
          />
        </DialogContent>
      </Dialog>

      {/* Sales Order Dialog */}
      <Dialog open={showSalesOrderDialog} onOpenChange={setShowSalesOrderDialog}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSalesOrder ? 'Edit Sales Order' : 'Create Sales Order'}</DialogTitle>
          </DialogHeader>
          <SalesOrderForm
            salesOrder={editingSalesOrder}
            mode={editingSalesOrder ? "edit" : "create"}
            onSubmit={handleSalesOrderSubmit}
            onCancel={() => {
              setShowSalesOrderDialog(false);
              setEditingSalesOrder(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Sales Invoice Dialog */}
      <Dialog open={showSalesInvoiceDialog} onOpenChange={setShowSalesInvoiceDialog}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSalesInvoice ? 'Edit Sales Invoice' : 'Create Sales Invoice'}</DialogTitle>
          </DialogHeader>
          <SalesInvoiceForm
            editingInvoice={editingSalesInvoice}
            onSubmit={handleSalesInvoiceSubmit}
            onCancel={() => {
              setShowSalesInvoiceDialog(false);
              setEditingSalesInvoice(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Sales Order Details Dialog */}
      {viewingSalesOrder && (
        <SalesOrderDetailsDialog
          isOpen={!!viewingSalesOrder}
          salesOrder={viewingSalesOrder}
          salesOrderItems={viewingSalesOrder.sales_order_items || []}
          customer={viewingSalesOrder.customers}
          onClose={() => setViewingSalesOrder(null)}
        />
      )}
    </div>
  );
}