import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { CheckCircle2, Loader2, Upload, X } from 'lucide-react';

const CURRENCY_SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', INR: '₹', PKR: 'Rs ', CAD: 'C$', AUD: 'A$' };
const sym = (c?: string) => CURRENCY_SYMBOLS[(c || 'PKR').toUpperCase()] || `${c || ''} `;

interface InvoiceLite {
  id: string;
  installment_number?: number | null;
  amount?: number | null;
}

interface MarkPaidDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId?: string;
  studentRecordId?: string;
  installmentNumber?: number;
  studentEmail?: string;
  onSuccess?: () => void;
}

export function MarkPaidDialog({ open, onOpenChange, invoiceId, studentRecordId, installmentNumber, studentEmail, onSuccess }: MarkPaidDialogProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [invoice, setInvoice] = useState<InvoiceLite | null>(null);
  const [currency, setCurrency] = useState<string>('PKR');
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [notes, setNotes] = useState('');
  const [proofFiles, setProofFiles] = useState<File[]>([]);

  const addProofFiles = (files: FileList | null) => {
    if (!files?.length) return;
    setProofFiles(prev => [...prev, ...Array.from(files)]);
  };
  const removeProofAt = (i: number) => setProofFiles(prev => prev.filter((_, idx) => idx !== i));

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: cs } = await supabase.from('company_settings').select('currency').limit(1).maybeSingle();
      if (cs?.currency) setCurrency(cs.currency);
      let inv: any = null;
      if (invoiceId) {
        const { data } = await supabase.from('invoices').select('id, installment_number, amount').eq('id', invoiceId).maybeSingle();
        inv = data;
      } else if (studentRecordId && installmentNumber) {
        const { data } = await supabase.from('invoices')
          .select('id, installment_number, amount')
          .eq('student_id', studentRecordId)
          .eq('installment_number', installmentNumber)
          .maybeSingle();
        inv = data;
      }
      if (inv) setInvoice(inv as InvoiceLite);
      else setInvoice(installmentNumber ? { id: '', installment_number: installmentNumber, amount: null } : null);
    })();
  }, [open, invoiceId, studentRecordId, installmentNumber]);

  const submit = async () => {
    setSubmitting(true);
    try {
      const proofPayloads: { filename: string; content_base64: string; content_type: string }[] = [];
      for (const f of proofFiles) {
        if (f.size > 8 * 1024 * 1024) {
          toast({ title: 'File too large', description: `${f.name} exceeds 8 MB.`, variant: 'destructive' });
          setSubmitting(false);
          return;
        }
        const buf = await f.arrayBuffer();
        let binary = '';
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        proofPayloads.push({
          filename: f.name,
          content_base64: btoa(binary),
          content_type: f.type || 'application/octet-stream',
        });
      }
      const body: any = {
        payment_date: new Date(paymentDate).toISOString(),
        payment_method: paymentMethod,
        payment_notes: notes.trim() || undefined,
        payment_proofs: proofPayloads.length ? proofPayloads : undefined,
        payment_proof: proofPayloads[0], // backward compatibility
      };
      if (invoiceId) body.invoice_id = invoiceId;
      else if (invoice?.id) body.invoice_id = invoice.id;
      else if (studentRecordId && installmentNumber) {
        body.student_id = studentRecordId;
        body.installment_number = installmentNumber;
      }
      const { data, error } = await supabase.functions.invoke('mark-invoice-paid', { body });
      if (error) throw error;
      if (!(data as any)?.success) throw new Error((data as any)?.error || 'Failed to mark as paid');
      toast({
        title: 'Invoice marked as paid',
        description: `Receipt emailed to ${studentEmail || 'student'}${proofPayloads.length ? ` with ${proofPayloads.length} proof file(s) attached` : ''}.`,
      });
      onOpenChange(false);
      setNotes('');
      setProofFiles([]);
      onSuccess?.();
    } catch (e: any) {
      toast({ title: 'Failed', description: e?.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Mark Invoice as Paid</DialogTitle>
          <DialogDescription>
            Confirm payment details. A receipt will be emailed to the student
            {studentEmail ? ` (${studentEmail})` : ''}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {invoice && (
            <div className="flex items-center justify-between p-3 border rounded-md bg-muted/30">
              <div>
                <div className="text-sm font-medium">
                  {invoice.installment_number ? `Installment #${invoice.installment_number}` : 'Invoice'}
                </div>
                <div className="text-xs text-muted-foreground">Amount due</div>
              </div>
              <div className="text-lg font-semibold">
                {sym(currency)}{Number(invoice.amount || 0).toLocaleString()}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="pay-date">Payment Date</Label>
              <Input id="pay-date" type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="pay-method">Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger id="pay-method"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="online">Online Gateway</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="pay-notes">Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Textarea id="pay-notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Reference #, sender name" />
          </div>

          <div>
            <Label htmlFor="pay-proof">
              Payment Proof <span className="text-muted-foreground text-xs">(optional, max 8 MB each — attach one or more files to the receipt email)</span>
            </Label>
            {proofFiles.length > 0 && (
              <div className="space-y-2 mb-2">
                {proofFiles.map((f, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 p-2 border rounded-md bg-muted/30">
                    <div className="text-sm truncate flex-1">
                      <span className="font-medium">{f.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">({(f.size / 1024).toFixed(1)} KB)</span>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeProofAt(i)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <label htmlFor="pay-proof" className="flex items-center justify-center gap-2 p-3 border border-dashed rounded-md text-sm text-muted-foreground hover:bg-muted/30 cursor-pointer">
              <Upload className="w-4 h-4" /> {proofFiles.length ? 'Add more files' : 'Click to upload receipt(s) / screenshot(s) (PDF, image)'}
            </label>
            <Input
              id="pay-proof"
              type="file"
              multiple
              className="hidden"
              accept="image/*,application/pdf"
              onChange={e => { addProofFiles(e.target.files); e.target.value = ''; }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            Confirm Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
