import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useBusinessAuth } from '@/hooks/useBusinessAuth';
import { Plus, Search, CreditCard, TrendingUp, TrendingDown, ChevronDown, ChevronUp, Download, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, History } from 'lucide-react';
import { PaymentHistoryDialog } from '@/components/dialogs/PaymentHistoryDialog';
import { GRNDetailsDialog } from '@/components/dialogs/GRNDetailsDialog';
import { SalesInvoiceDetailsDialog } from '@/components/dialogs/SalesInvoiceDetailsDialog';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { TableSkeleton, StatsSkeleton } from '@/components/ui/loading-skeleton';
import { EmptyState } from '@/components/ui/empty-state';

interface Payment {
  id: string;
  amount: number;
  payment_method: string;
  payment_date: string;
  reference_number: string | null;
  notes: string | null;
  sales_order_id: string | null;
  purchase_order_id: string | null;
  sales_order?: {
    order_number: string;
    customer: {
      name: string;
    };
  };
  purchase_order?: {
    po_number: string;
    supplier: {
      name: string;
    };
  };
}

interface GRNPayable {
  id: string;
  grn_number: string;
  grn_date: string;
  total_amount: number;
  supplier_name: string;
  status: string;
  advance_payment: number;
  amount_received: number;
  payment_date: string | null;
  payment_method: string | null;
  payment_reference_no: string | null;
  pending_payment: number;
  invoice_status: string;
}

interface SalesInvoiceReceivable {
  id: string;
  invoice_number: string;
  invoice_date: string;
  total_amount: number;
  payment_terms: string | null;
  customer: {
    name: string;
  };
  advance_payment: number;
  amount_received: number;
  payment_date: string | null;
  payment_method: string | null;
  payment_reference_no: string | null;
  pending_payment: number;
  invoice_status: string;
}

export function PaymentsModule() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { hasEditAccess } = useBusinessAuth();
  const canEdit = hasEditAccess('payments');
  const [accountPayable, setAccountPayable] = useState<GRNPayable[]>([]);
  const [accountReceivable, setAccountReceivable] = useState<SalesInvoiceReceivable[]>([]);
  const [overdueVendors, setOverdueVendors] = useState<{name: string, amount: number}[]>([]);
  const [overdueCustomers, setOverdueCustomers] = useState<{name: string, amount: number}[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAPDetails, setShowAPDetails] = useState(false);
  const [showARDetails, setShowARDetails] = useState(false);
  const [showOverdueVendors, setShowOverdueVendors] = useState(false);
  const [showOverdueCustomers, setShowOverdueCustomers] = useState(false);
  const [apSearchTerm, setApSearchTerm] = useState('');
  const [arSearchTerm, setArSearchTerm] = useState('');
  
  // Payment history dialog state
  const [paymentHistoryOpen, setPaymentHistoryOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<{
    id: string;
    number: string;
    type: 'grn' | 'sales_invoice';
    totalAmount: number;
  } | null>(null);

  // Dialog states
  const [grnDetailsDialog, setGRNDetailsDialog] = useState<{
    open: boolean;
    grnId: string | null;
  }>({
    open: false,
    grnId: null,
  });

  const [invoiceDetailsDialog, setInvoiceDetailsDialog] = useState<{
    open: boolean;
    invoiceId: string | null;
  }>({
    open: false,
    invoiceId: null,
  });
  
  // Pagination states
  const [apCurrentPage, setApCurrentPage] = useState(1);
  const [arCurrentPage, setArCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Sorting states
  const [apSortField, setApSortField] = useState<keyof GRNPayable>('grn_date');
  const [apSortDirection, setApSortDirection] = useState<'asc' | 'desc'>('desc');
  const [arSortField, setArSortField] = useState<keyof SalesInvoiceReceivable | 'customer_name'>('invoice_date');
  const [arSortDirection, setArSortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchAccountPayable();
    fetchAccountReceivable();
  }, []);

  const fetchAccountPayable = async () => {
    try {
      setLoading(true);
      
      // First get GRN data
      const { data: grnData, error: grnError } = await supabase
        .from('grn_header')
        .select(`
          id,
          grn_number,
          grn_date,
          total_amount,
          supplier_name,
          status,
          purchase_order_id
        `)
        .in('status', ['accepted', 'received', 'partially_received'])
        .order('grn_date', { ascending: false });

      if (grnError) {
        console.error('Error fetching GRN data:', grnError);
        return;
      }

      // Get payment data for all purchase orders and directly for GRNs
      const purchaseOrderIds = grnData?.map(grn => grn.purchase_order_id).filter(Boolean) || [];
      const grnIds = grnData?.map(grn => grn.id) || [];
      let paymentsData: any[] = [];
      
      if (purchaseOrderIds.length > 0 || grnIds.length > 0) {
        const { data: payments, error: paymentsError } = await supabase
          .from('payments')
          .select('*')
          .or(`purchase_order_id.in.(${purchaseOrderIds.join(',')}),grn_id.in.(${grnIds.join(',')})`);
          
        if (!paymentsError) {
          paymentsData = payments || [];
        }
      }

      // Transform data to include payment information
      const transformedData = (grnData || []).map(grn => {
        const relatedPayments = paymentsData.filter(payment => 
          payment.purchase_order_id === grn.purchase_order_id || payment.grn_id === grn.id
        );
        const advancePayments = relatedPayments.filter(p => p.payment_type === 'advance');
        const regularPayments = relatedPayments.filter(p => p.payment_type !== 'advance');
        
        const totalAdvancePayment = advancePayments.reduce((sum, payment) => sum + payment.amount, 0);
        const totalAmountReceived = regularPayments.reduce((sum, payment) => sum + payment.amount, 0);
        const pendingPayment = grn.total_amount - totalAdvancePayment - totalAmountReceived;
        const latestPayment = relatedPayments.sort((a, b) => 
          new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
        )[0];

        let invoiceStatus = 'Outstanding';
        if (pendingPayment <= 0) {
          invoiceStatus = 'Fully Paid';
        } else if (totalAmountReceived > 0 || totalAdvancePayment > 0) {
          invoiceStatus = 'Partially Paid';
        }

        return {
          id: grn.id,
          grn_number: grn.grn_number,
          grn_date: grn.grn_date,
          total_amount: grn.total_amount,
          supplier_name: grn.supplier_name,
          status: grn.status,
          advance_payment: totalAdvancePayment,
          amount_received: totalAmountReceived,
          payment_date: latestPayment?.payment_date || null,
          payment_method: latestPayment?.payment_method || null,
          payment_reference_no: latestPayment?.reference_number || null,
          pending_payment: Math.max(0, pendingPayment),
          invoice_status: invoiceStatus
        };
      });

      setAccountPayable(transformedData);
    } catch (error) {
      console.error('Error fetching account payable:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAccountReceivable = async () => {
    try {
      // First get sales invoice data
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('sales_invoices')
        .select(`
          id,
          invoice_number,
          invoice_date,
          total_amount,
          payment_terms,
          customer_id,
          customer_name,
          sales_order_id
        `)
        .eq('status', 'finalized')
        .order('invoice_date', { ascending: false });

      if (invoiceError) {
        console.error('Error fetching sales invoice data:', invoiceError);
        return;
      }

      // Get payment data for all sales orders and directly for invoices
      const salesOrderIds = invoiceData?.map(invoice => invoice.sales_order_id).filter(Boolean) || [];
      const invoiceIds = invoiceData?.map(invoice => invoice.id) || [];
      let paymentsData: any[] = [];
      
      if (salesOrderIds.length > 0 || invoiceIds.length > 0) {
        const { data: payments, error: paymentsError } = await supabase
          .from('payments')
          .select('*')
          .or(`sales_order_id.in.(${salesOrderIds.join(',')}),sales_invoice_id.in.(${invoiceIds.join(',')})`);
          
        if (!paymentsError) {
          paymentsData = payments || [];
        }
      }

      // Transform data to include payment information and status logic
      const transformedData = (invoiceData || []).map(invoice => {
        const relatedPayments = paymentsData.filter(payment => 
          payment.sales_order_id === invoice.sales_order_id || payment.sales_invoice_id === invoice.id
        );
        const advancePayments = relatedPayments.filter(p => p.payment_type === 'advance');
        const regularPayments = relatedPayments.filter(p => p.payment_type !== 'advance');
        
        const totalAdvancePayment = advancePayments.reduce((sum, payment) => sum + payment.amount, 0);
        const totalAmountReceived = regularPayments.reduce((sum, payment) => sum + payment.amount, 0);
        const pendingPayment = invoice.total_amount - totalAdvancePayment - totalAmountReceived;
        const latestPayment = relatedPayments.sort((a, b) => 
          new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
        )[0];

        // Calculate invoice status including overdue logic
        let invoiceStatus = 'Outstanding';
        if (pendingPayment <= 0) {
          invoiceStatus = 'Fully Paid';
        } else if (totalAmountReceived > 0 || totalAdvancePayment > 0) {
          invoiceStatus = 'Partially Paid';
        }

        // Check for overdue status
        if (pendingPayment > 0) {
          const invoiceDate = new Date(invoice.invoice_date);
          const paymentTermDays = parseInt(invoice.payment_terms?.replace(/\D/g, '') || '30');
          const dueDate = new Date(invoiceDate.getTime() + (paymentTermDays * 24 * 60 * 60 * 1000));
          const currentDate = new Date();
          
          if (currentDate > dueDate) {
            invoiceStatus = 'Overdue';
          }
        }

        return {
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          invoice_date: invoice.invoice_date,
          total_amount: invoice.total_amount,
          payment_terms: invoice.payment_terms,
          customer: { name: invoice.customer_name },
          advance_payment: totalAdvancePayment,
          amount_received: totalAmountReceived,
          payment_date: latestPayment?.payment_date || null,
          payment_method: latestPayment?.payment_method || null,
          payment_reference_no: latestPayment?.reference_number || null,
          pending_payment: Math.max(0, pendingPayment),
          invoice_status: invoiceStatus
        };
      });

      setAccountReceivable(transformedData);
    } catch (error) {
      console.error('Error fetching account receivable:', error);
    }
  };

  // Fetch top 5 overdue vendors
  const fetchOverdueVendors = async () => {
    if (!profile?.company_id) return;

    try {
      const { data, error } = await supabase
        .from('grn_header')
        .select(`
          supplier_name,
          total_amount,
          grn_date,
          status,
          payments(amount, payment_status)
        `)
        .eq('company_id', profile.company_id)
        .in('status', ['accepted', 'received', 'partially_received']);

      if (error) throw error;

      // Calculate overdue amounts per vendor
      const vendorOverdues: { [key: string]: number } = {};
      
      data?.forEach((grn) => {
        const grnDate = new Date(grn.grn_date);
        const daysOld = Math.floor((Date.now() - grnDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysOld > 30) { // Consider overdue after 30 days
          const totalPaid = grn.payments
            ?.filter((p: any) => p.payment_status === 'completed')
            ?.reduce((sum: number, p: any) => sum + p.amount, 0) || 0;
          
          const overdueAmount = grn.total_amount - totalPaid;
          if (overdueAmount > 0) {
            vendorOverdues[grn.supplier_name] = (vendorOverdues[grn.supplier_name] || 0) + overdueAmount;
          }
        }
      });

      // Get top 5 overdue vendors
      const sortedVendors = Object.entries(vendorOverdues)
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

      setOverdueVendors(sortedVendors);
    } catch (error) {
      console.error('Error fetching overdue vendors:', error);
    }
  };

  // Fetch top 5 overdue customers
  const fetchOverdueCustomers = async () => {
    if (!profile?.company_id) return;

    try {
      const { data, error } = await supabase
        .from('sales_invoices')
        .select(`
          customer_name,
          total_amount,
          invoice_date,
          due_date,
          status,
          payments(amount, payment_status)
        `)
        .eq('company_id', profile.company_id)
        .eq('status', 'finalized');

      if (error) throw error;

      // Calculate overdue amounts per customer
      const customerOverdues: { [key: string]: number } = {};
      
      data?.forEach((invoice) => {
        const dueDate = invoice.due_date ? new Date(invoice.due_date) : new Date(invoice.invoice_date);
        dueDate.setDate(dueDate.getDate() + 30); // Add 30 days if no due date
        const isOverdue = Date.now() > dueDate.getTime();
        
        if (isOverdue) {
          const totalPaid = invoice.payments
            ?.filter((p: any) => p.payment_status === 'completed')
            ?.reduce((sum: number, p: any) => sum + p.amount, 0) || 0;
          
          const overdueAmount = invoice.total_amount - totalPaid;
          if (overdueAmount > 0) {
            const customerName = invoice.customer_name;
            customerOverdues[customerName] = (customerOverdues[customerName] || 0) + overdueAmount;
          }
        }
      });

      // Get top 5 overdue customers
      const sortedCustomers = Object.entries(customerOverdues)
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

      setOverdueCustomers(sortedCustomers);
    } catch (error) {
      console.error('Error fetching overdue customers:', error);
    }
  };


  // Sorting functions
  const handleApSort = (field: keyof GRNPayable) => {
    if (apSortField === field) {
      setApSortDirection(apSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setApSortField(field);
      setApSortDirection('asc');
    }
    setApCurrentPage(1);
  };

  const handleArSort = (field: keyof SalesInvoiceReceivable | 'customer_name') => {
    if (arSortField === field) {
      setArSortDirection(arSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setArSortField(field);
      setArSortDirection('asc');
    }
    setArCurrentPage(1);
  };

  // Filter and sort functions
  const filteredAndSortedAP = accountPayable
    .filter(item =>
      item.supplier_name.toLowerCase().includes(apSearchTerm.toLowerCase()) ||
      item.grn_number.toLowerCase().includes(apSearchTerm.toLowerCase()) ||
      item.invoice_status.toLowerCase().includes(apSearchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const aValue = a[apSortField];
      const bValue = b[apSortField];
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return apSortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return apSortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      return 0;
    });

  const filteredAndSortedAR = accountReceivable
    .filter(item =>
      item.customer?.name.toLowerCase().includes(arSearchTerm.toLowerCase()) ||
      item.invoice_number?.toLowerCase().includes(arSearchTerm.toLowerCase()) ||
      item.invoice_status.toLowerCase().includes(arSearchTerm.toLowerCase())
    )
    .sort((a, b) => {
      let aValue: any, bValue: any;
      
      // Special handling for customer name
      if (arSortField === 'customer_name') {
        aValue = a.customer?.name || '';
        bValue = b.customer?.name || '';
      } else {
        aValue = a[arSortField];
        bValue = b[arSortField];
      }
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return arSortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return arSortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      return 0;
    });

  // Pagination
  const paginatedAP = filteredAndSortedAP.slice(
    (apCurrentPage - 1) * itemsPerPage,
    apCurrentPage * itemsPerPage
  );

  const paginatedAR = filteredAndSortedAR.slice(
    (arCurrentPage - 1) * itemsPerPage,
    arCurrentPage * itemsPerPage
  );

  const totalAPPages = Math.ceil(filteredAndSortedAP.length / itemsPerPage);
  const totalARPages = Math.ceil(filteredAndSortedAR.length / itemsPerPage);

  // Export functions
  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;
    
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(item => 
      Object.values(item).map(value => 
        typeof value === 'string' && value.includes(',') ? `"${value}"` : value
      ).join(',')
    ).join('\n');
    
    const csvContent = `${headers}\n${rows}`;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const handleAPExport = () => {
    const exportData = filteredAndSortedAP.map(item => ({
      'Vendor Name': item.supplier_name,
      'GRN Number': item.grn_number,
      'GRN Date': new Date(item.grn_date).toLocaleDateString(),
      'Total Amount': item.total_amount,
      'Advance Payment': item.advance_payment,
      'Amount Received': item.amount_received,
      'Pending Payment': item.pending_payment,
      'Invoice Status': item.invoice_status,
      'GRN Status': item.status
    }));
    exportToCSV(exportData, 'account_payable');
    toast({ title: "Export successful", description: "Account Payable data exported to CSV" });
  };

  const handleARExport = () => {
    const exportData = filteredAndSortedAR.map(item => ({
      'Customer Name': item.customer?.name || 'N/A',
      'Invoice Number': item.invoice_number || 'N/A',
      'Invoice Date': new Date(item.invoice_date).toLocaleDateString(),
      'Total Amount': item.total_amount,
      'Advance Payment': item.advance_payment,
      'Amount Received': item.amount_received,
      'Pending Payment': item.pending_payment,
      'Invoice Status': item.invoice_status,
      'Payment Terms': item.payment_terms || 'Net 30'
    }));
    exportToCSV(exportData, 'account_receivable');
    toast({ title: "Export successful", description: "Account Receivable data exported to CSV" });
  };

  // Calculate totals
  const totalOverdueVendors = overdueVendors.reduce((sum, vendor) => sum + vendor.amount, 0);
  const totalOverdueCustomers = overdueCustomers.reduce((sum, customer) => sum + customer.amount, 0);
  const totalAP = accountPayable.reduce((sum, item) => sum + item.total_amount, 0);
  const totalAR = accountReceivable.reduce((sum, item) => sum + item.total_amount, 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <StatsSkeleton />
        <TableSkeleton rows={5} columns={6} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Summary Cards Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {/* Top 5 Overdue Vendors */}
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => { 
          setShowOverdueVendors(!showOverdueVendors); 
          setShowAPDetails(false); 
          setShowARDetails(false); 
          setShowOverdueCustomers(false); 
        }}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-orange-600" />
                Top 5 Overdue Vendors
              </div>
              {showOverdueVendors ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-xl font-bold">₹{totalOverdueVendors.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {overdueVendors.length} vendors with overdue payments
            </p>
          </CardContent>
        </Card>

        {/* Top 5 Overdue Customers */}
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => { 
          setShowOverdueCustomers(!showOverdueCustomers); 
          setShowAPDetails(false); 
          setShowARDetails(false); 
          setShowOverdueVendors(false); 
        }}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-red-600" />
                Top 5 Overdue Customers
              </div>
              {showOverdueCustomers ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-xl font-bold">₹{totalOverdueCustomers.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {overdueCustomers.length} customers with overdue payments
            </p>
          </CardContent>
        </Card>

        {/* Placeholder cards for balance */}
        <Card className="opacity-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Summary Card 3</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">Coming soon</p>
          </CardContent>
        </Card>

        <Card className="opacity-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Summary Card 4</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">Coming soon</p>
          </CardContent>
        </Card>
      </div>

      {/* AP/AR Cards Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Account Payable Section */}
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => { 
          setShowAPDetails(!showAPDetails); 
          setShowARDetails(false); 
          setShowOverdueVendors(false); 
          setShowOverdueCustomers(false); 
        }}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-destructive" />
                Account Payable (AP)
              </div>
              {showAPDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-xl font-bold">₹{totalAP.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {accountPayable.length} received GRN records
            </p>
          </CardContent>
        </Card>

        {/* Account Receivable Section */}
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => { 
          setShowARDetails(!showARDetails); 
          setShowAPDetails(false); 
          setShowOverdueVendors(false); 
          setShowOverdueCustomers(false); 
        }}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                Account Receivable (AR)
              </div>
              {showARDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-xl font-bold">₹{totalAR.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {accountReceivable.length} outstanding invoices
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Account Payable Details */}
      {showAPDetails && (
        <Card>
          <CardHeader>
            <CardTitle>Account Payable Details</CardTitle>
            <div className="flex gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search vendors or GRN numbers..."
                  value={apSearchTerm}
                  onChange={(e) => { setApSearchTerm(e.target.value); setApCurrentPage(1); }}
                  className="pl-10"
                />
              </div>
              <Button onClick={handleAPExport} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              <Table className="w-full table-fixed">
                <colgroup>
                  <col className="w-[15%]" />
                  <col className="w-[12%]" />
                  <col className="w-[10%]" />
                  <col className="w-[12%]" />
                  <col className="w-[12%]" />
                  <col className="w-[12%]" />
                  <col className="w-[12%]" />
                  <col className="w-[10%]" />
                  <col className="w-[5%]" />
                </colgroup>
                <TableHeader>
                  <TableRow>
                     <TableHead className="p-2">
                       <Button variant="ghost" className="h-6 p-0 text-xs font-semibold hover:bg-transparent" onClick={() => handleApSort('supplier_name')}>
                         Vendor
                         {apSortField === 'supplier_name' ? (
                           apSortDirection === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                         ) : <ArrowUpDown className="ml-1 h-3 w-3" />}
                       </Button>
                     </TableHead>
                     <TableHead className="p-2">
                       <Button variant="ghost" className="h-6 p-0 text-xs font-semibold hover:bg-transparent" onClick={() => handleApSort('grn_number')}>
                         GRN #
                         {apSortField === 'grn_number' ? (
                           apSortDirection === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                         ) : <ArrowUpDown className="ml-1 h-3 w-3" />}
                       </Button>
                     </TableHead>
                     <TableHead className="p-2">
                       <Button variant="ghost" className="h-6 p-0 text-xs font-semibold hover:bg-transparent" onClick={() => handleApSort('grn_date')}>
                         Date
                         {apSortField === 'grn_date' ? (
                           apSortDirection === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                         ) : <ArrowUpDown className="ml-1 h-3 w-3" />}
                       </Button>
                     </TableHead>
                     <TableHead className="p-2">
                       <Button variant="ghost" className="h-6 p-0 text-xs font-semibold hover:bg-transparent" onClick={() => handleApSort('total_amount')}>
                         Total
                         {apSortField === 'total_amount' ? (
                           apSortDirection === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                         ) : <ArrowUpDown className="ml-1 h-3 w-3" />}
                       </Button>
                     </TableHead>
                     <TableHead className="p-2">
                       <Button variant="ghost" className="h-6 p-0 text-xs font-semibold hover:bg-transparent" onClick={() => handleApSort('advance_payment')}>
                         Advance
                         {apSortField === 'advance_payment' ? (
                           apSortDirection === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                         ) : <ArrowUpDown className="ml-1 h-3 w-3" />}
                       </Button>
                     </TableHead>
                     <TableHead className="p-2">
                       <Button variant="ghost" className="h-6 p-0 text-xs font-semibold hover:bg-transparent" onClick={() => handleApSort('amount_received')}>
                         Received
                         {apSortField === 'amount_received' ? (
                           apSortDirection === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                         ) : <ArrowUpDown className="ml-1 h-3 w-3" />}
                       </Button>
                     </TableHead>
                    <TableHead>
                      <Button variant="ghost" className="h-8 p-0 font-semibold hover:bg-transparent" onClick={() => handleApSort('pending_payment')}>
                        Pending Payment
                        {apSortField === 'pending_payment' ? (
                          apSortDirection === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                        ) : <ArrowUpDown className="ml-1 h-3 w-3" />}
                      </Button>
                    </TableHead>
                      <TableHead className="p-2">
                        <Button variant="ghost" className="h-6 p-0 text-xs font-semibold hover:bg-transparent" onClick={() => handleApSort('invoice_status')}>
                          Status
                          {apSortField === 'invoice_status' ? (
                            apSortDirection === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                          ) : <ArrowUpDown className="ml-1 h-3 w-3" />}
                        </Button>
                      </TableHead>
                      <TableHead className="p-2 text-xs">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                   {paginatedAP.length === 0 ? (
                     <TableRow>
                       <TableCell colSpan={9} className="text-center text-muted-foreground">
                         No GRN records found
                       </TableCell>
                     </TableRow>
                   ) : (
                     paginatedAP.map((item) => (
                        <TableRow key={item.id} className="h-12">
                          <TableCell className="p-2 text-xs font-medium truncate">{item.supplier_name || 'N/A'}</TableCell>
                          <TableCell className="p-2 text-xs truncate">
                            <Button
                              variant="link"
                              size="sm"
                              className="p-0 h-auto font-normal text-blue-600 hover:text-blue-800"
                              onClick={() => setGRNDetailsDialog({ open: true, grnId: item.id })}
                            >
                              {item.grn_number}
                            </Button>
                          </TableCell>
                          <TableCell className="p-2 text-xs">{new Date(item.grn_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' })}</TableCell>
                          <TableCell className="p-2 text-xs">₹{item.total_amount.toLocaleString('en-IN')}</TableCell>
                          <TableCell className="p-2 text-xs">₹{item.advance_payment.toLocaleString('en-IN')}</TableCell>
                          <TableCell className="p-2 text-xs">₹{item.amount_received.toLocaleString('en-IN')}</TableCell>
                          <TableCell className="p-2 text-xs">₹{item.pending_payment.toLocaleString('en-IN')}</TableCell>
                          <TableCell className="p-2">
                            <Badge variant={
                              item.invoice_status === 'Fully Paid' ? 'default' :
                              item.invoice_status === 'Partially Paid' ? 'secondary' :
                              item.invoice_status === 'Overdue' ? 'destructive' : 'outline'
                            } className="text-xs px-1 py-0">
                              {item.invoice_status === 'Fully Paid' ? 'Paid' : 
                               item.invoice_status === 'Partially Paid' ? 'Partial' :
                               item.invoice_status === 'Overdue' ? 'Overdue' : 'Outstanding'}
                            </Badge>
                          </TableCell>
                          <TableCell className="p-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => {
                                setSelectedRecord({
                                  id: item.id,
                                  number: item.grn_number,
                                  type: 'grn',
                                  totalAmount: item.total_amount
                                });
                                setPaymentHistoryOpen(true);
                              }}
                            >
                              <History className="h-3 w-3" />
                            </Button>
                          </TableCell>
                       </TableRow>
                    ))
                  )}
                </TableBody>
                </Table>
            </ScrollArea>
            {totalAPPages > 1 && (
              <div className="flex items-center justify-between px-2 py-4">
                <div className="text-sm text-muted-foreground">
                  Showing {((apCurrentPage - 1) * itemsPerPage) + 1} to {Math.min(apCurrentPage * itemsPerPage, filteredAndSortedAP.length)} of {filteredAndSortedAP.length} entries
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setApCurrentPage(apCurrentPage - 1)}
                    disabled={apCurrentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <span className="text-sm font-medium">
                    Page {apCurrentPage} of {totalAPPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setApCurrentPage(apCurrentPage + 1)}
                    disabled={apCurrentPage === totalAPPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Account Receivable Details */}
      {showARDetails && (
        <Card>
          <CardHeader>
            <CardTitle>Account Receivable Details</CardTitle>
            <div className="flex gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search customers or invoice numbers..."
                  value={arSearchTerm}
                  onChange={(e) => { setArSearchTerm(e.target.value); setArCurrentPage(1); }}
                  className="pl-10"
                />
              </div>
              <Button onClick={handleARExport} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              <Table className="w-full table-fixed">
                <colgroup>
                  <col className="w-[14%]" />
                  <col className="w-[12%]" />
                  <col className="w-[9%]" />
                  <col className="w-[11%]" />
                  <col className="w-[11%]" />
                  <col className="w-[11%]" />
                  <col className="w-[11%]" />
                  <col className="w-[9%]" />
                  <col className="w-[7%]" />
                  <col className="w-[5%]" />
                </colgroup>
                <TableHeader>
                  <TableRow>
                     <TableHead className="p-2">
                       <Button variant="ghost" className="h-6 p-0 text-xs font-semibold hover:bg-transparent" onClick={() => handleArSort('customer_name')}>
                         Customer
                         {arSortField === 'customer_name' ? (
                           arSortDirection === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                         ) : <ArrowUpDown className="ml-1 h-3 w-3" />}
                       </Button>
                     </TableHead>
                     <TableHead className="p-2">
                       <Button variant="ghost" className="h-6 p-0 text-xs font-semibold hover:bg-transparent" onClick={() => handleArSort('invoice_number')}>
                         Invoice #
                         {arSortField === 'invoice_number' ? (
                           arSortDirection === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                         ) : <ArrowUpDown className="ml-1 h-3 w-3" />}
                       </Button>
                     </TableHead>
                     <TableHead className="p-2">
                       <Button variant="ghost" className="h-6 p-0 text-xs font-semibold hover:bg-transparent" onClick={() => handleArSort('invoice_date')}>
                         Date
                         {arSortField === 'invoice_date' ? (
                           arSortDirection === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                         ) : <ArrowUpDown className="ml-1 h-3 w-3" />}
                       </Button>
                     </TableHead>
                     <TableHead className="p-2">
                       <Button variant="ghost" className="h-6 p-0 text-xs font-semibold hover:bg-transparent" onClick={() => handleArSort('total_amount')}>
                         Total
                         {arSortField === 'total_amount' ? (
                           arSortDirection === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                         ) : <ArrowUpDown className="ml-1 h-3 w-3" />}
                       </Button>
                     </TableHead>
                     <TableHead className="p-2">
                       <Button variant="ghost" className="h-6 p-0 text-xs font-semibold hover:bg-transparent" onClick={() => handleArSort('advance_payment')}>
                         Advance
                         {arSortField === 'advance_payment' ? (
                           arSortDirection === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                         ) : <ArrowUpDown className="ml-1 h-3 w-3" />}
                       </Button>
                     </TableHead>
                     <TableHead className="p-2">
                       <Button variant="ghost" className="h-6 p-0 text-xs font-semibold hover:bg-transparent" onClick={() => handleArSort('amount_received')}>
                         Received
                         {arSortField === 'amount_received' ? (
                           arSortDirection === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                         ) : <ArrowUpDown className="ml-1 h-3 w-3" />}
                       </Button>
                     </TableHead>
                     <TableHead className="p-2">
                       <Button variant="ghost" className="h-6 p-0 text-xs font-semibold hover:bg-transparent" onClick={() => handleArSort('pending_payment')}>
                         Pending
                         {arSortField === 'pending_payment' ? (
                           arSortDirection === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                         ) : <ArrowUpDown className="ml-1 h-3 w-3" />}
                       </Button>
                     </TableHead>
                     <TableHead className="p-2">
                       <Button variant="ghost" className="h-6 p-0 text-xs font-semibold hover:bg-transparent" onClick={() => handleArSort('invoice_status')}>
                         Status
                         {arSortField === 'invoice_status' ? (
                           arSortDirection === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                         ) : <ArrowUpDown className="ml-1 h-3 w-3" />}
                       </Button>
                     </TableHead>
                      <TableHead className="p-2">
                        <Button variant="ghost" className="h-6 p-0 text-xs font-semibold hover:bg-transparent" onClick={() => handleArSort('payment_terms')}>
                          Terms
                          {arSortField === 'payment_terms' ? (
                            arSortDirection === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                          ) : <ArrowUpDown className="ml-1 h-3 w-3" />}
                        </Button>
                      </TableHead>
                     <TableHead className="p-2 text-xs">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                   {paginatedAR.length === 0 ? (
                     <TableRow>
                       <TableCell colSpan={10} className="text-center text-muted-foreground">
                         No invoices found
                       </TableCell>
                     </TableRow>
                   ) : (
                     paginatedAR.map((item) => (
                        <TableRow key={item.id} className="h-12">
                          <TableCell className="p-2 text-xs font-medium truncate">{item.customer?.name || 'N/A'}</TableCell>
                          <TableCell className="p-2 text-xs truncate">
                            {item.invoice_number ? (
                              <Button
                                variant="link"
                                size="sm"
                                className="p-0 h-auto font-normal text-blue-600 hover:text-blue-800"
                                onClick={() => setInvoiceDetailsDialog({ open: true, invoiceId: item.id })}
                              >
                                {item.invoice_number}
                              </Button>
                            ) : (
                              'N/A'
                            )}
                          </TableCell>
                          <TableCell className="p-2 text-xs">{new Date(item.invoice_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' })}</TableCell>
                          <TableCell className="p-2 text-xs">₹{item.total_amount.toLocaleString('en-IN')}</TableCell>
                          <TableCell className="p-2 text-xs">₹{item.advance_payment.toLocaleString('en-IN')}</TableCell>
                          <TableCell className="p-2 text-xs">₹{item.amount_received.toLocaleString('en-IN')}</TableCell>
                          <TableCell className="p-2 text-xs">₹{item.pending_payment.toLocaleString('en-IN')}</TableCell>
                          <TableCell className="p-2">
                            <Badge variant={
                              item.invoice_status === 'Fully Paid' ? 'default' :
                              item.invoice_status === 'Partially Paid' ? 'secondary' :
                              item.invoice_status === 'Overdue' ? 'destructive' : 'outline'
                            } className="text-xs px-1 py-0">
                              {item.invoice_status === 'Fully Paid' ? 'Paid' : 
                               item.invoice_status === 'Partially Paid' ? 'Partial' :
                               item.invoice_status === 'Overdue' ? 'Overdue' : 'Outstanding'}
                            </Badge>
                          </TableCell>
                          <TableCell className="p-2 text-xs truncate">{item.payment_terms || 'Net 30'}</TableCell>
                          <TableCell className="p-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => {
                                setSelectedRecord({
                                  id: item.id,
                                  number: item.invoice_number || 'N/A',
                                  type: 'sales_invoice',
                                  totalAmount: item.total_amount
                                });
                                setPaymentHistoryOpen(true);
                              }}
                            >
                              <History className="h-3 w-3" />
                           </Button>
                         </TableCell>
                       </TableRow>
                    ))
      )}

      {/* Overdue Vendors Details */}
      {showOverdueVendors && (
        <Card>
          <CardHeader>
            <CardTitle>Top 5 Overdue Vendors</CardTitle>
            <CardDescription>Vendors with the highest overdue payment amounts (30+ days old)</CardDescription>
          </CardHeader>
          <CardContent>
            {overdueVendors.length === 0 ? (
              <EmptyState
                icon={TrendingDown}
                title="No overdue vendor payments"
                description="Vendor bills past their due date will appear here."
              />
            ) : (
              <div className="space-y-3">
                {overdueVendors.map((vendor, index) => (
                  <div key={vendor.name} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center text-xs font-medium text-orange-700">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{vendor.name}</p>
                        <p className="text-xs text-muted-foreground">Overdue Amount</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-orange-700">₹{vendor.amount.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Overdue Customers Details */}
      {showOverdueCustomers && (
        <Card>
          <CardHeader>
            <CardTitle>Top 5 Overdue Customers</CardTitle>
            <CardDescription>Customers with the highest overdue payment amounts (past due date)</CardDescription>
          </CardHeader>
          <CardContent>
            {overdueCustomers.length === 0 ? (
              <EmptyState
                icon={TrendingUp}
                title="No overdue customer payments"
                description="Customer invoices past their due date will appear here."
              />
            ) : (
              <div className="space-y-3">
                {overdueCustomers.map((customer, index) => (
                  <div key={customer.name} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center text-xs font-medium text-red-700">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{customer.name}</p>
                        <p className="text-xs text-muted-foreground">Overdue Amount</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-red-700">₹{customer.amount.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
                </TableBody>
                </Table>
            </ScrollArea>
            {totalARPages > 1 && (
              <div className="flex items-center justify-between px-2 py-4">
                <div className="text-sm text-muted-foreground">
                  Showing {((arCurrentPage - 1) * itemsPerPage) + 1} to {Math.min(arCurrentPage * itemsPerPage, filteredAndSortedAR.length)} of {filteredAndSortedAR.length} entries
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setArCurrentPage(arCurrentPage - 1)}
                    disabled={arCurrentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <span className="text-sm font-medium">
                    Page {arCurrentPage} of {totalARPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setArCurrentPage(arCurrentPage + 1)}
                    disabled={arCurrentPage === totalARPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Payment History Dialog */}
      {selectedRecord && (
        <PaymentHistoryDialog
          open={paymentHistoryOpen}
          onOpenChange={setPaymentHistoryOpen}
          recordId={selectedRecord.id}
          recordType={selectedRecord.type}
          recordNumber={selectedRecord.number}
          totalAmount={selectedRecord.totalAmount}
          companyId={profile?.company_id || ''}
          onPaymentChange={() => {
            fetchAccountPayable();
            fetchAccountReceivable();
          }}
        />
      )}

      {/* GRN Details Dialog */}
      <GRNDetailsDialog
        open={grnDetailsDialog.open}
        onOpenChange={(open) => setGRNDetailsDialog(prev => ({ ...prev, open }))}
        grnId={grnDetailsDialog.grnId || ''}
      />

      {/* Sales Invoice Details Dialog */}
      <SalesInvoiceDetailsDialog
        open={invoiceDetailsDialog.open}
        onOpenChange={(open) => setInvoiceDetailsDialog(prev => ({ ...prev, open }))}
        invoiceId={invoiceDetailsDialog.invoiceId || ''}
      />
    </div>
  );
}