import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
import { Loader2, Save, X, Search } from 'lucide-react';
import { Label } from '@/components/ui/label';

// Form validation schema
const rsoHeaderSchema = z.object({
  customer_id: z.string().min(1, 'Customer is required'),
  invoice_id: z.string().min(1, 'Invoice is required'),
  rso_date: z.string().min(1, 'RSO date is required'),
  reason_for_credit: z.enum(['Return', 'Price Correction', 'Discount', 'Others'], {
    required_error: 'Reason for credit is required',
  }),
  status: z.enum(['Draft', 'Confirmed']),
  delivery_same_as_company: z.boolean(),
  delivery_address_line1: z.string().optional(),
  delivery_address_line2: z.string().optional(),
  delivery_city: z.string().optional(),
  delivery_country: z.string().optional(),
  delivery_pin_code: z.string().optional(),
  notes: z.string().optional(),
});

type RSOHeaderData = z.infer<typeof rsoHeaderSchema>;

interface Customer {
  id: string;
  name: string;
  customer_ref: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  country?: string;
  pin_code?: string;
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

interface ReturnLineItem {
  product_id: string;
  product_name: string;
  product_sku: string;
  hsn_sac_code: string | null;
  unit_of_measure: string;
  invoice_qty: number;
  return_qty: number;
  pending_return_qty: number;
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
  available_qty: number;
  original_discount_percentage: number;
  original_discount_amount: number;
}

interface EnhancedCreateRSOFormProps {
  rsoId?: string;
  onClose: () => void;
  onSave: () => void;
}

export function EnhancedCreateRSOForm({ rsoId, onClose, onSave }: EnhancedCreateRSOFormProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();

  // Get company ID from profile
  const companyId = profile?.company_id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<SalesInvoice | null>(null);
  const [returnLineItems, setReturnLineItems] = useState<ReturnLineItem[]>([]);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [invoiceSearchTerm, setInvoiceSearchTerm] = useState('');
  const [generatedRSONumber, setGeneratedRSONumber] = useState<string>('');

  const form = useForm<RSOHeaderData>({
    resolver: zodResolver(rsoHeaderSchema),
    defaultValues: {
      customer_id: '',
      invoice_id: '',
      rso_date: new Date().toISOString().split('T')[0],
      reason_for_credit: 'Return',
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

  // Filter customers based on search term
  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
    customer.customer_ref.toLowerCase().includes(customerSearchTerm.toLowerCase())
  );

  // Filter invoices based on search term
  const filteredInvoices = invoices.filter(invoice =>
    invoice.invoice_number.toLowerCase().includes(invoiceSearchTerm.toLowerCase()) ||
    new Date(invoice.invoice_date).toLocaleDateString().includes(invoiceSearchTerm)
  );

  // Load customers on component mount
  useEffect(() => {
    if (companyId) {
      loadCustomers();
    }
  }, [companyId]);

  // Load existing RSO only after customers are loaded
  useEffect(() => {
    if (rsoId && customers.length > 0) {
      loadExistingRSO();
    }
  }, [rsoId, customers.length]);

  // Load invoices when customer changes (but not during existing RSO load)
  useEffect(() => {
    if (selectedCustomer && !isLoadingExisting) {
      loadCustomerInvoices(selectedCustomer.id);
    } else if (!selectedCustomer && !isLoadingExisting) {
      setInvoices([]);
      setSelectedInvoice(null);
      setReturnLineItems([]);
    }
  }, [selectedCustomer, isLoadingExisting]);

  // Load invoice items when invoice changes (but not during existing RSO load)
  useEffect(() => {
    if (selectedInvoice && !isLoadingExisting) {
      loadInvoiceItems(selectedInvoice.id);
    } else if (!selectedInvoice && !isLoadingExisting) {
      setReturnLineItems([]);
    }
  }, [selectedInvoice, isLoadingExisting]);

  const loadCustomers = async () => {
    if (!companyId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('customers')
        .select(`
          id, name, customer_ref, address_line1, address_line2, 
          city, state, country, pin_code
        `)
        .eq('company_id', companyId)
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
    } finally {
      setLoading(false);
    }
  };

  const loadCustomerInvoices = async (customerId: string) => {
    if (!companyId) return;

    try {
      // Filter invoices from last 365 days
      const oneYearAgo = new Date();
      oneYearAgo.setDate(oneYearAgo.getDate() - 365);

      const { data, error } = await supabase
        .from('sales_invoices')
        .select('id, invoice_number, invoice_date, customer_id, total_amount')
        .eq('company_id', companyId)
        .eq('customer_id', customerId)
        .eq('status', 'finalized')
        .gte('invoice_date', oneYearAgo.toISOString().split('T')[0])
        .order('invoice_date', { ascending: false });

      if (error) throw error;
      
      // If we have existing invoices (from loadExistingRSO), merge them
      const existingInvoices = invoices.filter(inv => inv.customer_id === customerId);
      const newInvoices = data || [];
      
      // Merge and deduplicate invoices
      const mergedInvoices = [...existingInvoices];
      newInvoices.forEach(newInv => {
        if (!mergedInvoices.find(existing => existing.id === newInv.id)) {
          mergedInvoices.push(newInv);
        }
      });
      
      // Sort by date
      mergedInvoices.sort((a, b) => new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime());
      
      setInvoices(mergedInvoices);
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
    try {
      const { data, error } = await supabase
        .from('sales_invoice_items')
        .select('*')
        .eq('sales_invoice_id', invoiceId);

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

      const returnLineItems: ReturnLineItem[] = (data || []).map(item => {
        const availableQty = item.quantity_invoiced - (returnedQtyMap.get(item.product_id) || 0);
        
        return {
          product_id: item.product_id,
          product_name: item.item_description,
          product_sku: item.item_code,
          hsn_sac_code: item.hsn_sac_code,
          unit_of_measure: item.unit_of_measure,
          invoice_qty: item.quantity_invoiced,
          return_qty: 0,
          pending_return_qty: 0,
          unit_price: item.unit_price,
          discount_percentage: item.discount_percentage || 0,
          discount_amount: 0,
          cgst_rate: item.cgst_rate || 0,
          cgst_amount: 0,
          sgst_rate: item.sgst_rate || 0,
          sgst_amount: 0,
          igst_rate: item.igst_rate || 0,
          igst_amount: 0,
          line_subtotal: 0,
          tax_amount: 0,
          line_total: 0,
          available_qty: Math.max(0, availableQty),
          original_discount_percentage: item.discount_percentage || 0,
          original_discount_amount: item.discount_amount || 0,
        };
      });

      setReturnLineItems(returnLineItems);
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
    if (!rsoId || !companyId) return;

    try {
      setIsLoadingExisting(true);
      
      // Load RSO header
      const { data: rsoData, error: rsoError } = await supabase
        .from('return_order_header')
        .select('*')
        .eq('id', rsoId)
        .eq('company_id', companyId)
        .single();

      if (rsoError) throw rsoError;

      // Set generated RSO number for display
      if (rsoData.rso_number) {
        setGeneratedRSONumber(rsoData.rso_number);
      }

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
        reason_for_credit: rsoData.reason_for_credit as 'Return' | 'Price Correction' | 'Discount' | 'Others',
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
      if (customer) {
        setSelectedCustomer(customer);
      }

      // Load and set the selected invoice
      const { data: invoice, error: invErr } = await supabase
        .from('sales_invoices')
        .select('id, invoice_number, invoice_date, customer_id, total_amount')
        .eq('id', rsoData.invoice_id)
        .maybeSingle();
      if (invErr) throw invErr;
      if (invoice) {
        // Add the invoice to the invoices array and set as selected
        setInvoices([invoice as SalesInvoice]);
        setSelectedInvoice(invoice as SalesInvoice);
      }

      // Load all customer invoices for the dropdown (this will merge with the current invoice)
      if (customer) {
        loadCustomerInvoices(customer.id);
      }

      // Build prefill map from existing lines
      const prefillMap = new Map<string, { return_qty: number; discount_percentage: number }>();
      (linesData || []).forEach(l => prefillMap.set(l.product_id, {
        return_qty: l.return_qty,
        discount_percentage: l.discount_percentage || 0
      }));

      // Load invoice items and prefill return quantities
      const { data: sii, error: siiErr } = await supabase
        .from('sales_invoice_items')
        .select('*')
        .eq('sales_invoice_id', rsoData.invoice_id);
      if (siiErr) throw siiErr;

      // Compute already returned quantities for available_qty calculation
      const { data: existingReturns, error: returnsError } = await supabase
        .from('return_order_lines')
        .select('product_id, return_qty')
        .in('return_order_id',
          await supabase
            .from('return_order_header')
            .select('id')
            .eq('invoice_id', rsoData.invoice_id)
            .neq('id', rsoId) // Exclude current RSO from calculation
            .then(({ data }) => data?.map(r => r.id) || [])
        );
      if (returnsError) throw returnsError;

      const returnedQtyMap = new Map<string, number>();
      existingReturns?.forEach(item => {
        const current = returnedQtyMap.get(item.product_id) || 0;
        returnedQtyMap.set(item.product_id, current + item.return_qty);
      });

      const returnLineItems: ReturnLineItem[] = (sii || []).map(item => {
        const available = item.quantity_invoiced - (returnedQtyMap.get(item.product_id) || 0);
        const prefillData = prefillMap.get(item.product_id);
        const prefillQty = Math.min(prefillData?.return_qty || 0, Math.max(available, 0));
        const discountPercentage = prefillData?.discount_percentage || item.discount_percentage || 0;
        
        // Calculate amounts based on prefilled values
        const discountAmount = (prefillQty * item.unit_price * discountPercentage) / 100;
        const lineSubtotal = (prefillQty * item.unit_price) - discountAmount;
        const cgstAmount = (item.cgst_rate / 100) * lineSubtotal;
        const sgstAmount = (item.sgst_rate / 100) * lineSubtotal;
        const igstAmount = (item.igst_rate / 100) * lineSubtotal;
        const taxAmount = cgstAmount + sgstAmount + igstAmount;
        const lineTotal = lineSubtotal + taxAmount;

        return {
          product_id: item.product_id,
          product_name: item.item_description,
          product_sku: item.item_code,
          hsn_sac_code: item.hsn_sac_code,
          unit_of_measure: item.unit_of_measure,
          invoice_qty: item.quantity_invoiced,
          return_qty: prefillQty,
          pending_return_qty: prefillQty,
          unit_price: item.unit_price,
          discount_percentage: discountPercentage,
          discount_amount: discountAmount,
          cgst_rate: item.cgst_rate || 0,
          cgst_amount: cgstAmount,
          sgst_rate: item.sgst_rate || 0,
          sgst_amount: sgstAmount,
          igst_rate: item.igst_rate || 0,
          igst_amount: igstAmount,
          line_subtotal: lineSubtotal,
          tax_amount: taxAmount,
          line_total: lineTotal,
          available_qty: available,
          original_discount_percentage: item.discount_percentage || 0,
          original_discount_amount: item.discount_amount || 0,
        };
      });

      setReturnLineItems(returnLineItems);

    } catch (error) {
      console.error('Error loading existing RSO:', error);
      toast({
        title: 'Error',
        description: 'Failed to load RSO data',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingExisting(false);
    }
  };

  const handleCustomerChange = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    setSelectedCustomer(customer || null);
    form.setValue('customer_id', customerId);
    form.setValue('invoice_id', '');
    setSelectedInvoice(null);
    setReturnLineItems([]);
    setInvoiceSearchTerm('');
  };

  const handleInvoiceChange = (invoiceId: string) => {
    const invoice = invoices.find(i => i.id === invoiceId);
    setSelectedInvoice(invoice || null);
    form.setValue('invoice_id', invoiceId);
  };

  const handleReturnQtyChange = useCallback((index: number, returnQty: number) => {
    const updatedItems = [...returnLineItems];
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
    item.pending_return_qty = returnQty;
    
    // Recalculate line amounts
    calculateLineAmounts(item);
    
    setReturnLineItems(updatedItems);
  }, [returnLineItems, toast]);

  const handleDiscountPercentageChange = useCallback((index: number, discountPercentage: number) => {
    const updatedItems = [...returnLineItems];
    const item = updatedItems[index];
    
    if (discountPercentage < 0 || discountPercentage > 100) {
      toast({
        title: 'Error',
        description: 'Discount percentage must be between 0 and 100',
        variant: 'destructive',
      });
      return;
    }

    item.discount_percentage = discountPercentage;
    
    // Recalculate line amounts
    calculateLineAmounts(item);
    
    setReturnLineItems(updatedItems);
  }, [returnLineItems, toast]);

  const calculateLineAmounts = (item: ReturnLineItem) => {
    // Calculate discount amount
    item.discount_amount = (item.return_qty * item.unit_price * item.discount_percentage) / 100;
    
    // Calculate line subtotal (after discount)
    item.line_subtotal = (item.return_qty * item.unit_price) - item.discount_amount;
    
    // Calculate tax amounts
    item.cgst_amount = (item.cgst_rate / 100) * item.line_subtotal;
    item.sgst_amount = (item.sgst_rate / 100) * item.line_subtotal;
    item.igst_amount = (item.igst_rate / 100) * item.line_subtotal;
    
    // Calculate total tax amount
    item.tax_amount = item.cgst_amount + item.sgst_amount + item.igst_amount;
    
    // Calculate line total
    item.line_total = item.line_subtotal + item.tax_amount;
  };

  const calculateTotals = useCallback(() => {
    const subtotal = returnLineItems.reduce((sum, item) => sum + item.line_subtotal, 0);
    const discountAmount = returnLineItems.reduce((sum, item) => sum + item.discount_amount, 0);
    const taxAmount = returnLineItems.reduce((sum, item) => sum + item.tax_amount, 0);
    const total = subtotal + taxAmount;

    return { subtotal, discountAmount, taxAmount, total };
  }, [returnLineItems]);

  const onSubmit = async (data: RSOHeaderData) => {
    if (!user || !companyId) return;

    // Validate that at least one item has return quantity
    const hasReturnItems = returnLineItems.some(item => item.return_qty > 0);
    if (!hasReturnItems) {
      toast({
        title: 'Error',
        description: 'Please specify return quantities for at least one item',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);
      
      const totals = calculateTotals();
      
      // Prepare header data according to table structure
      const headerData = {
        company_id: companyId,
        rso_date: data.rso_date,
        customer_id: data.customer_id,
        customer_name: selectedCustomer?.name || '',
        invoice_id: data.invoice_id,
        invoice_number: selectedInvoice?.invoice_number || '',
        invoice_date: selectedInvoice?.invoice_date || '',
        reason_for_credit: data.reason_for_credit,
        delivery_same_as_company: data.delivery_same_as_company,
        delivery_address_line1: data.delivery_same_as_company ? null : data.delivery_address_line1,
        delivery_address_line2: data.delivery_same_as_company ? null : data.delivery_address_line2,
        delivery_city: data.delivery_same_as_company ? null : data.delivery_city,
        delivery_country: data.delivery_same_as_company ? null : data.delivery_country,
        delivery_pin_code: data.delivery_same_as_company ? null : data.delivery_pin_code,
        status: data.status,
        subtotal_amount: totals.subtotal,
        tax_amount: totals.taxAmount,
        total_amount: totals.total,
        notes: data.notes,
        created_by: user.id,
      };

      let rsoHeaderId: string;
      let responseData: any;

      if (rsoId) {
        // Update existing RSO
        const { data: updateData, error: updateError } = await supabase
          .from('return_order_header')
          .update(headerData)
          .eq('id', rsoId)
          .select('rso_number')
          .single();

        if (updateError) throw updateError;

        // Delete existing lines
        const { error: deleteError } = await supabase
          .from('return_order_lines')
          .delete()
          .eq('return_order_id', rsoId);

        if (deleteError) throw deleteError;

        rsoHeaderId = rsoId;
        responseData = updateData;
      } else {
        // Create new RSO
        const { data: insertedHeader, error: insertError } = await supabase
          .from('return_order_header')
          .insert(headerData)
          .select('id, rso_number')
          .single();

        if (insertError) throw insertError;
        rsoHeaderId = insertedHeader.id;
        responseData = insertedHeader;
      }

      // Set the generated RSO number for display
      if (responseData?.rso_number) {
        setGeneratedRSONumber(responseData.rso_number);
      }

      // Insert return order lines according to table structure
      const returnLines = returnLineItems
        .filter(item => item.return_qty > 0)
        .map(item => ({
          return_order_id: rsoHeaderId,
          product_id: item.product_id,
          product_name: item.product_name,
          product_sku: item.product_sku,
          hsn_sac_code: item.hsn_sac_code,
          unit_of_measure: item.unit_of_measure,
          invoice_qty: item.invoice_qty,
          return_qty: item.return_qty,
          pending_return_qty: item.pending_return_qty,
          unit_price: item.unit_price,
          discount_percentage: item.discount_percentage,
          discount_amount: item.discount_amount,
          cgst_rate: item.cgst_rate,
          cgst_amount: item.cgst_amount,
          sgst_rate: item.sgst_rate,
          sgst_amount: item.sgst_amount,
          igst_rate: item.igst_rate,
          igst_amount: item.igst_amount,
          line_subtotal: item.line_subtotal,
          tax_amount: item.tax_amount,
          line_total: item.line_total,
        }));

      const { error: linesError } = await supabase
        .from('return_order_lines')
        .insert(returnLines);

      if (linesError) throw linesError;

      toast({
        title: 'Success',
        description: `RSO ${rsoId ? 'updated' : 'created'} successfully${responseData?.rso_number ? ` - ${responseData.rso_number}` : ''}`,
      });

      onSave();
      if (!rsoId) {
        onClose(); // Only close on create, keep open on update to show generated number
      }
    } catch (error) {
      console.error('Error saving RSO:', error);
      toast({
        title: 'Error',
        description: 'Failed to save RSO',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const totals = calculateTotals();

  if (loading && !customers.length) {
    return (
      <Card className="w-full max-w-6xl mx-auto">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-6xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{rsoId ? 'Edit' : 'Create'} Return Sales Order</span>
          {generatedRSONumber && (
            <Badge variant="outline" className="text-lg px-3 py-1">
              RSO: {generatedRSONumber}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
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
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search customers..."
                          value={customerSearchTerm}
                          onChange={(e) => setCustomerSearchTerm(e.target.value)}
                          className="pl-8"
                        />
                      </div>
                      <Select onValueChange={handleCustomerChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Select a customer" />
                          </SelectTrigger>
                        </FormControl>
                         <SelectContent className="bg-background border z-50 max-h-64">
                            {!companyId ? (
                              <SelectItem value="loading" disabled>
                                <span className="text-muted-foreground">Company context loading...</span>
                              </SelectItem>
                            ) : filteredCustomers.length === 0 ? (
                              <SelectItem value="no-customers" disabled>
                                <span className="text-muted-foreground">No customers found</span>
                              </SelectItem>
                           ) : (
                             filteredCustomers.map((customer) => (
                               <SelectItem key={customer.id} value={customer.id}>
                                 <div className="flex flex-col">
                                   <span className="font-medium">{customer.name}</span>
                                   <span className="text-sm text-muted-foreground">
                                     {customer.customer_ref}
                                   </span>
                                 </div>
                               </SelectItem>
                             ))
                           )}
                         </SelectContent>
                      </Select>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="invoice_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sales Invoice * (Last 365 days)</FormLabel>
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search invoices..."
                          value={invoiceSearchTerm}
                          onChange={(e) => setInvoiceSearchTerm(e.target.value)}
                          className="pl-8"
                          disabled={!selectedCustomer}
                        />
                      </div>
                      <Select onValueChange={handleInvoiceChange} value={field.value} disabled={!selectedCustomer}>
                        <FormControl>
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Select an invoice" />
                          </SelectTrigger>
                        </FormControl>
                         <SelectContent className="bg-background border z-50 max-h-64">
                            {!selectedCustomer ? (
                              <SelectItem value="no-customer-selected" disabled>
                                <span className="text-muted-foreground">Select a customer first</span>
                              </SelectItem>
                            ) : filteredInvoices.length === 0 ? (
                              <SelectItem value="no-invoices" disabled>
                                <span className="text-muted-foreground">No finalized invoices found for this customer in the last 365 days</span>
                              </SelectItem>
                           ) : (
                             filteredInvoices.map((invoice) => (
                               <SelectItem key={invoice.id} value={invoice.id}>
                                 <div className="flex flex-col">
                                   <span className="font-medium">{invoice.invoice_number}</span>
                                   <div className="flex justify-between text-sm text-muted-foreground">
                                     <span>{new Date(invoice.invoice_date).toLocaleDateString()}</span>
                                     <span>₹{invoice.total_amount.toLocaleString()}</span>
                                   </div>
                                 </div>
                               </SelectItem>
                             ))
                           )}
                         </SelectContent>
                      </Select>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Customer Address Display */}
            {selectedCustomer && (
              <Card className="bg-muted/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Customer Registered Address</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                    <div>
                      <Label className="text-xs text-muted-foreground">Address Line 1</Label>
                      <p>{selectedCustomer.address_line1 || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Address Line 2</Label>
                      <p>{selectedCustomer.address_line2 || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">City</Label>
                      <p>{selectedCustomer.city || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">State</Label>
                      <p>{selectedCustomer.state || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Country</Label>
                      <p>{selectedCustomer.country || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Pin Code</Label>
                      <p>{selectedCustomer.pin_code || 'N/A'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Invoice Details */}
            {selectedInvoice && (
              <Card className="bg-muted/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Invoice Details</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <Label className="text-xs text-muted-foreground">Invoice Number</Label>
                      <p className="font-medium">{selectedInvoice.invoice_number}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Invoice Date</Label>
                      <p>{new Date(selectedInvoice.invoice_date).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Total Amount</Label>
                      <p className="font-medium">₹{selectedInvoice.total_amount.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

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
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="flex flex-col space-y-2"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Return" id="return" />
                          <Label htmlFor="return">Return</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Price Correction" id="price-correction" />
                          <Label htmlFor="price-correction">Price Correction</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Discount" id="discount" />
                          <Label htmlFor="discount">Discount</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Others" id="others" />
                          <Label htmlFor="others">Others</Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
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
                        <SelectTrigger className="bg-background">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-background border z-50">
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

            {/* Return Line Items */}
            {returnLineItems.length > 0 ? (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Return Line Items</h3>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[150px]">Product Name</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>HSN/SAC</TableHead>
                        <TableHead>UOM</TableHead>
                        <TableHead>Invoice Qty</TableHead>
                        <TableHead>Available Qty</TableHead>
                        <TableHead>Return Qty</TableHead>
                        <TableHead>Pending Qty</TableHead>
                        <TableHead>Unit Price</TableHead>
                        <TableHead>Discount %</TableHead>
                        <TableHead>Discount Amount</TableHead>
                        <TableHead>CGST %</TableHead>
                        <TableHead>SGST %</TableHead>
                        <TableHead>IGST %</TableHead>
                        <TableHead>Line Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {returnLineItems.map((item, index) => (
                        <TableRow key={item.product_id}>
                          <TableCell className="font-medium">{item.product_name}</TableCell>
                          <TableCell>{item.product_sku}</TableCell>
                          <TableCell>{item.hsn_sac_code || '-'}</TableCell>
                          <TableCell>{item.unit_of_measure}</TableCell>
                          <TableCell>{item.invoice_qty}</TableCell>
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
                          <TableCell>
                            <Badge variant="outline">
                              {item.pending_return_qty}
                            </Badge>
                          </TableCell>
                          <TableCell>₹{item.unit_price.toLocaleString()}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={item.discount_percentage}
                              onChange={(e) => handleDiscountPercentageChange(index, parseFloat(e.target.value) || 0)}
                              className="w-20"
                              disabled={item.return_qty === 0}
                            />
                          </TableCell>
                          <TableCell>₹{item.discount_amount.toLocaleString()}</TableCell>
                          <TableCell className="text-muted-foreground">{item.cgst_rate}%</TableCell>
                          <TableCell className="text-muted-foreground">{item.sgst_rate}%</TableCell>
                          <TableCell className="text-muted-foreground">{item.igst_rate}%</TableCell>
                          <TableCell className="font-medium">₹{item.line_total.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Totals */}
                <Card className="w-full md:w-96 ml-auto">
                  <CardContent className="pt-6">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span>₹{totals.subtotal.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Discount:</span>
                        <span>₹{totals.discountAmount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tax Amount:</span>
                        <span>₹{totals.taxAmount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between font-bold text-lg border-t pt-2">
                        <span>Final Amount:</span>
                        <span>₹{totals.total.toLocaleString()}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : selectedInvoice ? (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Return Line Items</h3>
                <div className="text-center py-8 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                  Loading invoice items...
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
              <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button type="submit" disabled={saving || returnLineItems.length === 0}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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