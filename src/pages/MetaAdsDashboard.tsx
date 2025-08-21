import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { 
  Pagination, 
  PaginationContent, 
  PaginationEllipsis, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious 
} from '@/components/ui/pagination';
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
import { supabase } from '@/integrations/supabase/client';

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
  const [currentPage, setCurrentPage] = useState(1);
  const adsPerPage = 3;

  useEffect(() => {
    fetchMetaAdsData();
  }, []);

  const fetchMetaAdsData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('meta-ads-metrics');
      if (error) throw error;

      if (!data?.connected) {
        setConnectionStatus('disconnected');
        setLoading(false);
        return;
      }

      const m = data.metrics || {};
      setMetaData({
        campaigns: m.campaigns || [],
        adSets: m.adSets || [],
        ads: m.ads || [],
        totalSpend: m.totalSpend ?? m.spend ?? 0,
        totalImpressions: m.totalImpressions ?? m.impressions ?? 0,
        totalClicks: m.totalClicks ?? m.clicks ?? 0,
        totalConversions: m.totalConversions ?? m.conversions ?? 0,
        averageCTR: m.averageCTR ?? m.ctr ?? 0,
        averageCPC: m.averageCPC ?? m.cpc ?? 0,
        lastUpdated: new Date().toISOString()
      });
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

        {/* Active Campaigns */}
        <Card>
          <CardHeader>
            <CardTitle>Active Campaigns</CardTitle>
            <CardDescription>All currently active advertising campaigns</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(() => {
                const activeCampaigns = metaData.campaigns.filter(campaign => 
                  campaign.status === 'Active' || campaign.status === 'active' || campaign.status === 'ACTIVE'
                );
                
                if (activeCampaigns.length === 0) {
                  return (
                    <div className="text-center py-12">
                      <Target className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="text-lg font-medium mb-2">No Active Campaigns Found</h3>
                      <p className="text-muted-foreground mb-4">
                        {metaData.campaigns.length === 0 
                          ? "No campaigns have been created yet or the API couldn't fetch campaign details."
                          : `You have ${metaData.campaigns.length} total campaigns, but none are currently active.`
                        }
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Total account metrics: {formatCurrency(metaData.totalSpend)} spent, {formatNumber(metaData.totalImpressions)} impressions
                      </p>
                    </div>
                  );
                }

                return activeCampaigns.map((campaign) => (
                  <div key={campaign.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <h4 className="font-medium text-lg">{campaign.name}</h4>
                        <Badge variant="default" className="bg-green-100 text-green-800">
                          ● Active
                        </Badge>
                        {getPerformanceBadge(campaign.performance)}
                      </div>
                      <div className="flex items-center space-x-2">
                        {getPerformanceIcon(campaign.performance)}
                        <span className="text-sm font-medium">
                          {campaign.conversionRate || 0}% Conv. Rate
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-4 mb-4">
                      <div className="bg-muted/50 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground mb-1">Daily Spend</p>
                        <p className="font-medium text-lg">{formatCurrency(campaign.spend || 0)}</p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground mb-1">ROAS</p>
                        <p className="font-medium text-lg">{campaign.roas ? `${campaign.roas.toFixed(2)}x` : 'N/A'}</p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground mb-1">Results</p>
                        <p className="font-medium text-lg">{formatNumber(campaign.results || 0)}</p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground mb-1">Impressions</p>
                        <p className="font-medium text-lg">{formatNumber(campaign.impressions || 0)}</p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground mb-1">Clicks</p>
                        <p className="font-medium text-lg">{formatNumber(campaign.clicks || 0)}</p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground mb-1">CTR</p>
                        <p className="font-medium text-lg">{campaign.ctr || 0}%</p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground mb-1">Avg CPC</p>
                        <p className="font-medium text-lg">{formatCurrency(campaign.cpc || 0)}</p>
                      </div>
                    </div>
                    
                    {campaign.budget && campaign.spend && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Budget Utilization</span>
                          <span className="font-medium">
                            {((campaign.spend / campaign.budget) * 100).toFixed(1)}%
                          </span>
                        </div>
                        <Progress 
                          value={(campaign.spend / campaign.budget) * 100} 
                          className="h-3"
                        />
                      </div>
                    )}
                  </div>
                ));
              })()}
            </div>
          </CardContent>
        </Card>

        {/* Active Ads with Pagination */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>All Active Ads</CardTitle>
            <CardDescription>Complete list of all active ads with pagination</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(() => {
                const activeAds = metaData.ads.filter(ad => ad.status === 'Active' || ad.status === 'active');
                const totalPages = Math.ceil(activeAds.length / adsPerPage);
                const startIndex = (currentPage - 1) * adsPerPage;
                const endIndex = startIndex + adsPerPage;
                const currentAds = activeAds.slice(startIndex, endIndex);

                return (
                  <>
                    {currentAds.length > 0 ? (
                      currentAds.map((ad, index) => (
                        <div key={ad.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center space-x-3">
                            <Badge variant="secondary" className="min-w-[32px] h-8 flex items-center justify-center">
                              {startIndex + index + 1}
                            </Badge>
                            <div>
                              <h4 className="font-medium text-sm">{ad.name}</h4>
                              <div className="flex items-center space-x-2 mt-1">
                                {getPerformanceIcon(ad.performance)}
                                <span className="text-xs text-muted-foreground">
                                  {ad.ctr}% CTR • {formatCurrency(ad.cpc)} CPC
                                </span>
                                <Badge variant={ad.status === 'Active' || ad.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                                  {ad.status}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-sm">{formatCurrency(ad.spend)}</p>
                            <p className="text-xs text-muted-foreground">{formatNumber(ad.clicks)} clicks</p>
                            <p className="text-xs text-muted-foreground">{formatNumber(ad.impressions)} impressions</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground">No active ads found</p>
                      </div>
                    )}
                    
                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                      <div className="flex justify-center mt-6">
                        <Pagination>
                          <PaginationContent>
                            <PaginationItem>
                              <PaginationPrevious 
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                              />
                            </PaginationItem>
                            
                            {[...Array(totalPages)].map((_, i) => (
                              <PaginationItem key={i + 1}>
                                <PaginationLink
                                  onClick={() => setCurrentPage(i + 1)}
                                  isActive={currentPage === i + 1}
                                  className="cursor-pointer"
                                >
                                  {i + 1}
                                </PaginationLink>
                              </PaginationItem>
                            ))}
                            
                            <PaginationItem>
                              <PaginationNext
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                              />
                            </PaginationItem>
                          </PaginationContent>
                        </Pagination>
                      </div>
                    )}
                    
                    <div className="text-center text-sm text-muted-foreground mt-4">
                      Showing {currentAds.length} of {activeAds.length} active ads
                    </div>
                  </>
                );
              })()}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">

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