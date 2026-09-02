import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

const salesInvoiceSchema = z.object({
  invoice_number: z.string().optional(),
  invoice_date: z.date(),
  sales_order_id: z.string().min(1, 'Sales order is required'),
  delivery_note_number: z.string().optional(),
  customer_id: z.string().min(1, 'Customer is required'),
  customer_name: z.string().min(1, 'Customer name is required'),
  billing_address_line1: z.string().optional(),
  billing_address_line2: z.string().optional(),
  billing_city: z.string().optional(),
  billing_state: z.string().optional(),
  billing_pin_code: z.string().optional(),
  billing_country: z.string().optional(),
  shipping_address_line1: z.string().optional(),
  shipping_address_line2: z.string().optional(),
  shipping_city: z.string().optional(),
  shipping_state: z.string().optional(),
  shipping_pin_code: z.string().optional(),
  shipping_country: z.string().optional(),
  same_as_billing_address: z.boolean().default(false),
  customer_po_reference: z.string().optional(),
  currency: z.string().default('INR'),
  payment_terms: z.string().optional(),
  due_date: z.date().optional(),
  salesperson_id: z.string().optional(),
  account_manager: z.string().optional(),
  mode_of_delivery: z.string().optional(),
  transporter: z.string().optional(),
  freight_charges: z.number().default(0),
  packing_charges: z.number().default(0),
  round_off: z.number().default(0),
  notes: z.string().optional(),
  status: z.enum(['draft', 'finalized']).default('draft'),
  default_warehouse_id: z.string().min(1, 'Default warehouse is required'),
  default_bin_id: z.string().min(1, 'Default bin is required'),
  items: z.array(z.object({
    product_id: z.string().min(1, 'Product is required'),
    item_code: z.string().min(1, 'Item code is required'),
    item_description: z.string().min(1, 'Description is required'),
    hsn_sac_code: z.string().optional(),
    quantity_ordered: z.number().min(0),
    quantity_invoiced: z.number().min(0, 'Quantity must be at least 0'),
    unit_of_measure: z.string().default('pcs'),
    unit_price: z.number().min(0, 'Unit price must be at least 0'),
    discount_percentage: z.number().min(0).max(100).default(0),
    cgst_rate: z.number().min(0).max(100).default(0),
    sgst_rate: z.number().min(0).max(100).default(0),
    igst_rate: z.number().min(0).max(100).default(0),
    warehouse_id: z.string().optional(),
    bin_id: z.string().optional(),
  })).min(1, 'At least one item is required'),
});

type SalesInvoiceFormData = z.infer<typeof salesInvoiceSchema>;

interface SalesInvoiceFormProps {
  editingInvoice?: any;
  onSubmit: (data: SalesInvoiceFormData) => Promise<void>;
  onCancel: () => void;
}

export const SalesInvoiceForm: React.FC<SalesInvoiceFormProps> = ({
  editingInvoice,
  onSubmit,
  onCancel,
}) => {
  const { company } = useAuth();
  const [customers, setCustomers] = useState<any[]>([]);
  const [salesOrders, setSalesOrders] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [bins, setBins] = useState<any[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);
  const [selectedSalesOrder, setSelectedSalesOrder] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [warehouseName, setWarehouseName] = useState('');
  const [binName, setBinName] = useState('');
  const [stockLevels, setStockLevels] = useState<Record<string, number>>({});
  const [quantityErrors, setQuantityErrors] = useState<Record<number, string>>({});
  const [remainingQuantities, setRemainingQuantities] = useState<Record<string, any>>({});

  const form = useForm<SalesInvoiceFormData>({
    resolver: zodResolver(salesInvoiceSchema),
    defaultValues: {
      invoice_date: new Date(),
      currency: 'INR',
      same_as_billing_address: false,
      freight_charges: 0,
      packing_charges: 0,
      round_off: 0,
      status: 'draft',
      default_warehouse_id: '',
      default_bin_id: '',
      items: [],
    },
  });

  const watchedSameAsBilling = form.watch('same_as_billing_address');
  const watchedItems = form.watch('items');
  const watchedStatus = form.watch('status');

  useEffect(() => {
    if (company?.id) {
      fetchCustomers();
      fetchSalesOrders();
      fetchRecentInvoices();
      fetchWarehouses();
    }
  }, [company?.id]);

  useEffect(() => {
    if (editingInvoice) {
      // Populate form with editing data (do not override with SO defaults)
      form.reset({
        ...editingInvoice,
        invoice_date: new Date(editingInvoice.invoice_date),
        due_date: editingInvoice.due_date ? new Date(editingInvoice.due_date) : undefined,
        items: editingInvoice.sales_invoice_items || [],
      });
      // When editing, we avoid auto-fetching SO details to prevent overwriting invoice items
    }
  }, [editingInvoice]);

  useEffect(() => {
    if (watchedSameAsBilling) {
      const billingAddress = form.getValues();
      form.setValue('shipping_address_line1', billingAddress.billing_address_line1 || '');
      form.setValue('shipping_address_line2', billingAddress.billing_address_line2 || '');
      form.setValue('shipping_city', billingAddress.billing_city || '');
      form.setValue('shipping_state', billingAddress.billing_state || '');
      form.setValue('shipping_pin_code', billingAddress.billing_pin_code || '');
      form.setValue('shipping_country', billingAddress.billing_country || '');
    }
  }, [watchedSameAsBilling]);

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', company.id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const fetchSalesOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('sales_orders')
        .select('*, customers!inner(name)')
        .eq('company_id', company.id)
        .in('status', ['confirmed', 'partially_delivered'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSalesOrders(data || []);
    } catch (error) {
      console.error('Error fetching sales orders:', error);
    }
  };

  const fetchRecentInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from('sales_invoices')
        .select('invoice_number, invoice_date, customer_name, total_amount')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setRecentInvoices(data || []);
    } catch (error) {
      console.error('Error fetching recent invoices:', error);
    }
  };

  const fetchWarehouses = async () => {
    try {
      const { data, error } = await supabase
        .from('warehouse_bins')
        .select('*')
        .eq('company_id', company.id)
        .eq('is_active', true)
        .order('warehouse_name, bin_name');

      if (error) throw error;
      setWarehouses(data || []);
    } catch (error) {
      console.error('Error fetching warehouses:', error);
    }
  };

  const handleWarehouseChange = (warehouseId: string) => {
    form.setValue('default_warehouse_id', warehouseId);
    // Filter bins for selected warehouse
    const filteredBins = warehouses.filter(w => w.id === warehouseId);
    setBins(filteredBins);
    // Reset bin selection
    form.setValue('default_bin_id', '');
  };

  // Function to fetch current stock levels for products
  const fetchStockLevels = async (productIds: string[], warehouseId?: string, binId?: string) => {
    if (!company?.id || productIds.length === 0) return {};
    
    try {
      let query = supabase
        .from('current_stock_levels')
        .select('product_id, current_stock')
        .eq('company_id', company.id)
        .in('product_id', productIds);
      
      if (warehouseId) query = query.eq('warehouse_id', warehouseId);
      if (binId) query = query.eq('bin_id', binId);
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      const stockMap: Record<string, number> = {};
      data?.forEach(item => {
        stockMap[item.product_id] = Math.max(0, item.current_stock || 0);
      });
      
      return stockMap;
    } catch (error) {
      console.error('Error fetching stock levels:', error);
      return {};
    }
  };

  // Validate quantity constraints
  const validateQuantity = (itemIndex: number, invoicedQty: number, orderedQty: number, productId: string): string | null => {
    const stockOnHand = stockLevels[productId] || 0;
    const remainingData = remainingQuantities[productId];
    
    if (!remainingData) {
      return `Product data not loaded`;
    }
    
    const remainingQty = remainingData.quantity_remaining || 0;
    const currentBackorderQty = remainingData.current_backorder_qty || 0;
    
    if (invoicedQty > remainingQty) {
      return `Cannot exceed remaining quantity (${remainingQty} available)`;
    }
    
    if (invoicedQty > currentBackorderQty && currentBackorderQty > 0) {
      return `Cannot exceed current backorder (${currentBackorderQty})`;
    }
    
    if (invoicedQty > stockOnHand) {
      return `Insufficient stock (${stockOnHand} available)`;
    }
    
    return null;
  };

  // Handle quantity change with validation
  const handleQuantityChange = (itemIndex: number, value: number) => {
    const items = form.getValues('items');
    const item = items[itemIndex];
    
    if (item) {
      const error = validateQuantity(itemIndex, value, item.quantity_ordered, item.product_id);
      
      setQuantityErrors(prev => ({
        ...prev,
        [itemIndex]: error || ''
      }));
      
      // Update the form field
      form.setValue(`items.${itemIndex}.quantity_invoiced`, value);
    }
  };

  const fetchSalesOrderDetails = async (salesOrderId: string) => {
    try {
      const { data, error } = await supabase
        .from('sales_orders')
        .select(`
          *,
          customers!inner(*),
          sales_order_items(
            *,
            products!inner(name, sku, stock_quantity)
          )
        `)
        .eq('id', salesOrderId)
        .single();

      if (error) throw error;
      setSelectedSalesOrder(data);
      
      // Fetch remaining quantities using the new database function
      const { data: remainingData, error: remainingError } = await supabase
        .rpc('get_sales_order_item_remaining_quantities', {
          p_sales_order_id: salesOrderId
        });

      if (remainingError) {
        console.error('Error fetching remaining quantities:', remainingError);
        throw remainingError;
      }

      // Convert array to object for easy lookup
      const remainingMap: Record<string, any> = {};
      remainingData?.forEach((item: any) => {
        remainingMap[item.product_id] = item;
      });
      setRemainingQuantities(remainingMap);
      
      // Auto-populate customer and address details
      const customer = data.customers;
      form.setValue('customer_id', customer.id);
      form.setValue('customer_name', customer.name);
      form.setValue('billing_address_line1', customer.address_line1 || '');
      form.setValue('billing_address_line2', customer.address_line2 || '');
      form.setValue('billing_city', customer.city || '');
      form.setValue('billing_state', customer.state || '');
      form.setValue('billing_pin_code', customer.pin_code || '');
      form.setValue('billing_country', customer.country || '');
      
      // Get warehouse and bin details from sales order items (first item's warehouse/bin)
      if (data.sales_order_items && data.sales_order_items.length > 0) {
        const firstItem = data.sales_order_items[0];
        if (firstItem.warehouse_id && firstItem.bin_id) {
          // Fetch warehouse and bin names
          const { data: warehouseData } = await supabase
            .from('warehouse_bins')
            .select('warehouse_name, bin_name')
            .eq('id', firstItem.warehouse_id)
            .single();
            
          if (warehouseData) {
            form.setValue('default_warehouse_id', firstItem.warehouse_id);
            form.setValue('default_bin_id', firstItem.bin_id);
            setWarehouseName(warehouseData.warehouse_name);
            setBinName(warehouseData.bin_name);
          }
        }
      }
      
      // Auto-populate line items from sales order using remaining quantities data
      const items = remainingData?.map((item: any) => ({
        product_id: item.product_id,
        item_code: item.product_sku,
        item_description: item.product_name,
        hsn_sac_code: item.hsn_sac_code || '',
        quantity_ordered: item.quantity_ordered,
        quantity_invoiced: 0, // User needs to enter this
        unit_of_measure: item.unit_of_measure,
        unit_price: parseFloat(item.unit_price.toString()),
        discount_percentage: 0,
        cgst_rate: 0,
        sgst_rate: 0,
        igst_rate: 0,
      })) || [];
      
      // Fetch stock levels for these products
      const productIds = items.map((item: any) => item.product_id);
      const defaultWarehouseId = data.default_warehouse_id;
      const defaultBinId = data.default_bin_id;
      
      const stockData = await fetchStockLevels(productIds, defaultWarehouseId, defaultBinId);
      setStockLevels(stockData);
      
      form.setValue('items', items);
    } catch (error) {
      console.error('Error fetching sales order details:', error);
      toast({
        title: "Error",
        description: "Failed to load sales order details",
        variant: "destructive",
      });
    }
  };

  const onSalesOrderChange = (salesOrderId: string) => {
    form.setValue('sales_order_id', salesOrderId);
    if (salesOrderId) {
      fetchSalesOrderDetails(salesOrderId);
    }
  };

  const calculateItemTotals = (index: number) => {
    const items = form.getValues('items');
    const item = items[index];
    
    if (!item) return;
    
    const subtotal = item.quantity_invoiced * item.unit_price;
    const discountAmount = (subtotal * item.discount_percentage) / 100;
    const taxableAmount = subtotal - discountAmount;
    
    const cgstAmount = (taxableAmount * item.cgst_rate) / 100;
    const sgstAmount = (taxableAmount * item.sgst_rate) / 100;
    const igstAmount = (taxableAmount * item.igst_rate) / 100;
    
    const totalTax = cgstAmount + sgstAmount + igstAmount;
    const lineTotal = taxableAmount + totalTax;
    
    return {
      subtotal,
      discountAmount,
      taxableAmount,
      cgstAmount,
      sgstAmount,
      igstAmount,
      totalTax,
      lineTotal,
      backorderQuantity: remainingQuantities[item.product_id]?.current_backorder_qty || (item.quantity_ordered - item.quantity_invoiced),
    };
  };

  const calculateGrandTotals = () => {
    const items = form.getValues('items');
    const freightCharges = form.getValues('freight_charges') || 0;
    const packingCharges = form.getValues('packing_charges') || 0;
    const roundOff = form.getValues('round_off') || 0;
    
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    let totalOrderedQty = 0;
    let totalInvoicedQty = 0;
    let totalBackorderQty = 0;
    
    items.forEach((_, index) => {
      const itemTotals = calculateItemTotals(index);
      if (itemTotals) {
        subtotal += itemTotals.subtotal;
        totalDiscount += itemTotals.discountAmount;
        totalTax += itemTotals.totalTax;
        totalOrderedQty += items[index].quantity_ordered;
        totalInvoicedQty += items[index].quantity_invoiced;
        totalBackorderQty += itemTotals.backorderQuantity;
      }
    });
    
    const grandTotal = subtotal - totalDiscount + totalTax + freightCharges + packingCharges + roundOff;
    
    return {
      subtotal,
      totalDiscount,
      totalTax,
      grandTotal,
      totalOrderedQty,
      totalInvoicedQty,
      totalBackorderQty,
    };
  };

  const numberToWords = (num: number): string => {
    // Simple implementation - you might want to use a library for more comprehensive conversion
    if (num === 0) return 'Zero';
    return `Rupees ${num.toFixed(2)} only`;
  };

  const handleSubmit = async (data: SalesInvoiceFormData) => {
    console.log('🔄 SalesInvoiceForm: Starting submission...', { editingInvoice: !!editingInvoice });
    
    // Check for any validation errors
    const hasErrors = Object.values(quantityErrors).some(error => error);
    if (hasErrors) {
      toast({
        title: "Validation Error",
        description: "Please fix quantity validation errors before submitting",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);
    try {
      const totals = calculateGrandTotals();
      
      const invoiceData = {
        ...data,
        subtotal_amount: totals.subtotal,
        discount_amount: totals.totalDiscount,
        tax_amount: totals.totalTax,
        total_amount: totals.grandTotal,
        amount_in_words: numberToWords(totals.grandTotal),
        items: data.items.map(item => ({
          ...item,
          warehouse_id: data.default_warehouse_id,
          bin_id: data.default_bin_id
        }))
      };
      
      console.log('📤 SalesInvoiceForm: Calling onSubmit...', { invoiceDataKeys: Object.keys(invoiceData) });
      await onSubmit(invoiceData);
      console.log('✅ SalesInvoiceForm: onSubmit completed successfully');
    } catch (error) {
      console.error('❌ SalesInvoiceForm: Error in handleSubmit:', error);
      throw error; // Re-throw to let parent handle
    } finally {
      setLoading(false);
      console.log('🏁 SalesInvoiceForm: Submission process finished');
    }
  };

  const totals = calculateGrandTotals();

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Header Section */}
          <Card>
            <CardHeader>
              <CardTitle>Sales Invoice - Header Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="invoice_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Invoice Number</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder={
                            watchedStatus === 'draft' 
                              ? "Will be generated when finalized" 
                              : "Auto-generated if empty"
                          } 
                          {...field} 
                          disabled={!!editingInvoice || watchedStatus === 'draft'}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="invoice_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Invoice Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            autoFocus
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sales_order_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sales Order Number</FormLabel>
                      <Select onValueChange={onSalesOrderChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select sales order" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {salesOrders.map((order) => (
                            <SelectItem key={order.id} value={order.id}>
                              {order.order_number} - {order.customers.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Recent Invoices Reference */}
              {recentInvoices.length > 0 && (
                <div className="mt-4">
                  <FormLabel>Recent Invoices (Reference)</FormLabel>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {recentInvoices.map((invoice) => (
                      <Badge key={invoice.invoice_number} variant="secondary">
                        {invoice.invoice_number} - ₹{invoice.total_amount}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="delivery_note_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Delivery Note Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Optional" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="customer_po_reference"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer PO Reference</FormLabel>
                      <FormControl>
                        <Input placeholder="Customer PO reference" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Warehouse and Bin (Read-only from Sales Order) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="default_warehouse_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Warehouse *</FormLabel>
                      <FormControl>
                        <Input 
                          value={warehouseName || 'Not selected'}
                          disabled
                          className="bg-muted text-muted-foreground"
                        />
                      </FormControl>
                      <FormMessage />
                      {!field.value && (
                        <p className="text-sm text-muted-foreground">
                          Will be auto-filled from selected Sales Order
                        </p>
                      )}
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="default_bin_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Bin *</FormLabel>
                      <FormControl>
                        <Input 
                          value={binName || 'Not selected'}
                          disabled
                          className="bg-muted text-muted-foreground"
                        />
                      </FormControl>
                      <FormMessage />
                      {!field.value && (
                        <p className="text-sm text-muted-foreground">
                          Will be auto-filled from selected Sales Order
                        </p>
                      )}
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Customer and Address Section */}
          <Card>
            <CardHeader>
              <CardTitle>Customer & Address Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="customer_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Name</FormLabel>
                      <FormControl>
                        <Input {...field} disabled />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Billing Address */}
                <div className="space-y-4">
                  <h4 className="font-medium">Billing Address</h4>
                  <FormField
                    control={form.control}
                    name="billing_address_line1"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address Line 1</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="billing_address_line2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address Line 2</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <FormField
                      control={form.control}
                      name="billing_city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="billing_pin_code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pin Code</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="billing_country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Shipping Address */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <h4 className="font-medium">Shipping Address</h4>
                    <FormField
                      control={form.control}
                      name="same_as_billing_address"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel className="text-sm">Same as Billing</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="shipping_address_line1"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address Line 1</FormLabel>
                        <FormControl>
                          <Input {...field} disabled={watchedSameAsBilling} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="shipping_address_line2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address Line 2</FormLabel>
                        <FormControl>
                          <Input {...field} disabled={watchedSameAsBilling} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <FormField
                      control={form.control}
                      name="shipping_city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input {...field} disabled={watchedSameAsBilling} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="shipping_pin_code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pin Code</FormLabel>
                          <FormControl>
                            <Input {...field} disabled={watchedSameAsBilling} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="shipping_country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country</FormLabel>
                        <FormControl>
                          <Input {...field} disabled={watchedSameAsBilling} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Additional Details */}
          <Card>
            <CardHeader>
              <CardTitle>Additional Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="INR">INR</SelectItem>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="payment_terms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Terms</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Net 30" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="account_manager"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Manager</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="mode_of_delivery"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mode of Delivery</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Air, Sea, Road" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Line Items Section */}
          <Card>
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
            </CardHeader>
            <CardContent>
              {watchedItems.length > 0 && (
                <div className="space-y-4">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item Code</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">HSN</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ordered</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Already Invoiced</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Remaining</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice Qty</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SO Backorder</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">UOM</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Discount %</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CGST %</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SGST %</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IGST %</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Line Total</th>
                          </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {watchedItems.map((item, index) => {
                          const itemTotals = calculateItemTotals(index);
                          const remainingData = remainingQuantities[item.product_id];
                          return (
                             <tr key={index}>
                               <td className="px-4 py-3 text-sm">{item.item_code}</td>
                               <td className="px-4 py-3 text-sm">{item.item_description}</td>
                               <td className="px-4 py-3 text-sm">
                                 <FormField
                                   control={form.control}
                                   name={`items.${index}.hsn_sac_code`}
                                   render={({ field }) => (
                                     <Input {...field} className="w-20" />
                                   )}
                                 />
                               </td>
                               <td className="px-4 py-3 text-sm font-medium">{item.quantity_ordered}</td>
                               <td className="px-4 py-3 text-sm font-medium text-blue-600">
                                 {remainingData?.quantity_already_invoiced || 0}
                               </td>
                               <td className="px-4 py-3 text-sm font-medium text-green-600">
                                 {remainingData?.quantity_remaining || 0}
                               </td>
                               <td className="px-4 py-3 text-sm">
                                 <div className="text-center">
                                   <span className={cn(
                                     "font-medium",
                                     (stockLevels[item.product_id] || 0) > 0 ? "text-green-600" : "text-red-600"
                                   )}>
                                     {stockLevels[item.product_id] || 0}
                                   </span>
                                   <div className="text-xs text-muted-foreground">on hand</div>
                                 </div>
                               </td>
                               <td className="px-4 py-3 text-sm">
                                 <div className="space-y-1">
                                   <FormField
                                     control={form.control}
                                     name={`items.${index}.quantity_invoiced`}
                                     render={({ field }) => (
                                       <Input
                                         type="number"
                                         {...field}
                                         onChange={(e) => {
                                           const value = parseFloat(e.target.value) || 0;
                                           handleQuantityChange(index, value);
                                         }}
                                         className={cn(
                                           "w-20",
                                           quantityErrors[index] ? "border-red-500" : ""
                                         )}
                                         max={remainingData?.quantity_remaining || 0}
                                       />
                                     )}
                                   />
                                   {quantityErrors[index] && (
                                     <div className="text-xs text-red-500 mt-1">
                                       {quantityErrors[index]}
                                     </div>
                                   )}
                                 </div>
                               </td>
                              <td className="px-4 py-3 text-sm font-medium text-orange-600">
                                {remainingData?.current_backorder_qty || 0}
                              </td>
                              <td className="px-4 py-3 text-sm">{item.unit_of_measure}</td>
                              <td className="px-4 py-3 text-sm">₹{item.unit_price.toFixed(2)}</td>
                              <td className="px-4 py-3 text-sm">
                                <FormField
                                  control={form.control}
                                  name={`items.${index}.discount_percentage`}
                                  render={({ field }) => (
                                    <Input
                                      type="number"
                                      {...field}
                                      onChange={(e) => {
                                        const value = parseFloat(e.target.value) || 0;
                                        field.onChange(value);
                                      }}
                                      className="w-16"
                                    />
                                  )}
                                />
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <FormField
                                  control={form.control}
                                  name={`items.${index}.cgst_rate`}
                                  render={({ field }) => (
                                    <Input
                                      type="number"
                                      {...field}
                                      onChange={(e) => {
                                        const value = parseFloat(e.target.value) || 0;
                                        field.onChange(value);
                                      }}
                                      className="w-16"
                                    />
                                  )}
                                />
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <FormField
                                  control={form.control}
                                  name={`items.${index}.sgst_rate`}
                                  render={({ field }) => (
                                    <Input
                                      type="number"
                                      {...field}
                                      onChange={(e) => {
                                        const value = parseFloat(e.target.value) || 0;
                                        field.onChange(value);
                                      }}
                                      className="w-16"
                                    />
                                  )}
                                />
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <FormField
                                  control={form.control}
                                  name={`items.${index}.igst_rate`}
                                  render={({ field }) => (
                                    <Input
                                      type="number"
                                      {...field}
                                      onChange={(e) => {
                                        const value = parseFloat(e.target.value) || 0;
                                        field.onChange(value);
                                      }}
                                      className="w-16"
                                    />
                                  )}
                                />
                              </td>
                              <td className="px-4 py-3 text-sm font-medium">
                                ₹{itemTotals?.lineTotal.toFixed(2) || '0.00'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Invoice Totals */}
          <Card>
            <CardHeader>
              <CardTitle>Invoice Totals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="freight_charges"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Freight Charges</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          {...field}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            field.onChange(value);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="packing_charges"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Packing Charges</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          {...field}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            field.onChange(value);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="round_off"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Round Off</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          {...field}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            field.onChange(value);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal (before tax):</span>
                  <span>₹{totals.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Discount:</span>
                  <span>₹{totals.totalDiscount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Tax:</span>
                  <span>₹{totals.totalTax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Freight Charges:</span>
                  <span>₹{(form.getValues('freight_charges') || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Packing Charges:</span>
                  <span>₹{(form.getValues('packing_charges') || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Round Off:</span>
                  <span>₹{(form.getValues('round_off') || 0).toFixed(2)}</span>
                </div>
                <hr />
                <div className="flex justify-between font-bold text-lg">
                  <span>Grand Total:</span>
                  <span>₹{totals.grandTotal.toFixed(2)}</span>
                </div>
                <div className="text-sm text-gray-600 mt-2">
                  Amount in words: {numberToWords(totals.grandTotal)}
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg space-y-2">
                <h4 className="font-medium text-blue-800">Order Summary</h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Total Ordered:</span>
                    <br />
                    <span className="text-lg font-bold text-blue-600">{totals.totalOrderedQty}</span>
                  </div>
                  <div>
                    <span className="font-medium">Total Invoiced:</span>
                    <br />
                    <span className="text-lg font-bold text-green-600">{totals.totalInvoicedQty}</span>
                  </div>
                  <div>
                    <span className="font-medium">Total Backorder:</span>
                    <br />
                    <span className="text-lg font-bold text-orange-600">{totals.totalBackorderQty}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Additional Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Invoice Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Select invoice status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-background border shadow-md z-50">
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="finalized">Finalize & Generate Invoice Number</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Any additional notes for this invoice..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Form Actions */}
          <div className="flex justify-end space-x-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || watchedItems.length === 0}>
              {loading ? 'Saving...' : editingInvoice ? 'Update Invoice' : 'Create Invoice'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};