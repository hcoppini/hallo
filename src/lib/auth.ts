'use client';

import { useState, useEffect } from 'react';

const STAFF_AUTH_KEY = 'halloween_party_staff_auth_v1';
const STAFF_COOKIE_NAME = 'halloween_staff_session';
const STAFF_DRINK_KEY = 'halloween_active_drink_type';
const STAFF_STATION_KEY = 'halloween_staff_station_mode';
const AUTH_EVENT_NAME = 'halloween_party_auth_change';

export type StaffStationMode = 'barman' | 'door';

let memoryAuthSession = false;

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : null;
}

function setCookie(name: string, value: string, maxAgeSeconds = 86400): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAgeSeconds}; path=/; SameSite=Lax`;
}

function removeCookie(name: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; max-age=0; path=/; SameSite=Lax`;
}

export function isStaffAuthenticated(): boolean {
  if (typeof window === 'undefined') return memoryAuthSession;

  // 1. Check in-memory flag
  if (memoryAuthSession) return true;

  // 2. Check localStorage
  try {
    const val = localStorage.getItem(STAFF_AUTH_KEY);
    if (val === 'true') {
      memoryAuthSession = true;
      return true;
    }
  } catch {}

  // 3. Check persistent 24-hour cookie
  try {
    const cookieVal = getCookie(STAFF_COOKIE_NAME);
    if (cookieVal === 'true') {
      memoryAuthSession = true;
      return true;
    }
  } catch {}

  // 4. Check URL query parameters with secret PIN (?pin=2113 or ?key=2113)
  try {
    const search = window.location.search;
    if (search) {
      const params = new URLSearchParams(search);
      const pinParam = params.get('pin') || params.get('key');
      if (pinParam && pinParam.trim() === '2113') {
        setStaffAuthenticated(true);
        return true;
      }
    }
  } catch {}

  return false;
}

export function setStaffAuthenticated(authenticated: boolean): void {
  memoryAuthSession = authenticated;
  if (typeof window !== 'undefined') {
    try {
      if (authenticated) {
        localStorage.setItem(STAFF_AUTH_KEY, 'true');
        setCookie(STAFF_COOKIE_NAME, 'true', 86400); // 24 hours
      } else {
        localStorage.removeItem(STAFF_AUTH_KEY);
        removeCookie(STAFF_COOKIE_NAME);
      }
      window.dispatchEvent(new Event(AUTH_EVENT_NAME));
    } catch {}
  }
}

export function authenticateStaff(enteredPin: string, validPin: string): boolean {
  if (!enteredPin || !validPin) return false;
  const isMatch = enteredPin.trim() === validPin.trim();
  if (isMatch) {
    setStaffAuthenticated(true);
  }
  return isMatch;
}

export function logoutStaff(): void {
  setStaffAuthenticated(false);
}

let memoryActiveDrinkType = 'cocktail';

export function getStaffActiveDrinkType(): string {
  if (typeof window === 'undefined') return memoryActiveDrinkType;
  try {
    return localStorage.getItem(STAFF_DRINK_KEY) || memoryActiveDrinkType;
  } catch {
    return memoryActiveDrinkType;
  }
}

export function setStaffActiveDrinkType(drinkType: string): void {
  memoryActiveDrinkType = drinkType;
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STAFF_DRINK_KEY, drinkType);
    window.dispatchEvent(new Event(AUTH_EVENT_NAME));
  } catch {}
}

let memoryStationMode: StaffStationMode = 'barman';

export function getStaffStationMode(): StaffStationMode {
  if (typeof window === 'undefined') return memoryStationMode;
  try {
    const val = localStorage.getItem(STAFF_STATION_KEY);
    if (val === 'door' || val === 'barman') {
      memoryStationMode = val;
      return val;
    }
    return memoryStationMode;
  } catch {
    return memoryStationMode;
  }
}

export function setStaffStationMode(mode: StaffStationMode): void {
  memoryStationMode = mode;
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STAFF_STATION_KEY, mode);
    window.dispatchEvent(new Event(AUTH_EVENT_NAME));
  } catch {}
}

/**
 * Hook to reactively track staff authentication status and station preferences across any component or tab
 */
export function useStaffAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [stationMode, setStationModeState] = useState<StaffStationMode>('barman');
  const [activeDrinkType, setActiveDrinkTypeState] = useState<string>('beer');

  useEffect(() => {
    const handleAuthChange = () => {
      setIsAuthenticated(isStaffAuthenticated());
      setStationModeState(getStaffStationMode());
      setActiveDrinkTypeState(getStaffActiveDrinkType());
    };

    window.addEventListener(AUTH_EVENT_NAME, handleAuthChange);
    window.addEventListener('storage', handleAuthChange);

    // Initial check on mount
    handleAuthChange();

    return () => {
      window.removeEventListener(AUTH_EVENT_NAME, handleAuthChange);
      window.removeEventListener('storage', handleAuthChange);
    };
  }, []);

  return {
    isAuthenticated,
    stationMode,
    activeDrinkType,
    setStationMode: (mode: StaffStationMode) => setStaffStationMode(mode),
    setActiveDrinkType: (type: string) => setStaffActiveDrinkType(type),
    authenticate: (pin: string, validPin: string) => authenticateStaff(pin, validPin),
    logout: logoutStaff,
  };
}
