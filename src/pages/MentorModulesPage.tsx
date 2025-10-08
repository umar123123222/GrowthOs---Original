import { RoleGuard } from '@/components/RoleGuard';
import { MentorModulesManagement } from '@/components/mentor/MentorModulesManagement';

export default function MentorModulesPage() {
  return (
    <RoleGuard allowedRoles={['mentor']}>
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Modules Management</h1>
        <MentorModulesManagement />
      </div>
    </RoleGuard>
  );
}
