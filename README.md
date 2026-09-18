# 🎃 Halloween NFC Drink Regulation & Guest Management System

> Built with Next.js, Supabase, Web NFC API, and the luxurious monochrome aesthetic of [luaws.pl](https://luaws.pl). Designed for a 100-guest birthday party on October 29th.

---

## ⚡ Key Highlights

- **Single-Device or Multi-Device Operation**: The entire party can run smoothly on just **one phone** (the barman’s phone), which can instantly toggle between **Barman Station**, **Door Check-in**, and **Admin Panel**.
- **Instant Multi-Sensory Feedback**: High-contrast visual alerts, Web Audio synthesis (zero audio lag), and haptic vibrations:
  - 🟢 **APPROVED**: Guest name, current drinks (`3 / 5`), drinks remaining (`2 left`), celebratory sound.
  - 🟡 **WARNING**: Final drink warning badge (`5 / 5`).
  - 🔴 **CUT OFF / LIMIT REACHED**: High-contrast flashing crimson screen with warning buzzer: **"DO NOT SERVE ALCOHOL"**.
- **Offline-First Resilience**: Parties in cellars or backyards often suffer from spotty Wi-Fi. The system includes automatic dual-layer persistence: Supabase Postgres + local reactive storage fallback.
- **Accidental Tap Protection**: 10-second quick undo window for the barman.
- **Universal NFC Compatibility**:
  - **Android Chrome**: Direct native Web NFC (`NDEFReader`) with in-app background scanning.
  - **iPhone (iOS Safari)**: Native NFC background tag scanning directs to universal `/t/[tag_id]` handler.
  - **Manual Fallback**: 2-tap fast search by guest name or badge number (#042) if a bracelet is damaged or wet.
  - **Interactive Testing Simulator**: Built right into the screen so you can test and demonstrate the entire system right now before the physical stickers arrive!

---

## 🚀 Quick Start (Local Development)

```bash
# 1. Enter the project folder
cd C:\Users\heito\.gemini\antigravity\scratch\halloween-party-nfc

# 2. Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) on your phone or desktop.

### Run Automated Test Suite
```bash
npm test
```
*Runs all 21 unit and integration tests for drink limits, VIP rules, drivers/minors, PIN security, and undo logic.*

---

## 🏷️ When Your NFC Stickers Arrive: 3-Minute Batch Setup

1. Open the app on an Android phone in Chrome and navigate to the **Admin Panel** (`/admin`).
2. Click **"NFC Batch Writer"**.
3. It will display `TAG-001` and its target URL (`https://your-domain.vercel.app/t/TAG-001`).
4. Hold your first NFC sticker to the back of your phone — it writes the tag in **under 1 second**, plays a confirmation chime, and automatically advances to `TAG-002`!
5. Repeat for all 100 stickers, insert them into the party bracelets, and you're ready for party night!

---

## 🚪 Party Night Workflow

### 1. Front Door Reception (`/door`)
- Guest arrives at the party.
- Greeter holds a wristband to the phone (or picks the next numbered band).
- Types the guest's name (e.g. *Kasia*).
- Selects their category:
  - **Standard 18+**: Gets the default drink limit (e.g. 5 drinks).
  - **Driver / Minor**: Hard-locked to **0 alcohol** (soft drinks only).
  - **VIP / Host**: Unlimited drinks.
- Tap **"Admit Guest & Link Wristband"**: The guest is officially registered with an entry timestamp (`entered_at`).

### 2. Barman Station (`/barman`)
- Barman props his phone up on the bar counter (or adds to home screen as a fullscreen PWA).
- Guest walks up and taps their bracelet to the phone.
- The barman screen instantly displays their name, drink count, and remaining drinks.
- Drink count increments by +1.
- If the guest reaches their limit, the screen turns **RED**, buzzes with a warning siren, and blocks any further alcoholic drink entries.
- Soft drinks (water, soda) can always be logged without counting against alcohol limits.

### 3. Parents / Admin Panel (`/admin`)
- Accessible with the 4-digit security PIN (default: `1031`).
- Parents can adjust the global drink limit anytime during the party (e.g. adjust from 5 to 4 or 6).
- Search and inspect all 100 guests, view who had how many drinks, and see who is cut off.
- One-click emergency **"Pause Bar Service"** toggle.
- Export complete party data to **CSV** for memories or statistics.

---

## ☁️ Deploying to Vercel & Supabase (Production)

### 1. Supabase Database Setup
1. Create a free project at [supabase.com](https://supabase.com).
2. Go to the **SQL Editor** in the Supabase dashboard.
3. Paste the contents of `supabase/schema.sql` from this repository and click **Run**.
   - This creates `party_settings`, `guests`, `drink_logs`, Row Level Security policies, atomic transaction functions, and pre-seeds 100 wristbands.
4. In Supabase Project Settings -> API, copy your `Project URL` and `anon public key`.

### 2. Vercel Deployment
1. Push this project to GitHub or deploy via the Vercel CLI:
   ```bash
   npx vercel
   ```
2. In your Vercel Project Settings -> Environment Variables, add:
   - `NEXT_PUBLIC_SUPABASE_URL` = *your Supabase URL*
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = *your Supabase Anon Key*
3. Redeploy. Your app is live with HTTPS (required by Web NFC)!

*(Note: Even if you don't connect Supabase right away, the app runs 100% with local offline storage!)*

---

## 🎨 Design Philosophy (`luaws.pl` Aesthetic)

This system embodies the cinematic minimalism of [luaws.pl](https://luaws.pl):
- **Typography**: Editorial serif (*Cormorant Garamond*) for headlines paired with crisp geometric sans (*Plus Jakarta Sans*) for high-signal data.
- **Color Palette**: Pure monochrome `#000000` / `#FFFFFF` with glassmorphism blur effects and subtle 100px grid coordinates.
- **High Signal**: Zero visual fluff — designed for rapid recognition in dim party lighting and noisy environments.
