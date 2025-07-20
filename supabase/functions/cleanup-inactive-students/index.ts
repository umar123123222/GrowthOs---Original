import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting cleanup of inactive students...');

    // Calculate the date 2 weeks ago
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    
    // Find students who:
    // 1. Have LMS status 'inactive'
    // 2. Were created more than 2 weeks ago
    // 3. Have not made their first payment (no installment payments)
    const { data: inactiveStudents, error: fetchError } = await supabase
      .from('users')
      .select(`
        id,
        full_name,
        email,
        student_id,
        created_at,
        lms_status,
        installment_payments!inner(id)
      `)
      .eq('role', 'student')
      .eq('lms_status', 'inactive')
      .lt('created_at', twoWeeksAgo.toISOString());

    if (fetchError) {
      console.error('Error fetching inactive students:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${inactiveStudents?.length || 0} potentially inactive students`);

    // Filter out students who have made at least one payment
    const studentsToDelete = [];
    
    for (const student of inactiveStudents || []) {
      const { data: payments, error: paymentError } = await supabase
        .from('installment_payments')
        .select('id')
        .eq('user_id', student.id)
        .limit(1);

      if (paymentError) {
        console.error(`Error checking payments for student ${student.id}:`, paymentError);
        continue;
      }

      // If no payments found, mark for deletion
      if (!payments || payments.length === 0) {
        studentsToDelete.push(student);
      }
    }

    console.log(`${studentsToDelete.length} students will be deleted`);

    let deletedCount = 0;
    const deletedStudents = [];

    // Delete students one by one
    for (const student of studentsToDelete) {
      try {
        const { error: deleteError } = await supabase
          .from('users')
          .delete()
          .eq('id', student.id);

        if (deleteError) {
          console.error(`Error deleting student ${student.id}:`, deleteError);
          continue;
        }

        deletedStudents.push({
          id: student.id,
          name: student.full_name,
          email: student.email,
          student_id: student.student_id
        });
        
        deletedCount++;
        console.log(`Deleted student: ${student.full_name} (${student.student_id})`);
      } catch (error) {
        console.error(`Failed to delete student ${student.id}:`, error);
      }
    }

    console.log(`Cleanup complete. Deleted ${deletedCount} inactive students.`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Cleanup complete. Deleted ${deletedCount} inactive students.`,
        deletedCount,
        deletedStudents
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error('Error in cleanup function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
});