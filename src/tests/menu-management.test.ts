import { describe, it, expect } from 'vitest';
import { DEFAULT_MENU_ITEMS, BAR_DRINKS, formatDrinkHistoryLabel, MenuItem } from '../lib/types';

describe('Party Menu Management', () => {
  it('pre-populates the menu with all drinks found on the drink selection list', () => {
    // Verify that every single bar drink on the POS selection list is represented in DEFAULT_MENU_ITEMS
    for (const barDrink of BAR_DRINKS) {
      const match = DEFAULT_MENU_ITEMS.find(m => m.type === barDrink.type);
      expect(match).toBeDefined();
      expect(match?.name.toLowerCase()).toBe(barDrink.label.toLowerCase());
      expect(match?.category).toBe(barDrink.category);
      expect(match?.is_available).toBe(true);
    }

    // Soft drink is also included
    const softMatch = DEFAULT_MENU_ITEMS.find(m => m.type === 'soft');
    expect(softMatch).toBeDefined();
    expect(softMatch?.category).toBe('soft');
  });

  it('formats history labels for standard and custom menu drinks', () => {
    const customMenu: MenuItem[] = [
      ...DEFAULT_MENU_ITEMS,
      {
        id: 'menu-aperol',
        name: 'Aperol Spritz',
        type: 'aperol spritz',
        category: 'cocktail',
        is_available: true,
      },
    ];

    expect(formatDrinkHistoryLabel('whiskey sour', customMenu)).toBe('Cocktail - Whiskey Sour');
    expect(formatDrinkHistoryLabel('aperol spritz', customMenu)).toBe('Cocktail - Aperol Spritz');
    expect(formatDrinkHistoryLabel('beer', customMenu)).toBe('Beer - Beer');
  });
});
