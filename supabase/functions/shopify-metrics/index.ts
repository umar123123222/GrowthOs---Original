import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { formatInTimeZone, fromZonedTime } from 'https://esm.sh/date-fns-tz@3.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function decrypt(encryptedText: string): Promise<string> {
  const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/secure-encrypt-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
    },
    body: JSON.stringify({ action: 'decrypt', data: encryptedText })
  });
  
  if (!response.ok) {
    throw new Error(`Decryption failed: ${response.status}`);
  }
  
  const result = await response.json();
  if (result.error) {
    throw new Error(`Decryption error: ${result.error}`);
  }
  
  return result.decrypted;
}

function sumAmounts(orders: any[]): number {
  return orders.reduce((sum: number, o: any) => {
    const set = o?.current_total_price_set?.shop_money;
    const amt = set?.amount !== undefined ? parseFloat(set.amount) : parseFloat(o.current_total_price || o.total_price || 0);
    return sum + (isNaN(amt) ? 0 : amt);
  }, 0);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ connected: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: user } = await supabaseClient.auth.getUser(token);
    if (!user.user) {
      return new Response(
        JSON.stringify({ connected: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse payload
    let payload: any = {};
    try { payload = await req.json(); } catch { payload = {}; }
    const startDateInput = payload?.startDate ? new Date(payload.startDate) : null;
    const endDateInput = payload?.endDate ? new Date(payload.endDate) : null;
    const timeBasis: 'created' | 'processed' = (payload?.timeBasis === 'processed') ? 'processed' : 'created';

    const { data: integ, error: integErr } = await supabaseClient
      .from('integrations')
      .select('access_token, external_id')
      .eq('user_id', user.user.id)
      .eq('source', 'shopify')
      .maybeSingle();

    if (integErr) throw integErr;
    if (!integ?.access_token || !integ.external_id) {
      return new Response(JSON.stringify({ connected: false }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const apiToken = await decrypt(integ.access_token);
    const domain = integ.external_id;

    // Fetch shop details: currency and timezone
    const shopResp = await fetch(`https://${domain}/admin/api/2024-07/shop.json?fields=currency,iana_timezone`, {
      headers: { 'X-Shopify-Access-Token': apiToken }
    });
    const shopJson = shopResp.ok ? await shopResp.json() : { shop: null };
    const currency = shopJson?.shop?.currency || 'USD';
    const shopTz = shopJson?.shop?.iana_timezone || 'UTC';

    // Determine timezone to use
    const tz: string = (payload?.timezone && typeof payload.timezone === 'string') ? payload.timezone : shopTz;

    // Build start/end boundaries in chosen timezone
    const now = new Date();
    const defaultEnd = now;
    const defaultStart = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);

    const startBase = startDateInput || defaultStart;
    const endBase = endDateInput || defaultEnd;

    const startYmd = formatInTimeZone(startBase, tz, "yyyy-MM-dd");
    const endYmd = formatInTimeZone(endBase, tz, "yyyy-MM-dd");

    const createdMinUtc = fromZonedTime(`${startYmd}T00:00:00.000`, tz);
    const createdMaxUtc = fromZonedTime(`${endYmd}T23:59:59.999`, tz);

    const minParam = encodeURIComponent(createdMinUtc.toISOString());
    const maxParam = encodeURIComponent(createdMaxUtc.toISOString());

    // Fetch all orders with pagination
    const fields = [
      'id','created_at','processed_at','cancelled_at','test','financial_status',
      'current_total_price','current_total_price_set','total_price','total_discounts','total_tax',
      'total_shipping_price_set','refunds','line_items'
    ].join(',');

    const basisParam = timeBasis === 'processed' ? 'processed_at' : 'created_at';
    let url = `https://${domain}/admin/api/2024-07/orders.json?status=any&limit=250&order=${basisParam}%20asc&fields=${fields}&${basisParam}_min=${minParam}&${basisParam}_max=${maxParam}`;
    const allOrders: any[] = [];

    while (url) {
      const resp = await fetch(url, { headers: { 'X-Shopify-Access-Token': apiToken } });
      if (!resp.ok) throw new Error(`Shopify API error: ${resp.status}`);
      const json = await resp.json();
      const pageOrders = Array.isArray(json?.orders) ? json.orders : [];
      allOrders.push(...pageOrders);

      // Parse Link header for next page
      const link = resp.headers.get('link') || resp.headers.get('Link');
      const nextMatch = link && link.split(',').find(p => p.includes('rel="next"'));
      if (nextMatch) {
        const m = nextMatch.match(/<([^>]+)>/);
        url = m ? m[1] : '';
      } else {
        url = '';
      }
    }

    // Filter to match Shopify dashboard
    const filtered = allOrders.filter((o: any) => {
      if (o?.test === true) return false;
      if (o?.cancelled_at) return false;
      if ((o?.financial_status || '').toLowerCase() === 'voided') return false;
      return true;
    });

    // Helpers to compute net sales per order (exclude gift card purchases)
    function netForOrder(o: any): number {
      const set = o?.current_total_price_set?.shop_money;
      const gross = set?.amount !== undefined
        ? parseFloat(set.amount)
        : parseFloat(o.current_total_price || o.total_price || 0);
      const lineItems = Array.isArray(o?.line_items) ? o.line_items : [];
      let giftCardSubtotal = 0;
      for (const li of lineItems) {
        const isGift = li?.gift_card === true || (typeof li?.title === 'string' && li.title.toLowerCase().includes('gift card'));
        if (!isGift) continue;
        const qty = Number(li?.quantity || 0);
        const price = parseFloat(li?.price || 0);
        const liDiscount = parseFloat(li?.total_discount || 0);
        const liTotal = Math.max(0, qty * (isNaN(price) ? 0 : price) - (isNaN(liDiscount) ? 0 : liDiscount));
        giftCardSubtotal += liTotal;
      }
      const net = (isNaN(gross) ? 0 : gross) - giftCardSubtotal;
      return net > 0 ? net : 0;
    }

    // Compute metrics
    const totalSales = filtered.reduce((sum, o) => sum + netForOrder(o), 0);
    const orderCount = filtered.length;
    const aov = orderCount > 0 ? totalSales / orderCount : 0;

    // Sales trend grouped by selected timezone and time basis
    const trendMap = new Map<string, number>();
    for (const o of filtered) {
      const dateStr = timeBasis === 'processed' ? o?.processed_at : o?.created_at;
      const basisDate = dateStr ? new Date(dateStr) : null;
      if (!basisDate) continue;
      const key = formatInTimeZone(basisDate, tz, 'yyyy-MM-dd');
      const amt = netForOrder(o);
      const val = trendMap.get(key) || 0;
      trendMap.set(key, val + amt);
    }
    const salesTrend = Array.from(trendMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, sales]) => ({ date, sales }));

    // Fetch products (basic info)
    const productsResp = await fetch(`https://${domain}/admin/api/2024-07/products.json?limit=250&fields=id,title,handle,product_type,images,variants,created_at,status,vendor`, {
      headers: { 'X-Shopify-Access-Token': apiToken }
    });
    const productsJson = productsResp.ok ? await productsResp.json() : { products: [] };
    const products = (productsJson.products || []).map((p: any) => ({
      id: String(p.id),
      name: p.title,
      type: p.product_type,
      price: p.variants?.[0]?.price ? parseFloat(p.variants[0].price) : 0,
      image: p.images?.[0]?.src || null,
      status: p.status,
      handle: p.handle,
    }));

    // Best sellers within range using line_items
    const salesMap: Record<string, { id: string; name: string; sales: number; revenue: number }> = {};
    for (const o of filtered) {
      const lineItems = o.line_items || [];
      for (const li of lineItems) {
        const pid = String(li.product_id || li.variant_id || li.sku || li.title);
        if (!salesMap[pid]) {
          salesMap[pid] = { id: pid, name: li.title || `Product ${pid}`, sales: 0, revenue: 0 };
        }
        const qty = Number(li.quantity || 0);
        const price = parseFloat(li.price || 0);
        salesMap[pid].sales += qty;
        salesMap[pid].revenue += qty * (isNaN(price) ? 0 : price);
      }
    }
    const bestSellers = Object.values(salesMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    const metrics = {
      // Primary fields matching Shopify dashboard
      totalSales,
      orders: orderCount,
      aov,
      salesTrend,
      currency,
      timezone: tz,
      period: { start: createdMinUtc.toISOString(), end: createdMaxUtc.toISOString(), tz, basis: timeBasis },
      // Backward compatibility
      gmv: totalSales,
      topProducts: bestSellers,
      bestSellers,
      products,
    };

    return new Response(
      JSON.stringify({ connected: true, metrics }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('shopify-metrics error:', error);
    return new Response(
      JSON.stringify({ connected: false, error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});