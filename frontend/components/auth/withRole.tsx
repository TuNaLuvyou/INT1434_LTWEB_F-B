'use client';

import React, { useEffect, useState } from 'react';

// Hook hỗ trợ bóc payload JWT ở Client
export const useUserRole = () => {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const match = document.cookie.match(/(^| )access_token=([^;]+)/);
    if (match) {
      try {
        const payload = JSON.parse(atob(match[2].split('.')[1]));
        setRole(payload.role);
      } catch (e) {
        setRole(null);
      }
    }
  }, []);

  return role;
};

export function withRole(allowedRoles: string[], Component: React.ComponentType<any>) {
  return function WrappedComponent(props: any) {
    const role = useUserRole();
    
    // Đợi hydrate / đọc cookie
    if (!role) return null;

    if (!allowedRoles.includes(role)) {
      return null;
    }
    
    return <Component {...props} />;
  }
}
