import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[check-access-expiry] Starting access expiry check...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date().toISOString();

    // Find enrollments where access has expired but status is still active
    const { data: expiredEnrollments, error: fetchError } = await supabase
      .from('course_enrollments')
      .select('id, student_id, course_id, access_expires_at')
      .lt('access_expires_at', now)
      .eq('status', 'active');

    if (fetchError) {
      console.error('[check-access-expiry] Error fetching expired enrollments:', fetchError);
      throw fetchError;
    }

    console.log(`[check-access-expiry] Found ${expiredEnrollments?.length || 0} expired enrollments`);

    if (!expiredEnrollments || expiredEnrollments.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No expired enrollments found',
          processed: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update expired enrollments status
    const enrollmentIds = expiredEnrollments.map(e => e.id);
    
    const { error: updateError } = await supabase
      .from('course_enrollments')
      .update({ 
        status: 'expired',
        updated_at: now
      })
      .in('id', enrollmentIds);

    if (updateError) {
      console.error('[check-access-expiry] Error updating enrollments:', updateError);
      throw updateError;
    }

    console.log(`[check-access-expiry] Updated ${enrollmentIds.length} enrollments to expired status`);

    // Create notifications for affected students
    const notifications = expiredEnrollments.map(enrollment => ({
      user_id: enrollment.student_id,
      type: 'access_expired',
      channel: 'in_app',
      status: 'sent',
      payload: {
        title: 'Course Access Expired',
        message: 'Your access to a course has expired. Please contact support if you need to renew.',
        metadata: {
          course_id: enrollment.course_id,
          expired_at: enrollment.access_expires_at
        }
      }
    }));

    // Batch insert notifications (ignore errors as notifications are non-critical)
    if (notifications.length > 0) {
      const { error: notifError } = await supabase
        .from('notifications')
        .insert(notifications);
      
      if (notifError) {
        console.warn('[check-access-expiry] Error creating notifications (non-critical):', notifError);
      } else {
        console.log(`[check-access-expiry] Created ${notifications.length} notifications`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${enrollmentIds.length} expired enrollments`,
        processed: enrollmentIds.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[check-access-expiry] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
