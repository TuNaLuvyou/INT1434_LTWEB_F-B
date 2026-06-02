'use client';

import React, { useState, useEffect } from 'react';
import { useRole } from '@/hooks/useRole';
import type { ComponentType } from 'react';
import type { Role } from '@/hooks/useRole';

/**
 * Higher-Order Component để bảo vệ một Component dựa trên Role.
 * @param allowedRoles Danh sách các Role được phép truy cập Component
 * @param WrappedComponent Component gốc cần bảo vệ
 * @param fallback UI thay thế nếu không có quyền (mặc định: null)
 */
export function withRole<P extends object>(
  allowedRoles: Role[],
  WrappedComponent: ComponentType<P>,
  fallback: React.ReactNode = null
) {
  function RoleGuardedComponent(props: P) {
    const role = useRole();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
      setMounted(true);
    }, []);

    if (!mounted) return null; // Prevent hydration mismatch

    if (!role || !allowedRoles.includes(role)) return <>{fallback}</>;
    return <WrappedComponent {...props} />;
  }
  RoleGuardedComponent.displayName = `withRole(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;
  return RoleGuardedComponent;
}
