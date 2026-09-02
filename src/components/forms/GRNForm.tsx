import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { CalendarIcon, Plus, Trash2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const grnFormSchema = z.object({
  purchase_order_id: z.string().min(1, 'Please select a purchase order'),
  supplier_id: z.string().min(1, 'Supplier is required'),
  supplier_name: z.string().min(1, 'Supplier name is required'),
  grn_reference_no: z.string().optional(),
  grn_date: z.string().min(1, 'GRN date is required'),
  supplier_invoice_number: z.string().optional(),
  supplier_invoice_date: z.string().optional(),
  remarks: z.string().optional(),
  status: z.enum(['draft', 'received', 'accepted']),
  // Consolidated warehouse & bin at form level
  default_warehouse_id: z.string().min(1, 'Default warehouse is required'),
  default_bin_id: z.string().min(1, 'Default bin is required'),
  items: z.array(z.object({
    product_id: z.string().min(1, 'Product is required'),
    product_name: z.string(),
    product_sku: z.string().optional(),
    unit_of_measure: z.string().optional(),
    ordered_quantity: z.number().min(0),
    received_quantity: z.number().min(0, 'Received quantity is required'),
    accepted_quantity: z.number().min(0, 'Accepted quantity is required'),
    rejected_quantity: z.number().min(0, 'Rejected quantity is required'),
    unit_price: z.number().min(0.01, 'Unit price must be greater than 0'),
    discount_percentage: z.number().min(0).max(100).optional(),
    discount_amount: z.number().min(0).optional(),
    warehouse_id: z.string().optional(),
    bin_id: z.string().optional(),
    hsn_sac_code: z.string().optional(),
    cgst_rate: z.number().min(0).optional(),
    cgst_amount: z.number().min(0).optional(),
    sgst_rate: z.number().min(0).optional(),
    sgst_amount: z.number().min(0).optional(),
    igst_rate: z.number().min(0).optional(),
    igst_amount: z.number().min(0).optional(),
    total_tax_amount: z.number().min(0).optional(),
    line_total: z.number().min(0).optional(),
  })).min(1, 'At least one item is required'),
});

interface GRNFormProps {
  grn?: any;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
  readOnly?: boolean;
  mode: 'create' | 'edit' | 'view';
}

export function GRNForm({ grn, onSubmit, onCancel, readOnly = false, mode }: GRNFormProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [bins, setBins] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPO, setSelectedPO] = useState<any>(null);

  const form = useForm<z.infer<typeof grnFormSchema>>({
    resolver: zodResolver(grnFormSchema),
    defaultValues: {
      purchase_order_id: grn?.purchase_order_id || '',
      supplier_id: grn?.supplier_id || '',
      supplier_name: grn?.supplier_name || '',
      grn_reference_no: grn?.grn_reference_no || '',
      grn_date: grn?.grn_date ? new Date(grn.grn_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      supplier_invoice_number: grn?.supplier_invoice_number || '',
      supplier_invoice_date: grn?.supplier_invoice_date ? new Date(grn.supplier_invoice_date).toISOString().split('T')[0] : null,
      remarks: grn?.remarks || '',
      status: grn?.status || 'accepted',
      default_warehouse_id: '',
      default_bin_id: '',
      items: grn?.grn_line_items?.map((item: any) => ({
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
        warehouse_id: item.warehouse_id || '',
        bin_id: item.bin_id || '',
        hsn_sac_code: item.hsn_sac_code,
        cgst_rate: item.cgst_rate || 0,
        cgst_amount: item.cgst_amount || 0,
        sgst_rate: item.sgst_rate || 0,
        sgst_amount: item.sgst_amount || 0,
        igst_rate: item.igst_rate || 0,
        igst_amount: item.igst_amount || 0,
        total_tax_amount: item.total_tax_amount || 0,
        line_total: item.line_total || 0,
      })) || [],
    },
  });

  useEffect(() => {
    if (profile?.company_id) {
      fetchPurchaseOrders();
      fetchSuppliers();
      fetchProducts();
      fetchWarehouses();
      fetchBins();
    }
  }, [profile?.company_id]);

  const fetchPurchaseOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          supplier:suppliers(name),
          purchase_order_items(
            *,
            product:products(name, sku)
          )
        `)
        .eq('company_id', profile?.company_id)
        .in('status', ['open', 'partially_received'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPurchaseOrders(data || []);
    } catch (error) {
      console.error('Error fetching purchase orders:', error);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('company_id', profile?.company_id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('company_id', profile?.company_id)
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchWarehouses = async () => {
    try {
      const { data, error } = await supabase
        .from('warehouse_bins')
        .select('id, warehouse_name, warehouse_code')
        .eq('company_id', profile?.company_id)
        .order('warehouse_name');

      if (error) throw error;
      // Group by warehouse_name to avoid duplicates
      const uniqueWarehouses = data?.reduce((acc: any[], curr) => {
        const existing = acc.find(w => w.warehouse_name === curr.warehouse_name);
        if (!existing) {
          acc.push({
            id: curr.id,
            name: curr.warehouse_name,
            warehouse_code: curr.warehouse_code
          });
        }
        return acc;
      }, []) || [];
      setWarehouses(uniqueWarehouses);
    } catch (error) {
      console.error('Error fetching warehouses:', error);
    }
  };

  const fetchBins = async () => {
    try {
      const { data, error } = await supabase
        .from('warehouse_bins')
        .select('*')
        .eq('company_id', profile?.company_id)
        .order('wh_bin_code');

      if (error) throw error;
      setBins(data || []);
    } catch (error) {
      console.error('Error fetching bins:', error);
    }
  };

  const handlePOSelection = (poId: string) => {
    const po = purchaseOrders.find(p => p.id === poId);
    if (!po) return;

    setSelectedPO(po);
    
    // Auto-fill supplier details
    form.setValue('supplier_id', po.supplier_id);
    form.setValue('supplier_name', po.supplier?.name || '');
    
    // Auto-fill items from PO with pending quantities
    const items = po.purchase_order_items?.map((item: any) => ({
      product_id: item.product_id,
      product_name: item.product?.name || item.item_description || 'Unknown Product',
      product_sku: item.product?.sku || item.item_code || '',
      unit_of_measure: item.unit_of_measure || '',
      ordered_quantity: item.quantity,
      received_quantity: item.pending_quantity, // Set to pending quantity initially
      accepted_quantity: 0, // Will be set based on status
      rejected_quantity: 0,
      unit_price: item.unit_price,
      discount_percentage: item.discount_percentage || 0,
      discount_amount: item.discount_amount || 0,
      warehouse_id: form.getValues('default_warehouse_id') || '',
      bin_id: form.getValues('default_bin_id') || '',
      hsn_sac_code: item.hsn_sac_code || '',
      cgst_rate: item.cgst_rate || 0,
      cgst_amount: 0,
      sgst_rate: item.sgst_rate || 0,
      sgst_amount: 0,
      igst_rate: item.igst_rate || 0,
      igst_amount: 0,
      total_tax_amount: 0,
      line_total: 0,
    })) || [];
    
    form.setValue('items', items);
    
    // Apply status-based logic to accepted quantities
    const currentStatus = form.getValues('status');
    handleStatusChange(currentStatus);
  };

  const handleStatusChange = (status: string) => {
    const currentItems = form.getValues('items');
    
    const updatedItems = currentItems.map(item => {
      if (status === 'accepted' || status === 'received') {
        // For "Accepted/Received" status, set accepted_quantity = received_quantity (full receipt)
        return {
          ...item,
          accepted_quantity: item.received_quantity,
          rejected_quantity: 0,
        };
      }
      return item;
    });
    
    form.setValue('items', updatedItems);
    form.setValue('status', (status === 'received' ? 'accepted' : status) as any);
  };

  const calculateItemTotals = (index: number) => {
    const items = form.getValues('items');
    const item = items[index];
    
    if (!item) return;

    const subtotal = (item.accepted_quantity || 0) * (item.unit_price || 0);
    const discountAmount = item.discount_amount || ((item.discount_percentage || 0) * subtotal / 100);
    const afterDiscount = subtotal - discountAmount;
    
    // GST Logic: Either CGST+SGST OR IGST, but not both
    let cgstAmount = 0;
    let sgstAmount = 0; 
    let igstAmount = 0;
    
    if (item.igst_rate && item.igst_rate > 0) {
      // If IGST is provided, use only IGST
      igstAmount = (item.igst_rate || 0) * afterDiscount / 100;
      // Clear CGST/SGST rates if IGST is used
      form.setValue(`items.${index}.cgst_rate`, 0);
      form.setValue(`items.${index}.sgst_rate`, 0);
    } else if ((item.cgst_rate && item.cgst_rate > 0) || (item.sgst_rate && item.sgst_rate > 0)) {
      // If CGST or SGST is provided, use CGST+SGST
      cgstAmount = (item.cgst_rate || 0) * afterDiscount / 100;
      sgstAmount = (item.sgst_rate || 0) * afterDiscount / 100;
      // Clear IGST rate if CGST/SGST is used
      form.setValue(`items.${index}.igst_rate`, 0);
    }
    
    const totalTaxAmount = cgstAmount + sgstAmount + igstAmount;
    const lineTotal = afterDiscount + totalTaxAmount;

    // Update the form values
    form.setValue(`items.${index}.discount_amount`, discountAmount);
    form.setValue(`items.${index}.cgst_amount`, cgstAmount);
    form.setValue(`items.${index}.sgst_amount`, sgstAmount);
    form.setValue(`items.${index}.igst_amount`, igstAmount);
    form.setValue(`items.${index}.total_tax_amount`, totalTaxAmount);
    form.setValue(`items.${index}.line_total`, lineTotal);
  };

  // Apply default warehouse/bin to all items
  const applyDefaultWarehouseBin = () => {
    const defaultWarehouseId = form.getValues('default_warehouse_id');
    const defaultBinId = form.getValues('default_bin_id');
    const items = form.getValues('items');
    
    console.log('Applying default warehouse/bin:', { defaultWarehouseId, defaultBinId, itemsCount: items?.length });
    
    if (defaultWarehouseId && defaultBinId) {
      const updatedItems = items.map(item => ({
        ...item,
        warehouse_id: defaultWarehouseId,
        bin_id: defaultBinId
      }));
      form.setValue('items', updatedItems);
      console.log('Updated items with warehouse/bin:', updatedItems.map(i => ({ 
        name: i.product_name, 
        warehouse_id: i.warehouse_id, 
        bin_id: i.bin_id 
      })));
    }
  };

  // Validation function for all mandatory fields
  const validateAllFields = () => {
    const items = form.getValues('items');
    const defaultWarehouse = form.getValues('default_warehouse_id');
    const defaultBin = form.getValues('default_bin_id');
    let hasErrors = false;

    // Check default warehouse and bin
    if (!defaultWarehouse) {
      form.setError('default_warehouse_id', {
        type: 'manual',
        message: 'Default warehouse is required'
      });
      hasErrors = true;
    }

    if (!defaultBin) {
      form.setError('default_bin_id', {
        type: 'manual',
        message: 'Default bin is required'
      });
      hasErrors = true;
    }

    items.forEach((item, index) => {
      // Check unit price
      if (!item.unit_price || item.unit_price <= 0) {
        form.setError(`items.${index}.unit_price`, {
          type: 'manual',
          message: 'Valid unit price is required'
        });
        hasErrors = true;
      }

      // Validate quantities
      if (!validateQuantities(index)) {
        hasErrors = true;
      }
    });

    return !hasErrors;
  };

  // Helper function to sanitize date values
  const sanitizeDateValue = (dateValue: string | null | undefined): string | null => {
    if (!dateValue || dateValue === '') {
      return null;
    }
    return dateValue;
  };

  const handleSubmit = async (data: z.infer<typeof grnFormSchema>) => {
    if (readOnly) return;
    
    // Validate all mandatory fields
    if (!validateAllFields()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all mandatory fields and fix any errors before submitting.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setLoading(true);
      // Sanitize date fields before submitting
      const sanitizedData = {
        ...data,
        supplier_invoice_date: sanitizeDateValue(data.supplier_invoice_date),
      };
      await onSubmit(sanitizedData);
    } catch (error) {
      console.error('Error submitting GRN:', error);
      toast({
        title: "Error",
        description: "Failed to save GRN",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Validation function for quantities
  const validateQuantities = (index: number) => {
    const items = form.getValues('items');
    const item = items[index];
    
    // Received quantity cannot exceed ordered quantity
    if (item.received_quantity > item.ordered_quantity) {
      form.setError(`items.${index}.received_quantity`, {
        type: 'manual',
        message: 'Received quantity cannot exceed ordered quantity'
      });
      return false;
    }
    
    // Accepted + Rejected cannot exceed received quantity
    const totalProcessed = item.accepted_quantity + item.rejected_quantity;
    if (totalProcessed > item.received_quantity) {
      form.setError(`items.${index}.accepted_quantity`, {
        type: 'manual',
        message: 'Accepted + Rejected quantity cannot exceed received quantity'
      });
      return false;
    }
    
    return true;
  };

  // Calculate summary totals
  const calculateSummary = () => {
    const items = form.getValues('items') || [];
    return items.reduce((acc, item) => {
      return {
        totalOrdered: acc.totalOrdered + (item.ordered_quantity || 0),
        totalReceived: acc.totalReceived + (item.received_quantity || 0),
        totalAccepted: acc.totalAccepted + (item.accepted_quantity || 0),
        totalRejected: acc.totalRejected + (item.rejected_quantity || 0),
        totalPending: acc.totalPending + ((item.ordered_quantity || 0) - (item.received_quantity || 0)),
        totalAmount: acc.totalAmount + (item.line_total || 0),
      };
    }, {
      totalOrdered: 0,
      totalReceived: 0,
      totalAccepted: 0,
      totalRejected: 0,
      totalPending: 0,
      totalAmount: 0,
    });
  };

  const summary = calculateSummary();

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* GRN Reference Number - Top Section */}
        <Card className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 border-purple-200">
          <CardContent className="pt-6">
            <FormField
              control={form.control}
              name="grn_reference_no"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-purple-700 dark:text-purple-300 font-semibold">GRN Reference No.</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      disabled 
                      placeholder="Auto-generated after creation"
                      className="bg-purple-100/50 dark:bg-purple-900/30 border-purple-200 text-purple-800 dark:text-purple-200 font-medium text-center"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Purchase Order Selection */}
          <FormField
            control={form.control}
            name="purchase_order_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Purchase Order *</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={(value) => {
                    field.onChange(value);
                    handlePOSelection(value);
                  }}
                  disabled={readOnly || mode === 'edit'}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select purchase order" />
                    </SelectTrigger>
                  </FormControl>
                   <SelectContent>
                     {purchaseOrders.filter(po => po.id && po.id.trim() !== '').map((po) => (
                       <SelectItem key={po.id} value={po.id}>
                         {po.po_number || 'N/A'} - {po.supplier?.name || 'Unknown Supplier'} (₹{po.total_amount?.toLocaleString() || '0'})
                       </SelectItem>
                     ))}
                   </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Status Selection - Only "Accepted" and "Received" */}
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status *</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={(value) => {
                    field.onChange(value);
                    handleStatusChange(value);
                  }}
                  disabled={readOnly}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="accepted">Accepted</SelectItem>
                    <SelectItem value="received">Received</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Supplier Name (Auto-filled, read-only) */}
          <FormField
            control={form.control}
            name="supplier_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Supplier Name</FormLabel>
                <FormControl>
                  <Input {...field} disabled />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* GRN Date */}
          <FormField
            control={form.control}
            name="grn_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>GRN Date *</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    {...field}
                    disabled={readOnly}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Supplier Invoice Number */}
          <FormField
            control={form.control}
            name="supplier_invoice_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Supplier Invoice Number</FormLabel>
                <FormControl>
                  <Input {...field} disabled={readOnly} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Supplier Invoice Date */}
          <FormField
            control={form.control}
            name="supplier_invoice_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Supplier Invoice Date</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    {...field}
                    disabled={readOnly}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Consolidated Warehouse & Bin Selection */}
        <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-700 dark:text-blue-300 text-lg">Default Warehouse & Bin</CardTitle>
            <p className="text-sm text-blue-600 dark:text-blue-400">Select default warehouse and bin for all items (can be overridden per item if needed)</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="default_warehouse_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default Warehouse *</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        form.setValue('default_bin_id', '');
                        applyDefaultWarehouseBin();
                      }}
                      disabled={readOnly}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select warehouse" />
                        </SelectTrigger>
                      </FormControl>
                       <SelectContent>
                         {warehouses.filter(warehouse => warehouse.id && warehouse.id.trim() !== '').map((warehouse) => (
                           <SelectItem key={warehouse.id} value={warehouse.id}>
                             {warehouse.name || 'Unknown'} ({warehouse.warehouse_code || 'N/A'})
                           </SelectItem>
                         ))}
                       </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="default_bin_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default Bin *</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        applyDefaultWarehouseBin();
                      }}
                      disabled={readOnly || !form.watch('default_warehouse_id')}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select bin" />
                        </SelectTrigger>
                      </FormControl>
                       <SelectContent>
                         {bins
                           .filter(bin => {
                             const selectedWarehouse = warehouses.find(w => w.id === form.watch('default_warehouse_id'));
                             return bin.warehouse_name === selectedWarehouse?.name && bin.id && bin.id.trim() !== '';
                           })
                           .map((bin) => (
                             <SelectItem key={bin.id} value={bin.id}>
                               {bin.bin_name || 'Unknown Bin'} ({bin.wh_bin_code || 'N/A'})
                             </SelectItem>
                           ))
                         }
                       </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Remarks */}
        <FormField
          control={form.control}
          name="remarks"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Remarks</FormLabel>
              <FormControl>
                <Textarea {...field} disabled={readOnly} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Items Section */}
        <Card className="shadow-sm">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
            <CardTitle className="text-lg font-semibold text-primary flex items-center gap-2">
              <div className="h-2 w-2 bg-primary rounded-full"></div>
              Product Items
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {form.watch('items')?.length > 0 ? (
              <div className="space-y-6">
                {/* Main Items Table */}
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gradient-to-r from-muted/50 to-muted/30">
                        <th className="border-r border-border p-4 text-left text-sm font-semibold text-foreground">Product Details</th>
                        <th className="border-r border-border p-4 text-center text-sm font-semibold text-foreground">Quantities</th>
                        <th className="border-r border-border p-4 text-center text-sm font-semibold text-foreground">Unit Price</th>
                        <th className="p-4 text-center text-sm font-semibold text-foreground">Line Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.watch('items').map((item: any, index: number) => {
                        const selectedBin = bins.find(b => b.id === item.bin_id);
                        const selectedWarehouse = warehouses.find(w => w.name === selectedBin?.warehouse_name);
                        
                        return (
                          <tr key={index} className="hover:bg-muted/30 transition-colors border-b border-border">
                            {/* Product Details */}
                            <td className="border-r border-border p-4">
                              <div className="space-y-3">
                                <div>
                                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Product Name</label>
                                  <Input
                                    value={item.product_name || ''}
                                    disabled
                                    className="bg-muted/30 text-sm font-medium"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-muted-foreground mb-1 block">SKU</label>
                                  <Input
                                    value={item.product_sku || ''}
                                    disabled
                                    className="bg-muted/30 text-sm"
                                  />
                                </div>
                              </div>
                            </td>
                            
                            {/* Quantities */}
                            <td className="border-r border-border p-4">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Ordered Qty</label>
                                  <Input
                                    type="number"
                                    value={item.ordered_quantity || 0}
                                    disabled
                                    className="bg-muted/30 text-sm text-center"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Received Qty</label>
                                  <Input
                                    type="number"
                                    min="0"
                                    max={item.ordered_quantity}
                                    value={item.received_quantity || 0}
                                    onChange={(e) => {
                                      const newValue = Math.min(
                                        parseFloat(e.target.value) || 0, 
                                        item.ordered_quantity
                                      );
                                      form.setValue(`items.${index}.received_quantity`, newValue);
                                      
                                      // Auto-update accepted quantity if status is "accepted"
                                      if (form.getValues('status') === 'accepted') {
                                        form.setValue(`items.${index}.accepted_quantity`, newValue);
                                        form.setValue(`items.${index}.rejected_quantity`, 0);
                                      }
                                      
                                      validateQuantities(index);
                                      calculateItemTotals(index);
                                    }}
                                    disabled={readOnly}
                                    className="text-sm text-center border-blue-200 focus:border-blue-400"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-green-600 mb-1 block">Accepted Qty *</label>
                                  <Input
                                    type="number"
                                    min="0"
                                    value={item.accepted_quantity || 0}
                                    onChange={(e) => {
                                      const newValue = parseFloat(e.target.value) || 0;
                                      const maxAccepted = (item.received_quantity || 0) - (item.rejected_quantity || 0);
                                      const finalValue = Math.min(newValue, maxAccepted);
                                      form.setValue(`items.${index}.accepted_quantity`, finalValue);
                                      validateQuantities(index);
                                      calculateItemTotals(index);
                                    }}
                                    disabled={readOnly}
                                    className="text-sm text-center border-green-200 focus:border-green-400 bg-green-50/50"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-red-600 mb-1 block">Rejected Qty *</label>
                                  <Input
                                    type="number"
                                    min="0"
                                    value={item.rejected_quantity || 0}
                                    onChange={(e) => {
                                      const newValue = parseFloat(e.target.value) || 0;
                                      const maxRejected = (item.received_quantity || 0) - (item.accepted_quantity || 0);
                                      const finalValue = Math.min(newValue, maxRejected);
                                      form.setValue(`items.${index}.rejected_quantity`, finalValue);
                                      validateQuantities(index);
                                    }}
                                    disabled={readOnly}
                                    className="text-sm text-center border-red-200 focus:border-red-400 bg-red-50/50"
                                  />
                                </div>
                              </div>
                              <div className="mt-2 text-xs text-muted-foreground text-center">
                                Pending: {(item.ordered_quantity || 0) - (item.received_quantity || 0)}
                              </div>
                            </td>
                            
                            {/* Unit Price */}
                            <td className="border-r border-border p-4">
                              <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1 block">Unit Price *</label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0.01"
                                  value={item.unit_price || 0}
                                  onChange={(e) => {
                                    const newPrice = parseFloat(e.target.value) || 0;
                                    form.setValue(`items.${index}.unit_price`, newPrice);
                                    calculateItemTotals(index);
                                  }}
                                  disabled={readOnly}
                                  className="text-sm text-center font-medium border-blue-200 focus:border-blue-400"
                                />
                              </div>
                            </td>
                            
                            
                            {/* Line Total */}
                            <td className="p-4">
                              <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1 block">Line Total</label>
                                <Input
                                  type="number"
                                  value={item.line_total?.toFixed(2) || '0.00'}
                                  disabled
                                  className="bg-primary/10 text-sm text-center font-bold text-primary"
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* GST Section - Moved to Bottom */}
                <Card className="border-dashed border-2 border-orange-200 bg-orange-50/50 dark:bg-orange-950/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold text-orange-700 dark:text-orange-400 flex items-center gap-2">
                      <div className="h-2 w-2 bg-orange-500 rounded-full"></div>
                      GST Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-orange-200">
                        <thead>
                          <tr className="bg-orange-100 dark:bg-orange-900/30">
                            <th className="border border-orange-200 p-3 text-left text-sm font-medium">Product</th>
                            <th className="border border-orange-200 p-3 text-center text-sm font-medium">CGST %</th>
                            <th className="border border-orange-200 p-3 text-center text-sm font-medium">CGST Amount</th>
                            <th className="border border-orange-200 p-3 text-center text-sm font-medium">SGST %</th>
                            <th className="border border-orange-200 p-3 text-center text-sm font-medium">SGST Amount</th>
                            <th className="border border-orange-200 p-3 text-center text-sm font-medium">IGST %</th>
                            <th className="border border-orange-200 p-3 text-center text-sm font-medium">IGST Amount</th>
                            <th className="border border-orange-200 p-3 text-center text-sm font-medium">Total Tax</th>
                          </tr>
                        </thead>
                        <tbody>
                          {form.watch('items').map((item: any, index: number) => (
                            <tr key={index} className="hover:bg-orange-50 dark:hover:bg-orange-950/20">
                              <td className="border border-orange-200 p-2">
                                <div className="text-sm font-medium">{item.product_name}</div>
                                <div className="text-xs text-muted-foreground">{item.product_sku}</div>
                              </td>
                              
                              <td className="border border-orange-200 p-2">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                max="100"
                                value={item.cgst_rate || 0}
                                onChange={(e) => {
                                  const rate = parseFloat(e.target.value) || 0;
                                  form.setValue(`items.${index}.cgst_rate`, rate);
                                  // Clear IGST if CGST is being set
                                  if (rate > 0) {
                                    form.setValue(`items.${index}.igst_rate`, 0);
                                  }
                                  calculateItemTotals(index);
                                }}
                                disabled={readOnly || (item.igst_rate > 0)}
                                className="text-sm text-center border-orange-200 focus:border-orange-400"
                                placeholder={item.igst_rate > 0 ? "Disabled (IGST active)" : "0.00"}
                              />
                              </td>
                              
                              <td className="border border-orange-200 p-2">
                                <Input
                                  type="number"
                                  value={item.cgst_amount?.toFixed(2) || '0.00'}
                                  disabled
                                  className="text-sm text-center bg-muted/30 font-medium"
                                />
                              </td>
                              
                              <td className="border border-orange-200 p-2">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                max="100"
                                value={item.sgst_rate || 0}
                                onChange={(e) => {
                                  const rate = parseFloat(e.target.value) || 0;
                                  form.setValue(`items.${index}.sgst_rate`, rate);
                                  // Clear IGST if SGST is being set
                                  if (rate > 0) {
                                    form.setValue(`items.${index}.igst_rate`, 0);
                                  }
                                  calculateItemTotals(index);
                                }}
                                disabled={readOnly || (item.igst_rate > 0)}
                                className="text-sm text-center border-orange-200 focus:border-orange-400"
                                placeholder={item.igst_rate > 0 ? "Disabled (IGST active)" : "0.00"}
                              />
                              </td>
                              
                              <td className="border border-orange-200 p-2">
                                <Input
                                  type="number"
                                  value={item.sgst_amount?.toFixed(2) || '0.00'}
                                  disabled
                                  className="text-sm text-center bg-muted/30 font-medium"
                                />
                              </td>
                              
                              <td className="border border-orange-200 p-2">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                max="100"
                                value={item.igst_rate || 0}
                                onChange={(e) => {
                                  const rate = parseFloat(e.target.value) || 0;
                                  form.setValue(`items.${index}.igst_rate`, rate);
                                  // Clear CGST/SGST if IGST is being set
                                  if (rate > 0) {
                                    form.setValue(`items.${index}.cgst_rate`, 0);
                                    form.setValue(`items.${index}.sgst_rate`, 0);
                                  }
                                  calculateItemTotals(index);
                                }}
                                disabled={readOnly || ((item.cgst_rate > 0) || (item.sgst_rate > 0))}
                                className="text-sm text-center border-orange-200 focus:border-orange-400"
                                placeholder={((item.cgst_rate > 0) || (item.sgst_rate > 0)) ? "Disabled (CGST/SGST active)" : "0.00"}
                              />
                              </td>
                              
                              <td className="border border-orange-200 p-2">
                                <Input
                                  type="number"
                                  value={item.igst_amount?.toFixed(2) || '0.00'}
                                  disabled
                                  className="text-sm text-center bg-muted/30 font-medium"
                                />
                              </td>
                              
                              <td className="border border-orange-200 p-2">
                                <Input
                                  type="number"
                                  value={((item.cgst_amount || 0) + (item.sgst_amount || 0) + (item.igst_amount || 0)).toFixed(2)}
                                  disabled
                                  className="text-sm text-center bg-orange-100 dark:bg-orange-900/30 font-bold text-orange-700 dark:text-orange-400"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <div className="text-4xl mb-4">📦</div>
                <p className="text-lg font-medium mb-2">No Purchase Order Selected</p>
                <p className="text-sm">Please select a Purchase Order above to load items for GRN processing</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary Section */}
        {form.watch('items')?.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>GRN Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                  <div className="text-sm text-muted-foreground">Total Ordered</div>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {summary.totalOrdered.toLocaleString()}
                  </div>
                </div>
                <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
                  <div className="text-sm text-muted-foreground">Total Received</div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {summary.totalReceived.toLocaleString()}
                  </div>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-950 p-4 rounded-lg">
                  <div className="text-sm text-muted-foreground">Total Accepted</div>
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {summary.totalAccepted.toLocaleString()}
                  </div>
                </div>
                <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg">
                  <div className="text-sm text-muted-foreground">Total Rejected</div>
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {summary.totalRejected.toLocaleString()}
                  </div>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-950 p-4 rounded-lg">
                  <div className="text-sm text-muted-foreground">Total Pending</div>
                  <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                    {summary.totalPending.toLocaleString()}
                  </div>
                </div>
                <div className="bg-purple-50 dark:bg-purple-950 p-4 rounded-lg">
                  <div className="text-sm text-muted-foreground">GRN Amount</div>
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    ₹{summary.totalAmount.toLocaleString()}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end space-x-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
          >
            {readOnly ? 'Close' : 'Cancel'}
          </Button>
          {!readOnly && (
            <Button
              type="submit"
              disabled={loading}
            >
              {loading ? 'Saving...' : mode === 'create' ? 'Create GRN' : 'Update GRN'}
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}
