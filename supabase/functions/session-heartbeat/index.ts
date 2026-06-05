import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

interface HeartbeatBody {
  session_token: string
  device_fingerprint?: string
  user_agent?: string
  device_label?: string
  current_activity?: Record<string, unknown> | null
  coords?: { latitude: number; longitude: number; accuracy?: number } | null
  end?: boolean
}

function parseIp(req: Request): string | null {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip')
}

async function reverseGeocode(lat: number, lon: number): Promise<{ country?: string; city?: string; region?: string }> {
  // BigDataCloud — free, no API key, accurate reverse-geocoding
  try {
    const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`)
    if (r.ok) {
      const j = await r.json()
      const city = j.city || j.locality || j.localityInfo?.administrative?.[3]?.name
      if (city || j.countryName) {
        return { country: j.countryName, city, region: j.principalSubdivision }
      }
    }
  } catch { /* fall through */ }

  // Fallback: Nominatim (OSM)
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`, {
      headers: { 'User-Agent': 'lms-session-heartbeat/1.0' },
    })
    if (r.ok) {
      const j = await r.json()
      const a = j.address || {}
      return {
        country: a.country,
        city: a.city || a.town || a.village || a.suburb || a.county,
        region: a.state || a.region,
      }
    }
  } catch { /* noop */ }

  return {}
}

async function lookupGeoByIp(ip: string | null): Promise<{ country?: string; city?: string; region?: string }> {
  if (!ip || ip === '127.0.0.1' || ip.startsWith('::')) return {}
  try {
    const r = await fetch(`https://ipwho.is/${ip}`)
    if (r.ok) {
      const j = await r.json()
      if (j && j.success !== false && (j.city || j.country)) {
        return { country: j.country, city: j.city, region: j.region }
      }
    }
  } catch { /* fall through */ }
  try {
    const r = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city`)
    if (r.ok) {
      const j = await r.json()
      if (j && j.status === 'success' && (j.city || j.country)) {
        return { country: j.country, city: j.city, region: j.regionName }
      }
    }
  } catch { /* noop */ }
  return {}
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token)
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const userId = claimsData.claims.sub as string

    const body = (await req.json()) as HeartbeatBody
    if (!body?.session_token || typeof body.session_token !== 'string') {
      return new Response(JSON.stringify({ error: 'session_token required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // End session
    if (body.end) {
      await admin
        .from('student_sessions')
        .update({ ended_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('session_token', body.session_token)
      return new Response(JSON.stringify({ ok: true, ended: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Check if user has been globally revoked
    const { data: userRow } = await admin
      .from('users')
      .select('sessions_revoked_at')
      .eq('id', userId)
      .maybeSingle()

    // See if session already exists
    const { data: existing } = await admin
      .from('student_sessions')
      .select('id, ip_address, country, city, region, first_seen_at, latitude, longitude, geo_source')
      .eq('user_id', userId)
      .eq('session_token', body.session_token)
      .maybeSingle()

    // Revoke if session was created before revocation timestamp
    if (userRow?.sessions_revoked_at && existing?.first_seen_at && new Date(existing.first_seen_at) < new Date(userRow.sessions_revoked_at)) {
      await admin.from('student_sessions').update({ ended_at: new Date().toISOString() }).eq('id', existing.id)
      return new Response(JSON.stringify({ revoked: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const ip = parseIp(req)
    let country = existing?.country
    let city = existing?.city
    let region = existing?.region
    let latitude: number | null = existing?.latitude ?? null
    let longitude: number | null = existing?.longitude ?? null
    let accuracy: number | null = null
    let geo_source: string | null = existing?.geo_source ?? null

    if (body.coords && Number.isFinite(body.coords.latitude) && Number.isFinite(body.coords.longitude)) {
      const newLat = body.coords.latitude
      const newLon = body.coords.longitude
      accuracy = typeof body.coords.accuracy === 'number' ? body.coords.accuracy : null
      const moved =
        latitude == null || longitude == null ||
        Math.abs(newLat - latitude) > 0.01 || Math.abs(newLon - longitude) > 0.01
      latitude = newLat
      longitude = newLon
      if (moved || geo_source !== 'gps') {
        const geo = await reverseGeocode(newLat, newLon)
        country = geo.country ?? country
        city = geo.city ?? city
        region = geo.region ?? region
      }
      geo_source = 'gps'
    } else if (!existing || existing.ip_address !== ip) {
      // Fall back to IP-based geo only when no GPS is provided
      const geo = await lookupGeoByIp(ip)
      country = geo.country ?? country
      city = geo.city ?? city
      region = geo.region ?? region
      if (!geo_source) geo_source = 'ip'
    }

    const nowIso = new Date().toISOString()
    const row = {
      user_id: userId,
      session_token: body.session_token,
      device_fingerprint: body.device_fingerprint ?? null,
      user_agent: body.user_agent ?? null,
      device_label: body.device_label ?? null,
      ip_address: ip,
      country: country ?? null,
      city: city ?? null,
      region: region ?? null,
      latitude,
      longitude,
      geo_accuracy_m: accuracy,
      geo_source,
      current_activity: body.current_activity ?? null,
      last_heartbeat_at: nowIso,
      ended_at: null as string | null,
    }


    const { error: upErr } = await admin
      .from('student_sessions')
      .upsert(row, { onConflict: 'user_id,session_token' })

    if (upErr) {
      return new Response(JSON.stringify({ error: upErr.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
