import { Button } from '@/components/ui/button';
import { Activity } from 'lucide-react';
import { ActivityLogsDialog } from './ActivityLogsDialog';
import { useAuth } from '@/hooks/useAuth';

export function FloatingActivityButton() {
  const { user } = useAuth();
  
  // Only show for admin, superadmin, and mentor roles
  if (!user || !['admin', 'superadmin', 'mentor'].includes(user.role || '')) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <ActivityLogsDialog>
        <Button
          size="lg"
          className="rounded-full w-14 h-14 shadow-lg hover:shadow-xl transition-all duration-200 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
          title="View Activity Logs"
        >
          <Activity className="w-6 h-6" />
        </Button>
      </ActivityLogsDialog>
    </div>
  );
}