
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Edit, Trash2, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useIsMobile } from '@/hooks/use-mobile';
import { CustomerTableMobile } from './CustomerTableMobile';

interface Customer {
  id: string;
  name: string;
  customer_ref: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  is_active: boolean;
  created_at: string;
}

interface CustomerTableProps {
  customers: Customer[];
  onEdit: (customer: Customer) => void;
  onDelete: (customer: Customer) => void;
  loading?: boolean;
}

type SortField = 'name' | 'customer_ref' | 'city' | 'state' | 'created_at';
type SortDirection = 'asc' | 'desc';

export const CustomerTable: React.FC<CustomerTableProps> = ({
  customers,
  onEdit,
  onDelete,
  loading = false
}) => {
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const itemsPerPage = 5;

  // Use mobile component on small screens
  if (isMobile) {
    return (
      <CustomerTableMobile
        customers={customers}
        onEdit={onEdit}
        onDelete={onDelete}
        loading={loading}
      />
    );
  }

  // Filter customers based on search term
  const filteredCustomers = customers.filter(customer => {
    const searchLower = searchTerm.toLowerCase();
    return (
      customer.name.toLowerCase().includes(searchLower) ||
      customer.customer_ref.toLowerCase().includes(searchLower) ||
      (customer.email && customer.email.toLowerCase().includes(searchLower)) ||
      (customer.phone && customer.phone.toLowerCase().includes(searchLower)) ||
      (customer.city && customer.city.toLowerCase().includes(searchLower)) ||
      (customer.state && customer.state.toLowerCase().includes(searchLower))
    );
  });

  // Sort filtered customers
  const sortedCustomers = [...filteredCustomers].sort((a, b) => {
    let aValue: any, bValue: any;

    switch (sortField) {
      case 'name':
        aValue = a.name;
        bValue = b.name;
        break;
      case 'customer_ref':
        aValue = a.customer_ref;
        bValue = b.customer_ref;
        break;
      case 'city':
        aValue = a.city || '';
        bValue = b.city || '';
        break;
      case 'state':
        aValue = a.state || '';
        bValue = b.state || '';
        break;
      case 'created_at':
        aValue = new Date(a.created_at);
        bValue = new Date(b.created_at);
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Paginate sorted customers
  const totalPages = Math.ceil(sortedCustomers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedCustomers = sortedCustomers.slice(startIndex, startIndex + itemsPerPage);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4" />;
    return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Customers</CardTitle>
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search customers..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1); // Reset to first page when searching
                }}
                className="pl-10 w-80"
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="text-muted-foreground">Loading customers...</div>
          </div>
        ) : paginatedCustomers.length === 0 ? (
          <div className="text-center p-8">
            <div className="text-muted-foreground">
              {searchTerm ? 'No customers found matching your search.' : 'No customers yet.'}
            </div>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Name</span>
                      {getSortIcon('name')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('customer_ref')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Reference</span>
                      {getSortIcon('customer_ref')}
                    </div>
                  </TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('city')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Location</span>
                      {getSortIcon('city')}
                    </div>
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedCustomers.map((customer) => (
                  <TableRow key={customer.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">
                      {customer.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{customer.customer_ref}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm">{customer.email}</div>
                        <div className="text-sm text-muted-foreground">{customer.phone}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm">{customer.city}</div>
                        <div className="text-sm text-muted-foreground">{customer.state}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={customer.is_active ? "default" : "secondary"}>
                        {customer.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(customer)}
                          title="Edit"
                          className="min-h-[44px] min-w-[44px]"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(customer)}
                          title="Delete"
                          className="text-destructive hover:text-destructive min-h-[44px] min-w-[44px]"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, sortedCustomers.length)} of {sortedCustomers.length} entries
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => prev - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <div className="flex items-center space-x-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className="w-8 h-8 p-0"
                      >
                        {page}
                      </Button>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
