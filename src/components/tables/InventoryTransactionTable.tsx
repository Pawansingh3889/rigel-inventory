import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { Search, Filter, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, FileSpreadsheet } from 'lucide-react';
import { exportToExcel, formatCurrency, formatDateTime, ExportColumn } from '@/utils/excelExport';

interface InventoryTransaction {
  id: string;
  transaction_date: string;
  transaction_type: string;
  reference_number: string;
  product_name: string;
  product_sku: string;
  warehouse_name: string;
  bin_name: string;
  quantity_change: number;
  unit_cost: number;
  total_value: number;
  notes: string;
  created_by_name: string;
}

interface InventoryTransactionTableProps {
  refreshTrigger?: number;
}

export const InventoryTransactionTable = ({ refreshTrigger }: InventoryTransactionTableProps) => {
  const { company } = useAuth();
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => {
    fetchTransactions();
  }, [company?.id, refreshTrigger]);

  useEffect(() => {
    const handleInventoryUpdate = (event: CustomEvent) => {
      console.log('Inventory updated:', event.detail);
      fetchTransactions(); // Refresh the table
    };

    // Listen for both custom events
    window.addEventListener('inventoryUpdated', handleInventoryUpdate as EventListener);
    window.addEventListener('refreshInventoryTransactions', handleInventoryUpdate as EventListener);
    
    return () => {
      window.removeEventListener('inventoryUpdated', handleInventoryUpdate as EventListener);
      window.removeEventListener('refreshInventoryTransactions', handleInventoryUpdate as EventListener);
    };
  }, []);

  const fetchTransactions = async () => {
    if (!company?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('inventory_transactions')
        .select(`
          *,
          products!fk_inventory_transactions_product_id(name, sku),
          warehouse_bins!fk_inventory_transactions_warehouse_id(warehouse_name, bin_name),
          bin_info:warehouse_bins!fk_inventory_transactions_bin_id(warehouse_name, bin_name),
          profiles!fk_inventory_transactions_created_by(first_name, last_name)
        `)
        .eq('company_id', company.id)
        .order('transaction_date', { ascending: false })
        .limit(100);

      if (error) throw error;

      const formattedTransactions: InventoryTransaction[] = data?.map((transaction: any) => ({
        id: transaction.id,
        transaction_date: transaction.transaction_date,
        transaction_type: transaction.transaction_type,
        reference_number: transaction.reference_number || 'N/A',
        product_name: transaction.products?.name || 'Unknown Product',
        product_sku: transaction.products?.sku || 'N/A',
        warehouse_name: transaction.warehouse_bins?.warehouse_name || transaction.bin_info?.warehouse_name || 'N/A',
        bin_name: transaction.warehouse_bins?.bin_name || transaction.bin_info?.bin_name || 'N/A',
        quantity_change: transaction.quantity_change || 0,
        unit_cost: transaction.unit_cost || 0,
        total_value: transaction.total_value || 0,
        notes: transaction.notes || '',
        created_by_name: transaction.profiles 
          ? `${transaction.profiles.first_name || ''} ${transaction.profiles.last_name || ''}`.trim() || 'System'
          : 'System'
      })) || [];

      setTransactions(formattedTransactions);
    } catch (error) {
      console.error('Error fetching inventory transactions:', error);
      toast({
        title: "Error",
        description: "Failed to fetch inventory transactions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getTransactionTypeBadge = (type: string) => {
    const typeConfig = {
      'purchase_receipt': { label: 'Purchase Receipt', color: 'bg-green-100 text-green-800' },
      'sales_issue': { label: 'Sales Issue', color: 'bg-blue-100 text-blue-800' },
      'sales_return': { label: 'Sales Return', color: 'bg-purple-100 text-purple-800' },
      'sales_invoice': { label: 'Sales Invoice', color: 'bg-orange-100 text-orange-800' },
      'adjustment_positive': { label: 'Adjustment +', color: 'bg-green-100 text-green-800' },
      'adjustment_negative': { label: 'Adjustment -', color: 'bg-red-100 text-red-800' },
      'transfer_out': { label: 'Transfer Out', color: 'bg-yellow-100 text-yellow-800' },
      'transfer_in': { label: 'Transfer In', color: 'bg-indigo-100 text-indigo-800' },
    };

    const config = typeConfig[type as keyof typeof typeConfig] || { label: type, color: 'bg-gray-100 text-gray-800' };
    
    return (
      <Badge variant="outline" className={`${config.color} border-0 font-medium`}>
        {config.label}
      </Badge>
    );
  };

  // Handle sorting
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Get sort icon
  const getSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="w-4 h-4" />;
    }
    return sortConfig.direction === 'asc' ? 
      <ArrowUp className="w-4 h-4" /> : 
      <ArrowDown className="w-4 h-4" />;
  };

  const filteredAndSortedTransactions = useMemo(() => {
    let filtered = transactions.filter((transaction) => {
      const matchesSearch = 
        transaction.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.product_sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.reference_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.warehouse_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.bin_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.created_by_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.transaction_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.notes?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesType = typeFilter === 'all' || transaction.transaction_type === typeFilter;
      
      return matchesSearch && matchesType;
    });

    if (sortConfig) {
      filtered.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortConfig.key) {
          case 'transaction_date':
            aValue = new Date(a.transaction_date);
            bValue = new Date(b.transaction_date);
            break;
          case 'product_name':
            aValue = a.product_name;
            bValue = b.product_name;
            break;
          case 'quantity_change':
            aValue = a.quantity_change;
            bValue = b.quantity_change;
            break;
          case 'total_value':
            aValue = a.total_value;
            bValue = b.total_value;
            break;
          default:
            aValue = a[sortConfig.key as keyof InventoryTransaction];
            bValue = b[sortConfig.key as keyof InventoryTransaction];
        }
        
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return filtered;
  }, [transactions, searchTerm, typeFilter, sortConfig]);

  // Enhanced export functionality
  const handleExportToExcel = () => {
    const columns: ExportColumn[] = [
      { key: 'transaction_date', label: 'Date', format: formatDateTime },
      { key: 'transaction_type', label: 'Transaction Type' },
      { key: 'reference_number', label: 'Reference Number' },
      { key: 'product_name', label: 'Product Name' },
      { key: 'product_sku', label: 'SKU' },
      { key: 'warehouse_name', label: 'Warehouse' },
      { key: 'bin_name', label: 'Bin Location' },
      { key: 'quantity_change', label: 'Quantity Change' },
      { key: 'unit_cost', label: 'Unit Cost', format: formatCurrency },
      { key: 'total_value', label: 'Total Value', format: formatCurrency },
      { key: 'created_by_name', label: 'Created By' },
      { key: 'notes', label: 'Notes' },
    ];

    const success = exportToExcel({
      filename: 'inventory_transactions',
      sheetName: 'Inventory Transactions',
      columns,
      data: filteredAndSortedTransactions,
      companyName: company?.name || 'Company',
    });

    if (success) {
      toast({
        title: "Export Successful",
        description: "Inventory transactions exported to Excel",
      });
    } else {
      toast({
        title: "Export Failed",
        description: "Failed to export data to Excel",
        variant: "destructive",
      });
    }
  };

  const totalPages = Math.ceil(filteredAndSortedTransactions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentTransactions = filteredAndSortedTransactions.slice(startIndex, endIndex);

  if (loading) {
    return <div className="flex justify-center items-center p-8">Loading inventory transactions...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Enhanced Filters and Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search by product, SKU, reference number, warehouse, type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-background/50 border-border/50 focus:bg-background"
          />
        </div>
        
        <div className="flex gap-2 items-center">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-48 bg-background/50 border-border/50">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="purchase_receipt">Purchase Receipt</SelectItem>
              <SelectItem value="sales_issue">Sales Issue</SelectItem>
              <SelectItem value="sales_return">Sales Return</SelectItem>
              <SelectItem value="sales_invoice">Sales Invoice</SelectItem>
              <SelectItem value="adjustment_positive">Adjustment +</SelectItem>
              <SelectItem value="adjustment_negative">Adjustment -</SelectItem>
              <SelectItem value="transfer_out">Transfer Out</SelectItem>
              <SelectItem value="transfer_in">Transfer In</SelectItem>
            </SelectContent>
          </Select>
          
          <Button
            onClick={handleExportToExcel}
            variant="outline"
            className="flex items-center gap-2 bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Transaction Table */}
      {filteredAndSortedTransactions.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {searchTerm || typeFilter !== 'all' ? 'No transactions match your filters.' : 'No inventory transactions found.'}
        </div>
      ) : (
        <>
          <div className="rounded-md border bg-background/50">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('transaction_date')}>
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold">Date</span>
                      {getSortIcon('transaction_date')}
                    </div>
                  </TableHead>
                  <TableHead className="font-semibold">Type</TableHead>
                  <TableHead className="font-semibold">Reference</TableHead>
                  <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('product_name')}>
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold">Product</span>
                      {getSortIcon('product_name')}
                    </div>
                  </TableHead>
                  <TableHead className="font-semibold">Location</TableHead>
                  <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort('quantity_change')}>
                    <div className="flex items-center justify-end space-x-2">
                      <span className="font-semibold">Qty Change</span>
                      {getSortIcon('quantity_change')}
                    </div>
                  </TableHead>
                  <TableHead className="text-right font-semibold">Unit Cost</TableHead>
                  <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort('total_value')}>
                    <div className="flex items-center justify-end space-x-2">
                      <span className="font-semibold">Total Value</span>
                      {getSortIcon('total_value')}
                    </div>
                  </TableHead>
                  <TableHead className="font-semibold">Created By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentTransactions.map((transaction) => (
                <TableRow key={transaction.id} className="hover:bg-muted/20">
                  <TableCell className="font-medium">
                    {format(new Date(transaction.transaction_date), 'MMM dd, yyyy HH:mm')}
                  </TableCell>
                  <TableCell>
                    {getTransactionTypeBadge(transaction.transaction_type)}
                  </TableCell>
                  <TableCell className="font-mono text-sm bg-muted/20 rounded px-2 py-1">
                    {transaction.reference_number}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{transaction.product_name}</div>
                      <div className="text-sm text-muted-foreground font-mono">{transaction.product_sku}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{transaction.warehouse_name}</div>
                      <div className="text-sm text-muted-foreground">{transaction.bin_name}</div>
                    </div>
                  </TableCell>
                  <TableCell className={`text-right font-mono font-semibold ${
                    transaction.quantity_change > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {transaction.quantity_change > 0 ? '+' : ''}{transaction.quantity_change}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    ₹{transaction.unit_cost.toFixed(2)}
                  </TableCell>
                  <TableCell className={`text-right font-mono font-semibold ${
                    transaction.total_value > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    ₹{transaction.total_value.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {transaction.created_by_name}
                    </div>
                  </TableCell>
                </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredAndSortedTransactions.length)} of {filteredAndSortedTransactions.length} transactions
              </p>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>
                <span className="text-sm">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};