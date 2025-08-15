import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Mail, CreditCard, Clock, Phone, Banknote, DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PaymentMethod {
  type: 'bank_transfer' | 'cod' | 'stripe' | 'custom';
  name: string;
  enabled: boolean;
  details: {
    [key: string]: string;
  };
}

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
  const { toast } = useToast();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [companyDetails, setCompanyDetails] = useState<any>(null);
  const [currency, setCurrency] = useState('USD');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchCompanySettings();
    }
  }, [isOpen]);

  const fetchCompanySettings = async () => {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('payment_methods, currency, company_name, contact_email, primary_phone')
        .single();

      if (error) throw error;

      if (data) {
        const methods = data.payment_methods;
        if (Array.isArray(methods)) {
          setPaymentMethods(methods as unknown as PaymentMethod[]);
        }
        setCurrency(data.currency || 'USD');
        setCompanyDetails(data);
      }
    } catch (error) {
      console.error('Error fetching company settings:', error);
      toast({
        title: "Error",
        description: "Failed to load payment information",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getCurrencySymbol = (curr: string = 'USD') => {
    const symbols: { [key: string]: string } = {
      USD: '$', EUR: '€', GBP: '£', INR: '₹', CAD: 'C$', AUD: 'A$', PKR: '₨'
    };
    return symbols[curr] || curr;
  };

  const getPaymentMethodIcon = (type: string) => {
    switch (type) {
      case 'bank_transfer':
        return <Banknote className="h-5 w-5" />;
      case 'cod':
        return <DollarSign className="h-5 w-5" />;
      case 'stripe':
        return <CreditCard className="h-5 w-5" />;
      default:
        return <CreditCard className="h-5 w-5" />;
    }
  };

  const handleContactBilling = () => {
    const subject = encodeURIComponent(`Payment Proof for First Installment - ${invoiceNumber || 'Student Account'}`);
    const body = encodeURIComponent(`Hello,

I am writing to submit my payment proof for my first installment.

Invoice Number: ${invoiceNumber || 'Pending'}
Amount: ${getCurrencySymbol(currency)}${invoiceAmount?.toLocaleString() || '50,000'}

Please find my payment receipt attached.

Thank you,`);
    
    const contactEmail = companyDetails?.contact_email || 'gbilling@idmpaksitan.pk';
    window.open(`mailto:${contactEmail}?subject=${subject}&body=${body}`, '_blank');
  };

  const enabledPaymentMethods = paymentMethods.filter(method => method.enabled);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange} modal>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-orange-500" />
            Payment Required - First Installment
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p>Loading payment information...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Invoice Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Invoice Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Invoice Number</p>
                    <p className="font-medium">{invoiceNumber || 'Pending'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Amount Due</p>
                    <p className="text-2xl font-bold text-primary">
                      {getCurrencySymbol(currency)}{invoiceAmount?.toLocaleString() || '50,000'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment Methods */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Available Payment Methods</CardTitle>
              </CardHeader>
              <CardContent>
                {enabledPaymentMethods.length > 0 ? (
                  <div className="space-y-4">
                    {enabledPaymentMethods.map((method, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex items-center gap-3 mb-3">
                          {getPaymentMethodIcon(method.type)}
                          <h4 className="font-semibold">{method.name}</h4>
                          <Badge variant="secondary" className="ml-auto">
                            {method.type.replace('_', ' ').toUpperCase()}
                          </Badge>
                        </div>
                        <div className="space-y-2">
                          {Object.entries(method.details).map(([key, value]) => (
                            <div key={key} className="flex justify-between">
                              <span className="text-sm text-muted-foreground">
                                {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:
                              </span>
                              <span className="text-sm font-medium">{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No payment methods configured</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Please contact support for payment instructions
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Separator />

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                onClick={handleContactBilling}
                className="flex items-center gap-2 flex-1"
              >
                <Mail className="h-4 w-4" />
                Submit Payment Proof
              </Button>
              
              {companyDetails?.primary_phone && (
                <Button 
                  variant="outline"
                  onClick={() => window.open(`tel:${companyDetails.primary_phone}`, '_self')}
                  className="flex items-center gap-2"
                >
                  <Phone className="h-4 w-4" />
                  Call Support
                </Button>
              )}
            </div>

            {/* Important Notice */}
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-orange-500 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-orange-800 mb-1">Payment Required to Continue</p>
                    <p className="text-orange-700">
                      Please complete your first installment payment to access the learning platform.
                      After payment, submit your proof using the button above.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};