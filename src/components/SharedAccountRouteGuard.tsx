import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

/**
 * Blocks pages that are intentionally absent from a shared student account's
 * menu. Without this, typing the address directly still opens the page, which
 * leaks per-student surfaces (rank, certificates, assignments, integrations)
 * into accounts that many students share. Only shared student accounts are
 * affected — everyone else renders normally.
 */
export const SharedAccountRouteGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const isSharedStudentAccount = user?.role === 'student' && Boolean((user as any)?.is_shared_account);

  if (isSharedStudentAccount) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default SharedAccountRouteGuard;
