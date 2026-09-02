import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Search, Edit, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Invoice {
  id: string;
  sales_order_id: string;
  customer_id: string;
  customer_name: string;
  performa_invoice_number: string | null;
  performa_invoice_date: string;
  place_of_supply: string;
  subtotal_amount: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  notes: string;
  terms_conditions: string;
  created_at: string;
  updated_at: string;
}

interface InvoiceTableProps {
  invoices: Invoice[];
  onEdit: (invoice: Invoice) => void;
  onDelete: (invoiceId: string) => void;
}

export default function InvoiceTable({ invoices, onEdit, onDelete }: InvoiceTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'created_at',
    direction: 'desc'
  });

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const filteredAndSortedInvoices = useMemo(() => {
    let filtered = invoices.filter(invoice =>
      (invoice.performa_invoice_number && invoice.performa_invoice_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
      invoice.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (invoice.place_of_supply && invoice.place_of_supply.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return filtered.sort((a, b) => {
      const aValue = a[sortConfig.key as keyof typeof a];
      const bValue = b[sortConfig.key as keyof typeof b];
      
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;
      
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [invoices, searchTerm, sortConfig]);

  const SortableHeader = ({ column, children }: { column: string; children: React.ReactNode }) => (
    <TableHead
      className="cursor-pointer hover:bg-gray-50"
      onClick={() => handleSort(column)}
    >
      <div className="flex items-center space-x-1">
        <span>{children}</span>
        {sortConfig.key === column && (
          sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
        )}
      </div>
    </TableHead>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search sales invoices..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {filteredAndSortedInvoices.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          {searchTerm ? 'No sales invoices found matching your search.' : 'No sales invoices found. Create your first sales invoice to get started.'}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader column="performa_invoice_number">Invoice #</SortableHeader>
                <SortableHeader column="customer_name">Customer</SortableHeader>
                <SortableHeader column="performa_invoice_date">Date</SortableHeader>
                <SortableHeader column="total_amount">Amount</SortableHeader>
                <SortableHeader column="status">Status</SortableHeader>
                <SortableHeader column="place_of_supply">Place of Supply</SortableHeader>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedInvoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">
                    {invoice.performa_invoice_number || (
                      <span className="text-gray-400 italic">Draft</span>
                    )}
                  </TableCell>
                  <TableCell>{invoice.customer_name}</TableCell>
                  <TableCell>
                    {invoice.performa_invoice_date 
                      ? new Date(invoice.performa_invoice_date).toLocaleDateString()
                      : '-'
                    }
                  </TableCell>
                  <TableCell>₹{invoice.total_amount?.toFixed(2) || '0.00'}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        invoice.status === 'invoiced' ? 'default' :
                        invoice.status === 'draft' ? 'secondary' :
                        'outline'
                      }
                    >
                      {invoice.status === 'invoiced' ? 'Invoiced' : 
                       invoice.status === 'draft' ? 'Draft' : 
                       invoice.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{invoice.place_of_supply || '-'}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(invoice)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(invoice.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
}
