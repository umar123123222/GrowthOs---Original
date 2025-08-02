import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useEmailStatus } from '@/hooks/useEmailStatus';
import { Mail, AlertCircle, CheckCircle, Clock, RefreshCw, Send } from 'lucide-react';

interface EmailStatusIndicatorProps {
  userId: string;
  userName: string;
  showDetailed?: boolean;
}

export const EmailStatusIndicator = ({ userId, userName, showDetailed = false }: EmailStatusIndicatorProps) => {
  const { emailStatuses, loading, retryFailedEmails, triggerEmailProcessing } = useEmailStatus(userId);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'sending':
        return <Send className="w-4 h-4 text-blue-500" />;
      case 'pending':
      default:
        return <Clock className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'sent':
        return 'default' as const;
      case 'failed':
        return 'destructive' as const;
      case 'sending':
        return 'secondary' as const;
      case 'pending':
      default:
        return 'outline' as const;
    }
  };

  const getEmailTypeLabel = (type: string) => {
    switch (type) {
      case 'welcome_student':
        return 'Student Welcome';
      case 'welcome_staff':
        return 'Staff Welcome';
      case 'invoice':
        return 'Invoice';
      default:
        return type;
    }
  };

  if (loading) {
    return <div className="text-muted-foreground text-sm">Loading email status...</div>;
  }

  if (emailStatuses.length === 0) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Mail className="w-4 h-4" />
        No emails queued
      </div>
    );
  }

  const failedEmails = emailStatuses.filter(e => e.status === 'failed');
  const hasFailedEmails = failedEmails.length > 0;

  if (!showDetailed) {
    // Simple indicator for table views
    const allSent = emailStatuses.every(e => e.status === 'sent');
    const anyFailed = emailStatuses.some(e => e.status === 'failed');
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2">
              <Badge variant={anyFailed ? 'destructive' : allSent ? 'default' : 'outline'}>
                {getStatusIcon(anyFailed ? 'failed' : allSent ? 'sent' : 'pending')}
                <span className="ml-1">
                  {anyFailed ? 'Email Failed' : allSent ? 'Email Sent' : 'Email Pending'}
                </span>
              </Badge>
              {hasFailedEmails && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => retryFailedEmails(userId)}
                  className="h-6 px-2 text-xs"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Retry
                </Button>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1">
              {emailStatuses.map(email => (
                <div key={email.id} className="flex items-center gap-2 text-xs">
                  {getStatusIcon(email.status)}
                  <span>{getEmailTypeLabel(email.email_type)}</span>
                  <Badge variant={getStatusVariant(email.status)} className="text-xs px-1 py-0">
                    {email.status}
                  </Badge>
                </div>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Detailed view for dedicated email status components
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Mail className="w-5 h-5" />
          Email Status - {userName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {emailStatuses.map(email => (
          <div key={email.id} className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              {getStatusIcon(email.status)}
              <div>
                <div className="font-medium">{getEmailTypeLabel(email.email_type)}</div>
                <div className="text-sm text-muted-foreground">
                  To: {email.recipient_email}
                </div>
                {email.error_message && (
                  <div className="text-xs text-red-600 mt-1">
                    Error: {email.error_message}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={getStatusVariant(email.status)}>
                {email.status}
              </Badge>
              {email.retry_count > 0 && (
                <Badge variant="outline" className="text-xs">
                  Retry {email.retry_count}
                </Badge>
              )}
            </div>
          </div>
        ))}
        
        <div className="flex gap-2 pt-3 border-t">
          <Button
            size="sm"
            variant="outline"
            onClick={triggerEmailProcessing}
            className="flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            Process Queue
          </Button>
          {hasFailedEmails && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => retryFailedEmails(userId)}
              className="flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Retry Failed ({failedEmails.length})
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};