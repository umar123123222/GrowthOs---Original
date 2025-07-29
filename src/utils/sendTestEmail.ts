import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export async function sendTestInvoiceEmail() {
  try {
    const { data, error } = await supabase.functions.invoke('send-invoice-email', {
      body: {
        student_data: {
          full_name: "Test User",
          email: "umar@core47.ai", 
          student_id: "TEST001"
        },
        installment_number: 1,
        amount: 1000,
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      }
    });

    if (error) {
      console.error('Edge function error:', error);
      throw error;
    }

    if (data?.success) {
      console.log('Test invoice email sent successfully to umar@core47.ai');
      return { success: true, message: 'Email sent successfully' };
    } else {
      throw new Error(data?.error || 'Failed to send email');
    }
  } catch (error: any) {
    console.error('Error sending test email:', error);
    throw new Error(error.message || 'Failed to send test email');
  }
}

// Call the function immediately
sendTestInvoiceEmail()
  .then(result => {
    console.log('Success:', result);
  })
  .catch(error => {
    console.error('Error:', error);
  });