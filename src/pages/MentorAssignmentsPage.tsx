import { RoleGuard } from '@/components/RoleGuard';
import { AssignmentManagement } from '@/components/assignments/AssignmentManagement';

export default function MentorAssignmentsPage() {
  return (
    <RoleGuard allowedRoles={['mentor']}>
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Assignments Management</h1>
        <AssignmentManagement />
      </div>
    </RoleGuard>
  );
}
