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
import { Building2, Phone, Mail, DollarSign, Settings, Upload, FileText, Calendar, Server, Shield, HelpCircle, Plus, Trash2, Edit3, GripVertical } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface QuestionItem {
  id: string;
  text: string;
  order: number;
}

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
  // SMTP Configuration
  smtp_enabled: boolean;
  smtp_host?: string;
  smtp_port: number;
  smtp_username?: string;
  smtp_password?: string;
  smtp_encryption: string;
  // Email Addresses
  invoice_from_email?: string;
  invoice_from_name?: string;
  lms_from_email?: string;
  lms_from_name?: string;
  // Student Sign-in & Questionnaire
  enable_student_signin: boolean;
  questionnaire: QuestionItem[];
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
    // SMTP Configuration
    smtp_enabled: false,
    smtp_host: '',
    smtp_port: 587,
    smtp_username: '',
    smtp_password: '',
    smtp_encryption: 'STARTTLS',
    // Email Addresses
    invoice_from_email: '',
    invoice_from_name: '',
    lms_from_email: '',
    lms_from_name: '',
    // Student Sign-in & Questionnaire
    enable_student_signin: false,
    questionnaire: []
  });

  // Questionnaire management state
  const [newQuestion, setNewQuestion] = useState('');
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null);
  const [editQuestionText, setEditQuestionText] = useState('');

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
        setSettings(data as unknown as CompanySettingsData);
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

  // Questionnaire management functions
  const generateQuestionId = () => `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const addQuestion = () => {
    if (!newQuestion.trim() || newQuestion.length > 200) {
      toast({
        title: 'Invalid Question',
        description: 'Question text is required and must be 200 characters or less.',
        variant: 'destructive'
      });
      return;
    }

    const newQuestionItem: QuestionItem = {
      id: generateQuestionId(),
      text: newQuestion.trim(),
      order: settings.questionnaire.length + 1
    };

    const updatedQuestionnaire = [...settings.questionnaire, newQuestionItem];
    setSettings(prev => ({ ...prev, questionnaire: updatedQuestionnaire }));
    setNewQuestion('');
    setIsAddingQuestion(false);
    
    toast({
      title: 'Question Added',
      description: 'New question has been added to the questionnaire.'
    });
  };

  const updateQuestion = (questionId: string) => {
    if (!editQuestionText.trim() || editQuestionText.length > 200) {
      toast({
        title: 'Invalid Question',
        description: 'Question text is required and must be 200 characters or less.',
        variant: 'destructive'
      });
      return;
    }

    const updatedQuestionnaire = settings.questionnaire.map(q => 
      q.id === questionId ? { ...q, text: editQuestionText.trim() } : q
    );
    
    setSettings(prev => ({ ...prev, questionnaire: updatedQuestionnaire }));
    setEditingQuestion(null);
    setEditQuestionText('');
    
    toast({
      title: 'Question Updated',
      description: 'Question has been updated successfully.'
    });
  };

  const deleteQuestion = (questionId: string) => {
    const updatedQuestionnaire = settings.questionnaire
      .filter(q => q.id !== questionId)
      .map((q, index) => ({ ...q, order: index + 1 })); // Reorder after deletion
    
    setSettings(prev => ({ ...prev, questionnaire: updatedQuestionnaire }));
    
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
              <Label htmlFor="company_logo">Company Logo</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="company_logo"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        handleInputChange('company_logo', event.target?.result as string);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('company_logo')?.click()}
                  className="flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Upload Logo
                </Button>
                {settings.company_logo && (
                  <div className="flex items-center gap-2">
                    <img
                      src={settings.company_logo}
                      alt="Company logo preview"
                      className="h-10 w-10 object-contain border rounded"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleInputChange('company_logo', '')}
                    >
                      Remove
                    </Button>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Upload your company logo (PNG, JPG, GIF)
              </p>
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

        {/* SMTP Configuration */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              SMTP Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Enable SMTP Toggle */}
            <div className="flex items-center space-x-2">
              <Switch
                id="smtp_enabled"
                checked={settings.smtp_enabled}
                onCheckedChange={(checked) => handleInputChange('smtp_enabled', checked)}
              />
              <Label htmlFor="smtp_enabled" className="font-medium">
                Enable SMTP Email Delivery
              </Label>
            </div>
            <p className="text-sm text-muted-foreground">
              Configure SMTP settings to send automated emails for invoices and LMS notifications
            </p>

            {/* SMTP Fields - only show when enabled */}
            {settings.smtp_enabled && (
              <>
                <Separator className="my-4" />
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="smtp_host">SMTP Host *</Label>
                    <Input
                      id="smtp_host"
                      value={settings.smtp_host || ''}
                      onChange={(e) => handleInputChange('smtp_host', e.target.value)}
                      placeholder="smtp.gmail.com"
                      required={settings.smtp_enabled}
                    />
                    <p className="text-xs text-muted-foreground">
                      Your SMTP server hostname
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="smtp_port">SMTP Port</Label>
                    <Input
                      id="smtp_port"
                      type="number"
                      min="1"
                      max="65535"
                      value={settings.smtp_port}
                      onChange={(e) => handleInputChange('smtp_port', parseInt(e.target.value))}
                      placeholder="587"
                    />
                    <p className="text-xs text-muted-foreground">
                      Port number (587 for TLS, 465 for SSL)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="smtp_encryption">Encryption Type</Label>
                    <Select 
                      value={settings.smtp_encryption} 
                      onValueChange={(value) => handleInputChange('smtp_encryption', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select encryption" />
                      </SelectTrigger>
                      <SelectContent className="bg-white z-50">
                        <SelectItem value="None">None</SelectItem>
                        <SelectItem value="SSL/TLS">SSL/TLS</SelectItem>
                        <SelectItem value="STARTTLS">STARTTLS</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Encryption method for secure connection
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="smtp_username">SMTP Username</Label>
                    <Input
                      id="smtp_username"
                      value={settings.smtp_username || ''}
                      onChange={(e) => handleInputChange('smtp_username', e.target.value)}
                      placeholder="your-email@domain.com"
                    />
                    <p className="text-xs text-muted-foreground">
                      Username for SMTP authentication
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="smtp_password">SMTP Password</Label>
                    <Input
                      id="smtp_password"
                      type="password"
                      value={settings.smtp_password || ''}
                      onChange={(e) => handleInputChange('smtp_password', e.target.value)}
                      placeholder="••••••••••••"
                    />
                    <p className="text-xs text-muted-foreground">
                      Password or app-specific password
                    </p>
                  </div>
                </div>

                {/* Email Addresses Section */}
                <Separator className="my-6" />
                
                <div className="space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Default Email Addresses
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Invoice Email Settings */}
                    <div className="space-y-4 p-4 border rounded-lg">
                      <h5 className="font-medium flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Invoice Emails
                      </h5>
                      
                      <div className="space-y-2">
                        <Label htmlFor="invoice_from_email">Invoice From Address</Label>
                        <Input
                          id="invoice_from_email"
                          type="email"
                          value={settings.invoice_from_email || ''}
                          onChange={(e) => handleInputChange('invoice_from_email', e.target.value)}
                          placeholder="billing@company.com"
                        />
                        <p className="text-xs text-muted-foreground">
                          The email address used to send all invoices
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="invoice_from_name">Invoice From Name (Optional)</Label>
                        <Input
                          id="invoice_from_name"
                          value={settings.invoice_from_name || ''}
                          onChange={(e) => handleInputChange('invoice_from_name', e.target.value)}
                          placeholder="Company Billing"
                        />
                        <p className="text-xs text-muted-foreground">
                          Display name for invoice emails
                        </p>
                      </div>
                    </div>

                    {/* LMS Email Settings */}
                    <div className="space-y-4 p-4 border rounded-lg">
                      <h5 className="font-medium flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        LMS Notifications
                      </h5>
                      
                      <div className="space-y-2">
                        <Label htmlFor="lms_from_email">LMS Details From Address</Label>
                        <Input
                          id="lms_from_email"
                          type="email"
                          value={settings.lms_from_email || ''}
                          onChange={(e) => handleInputChange('lms_from_email', e.target.value)}
                          placeholder="lms@company.com"
                        />
                        <p className="text-xs text-muted-foreground">
                          The email address used for sending LMS enrollment and course notifications
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="lms_from_name">LMS From Name (Optional)</Label>
                        <Input
                          id="lms_from_name"
                          value={settings.lms_from_name || ''}
                          onChange={(e) => handleInputChange('lms_from_name', e.target.value)}
                          placeholder="Company LMS"
                        />
                        <p className="text-xs text-muted-foreground">
                          Display name for LMS notification emails
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
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
                      <div className="text-center py-8 text-muted-foreground border-2 border-dashed border-muted rounded-lg">
                        <HelpCircle className="mx-auto h-8 w-8 mb-2" />
                        <p>No questions added yet</p>
                        <p className="text-sm">Add your first question below</p>
                      </div>
                    ) : (
                      settings.questionnaire
                        .sort((a, b) => a.order - b.order)
                        .map((question, index) => (
                          <div
                            key={question.id}
                            className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50"
                          >
                            {/* Drag handle */}
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
                            <div className="flex-1 min-w-0">
                              {editingQuestion === question.id ? (
                                <div className="flex gap-2">
                                  <Input
                                    value={editQuestionText}
                                    onChange={(e) => setEditQuestionText(e.target.value)}
                                    placeholder="Enter question text..."
                                    maxLength={200}
                                    className="flex-1"
                                  />
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => updateQuestion(question.id)}
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setEditingQuestion(null);
                                      setEditQuestionText('');
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              ) : (
                                <div>
                                  <p className="text-sm font-medium">
                                    {index + 1}. {question.text}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {question.text.length}/200 characters
                                  </p>
                                </div>
                              )}
                            </div>

                            {/* Action buttons */}
                            {editingQuestion !== question.id && (
                              <div className="flex gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setEditingQuestion(question.id);
                                    setEditQuestionText(question.text);
                                  }}
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
                            )}
                          </div>
                        ))
                    )}
                  </div>

                  {/* Add New Question */}
                  <div className="space-y-3">
                    {isAddingQuestion ? (
                      <div className="flex gap-2">
                        <Input
                          value={newQuestion}
                          onChange={(e) => setNewQuestion(e.target.value)}
                          placeholder="Enter new question text..."
                          maxLength={200}
                          className="flex-1"
                        />
                        <Button type="button" onClick={addQuestion}>
                          Save
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setIsAddingQuestion(false);
                            setNewQuestion('');
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsAddingQuestion(true)}
                        className="flex items-center gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Add Question
                      </Button>
                    )}
                    
                    {isAddingQuestion && (
                      <p className="text-xs text-muted-foreground">
                        {newQuestion.length}/200 characters
                      </p>
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