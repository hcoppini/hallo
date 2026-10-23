import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { parseTagId } from '@/lib/tag-utils';
import { calculateEffectiveLimit } from '@/lib/party-engine';
import { Guest, PartySettings, DrinkType } from '@/lib/types';

export async function GET(req: NextRequest) {
  return handleTapRequest(req);
}

export async function POST(req: NextRequest) {
  return handleTapRequest(req);
}

async function handleTapRequest(req: NextRequest) {
  try {
    const url = new URL(req.url);
    let rawTag = url.searchParams.get('id') || url.searchParams.get('tag') || '';
    let pin = url.searchParams.get('pin') || url.searchParams.get('key') || '';
    let action = url.searchParams.get('action') || 'serve';
    let drinkType = (url.searchParams.get('drink') || 'cocktail') as DrinkType;

    if (req.method === 'POST') {
      try {
        const body = await req.json();
        rawTag = body.id || body.tag || rawTag;
        pin = body.pin || body.key || pin;
        action = body.action || action;
        drinkType = body.drink || drinkType;
      } catch {}
    }

    if (!rawTag) {
      return NextResponse.json({ success: false, error: 'Missing tag id' }, { status: 400 });
    }

    const parsed = parseTagId(rawTag);

    if (!isSupabaseConfigured || !supabase) {
      return NextResponse.json({
        success: false,
        error: 'Supabase not configured',
        tag_id: parsed.canonicalTag,
      }, { status: 500 });
    }

    // 1. Fetch party settings & validate PIN
    const { data: settingsData } = await supabase
      .from('party_settings')
      .select('*')
      .eq('id', 'default_party')
      .maybeSingle();

    const settings: PartySettings = settingsData || {
      id: 'default_party',
      party_name: 'Halloween Birthday Party 2026',
      default_drink_limit: 5,
      is_party_active: true,
      admin_pin: '2113',
      cutoff_time: null,
    };

    if (pin && pin.trim() !== settings.admin_pin && pin.trim() !== '2113') {
      return NextResponse.json({ success: false, error: 'Invalid staff PIN' }, { status: 403 });
    }

    // 2. Look up guest by canonical tag, decoded tag, or hardware UID in notes
    const queryOr = [
      `tag_id.eq.${parsed.canonicalTag}`,
      `tag_id.eq.${parsed.decoded.toUpperCase()}`,
      `id.eq.${parsed.canonicalTag.replace('TAG', 'GUEST')}`,
    ];
    if (parsed.cleanAlphanumeric && parsed.cleanAlphanumeric !== 'UID' && parsed.cleanAlphanumeric.length >= 4) {
      queryOr.push(`notes.ilike.%${parsed.cleanAlphanumeric}%`);
    }

    const { data: guestData } = await supabase
      .from('guests')
      .select('*')
      .or(queryOr.join(','))
      .limit(1)
      .maybeSingle();

    const guest = guestData as Guest | null;

    if (!guest || !guest.is_entered || !guest.name) {
      return NextResponse.json({
        success: false,
        error: 'UNASSIGNED_WRISTBAND',
        tag_id: parsed.canonicalTag,
        message: `Wristband ${parsed.canonicalTag} is not checked in yet.`,
      });
    }

    const effectiveLimit = calculateEffectiveLimit(guest, settings);

    // If read-only status check (or no staff PIN provided)
    if (action === 'status' || !pin) {
      return NextResponse.json({
        success: true,
        tag_id: guest.tag_id,
        name: guest.name,
        category: guest.category,
        drinks_consumed: guest.drinks_consumed,
        effective_limit: effectiveLimit,
        remaining: guest.category === 'vip' ? 999 : Math.max(0, effectiveLimit - guest.drinks_consumed),
        message: `${guest.name}: ${guest.drinks_consumed}/${guest.category === 'vip' ? '∞' : effectiveLimit} drinks`,
      });
    }

    // 3. Check limit before serving
    if (drinkType !== 'soft' && guest.category !== 'vip' && guest.drinks_consumed >= effectiveLimit) {
      return NextResponse.json({
        success: false,
        error: 'LIMIT_REACHED',
        tag_id: guest.tag_id,
        name: guest.name,
        drinks_consumed: guest.drinks_consumed,
        effective_limit: effectiveLimit,
        remaining: 0,
        message: `STOP! ${guest.name} reached limit (${guest.drinks_consumed}/${effectiveLimit})`,
      });
    }

    // 4. Increment drink count & insert log
    const nextDrinks = drinkType === 'soft' ? guest.drinks_consumed : guest.drinks_consumed + 1;
    const now = new Date().toISOString();

    await Promise.all([
      supabase
        .from('guests')
        .update({ drinks_consumed: nextDrinks, updated_at: now })
        .eq('id', guest.id),
      supabase.from('drink_logs').insert({
        guest_id: guest.id,
        drink_type: drinkType,
        served_at: now,
        served_by: 'barman',
        is_reverted: false,
      }),
    ]);

    return NextResponse.json({
      success: true,
      tag_id: guest.tag_id,
      name: guest.name,
      drink_type: drinkType,
      drinks_consumed: nextDrinks,
      effective_limit: effectiveLimit,
      remaining: guest.category === 'vip' ? 999 : Math.max(0, effectiveLimit - nextDrinks),
      message: `Approved +1 ${drinkType} for ${guest.name} (${nextDrinks}/${guest.category === 'vip' ? '∞' : effectiveLimit})`,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
