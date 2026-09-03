import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Eye, 
  Edit, 
  Trash2, 
  Search, 
  Filter,
  Download,
  Plus,
  FileText,
  Calendar,
  DollarSign,
  Package
} from 'lucide-react';
import { format } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { TableSkeleton } from '@/components/ui/loading-skeleton';

interface PurchaseInvoice {
  id: string;
  invoice_no: string;
  purchase_invoice_number: string;
  purchase_invoice_date: string;
  payment_due_date?: string;
  supplier_id: string;
  supplier_code?: string;
  supplier_contact_person?: string;
  subtotal_amount: number;
  total_tax_amount: number;
  total_discount_amount: number;
  total_amount: number;
  status: 'draft' | 'received' | 'paid';
  notes?: string;
  created_at: string;
  purchase_invoice_items?: any[];
}

interface PurchaseInvoiceTableProps {
  invoices: PurchaseInvoice[];
  onView: (invoice: PurchaseInvoice) => void;
  onEdit: (invoice: PurchaseInvoice) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
  loading?: boolean;
}

export function PurchaseInvoiceTable({ 
  invoices, 
  onView, 
  onEdit, 
  onDelete, 
  onCreate,
  loading = false 
}: PurchaseInvoiceTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'supplier'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'received':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'draft':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <DollarSign className="h-3 w-3" />;
      case 'received':
        return <Package className="h-3 w-3" />;
      case 'draft':
        return <FileText className="h-3 w-3" />;
      default:
        return <FileText className="h-3 w-3" />;
    }
  };

  const filteredAndSortedInvoices = React.useMemo(() => {
    let filtered = invoices.filter(invoice => {
      const matchesSearch = 
        invoice.invoice_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.purchase_invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.supplier_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.supplier_contact_person?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });

    // Sort the filtered results
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'date':
          aValue = new Date(a.purchase_invoice_date).getTime();
          bValue = new Date(b.purchase_invoice_date).getTime();
          break;
        case 'amount':
          aValue = a.total_amount;
          bValue = b.total_amount;
          break;
        case 'supplier':
          aValue = a.supplier_code || '';
          bValue = b.supplier_code || '';
          break;
        default:
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }, [invoices, searchTerm, statusFilter, sortBy, sortOrder]);

  const totalAmount = filteredAndSortedInvoices.reduce((sum, invoice) => sum + invoice.total_amount, 0);
  const totalTax = filteredAndSortedInvoices.reduce((sum, invoice) => sum + invoice.total_tax_amount, 0);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-0">
          <TableSkeleton rows={5} columns={7} />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Total Invoices</p>
                <p className="text-2xl font-bold">{filteredAndSortedInvoices.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="text-2xl font-bold">₹{totalAmount.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-sm text-muted-foreground">Total Tax</p>
                <p className="text-2xl font-bold">₹{totalTax.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm text-muted-foreground">This Month</p>
                <p className="text-2xl font-bold">
                  {filteredAndSortedInvoices.filter(inv => 
                    new Date(inv.purchase_invoice_date).getMonth() === new Date().getMonth()
                  ).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Controls */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Purchase Invoices
            </CardTitle>
            <div className="flex flex-col md:flex-row gap-2">
              <Button onClick={onCreate} className="gap-2">
                <Plus className="h-4 w-4" />
                Create Invoice
              </Button>
              <Button variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by invoice number, supplier..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-40">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="received">Received</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="amount">Amount</SelectItem>
                <SelectItem value="supplier">Supplier</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="icon"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </Button>
          </div>

          {filteredAndSortedInvoices.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No purchase invoices found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Try adjusting your search or filters'
                  : 'Get started by creating your first purchase invoice'
                }
              </p>
              {(!searchTerm && statusFilter === 'all') && (
                <Button onClick={onCreate} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create First Invoice
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice Details</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedInvoices.map((invoice) => (
                    <TableRow key={invoice.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div>
                          <div className="font-medium">{invoice.invoice_no}</div>
                          <div className="text-sm text-muted-foreground">
                            {invoice.purchase_invoice_number}
                          </div>
                          {invoice.purchase_invoice_items && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {invoice.purchase_invoice_items.length} items
                            </div>
                          )}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div>
                          <div className="font-medium">{invoice.supplier_code}</div>
                          {invoice.supplier_contact_person && (
                            <div className="text-sm text-muted-foreground">
                              {invoice.supplier_contact_person}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="font-medium">
                          {format(new Date(invoice.purchase_invoice_date), 'MMM dd, yyyy')}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        {invoice.payment_due_date ? (
                          <div className={`font-medium ${
                            new Date(invoice.payment_due_date) < new Date() && invoice.status !== 'paid'
                              ? 'text-red-600'
                              : 'text-gray-900'
                          }`}>
                            {format(new Date(invoice.payment_due_date), 'MMM dd, yyyy')}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      
                      <TableCell>
                        <div>
                          <div className="font-bold">₹{invoice.total_amount.toFixed(2)}</div>
                          {invoice.total_tax_amount > 0 && (
                            <div className="text-xs text-muted-foreground">
                              Tax: ₹{invoice.total_tax_amount.toFixed(2)}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <Badge className={`gap-1 ${getStatusColor(invoice.status)}`}>
                          {getStatusIcon(invoice.status)}
                          {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                        </Badge>
                      </TableCell>
                      
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onView(invoice)}
                            className="gap-1"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(invoice)}
                            className="gap-1"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1 text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Purchase Invoice</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete invoice "{invoice.invoice_no}"? 
                                  This action cannot be undone and will also affect inventory if the invoice was received.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => onDelete(invoice.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}