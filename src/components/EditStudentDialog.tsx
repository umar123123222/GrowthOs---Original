import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface EditStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: {
    id: string;
    full_name: string;
    email: string;
    phone: string;
  } | null;
  onStudentUpdated: () => void;
}

export const EditStudentDialog = ({ open, onOpenChange, student, onStudentUpdated }: EditStudentDialogProps) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (student) {
      setFullName(student.full_name);
      setEmail(student.email);
      setPhone(student.phone || '');
    }
  }, [student]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!student) return;
    
    setLoading(true);
    
    try {
      const emailChanged = email !== student.email;
      
      // Call edge function to update student details
      const { data, error } = await supabase.functions.invoke('update-student-details', {
        body: {
          user_id: student.id,
          full_name: fullName,
          email: email,
          phone: phone,
          resend_credentials: emailChanged
        }
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      console.log('Update result:', data);

      // Check if email was sent and handle different scenarios
      if (emailChanged && data?.email_sent) {
        if (data?.password_regenerated) {
          toast({
            title: 'Student Updated & Password Reset',
            description: 'Student details updated successfully. A new password was generated and login credentials have been sent to their new email address.',
          });
        } else {
          toast({
            title: 'Success',
            description: 'Student details updated and login credentials sent to new email'
          });
        }
      } else if (emailChanged && !data?.email_sent && data?.email_error) {
        console.error('Email sending failed:', data.email_error);
        toast({
          title: 'Partially Updated',
          description: `Student updated but email failed: ${data.email_error}`,
          variant: 'destructive'
        });
      } else if (emailChanged && !data?.email_sent) {
        console.warn('Email not sent - SMTP may not be configured');
        toast({
          title: 'Partially Updated',
          description: 'Student updated but credentials email not sent (SMTP not configured)',
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Success',
          description: 'Student details updated successfully'
        });
      }

      onStudentUpdated();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating student:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update student details',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Student Details</DialogTitle>
          <DialogDescription>
            Update student information. If email is changed, login credentials will be resent.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter full name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter phone number"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Student
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
