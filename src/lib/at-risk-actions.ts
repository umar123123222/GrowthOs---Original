import { supabase } from '@/integrations/supabase/client';
import type { AtRiskStudent } from '@/hooks/useAtRiskStudents';

export function composeOutreachMessage(student: AtRiskStudent, channel: 'email' | 'whatsapp') {
  const reasonText = student.reasons.map(r => `• ${r.detail}`).join('\n');
  const subject = `Checking in — let's get you back on track`;
  const greeting = channel === 'email' ? `Hi ${student.name},` : `Hi ${student.name.split(' ')[0]},`;
  const body = `${greeting}

We noticed you've been off-track lately:
${reasonText}

We're here to help. What's blocking your progress? Reply to this message and we'll set up a quick call.

— The Success Team`;
  return { subject, body };
}

export function buildMailtoLink(email: string, subject: string, body: string) {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function buildWhatsAppLink(phone: string, body: string) {
  const clean = phone.replace(/[^\d]/g, '');
  return `https://wa.me/${clean}?text=${encodeURIComponent(body)}`;
}

export async function notifyMentorOfAtRiskStudent(args: {
  mentorId: string;
  mentorEmail: string;
  mentorName: string;
  student: AtRiskStudent;
  triggeredBy: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const reasonText = args.student.reasons.map(r => r.detail).join(', ');
    const { error } = await supabase.from('notifications').insert({
      user_id: args.mentorId,
      type: 'at_risk_student_alert',
      channel: 'in_app',
      status: 'sent',
      sent_at: new Date().toISOString(),
      payload: {
        title: `At-risk student: ${args.student.name}`,
        message: `${args.student.name} flagged: ${reasonText}`,
        student_id: args.student.user_id,
        triggered_by: args.triggeredBy,
      },
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Unknown error' };
  }
}
