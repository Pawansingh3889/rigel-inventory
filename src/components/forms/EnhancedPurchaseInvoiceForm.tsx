import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Plus, Trash2, Package, FileText, CreditCard, Save, X } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const purchaseInvoiceItemSchema = z.object({
  item_code: z.string().optional(),
  item_description: z.string().min(1, "Item description is required"),
  hsn_sac_code: z.string().optional(),
  unit_of_measure: z.string().default("pcs"),
  quantity: z.number().min(1, "Quantity must be at least 1"),
  unit_price: z.number().min(0, "Unit price must be positive"),
  discount_percentage: z.number().min(0).max(100).default(0),
  discount_amount: z.number().min(0).default(0),
  taxable_value: z.number().min(0).default(0),
  cgst_rate: z.number().min(0).max(50).default(0),
  sgst_rate: z.number().min(0).max(50).default(0),
  igst_rate: z.number().min(0).max(50).default(0),
  cgst_amount: z.number().min(0).default(0),
  sgst_amount: z.number().min(0).default(0),
  igst_amount: z.number().min(0).default(0),
  total_price: z.number().min(0).default(0),
  is_taxable: z.boolean().default(true),
  remarks: z.string().optional(),
});

const purchaseInvoiceSchema = z.object({
  invoice_no: z.string().min(1, "Invoice number is required"),
  purchase_invoice_date: z.date(),
  payment_due_date: z.date().optional(),
  supplier_id: z.string().min(1, "Supplier is required"),
  purchase_order_id: z.string().optional(),
  place_of_supply: z.string().optional(),
  status: z.enum(["draft", "received", "paid"]).default("received"),
  notes: z.string().optional(),
  items: z.array(purchaseInvoiceItemSchema).min(1, "At least one item is required"),
});

type PurchaseInvoiceForm = z.infer<typeof purchaseInvoiceSchema>;

interface EnhancedPurchaseInvoiceFormProps {
  invoice?: any;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  mode?: 'create' | 'edit';
}

export function EnhancedPurchaseInvoiceForm({ 
  invoice, 
  onSubmit, 
  onCancel, 
  mode = 'create' 
}: EnhancedPurchaseInvoiceFormProps) {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<PurchaseInvoiceForm>({
    resolver: zodResolver(purchaseInvoiceSchema),
    defaultValues: {
      invoice_no: invoice?.invoice_no || '',
      purchase_invoice_date: invoice?.purchase_invoice_date ? new Date(invoice.purchase_invoice_date) : new Date(),
      payment_due_date: invoice?.payment_due_date ? new Date(invoice.payment_due_date) : undefined,
      supplier_id: invoice?.supplier_id || '',
      purchase_order_id: invoice?.purchase_order_id || '',
      place_of_supply: invoice?.place_of_supply || '',
      status: invoice?.status || 'received',
      notes: invoice?.notes || '',
      items: invoice?.purchase_invoice_items || [{
        item_code: '',
        item_description: '',
        hsn_sac_code: '',
        unit_of_measure: 'pcs',
        quantity: 1,
        unit_price: 0,
        discount_percentage: 0,
        discount_amount: 0,
        taxable_value: 0,
        cgst_rate: 0,
        sgst_rate: 0,
        igst_rate: 0,
        cgst_amount: 0,
        sgst_amount: 0,
        igst_amount: 0,
        total_price: 0,
        is_taxable: true,
        remarks: '',
      }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items"
  });

  useEffect(() => {
    fetchSuppliers();
    fetchPurchaseOrders();
    fetchProducts();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch suppliers",
        variant: "destructive",
      });
    }
  };

  const fetchPurchaseOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPurchaseOrders(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch purchase orders",
        variant: "destructive",
      });
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch products",
        variant: "destructive",
      });
    }
  };

  const calculateItemTotal = (index: number) => {
    const item = form.getValues(`items.${index}`);
    const subtotal = item.quantity * item.unit_price;
    const discountAmount = item.discount_percentage > 0 
      ? (subtotal * item.discount_percentage) / 100 
      : item.discount_amount;
    const taxableValue = subtotal - discountAmount;
    
    const cgstAmount = item.is_taxable ? (taxableValue * item.cgst_rate) / 100 : 0;
    const sgstAmount = item.is_taxable ? (taxableValue * item.sgst_rate) / 100 : 0;
    const igstAmount = item.is_taxable ? (taxableValue * item.igst_rate) / 100 : 0;
    
    const totalPrice = taxableValue + cgstAmount + sgstAmount + igstAmount;

    form.setValue(`items.${index}.discount_amount`, discountAmount);
    form.setValue(`items.${index}.taxable_value`, taxableValue);
    form.setValue(`items.${index}.cgst_amount`, cgstAmount);
    form.setValue(`items.${index}.sgst_amount`, sgstAmount);
    form.setValue(`items.${index}.igst_amount`, igstAmount);
    form.setValue(`items.${index}.total_price`, totalPrice);
  };

  const calculateTotals = () => {
    const items = form.getValues('items');
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const totalDiscount = items.reduce((sum, item) => sum + item.discount_amount, 0);
    const totalTax = items.reduce((sum, item) => 
      sum + item.cgst_amount + item.sgst_amount + item.igst_amount, 0);
    const grandTotal = items.reduce((sum, item) => sum + item.total_price, 0);

    return { subtotal, totalDiscount, totalTax, grandTotal };
  };

  const addNewItem = () => {
    append({
      item_code: '',
      item_description: '',
      hsn_sac_code: '',
      unit_of_measure: 'pcs',
      quantity: 1,
      unit_price: 0,
      discount_percentage: 0,
      discount_amount: 0,
      taxable_value: 0,
      cgst_rate: 0,
      sgst_rate: 0,
      igst_rate: 0,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 0,
      total_price: 0,
      is_taxable: true,
      remarks: '',
    });
  };

  const handleSubmit = async (data: PurchaseInvoiceForm) => {
    setLoading(true);
    try {
      const { subtotal, totalDiscount, totalTax, grandTotal } = calculateTotals();
      
      const invoiceData = {
        ...data,
        supplier_id: data.supplier_id,
        purchase_order_id: data.purchase_order_id || null,
        subtotal_amount: subtotal,
        total_discount_amount: totalDiscount,
        total_tax_amount: totalTax,
        total_amount: grandTotal,
        purchase_invoice_date: format(data.purchase_invoice_date, 'yyyy-MM-dd'),
        payment_due_date: data.payment_due_date ? format(data.payment_due_date, 'yyyy-MM-dd') : null,
      };

      await onSubmit(invoiceData);
      
      toast({
        title: "Success",
        description: `Purchase invoice ${mode === 'create' ? 'created' : 'updated'} successfully`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || `Failed to ${mode} purchase invoice`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const totals = calculateTotals();

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200">
              <FileText className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {mode === 'create' ? 'Create' : 'Edit'} Purchase Invoice
              </h2>
              <p className="text-sm text-muted-foreground">
                {mode === 'create' ? 'Record a new purchase and update inventory' : 'Update existing purchase invoice'}
              </p>
            </div>
          </div>
          <Badge variant={invoice?.status === 'paid' ? 'default' : invoice?.status === 'received' ? 'secondary' : 'outline'}>
            {form.watch('status')?.toUpperCase() || 'DRAFT'}
          </Badge>
        </div>

        <Separator />

        {/* Invoice Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Invoice Details
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="invoice_no"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Invoice Number *</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter invoice number" 
                      {...field} 
                      className="font-mono"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="purchase_invoice_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Invoice Date *</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
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
                        disabled={(date) =>
                          date > new Date() || date < new Date("1900-01-01")
                        }
                        autoFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="payment_due_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Due Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Select due date</span>
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
                        disabled={(date) => date < new Date()}
                        autoFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="supplier_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Supplier *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select supplier" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.name} ({supplier.supplier_ref})
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
              name="purchase_order_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Purchase Order (Optional)</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select purchase order" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {purchaseOrders.map((po) => (
                        <SelectItem key={po.id} value={po.id}>
                          {po.po_number}
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
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="received">Received</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Invoice Items */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Invoice Items
              </CardTitle>
              <Button type="button" onClick={addNewItem} size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Item
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {fields.map((field, index) => (
                <Card key={field.id} className="border-l-4 border-l-green-500">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium">Item {index + 1}</h4>
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <FormField
                        control={form.control}
                        name={`items.${index}.item_description`}
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>Item Description *</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Enter item description" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`items.${index}.item_code`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Item Code</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Item code" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`items.${index}.hsn_sac_code`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>HSN/SAC Code</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="HSN/SAC" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`items.${index}.quantity`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Quantity *</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                {...field} 
                                onChange={(e) => {
                                  field.onChange(parseFloat(e.target.value) || 0);
                                  setTimeout(() => calculateItemTotal(index), 100);
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`items.${index}.unit_price`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Unit Price *</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.01"
                                {...field} 
                                onChange={(e) => {
                                  field.onChange(parseFloat(e.target.value) || 0);
                                  setTimeout(() => calculateItemTotal(index), 100);
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`items.${index}.cgst_rate`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CGST %</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.01"
                                {...field} 
                                onChange={(e) => {
                                  field.onChange(parseFloat(e.target.value) || 0);
                                  setTimeout(() => calculateItemTotal(index), 100);
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`items.${index}.sgst_rate`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>SGST %</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.01"
                                {...field} 
                                onChange={(e) => {
                                  field.onChange(parseFloat(e.target.value) || 0);
                                  setTimeout(() => calculateItemTotal(index), 100);
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="md:col-span-4 mt-4 p-4 bg-gray-50 rounded-lg">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Subtotal:</span>
                            <div className="font-medium">₹{((form.watch(`items.${index}.quantity`) || 0) * (form.watch(`items.${index}.unit_price`) || 0)).toFixed(2)}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Discount:</span>
                            <div className="font-medium">₹{(form.watch(`items.${index}.discount_amount`) || 0).toFixed(2)}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Tax:</span>
                            <div className="font-medium">₹{((form.watch(`items.${index}.cgst_amount`) || 0) + (form.watch(`items.${index}.sgst_amount`) || 0) + (form.watch(`items.${index}.igst_amount`) || 0)).toFixed(2)}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Total:</span>
                            <div className="font-bold text-lg">₹{(form.watch(`items.${index}.total_price`) || 0).toFixed(2)}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardContent className="pt-6">
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Additional notes or comments..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Summary */}
        <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
          <CardHeader>
            <CardTitle className="text-green-800">Invoice Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-700">₹{totals.subtotal.toFixed(2)}</div>
                <div className="text-sm text-muted-foreground">Subtotal</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">₹{totals.totalDiscount.toFixed(2)}</div>
                <div className="text-sm text-muted-foreground">Discount</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">₹{totals.totalTax.toFixed(2)}</div>
                <div className="text-sm text-muted-foreground">Total Tax</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-800">₹{totals.grandTotal.toFixed(2)}</div>
                <div className="text-sm text-muted-foreground">Grand Total</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="gap-2"
          >
            <X className="h-4 w-4" />
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            {loading ? 'Saving...' : mode === 'create' ? 'Create Invoice' : 'Update Invoice'}
          </Button>
        </div>
      </form>
    </Form>
  );
}