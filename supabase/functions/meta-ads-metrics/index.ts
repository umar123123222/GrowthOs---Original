import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
    if (!authHeader) throw new Error('Missing authorization header')
    const token = authHeader.replace('Bearer ', '')
    const { data: user } = await supabaseClient.auth.getUser(token)

    if (!user.user) {
      return new Response(
        JSON.stringify({ connected: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Try to get Meta Ads integration from integrations table
    const { data: integ, error: integErr } = await supabaseClient
      .from('integrations')
      .select('access_token, external_id')
      .eq('user_id', user.user.id)
      .eq('source', 'meta_ads')
      .maybeSingle()

    if (integErr) throw integErr

    let accessToken: string | null = null;
    let externalId: string | null = null;

    if (integ?.access_token && integ.external_id) {
      // Use data from integrations table
      accessToken = await decrypt(integ.access_token)
      externalId = String(integ.external_id)
    } else {
      // Fallback: check users table for legacy credentials
      const { data: userData, error: userErr } = await supabaseClient
        .from('users')
        .select('meta_ads_credentials')
        .eq('id', user.user.id)
        .maybeSingle()

      if (!userErr && userData?.meta_ads_credentials) {
        try {
          // Try to decrypt first (for encrypted credentials)
          const decryptedCreds = await decrypt(userData.meta_ads_credentials)
          const creds = JSON.parse(decryptedCreds)
          if (creds.accessToken && creds.accountId) {
            accessToken = creds.accessToken
            externalId = String(creds.accountId)
          }
        } catch (e) {
          // If decryption fails, try parsing as plain JSON
          try {
            const creds = JSON.parse(userData.meta_ads_credentials)
            if (creds.accessToken && creds.accountId) {
              accessToken = creds.accessToken
              externalId = String(creds.accountId)
            }
          } catch (parseError) {
            console.error('Failed to parse legacy Meta Ads credentials:', e, parseError)
          }
        }
      }
    }

    if (!accessToken || !externalId) {
      return new Response(
        JSON.stringify({ connected: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const accountIdRaw = externalId
    const accountId = accountIdRaw.startsWith('act_') ? accountIdRaw : `act_${accountIdRaw}`

    // Query Meta Marketing API for last 7 days insights
    const url = new URL(`https://graph.facebook.com/v19.0/${accountId}/insights`)
    url.searchParams.set('date_preset', 'last_7d')
    url.searchParams.set('fields', 'spend,impressions,clicks,actions,cpc,ctr')
    url.searchParams.set('access_token', accessToken)

    let metrics = {
      totalSpend: 0,
      totalImpressions: 0,
      totalClicks: 0,
      totalConversions: 0,
      averageCTR: 0,
      averageCPC: 0,
      campaigns: [] as any[],
      adSets: [] as any[],
      ads: [] as any[],
    }

    try {
      const resp = await fetch(url.toString())
      if (resp.ok) {
        const json = await resp.json()
        const rows = json.data || []
        let spendSum = 0, impSum = 0, clickSum = 0, convSum = 0, ctrSum = 0, cpcSum = 0
        let ctrCount = 0, cpcCount = 0
        for (const r of rows) {
          spendSum += Number(r.spend || 0)
          impSum += Number(r.impressions || 0)
          clickSum += Number(r.clicks || 0)
          if (Array.isArray(r.actions)) {
            const purchase = r.actions.find((a: any) => a.action_type?.includes('purchase'))
            if (purchase) convSum += Number(purchase.value || 0)
          }
          if (r.ctr != null) { ctrSum += Number(r.ctr); ctrCount++ }
          if (r.cpc != null) { cpcSum += Number(r.cpc); cpcCount++ }
        }
        metrics.totalSpend = spendSum
        metrics.totalImpressions = impSum
        metrics.totalClicks = clickSum
        metrics.totalConversions = convSum
        metrics.averageCTR = ctrCount ? (ctrSum / ctrCount) : 0
        metrics.averageCPC = cpcCount ? (cpcSum / cpcCount) : 0
      }
    } catch (e) {
      // Swallow network errors and return minimal metrics
      console.warn('Meta API fetch failed:', e)
    }

    return new Response(
      JSON.stringify({ connected: true, metrics }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('meta-ads-metrics error:', error)
    return new Response(
      JSON.stringify({ connected: false, error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})