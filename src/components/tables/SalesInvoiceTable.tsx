import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Edit, Trash2, Eye, Search, Filter, FileSpreadsheet, FileText } from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { toast } from '@/hooks/use-toast';

interface SalesInvoice {
  id: string;
  invoice_number: string | null;
  invoice_date: string;
  customer_name: string;
  sales_order_id: string;
  subtotal_amount: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  created_at: string;
  sales_orders?: {
    order_number: string;
  };
}

interface SalesInvoiceTableProps {
  refreshTrigger?: number;
  onEdit: (invoice: SalesInvoice) => void;
  onView: (invoice: SalesInvoice) => void;
  onDownloadExcel?: (invoice: SalesInvoice) => void;
  onDownloadPDF?: (invoice: SalesInvoice) => void;
}

export const SalesInvoiceTable: React.FC<SalesInvoiceTableProps> = ({
  refreshTrigger,
  onEdit,
  onView,
  onDownloadExcel,
  onDownloadPDF,
}) => {
  const { company } = useAuth();
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (company?.id) {
      fetchInvoices();
    }
  }, [company?.id, refreshTrigger]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('sales_invoices')
        .select(`
          *,
          sales_orders!left(order_number)
        `)
        .eq('company_id', company.id)
        .order('invoice_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      toast({
        title: "Error",
        description: "Failed to fetch sales invoices",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (invoiceId: string) => {
    try {
      const { error } = await supabase
        .from('sales_invoices')
        .delete()
        .eq('id', invoiceId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Sales invoice deleted successfully",
      });
      
      fetchInvoices();
    } catch (error) {
      console.error('Error deleting invoice:', error);
      toast({
        title: "Error",
        description: "Failed to delete sales invoice",
        variant: "destructive",
      });
    }
  };

  const handleStatusUpdate = async (invoiceId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('sales_invoices')
        .update({ status: newStatus })
        .eq('id', invoiceId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Invoice status updated to ${newStatus}`,
      });
      
      fetchInvoices();
    } catch (error) {
      console.error('Error updating invoice status:', error);
      toast({
        title: "Error",
        description: "Failed to update invoice status",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { label: 'Draft', variant: 'secondary' as const },
      finalized: { label: 'Finalized', variant: 'default' as const },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const handleDownloadExcel = (invoice: SalesInvoice) => {
    if (onDownloadExcel) return onDownloadExcel(invoice);
    const data = [
      {
        'Invoice No.': invoice.invoice_number || 'DRAFT',
        Date: format(new Date(invoice.invoice_date), 'yyyy-MM-dd'),
        Customer: invoice.customer_name,
        'Sales Order': invoice.sales_orders?.order_number || 'N/A',
        Subtotal: invoice.subtotal_amount,
        Tax: invoice.tax_amount,
        Total: invoice.total_amount,
        Status: invoice.status,
      },
    ];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Invoice');
    XLSX.writeFile(wb, `${invoice.invoice_number || 'invoice-draft'}.xlsx`);
  };

  const handleDownloadPDF = (invoice: SalesInvoice) => {
    if (onDownloadPDF) return onDownloadPDF(invoice);
    const doc = new jsPDF();
    let y = 14;
    doc.setFontSize(14);
    doc.text('Sales Invoice', 14, y);
    y += 8;
    doc.setFontSize(11);
    const lines = [
      `Invoice No.: ${invoice.invoice_number || 'DRAFT'}`,
      `Date: ${format(new Date(invoice.invoice_date), 'dd/MM/yyyy')}`,
      `Customer: ${invoice.customer_name}`,
      `Sales Order: ${invoice.sales_orders?.order_number || 'N/A'}`,
      `Subtotal: ₹${invoice.subtotal_amount.toFixed(2)}`,
      `Tax: ₹${invoice.tax_amount.toFixed(2)}`,
      `Total: ₹${invoice.total_amount.toFixed(2)}`,
      `Status: ${invoice.status}`,
    ];
    lines.forEach((l) => { doc.text(l, 14, y); y += 7; });
    doc.save(`${invoice.invoice_number || 'invoice-draft'}.pdf`);
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = 
      (invoice.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      (invoice.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) || false);
    
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const canEdit = (invoice: SalesInvoice) => {
    return invoice.status === 'draft';
  };

  const canDelete = (invoice: SalesInvoice) => {
    return invoice.status === 'draft';
  };

  if (loading) {
    return <div className="flex justify-center p-8">Loading invoices...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search by invoice number or customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="finalized">Finalized</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      {filteredInvoices.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          {searchTerm || statusFilter !== 'all' 
            ? 'No invoices found matching your filters.' 
            : 'No sales invoices found. Create your first invoice!'}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice No.</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Sales Order</TableHead>
                <TableHead>Subtotal</TableHead>
                <TableHead>Tax</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">
                    {invoice.invoice_number || 'Draft - Not Generated'}
                  </TableCell>
                  <TableCell>
                    {format(new Date(invoice.invoice_date), 'MMM dd, yyyy')}
                  </TableCell>
                  <TableCell>{invoice.customer_name}</TableCell>
                  <TableCell>
                    {invoice.sales_orders?.order_number || 'N/A'}
                  </TableCell>
                  <TableCell>₹{invoice.subtotal_amount.toFixed(2)}</TableCell>
                  <TableCell>₹{invoice.tax_amount.toFixed(2)}</TableCell>
                  <TableCell className="font-medium">
                    ₹{invoice.total_amount.toFixed(2)}
                  </TableCell>
                  <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onView(invoice)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      
                      {canEdit(invoice) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(invoice)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownloadExcel(invoice)}
                        title="Download Excel"
                      >
                        <FileSpreadsheet className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownloadPDF(invoice)}
                        title="Download PDF"
                      >
                        <FileText className="h-4 w-4" />
                      </Button>

                      {invoice.status === 'draft' && (
                        <Select
                          value={invoice.status}
                          onValueChange={(newStatus) => handleStatusUpdate(invoice.id, newStatus)}
                        >
                          <SelectTrigger className="w-28 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="finalized">Finalize</SelectItem>
                          </SelectContent>
                        </Select>
                      )}

                      {canDelete(invoice) && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this invoice? 
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(invoice.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};