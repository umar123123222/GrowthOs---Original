import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Building2, Phone, Mail, DollarSign, Settings, FileText, Calendar, HelpCircle, Plus, Trash2, Edit3, GripVertical } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LogoUploadSection } from '@/components/LogoUploadSection';
import { QuestionEditor } from '@/components/questionnaire/QuestionEditor';
import { getLogoUrl } from '@/utils/logoUtils';

// Import types from the new questionnaire module
import { QuestionItem, validateQuestionnaireStructure } from '@/types/questionnaire';

interface CompanySettingsData {
  id?: string;
  company_name: string;
  company_logo?: string;
  primary_phone: string;
  secondary_phone?: string;
  address: string;
  contact_email: string;
  currency: string;
  original_fee_amount: number;
  maximum_installment_count: number;
  invoice_notes?: string;
  invoice_overdue_days: number;
  invoice_send_gap_days: number;
  // Student Sign-in & Questionnaire
  enable_student_signin: boolean;
  questionnaire: QuestionItem[];
  // Branding
  branding?: {
    logo?: {
      original?: string;
      favicon?: string;
      header?: string;
    };
  };
}

export function CompanySettings() {
  const { toast } = useToast();

  const getCurrencySymbol = (currency: string): string => {
    const symbols: { [key: string]: string } = {
      USD: '$',
      EUR: '€',
      GBP: '£',
      PKR: '₨',
      INR: '₹',
      CAD: 'C$',
      AUD: 'A$'
    };
    return symbols[currency] || currency;
  };
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<CompanySettingsData>({
    company_name: '',
    company_logo: '',
    primary_phone: '',
    secondary_phone: '',
    address: '',
    contact_email: '',
    currency: 'USD',
    original_fee_amount: 3000,
    maximum_installment_count: 3,
    invoice_notes: '',
    invoice_overdue_days: 30,
    invoice_send_gap_days: 7,
    // Student Sign-in & Questionnaire
    enable_student_signin: false,
    questionnaire: []
  });

  // State for editing questions
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null);

  useEffect(() => {
    fetchCompanySettings();
  }, []);

  const fetchCompanySettings = async () => {
    try {
      // First try to fetch existing settings
      const { data, error } = await supabase
        .from('company_settings' as any)
        .select('*')
        .maybeSingle();

      if (error) {
        // If table doesn't exist, show error message and suggest contacting admin
        if (error.code === '42P01') {
          toast({
            title: 'Database Setup Required',
            description: 'Company settings table needs to be created. Please contact your system administrator.',
            variant: 'destructive'
          });
          return;
        }
        
        // If no records found, that's okay - we'll create one on save
        if (error.code !== 'PGRST116') {
          throw error;
        }
      }

      if (data) {
        const settingsData = data as unknown as CompanySettingsData;
        setSettings(settingsData);
      }
    } catch (error) {
      console.error('Error fetching company settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load company settings',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof CompanySettingsData, value: string | number | boolean) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('company_settings' as any)
        .upsert({
          id: settings.id || 1, // Use existing ID or default to 1
          ...settings,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Company settings saved successfully'
      });

      // Refresh to get the latest data
      fetchCompanySettings();
    } catch (error) {
      console.error('Error saving company settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save company settings',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  // Logo update handler
  const handleLogoUpdate = (branding: any) => {
    setSettings(prev => ({ ...prev, branding }));
  };

  // Questionnaire management functions
  const handleQuestionSave = (question: QuestionItem) => {
    const existingIndex = settings.questionnaire.findIndex(q => q.id === question.id);
    
    if (existingIndex >= 0) {
      // Update existing question
      const updatedQuestionnaire = [...settings.questionnaire];
      updatedQuestionnaire[existingIndex] = question;
      setSettings(prev => ({ ...prev, questionnaire: updatedQuestionnaire }));
      setEditingQuestion(null);
      
      toast({
        title: 'Question Updated',
        description: 'Question has been updated successfully.'
      });
    } else {
      // Add new question
      const updatedQuestionnaire = [...settings.questionnaire, question];
      setSettings(prev => ({ ...prev, questionnaire: updatedQuestionnaire }));
      setIsAddingQuestion(false);
      
      toast({
        title: 'Question Added',
        description: 'New question has been added to the questionnaire.'
      });
    }
  };

  const deleteQuestion = (questionId: string) => {
    const updatedQuestionnaire = settings.questionnaire
      .filter(q => q.id !== questionId)
      .map((q, index) => ({ ...q, order: index + 1 })); // Reorder after deletion
    
    setSettings(prev => ({ ...prev, questionnaire: updatedQuestionnaire }));
    setEditingQuestion(null);
    
    toast({
      title: 'Question Deleted',
      description: 'Question has been removed from the questionnaire.'
    });
  };

  const moveQuestion = (questionId: string, direction: 'up' | 'down') => {
    const currentIndex = settings.questionnaire.findIndex(q => q.id === questionId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= settings.questionnaire.length) return;

    const updatedQuestionnaire = [...settings.questionnaire];
    const [movedItem] = updatedQuestionnaire.splice(currentIndex, 1);
    updatedQuestionnaire.splice(newIndex, 0, movedItem);

    // Update order numbers
    const reorderedQuestionnaire = updatedQuestionnaire.map((q, index) => ({ ...q, order: index + 1 }));
    
    setSettings(prev => ({ ...prev, questionnaire: reorderedQuestionnaire }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg">Loading company settings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Settings className="h-8 w-8" />
            Company Settings
          </h1>
          <p className="text-muted-foreground">
            Configure your organization details and billing parameters
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Logo Upload Section */}
        <div className="lg:col-span-2">
          <LogoUploadSection 
            currentLogo={getLogoUrl(settings.branding, 'header')}
            onLogoUpdate={handleLogoUpdate}
          />
        </div>

        {/* Company Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Company Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company_name">Company Name</Label>
              <Input
                id="company_name"
                value={settings.company_name}
                onChange={(e) => handleInputChange('company_name', e.target.value)}
                placeholder="Enter company name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Company Address</Label>
              <Textarea
                id="address"
                value={settings.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                placeholder="Enter full company address"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="primary_phone">Primary Phone</Label>
              <Input
                id="primary_phone"
                value={settings.primary_phone}
                onChange={(e) => handleInputChange('primary_phone', e.target.value)}
                placeholder="+1 (555) 123-4567"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="secondary_phone">Secondary Phone (Optional)</Label>
              <Input
                id="secondary_phone"
                value={settings.secondary_phone || ''}
                onChange={(e) => handleInputChange('secondary_phone', e.target.value)}
                placeholder="+1 (555) 987-6543"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_email">Contact Email</Label>
              <Input
                id="contact_email"
                type="email"
                value={settings.contact_email}
                onChange={(e) => handleInputChange('contact_email', e.target.value)}
                placeholder="contact@company.com"
              />
            </div>
          </CardContent>
        </Card>

        {/* Email Configuration */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Email sending is managed via Supabase console—no SMTP settings are required in the app.
              All transactional emails (invoices, LMS notifications, authentication emails) are sent using Supabase's default email configuration.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              To modify email settings, please use the Supabase dashboard.
            </p>
          </CardContent>
        </Card>

        {/* Student Sign-in & Questionnaire */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              Student Sign-in Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Enable Student Sign-in Toggle */}
            <div className="flex items-center space-x-2">
              <Switch
                id="enable_student_signin"
                checked={settings.enable_student_signin}
                onCheckedChange={(checked) => handleInputChange('enable_student_signin', checked)}
              />
              <Label htmlFor="enable_student_signin" className="font-medium">
                Enable Student First Sign-In Questionnaire
              </Label>
            </div>
            <p className="text-sm text-muted-foreground">
              Show a questionnaire to students during their first sign-in to collect additional information
            </p>

            {/* Questionnaire Management - only show when enabled */}
            {settings.enable_student_signin && (
              <>
                <Separator className="my-4" />
                
                <div className="space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <HelpCircle className="h-4 w-4" />
                    First Sign-In Questions
                  </h4>

                  {/* Question List */}
                  <div className="space-y-3">
                    {settings.questionnaire.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        No questions added yet. Click "Add Question" to get started.
                      </p>
                    ) : (
                      settings.questionnaire
                        .sort((a, b) => a.order - b.order)
                        .map((question, index) => (
                          <div key={question.id} className="space-y-2">
                            {editingQuestion === question.id ? (
                              <QuestionEditor
                                question={question}
                                onSave={handleQuestionSave}
                                onCancel={() => setEditingQuestion(null)}
                                nextOrder={settings.questionnaire.length + 1}
                              />
                            ) : (
                              <div className="flex items-start gap-3 p-4 border border-border rounded-lg bg-card">
                                {/* Reorder buttons */}
                                <div className="flex flex-col gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    disabled={index === 0}
                                    onClick={() => moveQuestion(question.id, 'up')}
                                    className="h-4 w-4 p-0 hover:bg-muted"
                                  >
                                    <GripVertical className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    disabled={index === settings.questionnaire.length - 1}
                                    onClick={() => moveQuestion(question.id, 'down')}
                                    className="h-4 w-4 p-0 hover:bg-muted"
                                  >
                                    <GripVertical className="h-3 w-3" />
                                  </Button>
                                </div>

                                {/* Question content */}
                                <div className="flex-1 min-w-0 space-y-1">
                                  <p className="text-sm font-medium">
                                    {index + 1}. {question.text}
                                    {question.required && <span className="text-destructive ml-1">*</span>}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Type: {question.answerType}
                                    {question.options && question.options.length > 0 && 
                                      ` • ${question.options.length} option${question.options.length !== 1 ? 's' : ''}`
                                    }
                                  </p>
                                </div>

                                {/* Action buttons */}
                                <div className="flex gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setEditingQuestion(question.id)}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Edit3 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => deleteQuestion(question.id)}
                                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))
                    )}

                    {/* Add New Question */}
                    {isAddingQuestion && (
                      <QuestionEditor
                        onSave={handleQuestionSave}
                        onCancel={() => setIsAddingQuestion(false)}
                        nextOrder={settings.questionnaire.length + 1}
                      />
                    )}

                    {/* Add Question Button */}
                    {!isAddingQuestion && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsAddingQuestion(true)}
                        className="w-full border-dashed"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Question
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Billing Configuration */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Billing Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select value={settings.currency} onValueChange={(value) => handleInputChange('currency', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent className="bg-white z-50">
                    <SelectItem value="USD">USD ($) - US Dollar</SelectItem>
                    <SelectItem value="EUR">EUR (€) - Euro</SelectItem>
                    <SelectItem value="GBP">GBP (£) - British Pound</SelectItem>
                    <SelectItem value="PKR">PKR (₨) - Pakistani Rupee</SelectItem>
                    <SelectItem value="INR">INR (₹) - Indian Rupee</SelectItem>
                    <SelectItem value="CAD">CAD (C$) - Canadian Dollar</SelectItem>
                    <SelectItem value="AUD">AUD (A$) - Australian Dollar</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Select your preferred currency
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="original_fee_amount">Original Fee Amount</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                    {getCurrencySymbol(settings.currency)}
                  </span>
                  <Input
                    id="original_fee_amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={settings.original_fee_amount}
                    onChange={(e) => handleInputChange('original_fee_amount', parseFloat(e.target.value))}
                    placeholder="3000.00"
                    className="pl-8"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  The total course fee amount
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maximum_installment_count">Maximum Installment Count</Label>
                <Input
                  id="maximum_installment_count"
                  type="number"
                  min="1"
                  max="12"
                  value={settings.maximum_installment_count}
                  onChange={(e) => handleInputChange('maximum_installment_count', parseInt(e.target.value))}
                  placeholder="3"
                />
                <p className="text-xs text-muted-foreground">
                  Maximum number of installments allowed (1-12)
                </p>
              </div>
            </div>

            <Separator className="my-6" />

            {/* Invoice Configuration */}
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Invoice Configuration
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="invoice_send_gap_days">Invoice Send Gap (Days)</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="invoice_send_gap_days"
                      type="number"
                      min="1"
                      max="90"
                      value={settings.invoice_send_gap_days}
                      onChange={(e) => handleInputChange('invoice_send_gap_days', parseInt(e.target.value))}
                      placeholder="7"
                      className="pl-10"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Days to wait before sending invoice
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="invoice_overdue_days">Invoice Overdue (Days)</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="invoice_overdue_days"
                      type="number"
                      min="1"
                      max="365"
                      value={settings.invoice_overdue_days}
                      onChange={(e) => handleInputChange('invoice_overdue_days', parseInt(e.target.value))}
                      placeholder="30"
                      className="pl-10"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Days after creation to mark overdue
                  </p>
                </div>

                <div className="md:col-span-1">
                  <div className="space-y-2">
                    <Label htmlFor="invoice_notes">Notes For Invoice</Label>
                    <Textarea
                      id="invoice_notes"
                      value={settings.invoice_notes || ''}
                      onChange={(e) => handleInputChange('invoice_notes', e.target.value)}
                      placeholder="Additional notes to include in invoices..."
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground">
                      Default notes to include in all invoices
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <Separator className="my-6" />

            <div className="bg-muted p-4 rounded-lg">
              <h4 className="font-medium mb-2">Calculated Installment Amount</h4>
              <p className="text-2xl font-bold text-primary">
                {getCurrencySymbol(settings.currency)}{(settings.original_fee_amount / settings.maximum_installment_count).toFixed(2)}
              </p>
              <p className="text-sm text-muted-foreground">
                Per installment based on current settings
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="min-w-32"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}