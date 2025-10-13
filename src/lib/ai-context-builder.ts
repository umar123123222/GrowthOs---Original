/**
 * AI Context Builder
 * Fetches and formats business context for the Success Partner AI
 */

import { supabase } from '@/integrations/supabase/client';
import { fetchShopifyMetrics, StudentIntegrations, fetchMetaAdsMetrics } from './student-integrations';
import type { BusinessContextFlags } from './ai-context-detector';

// Cache system for context data
interface CacheEntry {
  data: ShopifyContext | MetaAdsContext;
  timestamp: number;
}

const contextCache = new Map<string, CacheEntry>();
const CACHE_DURATION = 3 * 60 * 1000; // 3 minutes
const lastFetchTime = new Map<string, number>();
const THROTTLE_MS = 2000; // 2 seconds between fetches

export interface ShopifyContext {
  connected: boolean;
  dateRange?: string;
  metrics?: {
    totalSales: number;
    orderCount: number;
    averageOrderValue: number;
    topProducts?: Array<{ name: string; sales: number }>;
    salesTrend?: Array<{ date: string; sales: number }>;
    // Full product details with sales
    products?: Array<{ 
      id: number | string; 
      name: string; 
      sales: number; 
      revenue: number;
      orders?: number;
    }>;
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
    // Detailed campaign data
    campaigns?: Array<{
      id: string;
      name: string;
      status: string;
      spend: number;
      impressions: number;
      clicks: number;
      conversions: number;
      ctr: number;
      cpc: number;
      cpm: number;
      roas?: number;
      performance?: string;
    }>;
    // Detailed adset data
    adSets?: Array<{
      id: string;
      name: string;
      campaignId: string;
      status: string;
      spend: number;
      impressions: number;
      clicks: number;
      conversions: number;
      ctr: number;
      cpc: number;
      performance?: string;
    }>;
    // Detailed ad data
    ads?: Array<{
      id: string;
      name: string;
      adSetId: string;
      status: string;
      spend: number;
      impressions: number;
      clicks: number;
      conversions: number;
      ctr: number;
      cpc: number;
      performance?: string;
    }>;
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
  // Check cache first
  const cacheKey = `shopify_${userId}`;
  const cached = contextCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data as ShopifyContext;
  }

  try {
    // Always call fetchShopifyMetrics - it will check connection internally
    const metrics = await fetchShopifyMetrics(userId, {
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date().toISOString()
    });

    // Check if connected based on the response
    if (!metrics || metrics.error || !metrics.connected) {
      return { connected: false };
    }

    const result: ShopifyContext = {
      connected: true,
      dateRange: 'last 7 days',
      metrics: {
        totalSales: metrics.gmv || 0,
        orderCount: metrics.orders || 0,
        averageOrderValue: metrics.aov || 0,
        topProducts: metrics.topProducts || [],
        salesTrend: metrics.salesTrend || [],
        // Include all products with their detailed sales data
        products: metrics.products || metrics.topProducts || []
      }
    };

    // Cache the result only if successful
    contextCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (error) {
    console.error('Error fetching Shopify context:', error);
    return { connected: false, error: 'Failed to fetch Shopify data' };
  }
}

/**
 * Fetches Meta Ads context for a user
 */
async function getMetaAdsContext(userId: string): Promise<MetaAdsContext> {
  // Check cache first
  const cacheKey = `meta_${userId}`;
  const cached = contextCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data as MetaAdsContext;
  }

  try {
    // Always call fetchMetaAdsMetrics - it will check connection internally
    const metricsData = await fetchMetaAdsMetrics({
      dateFrom: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      dateTo: new Date().toISOString()
    });

    // Check if connected based on the response
    if (!metricsData || !metricsData.connected) {
      return { connected: false };
    }

    const result: MetaAdsContext = {
      connected: true,
      dateRange: 'last 7 days',
      metrics: {
        totalSpend: metricsData.metrics?.totalSpend || 0,
        impressions: metricsData.metrics?.totalImpressions || 0,
        clicks: metricsData.metrics?.totalClicks || 0,
        conversions: metricsData.metrics?.totalConversions || 0,
        roas: metricsData.metrics?.averageROAS ? metricsData.metrics.averageROAS * 100 : 0,
        ctr: metricsData.metrics?.averageCTR || 0,
        // Include detailed campaign, adset, and ad data
        campaigns: metricsData.metrics?.campaigns || [],
        adSets: metricsData.metrics?.adSets || [],
        ads: metricsData.metrics?.ads || []
      }
    };

    // Cache the result only if successful
    contextCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (error) {
    console.error('Error fetching Meta Ads context:', error);
    return { connected: false, error: 'Failed to fetch Meta Ads data' };
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

  // Rate limiting: throttle requests
  const lastFetch = lastFetchTime.get(userId);
  if (lastFetch && Date.now() - lastFetch < THROTTLE_MS) {
    // Too soon, wait a bit
    await new Promise(resolve => setTimeout(resolve, THROTTLE_MS - (Date.now() - lastFetch)));
  }
  lastFetchTime.set(userId, Date.now());

  try {
    // Fetch contexts with per-service timeouts and return whatever is ready
    const racers: Array<Promise<any>> = [];

    const withTimeout = <T>(p: Promise<T>, ms: number) =>
      Promise.race([
        p,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
      ]);

    if (flags.includeShopify) {
      racers.push(
        withTimeout(getShopifyContext(userId), timeout)
          .then((r) => ({ key: 'shopify', value: r }))
          .catch(() => ({ key: 'shopify', value: null }))
      );
    }
    if (flags.includeMetaAds) {
      racers.push(
        withTimeout(getMetaAdsContext(userId), timeout)
          .then((r) => ({ key: 'metaAds', value: r }))
          .catch(() => ({ key: 'metaAds', value: null }))
      );
    }

    const settled = await Promise.all(racers);

    const context: BusinessContext = {};
    for (const item of settled as any[]) {
      if (item.key === 'shopify' && item.value) context.shopify = item.value as ShopifyContext;
      if (item.key === 'metaAds' && item.value) context.metaAds = item.value as MetaAdsContext;
    }

    // If nothing resolved (both timed out/failed), return null so caller can decide fallback
    if (!context.shopify && !context.metaAds) return null;

    return context;
  } catch (error) {
    console.error('Error building business context:', error);
    return null;
  }
}
