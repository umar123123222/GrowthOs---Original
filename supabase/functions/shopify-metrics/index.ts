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

    // Fetch Shopify credentials from normalized integrations table
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

    // Fetch recent orders from Shopify Admin API
    const ordersResponse = await fetch(`https://${domain}/admin/api/2024-07/orders.json?status=any&fields=total_price,created_at&limit=250`, {
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

    // Generate sales trend for last 7 days
    const today = new Date()
    const salesTrend: Array<{ date: string; sales: number }> = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]

      const dayOrders = orders.filter((order: any) => order.created_at && order.created_at.startsWith(dateStr))
      const dayTotal = dayOrders.reduce((sum: number, order: any) => sum + parseFloat(order.total_price || 0), 0)

      salesTrend.push({ date: dateStr, sales: dayTotal })
    }

    // Mock top products (placeholder)
    const topProducts = [
      { id: '1', name: 'Premium T-Shirt', sales: 45, revenue: 1350 },
      { id: '2', name: 'Classic Hoodie', sales: 32, revenue: 1920 },
      { id: '3', name: 'Denim Jacket', sales: 28, revenue: 2240 },
    ]

    const metrics = {
      gmv,
      orders: orderCount,
      aov,
      conversionRate: 3.2,
      topProducts,
      salesTrend
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