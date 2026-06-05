import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

interface HeartbeatBody {
  session_token: string
  device_fingerprint?: string
  user_agent?: string
  device_label?: string
  current_activity?: Record<string, unknown> | null
  end?: boolean
}

function parseIp(req: Request): string | null {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip')
}

async function lookupGeo(ip: string | null): Promise<{ country?: string; city?: string; region?: string }> {
  if (!ip || ip === '127.0.0.1' || ip.startsWith('::')) return {}

  // Try ipwho.is first — generally more accurate for South Asia than ipapi.co
  try {
    const r = await fetch(`https://ipwho.is/${ip}`, { headers: { 'User-Agent': 'lms-session-heartbeat/1.0' } })
    if (r.ok) {
      const j = await r.json()
      if (j && j.success !== false && (j.city || j.country)) {
        return { country: j.country, city: j.city, region: j.region }
      }
    }
  } catch { /* fall through */ }

  // Fallback: ip-api.com (HTTPS via pro is paid, but http works server-side from Deno)
  try {
    const r = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city`)
    if (r.ok) {
      const j = await r.json()
      if (j && j.status === 'success' && (j.city || j.country)) {
        return { country: j.country, city: j.city, region: j.regionName }
      }
    }
  } catch { /* fall through */ }

  // Final fallback: ipapi.co
  try {
    const r = await fetch(`https://ipapi.co/${ip}/json/`, { headers: { 'User-Agent': 'lms-session-heartbeat/1.0' } })
    if (!r.ok) return {}
    const j = await r.json()
    return { country: j.country_name || j.country, city: j.city, region: j.region }
  } catch {
    return {}
  }
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
      .select('id, ip_address, country, city, region, first_seen_at')
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
    // Only resolve geo when IP changed or first time
    if (!existing || existing.ip_address !== ip) {
      const geo = await lookupGeo(ip)
      country = geo.country ?? country
      city = geo.city ?? city
      region = geo.region ?? region
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
