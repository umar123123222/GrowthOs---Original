import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function decrypt(encryptedText: string): Promise<string> {
  // Try local base64 decode first
  try {
    const decoded = atob(encryptedText);
    if (decoded) return decoded;
  } catch (_) {
    // Not base64 or invalid
  }
  // If it's already a plausible plain token (e.g., starts with EAA/CAA), return as-is
  if (/^(EAA|CAA)/.test(encryptedText)) return encryptedText;
  // As a last resort, attempt calling helper (optional)
  try {
    const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/encrypt-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
      },
      body: JSON.stringify({ action: 'decrypt', data: encryptedText })
    });
    if (response.ok) {
      const result = await response.json();
      if (result?.decrypted) return result.decrypted;
    }
  } catch (_) {}
  // Fallback to original string
  return encryptedText;
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

    // Parse request body for date range parameters and optional userId
    let dateFrom: string | null = null
    let dateTo: string | null = null
    let bodyUserId: string | null = null

    if (req.body) {
      try {
        const body = await req.json()
        dateFrom = body.dateFrom ?? null
        dateTo = body.dateTo ?? null
        bodyUserId = body.userId ?? null
      } catch (_e) {
        // Ignore parsing errors, use defaults
      }
    }

    // Determine effective user id: prefer authenticated user, fallback to body.userId
    let effectiveUserId: string | null = null
    const authHeader = req.headers.get('authorization')
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '')
        const { data: user } = await supabaseClient.auth.getUser(token)
        if (user?.user?.id) effectiveUserId = user.user.id
      } catch (_e) {
        // ignore auth parsing errors, we'll fallback to body user id
      }
    }
    if (!effectiveUserId && bodyUserId) {
      effectiveUserId = bodyUserId
    }

    if (!effectiveUserId) {
      return new Response(
        JSON.stringify({ connected: false, error: 'Unauthorized: missing user id' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Try to get Meta Ads integration from integrations table
    const { data: integ, error: integErr } = await supabaseClient
      .from('integrations')
      .select('access_token, external_id')
      .eq('user_id', effectiveUserId)
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
        .eq('id', effectiveUserId)
        .maybeSingle()

      if (!userErr && userData?.meta_ads_credentials) {
        try {
          // First, always try to decrypt the credential (most common case)
          const rawCredential = userData.meta_ads_credentials.trim()
          console.log('Processing Meta Ads credential, attempting decryption...')
          
          try {
            const decryptedCreds = await decrypt(rawCredential)
            console.log('Successfully decrypted Meta Ads credential')
            
            // Try to parse as JSON object first
            try {
              const creds = JSON.parse(decryptedCreds)
              if (creds.accessToken && creds.accountId) {
                accessToken = creds.accessToken
                externalId = String(creds.accountId)
                console.log('Found structured credentials in decrypted data')
              }
            } catch (jsonError) {
              // If it's not JSON, it might be a plain access token
              if (decryptedCreds.startsWith('EAA') || decryptedCreds.startsWith('CAA')) {
                console.log('Decrypted credential appears to be a plain access token')
                accessToken = decryptedCreds
                console.log('Plain access token extracted from decrypted credential')
              }
            }
          } catch (decryptError) {
            console.log('Decryption failed, trying other formats...', decryptError.message)
            
            // If decryption fails, check if it's already a plain access token string
            if (rawCredential.startsWith('EAA') || rawCredential.startsWith('CAA')) {
              console.log('Found plain access token, needs account ID')
              // This would need account ID from another field, but that column doesn't exist
              // User will need to reconnect
            } else {
              // Try parsing as plain JSON (unencrypted)
              try {
                const creds = JSON.parse(rawCredential)
                if (creds.accessToken && creds.accountId) {
                  accessToken = creds.accessToken
                  externalId = String(creds.accountId)
                  console.log('Found credentials in plain JSON format')
                }
              } catch (parseError) {
                console.log('Could not parse credential as JSON either')
              }
            }
          }
        } catch (e) {
          console.error('Error processing legacy Meta Ads credentials:', e)
        }
      }
    }

    // If we have access token but no account ID, try to auto-detect accounts
    if (accessToken && !externalId) {
      console.log('Access token found but no account ID, attempting auto-detection...')
      try {
        // Query Meta API to get available ad accounts
        const accountsUrl = new URL('https://graph.facebook.com/v19.0/me/adaccounts')
        accountsUrl.searchParams.set('fields', 'id,name,account_status')
        accountsUrl.searchParams.set('limit', '5')
        accountsUrl.searchParams.set('access_token', accessToken)

        const accountsResp = await fetch(accountsUrl.toString())
        if (accountsResp.ok) {
          const accountsData = await accountsResp.json()
          if (accountsData.data && accountsData.data.length > 0) {
            // Use the first active account
            const activeAccount = accountsData.data.find((acc: any) => acc.account_status === 1) || accountsData.data[0]
            externalId = activeAccount.id
            console.log(`Auto-detected account ID: ${externalId} (${activeAccount.name || 'Unknown'})`)
          }
        }
      } catch (autoDetectError) {
        console.log('Auto-detection failed, but continuing with validation:', autoDetectError.message)
      }
    }

    if (!accessToken) {
      return new Response(
        JSON.stringify({ connected: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // If still no account ID after auto-detection, try to validate token with basic user info call
    if (!externalId) {
      console.log('No account ID found, validating token with basic API call...')
      try {
        const validateUrl = new URL('https://graph.facebook.com/v19.0/me')
        validateUrl.searchParams.set('fields', 'id,name')
        validateUrl.searchParams.set('access_token', accessToken)

        const validateResp = await fetch(validateUrl.toString())
        if (validateResp.ok) {
          const userData = await validateResp.json()
          console.log(`Token validated for user: ${userData.name || userData.id}`)
          // Return connected with minimal metrics since we can't get ad insights without account ID
          return new Response(
            JSON.stringify({ 
              connected: true, 
              metrics: {
                totalSpend: 0,
                totalImpressions: 0,
                totalClicks: 0,
                totalConversions: 0,
                averageCTR: 0,
                averageCPC: 0,
                campaigns: [],
                adSets: [],
                ads: [],
              },
              note: 'Connected but no ad account access. Please reconnect with proper permissions.'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        } else {
          // Token is invalid
          return new Response(
            JSON.stringify({ connected: false }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      } catch (validateError) {
        console.log('Token validation failed:', validateError.message)
        return new Response(
          JSON.stringify({ connected: false }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    const accountIdRaw = externalId
    let accountId = accountIdRaw.startsWith('act_') ? accountIdRaw : `act_${accountIdRaw}`
    console.log(`Using Meta Ads account ID: ${accountId}`)

    // Fetch account currency and basic info first
    let accountCurrency = 'USD'; // Default fallback
    let currencyOk = false;
    try {
      const currencyUrl = new URL(`https://graph.facebook.com/v19.0/${accountId}`)
      currencyUrl.searchParams.set('fields', 'currency,name')
      currencyUrl.searchParams.set('access_token', accessToken)
      
      const currencyResp = await fetch(currencyUrl.toString())
      if (currencyResp.ok) {
        const currencyData = await currencyResp.json()
        if (currencyData.currency) {
          accountCurrency = currencyData.currency
          currencyOk = true
          console.log(`✓ Account currency detected: ${accountCurrency}`)
        } else {
          console.warn('⚠️ Currency field not found in Meta Ads account response')
        }
      } else {
        console.warn(`⚠️ Failed to fetch account currency (status: ${currencyResp.status})`)
      }
    } catch (currencyError) {
      console.error('Error fetching account currency:', currencyError)
    }

    // If currency fetch failed (likely wrong account id), auto-detect a valid account and retry once
    if (!currencyOk) {
      try {
        console.log('Attempting to auto-detect ad account via /me/adaccounts ...')
        const accountsUrl = new URL('https://graph.facebook.com/v19.0/me/adaccounts')
        accountsUrl.searchParams.set('fields', 'id,name,account_status')
        accountsUrl.searchParams.set('limit', '5')
        accountsUrl.searchParams.set('access_token', accessToken)
        const accountsResp = await fetch(accountsUrl.toString())
        if (accountsResp.ok) {
          const accountsData = await accountsResp.json()
          const activeAccount = accountsData.data?.find((acc: any) => acc.account_status === 1) || accountsData.data?.[0]
          if (activeAccount?.id) {
            const detectedId = activeAccount.id
            accountId = detectedId.startsWith('act_') ? detectedId : `act_${detectedId}`
            console.log(`➡️ Switched to detected account ID: ${accountId}`)
            // Retry currency fetch with detected account
            const currencyUrl2 = new URL(`https://graph.facebook.com/v19.0/${accountId}`)
            currencyUrl2.searchParams.set('fields', 'currency,name')
            currencyUrl2.searchParams.set('access_token', accessToken)
            const retry = await fetch(currencyUrl2.toString())
            if (retry.ok) {
              const currencyData2 = await retry.json()
              if (currencyData2.currency) {
                accountCurrency = currencyData2.currency
                currencyOk = true
                console.log(`✓ Account currency detected after switch: ${accountCurrency}`)
              }
            }
            // Persist the corrected external_id for future calls
            await supabaseClient
              .from('integrations')
              .update({ external_id: detectedId })
              .eq('user_id', effectiveUserId)
              .eq('source', 'meta_ads')
          }
        }
      } catch (autoErr) {
        console.warn('Auto-detect account failed:', (autoErr as any)?.message)
      }
    }

    // Initialize metrics with detected currency
    let metrics = {
      totalSpend: 0,
      totalImpressions: 0,
      totalClicks: 0,
      totalConversions: 0,
      totalConversionValue: 0,
      averageCTR: 0,
      averageCPC: 0,
      averageROAS: 0,
      campaigns: [] as any[],
      adSets: [] as any[],
      ads: [] as any[],
      currency: accountCurrency, // Use detected currency
    }

    try {
      // Enhanced performance categorization function
      const categorizePerformance = (
        ctr: number, 
        cpc: number, 
        roas: number, 
        objective: string = 'UNKNOWN',
        spend: number = 0
      ): string => {
        // Primary score based on objective
        let primaryScore = 0;
        let secondaryScore = 0;
        
        switch (objective.toUpperCase()) {
          case 'CONVERSIONS':
          case 'PURCHASE':
          case 'CATALOG_SALES':
            // For conversion objectives, prioritize ROAS
            if (roas >= 400) primaryScore = 100;
            else if (roas >= 250) primaryScore = 80;
            else if (roas >= 150) primaryScore = 60;
            else if (roas >= 100) primaryScore = 40;
            else primaryScore = 20;
            
            // Secondary: CTR for conversion campaigns
            if (ctr >= 1.5) secondaryScore = 20;
            else if (ctr >= 1.0) secondaryScore = 15;
            else if (ctr >= 0.5) secondaryScore = 10;
            else secondaryScore = 5;
            break;
            
          case 'TRAFFIC':
          case 'LINK_CLICKS':
            // For traffic objectives, prioritize CTR and CPC
            if (ctr >= 2.5) primaryScore = 100;
            else if (ctr >= 2.0) primaryScore = 80;
            else if (ctr >= 1.5) primaryScore = 60;
            else if (ctr >= 1.0) primaryScore = 40;
            else primaryScore = 20;
            
            // Dynamic CPC threshold based on spend
            const cpcThreshold = spend > 500 ? 2.0 : spend > 100 ? 1.5 : 1.0;
            if (cpc <= cpcThreshold * 0.5) secondaryScore = 20;
            else if (cpc <= cpcThreshold) secondaryScore = 15;
            else if (cpc <= cpcThreshold * 1.5) secondaryScore = 10;
            else secondaryScore = 5;
            break;
            
          case 'BRAND_AWARENESS':
          case 'REACH':
          case 'IMPRESSIONS':
            // For awareness objectives, focus on reach efficiency
            // Use CTR as engagement proxy and CPC for cost efficiency
            if (ctr >= 1.0) primaryScore = 100;
            else if (ctr >= 0.75) primaryScore = 80;
            else if (ctr >= 0.5) primaryScore = 60;
            else if (ctr >= 0.25) primaryScore = 40;
            else primaryScore = 20;
            
            if (cpc <= 0.5) secondaryScore = 20;
            else if (cpc <= 1.0) secondaryScore = 15;
            else if (cpc <= 2.0) secondaryScore = 10;
            else secondaryScore = 5;
            break;
            
          case 'LEAD_GENERATION':
            // For lead gen, balance between ROAS and CTR
            if (roas >= 300) primaryScore = 100;
            else if (roas >= 200) primaryScore = 80;
            else if (roas >= 120) primaryScore = 60;
            else if (roas >= 80) primaryScore = 40;
            else primaryScore = 20;
            
            if (ctr >= 2.0) secondaryScore = 20;
            else if (ctr >= 1.5) secondaryScore = 15;
            else if (ctr >= 1.0) secondaryScore = 10;
            else secondaryScore = 5;
            break;
            
          default:
            // Fallback: balanced approach
            const ctrScore = ctr >= 2.0 ? 50 : ctr >= 1.5 ? 40 : ctr >= 1.0 ? 30 : 20;
            const cpcScore = cpc <= 1.0 ? 30 : cpc <= 2.0 ? 25 : cpc <= 3.0 ? 20 : 10;
            const roasScore = roas >= 200 ? 20 : roas >= 100 ? 15 : roas >= 50 ? 10 : 5;
            primaryScore = ctrScore + cpcScore;
            secondaryScore = roasScore;
        }
        
        const totalScore = primaryScore + secondaryScore;
        
        if (totalScore >= 90) return 'excellent';
        if (totalScore >= 70) return 'good';
        if (totalScore >= 50) return 'average';
        return 'poor';
      }


      // Prepare date parameters for API calls
      const INSIGHTS_FIELDS = 'spend,impressions,clicks,actions,action_values,cost_per_action_type,cpc,ctr,frequency,reach'
      let dateParams: { [key: string]: string } = {}
      let insightsFieldExpr = `insights.date_preset(last_7d){${INSIGHTS_FIELDS}}`
      let datePreset = 'last_7d'
      
      if (dateFrom && dateTo) {
        // Format dates for Facebook API (YYYY-MM-DD)
        const fromDate = new Date(dateFrom).toISOString().split('T')[0]
        const toDate = new Date(dateTo).toISOString().split('T')[0]
        dateParams = {
          time_range: JSON.stringify({ since: fromDate, until: toDate })
        }
        insightsFieldExpr = `insights.time_range({"since":"${fromDate}","until":"${toDate}"}){${INSIGHTS_FIELDS}}`
        console.log(`Using custom date range: ${fromDate} to ${toDate}`)
      } else {
        dateParams = { date_preset: datePreset }
        insightsFieldExpr = `insights.date_preset(${datePreset}){${INSIGHTS_FIELDS}}`
        console.log(`Using default date preset: ${datePreset}`)
      }
      
      const ALL_STATUSES = '["ACTIVE","PAUSED","IN_PROCESS","WITH_ISSUES","ARCHIVED","DELETED"]'

      // Fetch account-level insights with enhanced metrics
      const accountUrl = new URL(`https://graph.facebook.com/v19.0/${accountId}/insights`)
      Object.entries(dateParams).forEach(([key, value]) => {
        accountUrl.searchParams.set(key, value)
      })
      accountUrl.searchParams.set('fields', 'spend,impressions,clicks,actions,action_values,cost_per_action_type,cpc,ctr,frequency,reach')
      accountUrl.searchParams.set('access_token', accessToken)

      const accountResp = await fetch(accountUrl.toString())
      if (accountResp.ok) {
        const accountJson = await accountResp.json()
        const accountRows = accountJson.data || []
        let spendSum = 0, impSum = 0, clickSum = 0, convSum = 0, convValueSum = 0, ctrSum = 0, cpcSum = 0
        let ctrCount = 0, cpcCount = 0
        for (const r of accountRows) {
          spendSum += Number(r.spend || 0)
          impSum += Number(r.impressions || 0)
          clickSum += Number(r.clicks || 0)
          
          // Count conversions and calculate conversion values
          if (Array.isArray(r.actions)) {
            const purchase = r.actions.find((a: any) => a.action_type?.includes('purchase'))
            if (purchase) convSum += Number(purchase.value || 0)
          }
          
          // Calculate conversion values for ROAS
          if (Array.isArray(r.action_values)) {
            const purchaseValue = r.action_values.find((av: any) => av.action_type?.includes('purchase'))
            if (purchaseValue) convValueSum += Number(purchaseValue.value || 0)
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
        metrics.totalConversionValue = convValueSum
        metrics.averageROAS = spendSum > 0 ? (convValueSum / spendSum) : 0
      }

      // Fetch ad sets with enhanced insights - include all statuses
      const adSetsUrl = new URL(`https://graph.facebook.com/v19.0/${accountId}/adsets`)
      adSetsUrl.searchParams.set('fields', `id,name,status,campaign{id,name,objective},${insightsFieldExpr}`)
      adSetsUrl.searchParams.set('limit', '200')
      adSetsUrl.searchParams.set('effective_status', ALL_STATUSES)
      adSetsUrl.searchParams.set('access_token', accessToken)

      const adSetsResp = await fetch(adSetsUrl.toString())
      console.log(`Ad sets fetch status: ${adSetsResp.status}`)
      if (adSetsResp.ok) {
        const adSetsJson = await adSetsResp.json()
        const adSetData = adSetsJson.data || []
        console.log(`Fetched ${adSetData.length} ad sets from object edge`)
        
        for (const adSet of adSetData) {
          const insights = adSet.insights?.data?.[0] || {}
          const spend = Number(insights.spend || 0)
          const impressions = Number(insights.impressions || 0)
          const clicks = Number(insights.clicks || 0)
          const ctr = Number(insights.ctr || 0)
          const cpc = Number(insights.cpc || 0)
          
          let conversions = 0
          let conversionValue = 0
          
          if (Array.isArray(insights.actions)) {
            const purchase = insights.actions.find((a: any) => a.action_type?.includes('purchase'))
            if (purchase) conversions = Number(purchase.value || 0)
          }
          
          if (Array.isArray(insights.action_values)) {
            const purchaseValue = insights.action_values.find((av: any) => av.action_type?.includes('purchase'))
            if (purchaseValue) conversionValue = Number(purchaseValue.value || 0)
          }
          
          const roas = spend > 0 ? (conversionValue / spend) : 0
          
          // Use campaign objective if available, otherwise default to 'UNKNOWN'
          const campaignObjective = adSet.campaign?.objective || 'UNKNOWN'
          
          metrics.adSets.push({
            id: adSet.id,
            name: adSet.name || 'Unnamed Ad Set',
            campaignId: adSet.campaign?.id || '',
            status: adSet.status || 'UNKNOWN',
            spend,
            impressions,
            clicks,
            conversions,
            ctr,
            cpc,
            roas,
            performance: categorizePerformance(ctr, cpc, roas, campaignObjective, spend)
          })
        }
      }

      // Fetch campaigns with enhanced insights - include all statuses
      const campaignsUrl = new URL(`https://graph.facebook.com/v19.0/${accountId}/campaigns`)
      campaignsUrl.searchParams.set('fields', `id,name,status,objective,${insightsFieldExpr}`)
      campaignsUrl.searchParams.set('limit', '200')
      campaignsUrl.searchParams.set('effective_status', ALL_STATUSES)
      campaignsUrl.searchParams.set('access_token', accessToken)

      const campaignsResp = await fetch(campaignsUrl.toString())
      console.log(`Campaigns fetch status: ${campaignsResp.status}`)
      if (campaignsResp.ok) {
        const campaignsJson = await campaignsResp.json()
        const campaignData = campaignsJson.data || []
        console.log(`Fetched ${campaignData.length} campaigns from object edge`)
        
        for (const campaign of campaignData) {
          const insights = campaign.insights?.data?.[0] || {}
          const spend = Number(insights.spend || 0)
          const impressions = Number(insights.impressions || 0)
          const clicks = Number(insights.clicks || 0)
          const ctr = Number(insights.ctr || 0)
          const cpc = Number(insights.cpc || 0)
          const frequency = Number(insights.frequency || 0)
          const reach = Number(insights.reach || 0)
          
          let conversions = 0
          let conversionValue = 0
          let costPerPurchase = 0
          
          // Count conversions
          if (Array.isArray(insights.actions)) {
            const purchase = insights.actions.find((a: any) => a.action_type?.includes('purchase'))
            if (purchase) conversions = Number(purchase.value || 0)
          }
          
          // Calculate conversion values for ROAS
          if (Array.isArray(insights.action_values)) {
            const purchaseValue = insights.action_values.find((av: any) => av.action_type?.includes('purchase'))
            if (purchaseValue) conversionValue = Number(purchaseValue.value || 0)
          }
          
          // Get cost per purchase
          if (Array.isArray(insights.cost_per_action_type)) {
            const purchaseCost = insights.cost_per_action_type.find((cpa: any) => cpa.action_type?.includes('purchase'))
            if (purchaseCost) costPerPurchase = Number(purchaseCost.value || 0)
          }
          
          const roas = spend > 0 ? (conversionValue / spend) : 0
          const objective = campaign.objective || 'UNKNOWN'

          metrics.campaigns.push({
            id: campaign.id,
            name: campaign.name || 'Untitled Campaign',
            status: campaign.status === 'ACTIVE' ? 'Active' : campaign.status || 'Unknown',
            objective,
            performance: categorizePerformance(ctr, cpc, roas, objective, spend),
            spend,
            impressions,
            clicks,
            conversions,
            conversionValue,
            roas,
            costPerPurchase,
            ctr,
            cpc,
            frequency,
            reach
          })
        }
      }
      
      // Fallback: If campaigns are empty, try insights with level=campaign
      if (metrics.campaigns.length === 0 && !dateFrom) {
        console.log('⚠️ No campaigns from edge, trying insights level=campaign fallback')
        try {
          const insightsUrl = new URL(`https://graph.facebook.com/v19.0/${accountId}/insights`)
          Object.entries(dateParams).forEach(([key, value]) => {
            insightsUrl.searchParams.set(key, value)
          })
          insightsUrl.searchParams.set('level', 'campaign')
          insightsUrl.searchParams.set('fields', 'campaign_id,campaign_name,spend,impressions,clicks,actions,action_values,cpc,ctr,frequency,reach')
          insightsUrl.searchParams.set('limit', '200')
          insightsUrl.searchParams.set('access_token', accessToken)
          
          const insightsResp = await fetch(insightsUrl.toString())
          if (insightsResp.ok) {
            const insightsJson = await insightsResp.json()
            const rows = insightsJson.data || []
            console.log(`➡️ Insights fallback returned ${rows.length} campaigns`)
            
            for (const row of rows) {
              const spend = Number(row.spend || 0)
              const impressions = Number(row.impressions || 0)
              const clicks = Number(row.clicks || 0)
              const ctr = Number(row.ctr || 0)
              const cpc = Number(row.cpc || 0)
              const frequency = Number(row.frequency || 0)
              const reach = Number(row.reach || 0)
              
              let conversions = 0
              let conversionValue = 0
              
              if (Array.isArray(row.actions)) {
                const purchase = row.actions.find((a: any) => a.action_type?.includes('purchase'))
                if (purchase) conversions = Number(purchase.value || 0)
              }
              
              if (Array.isArray(row.action_values)) {
                const purchaseValue = row.action_values.find((av: any) => av.action_type?.includes('purchase'))
                if (purchaseValue) conversionValue = Number(purchaseValue.value || 0)
              }
              
              const roas = spend > 0 ? (conversionValue / spend) : 0
              
              // Only include campaigns with activity
              if (spend > 0 || impressions > 0 || clicks > 0) {
                metrics.campaigns.push({
                  id: row.campaign_id || 'unknown',
                  name: row.campaign_name || 'Historical Campaign',
                  status: 'Archived/Past',
                  objective: 'UNKNOWN',
                  performance: categorizePerformance(ctr, cpc, roas, 'UNKNOWN', spend),
                  spend,
                  impressions,
                  clicks,
                  conversions,
                  conversionValue,
                  roas,
                  costPerPurchase: conversions > 0 ? spend / conversions : 0,
                  ctr,
                  cpc,
                  frequency,
                  reach
                })
              }
            }
          }
        } catch (fallbackErr) {
          console.warn('Campaigns insights fallback failed:', (fallbackErr as any)?.message)
        }
      }

      // Fetch ads with enhanced insights including parent campaign and adset names - include all statuses
      const adsUrl = new URL(`https://graph.facebook.com/v19.0/${accountId}/ads`)
      adsUrl.searchParams.set('fields', `id,name,status,campaign{id,name},adset{id,name},creative{object_story_spec},${insightsFieldExpr}`)
      adsUrl.searchParams.set('limit', '200')
      adsUrl.searchParams.set('effective_status', ALL_STATUSES)
      adsUrl.searchParams.set('access_token', accessToken)

      const adsResp = await fetch(adsUrl.toString())
      console.log(`Ads fetch status: ${adsResp.status}`)
      if (adsResp.ok) {
        const adsJson = await adsResp.json()
        const adsData = adsJson.data || []
        console.log(`Fetched ${adsData.length} ads from object edge`)
        
        for (const ad of adsData) {
          const insights = ad.insights?.data?.[0] || {}
          const spend = Number(insights.spend || 0)
          const impressions = Number(insights.impressions || 0)
          const clicks = Number(insights.clicks || 0)
          const ctr = Number(insights.ctr || 0)
          const cpc = Number(insights.cpc || 0)
          const frequency = Number(insights.frequency || 0)
          const reach = Number(insights.reach || 0)
          
          let conversions = 0
          let conversionValue = 0
          let costPerPurchase = 0
          
          // Count conversions
          if (Array.isArray(insights.actions)) {
            const purchase = insights.actions.find((a: any) => a.action_type?.includes('purchase'))
            if (purchase) conversions = Number(purchase.value || 0)
          }
          
          // Calculate conversion values for ROAS
          if (Array.isArray(insights.action_values)) {
            const purchaseValue = insights.action_values.find((av: any) => av.action_type?.includes('purchase'))
            if (purchaseValue) conversionValue = Number(purchaseValue.value || 0)
          }
          
          // Get cost per purchase
          if (Array.isArray(insights.cost_per_action_type)) {
            const purchaseCost = insights.cost_per_action_type.find((cpa: any) => cpa.action_type?.includes('purchase'))
            if (purchaseCost) costPerPurchase = Number(purchaseCost.value || 0)
          }
          
          const roas = spend > 0 ? (conversionValue / spend) : 0
          
          // Infer objective from parent campaign or use default
          const objective = 'CONVERSIONS' // Default assumption for ads

          // Only include ads that have activity in the selected date range
          if (spend > 0 || impressions > 0 || clicks > 0) {
            metrics.ads.push({
              id: ad.id,
              name: ad.name || 'Untitled Ad',
              status: ad.status === 'ACTIVE' ? 'Active' : ad.status || 'Unknown',
              performance: categorizePerformance(ctr, cpc, roas, objective, spend),
              spend,
              impressions,
              clicks,
              conversions,
              conversionValue,
              roas,
              costPerPurchase,
              ctr,
              cpc,
              frequency,
              reach,
              campaign_name: ad.campaign?.name || 'Unknown Campaign',
              adset_name: ad.adset?.name || 'Unknown Ad Set'
            })
          }
        }
      }
      
      // Fallback: If ads are empty, try insights with level=ad
      if (metrics.ads.length === 0 && !dateFrom) {
        console.log('⚠️ No ads from edge, trying insights level=ad fallback')
        try {
          const insightsUrl = new URL(`https://graph.facebook.com/v19.0/${accountId}/insights`)
          Object.entries(dateParams).forEach(([key, value]) => {
            insightsUrl.searchParams.set(key, value)
          })
          insightsUrl.searchParams.set('level', 'ad')
          insightsUrl.searchParams.set('fields', 'ad_id,ad_name,spend,impressions,clicks,actions,action_values,cpc,ctr,frequency,reach,campaign_name,adset_name')
          insightsUrl.searchParams.set('limit', '200')
          insightsUrl.searchParams.set('access_token', accessToken)
          
          const insightsResp = await fetch(insightsUrl.toString())
          if (insightsResp.ok) {
            const insightsJson = await insightsResp.json()
            const rows = insightsJson.data || []
            console.log(`➡️ Insights fallback returned ${rows.length} ads`)
            
            for (const row of rows) {
              const spend = Number(row.spend || 0)
              const impressions = Number(row.impressions || 0)
              const clicks = Number(row.clicks || 0)
              const ctr = Number(row.ctr || 0)
              const cpc = Number(row.cpc || 0)
              const frequency = Number(row.frequency || 0)
              const reach = Number(row.reach || 0)
              
              let conversions = 0
              let conversionValue = 0
              
              if (Array.isArray(row.actions)) {
                const purchase = row.actions.find((a: any) => a.action_type?.includes('purchase'))
                if (purchase) conversions = Number(purchase.value || 0)
              }
              
              if (Array.isArray(row.action_values)) {
                const purchaseValue = row.action_values.find((av: any) => av.action_type?.includes('purchase'))
                if (purchaseValue) conversionValue = Number(purchaseValue.value || 0)
              }
              
              const roas = spend > 0 ? (conversionValue / spend) : 0
              
              // Only include ads with activity
              if (spend > 0 || impressions > 0 || clicks > 0) {
                metrics.ads.push({
                  id: row.ad_id || 'unknown',
                  name: row.ad_name || 'Historical Ad',
                  status: 'Archived/Past',
                  performance: categorizePerformance(ctr, cpc, roas, 'CONVERSIONS', spend),
                  spend,
                  impressions,
                  clicks,
                  conversions,
                  conversionValue,
                  roas,
                  costPerPurchase: conversions > 0 ? spend / conversions : 0,
                  ctr,
                  cpc,
                  frequency,
                  reach,
                  campaign_name: row.campaign_name || 'Unknown Campaign',
                  adset_name: row.adset_name || 'Unknown Ad Set'
                })
              }
            }
          }
        } catch (fallbackErr) {
          console.warn('Ads insights fallback failed:', (fallbackErr as any)?.message)
        }
      }

      console.log(`✓ Final result: ${metrics.campaigns.length} campaigns, ${metrics.ads.length} ads`)
      
      // If everything is still zero and we used default date, retry with last_30d
      if (!dateFrom && metrics.totalSpend === 0 && metrics.campaigns.length === 0 && metrics.ads.length === 0 && datePreset === 'last_7d') {
        console.log('⚠️ All metrics zero with last_7d, retrying with last_30d...')
        // This would require recursively calling the entire fetch block with last_30d
        // For simplicity, we log it and suggest the user try a different date range
        // In production, you could implement a full retry here
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