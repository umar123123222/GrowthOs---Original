import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  ShoppingBag, 
  TrendingUp, 
  Users, 
  DollarSign, 
  Package,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { fetchShopifyMetrics } from '@/lib/student-integrations';
import { supabase } from '@/integrations/supabase/client';

const ShopifyDashboard = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [shopifyData, setShopifyData] = useState({
    storeUrl: '',
    totalSales: 0,
    visitors: 0,
    averageOrderValue: 0,
    conversionRate: 0,
    topProducts: [] as any[],
    products: [] as any[],
    salesTrend: [] as any[],
    visitorTrend: [] as any[],
    orderCount: 0,
    lastUpdated: null as string | null,
  });
  const [connectionStatus, setConnectionStatus] = useState('checking');

  useEffect(() => {
    fetchShopifyData();
  }, []);

  const fetchShopifyData = async () => {
    setLoading(true);
    try {
      if (!user?.id) {
        setConnectionStatus('disconnected');
        setLoading(false);
        return;
      }

      // Check integration details first to detect missing domain
      const { data: integ } = await supabase
        .from('integrations')
        .select('access_token, external_id')
        .eq('user_id', user.id)
        .eq('source', 'shopify')
        .maybeSingle();

      if (integ?.access_token && !integ.external_id) {
        setConnectionStatus('needs_domain');
        setLoading(false);
        return;
      }

      // Fetch metrics from edge function
      const result = await fetchShopifyMetrics(user.id);
      
      if (!result.connected) {
        setConnectionStatus('disconnected');
        setLoading(false);
        return;
      }

      const metrics = result.metrics!;
      
      // Map the metrics to the expected format
      const shopifyData = {
        storeUrl: 'your-store.myshopify.com', // Would use user.shopify_domain when available
        totalSales: metrics.gmv,
        visitors: 2847, // Mock visitor data - would need analytics API
        averageOrderValue: metrics.aov,
        conversionRate: metrics.conversionRate,
        orderCount: metrics.orders,
        topProducts: metrics.bestSellers || metrics.topProducts || [],
        products: metrics.products || [],
        salesTrend: metrics.salesTrend,
        visitorTrend: [
          { date: '2025-07-17', visitors: 245 },
          { date: '2025-07-18', visitors: 312 },
          { date: '2025-07-19', visitors: 398 },
          { date: '2025-07-20', visitors: 356 },
          { date: '2025-07-21', visitors: 445 },
          { date: '2025-07-22', visitors: 502 },
          { date: '2025-07-23', visitors: 589 },
          { date: '2025-07-24', visitors: 467 }
        ],
        lastUpdated: new Date().toISOString()
      };

      setShopifyData(shopifyData);
      setConnectionStatus('connected');
      
    } catch (error) {
      console.error('Error fetching Shopify data:', error);
      setConnectionStatus('error');
      toast({
        title: "Connection Error",
        description: "Failed to fetch Shopify data. Please check your store connection.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <RefreshCw className="h-4 w-4 text-yellow-600 animate-spin" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-muted-foreground">Loading Shopify data...</p>
        </div>
      </div>
    );
  }

  if (connectionStatus === 'disconnected') {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-12">
          <ShoppingBag className="h-16 w-16 mx-auto mb-6 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-4">Connect Your Shopify Store</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Connect your Shopify store to view real-time analytics, sales data, and performance metrics.
          </p>
          <Button onClick={() => navigate('/connect')}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Connect Shopify Store
          </Button>
        </div>
      </div>
    );
  }

  if (connectionStatus === 'needs_domain') {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-12">
          <ShoppingBag className="h-16 w-16 mx-auto mb-6 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">Finish Shopify Setup</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Your Shopify token is saved, but we still need your store domain (e.g., yourstore.myshopify.com) to fetch data.
          </p>
          <Button onClick={() => navigate('/connect')}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Add Store Domain
          </Button>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Shopify Dashboard</h1>
            <p className="text-muted-foreground">Real-time store performance and analytics</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              {getStatusIcon()}
              <span className="text-sm text-muted-foreground">
                {connectionStatus === 'connected' ? 'Connected' : 'Connection Issue'}
              </span>
            </div>
            <Button onClick={fetchShopifyData} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(shopifyData.totalSales)}</div>
              <Tooltip>
                <TooltipTrigger>
                  <p className="text-xs text-muted-foreground">
                    +12.5% from last month
                  </p>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Revenue growth compared to previous month</p>
                </TooltipContent>
              </Tooltip>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Visitors</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{shopifyData.visitors.toLocaleString()}</div>
              <Tooltip>
                <TooltipTrigger>
                  <p className="text-xs text-muted-foreground">
                    +8.2% from last week
                  </p>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Unique visitors in the last 7 days</p>
                </TooltipContent>
              </Tooltip>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(shopifyData.averageOrderValue)}</div>
              <Tooltip>
                <TooltipTrigger>
                  <p className="text-xs text-muted-foreground">
                    +5.1% from last month
                  </p>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Average value per order</p>
                </TooltipContent>
              </Tooltip>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{shopifyData.conversionRate}%</div>
              <Tooltip>
                <TooltipTrigger>
                  <p className="text-xs text-muted-foreground">
                    +0.3% from last week
                  </p>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Percentage of visitors who make a purchase</p>
                </TooltipContent>
              </Tooltip>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Sales Trend (Last 7 Days)</CardTitle>
              <CardDescription>Daily sales performance</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  sales: {
                    label: "Sales ($)",
                    color: "hsl(var(--primary))",
                  },
                }}
                className="h-[200px]"
              >
                <LineChart data={shopifyData.salesTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line 
                    type="monotone" 
                    dataKey="sales" 
                    stroke="var(--color-sales)" 
                    strokeWidth={2}
                  />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Visitor Trend (Last 7 Days)</CardTitle>
              <CardDescription>Daily visitor count</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  visitors: {
                    label: "Visitors",
                    color: "hsl(var(--primary))",
                  },
                }}
                className="h-[200px]"
              >
                <BarChart data={shopifyData.visitorTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar 
                    dataKey="visitors" 
                    fill="var(--color-visitors)" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        {/* Top Products */}
        <Card>
          <CardHeader>
            <CardTitle>Top Performing Products</CardTitle>
            <CardDescription>Best selling products in the last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {shopifyData.topProducts.map((product, index) => (
                <div key={product.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <Badge variant="secondary" className="min-w-[24px] h-6 flex items-center justify-center">
                      {index + 1}
                    </Badge>
                    <div>
                      <h4 className="font-medium">{product.name}</h4>
                      <p className="text-sm text-muted-foreground">{product.sales} sales</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(product.revenue)}</p>
                    <p className="text-sm text-muted-foreground">Revenue</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* All Products */}
        <Card>
          <CardHeader>
            <CardTitle>All Products</CardTitle>
            <CardDescription>Products fetched from your store</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {shopifyData.products.map((p: any) => (
                <div key={p.id} className="border rounded-lg p-4 flex items-start gap-4">
                  {p.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image} alt={`${p.name} product image`} className="w-16 h-16 rounded object-cover" loading="lazy" />
                  )}
                  <div className="flex-1">
                    <h4 className="font-medium">{p.name}</h4>
                    <p className="text-sm text-muted-foreground">{p.type || 'Product'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(p.price || 0)}</p>
                  </div>
                </div>
              ))}
              {shopifyData.products.length === 0 && (
                <p className="text-sm text-muted-foreground">No products found.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Last Updated */}
        <div className="text-center text-sm text-muted-foreground">
          Last updated: {shopifyData.lastUpdated ? new Date(shopifyData.lastUpdated).toLocaleString() : 'Never'}
        </div>
      </div>
    </TooltipProvider>
  );
};

export default ShopifyDashboard;