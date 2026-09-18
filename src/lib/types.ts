export type GuestCategory = 'standard' | 'driver_minor' | 'vip';

export type DrinkType = 'beer' | 'cocktail' | 'shot' | 'wine' | 'soft';

export interface PartySettings {
  id: string;
  party_name: string;
  default_drink_limit: number;
  is_party_active: boolean;
  admin_pin: string;
  cutoff_time?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Guest {
  id: string;
  tag_id: string;
  name: string | null;
  category: GuestCategory;
  custom_drink_limit: number | null; // null inherits default_drink_limit
  drinks_consumed: number;
  is_entered: boolean;
  entered_at: string | null;
  is_blocked: boolean;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DrinkLog {
  id: string;
  guest_id: string;
  drink_type: DrinkType;
  served_at: string;
  served_by: string;
  is_reverted: boolean;
  reverted_at?: string | null;
}

export interface ServeDrinkResult {
  success: boolean;
  error?: 'PARTY_PAUSED' | 'GUEST_NOT_FOUND' | 'GUEST_BLOCKED' | 'LIMIT_REACHED' | 'SYSTEM_ERROR';
  message?: string;
  guest?: Guest;
  guest_id?: string;
  name?: string;
  drink_type?: DrinkType;
  drinks_consumed?: number;
  effective_limit?: number;
  remaining?: number;
  is_final_drink?: boolean;
  is_limit_reached?: boolean;
  log_id?: string;
}

export interface DoorCheckInInput {
  tag_id: string;
  name: string;
  category?: GuestCategory;
  custom_drink_limit?: number | null;
  notes?: string;
}
