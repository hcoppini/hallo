export type GuestCategory = 'standard' | 'driver_minor' | 'vip';

export type SpecificDrinkType =
  | 'beer'
  | 'whiskey sour'
  | 'mojito'
  | 'jagerbomba'
  | 'cosmopolitan'
  | 'red wine'
  | 'sparkling wine';

export type DrinkType =
  | SpecificDrinkType
  | 'cocktail'
  | 'shot'
  | 'wine'
  | 'soft'
  | (string & {});

export interface BarDrinkOption {
  type: SpecificDrinkType;
  label: string;
  historyLabel: string;
  category: 'beer' | 'cocktail' | 'shot' | 'wine';
}

export interface MenuItem {
  id: string;
  name: string;
  type: string;
  category: 'beer' | 'cocktail' | 'shot' | 'wine' | 'soft';
  description?: string;
  is_available: boolean;
  price?: string;
}

export const DEFAULT_MENU_ITEMS: MenuItem[] = [
  {
    id: 'menu-beer',
    name: 'Beer',
    type: 'beer',
    category: 'beer',
    description: 'Crisp & refreshing draft beer / lager',
    is_available: true,
  },
  {
    id: 'menu-whiskey-sour',
    name: 'Whiskey Sour',
    type: 'whiskey sour',
    category: 'cocktail',
    description: 'Bourbon whiskey, fresh lemon juice, sugar syrup & angostura bitters',
    is_available: true,
  },
  {
    id: 'menu-mojito',
    name: 'Mojito',
    type: 'mojito',
    category: 'cocktail',
    description: 'White rum, fresh lime, crushed mint leaves & club soda',
    is_available: true,
  },
  {
    id: 'menu-jagerbomba',
    name: 'Jagerbomba',
    type: 'jagerbomba',
    category: 'shot',
    description: 'Jagermeister shot dropped into energy drink',
    is_available: true,
  },
  {
    id: 'menu-cosmopolitan',
    name: 'Cosmopolitan',
    type: 'cosmopolitan',
    category: 'cocktail',
    description: 'Vodka, triple sec, cranberry juice & freshly squeezed lime',
    is_available: true,
  },
  {
    id: 'menu-red-wine',
    name: 'Red Wine',
    type: 'red wine',
    category: 'wine',
    description: 'Rich full-bodied reserve red wine',
    is_available: true,
  },
  {
    id: 'menu-sparkling-wine',
    name: 'Sparkling Wine',
    type: 'sparkling wine',
    category: 'wine',
    description: 'Chilled prosecco / sparkling wine',
    is_available: true,
  },
  {
    id: 'menu-soft',
    name: 'Soft Drink',
    type: 'soft',
    category: 'soft',
    description: 'Cola, sparkling water, fruit soda or tonic',
    is_available: true,
  },
];

export const BAR_DRINKS: BarDrinkOption[] = [
  { type: 'beer', label: 'beer', historyLabel: 'Beer', category: 'beer' },
  { type: 'whiskey sour', label: 'whiskey sour', historyLabel: 'Cocktail - Whiskey Sour', category: 'cocktail' },
  { type: 'mojito', label: 'mojito', historyLabel: 'Cocktail - Mojito', category: 'cocktail' },
  { type: 'jagerbomba', label: 'jagerbomba', historyLabel: 'Shot - Jagerbomba', category: 'shot' },
  { type: 'cosmopolitan', label: 'cosmopolitan', historyLabel: 'Cocktail - Cosmopolitan', category: 'cocktail' },
  { type: 'red wine', label: 'red wine', historyLabel: 'Wine - Red Wine', category: 'wine' },
  { type: 'sparkling wine', label: 'sparkling wine', historyLabel: 'Wine - Sparkling Wine', category: 'wine' },
];

export function formatDrinkHistoryLabel(drinkType: string, menu?: MenuItem[]): string {
  const normalized = drinkType.trim().toLowerCase();
  if (menu) {
    const fromMenu = menu.find(
      m => m.type.toLowerCase() === normalized || m.name.toLowerCase() === normalized
    );
    if (fromMenu) {
      const catCap = fromMenu.category.charAt(0).toUpperCase() + fromMenu.category.slice(1);
      return `${catCap} - ${fromMenu.name}`;
    }
  }
  const found = BAR_DRINKS.find(d => d.type === normalized);
  if (found) return found.historyLabel;
  if (normalized === 'cocktail') return 'Cocktail';
  if (normalized === 'shot') return 'Shot';
  if (normalized === 'wine') return 'Wine';
  if (normalized === 'soft') return 'Soft Drink';
  return drinkType.charAt(0).toUpperCase() + drinkType.slice(1);
}

export interface PartySettings {
  id: string;
  party_name: string;
  default_drink_limit: number;
  is_party_active: boolean;
  admin_pin: string;
  cutoff_time?: string | null;
  enable_hardware_uid_reading?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ImportedGuest {
  id: string;
  name: string;
  category?: GuestCategory;
  notes?: string | null;
  is_checked_in: boolean;
  checked_in_tag_id?: string | null;
  imported_at: string;
}

export interface Guest {
  id: string;
  tag_id: string;
  hardware_uid?: string | null;
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
  log?: DrinkLog;
}

export interface DoorCheckInInput {
  tag_id: string;
  hardware_uid?: string | null;
  name: string;
  category?: GuestCategory;
  custom_drink_limit?: number | null;
  notes?: string;
}
