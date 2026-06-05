import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { SMTPClient } from "../_shared/smtp-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface NotificationRequest {
  batch_id: string;
  item_type: "RECORDING" | "LIVE_SESSION" | "ASSIGNMENT";
  item_id: string;
  title: string;
  description?: string;
  meeting_link?: string;
  start_datetime?: string;
  timeline_item_id?: string;
  mentor_name?: string;
  cta_path?: string;
  is_reminder?: boolean;
}

interface Student {
  id: string;
  email: string;
  full_name: string;
}

function generateEmailHTML(
  studentName: string,
  itemType: string,
  title: string,
  description: string | undefined,
  meetingLink: string | undefined,
  startDatetime: string | undefined,
  lmsUrl: string,
  companyName: string,
  mentorName?: string,
  ctaPath?: string,
  isReminder?: boolean,
): string {
  const firstName = studentName?.split(" ")[0] || "Student";
  const ctaUrl = ctaPath ? `${lmsUrl.replace(/\/$/, '')}${ctaPath.startsWith('/') ? ctaPath : '/' + ctaPath}` : lmsUrl;

  if (itemType === "RECORDING") {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Recording Available</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background-color: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="width: 60px; height: 60px; background-color: #10b981; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
          <span style="font-size: 28px;">🎬</span>
        </div>
        <h1 style="color: #1f2937; font-size: 24px; margin: 0;">New Recording Available!</h1>
      </div>
      
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
        Hi ${firstName},
      </p>
      
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
        A new recording is now available in your course!
      </p>
      
      <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
        <h2 style="color: #166534; font-size: 18px; margin: 0 0 10px 0;">📹 ${title}</h2>
        ${description ? `<p style="color: #4b5563; font-size: 14px; margin: 0;">${description}</p>` : ""}
      </div>
      
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
        Login to start watching now.
      </p>
      
      <div style="text-align: center;">
        <a href="${lmsUrl}" style="display: inline-block; background-color: #10b981; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
          Start Learning
        </a>
      </div>
      
      <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 40px;">
        ${companyName} • Keep up the great work! 🚀
      </p>
    </div>
  </div>
</body>
</html>`;
  }

  if (itemType === "LIVE_SESSION") {
    const formattedDate = startDatetime
      ? new Date(startDatetime).toLocaleString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZoneName: "short",
        })
      : "To be announced";

    const headline = isReminder ? "Starting in 3 Hours" : "You're Invited to a Live Session";
    const eyebrow = isReminder ? "Reminder" : "Live Session";
    const intro = isReminder
      ? "Your live session starts soon. Here are the details so you can join on time."
      : "A new live session has been scheduled for your batch. Here's everything you need to know.";
    const closing = isReminder
      ? "Tip: log in a few minutes early to settle in before it begins."
      : "Add it to your calendar so you don't miss it.";

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${headline}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f7; color: #1f2937;">
  <div style="max-width: 560px; margin: 0 auto; padding: 32px 16px;">
    <div style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(15,23,42,0.06); border: 1px solid #eef0f4;">
      <div style="background: linear-gradient(135deg, #6d28d9 0%, #8b5cf6 100%); padding: 32px;">
        <p style="color: rgba(255,255,255,0.85); font-size: 12px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; margin: 0 0 8px;">${eyebrow}</p>
        <h1 style="color: #ffffff; font-size: 24px; line-height: 1.3; margin: 0; font-weight: 700;">${headline}</h1>
      </div>

      <div style="padding: 32px;">
        <p style="color: #111827; font-size: 16px; line-height: 1.6; margin: 0 0 12px;">Hi ${firstName},</p>
        <p style="color: #4b5563; font-size: 15px; line-height: 1.65; margin: 0 0 24px;">${intro}</p>

        <div style="border: 1px solid #ececf3; border-radius: 12px; padding: 20px 22px; margin-bottom: 24px; background-color: #fafafe;">
          <p style="color: #111827; font-size: 17px; font-weight: 600; margin: 0 0 16px; line-height: 1.4;">${title}</p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; font-size: 14px; color: #374151;">
            <tr>
              <td style="padding: 6px 0; color: #6b7280; width: 90px; vertical-align: top;">Date</td>
              <td style="padding: 6px 0; color: #111827; font-weight: 500;">${formattedDate}</td>
            </tr>
            ${mentorName ? `<tr><td style="padding: 6px 0; color: #6b7280; vertical-align: top;">Mentor</td><td style="padding: 6px 0; color: #111827; font-weight: 500;">${mentorName}</td></tr>` : ""}
            ${description ? `<tr><td style="padding: 6px 0; color: #6b7280; vertical-align: top;">Details</td><td style="padding: 6px 0; color: #4b5563;">${description}</td></tr>` : ""}
          </table>
        </div>

        <div style="text-align: center; margin: 28px 0 12px;">
          <a href="${ctaUrl}" style="display: inline-block; background-color: #6d28d9; color: #ffffff; padding: 13px 28px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 15px;">
            View Live Sessions
          </a>
        </div>

        <p style="color: #6b7280; font-size: 13px; line-height: 1.6; margin: 16px 0 0; text-align: center;">${closing}</p>
      </div>

      <div style="padding: 18px 32px; border-top: 1px solid #f1f1f5; background-color: #fafafc; text-align: center;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">${companyName}</p>
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  // ASSIGNMENT
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Assignment Available</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background-color: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="width: 60px; height: 60px; background-color: #f59e0b; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
          <span style="font-size: 28px;">📝</span>
        </div>
        <h1 style="color: #1f2937; font-size: 24px; margin: 0;">New Assignment Available!</h1>
      </div>
      
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
        Hi ${firstName},
      </p>
      
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
        A new assignment has been unlocked for you!
      </p>
      
      <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
        <h2 style="color: #b45309; font-size: 18px; margin: 0 0 10px 0;">✍️ ${title}</h2>
        ${description ? `<p style="color: #4b5563; font-size: 14px; margin: 0;">${description}</p>` : ""}
      </div>
      
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
        Complete this before the next recording unlocks.
      </p>
      
      <div style="text-align: center;">
        <a href="${lmsUrl}" style="display: inline-block; background-color: #f59e0b; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
          View Assignment
        </a>
      </div>
      
      <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 40px;">
        ${companyName} • You've got this! 💪
      </p>
    </div>
  </div>
</body>
</html>`;
}

function getEmailSubject(itemType: string, title: string, isReminder?: boolean): string {
  switch (itemType) {
    case "RECORDING":
      return `New Recording Available: ${title}`;
    case "LIVE_SESSION":
      return isReminder ? `Reminder: ${title} starts in 3 hours` : `Live Session Scheduled: ${title}`;
    case "ASSIGNMENT":
      return `New Assignment Available: ${title}`;
    default:
      return `New Content Available: ${title}`;
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const notificationCcSecret = Deno.env.get("NOTIFICATION_EMAIL_CC");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch company settings for sender branding and LMS links.
    const { data: companySettings, error: companySettingsError } = await supabase
      .from('company_settings')
      .select('company_name, lms_url')
      .limit(1)
      .maybeSingle();
    if (companySettingsError) {
      console.error('[send-batch-content-notification] Failed to load company_settings:', companySettingsError);
    }
    const companyName = companySettings?.company_name || 'IDMPakistan';
    const lmsUrl = companySettings?.lms_url || Deno.env.get("LMS_URL") || "https://growthos.idmpakistan.pk";
    const notificationCc = notificationCcSecret;

    const body: NotificationRequest = await req.json();
    const {
      batch_id,
      item_type,
      item_id,
      title,
      description,
      meeting_link,
      start_datetime,
      timeline_item_id,
      mentor_name,
      cta_path,
      is_reminder,
    } = body;

    // Validate required fields
    if (!batch_id || !item_type || !item_id || !title) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: batch_id, item_type, item_id, title" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing notification for batch ${batch_id}, type: ${item_type}, title: ${title}`);

    // Get batch details
    const { data: batch, error: batchError } = await supabase
      .from("batches")
      .select("id, name, start_date")
      .eq("id", batch_id)
      .single();

    if (batchError || !batch) {
      console.error("Batch not found:", batchError);
      return new Response(
        JSON.stringify({ error: "Batch not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get enrolled students for this batch without relying on PostgREST joins.
    // course_enrollments stores students.id in student_id, then students.user_id points to users.id.
    const { data: enrollments, error: enrollmentError } = await supabase
      .from("course_enrollments")
      .select("student_id")
      .eq("batch_id", batch_id)
      .eq("status", "active");

    if (enrollmentError) {
      console.error("Error fetching enrollments:", enrollmentError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch enrolled students" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const studentIds = Array.from(new Set((enrollments || []).map((e: any) => e.student_id).filter(Boolean)));
    let userIds: string[] = [];

    if (studentIds.length > 0) {
      const { data: studentRows, error: studentsError } = await supabase
        .from("students")
        .select("id, user_id")
        .in("id", studentIds);

      if (studentsError) {
        console.error("Error fetching student user IDs:", studentsError);
        return new Response(
          JSON.stringify({ error: "Failed to fetch enrolled students" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      userIds = Array.from(new Set((studentRows || []).map((student: any) => student.user_id).filter(Boolean)));
    }

    let usersById = new Map<string, { id: string; email: string; full_name: string }>();
    if (userIds.length > 0) {
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("id, email, full_name")
        .in("id", userIds);
      if (usersError) {
        console.error("Error fetching users:", usersError);
        return new Response(
          JSON.stringify({ error: "Failed to fetch enrolled students" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      usersById = new Map((usersData || []).map((u: any) => [u.id, u]));
    }

    if (!enrollments || enrollments.length === 0) {
      console.log("No students enrolled in this batch");
      return new Response(
        JSON.stringify({ message: "No students enrolled in batch", sent: 0, failed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract unique students
    const students: Student[] = Array.from(usersById.values())
      .filter((u) => !!u.email)
      .map((u) => ({
        id: u.id,
        email: u.email,
        full_name: u.full_name || "Student",
      }));

    console.log(`Sending notifications to ${students.length} students`);

    // Initialize SMTP client
    let smtpClient: SMTPClient | null = null;
    try {
      smtpClient = SMTPClient.fromEnv();
      smtpClient.setFromName(companyName);
    } catch (error) {
      console.error("SMTP not configured, will queue emails:", error);
    }

    let sentCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const student of students) {
      try {
        const emailHtml = generateEmailHTML(
          student.full_name,
          item_type,
          title,
          description,
          meeting_link,
          start_datetime,
          lmsUrl,
          companyName,
          mentor_name,
          cta_path,
          is_reminder,
        );
        const subject = getEmailSubject(item_type, title, is_reminder);

        if (smtpClient) {
          // Send directly via SMTP
          await smtpClient.sendEmail({
            to: student.email,
            subject,
            html: emailHtml,
            cc: notificationCc,
          });
          console.log(`Email sent to ${student.email}`);
        } else {
          // Queue email for later processing
          await supabase.from("email_queue").insert({
            recipient_email: student.email,
            subject,
            html_content: emailHtml,
            cc_email: notificationCc,
            status: "pending",
          });
          console.log(`Email queued for ${student.email}`);
        }

        // Create in-app notification
        const actionUrl = cta_path
          ? `${lmsUrl.replace(/\/$/, '')}${cta_path.startsWith('/') ? cta_path : '/' + cta_path}`
          : lmsUrl;
        await supabase.from("notifications").insert({
          user_id: student.id,
          title: subject,
          message: `${title}${description ? `: ${description.substring(0, 100)}...` : ""}`,
          type: "content",
          action_url: actionUrl,
        });

        sentCount++;
      } catch (error: any) {
        console.error(`Failed to notify ${student.email}:`, error);
        errors.push(`${student.email}: ${error.message}`);
        failedCount++;
      }
    }

    // Update timeline item notification_sent_at if provided
    if (timeline_item_id) {
      await supabase
        .from("batch_timeline_items")
        .update({ notification_sent_at: new Date().toISOString() })
        .eq("id", timeline_item_id);
    }

    console.log(`Notification complete: ${sentCount} sent, ${failedCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        failed: failedCount,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-batch-content-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
