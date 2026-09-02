import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Trash2, Save, X } from 'lucide-react';

// Form validation schema
const rsoSchema = z.object({
  customer_id: z.string().min(1, 'Customer is required'),
  invoice_id: z.string().min(1, 'Invoice is required'),
  rso_date: z.string().min(1, 'RSO date is required'),
  reason_for_credit: z.string().min(1, 'Reason for credit is required'),
  status: z.enum(['Draft', 'Confirmed']),
  delivery_same_as_company: z.boolean(),
  delivery_address_line1: z.string().optional(),
  delivery_address_line2: z.string().optional(),
  delivery_city: z.string().optional(),
  delivery_country: z.string().optional(),
  delivery_pin_code: z.string().optional(),
  notes: z.string().optional(),
});

type RSOFormData = z.infer<typeof rsoSchema>;

interface Customer {
  id: string;
  name: string;
  customer_ref: string;
}

interface SalesInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  customer_id: string;
  total_amount: number;
}

interface InvoiceItem {
  id: string;
  product_id: string;
  item_description: string;
  item_code: string;
  hsn_sac_code: string | null;
  unit_of_measure: string;
  quantity_invoiced: number;
  unit_price: number;
  discount_percentage: number;
  discount_amount: number;
  cgst_rate: number;
  cgst_amount: number;
  sgst_rate: number;
  sgst_amount: number;
  igst_rate: number;
  igst_amount: number;
  line_subtotal: number;
  tax_amount: number;
  line_total: number;
}

interface ReturnItem extends InvoiceItem {
  product_name: string;
  product_sku: string;
  return_qty: number;
  available_qty: number;
  return_line_total: number;
}

interface RSOFormProps {
  rsoId?: string;
  onClose: () => void;
  onSave: () => void;
}

export function RSOForm({ rsoId, onClose, onSave }: RSOFormProps) {
  const { user } = useAuth();
  const { company } = useCompany();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [invoiceItems, setInvoiceItems] = useState<ReturnItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<SalesInvoice | null>(null);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);

  const form = useForm<RSOFormData>({
    resolver: zodResolver(rsoSchema),
    defaultValues: {
      customer_id: '',
      invoice_id: '',
      rso_date: new Date().toISOString().split('T')[0],
      reason_for_credit: '',
      status: 'Draft',
      delivery_same_as_company: true,
      delivery_address_line1: '',
      delivery_address_line2: '',
      delivery_city: '',
      delivery_country: '',
      delivery_pin_code: '',
      notes: '',
    },
  });

  const watchDeliverySameAsCompany = form.watch('delivery_same_as_company');

  // Load customers on component mount
  useEffect(() => {
    loadCustomers();
    if (rsoId) {
      loadExistingRSO();
    }
  }, [rsoId, company?.id]);

  // Load invoices when customer changes (but not during existing RSO load)
  useEffect(() => {
    if (selectedCustomer && !isLoadingExisting) {
      loadCustomerInvoices(selectedCustomer.id);
    } else if (!selectedCustomer) {
      setInvoices([]);
      setSelectedInvoice(null);
    }
  }, [selectedCustomer, isLoadingExisting]);

  // Load invoice items when invoice changes (but not during existing RSO load)
  useEffect(() => {
    console.log('Invoice changed:', selectedInvoice);
    if (selectedInvoice && !isLoadingExisting) {
      loadInvoiceItems(selectedInvoice.id);
    } else if (!selectedInvoice) {
      setInvoiceItems([]);
    }
  }, [selectedInvoice, isLoadingExisting]);

  // Debug log for invoiceItems state
  useEffect(() => {
    console.log('InvoiceItems state changed:', invoiceItems);
  }, [invoiceItems]);

  const loadCustomers = async () => {
    if (!company?.id) return;

    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, customer_ref')
        .eq('company_id', company.id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error loading customers:', error);
      toast({
        title: 'Error',
        description: 'Failed to load customers',
        variant: 'destructive',
      });
    }
  };

  const loadCustomerInvoices = async (customerId: string) => {
    if (!company?.id) return;

    try {
      const { data, error } = await supabase
        .from('sales_invoices')
        .select('id, invoice_number, invoice_date, customer_id, total_amount')
        .eq('company_id', company.id)
        .eq('customer_id', customerId)
        .eq('status', 'finalized')
        .order('invoice_date', { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      console.error('Error loading invoices:', error);
      toast({
        title: 'Error',
        description: 'Failed to load customer invoices',
        variant: 'destructive',
      });
    }
  };

  const loadInvoiceItems = async (invoiceId: string) => {
    console.log('Loading invoice items for invoice:', invoiceId);
    try {
      const { data, error } = await supabase
        .from('sales_invoice_items')
        .select('*')
        .eq('sales_invoice_id', invoiceId);

      console.log('Invoice items query result:', { data, error });
      if (error) throw error;

      // Get previously returned quantities for this invoice
      const { data: existingReturns, error: returnsError } = await supabase
        .from('return_order_lines')
        .select('product_id, return_qty')
        .in('return_order_id', 
          await supabase
            .from('return_order_header')
            .select('id')
            .eq('invoice_id', invoiceId)
            .then(({ data }) => data?.map(r => r.id) || [])
        );

      if (returnsError) throw returnsError;

      // Calculate available quantities
      const returnedQtyMap = new Map();
      existingReturns?.forEach(item => {
        const current = returnedQtyMap.get(item.product_id) || 0;
        returnedQtyMap.set(item.product_id, current + item.return_qty);
      });

      const itemsWithReturn: ReturnItem[] = (data || []).map(item => ({
        ...item,
        product_name: item.item_description, // Map item_description to product_name
        product_sku: item.item_code, // Map item_code to product_sku
        return_qty: 0,
        available_qty: item.quantity_invoiced - (returnedQtyMap.get(item.product_id) || 0),
        return_line_total: 0,
      }));

      console.log('Setting invoice items:', itemsWithReturn);
      setInvoiceItems(itemsWithReturn);
    } catch (error) {
      console.error('Error loading invoice items:', error);
      toast({
        title: 'Error',
        description: 'Failed to load invoice items',
        variant: 'destructive',
      });
    }
  };

  const loadExistingRSO = async () => {
    if (!rsoId || !company?.id) return;

    try {
      setLoading(true);
      setIsLoadingExisting(true); // Prevent cascading useEffects
      
      // Load RSO header
      const { data: rsoData, error: rsoError } = await supabase
        .from('return_order_header')
        .select('*')
        .eq('id', rsoId)
        .eq('company_id', company.id)
        .single();

      if (rsoError) throw rsoError;

      // Load RSO lines
      const { data: linesData, error: linesError } = await supabase
        .from('return_order_lines')
        .select('*')
        .eq('return_order_id', rsoId);

      if (linesError) throw linesError;

      // Set form values
      form.reset({
        customer_id: rsoData.customer_id,
        invoice_id: rsoData.invoice_id,
        rso_date: rsoData.rso_date,
        reason_for_credit: rsoData.reason_for_credit,
        status: rsoData.status as 'Draft' | 'Confirmed',
        delivery_same_as_company: rsoData.delivery_same_as_company,
        delivery_address_line1: rsoData.delivery_address_line1 || '',
        delivery_address_line2: rsoData.delivery_address_line2 || '',
        delivery_city: rsoData.delivery_city || '',
        delivery_country: rsoData.delivery_country || '',
        delivery_pin_code: rsoData.delivery_pin_code || '',
        notes: rsoData.notes || '',
      });

      // Set selected customer
      const customer = customers.find(c => c.id === rsoData.customer_id);
      if (customer) setSelectedCustomer(customer);

      // Also load and set the selected invoice explicitly (so items can load independently of invoices list)
      const { data: invoice, error: invErr } = await supabase
        .from('sales_invoices')
        .select('id, invoice_number, invoice_date, customer_id, total_amount')
        .eq('id', rsoData.invoice_id)
        .maybeSingle();
      if (invErr) throw invErr;
      if (invoice) {
        setSelectedInvoice(invoice as SalesInvoice);
        form.setValue('invoice_id', invoice.id);
      }

      // Build a quick map for prefilled return qty from existing lines
      const prefillMap = new Map<string, number>();
      (linesData || []).forEach(l => prefillMap.set(l.product_id, l.return_qty));

      // Load invoice items and merge with availability + prefilled return qty
      const { data: sii, error: siiErr } = await supabase
        .from('sales_invoice_items')
        .select('*')
        .eq('sales_invoice_id', rsoData.invoice_id);
      if (siiErr) throw siiErr;

      // Compute already returned quantities on this invoice (for available_qty)
      const { data: existingReturns, error: returnsError } = await supabase
        .from('return_order_lines')
        .select('product_id, return_qty')
        .in('return_order_id',
          await supabase
            .from('return_order_header')
            .select('id')
            .eq('invoice_id', rsoData.invoice_id)
            .then(({ data }) => data?.map(r => r.id) || [])
        );
      if (returnsError) throw returnsError;

      const returnedQtyMap = new Map<string, number>();
      existingReturns?.forEach(item => {
        const current = returnedQtyMap.get(item.product_id) || 0;
        returnedQtyMap.set(item.product_id, current + item.return_qty);
      });

      const itemsWithReturn: ReturnItem[] = (sii || []).map(item => {
        const available = item.quantity_invoiced - (returnedQtyMap.get(item.product_id) || 0);
        const prefillQty = Math.min(prefillMap.get(item.product_id) || 0, Math.max(available, 0));
        const lineSubtotal = (prefillQty * item.unit_price) - ((prefillQty * item.unit_price * item.discount_percentage) / 100);
        const taxAmount = (item.cgst_rate + item.sgst_rate + item.igst_rate) / 100 * lineSubtotal;
        return {
          ...item,
          product_name: item.item_description,
          product_sku: item.item_code,
          return_qty: prefillQty,
          available_qty: available,
          return_line_total: lineSubtotal + taxAmount,
        } as ReturnItem;
      });

      setInvoiceItems(itemsWithReturn);

    } catch (error) {
      console.error('Error loading existing RSO:', error);
      toast({
        title: 'Error',
        description: 'Failed to load RSO data',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingExisting(false); // Re-enable useEffects
      setLoading(false);
    }
  };

  const handleCustomerChange = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    setSelectedCustomer(customer || null);
    form.setValue('customer_id', customerId);
    form.setValue('invoice_id', '');
    setSelectedInvoice(null);
  };

  const handleInvoiceChange = (invoiceId: string) => {
    const invoice = invoices.find(i => i.id === invoiceId);
    setSelectedInvoice(invoice || null);
    form.setValue('invoice_id', invoiceId);
  };

  const handleReturnQtyChange = (index: number, returnQty: number) => {
    const updatedItems = [...invoiceItems];
    const item = updatedItems[index];
    
    if (returnQty > item.available_qty) {
      toast({
        title: 'Error',
        description: `Return quantity cannot exceed available quantity (${item.available_qty})`,
        variant: 'destructive',
      });
      return;
    }

    item.return_qty = returnQty;
    
    // Calculate return line total
    const lineSubtotal = (returnQty * item.unit_price) - ((returnQty * item.unit_price * item.discount_percentage) / 100);
    const taxAmount = (item.cgst_rate + item.sgst_rate + item.igst_rate) / 100 * lineSubtotal;
    item.return_line_total = lineSubtotal + taxAmount;
    
    setInvoiceItems(updatedItems);
  };

  const calculateTotals = () => {
    const subtotal = invoiceItems.reduce((sum, item) => {
      const lineSubtotal = (item.return_qty * item.unit_price) - 
        ((item.return_qty * item.unit_price * item.discount_percentage) / 100);
      return sum + lineSubtotal;
    }, 0);

    const taxAmount = invoiceItems.reduce((sum, item) => {
      const lineSubtotal = (item.return_qty * item.unit_price) - 
        ((item.return_qty * item.unit_price * item.discount_percentage) / 100);
      const tax = (item.cgst_rate + item.sgst_rate + item.igst_rate) / 100 * lineSubtotal;
      return sum + tax;
    }, 0);

    const total = subtotal + taxAmount;

    return { subtotal, taxAmount, total };
  };

  const onSubmit = async (data: RSOFormData) => {
    if (!user || !company?.id) return;

    // Validate that at least one item has return quantity
    const hasReturnItems = invoiceItems.some(item => item.return_qty > 0);
    if (!hasReturnItems) {
      toast({
        title: 'Error',
        description: 'Please specify return quantities for at least one item',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      
      const totals = calculateTotals();
      
      // Prepare header data
      const headerData = {
        company_id: company.id,
        customer_id: data.customer_id,
        customer_name: selectedCustomer?.name || '',
        invoice_id: data.invoice_id,
        invoice_number: selectedInvoice?.invoice_number || '',
        invoice_date: selectedInvoice?.invoice_date || '',
        rso_date: data.rso_date,
        reason_for_credit: data.reason_for_credit,
        status: data.status,
        delivery_same_as_company: data.delivery_same_as_company,
        delivery_address_line1: data.delivery_same_as_company ? null : data.delivery_address_line1,
        delivery_address_line2: data.delivery_same_as_company ? null : data.delivery_address_line2,
        delivery_city: data.delivery_same_as_company ? null : data.delivery_city,
        delivery_country: data.delivery_same_as_company ? null : data.delivery_country,
        delivery_pin_code: data.delivery_same_as_company ? null : data.delivery_pin_code,
        subtotal_amount: totals.subtotal,
        tax_amount: totals.taxAmount,
        total_amount: totals.total,
        notes: data.notes,
        created_by: user.id,
      };

      let rsoHeaderId: string;

      if (rsoId) {
        // Update existing RSO
        const { error: updateError } = await supabase
          .from('return_order_header')
          .update(headerData)
          .eq('id', rsoId);

        if (updateError) throw updateError;

        // Delete existing lines
        const { error: deleteError } = await supabase
          .from('return_order_lines')
          .delete()
          .eq('return_order_id', rsoId);

        if (deleteError) throw deleteError;

        rsoHeaderId = rsoId;
      } else {
        // Create new RSO
        const { data: insertedHeader, error: insertError } = await supabase
          .from('return_order_header')
          .insert(headerData)
          .select('id')
          .single();

        if (insertError) throw insertError;
        rsoHeaderId = insertedHeader.id;
      }

      // Insert return order lines
      const returnLines = invoiceItems
        .filter(item => item.return_qty > 0)
        .map(item => {
          const lineSubtotal = (item.return_qty * item.unit_price) - 
            ((item.return_qty * item.unit_price * item.discount_percentage) / 100);
          const cgstAmount = (item.cgst_rate / 100) * lineSubtotal;
          const sgstAmount = (item.sgst_rate / 100) * lineSubtotal;
          const igstAmount = (item.igst_rate / 100) * lineSubtotal;
          const taxAmount = cgstAmount + sgstAmount + igstAmount;
          const lineTotal = lineSubtotal + taxAmount;

          return {
            return_order_id: rsoHeaderId,
            product_id: item.product_id,
            product_name: item.product_name,
            product_sku: item.product_sku,
            hsn_sac_code: item.hsn_sac_code,
            unit_of_measure: item.unit_of_measure,
            invoice_qty: item.quantity_invoiced,
            return_qty: item.return_qty,
            pending_return_qty: item.return_qty,
            unit_price: item.unit_price,
            discount_percentage: item.discount_percentage,
            discount_amount: (item.return_qty * item.unit_price * item.discount_percentage) / 100,
            cgst_rate: item.cgst_rate,
            cgst_amount: cgstAmount,
            sgst_rate: item.sgst_rate,
            sgst_amount: sgstAmount,
            igst_rate: item.igst_rate,
            igst_amount: igstAmount,
            line_subtotal: lineSubtotal,
            tax_amount: taxAmount,
            line_total: lineTotal,
          };
        });

      const { error: linesError } = await supabase
        .from('return_order_lines')
        .insert(returnLines);

      if (linesError) throw linesError;

      toast({
        title: 'Success',
        description: `RSO ${rsoId ? 'updated' : 'created'} successfully`,
      });

      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving RSO:', error);
      toast({
        title: 'Error',
        description: 'Failed to save RSO',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const totals = calculateTotals();

  return (
    <Card className="w-full max-w-6xl mx-auto">
      <CardHeader>
        <CardTitle>{rsoId ? 'Edit' : 'Create'} Return Sales Order</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Customer and Invoice Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="customer_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer *</FormLabel>
                    <Select onValueChange={handleCustomerChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a customer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {customers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.name} ({customer.customer_ref})
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
                name="invoice_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sales Invoice *</FormLabel>
                    <Select onValueChange={handleInvoiceChange} value={field.value} disabled={!selectedCustomer}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an invoice" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {invoices.map((invoice) => (
                          <SelectItem key={invoice.id} value={invoice.id}>
                            {invoice.invoice_number} - ₹{invoice.total_amount.toLocaleString()} ({invoice.invoice_date})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* RSO Details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="rso_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>RSO Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reason_for_credit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason for Credit *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select reason" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Return">Return</SelectItem>
                        <SelectItem value="Damaged">Damaged</SelectItem>
                        <SelectItem value="Wrong Item">Wrong Item</SelectItem>
                        <SelectItem value="Price Correction">Price Correction</SelectItem>
                        <SelectItem value="Quality Issue">Quality Issue</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Draft">Draft</SelectItem>
                        <SelectItem value="Confirmed">Confirmed</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Delivery Address */}
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="delivery_same_as_company"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Delivery same as company address</FormLabel>
                    </div>
                  </FormItem>
                )}
              />

              {!watchDeliverySameAsCompany && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="delivery_address_line1"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Delivery Address Line 1</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="delivery_address_line2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Delivery Address Line 2</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="delivery_city"
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
                    name="delivery_country"
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

                  <FormField
                    control={form.control}
                    name="delivery_pin_code"
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
              )}
            </div>

            {/* Invoice Items */}
            {invoiceItems.length > 0 ? (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Invoice Items</h3>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>UOM</TableHead>
                        <TableHead>Invoice Qty</TableHead>
                        <TableHead>Available Qty</TableHead>
                        <TableHead>Return Qty</TableHead>
                        <TableHead>Unit Price</TableHead>
                        <TableHead>Return Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoiceItems.map((item, index) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.product_name}</TableCell>
                          <TableCell>{item.product_sku}</TableCell>
                          <TableCell>{item.unit_of_measure}</TableCell>
                          <TableCell>{item.quantity_invoiced}</TableCell>
                          <TableCell>
                            <Badge variant={item.available_qty > 0 ? 'default' : 'secondary'}>
                              {item.available_qty}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              max={item.available_qty}
                              value={item.return_qty}
                              onChange={(e) => handleReturnQtyChange(index, parseInt(e.target.value) || 0)}
                              className="w-20"
                              disabled={item.available_qty <= 0}
                            />
                          </TableCell>
                          <TableCell>₹{item.unit_price.toLocaleString()}</TableCell>
                          <TableCell>₹{item.return_line_total.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Totals */}
                <div className="flex justify-end">
                  <div className="w-64 space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>₹{totals.subtotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tax Amount:</span>
                      <span>₹{totals.taxAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-bold border-t pt-2">
                      <span>Total Amount:</span>
                      <span>₹{totals.total.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : selectedInvoice ? (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Invoice Items</h3>
                <div className="text-center py-8 text-muted-foreground">
                  No items found for this invoice or loading items...
                </div>
              </div>
            ) : null}

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Add any additional notes..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Action Buttons */}
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button type="submit" disabled={loading || invoiceItems.length === 0}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                {rsoId ? 'Update RSO' : 'Create RSO'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}