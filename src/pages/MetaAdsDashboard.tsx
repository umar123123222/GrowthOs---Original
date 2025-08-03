import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { 
  Target, 
  TrendingUp, 
  Eye, 
  MousePointer,
  DollarSign,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  ArrowUp,
  ArrowDown,
  Minus
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';

const MetaAdsDashboard = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [metaData, setMetaData] = useState({
    campaigns: [],
    adSets: [],
    ads: [],
    totalSpend: 0,
    totalImpressions: 0,
    totalClicks: 0,
    totalConversions: 0,
    averageCTR: 0,
    averageCPC: 0,
    lastUpdated: null
  });
  const [connectionStatus, setConnectionStatus] = useState('checking');

  useEffect(() => {
    fetchMetaAdsData();
  }, []);

  const fetchMetaAdsData = async () => {
    setLoading(true);
    try {
      // Check if user has Meta Ads credentials
      if (!user?.encrypted_meta_ads_credentials) {
        setConnectionStatus('disconnected');
        setLoading(false);
        return;
      }

      // Mock API call to Meta Marketing API
      // In production, this would go through your backend to make authenticated calls
      const mockMetaData = {
        campaigns: [
          {
            id: 1,
            name: 'Growth Course Promotion',
            status: 'Active',
            budget: 500,
            spend: 387.45,
            impressions: 45678,
            clicks: 1234,
            conversions: 67,
            ctr: 2.7,
            cpc: 0.31,
            conversionRate: 5.4,
            performance: 'good' // good, average, poor
          },
          {
            id: 2,
            name: 'Retargeting Campaign',
            status: 'Active',
            budget: 300,
            spend: 245.80,
            impressions: 23456,
            clicks: 890,
            conversions: 45,
            ctr: 3.8,
            cpc: 0.28,
            conversionRate: 5.1,
            performance: 'excellent'
          },
          {
            id: 3,
            name: 'Brand Awareness',
            status: 'Paused',
            budget: 200,
            spend: 156.20,
            impressions: 78901,
            clicks: 567,
            conversions: 12,
            ctr: 0.7,
            cpc: 0.28,
            conversionRate: 2.1,
            performance: 'poor'
          }
        ],
        adSets: [
          {
            id: 1,
            campaignId: 1,
            name: 'Interest Targeting - Marketing',
            status: 'Active',
            spend: 187.45,
            impressions: 23456,
            clicks: 654,
            ctr: 2.8,
            cpc: 0.29
          },
          {
            id: 2,
            campaignId: 1,
            name: 'Lookalike Audience',
            status: 'Active',
            spend: 200.00,
            impressions: 22222,
            clicks: 580,
            ctr: 2.6,
            cpc: 0.34
          }
        ],
        ads: [
          {
            id: 1,
            adSetId: 1,
            name: 'Video Ad - Course Intro',
            status: 'Active',
            spend: 97.45,
            impressions: 12456,
            clicks: 334,
            ctr: 2.7,
            cpc: 0.29,
            performance: 'good'
          },
          {
            id: 2,
            adSetId: 1,
            name: 'Carousel Ad - Success Stories',
            status: 'Active',
            spend: 90.00,
            impressions: 11000,
            clicks: 320,
            ctr: 2.9,
            cpc: 0.28,
            performance: 'excellent'
          }
        ],
        totalSpend: 789.45,
        totalImpressions: 147835,
        totalClicks: 2691,
        totalConversions: 124,
        averageCTR: 1.8,
        averageCPC: 0.29,
        lastUpdated: new Date().toISOString()
      };

      setMetaData(mockMetaData);
      setConnectionStatus('connected');
      
    } catch (error) {
      console.error('Error fetching Meta Ads data:', error);
      setConnectionStatus('error');
      toast({
        title: "Connection Error",
        description: "Failed to fetch Meta Ads data. Please check your API connection.",
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

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const getPerformanceIcon = (performance) => {
    switch (performance) {
      case 'excellent':
        return <ArrowUp className="h-4 w-4 text-green-600" />;
      case 'good':
        return <ArrowUp className="h-4 w-4 text-blue-600" />;
      case 'poor':
        return <ArrowDown className="h-4 w-4 text-red-600" />;
      default:
        return <Minus className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getPerformanceBadge = (performance) => {
    const variants = {
      excellent: 'bg-green-100 text-green-800',
      good: 'bg-blue-100 text-blue-800',
      average: 'bg-yellow-100 text-yellow-800',
      poor: 'bg-red-100 text-red-800'
    };
    
    return (
      <Badge className={variants[performance] || variants.average}>
        {performance.charAt(0).toUpperCase() + performance.slice(1)}
      </Badge>
    );
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
          <p className="text-muted-foreground">Loading Meta Ads data...</p>
        </div>
      </div>
    );
  }

  if (connectionStatus === 'disconnected') {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-12">
          <Target className="h-16 w-16 mx-auto mb-6 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-4">Connect Your Meta Ads Account</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Connect your Meta Ads account to view campaign performance, ad metrics, and optimization insights.
          </p>
          <Button onClick={() => navigate('/connect')}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Connect Meta Ads
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
            <h1 className="text-3xl font-bold text-foreground">Meta Ads Dashboard</h1>
            <p className="text-muted-foreground">Campaign performance and advertising analytics</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              {getStatusIcon()}
              <span className="text-sm text-muted-foreground">
                {connectionStatus === 'connected' ? 'Connected' : 'Connection Issue'}
              </span>
            </div>
            <Button onClick={fetchMetaAdsData} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Overall KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Spend</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(metaData.totalSpend)}</div>
              <p className="text-xs text-muted-foreground">Across all campaigns</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Impressions</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(metaData.totalImpressions)}</div>
              <p className="text-xs text-muted-foreground">Total ad views</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clicks</CardTitle>
              <MousePointer className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(metaData.totalClicks)}</div>
              <p className="text-xs text-muted-foreground">
                {metaData.averageCTR}% CTR
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversions</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(metaData.totalConversions)}</div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(metaData.averageCPC)} avg CPC
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Campaign Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Campaign Performance</CardTitle>
            <CardDescription>Overview of all active and paused campaigns</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metaData.campaigns.map((campaign) => (
                <div key={campaign.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <h4 className="font-medium">{campaign.name}</h4>
                      <Badge variant={campaign.status === 'Active' ? 'default' : 'secondary'}>
                        {campaign.status}
                      </Badge>
                      {getPerformanceBadge(campaign.performance)}
                    </div>
                    <div className="flex items-center space-x-2">
                      {getPerformanceIcon(campaign.performance)}
                      <span className="text-sm font-medium">
                        {campaign.conversionRate}% Conv. Rate
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Spend</p>
                      <p className="font-medium">{formatCurrency(campaign.spend)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Budget</p>
                      <p className="font-medium">{formatCurrency(campaign.budget)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Impressions</p>
                      <p className="font-medium">{formatNumber(campaign.impressions)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Clicks</p>
                      <p className="font-medium">{formatNumber(campaign.clicks)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">CTR</p>
                      <p className="font-medium">{campaign.ctr}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">CPC</p>
                      <p className="font-medium">{formatCurrency(campaign.cpc)}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Budget Used</span>
                      <span>{((campaign.spend / campaign.budget) * 100).toFixed(1)}%</span>
                    </div>
                    <Progress value={(campaign.spend / campaign.budget) * 100} className="h-2" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Ad Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Top Performing Ads</CardTitle>
              <CardDescription>Best performing individual ads</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {metaData.ads.map((ad, index) => (
                  <div key={ad.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Badge variant="secondary" className="min-w-[24px] h-6 flex items-center justify-center">
                        {index + 1}
                      </Badge>
                      <div>
                        <h4 className="font-medium text-sm">{ad.name}</h4>
                        <div className="flex items-center space-x-2">
                          {getPerformanceIcon(ad.performance)}
                          <span className="text-xs text-muted-foreground">
                            {ad.ctr}% CTR • {formatCurrency(ad.cpc)} CPC
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-sm">{formatCurrency(ad.spend)}</p>
                      <p className="text-xs text-muted-foreground">{formatNumber(ad.clicks)} clicks</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Performance Health</CardTitle>
              <CardDescription>Campaign health indicators</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Excellent Performance</span>
                    <span className="text-sm text-muted-foreground">
                      {metaData.campaigns.filter(c => c.performance === 'excellent').length} campaigns
                    </span>
                  </div>
                  <Progress 
                    value={(metaData.campaigns.filter(c => c.performance === 'excellent').length / metaData.campaigns.length) * 100} 
                    className="h-2"
                  />
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Good Performance</span>
                    <span className="text-sm text-muted-foreground">
                      {metaData.campaigns.filter(c => c.performance === 'good').length} campaigns
                    </span>
                  </div>
                  <Progress 
                    value={(metaData.campaigns.filter(c => c.performance === 'good').length / metaData.campaigns.length) * 100} 
                    className="h-2"
                  />
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Needs Attention</span>
                    <span className="text-sm text-muted-foreground">
                      {metaData.campaigns.filter(c => c.performance === 'poor').length} campaigns
                    </span>
                  </div>
                  <Progress 
                    value={(metaData.campaigns.filter(c => c.performance === 'poor').length / metaData.campaigns.length) * 100} 
                    className="h-2"
                  />
                </div>

                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    <strong>{metaData.campaigns.filter(c => c.status === 'Active').length}</strong> active campaigns out of <strong>{metaData.campaigns.length}</strong> total
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Last Updated */}
        <div className="text-center text-sm text-muted-foreground">
          Last updated: {metaData.lastUpdated ? new Date(metaData.lastUpdated).toLocaleString() : 'Never'}
        </div>
      </div>
    </TooltipProvider>
  );
};

export default MetaAdsDashboard;