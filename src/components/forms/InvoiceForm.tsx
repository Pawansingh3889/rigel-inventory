
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SalesOrder {
  id: string;
  order_number: string;
  customer_id: string;
  customer_name: string;
  order_date: string;
  delivery_date: string;
  total_amount: number;
  status: string;
  items: any[];
}

interface InvoiceItem {
  id?: string;
  product_name: string;
  description: string;
  quantity: number;
  unit_price: number;
  cgst_rate: number;
  sgst_rate: number;
  igst_rate: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_amount: number;
}

interface InvoiceFormProps {
  invoice?: any;
  onSubmit: (data: any, action: 'draft' | 'invoice') => void;
  onCancel: () => void;
}

export default function InvoiceForm({ invoice, onSubmit, onCancel }: InvoiceFormProps) {
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSalesOrder, setSelectedSalesOrder] = useState<SalesOrder | null>(null);
  const [showSalesOrderSearch, setShowSalesOrderSearch] = useState(true);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Invoice form data
  const [invoiceData, setInvoiceData] = useState({
    sales_order_id: '',
    customer_id: '',
    customer_name: '',
    invoice_date: new Date().toISOString().split('T')[0],
    place_of_supply: '',
    notes: '',
    terms_conditions: '',
    status: 'draft'
  });

  const [items, setItems] = useState<InvoiceItem[]>([]);

  useEffect(() => {
    if (invoice) {
      // Edit mode - populate form with existing invoice data
      setInvoiceData({
        sales_order_id: invoice.sales_order_id || '',
        customer_id: invoice.customer_id || '',
        customer_name: invoice.customer_name || '',
        invoice_date: invoice.performa_invoice_date || new Date().toISOString().split('T')[0],
        place_of_supply: invoice.place_of_supply || '',
        notes: invoice.notes || '',
        terms_conditions: invoice.terms_conditions || '',
        status: invoice.status || 'draft'
      });
      setItems(invoice.items || []);
      setShowSalesOrderSearch(false);
      
      // If editing an existing invoice, load the related sales order
      if (invoice.sales_order_id) {
        loadSalesOrderById(invoice.sales_order_id);
      }
    } else {
      // Create mode - fetch available sales orders
      fetchSalesOrders();
    }
  }, [invoice]);

  const fetchSalesOrders = async () => {
    try {
        const { data: salesOrderData, error } = await supabase
          .from('sales_orders')
          .select(`
            id,
            order_number,
            customer_id,
            order_date,
            delivery_date,
            total_amount,
            status
          `)
          .eq('status', 'confirmed')
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) throw error;

        // Fetch customer names for each sales order
        const salesOrdersWithCustomers = await Promise.all(
          (salesOrderData || []).map(async (so) => {
            const { data: customerData } = await supabase
              .from('customers')
              .select('name')
              .eq('id', so.customer_id)
              .single();

            return {
              ...so,
              customer_name: customerData?.name || 'Unknown Customer'
            };
          })
        );

        setSalesOrders(salesOrdersWithCustomers as SalesOrder[] || []);
    } catch (error) {
      console.error('Error fetching sales orders:', error);
      toast({
        title: "Error",
        description: "Failed to fetch sales orders",
        variant: "destructive",
      });
    }
  };

  const loadSalesOrderById = async (salesOrderId: string) => {
    try {
        const { data, error } = await supabase
          .from('sales_orders')
          .select(`
            id,
            order_number,
            customer_id,
            order_date,
            delivery_date,
            total_amount,
            status,
            sales_order_items (
              id,
              item_description,
              quantity,
              unit_price,
              cgst_rate,
              sgst_rate,
              igst_rate,
              cgst_amount,
              sgst_amount,
              igst_amount,
              total_price
            )
          `)
          .eq('id', salesOrderId)
          .single();

      if (error) throw error;
      
      if (data) {
        // Fetch customer name
        const { data: customerData } = await supabase
          .from('customers')
          .select('name')
          .eq('id', data.customer_id)
          .single();

        setSelectedSalesOrder({
          ...data,
          customer_name: customerData?.name || 'Unknown Customer',
          items: data.sales_order_items || []
        });
      }
    } catch (error) {
      console.error('Error loading sales order:', error);
    }
  };

  const loadSalesOrder = async (salesOrder: SalesOrder) => {
    setLoading(true);
    try {
      // Fetch full sales order with items
        const { data, error } = await supabase
          .from('sales_orders')
          .select(`
            id,
            order_number,
            customer_id,
            order_date,
            delivery_date,
            total_amount,
            status,
            sales_order_items (
              id,
              item_description,
              quantity,
              unit_price,
              cgst_rate,
              sgst_rate,
              igst_rate,
              cgst_amount,
              sgst_amount,
              igst_amount,
              total_price
            )
          `)
          .eq('id', salesOrder.id)
          .single();

      if (error) throw error;

      // Fetch customer name
      const { data: customerData } = await supabase
        .from('customers')
        .select('name')
        .eq('id', data.customer_id)
        .single();

      const salesOrderWithCustomer = {
        ...data,
        customer_name: customerData?.name || 'Unknown Customer',
        items: data.sales_order_items || []
      };

      setSelectedSalesOrder(salesOrderWithCustomer);

      // Populate invoice form with sales order data
      setInvoiceData({
        sales_order_id: data.id,
        customer_id: data.customer_id,
        customer_name: customerData?.name || 'Unknown Customer',
        invoice_date: new Date().toISOString().split('T')[0],
        place_of_supply: '',
        notes: '',
        terms_conditions: '',
        status: 'draft'
      });

      // Convert sales order items to invoice items
      const invoiceItems = data.sales_order_items.map((item: any) => ({
        product_name: item.item_description,
        description: item.item_description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        cgst_rate: item.cgst_rate,
        sgst_rate: item.sgst_rate,
        igst_rate: item.igst_rate || 0,
        cgst_amount: item.cgst_amount,
        sgst_amount: item.sgst_amount,
        igst_amount: item.igst_amount || 0,
        total_amount: item.total_price
      }));

      setItems(invoiceItems);
      setShowSalesOrderSearch(false);
    } catch (error) {
      console.error('Error loading sales order:', error);
      toast({
        title: "Error",
        description: "Failed to load sales order details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateItemTotal = (item: InvoiceItem) => {
    const subtotal = item.quantity * item.unit_price;
    const cgstAmount = (subtotal * item.cgst_rate) / 100;
    const sgstAmount = (subtotal * item.sgst_rate) / 100;
    const igstAmount = (subtotal * item.igst_rate) / 100;
    return subtotal + cgstAmount + sgstAmount + igstAmount;
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    
    // Recalculate amounts when quantity, unit price, or tax rates change
    if (['quantity', 'unit_price', 'cgst_rate', 'sgst_rate', 'igst_rate'].includes(field)) {
      const item = updatedItems[index];
      const subtotal = item.quantity * item.unit_price;
      item.cgst_amount = (subtotal * item.cgst_rate) / 100;
      item.sgst_amount = (subtotal * item.sgst_rate) / 100;
      item.igst_amount = (subtotal * item.igst_rate) / 100;
      item.total_amount = subtotal + item.cgst_amount + item.sgst_amount + item.igst_amount;
    }
    
    setItems(updatedItems);
  };

  const addItem = () => {
    setItems([...items, {
      product_name: '',
      description: '',
      quantity: 1,
      unit_price: 0,
      cgst_rate: 9,
      sgst_rate: 9,
      igst_rate: 0,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 0,
      total_amount: 0
    }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const totalCGST = items.reduce((sum, item) => sum + item.cgst_amount, 0);
    const totalSGST = items.reduce((sum, item) => sum + item.sgst_amount, 0);
    const totalIGST = items.reduce((sum, item) => sum + item.igst_amount, 0);
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const total = subtotal + totalCGST + totalSGST + totalIGST;
    
    return { subtotal, totalCGST, totalSGST, totalIGST, totalQuantity, total };
  };

  const handleSubmit = (action: 'draft' | 'invoice') => {
    if (items.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one item to the invoice",
        variant: "destructive",
      });
      return;
    }

    const totals = calculateTotals();
    
    const submitData = {
      ...invoiceData,
      status: action === 'draft' ? 'draft' : 'invoiced',
      // Only set invoice number for final invoices, not drafts
      performa_invoice_number: action === 'invoice' ? undefined : null,
      performa_invoice_date: invoiceData.invoice_date,
      subtotal_amount: totals.subtotal,
      tax_amount: totals.totalCGST + totals.totalSGST + totals.totalIGST,
      total_amount: totals.total,
      items: items
    };

    onSubmit(submitData, action);
  };

  const filteredSalesOrders = salesOrders.filter(so =>
    so.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    so.customer_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (showSalesOrderSearch && !invoice) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold">Select Sales Order</h3>
          <p className="text-sm text-gray-600">Choose a sales order to create an invoice</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by order number or customer name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredSalesOrders.map((so) => (
            <Card key={so.id} className="cursor-pointer hover:bg-gray-50" onClick={() => loadSalesOrder(so)}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium">{so.order_number}</h4>
                    <p className="text-sm text-gray-600">{so.customer_name}</p>
                    <p className="text-sm text-gray-500">Order Date: {new Date(so.order_date).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">₹{so.total_amount.toFixed(2)}</p>
                    <Badge variant={so.status === 'confirmed' ? 'default' : 'secondary'}>
                      {so.status}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Invoice Header */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="sales_order">Sales Order</Label>
          <Input
            id="sales_order"
            value={selectedSalesOrder?.order_number || ''}
            disabled
            className="bg-gray-50"
          />
        </div>
        <div>
          <Label htmlFor="customer_name">Customer</Label>
          <Input
            id="customer_name"
            value={invoiceData.customer_name}
            disabled
            className="bg-gray-50"
          />
        </div>
        <div>
          <Label htmlFor="invoice_date">Invoice Date</Label>
          <Input
            id="invoice_date"
            type="date"
            value={invoiceData.invoice_date}
            onChange={(e) => setInvoiceData({ ...invoiceData, invoice_date: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="place_of_supply">Place of Supply</Label>
          <Input
            id="place_of_supply"
            value={invoiceData.place_of_supply}
            onChange={(e) => setInvoiceData({ ...invoiceData, place_of_supply: e.target.value })}
            placeholder="Enter place of supply"
          />
        </div>
      </div>

      {/* Invoice Number Display (if exists) */}
      {invoice?.performa_invoice_number && (
        <div>
          <Label htmlFor="invoice_number">Invoice Number</Label>
          <Input
            id="invoice_number"
            value={invoice.performa_invoice_number}
            disabled
            className="bg-gray-50"
          />
        </div>
      )}

      {/* Items Section */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Invoice Items</CardTitle>
            <Button onClick={addItem} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-4">
                <div className="flex justify-between items-start">
                  <h4 className="font-medium">Item {index + 1}</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(index)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Product Name</Label>
                    <Input
                      value={item.product_name}
                      onChange={(e) => updateItem(index, 'product_name', e.target.value)}
                      placeholder="Enter product name"
                    />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Input
                      value={item.description}
                      onChange={(e) => updateItem(index, 'description', e.target.value)}
                      placeholder="Enter description"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div>
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <Label>Unit Price</Label>
                    <Input
                      type="number"
                      value={item.unit_price}
                      onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <Label>CGST %</Label>
                    <Input
                      type="number"
                      value={item.cgst_rate}
                      onChange={(e) => updateItem(index, 'cgst_rate', parseFloat(e.target.value) || 0)}
                      min="0"
                      max="100"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <Label>SGST %</Label>
                    <Input
                      type="number"
                      value={item.sgst_rate}
                      onChange={(e) => updateItem(index, 'sgst_rate', parseFloat(e.target.value) || 0)}
                      min="0"
                      max="100"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <Label>IGST %</Label>
                    <Input
                      type="number"
                      value={item.igst_rate}
                      onChange={(e) => updateItem(index, 'igst_rate', parseFloat(e.target.value) || 0)}
                      min="0"
                      max="100"
                      step="0.01"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                  <div>
                    <Label>Total Amount</Label>
                    <Input
                      value={`₹${item.total_amount.toFixed(2)}`}
                      disabled
                      className="bg-gray-50"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Totals */}
      {items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Invoice Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Total Quantity:</span>
                <span>{calculateTotals().totalQuantity}</span>
              </div>
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>₹{calculateTotals().subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Total CGST:</span>
                <span>₹{calculateTotals().totalCGST.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Total SGST:</span>
                <span>₹{calculateTotals().totalSGST.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Total IGST:</span>
                <span>₹{calculateTotals().totalIGST.toFixed(2)}</span>
              </div>
              <div className="border-t pt-2">
                <div className="flex justify-between font-semibold text-lg">
                  <span>Total Amount:</span>
                  <span>₹{calculateTotals().total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes and Terms */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={invoiceData.notes}
            onChange={(e) => setInvoiceData({ ...invoiceData, notes: e.target.value })}
            placeholder="Additional notes..."
            rows={3}
          />
        </div>
        <div>
          <Label htmlFor="terms_conditions">Terms & Conditions</Label>
          <Textarea
            id="terms_conditions"
            value={invoiceData.terms_conditions}
            onChange={(e) => setInvoiceData({ ...invoiceData, terms_conditions: e.target.value })}
            placeholder="Terms and conditions..."
            rows={3}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="outline" onClick={() => handleSubmit('draft')}>
          Save as Draft
        </Button>
        <Button onClick={() => handleSubmit('invoice')}>
          Generate Sales Invoice
        </Button>
      </div>
    </div>
  );
}
