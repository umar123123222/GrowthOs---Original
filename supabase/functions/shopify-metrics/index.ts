import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function decrypt(encryptedText: string): string {
  return atob(encryptedText)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ connected: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: user } = await supabaseClient.auth.getUser(token)
    if (!user.user) {
      return new Response(
        JSON.stringify({ connected: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Optional payload for date range
    let payload: any = {}
    try { payload = await req.json(); } catch { payload = {} }
    const startDateInput = payload?.startDate ? new Date(payload.startDate) : null
    const endDateInput = payload?.endDate ? new Date(payload.endDate) : null

    // Defaults: last 7 days
    const endDate = endDateInput || new Date()
    const startDate = startDateInput || new Date(new Date().setDate(endDate.getDate() - 6))
    const createdMin = new Date(startDate)
    createdMin.setHours(0,0,0,0)
    const createdMax = new Date(endDate)
    createdMax.setHours(23,59,59,999)

    const { data: integ, error: integErr } = await supabaseClient
      .from('integrations')
      .select('access_token, external_id')
      .eq('user_id', user.user.id)
      .eq('source', 'shopify')
      .maybeSingle()

    if (integErr) throw integErr

    if (!integ?.access_token || !integ.external_id) {
      return new Response(
        JSON.stringify({ connected: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const apiToken = decrypt(integ.access_token)
    const domain = integ.external_id

    // Fetch shop details for currency/locale
    const shopResp = await fetch(`https://${domain}/admin/api/2024-07/shop.json?fields=currency,primary_locale,money_format`, {
      headers: { 'X-Shopify-Access-Token': apiToken }
    })
    const shopJson = shopResp.ok ? await shopResp.json() : { shop: null }
    const currency = shopJson?.shop?.currency || 'USD'

    // Fetch recent orders within range from Shopify Admin API (include line_items)
    const createdMinParam = encodeURIComponent(createdMin.toISOString())
    const createdMaxParam = encodeURIComponent(createdMax.toISOString())
    const ordersResponse = await fetch(`https://${domain}/admin/api/2024-07/orders.json?status=any&limit=250&fields=total_price,created_at,line_items&created_at_min=${createdMinParam}&created_at_max=${createdMaxParam}` , {
      headers: {
        'X-Shopify-Access-Token': apiToken
      }
    })

    if (!ordersResponse.ok) {
      throw new Error(`Shopify API error: ${ordersResponse.status}`)
    }

    const ordersData = await ordersResponse.json()
    const orders = ordersData.orders || []

    // Calculate metrics
    const gmv = orders.reduce((sum: number, order: any) => sum + parseFloat(order.total_price || 0), 0)
    const orderCount = orders.length
    const aov = orderCount > 0 ? gmv / orderCount : 0

    // Generate sales trend for selected range
    const dayMs = 24 * 60 * 60 * 1000
    const days = Math.max(1, Math.ceil((createdMax.getTime() - createdMin.getTime()) / dayMs) + 1)
    const salesTrend: Array<{ date: string; sales: number }> = []
    for (let i = 0; i < days; i++) {
      const date = new Date(createdMin.getTime() + i * dayMs)
      const dateStr = date.toISOString().split('T')[0]

      const dayOrders = orders.filter((order: any) => order.created_at && order.created_at.startsWith(dateStr))
      const dayTotal = dayOrders.reduce((sum: number, order: any) => sum + parseFloat(order.total_price || 0), 0)

      salesTrend.push({ date: dateStr, sales: dayTotal })
    }

    // Fetch products (basic info)
    const productsResp = await fetch(`https://${domain}/admin/api/2024-07/products.json?limit=250&fields=id,title,handle,product_type,images,variants,created_at,status,vendor`, {
      headers: { 'X-Shopify-Access-Token': apiToken }
    })

    const productsJson = productsResp.ok ? await productsResp.json() : { products: [] }
    const products = (productsJson.products || []).map((p: any) => ({
      id: String(p.id),
      name: p.title,
      type: p.product_type,
      price: p.variants?.[0]?.price ? parseFloat(p.variants[0].price) : 0,
      image: p.images?.[0]?.src || null,
      status: p.status,
      handle: p.handle,
    }))

    // Compute best sellers within selected range using line_items
    const salesMap: Record<string, { id: string; name: string; sales: number; revenue: number }> = {}

    for (const o of orders) {
      const created = o.created_at ? new Date(o.created_at) : null
      if (!created || created < createdMin || created > createdMax) continue
      const lineItems = o.line_items || []
      for (const li of lineItems) {
        const pid = String(li.product_id || li.variant_id || li.sku || li.title)
        if (!salesMap[pid]) {
          salesMap[pid] = { id: pid, name: li.title || `Product ${pid}` , sales: 0, revenue: 0 }
        }
        const qty = Number(li.quantity || 0)
        const price = parseFloat(li.price || 0)
        salesMap[pid].sales += qty
        salesMap[pid].revenue += qty * price
      }
    }

    const bestSellers = Object.values(salesMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)

    const metrics = {
      gmv,
      orders: orderCount,
      aov,
      conversionRate: 3.2,
      topProducts: bestSellers, // backward compatibility
      bestSellers,
      salesTrend,
      products,
      currency,
    }

    return new Response(
      JSON.stringify({ connected: true, metrics }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('shopify-metrics error:', error)
    return new Response(
      JSON.stringify({ connected: false, error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})