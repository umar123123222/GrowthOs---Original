import { RoleGuard } from '@/components/RoleGuard';
import { RecoveryManagement } from '@/components/admin/RecoveryManagement';

export default function AtRiskStudents() {
  return (
    <RoleGuard allowedRoles={['admin', 'superadmin']}>
      <div className="w-full max-w-none p-6 animate-fade-in">
        <RecoveryManagement />
      </div>
    </RoleGuard>
  );
}
