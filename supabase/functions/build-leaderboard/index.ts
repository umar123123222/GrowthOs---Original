import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Building leaderboard snapshots...');

    // Create service role client for unrestricted access
    const supabaseServiceRole = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // 1. Get all active students
    const { data: activeStudents, error: studentsError } = await supabaseServiceRole
      .from('users')
      .select('id, full_name, email')
      .eq('role', 'student')
      .eq('status', 'active')
      .eq('lms_status', 'active');

    if (studentsError) {
      console.error('Error fetching students:', studentsError);
      throw studentsError;
    }

    console.log(`Found ${activeStudents?.length || 0} active students`);

    // 2. Get total available content
    const [lessonsCount, assignmentsCount] = await Promise.all([
      supabaseServiceRole.from('available_lessons').select('id', { count: 'exact', head: true }),
      supabaseServiceRole.from('assignments').select('id', { count: 'exact', head: true })
    ]);

    const totalVideos = lessonsCount.count || 0;
    const totalAssignments = assignmentsCount.count || 0;

    console.log(`Total content: ${totalVideos} videos, ${totalAssignments} assignments`);

    // 3. Batch fetch all student data
    const userIds = activeStudents?.map(s => s.id) || [];
    
    const [recordingViewsData, submissionsData, sessionAttendanceData, integrationsData] = await Promise.all([
      // Recording views (watched videos)
      supabaseServiceRole
        .from('recording_views')
        .select('user_id')
        .in('user_id', userIds)
        .eq('watched', true),
      
      // Approved submissions
      supabaseServiceRole
        .from('submissions')
        .select('student_id')
        .in('student_id', userIds)
        .eq('status', 'approved'),
      
      // Session attendance
      supabaseServiceRole
        .from('session_attendance')
        .select('user_id')
        .in('user_id', userIds),
      
      // Integrations
      supabaseServiceRole
        .from('integrations')
        .select('user_id, source')
        .in('user_id', userIds)
        .in('source', ['shopify', 'meta'])
    ]);

    // 4. Count per user
    const countsByUser = new Map();
    
    userIds.forEach(userId => {
      countsByUser.set(userId, {
        videosWatched: 0,
        assignmentsCompleted: 0,
        sessionsAttended: 0,
        hasShopify: false,
        hasMeta: false
      });
    });

    // Count videos watched
    recordingViewsData.data?.forEach(rv => {
      const counts = countsByUser.get(rv.user_id);
      if (counts) counts.videosWatched++;
    });

    // Count assignments completed
    submissionsData.data?.forEach(sub => {
      const counts = countsByUser.get(sub.student_id);
      if (counts) counts.assignmentsCompleted++;
    });

    // Count sessions attended
    sessionAttendanceData.data?.forEach(sa => {
      const counts = countsByUser.get(sa.user_id);
      if (counts) counts.sessionsAttended++;
    });

    // Mark integrations
    integrationsData.data?.forEach(int => {
      const counts = countsByUser.get(int.user_id);
      if (counts) {
        if (int.source === 'shopify') counts.hasShopify = true;
        if (int.source === 'meta') counts.hasMeta = true;
      }
    });

    // 5. Calculate scores and build snapshots
    const snapshots = activeStudents?.map(student => {
      const counts = countsByUser.get(student.id) || {
        videosWatched: 0,
        assignmentsCompleted: 0,
        sessionsAttended: 0,
        hasShopify: false,
        hasMeta: false
      };

      // Calculate weighted score (same weights as frontend)
      const videoScore = counts.videosWatched * 10;
      const assignmentScore = counts.assignmentsCompleted * 20;
      const sessionScore = counts.sessionsAttended * 15;
      const integrationScore = (counts.hasShopify ? 25 : 0) + (counts.hasMeta ? 25 : 0);
      const score = videoScore + assignmentScore + sessionScore + integrationScore;

      // Calculate progress percentage
      const videoProgress = totalVideos > 0 ? (counts.videosWatched / totalVideos) * 40 : 0;
      const assignmentProgress = totalAssignments > 0 ? (counts.assignmentsCompleted / totalAssignments) * 40 : 0;
      const integrationProgress = (counts.hasShopify ? 10 : 0) + (counts.hasMeta ? 10 : 0);
      const progress = Math.min(100, Math.round(videoProgress + assignmentProgress + integrationProgress));

      // Generate avatar initials
      const nameParts = student.full_name?.trim().split(' ') || ['?'];
      const initials = nameParts.length >= 2
        ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`
        : nameParts[0][0] || '?';

      // Simple streak calculation (can be enhanced later)
      const streak = counts.videosWatched > 0 ? Math.min(counts.videosWatched, 30) : 0;

      return {
        user_id: student.id,
        display_name: student.full_name || 'Unknown',
        avatar_initials: initials.toUpperCase(),
        score,
        progress,
        videos_watched: counts.videosWatched,
        assignments_completed: counts.assignmentsCompleted,
        milestones_completed: 0, // Can add milestone tracking later
        sessions_attended: counts.sessionsAttended,
        has_shopify: counts.hasShopify,
        has_meta: counts.hasMeta,
        streak,
        rank: 0, // Will be calculated after sorting
        calculated_at: new Date().toISOString()
      };
    }) || [];

    // 6. Sort by score and progress, assign ranks
    snapshots.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.progress - a.progress;
    });

    snapshots.forEach((snapshot, index) => {
      snapshot.rank = index + 1;
    });

    console.log(`Built ${snapshots.length} leaderboard snapshots`);

    // 7. Upsert snapshots (delete old, insert new)
    if (snapshots.length > 0) {
      // Delete existing snapshots
      await supabaseServiceRole
        .from('leaderboard_snapshots')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      // Insert new snapshots
      const { error: insertError } = await supabaseServiceRole
        .from('leaderboard_snapshots')
        .insert(snapshots);

      if (insertError) {
        console.error('Error inserting snapshots:', insertError);
        throw insertError;
      }

      console.log('Successfully upserted leaderboard snapshots');
    }

    return new Response(
      JSON.stringify({
        success: true,
        count: snapshots.length,
        message: `Leaderboard updated with ${snapshots.length} students`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error building leaderboard:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
