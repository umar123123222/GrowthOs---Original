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

  return (
    <Dialog open={isOpen} onOpenChange={() => {}} modal>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg text-center">
            <CreditCard className="h-5 w-5 text-orange-500 mx-auto" />
            First Installment Payment Required
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-center space-y-3">
            <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
              <Clock className="h-8 w-8 text-orange-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-800 mb-2">
                Your LMS access is locked until payment is received
              </p>
              <p className="text-sm text-gray-600">
                Please clear your first installment and send the payment proof to:
              </p>
              <p className="font-semibold text-orange-700 mt-2 text-lg">
                gbilling@idmpaksitan.pk
              </p>
            </div>
            
            {invoiceAmount && (
              <div className="bg-red-50 p-4 rounded border border-red-200">
                <p className="text-sm font-medium text-gray-800">First Installment Amount:</p>
                <p className="text-2xl font-bold text-red-700">
                  PKR {invoiceAmount.toLocaleString()}
                </p>
                {invoiceNumber && (
                  <p className="text-xs text-gray-500 mt-1">
                    Invoice: {invoiceNumber}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <Button 
              onClick={handleContactBilling}
              className="w-full bg-orange-500 hover:bg-orange-600"
              size="lg"
            >
              <Mail className="h-4 w-4 mr-2" />
              Send Payment Proof to Billing
            </Button>
            
            <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
              <p className="text-xs text-center text-gray-600">
                <strong>Important:</strong> Your account will be activated immediately after payment verification.
                This usually takes 1-2 business hours during working days.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};