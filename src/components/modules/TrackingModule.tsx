import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessAuth } from '@/hooks/useBusinessAuth';
import { Search, MapPin, Truck, Package, CheckCircle } from 'lucide-react';
import { TableSkeleton, StatsSkeleton } from '@/components/ui/loading-skeleton';
import { EmptyState } from '@/components/ui/empty-state';

interface TrackableOrder {
  id: string;
  order_number: string;
  type: 'sales' | 'purchase';
  status: string;
  order_date: string;
  expected_date?: string | null;
  delivery_date?: string | null;
  customer_name?: string;
  supplier_name?: string;
  total_amount: number;
}

export function TrackingModule() {
  const { hasAccess } = useBusinessAuth();
  const [orders, setOrders] = useState<TrackableOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const fetchTrackableOrders = async () => {
    try {
      // Fetch sales orders
      const { data: salesOrders, error: salesError } = await supabase
        .from('sales_orders')
        .select(`
          id,
          order_number,
          status,
          order_date,
          delivery_date,
          total_amount,
          customer:customers(name)
        `)
        .in('status', ['confirmed', 'shipped'])
        .order('order_date', { ascending: false });

      if (salesError) {
        console.error('Error fetching sales orders:', salesError);
      }

      // Fetch purchase orders
      const { data: purchaseOrders, error: purchaseError } = await supabase
        .from('purchase_orders')
        .select(`
          id,
          po_number,
          status,
          order_date,
          expected_date,
          total_amount,
          supplier:suppliers(name)
        `)
        .in('status', ['sent', 'confirmed'])
        .order('order_date', { ascending: false });

      if (purchaseError) {
        console.error('Error fetching purchase orders:', purchaseError);
      }

      // Combine and format orders
      const allOrders: TrackableOrder[] = [
        ...(salesOrders || []).map(order => ({
          id: order.id,
          order_number: order.order_number,
          type: 'sales' as const,
          status: order.status,
          order_date: order.order_date,
          delivery_date: order.delivery_date,
          customer_name: order.customer?.name,
          total_amount: order.total_amount,
        })),
        ...(purchaseOrders || []).map(order => ({
          id: order.id,
          order_number: order.po_number,
          type: 'purchase' as const,
          status: order.status,
          order_date: order.order_date,
          expected_date: order.expected_date,
          supplier_name: order.supplier?.name,
          total_amount: order.total_amount,
        })),
      ];

      setOrders(allOrders);
    } catch (error) {
      console.error('Error fetching trackable orders:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasAccess('tracking')) {
      fetchTrackableOrders();
    } else {
      setLoading(false);
    }
  }, [hasAccess]);

  if (!hasAccess('tracking')) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-muted-foreground mb-2">Access Denied</h2>
          <p className="text-muted-foreground">You don't have permission to view tracking.</p>
        </div>
      </div>
    );
  }

  const getStatusIcon = (status: string, type: string) => {
    if (type === 'sales') {
      switch (status) {
        case 'confirmed': return <Package className="h-4 w-4 text-blue-600" />;
        case 'shipped': return <Truck className="h-4 w-4 text-orange-600" />;
        case 'delivered': return <CheckCircle className="h-4 w-4 text-green-600" />;
        default: return <MapPin className="h-4 w-4 text-gray-600" />;
      }
    } else {
      switch (status) {
        case 'sent': return <Package className="h-4 w-4 text-blue-600" />;
        case 'confirmed': return <Truck className="h-4 w-4 text-orange-600" />;
        case 'received': return <CheckCircle className="h-4 w-4 text-green-600" />;
        default: return <MapPin className="h-4 w-4 text-gray-600" />;
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
      case 'sent': return 'default';
      case 'shipped': return 'default';
      case 'delivered':
      case 'received': return 'default';
      default: return 'secondary';
    }
  };

  const getTrackingSteps = (order: TrackableOrder) => {
    if (order.type === 'sales') {
      return [
        { name: 'Order Confirmed', completed: ['confirmed', 'shipped', 'delivered'].includes(order.status) },
        { name: 'Order Shipped', completed: ['shipped', 'delivered'].includes(order.status) },
        { name: 'Order Delivered', completed: order.status === 'delivered' },
      ];
    } else {
      return [
        { name: 'Order Sent', completed: ['sent', 'confirmed', 'received'].includes(order.status) },
        { name: 'Order Confirmed', completed: ['confirmed', 'received'].includes(order.status) },
        { name: 'Order Received', completed: order.status === 'received' },
      ];
    }
  };

  const filteredOrders = orders.filter(order =>
    order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Transit</CardTitle>
            <Truck className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {orders.filter(o => ['shipped', 'confirmed'].includes(o.status)).length}
            </div>
            <p className="text-xs text-muted-foreground">Orders being processed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Shipment</CardTitle>
            <Package className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {orders.filter(o => ['confirmed', 'sent'].includes(o.status)).length}
            </div>
            <p className="text-xs text-muted-foreground">Awaiting dispatch</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivered</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {orders.filter(o => ['delivered', 'received'].includes(o.status)).length}
            </div>
            <p className="text-xs text-muted-foreground">Successfully completed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orders.length}</div>
            <p className="text-xs text-muted-foreground">Being tracked</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search orders to track..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {filteredOrders.map((order) => (
          <Card key={order.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {getStatusIcon(order.status, order.type)}
                  <div>
                    <CardTitle className="text-lg">{order.order_number}</CardTitle>
                    <CardDescription>
                      {order.type === 'sales' ? `Customer: ${order.customer_name}` : `Supplier: ${order.supplier_name}`}
                      {' • '}
                      ${order.total_amount.toFixed(2)}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={getStatusColor(order.status)}>
                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                  </Badge>
                  <Badge variant="outline">
                    {order.type === 'sales' ? 'Sales' : 'Purchase'}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-muted-foreground">
                  Order Date: {new Date(order.order_date).toLocaleDateString()}
                </span>
                {(order.expected_date || order.delivery_date) && (
                  <span className="text-sm text-muted-foreground">
                    {order.type === 'sales' ? 'Delivery' : 'Expected'}: {' '}
                    {new Date(order.expected_date || order.delivery_date!).toLocaleDateString()}
                  </span>
                )}
              </div>
              
              {/* Progress Tracker */}
              <div className="flex items-center justify-between">
                {getTrackingSteps(order).map((step, index) => (
                  <div key={index} className="flex flex-col items-center flex-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                      step.completed 
                        ? 'bg-green-100 text-green-800 border-2 border-green-500' 
                        : 'bg-gray-100 text-gray-500 border-2 border-gray-300'
                    }`}>
                      {step.completed ? '✓' : index + 1}
                    </div>
                    <span className={`text-xs mt-2 text-center ${
                      step.completed ? 'text-green-700' : 'text-gray-500'
                    }`}>
                      {step.name}
                    </span>
                    {index < getTrackingSteps(order).length - 1 && (
                      <div className={`absolute h-0.5 w-full top-4 ${
                        step.completed ? 'bg-green-500' : 'bg-gray-300'
                      }`} style={{ left: '50%', width: 'calc(100% - 2rem)', zIndex: -1 }} />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
        
        {filteredOrders.length === 0 && (
          <Card>
            <CardContent className="p-0">
              <EmptyState
                icon={MapPin}
                title="No orders to track"
                description="Orders will appear here once they are confirmed or shipped."
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}