'use client';

import { useState, useEffect } from 'react';

const STAFF_AUTH_KEY = 'halloween_party_staff_auth_v1';
const AUTH_EVENT_NAME = 'halloween_party_auth_change';

let memoryAuthSession = false;

export function isStaffAuthenticated(): boolean {
  if (typeof window === 'undefined') return memoryAuthSession;
  try {
    const val = localStorage.getItem(STAFF_AUTH_KEY);
    return val === 'true' || memoryAuthSession;
  } catch {
    return memoryAuthSession;
  }
}

export function authenticateStaff(enteredPin: string, validPin: string): boolean {
  if (!enteredPin || !validPin) return false;
  const isMatch = enteredPin.trim() === validPin.trim();
  if (isMatch) {
    memoryAuthSession = true;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STAFF_AUTH_KEY, 'true');
        window.dispatchEvent(new Event(AUTH_EVENT_NAME));
      } catch {
        // fallback
      }
    }
  }
  return isMatch;
}

export function logoutStaff(): void {
  memoryAuthSession = false;
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(STAFF_AUTH_KEY);
      window.dispatchEvent(new Event(AUTH_EVENT_NAME));
    } catch {
      // fallback
    }
  }
}

/**
 * Hook to reactively track staff authentication status across any component or tab
 */
export function useStaffAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => isStaffAuthenticated());

  useEffect(() => {
    const handleAuthChange = () => {
      setIsAuthenticated(isStaffAuthenticated());
    };

    window.addEventListener(AUTH_EVENT_NAME, handleAuthChange);
    window.addEventListener('storage', handleAuthChange);

    // Initial check on mount
    setIsAuthenticated(isStaffAuthenticated());

    return () => {
      window.removeEventListener(AUTH_EVENT_NAME, handleAuthChange);
      window.removeEventListener('storage', handleAuthChange);
    };
  }, []);

  return {
    isAuthenticated,
    authenticate: (pin: string, validPin: string) => authenticateStaff(pin, validPin),
    logout: logoutStaff,
  };
}
