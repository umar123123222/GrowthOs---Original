import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

export function TestEmailSender() {
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const sendTestInvoice = async () => {
    setSending(true);
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
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days from now
        }
      });

      if (error) {
        throw error;
      }

      if (data?.success) {
        toast({
          title: 'Success',
          description: 'Test invoice email sent successfully to umar@core47.ai'
        });
      } else {
        throw new Error(data?.error || 'Failed to send email');
      }
    } catch (error: any) {
      console.error('Error sending test email:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send test email',
        variant: 'destructive'
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Test Invoice Email</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Test Email Address</Label>
          <Input value="umar@core47.ai" disabled />
        </div>
        <Button 
          onClick={sendTestInvoice}
          disabled={sending}
          className="w-full"
        >
          {sending ? 'Sending...' : 'Send Test Invoice Email'}
        </Button>
      </CardContent>
    </Card>
  );
}