-- ====================================================================
-- HALLOWEEN PARTY NFC DRINK REGULATION SYSTEM SCHEMA
-- Compatible with Supabase Postgres
-- ====================================================================

-- 1. Create Party Settings Table
CREATE TABLE IF NOT EXISTS party_settings (
  id TEXT PRIMARY KEY DEFAULT 'default_party',
  party_name TEXT NOT NULL DEFAULT 'Halloween Birthday Party 2026',
  default_drink_limit INTEGER NOT NULL DEFAULT 5,
  is_party_active BOOLEAN NOT NULL DEFAULT true,
  admin_pin TEXT NOT NULL DEFAULT '1031',
  cutoff_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert initial settings row if not present
INSERT INTO party_settings (id, party_name, default_drink_limit, is_party_active, admin_pin)
VALUES ('default_party', 'Halloween Birthday Party 2026', 5, true, '1031')
ON CONFLICT (id) DO NOTHING;

-- 2. Create Guests Table
CREATE TABLE IF NOT EXISTS guests (
  id TEXT PRIMARY KEY,
  tag_id TEXT UNIQUE NOT NULL,
  name TEXT,
  category TEXT NOT NULL DEFAULT 'standard', -- 'standard', 'driver_minor', 'vip'
  custom_drink_limit INTEGER, -- NULL inherits party_settings.default_drink_limit
  drinks_consumed INTEGER NOT NULL DEFAULT 0,
  is_entered BOOLEAN NOT NULL DEFAULT false,
  entered_at TIMESTAMPTZ,
  is_blocked BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for high-speed NFC tag lookups on the barman's phone
CREATE INDEX IF NOT EXISTS idx_guests_tag_id ON guests(tag_id);
CREATE INDEX IF NOT EXISTS idx_guests_name ON guests(name);
CREATE INDEX IF NOT EXISTS idx_guests_is_entered ON guests(is_entered);

-- 3. Create Drink Logs Table
CREATE TABLE IF NOT EXISTS drink_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id TEXT NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  drink_type TEXT NOT NULL DEFAULT 'standard', -- 'beer', 'cocktail', 'shot', 'wine', 'soft'
  served_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  served_by TEXT NOT NULL DEFAULT 'barman',
  is_reverted BOOLEAN NOT NULL DEFAULT false,
  reverted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_drink_logs_guest_id ON drink_logs(guest_id);
CREATE INDEX IF NOT EXISTS idx_drink_logs_served_at ON drink_logs(served_at DESC);

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================
ALTER TABLE party_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE drink_logs ENABLE ROW LEVEL SECURITY;

-- Allow read & write access with anon key for frictionless party operation
CREATE POLICY "Allow public read on party_settings" ON party_settings FOR SELECT USING (true);
CREATE POLICY "Allow public update on party_settings" ON party_settings FOR UPDATE USING (true);

CREATE POLICY "Allow public read on guests" ON guests FOR SELECT USING (true);
CREATE POLICY "Allow public insert on guests" ON guests FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on guests" ON guests FOR UPDATE USING (true);

CREATE POLICY "Allow public read on drink_logs" ON drink_logs FOR SELECT USING (true);
CREATE POLICY "Allow public insert on drink_logs" ON drink_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on drink_logs" ON drink_logs FOR UPDATE USING (true);

-- ====================================================================
-- STORED PROCEDURES & ATOMIC TRANSACTION FUNCTIONS
-- ====================================================================

-- Function: Atomic Drink Serving with Strict Limit Validation
CREATE OR REPLACE FUNCTION serve_drink(
  p_tag_id TEXT,
  p_drink_type TEXT DEFAULT 'cocktail'
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_guest RECORD;
  v_default_limit INT;
  v_effective_limit INT;
  v_party_active BOOLEAN;
  v_log_id UUID;
BEGIN
  -- 1. Check party global status
  SELECT default_drink_limit, is_party_active 
  INTO v_default_limit, v_party_active 
  FROM party_settings 
  WHERE id = 'default_party';

  IF NOT FOUND THEN
    v_default_limit := 5;
    v_party_active := true;
  END IF;

  IF NOT v_party_active THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'PARTY_PAUSED',
      'message', 'The party bar service is currently paused.'
    );
  END IF;

  -- 2. Lock guest row for update to prevent race conditions during rapid taps
  SELECT * INTO v_guest
  FROM guests
  WHERE tag_id = p_tag_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'GUEST_NOT_FOUND',
      'message', 'Wristband tag is not registered.'
    );
  END IF;

  -- 3. Check blocked status
  IF v_guest.is_blocked THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'GUEST_BLOCKED',
      'message', 'This wristband has been disabled by organizers.',
      'guest', to_jsonb(v_guest)
    );
  END IF;

  -- 4. Calculate effective limit
  IF v_guest.category = 'vip' THEN
    v_effective_limit := 999;
  ELSIF v_guest.category = 'driver_minor' THEN
    v_effective_limit := 0;
  ELSIF v_guest.custom_drink_limit IS NOT NULL THEN
    v_effective_limit := v_guest.custom_drink_limit;
  ELSE
    v_effective_limit := v_default_limit;
  END IF;

  -- If it's a soft drink, don't count towards alcohol limit
  IF p_drink_type = 'soft' THEN
    INSERT INTO drink_logs (guest_id, drink_type, served_at)
    VALUES (v_guest.id, 'soft', NOW())
    RETURNING id INTO v_log_id;

    RETURN jsonb_build_object(
      'success', true,
      'guest', to_jsonb(v_guest),
      'drink_type', 'soft',
      'drinks_consumed', v_guest.drinks_consumed,
      'effective_limit', v_effective_limit,
      'remaining', GREATEST(0, v_effective_limit - v_guest.drinks_consumed),
      'is_limit_reached', (v_guest.drinks_consumed >= v_effective_limit AND v_guest.category <> 'vip')
    );
  END IF;

  -- 5. Validate alcohol limit
  IF v_guest.drinks_consumed >= v_effective_limit AND v_guest.category <> 'vip' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'LIMIT_REACHED',
      'message', 'Drink limit reached. Do not serve alcohol.',
      'guest', to_jsonb(v_guest),
      'drinks_consumed', v_guest.drinks_consumed,
      'effective_limit', v_effective_limit,
      'remaining', 0
    );
  END IF;

  -- 6. Increment drink count
  UPDATE guests
  SET drinks_consumed = drinks_consumed + 1,
      updated_at = NOW()
  WHERE id = v_guest.id;

  -- 7. Log drink transaction
  INSERT INTO drink_logs (guest_id, drink_type, served_at)
  VALUES (v_guest.id, p_drink_type, NOW())
  RETURNING id INTO v_log_id;

  -- 8. Return updated guest and transaction status
  RETURN jsonb_build_object(
    'success', true,
    'log_id', v_log_id,
    'guest_id', v_guest.id,
    'name', COALESCE(v_guest.name, 'Guest ' || v_guest.id),
    'drinks_consumed', v_guest.drinks_consumed + 1,
    'effective_limit', v_effective_limit,
    'remaining', GREATEST(0, v_effective_limit - (v_guest.drinks_consumed + 1)),
    'is_final_drink', ((v_guest.drinks_consumed + 1) = v_effective_limit AND v_guest.category <> 'vip'),
    'is_limit_reached', ((v_guest.drinks_consumed + 1) >= v_effective_limit AND v_guest.category <> 'vip')
  );
END;
$$;

-- Function: Revert Last Drink (Quick Undo for accidental taps)
CREATE OR REPLACE FUNCTION revert_last_drink(p_guest_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_last_log RECORD;
  v_guest RECORD;
BEGIN
  -- Find the most recent active drink log for this guest
  SELECT * INTO v_last_log
  FROM drink_logs
  WHERE guest_id = p_guest_id AND is_reverted = false
  ORDER BY served_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'No active drink logs to revert.');
  END IF;

  -- Mark log as reverted
  UPDATE drink_logs
  SET is_reverted = true, reverted_at = NOW()
  WHERE id = v_last_log.id;

  -- Decrement guest counter if not soft drink
  IF v_last_log.drink_type <> 'soft' THEN
    UPDATE guests
    SET drinks_consumed = GREATEST(0, drinks_consumed - 1),
        updated_at = NOW()
    WHERE id = p_guest_id
    RETURNING * INTO v_guest;
  ELSE
    SELECT * INTO v_guest FROM guests WHERE id = p_guest_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'guest', to_jsonb(v_guest),
    'reverted_log_id', v_last_log.id
  );
END;
$$;

-- Helper Function: Seed 100 Wristband Slots
CREATE OR REPLACE FUNCTION seed_100_wristbands()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  FOR i IN 1..100 LOOP
    INSERT INTO guests (id, tag_id, name, is_entered, drinks_consumed)
    VALUES (
      'GUEST-' || LPAD(i::TEXT, 3, '0'),
      'TAG-' || LPAD(i::TEXT, 3, '0'),
      NULL,
      false,
      0
    )
    ON CONFLICT (id) DO NOTHING;
  END LOOP;
END;
$$;
