import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Edit, Trash2, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Building2, MapPin } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface WarehouseBin {
  id: string;
  wh_bin_code: string;
  bin_name: string;
  warehouse_name?: string;
  warehouse_code?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  contact_person_name?: string;
  contact_person_phone?: string;
  contact_person_email?: string;
  is_active: boolean;
  is_default?: boolean;
  created_at: string;
  updated_at: string;
}

interface WarehouseBinTableMobileProps {
  refreshTrigger?: number;
  onEdit: (bin: WarehouseBin) => void;
  onDelete: (bin: WarehouseBin) => void;
}

export const WarehouseBinTableMobile: React.FC<WarehouseBinTableMobileProps> = ({
  refreshTrigger,
  onEdit,
  onDelete,
}) => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [bins, setBins] = useState<WarehouseBin[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const itemsPerPage = 5;

  useEffect(() => {
    fetchBins();

    // Set up real-time subscription
    const channel = supabase
      .channel('warehouse_bins_changes_mobile')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'warehouse_bins'
        },
        (payload) => {
          console.log('Warehouse bins change detected:', payload);
          fetchBins();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (refreshTrigger) {
      fetchBins();
    }
  }, [refreshTrigger]);

  const fetchBins = async () => {
    if (!profile?.company_id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('warehouse_bins')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching bins:', error);
        toast({
          title: "Error",
          description: "Failed to fetch warehouse bins",
          variant: "destructive",
        });
        return;
      }

      setBins(data || []);
    } catch (error) {
      console.error('Error fetching bins:', error);
      toast({
        title: "Error", 
        description: "Failed to fetch warehouse bins",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter bins based on search term
  const filteredBins = bins.filter(bin => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (bin.wh_bin_code?.toLowerCase() ?? '').includes(searchLower) ||
      (bin.bin_name?.toLowerCase() ?? '').includes(searchLower) ||
      (bin.warehouse_name?.toLowerCase() ?? '').includes(searchLower) ||
      (bin.warehouse_code?.toLowerCase() ?? '').includes(searchLower) ||
      (bin.city?.toLowerCase() ?? '').includes(searchLower)
    );
  });

  // Paginate filtered bins
  const totalPages = Math.ceil(filteredBins.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedBins = filteredBins.slice(startIndex, startIndex + itemsPerPage);

  const toggleExpanded = (binId: string) => {
    const newExpandedCards = new Set(expandedCards);
    if (newExpandedCards.has(binId)) {
      newExpandedCards.delete(binId);
    } else {
      newExpandedCards.add(binId);
    }
    setExpandedCards(newExpandedCards);
  };

  return (
    <div className="space-y-4">
      {/* Search Header */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Warehouse Bins
          </CardTitle>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search bins..."
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
          <div className="text-muted-foreground">Loading warehouse bins...</div>
        </div>
      ) : paginatedBins.length === 0 ? (
        <Card>
          <CardContent className="text-center p-8">
            <div className="text-muted-foreground">
              {searchTerm ? 'No warehouse bins found matching your search.' : 'No warehouse bins yet.'}
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Bin Cards */}
          <div className="space-y-3">
            {paginatedBins.map((bin) => {
              const isExpanded = expandedCards.has(bin.id);
              return (
                <Card key={bin.id} className="transition-all duration-200">
                  <CardContent className="p-4">
                    {/* Main Info - Always Visible */}
                    <div className="mobile-card-header">
                      <div className="mobile-card-content">
                        <h3 className="mobile-card-title">{bin.warehouse_name || 'Unnamed Warehouse'}</h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant="outline" className="text-xs truncate">{bin.wh_bin_code}</Badge>
                          <Badge variant={bin.is_active ? "default" : "secondary"} className="text-xs">
                            {bin.is_active ? "Active" : "Inactive"}
                          </Badge>
                          {bin.is_default && (
                            <Badge variant="secondary" className="text-xs">Default</Badge>
                          )}
                        </div>
                      </div>
                      <div className="mobile-card-actions">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(bin)}
                          className="mobile-touch-target p-2"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(bin)}
                          className="mobile-touch-target p-2 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Key Info - Always Visible */}
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <Building2 className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <span className="text-muted-foreground flex-shrink-0">BIN:</span>
                        <span className="font-medium truncate">{bin.bin_name}</span>
                      </div>
                      {bin.city && (
                        <div className="flex items-center gap-2 min-w-0">
                          <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span className="text-muted-foreground truncate">{bin.city}, {bin.state}</span>
                        </div>
                      )}
                    </div>

                    {/* Expandable Details */}
                    <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(bin.id)}>
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
                        <div className="text-sm space-y-2">
                          {bin.warehouse_code && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Warehouse Code:</span>
                              <span>{bin.warehouse_code}</span>
                            </div>
                          )}
                          {bin.address_line1 && (
                            <div className="mobile-detail-row">
                              <span className="mobile-detail-label">Address:</span>
                              <span className="mobile-detail-value">{bin.address_line1}</span>
                            </div>
                          )}
                          {bin.postal_code && (
                            <div className="mobile-detail-row">
                              <span className="mobile-detail-label">PIN Code:</span>
                              <span className="mobile-detail-value">{bin.postal_code}</span>
                            </div>
                          )}
                          {bin.contact_person_name && (
                            <div className="mobile-detail-row">
                              <span className="mobile-detail-label">Contact:</span>
                              <span className="mobile-detail-value">{bin.contact_person_name}</span>
                            </div>
                          )}
                          {bin.contact_person_phone && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Phone:</span>
                              <span>{bin.contact_person_phone}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Created:</span>
                            <span>{new Date(bin.created_at).toLocaleDateString()}</span>
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
                    Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredBins.length)} of {filteredBins.length} entries
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