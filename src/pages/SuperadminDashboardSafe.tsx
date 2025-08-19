import React from 'react';
import { SafeDatabaseErrorBoundary } from '@/components/SafeDatabaseErrorBoundary';
import SuperadminDashboard from '@/pages/SuperadminDashboard';

export default function SuperadminDashboardWithBoundary() {
  return (
    <SafeDatabaseErrorBoundary context="superadmin-dashboard">
      <SuperadminDashboard />
    </SafeDatabaseErrorBoundary>
  );
}