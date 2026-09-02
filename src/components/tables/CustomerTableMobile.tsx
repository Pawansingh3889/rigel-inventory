import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Edit, Trash2, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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

interface CustomerTableMobileProps {
  customers: Customer[];
  onEdit: (customer: Customer) => void;
  onDelete: (customer: Customer) => void;
  loading?: boolean;
}

export const CustomerTableMobile: React.FC<CustomerTableMobileProps> = ({
  customers,
  onEdit,
  onDelete,
  loading = false
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const itemsPerPage = 5;

  // Filter customers based on search term
  const filteredCustomers = customers.filter(customer => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (customer.name?.toLowerCase() ?? '').includes(searchLower) ||
      (customer.customer_ref?.toLowerCase() ?? '').includes(searchLower) ||
      (customer.email?.toLowerCase() ?? '').includes(searchLower) ||
      (customer.phone?.toLowerCase() ?? '').includes(searchLower) ||
      (customer.city?.toLowerCase() ?? '').includes(searchLower) ||
      (customer.state?.toLowerCase() ?? '').includes(searchLower)
    );
  });

  // Paginate filtered customers
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedCustomers = filteredCustomers.slice(startIndex, startIndex + itemsPerPage);

  const toggleExpanded = (customerId: string) => {
    const newExpandedCards = new Set(expandedCards);
    if (newExpandedCards.has(customerId)) {
      newExpandedCards.delete(customerId);
    } else {
      newExpandedCards.add(customerId);
    }
    setExpandedCards(newExpandedCards);
  };

  return (
    <div className="space-y-4">
      {/* Search Header */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Customers</CardTitle>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-10 min-h-[44px]"
            />
          </div>
        </CardHeader>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <div className="text-muted-foreground">Loading customers...</div>
        </div>
      ) : paginatedCustomers.length === 0 ? (
        <Card>
          <CardContent className="text-center p-8">
            <div className="text-muted-foreground">
              {searchTerm ? 'No customers found matching your search.' : 'No customers yet.'}
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Customer Cards */}
          <div className="space-y-3">
            {paginatedCustomers.map((customer) => {
              const isExpanded = expandedCards.has(customer.id);
              return (
                <Card key={customer.id} className="transition-all duration-200">
                  <CardContent className="p-4">
                    {/* Main Info - Always Visible */}
                    <div className="mobile-card-header">
                      <div className="mobile-card-content">
                        <h3 className="mobile-card-title">{customer.name}</h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant="outline" className="text-xs truncate">{customer.customer_ref}</Badge>
                          <Badge variant={customer.is_active ? "default" : "secondary"} className="text-xs">
                            {customer.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </div>
                      <div className="mobile-card-actions">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(customer)}
                          className="mobile-touch-target p-2"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(customer)}
                          className="mobile-touch-target p-2 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Key Contact Info - Always Visible */}
                    <div className="space-y-1 text-sm">
                      {customer.email && (
                        <div className="text-muted-foreground truncate">{customer.email}</div>
                      )}
                      {customer.phone && (
                        <div className="text-muted-foreground truncate">{customer.phone}</div>
                      )}
                    </div>

                    {/* Expandable Details */}
                    <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(customer.id)}>
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full mt-3 justify-center text-xs text-muted-foreground min-h-[36px]"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="h-3 w-3 mr-1" />
                              Less Details
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-3 w-3 mr-1" />
                              More Details
                            </>
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-2 pt-2 border-t mt-2">
                        <div className="text-sm space-y-1">
                          <div className="mobile-detail-row">
                            <span className="mobile-detail-label">Location:</span>
                            <span className="mobile-detail-value">{customer.city}, {customer.state}</span>
                          </div>
                          <div className="mobile-detail-row">
                            <span className="mobile-detail-label">Created:</span>
                            <span className="mobile-detail-value">{new Date(customer.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col space-y-3">
                  <div className="text-sm text-muted-foreground text-center">
                    Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredCustomers.length)} of {filteredCustomers.length} entries
                  </div>
                  <div className="flex justify-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => prev - 1)}
                      disabled={currentPage === 1}
                      className="min-h-[44px]"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    <div className="flex items-center space-x-1">
                      {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                        let page = i + 1;
                        if (totalPages > 5) {
                          if (currentPage <= 3) {
                            page = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            page = totalPages - 4 + i;
                          } else {
                            page = currentPage - 2 + i;
                          }
                        }
                        return (
                          <Button
                            key={page}
                            variant={currentPage === page ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                            className="min-w-[44px] min-h-[44px] p-0"
                          >
                            {page}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => prev + 1)}
                      disabled={currentPage === totalPages}
                      className="min-h-[44px]"
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};