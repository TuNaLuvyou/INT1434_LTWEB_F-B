'use client';

import React, { useState, useEffect } from 'react';
import { useRole } from '@/hooks/useRole';
import type { Role } from '@/hooks/useRole';
import { useAuthStore } from '@/stores/auth.store';

type RoleGateProps = {
  allowedRoles: Role[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
  loadingFallback?: React.ReactNode;
};

/**
 * Component dùng để bọc các phần tử JSX, chỉ render nếu user có Role phù hợp.
 * Tránh render trực tiếp vào DOM (không dùng CSS display: none hay opacity: 0).
 */
export function RoleGate({ allowedRoles, children, fallback = null, loadingFallback = null }: RoleGateProps) {
  const role = useRole();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isLoading = useAuthStore(state => state.isLoading);

  if (!mounted) return null; // Prevent hydration mismatch

  if (isLoading) {
    if (loadingFallback) return <>{loadingFallback}</>;
    return (
      <div className="min-h-screen bg-zinc-950"></div>
    );
  }

  console.log('RoleGate evaluate:', { currentRole: role, allowedRoles, user: useAuthStore.getState().user });

  if (!role || !allowedRoles.includes(role)) return <>{fallback}</>;
  
  return <>{children}</>;
}
