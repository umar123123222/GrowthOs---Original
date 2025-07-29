import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Mail } from 'lucide-react';

export function QuickTestEmailSender() {
  const [sending, setSending] = useState(false);
  const [email, setEmail] = useState('umar@core47.ai');
  const { toast } = useToast();

  const sendTestInvoice = async () => {
    setSending(true);
    try {
      console.log('Sending test email to:', email);
      
      const { data, error } = await supabase.functions.invoke('send-invoice-email', {
        body: {
          student_data: {
            full_name: "Test User",
            email: email,
            student_id: "TEST001"
          },
          installment_number: 1,
          amount: 1000,
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        }
      });

      console.log('Email function response:', { data, error });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      if (data?.success) {
        toast({
          title: 'Success',
          description: `Test invoice email sent successfully to ${email}`
        });
        console.log('Email sent successfully');
      } else {
        console.error('Email function returned error:', data);
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
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Test Invoice Email
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="test-email">Email Address</Label>
          <Input
            id="test-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter email address"
          />
        </div>
        <Button 
          onClick={sendTestInvoice}
          disabled={sending || !email}
          className="w-full"
        >
          {sending ? 'Sending...' : 'Send Test Invoice Email'}
        </Button>
        <p className="text-sm text-muted-foreground">
          This will send a test invoice email with sample data ($1000, installment 1, due in 30 days).
        </p>
      </CardContent>
    </Card>
  );
}