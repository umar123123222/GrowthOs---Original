import { RoleGuard } from '@/components/RoleGuard';
import { MentorRecordingsManagement } from '@/components/mentor/MentorRecordingsManagement';

export default function MentorRecordingsPage() {
  return (
    <RoleGuard allowedRoles={['mentor']}>
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Recordings Management</h1>
        <MentorRecordingsManagement />
      </div>
    </RoleGuard>
  );
}
