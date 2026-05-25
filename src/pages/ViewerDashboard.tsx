import { useSearchParams } from 'react-router-dom';
import { RoleGuard } from '@/components/RoleGuard';
import { ViewerReadOnlyLock } from '@/components/ViewerReadOnlyLock';
import { RecordingsManagement } from '@/components/superadmin/RecordingsManagement';
import { StudentsManagement } from '@/components/superadmin/StudentsManagement';
import { SuccessSessionsManagement } from '@/components/superadmin/SuccessSessionsManagement';
import { SubmissionsManagement } from '@/components/assignments/SubmissionsManagement';
import { BatchManagement } from '@/components/batch';
import Resources from '@/pages/Resources';
import { StudentAnalytics } from '@/components/admin/StudentAnalytics';

/**
 * Read-only dashboard for the `viewer` role.
 * Allowed tabs: dashboard, recordings, resources, submissions,
 * success-sessions, students, batches.
 */
export default function ViewerDashboard() {
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'dashboard';

  const renderContent = () => {
    switch (activeTab) {
      case 'recordings':
        return <RecordingsManagement />;
      case 'resources':
        return <Resources />;
      case 'submissions':
        return <SubmissionsManagement userRole="superadmin" />;
      case 'success-sessions':
        return <SuccessSessionsManagement />;
      case 'students':
        return <StudentsManagement />;
      case 'batches':
        return <BatchManagement />;
      case 'dashboard':
      default:
        return <StudentAnalytics />;
    }
  };

  return (
    <RoleGuard allowedRoles={['viewer']}>
      <ViewerReadOnlyLock>
        <div className="w-full max-w-none p-6 animate-fade-in px-0 py-0">
          {renderContent()}
        </div>
      </ViewerReadOnlyLock>
    </RoleGuard>
  );
}
