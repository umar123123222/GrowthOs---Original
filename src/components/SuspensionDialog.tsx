import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Ban } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface SuspensionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentName: string;
  onConfirm: (data: { note: string; autoUnsuspendDate?: Date }) => void;
  loading?: boolean;
}

export function SuspensionDialog({ open, onOpenChange, studentName, onConfirm, loading }: SuspensionDialogProps) {
  const [note, setNote] = useState('');
  const [autoUnsuspendDate, setAutoUnsuspendDate] = useState<Date | undefined>();

  const handleConfirm = () => {
    onConfirm({ note, autoUnsuspendDate });
    setNote('');
    setAutoUnsuspendDate(undefined);
  };

  const handleOpenChange = (value: boolean) => {
    if (!value) {
      setNote('');
      setAutoUnsuspendDate(undefined);
    }
    onOpenChange(value);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <Ban className="w-5 h-5" />
            Suspend Student
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            You are about to suspend <span className="font-semibold text-foreground">{studentName}</span>. This will revoke their LMS access.
          </p>

          <div className="space-y-2">
            <Label htmlFor="suspension-note">Reason for Suspension</Label>
            <Textarea
              id="suspension-note"
              placeholder="e.g. Overdue payment, Policy violation..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Auto-Unsuspend Date <span className="text-xs text-muted-foreground">(optional)</span></Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !autoUnsuspendDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {autoUnsuspendDate ? format(autoUnsuspendDate, 'PPP') : 'Select date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={autoUnsuspendDate}
                  onSelect={setAutoUnsuspendDate}
                  disabled={(date) => date <= new Date()}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            {autoUnsuspendDate && (
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setAutoUnsuspendDate(undefined)}>
                Clear date
              </Button>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={loading}>
            {loading ? 'Suspending...' : 'Confirm Suspension'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
