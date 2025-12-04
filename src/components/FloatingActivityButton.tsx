import { Button } from '@/components/ui/button';
import { Activity } from 'lucide-react';
import { ActivityLogsDialog } from './ActivityLogsDialog';
import { useAuth } from '@/hooks/useAuth';
export function FloatingActivityButton() {
  const {
    user
  } = useAuth();

  // Only show for admin and superadmin roles
  if (!user || !['admin', 'superadmin'].includes(user.role || '')) {
    return null;
  }
  return <div className="fixed bottom-6 right-6 z-50">
      <ActivityLogsDialog>
        
      </ActivityLogsDialog>
    </div>;
}