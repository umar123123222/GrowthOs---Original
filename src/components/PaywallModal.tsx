import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Mail, CreditCard, Clock, Phone, Banknote, DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { safeMaybeSingle } from '@/lib/database-safety';
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
  const {
    toast
  } = useToast();
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
      const result = await safeMaybeSingle(
        supabase.from('company_settings').select('payment_methods, currency, company_name, contact_email, primary_phone'),
        'fetch company payment settings'
      );
      
      if (!result.success) throw result.error;
      const data = result.data;
      if (data) {
        const methods = (data as any).payment_methods;
        if (Array.isArray(methods)) {
          setPaymentMethods(methods as unknown as PaymentMethod[]);
        }
        setCurrency((data as any).currency || 'USD');
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
    const symbols: {
      [key: string]: string;
    } = {
      USD: '$',
      EUR: '€',
      GBP: '£',
      INR: '₹',
      CAD: 'C$',
      AUD: 'A$',
      PKR: '₨'
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
  return <Dialog open={isOpen} onOpenChange={onOpenChange} modal>
      
    </Dialog>;
};