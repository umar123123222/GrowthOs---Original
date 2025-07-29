import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Mail, CreditCard, Clock } from 'lucide-react';
interface PaywallModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceAmount?: number;
  invoiceNumber?: string;
}
export const PaywallModal: React.FC<PaywallModalProps> = ({
  isOpen,
  onOpenChange,
  invoiceAmount,
  invoiceNumber
}) => {
  const handleContactBilling = () => {
    const subject = encodeURIComponent(`Payment Proof for First Installment - ${invoiceNumber || 'Student Account'}`);
    const body = encodeURIComponent(`Hello,

I am writing to submit my payment proof for my first installment.

Invoice Number: ${invoiceNumber || 'Pending'}
Amount: PKR ${invoiceAmount?.toLocaleString() || '50,000'}

Please find my payment receipt attached.

Thank you,`);
    window.open(`mailto:gbilling@idmpaksitan.pk?subject=${subject}&body=${body}`, '_blank');
  };
  return <Dialog open={isOpen} onOpenChange={() => {}} modal>
      
    </Dialog>;
};