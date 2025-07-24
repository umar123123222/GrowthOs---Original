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
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

const ShopifyDashboard = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [shopifyData, setShopifyData] = useState({
    storeUrl: '',
    totalSales: 0,
    visitors: 0,
    averageOrderValue: 0,
    conversionRate: 0,
    topProducts: [],
    salesTrend: [],
    visitorTrend: [],
    orderCount: 0,
    lastUpdated: null
  });
  const [connectionStatus, setConnectionStatus] = useState('checking');

  useEffect(() => {
    fetchShopifyData();
  }, []);

  const fetchShopifyData = async () => {
    setLoading(true);
    try {
      // Get store URL from user settings
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const storeUrl = user.shopify_store_url;
      
      if (!storeUrl) {
        setConnectionStatus('disconnected');
        setLoading(false);
        return;
      }

      // Mock API call to Shopify Storefront API (2025-07 version)
      // In production, this would go through your backend to make authenticated calls
      const shopifyApiUrl = `https://${storeUrl}/api/2025-07/graphql.json`;
      
      // Simulate API response with mock data
      const mockShopifyData = {
        storeUrl,
        totalSales: 45678.90,
        visitors: 2847,
        averageOrderValue: 89.45,
        conversionRate: 3.2,
        orderCount: 127,
        topProducts: [
          { id: 1, name: 'Premium Course Bundle', sales: 89, revenue: 5340 },
          { id: 2, name: 'Digital Marketing Guide', sales: 67, revenue: 2010 },
          { id: 3, name: 'Success Workbook', sales: 45, revenue: 1350 },
          { id: 4, name: 'Video Masterclass', sales: 34, revenue: 2040 },
          { id: 5, name: 'Growth Templates', sales: 23, revenue: 690 }
        ],
        salesTrend: [
          { date: '2025-07-17', sales: 1250 },
          { date: '2025-07-18', sales: 1680 },
          { date: '2025-07-19', sales: 2100 },
          { date: '2025-07-20', sales: 1890 },
          { date: '2025-07-21', sales: 2340 },
          { date: '2025-07-22', sales: 2890 },
          { date: '2025-07-23', sales: 3200 },
          { date: '2025-07-24', sales: 2750 }
        ],
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

      setShopifyData(mockShopifyData);
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
          <Button onClick={() => window.open('/profile', '_blank')}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Connect Shopify Store
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
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={shopifyData.salesTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <RechartsTooltip />
                  <Line 
                    type="monotone" 
                    dataKey="sales" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Visitor Trend (Last 7 Days)</CardTitle>
              <CardDescription>Daily visitor count</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={shopifyData.visitorTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <RechartsTooltip />
                  <Bar 
                    dataKey="visitors" 
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
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

        {/* Last Updated */}
        <div className="text-center text-sm text-muted-foreground">
          Last updated: {shopifyData.lastUpdated ? new Date(shopifyData.lastUpdated).toLocaleString() : 'Never'}
        </div>
      </div>
    </TooltipProvider>
  );
};

export default ShopifyDashboard;