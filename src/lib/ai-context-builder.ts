/**
 * AI Context Builder
 * Fetches and formats business context for the Success Partner AI
 */

import { supabase } from '@/integrations/supabase/client';
import { fetchShopifyMetrics } from './student-integrations';
import type { BusinessContextFlags } from './ai-context-detector';

export interface ShopifyContext {
  connected: boolean;
  dateRange?: string;
  metrics?: {
    totalSales: number;
    orderCount: number;
    averageOrderValue: number;
    topProducts?: Array<{ name: string; sales: number }>;
    salesTrend?: Array<{ date: string; sales: number }>;
  };
  error?: string;
}

export interface MetaAdsContext {
  connected: boolean;
  dateRange?: string;
  metrics?: {
    totalSpend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    roas: number;
    ctr: number;
  };
  error?: string;
}

export interface BusinessContext {
  shopify?: ShopifyContext;
  metaAds?: MetaAdsContext;
}

/**
 * Fetches Shopify context for a user
 */
async function getShopifyContext(userId: string): Promise<ShopifyContext> {
  try {
    // Check if Shopify is connected
    const { data: integration } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('source', 'shopify')
      .maybeSingle();

    if (!integration) {
      return { connected: false };
    }

    // Fetch metrics using existing function
    const metrics = await fetchShopifyMetrics(userId, {
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date().toISOString()
    });

    return {
      connected: true,
      dateRange: 'last 7 days',
      metrics: {
        totalSales: metrics.gmv || 0,
        orderCount: metrics.orders || 0,
        averageOrderValue: metrics.aov || 0,
        topProducts: metrics.topProducts || [],
        salesTrend: metrics.salesTrend || []
      }
    };
  } catch (error) {
    console.error('Error fetching Shopify context:', error);
    return {
      connected: true,
      error: 'Failed to fetch Shopify data'
    };
  }
}

/**
 * Fetches Meta Ads context for a user
 */
async function getMetaAdsContext(userId: string): Promise<MetaAdsContext> {
  try {
    // Check if Meta Ads is connected
    const { data: integration } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('source', 'meta')
      .maybeSingle();

    if (!integration) {
      return { connected: false };
    }

    // Fetch metrics from user_metrics table
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const { data: metrics, error } = await supabase
      .from('user_metrics')
      .select('*')
      .eq('user_id', userId)
      .eq('source', 'meta')
      .gte('date', sevenDaysAgo);

    if (error) throw error;

    if (!metrics || metrics.length === 0) {
      return {
        connected: true,
        dateRange: 'last 7 days',
        metrics: {
          totalSpend: 0,
          impressions: 0,
          clicks: 0,
          conversions: 0,
          roas: 0,
          ctr: 0
        }
      };
    }

    // Aggregate metrics
    const totalSpend = metrics
      .filter(m => m.metric === 'spend')
      .reduce((sum, m) => sum + Number(m.value), 0);
    
    const totalImpressions = metrics
      .filter(m => m.metric === 'impressions')
      .reduce((sum, m) => sum + Number(m.value), 0);
    
    const totalClicks = metrics
      .filter(m => m.metric === 'clicks')
      .reduce((sum, m) => sum + Number(m.value), 0);
    
    const totalConversions = metrics
      .filter(m => m.metric === 'conversions')
      .reduce((sum, m) => sum + Number(m.value), 0);
    
    const totalRevenue = metrics
      .filter(m => m.metric === 'revenue')
      .reduce((sum, m) => sum + Number(m.value), 0);

    const roas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

    return {
      connected: true,
      dateRange: 'last 7 days',
      metrics: {
        totalSpend,
        impressions: totalImpressions,
        clicks: totalClicks,
        conversions: totalConversions,
        roas,
        ctr
      }
    };
  } catch (error) {
    console.error('Error fetching Meta Ads context:', error);
    return {
      connected: true,
      error: 'Failed to fetch Meta Ads data'
    };
  }
}

/**
 * Builds business context based on detection flags
 * @param userId - User ID
 * @param flags - Context flags indicating what to fetch
 * @param timeout - Maximum time to wait for context (ms)
 * @returns Business context object
 */
export async function buildBusinessContext(
  userId: string,
  flags: BusinessContextFlags,
  timeout: number = 5000
): Promise<BusinessContext | null> {
  if (!flags.includeShopify && !flags.includeMetaAds) {
    return null;
  }

  try {
    // Fetch contexts in parallel with timeout
    const fetchPromises: Promise<any>[] = [];
    
    if (flags.includeShopify) {
      fetchPromises.push(getShopifyContext(userId));
    }
    
    if (flags.includeMetaAds) {
      fetchPromises.push(getMetaAdsContext(userId));
    }

    // Race against timeout
    const results = await Promise.race([
      Promise.all(fetchPromises),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Context fetch timeout')), timeout)
      )
    ]) as Array<ShopifyContext | MetaAdsContext>;

    const context: BusinessContext = {};
    
    let resultIndex = 0;
    
    if (flags.includeShopify) {
      context.shopify = results[resultIndex] as ShopifyContext;
      resultIndex++;
    }
    
    if (flags.includeMetaAds) {
      context.metaAds = results[resultIndex] as MetaAdsContext;
    }

    return context;
  } catch (error) {
    console.error('Error building business context:', error);
    return null;
  }
}
