import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Settings, Mail, TestTube, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface SMTPSettings {
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  smtp_password: string;
  smtp_secure: boolean;
  lms_from_email: string;
  lms_from_name: string;
  invoice_from_email: string;
  invoice_from_name: string;
}

interface SMTPConfigurationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SMTPConfigurationDialog = ({ open, onOpenChange }: SMTPConfigurationDialogProps) => {
  const [settings, setSettings] = useState<SMTPSettings>({
    smtp_host: '',
    smtp_port: 587,
    smtp_username: '',
    smtp_password: '',
    smtp_secure: true,
    lms_from_email: '',
    lms_from_name: '',
    invoice_from_email: '',
    invoice_from_name: '',
  });
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchSettings();
    }
  }, [open]);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .single();

      if (error) throw error;

      if (data) {
        setSettings({
          smtp_host: data.smtp_host || '',
          smtp_port: data.smtp_port || 587,
          smtp_username: data.smtp_username || '',
          smtp_password: data.smtp_password || '',
          smtp_secure: data.smtp_secure !== false,
          lms_from_email: data.lms_from_email || '',
          lms_from_name: data.lms_from_name || '',
          invoice_from_email: data.invoice_from_email || '',
          invoice_from_name: data.invoice_from_name || '',
        });
      }
    } catch (error: any) {
      console.error('Error fetching SMTP settings:', error);
      toast({
        title: "Error",
        description: "Failed to load SMTP settings",
        variant: "destructive"
      });
    }
  };

  const saveSettings = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('company_settings')
        .update({
          smtp_host: settings.smtp_host,
          smtp_port: settings.smtp_port,
          smtp_username: settings.smtp_username,
          smtp_password: settings.smtp_password,
          smtp_secure: settings.smtp_secure,
          lms_from_email: settings.lms_from_email,
          lms_from_name: settings.lms_from_name,
          invoice_from_email: settings.invoice_from_email,
          invoice_from_name: settings.invoice_from_name,
        })
        .eq('id', 1);

      if (error) throw error;

      toast({
        title: "Success",
        description: "SMTP settings saved successfully"
      });

      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving SMTP settings:', error);
      toast({
        title: "Error", 
        description: "Failed to save SMTP settings",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    
    try {
      const response = await supabase.functions.invoke('test-smtp-connection', {
        body: {
          smtp_host: settings.smtp_host,
          smtp_port: settings.smtp_port,
          smtp_username: settings.smtp_username,
          smtp_password: settings.smtp_password,
          smtp_secure: settings.smtp_secure,
          test_email: settings.lms_from_email
        }
      });

      if (response.error) {
        throw response.error;
      }

      setTestResult({
        success: true,
        message: "SMTP connection successful! Test email sent."
      });

    } catch (error: any) {
      console.error('SMTP test failed:', error);
      setTestResult({
        success: false,
        message: `Connection failed: ${error.message || 'Unknown error'}`
      });
    } finally {
      setTesting(false);
    }
  };

  const isConfigured = settings.smtp_host && settings.smtp_username && settings.smtp_password;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Email Configuration
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Email Service Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span>SMTP Configuration</span>
                <Badge variant={isConfigured ? "default" : "secondary"}>
                  {isConfigured ? (
                    <>
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Configured
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3 h-3 mr-1" />
                      Not Configured
                    </>
                  )}
                </Badge>
              </div>
              {testResult && (
                <div className={`p-3 rounded-lg border ${
                  testResult.success 
                    ? 'bg-green-50 border-green-200 text-green-800' 
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                  {testResult.success ? (
                    <CheckCircle className="w-4 h-4 inline mr-2" />
                  ) : (
                    <AlertCircle className="w-4 h-4 inline mr-2" />
                  )}
                  {testResult.message}
                </div>
              )}
            </CardContent>
          </Card>

          {/* SMTP Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>SMTP Server Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="smtp_host">SMTP Host *</Label>
                  <Input
                    id="smtp_host"
                    value={settings.smtp_host}
                    onChange={(e) => setSettings({...settings, smtp_host: e.target.value})}
                    placeholder="smtp.gmail.com"
                  />
                </div>
                <div>
                  <Label htmlFor="smtp_port">Port *</Label>
                  <Input
                    id="smtp_port"
                    type="number"
                    value={settings.smtp_port}
                    onChange={(e) => setSettings({...settings, smtp_port: parseInt(e.target.value) || 587})}
                    placeholder="587"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="smtp_username">Username *</Label>
                  <Input
                    id="smtp_username"
                    value={settings.smtp_username}
                    onChange={(e) => setSettings({...settings, smtp_username: e.target.value})}
                    placeholder="your-email@domain.com"
                  />
                </div>
                <div>
                  <Label htmlFor="smtp_password">Password *</Label>
                  <Input
                    id="smtp_password"
                    type="password"
                    value={settings.smtp_password}
                    onChange={(e) => setSettings({...settings, smtp_password: e.target.value})}
                    placeholder="Your app password"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="smtp_secure"
                  checked={settings.smtp_secure}
                  onCheckedChange={(checked) => setSettings({...settings, smtp_secure: checked})}
                />
                <Label htmlFor="smtp_secure">Use TLS/SSL (Recommended)</Label>
              </div>

              <Button
                onClick={testConnection}
                disabled={!settings.smtp_host || !settings.smtp_username || !settings.smtp_password || testing}
                variant="outline"
                className="w-full"
              >
                {testing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Testing Connection...
                  </>
                ) : (
                  <>
                    <TestTube className="w-4 h-4 mr-2" />
                    Test SMTP Connection
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Separator />

          {/* Email Sender Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Email Sender Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="lms_from_name">LMS From Name</Label>
                  <Input
                    id="lms_from_name"
                    value={settings.lms_from_name}
                    onChange={(e) => setSettings({...settings, lms_from_name: e.target.value})}
                    placeholder="LMS Team"
                  />
                </div>
                <div>
                  <Label htmlFor="lms_from_email">LMS From Email</Label>
                  <Input
                    id="lms_from_email"
                    type="email"
                    value={settings.lms_from_email}
                    onChange={(e) => setSettings({...settings, lms_from_email: e.target.value})}
                    placeholder="noreply@yourdomain.com"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="invoice_from_name">Billing From Name</Label>
                  <Input
                    id="invoice_from_name"
                    value={settings.invoice_from_name}
                    onChange={(e) => setSettings({...settings, invoice_from_name: e.target.value})}
                    placeholder="Billing Team"
                  />
                </div>
                <div>
                  <Label htmlFor="invoice_from_email">Billing From Email</Label>
                  <Input
                    id="invoice_from_email"
                    type="email"
                    value={settings.invoice_from_email}
                    onChange={(e) => setSettings({...settings, invoice_from_email: e.target.value})}
                    placeholder="billing@yourdomain.com"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={saveSettings}
              disabled={loading}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Configuration'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};