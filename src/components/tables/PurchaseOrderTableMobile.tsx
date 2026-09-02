import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Eye, 
  Edit, 
  Trash2, 
  ChevronDown, 
  ChevronRight,
  Search,
  Calendar,
  DollarSign,
  Building2
} from 'lucide-react';

interface PurchaseOrder {
  id: string;
  po_number: string;
  status: string;
  order_date: string;
  expected_date?: string;
  total_amount: number;
  currency: string;
  supplier: {
    name: string;
  };
  created_at: string;
  notes?: string;
}

interface PurchaseOrderTableMobileProps {
  purchaseOrders: PurchaseOrder[];
  onView: (po: PurchaseOrder) => void;
  onEdit: (po: PurchaseOrder) => void;
  onDelete: (poId: string) => void;
  loading?: boolean;
}

export function PurchaseOrderTableMobile({
  purchaseOrders,
  onView,
  onEdit,
  onDelete,
  loading = false
}: PurchaseOrderTableMobileProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  
  const itemsPerPage = 10;

  // Filter purchase orders based on search term
  const filteredOrders = purchaseOrders.filter(order =>
    (order.po_number?.toLowerCase() ?? '').includes(searchTerm.toLowerCase()) ||
    (order.supplier?.name?.toLowerCase() ?? '').includes(searchTerm.toLowerCase()) ||
    (order.status?.toLowerCase() ?? '').includes(searchTerm.toLowerCase())
  );

  // Pagination
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentOrders = filteredOrders.slice(startIndex, startIndex + itemsPerPage);

  const toggleCard = (orderId: string) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);
    }
    setExpandedCards(newExpanded);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'draft':
        return 'bg-muted text-muted-foreground';
      case 'open':
        return 'bg-primary/10 text-primary';
      case 'confirmed':
        return 'bg-success/10 text-success';
      case 'partially_received':
        return 'bg-warning/10 text-warning';
      case 'closed':
        return 'bg-secondary/10 text-secondary';
      case 'cancelled':
        return 'bg-destructive/10 text-destructive';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <div className="h-4 bg-muted rounded w-24"></div>
                    <div className="h-3 bg-muted rounded w-32"></div>
                  </div>
                  <div className="h-6 bg-muted rounded w-16"></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="h-3 bg-muted rounded w-16"></div>
                    <div className="h-4 bg-muted rounded w-20"></div>
                  </div>
                  <div className="space-y-1">
                    <div className="h-3 bg-muted rounded w-16"></div>
                    <div className="h-4 bg-muted rounded w-24"></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search purchase orders..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setCurrentPage(1);
          }}
          className="pl-10"
        />
      </div>

      {/* Results Info */}
      <div className="flex justify-between items-center text-sm text-muted-foreground px-1">
        <span>{currentOrders.length} of {filteredOrders.length} orders</span>
        {totalPages > 1 && (
          <span>Page {currentPage} of {totalPages}</span>
        )}
      </div>

      {/* Orders List */}
      <div className="space-y-3">
        {currentOrders.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-muted-foreground">
                {searchTerm ? 'No purchase orders found matching your search.' : 'No purchase orders found.'}
              </div>
            </CardContent>
          </Card>
        ) : (
          currentOrders.map((order) => {
            const isExpanded = expandedCards.has(order.id);
            return (
              <Card key={order.id} className="card-interactive">
                <Collapsible>
                  <CollapsibleTrigger
                    onClick={() => toggleCard(order.id)}
                    className="w-full"
                  >
                    <CardHeader className="pb-3">
                      <div className="mobile-card-header">
                        <div className="mobile-card-content">
                          <div className="mobile-card-title">
                            {order.po_number}
                          </div>
                          <div className="mobile-card-subtitle flex items-center gap-1">
                            <Building2 className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{order.supplier.name}</span>
                          </div>
                        </div>
                        <div className="mobile-card-actions">
                          <Badge className={`${getStatusColor(order.status)} text-xs`}>
                            {order.status.replace('_', ' ').toUpperCase()}
                          </Badge>
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm mt-3">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>{new Date(order.order_date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-1 font-medium">
                          <DollarSign className="h-3 w-3" />
                          <span>{formatCurrency(order.total_amount, order.currency)}</span>
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <div className="space-y-3 mb-4">
                        {order.expected_date && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground text-sm">Expected Date:</span>
                            <span className="text-sm">{new Date(order.expected_date).toLocaleDateString()}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-muted-foreground text-sm">Currency:</span>
                          <span className="text-sm">{order.currency}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground text-sm">Created:</span>
                          <span className="text-sm">{new Date(order.created_at).toLocaleDateString()}</span>
                        </div>
                        {order.notes && (
                          <div className="space-y-1">
                            <span className="text-muted-foreground text-sm">Notes:</span>
                            <p className="text-sm bg-muted p-2 rounded">{order.notes}</p>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onView(order);
                          }}
                          className="flex-1"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(order);
                          }}
                          className="flex-1"
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Are you sure you want to delete this purchase order?')) {
                              onDelete(order.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNumber = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
              return (
                <Button
                  key={pageNumber}
                  variant={currentPage === pageNumber ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(pageNumber)}
                  className="min-w-[40px]"
                >
                  {pageNumber}
                </Button>
              );
            })}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}