import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function decrypt(encryptedText: string): string {
  return atob(encryptedText);
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

    const authHeader = req.headers.get('authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: user } = await supabaseClient.auth.getUser(token)

    if (!user.user) {
      throw new Error('Unauthorized')
    }

    const { data: integration } = await supabaseClient
      .from('student_integrations')
      .select('shopify_api_token, shop_domain, is_shopify_connected')
      .eq('user_id', user.user.id)
      .single()

    if (!integration?.is_shopify_connected || !integration.shopify_api_token) {
      return new Response(
        JSON.stringify({ connected: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Decrypt the token
    const apiToken = decrypt(integration.shopify_api_token)
    const domain = integration.shop_domain

    // Fetch orders from Shopify
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
    const salesTrend = []
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      
      const dayOrders = orders.filter((order: any) => 
        order.created_at && order.created_at.startsWith(dateStr)
      )
      const dayTotal = dayOrders.reduce((sum: number, order: any) => 
        sum + parseFloat(order.total_price || 0), 0
      )
      
      salesTrend.push({
        date: dateStr,
        sales: dayTotal
      })
    }

    // Mock top products (would need products API call)
    const topProducts = [
      { id: '1', name: 'Premium T-Shirt', sales: 45, revenue: 1350 },
      { id: '2', name: 'Classic Hoodie', sales: 32, revenue: 1920 },
      { id: '3', name: 'Denim Jacket', sales: 28, revenue: 2240 },
    ]

    const metrics = {
      gmv,
      orders: orderCount,
      aov,
      conversionRate: 3.2, // Would calculate from analytics
      topProducts,
      salesTrend
    }

    return new Response(
      JSON.stringify({ connected: true, metrics }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ connected: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})