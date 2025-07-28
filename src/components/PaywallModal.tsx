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
    const subject = encodeURIComponent(`Payment for Invoice ${invoiceNumber || 'Pending'}`);
    const body = encodeURIComponent(`Hello,

I am writing to submit my payment receipt for my course fees.

Invoice Number: ${invoiceNumber || 'Pending'}
Amount: PKR ${invoiceAmount?.toLocaleString() || 'Pending'}

Please find my payment receipt attached.

Thank you,`);
    
    window.open(`mailto:billing@idmpakistan.pk?subject=${subject}&body=${body}`, '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <CreditCard className="h-5 w-5 text-orange-500" />
            Payment Required
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-center space-y-2">
            <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
              <Clock className="h-8 w-8 text-orange-500 mx-auto mb-2" />
              <p className="text-sm text-gray-600">
                Please clear your first fees and send the payment receipt to:
              </p>
              <p className="font-semibold text-orange-700 mt-2">
                billing@idmpakistan.pk
              </p>
            </div>
            
            {invoiceAmount && (
              <div className="bg-blue-50 p-3 rounded border border-blue-200">
                <p className="text-sm text-gray-600">Amount Due:</p>
                <p className="text-xl font-bold text-blue-700">
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
              className="w-full"
              size="lg"
            >
              <Mail className="h-4 w-4 mr-2" />
              Contact Billing Department
            </Button>
            
            <p className="text-xs text-center text-gray-500">
              Your account will be activated immediately after payment verification.
              This usually takes 1-2 business hours.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};