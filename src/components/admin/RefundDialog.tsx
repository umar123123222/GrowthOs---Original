import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { AlertTriangle, Loader2, Upload, X } from 'lucide-react';

const CURRENCY_SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', INR: '₹', PKR: 'Rs ', CAD: 'C$', AUD: 'A$' };
const sym = (c?: string) => CURRENCY_SYMBOLS[(c || 'PKR').toUpperCase()] || `${c || ''} `;

interface RefundableInvoice {
  id: string;
  installment_number: number;
  amount: number;
  course_name?: string;
  pathway_name?: string;
}

interface RefundDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  studentEmail?: string;
  initialInvoiceId?: string;
  onSuccess?: () => void;
}

export function RefundDialog({ open, onOpenChange, studentId, studentEmail, initialInvoiceId, onSuccess }: RefundDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [invoices, setInvoices] = useState<RefundableInvoice[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState('');
  const [refundMethod, setRefundMethod] = useState('bank_transfer');
  const [refundDate, setRefundDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [currency, setCurrency] = useState<string>('PKR');
  const [proofFile, setProofFile] = useState<File | null>(null);

  useEffect(() => {
    if (!open || !studentId) return;
    (async () => {
      setLoading(true);
      const { data: cs } = await supabase.from('company_settings').select('currency').limit(1).maybeSingle();
      if (cs?.currency) setCurrency(cs.currency);
      const { data, error } = await supabase
        .from('invoices')
        .select('id, installment_number, amount, course_id, pathway_id')
        .eq('student_id', studentId)
        .eq('status', 'paid')
        .order('installment_number');
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        setLoading(false);
        return;
      }
      const courseIds = [...new Set((data || []).map((i: any) => i.course_id).filter(Boolean))];
      const pathwayIds = [...new Set((data || []).map((i: any) => i.pathway_id).filter(Boolean))];
      const [coursesRes, pathwaysRes] = await Promise.all([
        courseIds.length ? supabase.from('courses').select('id, title').in('id', courseIds as string[]) : Promise.resolve({ data: [] as any[] }),
        pathwayIds.length ? supabase.from('learning_pathways').select('id, name').in('id', pathwayIds as string[]) : Promise.resolve({ data: [] as any[] }),
      ]);
      const cMap = new Map((coursesRes.data || []).map((c: any) => [c.id, c.title]));
      const pMap = new Map((pathwaysRes.data || []).map((p: any) => [p.id, p.name]));
      const mapped: RefundableInvoice[] = (data || []).map((row: any) => ({
        id: row.id,
        installment_number: row.installment_number,
        amount: Number(row.amount),
        course_name: row.course_id ? cMap.get(row.course_id) : undefined,
        pathway_name: row.pathway_id ? pMap.get(row.pathway_id) : undefined,
      }));
      setInvoices(mapped);
      setSelected(initialInvoiceId ? new Set([initialInvoiceId]) : new Set(mapped.map(m => m.id)));
      setLoading(false);
    })();
  }, [open, studentId, initialInvoiceId, toast]);

  const toggle = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const total = invoices.filter(i => selected.has(i.id)).reduce((s, i) => s + i.amount, 0);

  const submit = async () => {
    if (!selected.size) {
      toast({ title: 'Select at least one installment', variant: 'destructive' });
      return;
    }
    if (!reason.trim()) {
      toast({ title: 'Please enter a reason', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let proofPayload: { filename: string; content_base64: string; content_type: string } | undefined;
      if (proofFile) {
        if (proofFile.size > 8 * 1024 * 1024) {
          toast({ title: 'File too large', description: 'Proof must be under 8 MB.', variant: 'destructive' });
          setSubmitting(false);
          return;
        }
        const buf = await proofFile.arrayBuffer();
        let binary = '';
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        proofPayload = {
          filename: proofFile.name,
          content_base64: btoa(binary),
          content_type: proofFile.type || 'application/octet-stream',
        };
      }
      const { data, error } = await supabase.functions.invoke('process-refund', {
        body: {
          invoice_ids: Array.from(selected),
          reason: reason.trim(),
          refund_method: refundMethod,
          refund_date: new Date(refundDate).toISOString(),
          performed_by: user?.id,
          suspend_lms: true,
          proof_attachment: proofPayload,
        },
      });
      if (error) throw error;
      if (!(data as any)?.success) throw new Error((data as any)?.error || 'Refund failed');
      toast({ title: 'Refund processed', description: `${selected.size} installment(s) refunded. Confirmation emailed to ${studentEmail || 'student'}.` });
      onOpenChange(false);
      setReason('');
      setProofFile(null);
      onSuccess?.();
    } catch (e: any) {
      toast({ title: 'Refund failed', description: e?.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Refund Student</DialogTitle>
          <DialogDescription>
            Select which paid installments to refund. The student will be suspended from the LMS and receive a confirmation email.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
        ) : invoices.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground text-sm">No paid installments found for this student.</div>
        ) : (
          <div className="space-y-4">
            <div className="border rounded-md divide-y">
              {invoices.map(inv => (
                <label key={inv.id} className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/40">
                  <Checkbox checked={selected.has(inv.id)} onCheckedChange={() => toggle(inv.id)} />
                  <div className="flex-1">
                    <div className="text-sm font-medium">Installment #{inv.installment_number}</div>
                    <div className="text-xs text-muted-foreground">{inv.course_name || inv.pathway_name || 'General'}</div>
                  </div>
                  <div className="font-semibold">{sym(currency)}{inv.amount.toLocaleString()}</div>
                </label>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="refund-date">Refund Date</Label>
                <Input id="refund-date" type="date" value={refundDate} onChange={e => setRefundDate(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="refund-method">Refund Method</Label>
                <Select value={refundMethod} onValueChange={setRefundMethod}>
                  <SelectTrigger id="refund-method"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="original_method">Original Payment Method</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="refund-reason">Reason <span className="text-destructive">*</span></Label>
              <Textarea id="refund-reason" rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Student requested refund within cooling-off period" />
            </div>

            <div>
              <Label htmlFor="refund-proof">Proof of Refund <span className="text-muted-foreground text-xs">(optional, max 8 MB — will be attached to email)</span></Label>
              {proofFile ? (
                <div className="flex items-center justify-between gap-2 p-2 border rounded-md bg-muted/30">
                  <div className="text-sm truncate flex-1">
                    <span className="font-medium">{proofFile.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">({(proofFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setProofFile(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <label htmlFor="refund-proof" className="flex items-center justify-center gap-2 p-3 border border-dashed rounded-md text-sm text-muted-foreground hover:bg-muted/30 cursor-pointer">
                  <Upload className="w-4 h-4" /> Click to upload receipt / screenshot (PDF, image)
                </label>
              )}
              <Input
                id="refund-proof"
                type="file"
                className="hidden"
                accept="image/*,application/pdf"
                onChange={e => setProofFile(e.target.files?.[0] || null)}
              />
            </div>

            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-900">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                Total to refund: <strong>{sym(currency)}{total.toLocaleString()}</strong>. The student's LMS access will be suspended immediately.
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button variant="destructive" onClick={submit} disabled={submitting || !selected.size || !reason.trim()}>
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Confirm Refund
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
