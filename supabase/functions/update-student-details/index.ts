import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { SMTPClient } from '../_shared/smtp-client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UpdateStudentRequest {
  user_id: string;
  full_name: string;
  email: string;
  phone?: string;
  resend_credentials?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Check if user has permission (superadmin or admin)
    const { data: currentUser, error: roleError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (roleError || !currentUser) {
      throw new Error('Failed to verify user permissions');
    }

    if (!['superadmin', 'admin'].includes(currentUser.role)) {
      throw new Error('Insufficient permissions');
    }

    const { user_id, full_name, email, phone, resend_credentials }: UpdateStudentRequest = await req.json();

    if (!user_id || !full_name || !email) {
      throw new Error('Missing required fields');
    }

    // Get current student details
    const { data: existingUser, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('email, password_display')
      .eq('id', user_id)
      .single();

    if (fetchError || !existingUser) {
      throw new Error('Student not found');
    }

    const oldEmail = existingUser.email;
    const emailChanged = email !== oldEmail;

    // Update user in auth.users
    const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
      user_id,
      { email: email }
    );

    if (authUpdateError) {
      throw new Error(`Failed to update auth user: ${authUpdateError.message}`);
    }

    // Update user in public.users
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        full_name,
        email,
        phone: phone || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', user_id);

    if (updateError) {
      throw new Error(`Failed to update user: ${updateError.message}`);
    }

    // If email changed and credentials should be resent
    if (emailChanged && resend_credentials && existingUser.password_display) {
      try {
        // Get company details
        const { data: companySettings } = await supabaseAdmin
          .from('company_settings')
          .select('company_name, company_logo, lms_url')
          .single();

        const companyName = companySettings?.company_name || 'Growth OS';
        const loginUrl = companySettings?.lms_url || Deno.env.get('SUPABASE_URL') || '';

        // Send credentials email
        const smtpClient = SMTPClient.fromEnv();
        await smtpClient.send({
          to: email,
          subject: `${companyName} - Updated Login Credentials`,
          html: `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <style>
                  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                  .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
                  .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 5px 5px; }
                  .credentials { background-color: white; padding: 20px; border-radius: 5px; margin: 20px 0; border: 1px solid #e5e7eb; }
                  .credential-row { margin: 10px 0; }
                  .label { font-weight: bold; color: #6b7280; }
                  .value { color: #111827; font-family: monospace; background-color: #f3f4f6; padding: 5px 10px; border-radius: 3px; display: inline-block; }
                  .button { display: inline-block; background-color: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                  .footer { text-align: center; color: #6b7280; margin-top: 30px; font-size: 14px; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1>${companyName}</h1>
                  </div>
                  <div class="content">
                    <h2>Your Email Has Been Updated</h2>
                    <p>Hello ${full_name},</p>
                    <p>Your email address has been updated by an administrator. Here are your login credentials for future reference:</p>
                    
                    <div class="credentials">
                      <div class="credential-row">
                        <span class="label">New Email:</span><br>
                        <span class="value">${email}</span>
                      </div>
                      <div class="credential-row">
                        <span class="label">Password:</span><br>
                        <span class="value">${existingUser.password_display}</span>
                      </div>
                    </div>
                    
                    <p>You can use these credentials to access your account:</p>
                    <center>
                      <a href="${loginUrl}" class="button">Login to Platform</a>
                    </center>
                    
                    <div class="footer">
                      <p>If you did not request this change, please contact support immediately.</p>
                      <p>&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
                    </div>
                  </div>
                </div>
              </body>
            </html>
          `,
        });

        console.log(`Credentials email sent to ${email}`);
      } catch (emailError) {
        console.error('Error sending credentials email:', emailError);
        // Don't fail the request if email fails
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Student details updated successfully',
        email_sent: emailChanged && resend_credentials
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('Error updating student details:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
