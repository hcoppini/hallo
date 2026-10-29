"""
Ultra-Fast ACR122U NFC Hardware Bridge.

Direct native Windows PC/SC kernel event loop for instantaneous (<15ms) card detection.
Maintains continuous RF field (SCARD_LEAVE_CARD) so subsequent taps are detected instantly.
Reads NDEF URI/Text payload (e.g. https://.../t/69 -> Tag #69) and chip UID.
Broadcasts taps via local WebSocket (ws://127.0.0.1:4567) and Supabase Cloud Realtime.
"""

import asyncio
import json
import os
import re
import sys
import threading
import time
import uuid

import websockets
from smartcard.scard import (
    SCardEstablishContext,
    SCardReleaseContext,
    SCardListReaders,
    SCardConnect,
    SCardDisconnect,
    SCardTransmit,
    SCardGetStatusChange,
    SCARD_SCOPE_USER,
    SCARD_SHARE_SHARED,
    SCARD_PROTOCOL_T0,
    SCARD_PROTOCOL_T1,
    SCARD_LEAVE_CARD,
    SCARD_STATE_UNAWARE,
    SCARD_STATE_PRESENT,
    SCARD_STATE_EMPTY,
    SCARD_STATE_CHANGED,
    SCARD_S_SUCCESS,
    SCARD_E_TIMEOUT,
)

WS_HOST = "127.0.0.1"
WS_PORT = 4567
SUPABASE_WS_URL = (
    "wss://awhegcdhdbamraikvvmy.supabase.co/realtime/v1/websocket"
    "?apikey=sb_publishable_39K-_qrXWri8iWBg4nzuBQ_GCcUxT4q&vsn=1.0.0"
)
DEBOUNCE_SECONDS = 0.4
LOG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "nfc_bridge.log")

URI_PREFIXES = {
    0x00: "",
    0x01: "http://www.",
    0x02: "https://www.",
    0x03: "http://",
    0x04: "https://",
    0x05: "tel:",
    0x06: "mailto:",
}


def log(msg: str) -> None:
    line = f"{time.strftime('%H:%M:%S')}.{int(time.time() * 1000) % 1000:03d} {msg}"
    if sys.stdout:
        try:
            print(line, flush=True)
        except Exception:
            pass
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except OSError:
        pass


def parse_ndef_message(msg: bytes) -> str | None:
    if not msg or len(msg) < 3:
        return None
    header = msg[0]
    type_len = msg[1]
    sr = bool(header & 0x10)
    il = bool(header & 0x08)
    if sr:
        payload_len = msg[2]
        idx = 3
    else:
        if len(msg) < 6:
            return None
        payload_len = int.from_bytes(msg[2:6], "big")
        idx = 6
    if il:
        if len(msg) < idx + 1:
            return None
        id_len = msg[idx]
        idx += 1 + id_len

    type_bytes = msg[idx : min(len(msg), idx + type_len)]
    idx += type_len
    payload_end = min(len(msg), idx + payload_len)
    payload = msg[idx:payload_end]

    tnf = header & 0x07
    if tnf == 0x01:
        if type_bytes == b"U" and len(payload) > 1:
            prefix = URI_PREFIXES.get(payload[0], "")
            return prefix + payload[1:].decode("utf-8", errors="replace")
        elif type_bytes == b"T" and len(payload) > 1:
            lang_len = payload[0] & 0x3F
            return payload[1 + lang_len :].decode("utf-8", errors="replace")
    text = payload.decode("utf-8", errors="replace").strip()
    return text or None


def parse_ndef(raw: bytes) -> str | None:
    i = 0
    while i < len(raw):
        b = raw[i]
        if b == 0x00:
            i += 1
            continue
        if b == 0xFE:
            break
        if b == 0x03:
            if i + 1 >= len(raw):
                break
            length = raw[i + 1]
            if length == 0xFF:
                if i + 3 >= len(raw):
                    break
                length = (raw[i + 2] << 8) | raw[i + 3]
                msg = raw[i + 4 : i + 4 + length]
            else:
                msg = raw[i + 2 : i + 2 + length]
            return parse_ndef_message(msg)
        else:
            if i + 1 >= len(raw):
                break
            length = raw[i + 1]
            i += 2 + length
    return None


def parse_tag_slug(slug: str) -> str:
    s = slug.strip()
    if s.isdigit():
        num = int(s)
        if 1 <= num <= 999:
            return f"TAG-{num:03d}"
    m = re.match(r'^(?:TAG|GUEST|ID)[-_#\s]*0*([1-9]\d{0,2})$', s, re.IGNORECASE)
    if m:
        return f"TAG-{int(m.group(1)):03d}"
    return s


def extract_ndef(raw: bytes) -> str | None:
    if not raw:
        return None

    # 1. Regex scan for /t/<slug> - highest priority and 100% accurate for wristband set IDs
    m = re.search(rb'/t/([a-zA-Z0-9_\-]+)', raw)
    if m:
        slug = m.group(1).decode("utf-8", errors="replace").strip()
        if slug and slug.lower() not in ("http", "https"):
            return parse_tag_slug(slug)

    # 1b. Regex scan for /(?:tag|wristband|pass|guest)/<slug>
    m_path = re.search(rb'/(?:tag|wristband|pass|guest)/([a-zA-Z0-9_\-]+)', raw, re.IGNORECASE)
    if m_path:
        slug = m_path.group(1).decode("utf-8", errors="replace").strip()
        if slug and slug.lower() not in ("http", "https"):
            return parse_tag_slug(slug)

    # 1c. Regex scan for ?tag=<slug> or &tag=<slug>
    m_url = re.search(rb'[?&](?:tag|id)=([a-zA-Z0-9_\-]+)', raw)
    if m_url:
        slug = m_url.group(1).decode("utf-8", errors="replace").strip()
        if slug:
            return parse_tag_slug(slug)

    # 2. Regex scan for TAG-XXX, ID-XXX, GUEST-XXX
    m2 = re.search(rb'(?:TAG|GUEST|ID)[-_#\s]*0*([1-9]\d{0,2})(?:[^0-9]|$)', raw, re.IGNORECASE)
    if m2:
        num = int(m2.group(1).decode("utf-8", errors="replace"))
        return f"TAG-{num:03d}"

    # 3. Regex scan for pure number at end of URL path: /<num>
    m3_num = re.search(rb'/0*([1-9]\d{0,2})(?:[/?#\x00\xfe]|$)', raw)
    if m3_num:
        num = int(m3_num.group(1).decode("utf-8", errors="replace"))
        return f"TAG-{num:03d}"

    # 4. Standard NDEF parser
    parsed = parse_ndef(raw)
    if parsed:
        clean = parsed.strip("\x00\r\n\t ")
        m3 = re.search(r'/t/([a-zA-Z0-9_\-]+)', clean)
        if m3:
            slug = m3.group(1).strip()
            if slug and slug.lower() not in ("http", "https"):
                return parse_tag_slug(slug)
        m4 = re.search(r'(?:TAG|GUEST|ID)[-_#\s]*0*([1-9]\d{0,2})(?:[^0-9]|$)', clean, re.IGNORECASE)
        if m4:
            return f"TAG-{int(m4.group(1)):03d}"
        if clean.isdigit():
            num = int(clean)
            if 1 <= num <= 999:
                return f"TAG-{num:03d}"
        m5 = re.search(r'/(?:tag|wristband|pass|guest)/([a-zA-Z0-9_\-]+)', clean, re.IGNORECASE)
        if m5:
            slug = m5.group(1).strip()
            if slug and slug.lower() not in ("http", "https"):
                return parse_tag_slug(slug)
        m6 = re.search(r'/0*([1-9]\d{0,2})(?:[/?#]|$)', clean)
        if m6:
            num = int(m6.group(1))
            return f"TAG-{num:03d}"
        if clean:
            return clean

    return None


def read_card_memory(hcard, proto) -> tuple[str | None, bytearray]:
    """
    Reads card user memory for Type 2 (NTAG213/215/216, Mifare Ultralight)
    and Mifare Classic 1K tags using a resilient non-overlapping multi-tier strategy:
    1. Type 2 fast 16-byte reads on pages 4, 8, 12, 16, 20, 24, 28, 32, 36 (non-overlapping!)
    2. Type 2 universal single-page 4-byte reads (pages 4 to 39)
    3. Direct PN532 InDataExchange 0x30 read (pages 4, 8, 12, 16, 20, 24)
    4. Authenticated Mifare Classic 1K read (Sector 1 Blocks 4, 5, 6)
    """
    # Strategy 1: Non-overlapping 16-byte chunk reads for Type 2 / NTAG
    raw_16 = bytearray()
    for page in (4, 8, 12, 16, 20, 24, 28, 32, 36):
        hres, r = SCardTransmit(hcard, proto, [0xFF, 0xB0, 0x00, page, 0x10])
        if hres == SCARD_S_SUCCESS and len(r) >= 18 and r[-2] == 0x90:
            raw_16.extend(r[:-2])
            cand = extract_ndef(raw_16)
            if cand:
                log(f"NDEF read success (Type 2 16B Page {page}): {cand} ({len(raw_16)} bytes)")
                return cand, raw_16
        else:
            break
        time.sleep(0.003)

    if raw_16:
        cand = extract_ndef(raw_16)
        if cand:
            return cand, raw_16

    # Strategy 2: Universal 4-byte single-page reads for Type 2 / NTAG
    raw_4b = bytearray()
    for page in range(4, 40):
        hres, r = SCardTransmit(hcard, proto, [0xFF, 0xB0, 0x00, page, 0x04])
        if hres == SCARD_S_SUCCESS and len(r) >= 6 and r[-2] == 0x90:
            raw_4b.extend(r[:-2])
            cand = extract_ndef(raw_4b)
            if cand:
                log(f"NDEF read success (Type 2 4B Page {page}): {cand} ({len(raw_4b)} bytes)")
                return cand, raw_4b
        else:
            break
        time.sleep(0.003)

    if raw_4b:
        cand = extract_ndef(raw_4b)
        if cand:
            return cand, raw_4b

    # Strategy 3: Native PN532 Direct InDataExchange 0x30 read
    raw_pn532 = bytearray()
    for page in (4, 8, 12, 16, 20, 24, 28, 32):
        cmd = [0xFF, 0x00, 0x00, 0x00, 0x05, 0xD4, 0x40, 0x01, 0x30, page]
        hres, r = SCardTransmit(hcard, proto, cmd)
        if hres == SCARD_S_SUCCESS and len(r) >= 19 and r[0] == 0xD5 and r[1] == 0x41 and r[2] == 0x00:
            raw_pn532.extend(r[3:19])
            cand = extract_ndef(raw_pn532)
            if cand:
                log(f"NDEF read success (PN532 Direct Page {page}): {cand} ({len(raw_pn532)} bytes)")
                return cand, raw_pn532
        else:
            break
        time.sleep(0.003)

    if raw_pn532:
        cand = extract_ndef(raw_pn532)
        if cand:
            return cand, raw_pn532

    # Strategy 4: Authenticated Mifare Classic fallback with Key A
    raw_classic = bytearray()
    keys = [
        [0xD3, 0xF7, 0xD3, 0xF7, 0xD3, 0xF7],  # NFC Forum key
        [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF],  # Transport key
        [0xA0, 0xA1, 0xA2, 0xA3, 0xA4, 0xA5],  # MAD key
    ]
    for k in keys:
        SCardTransmit(hcard, proto, [0xFF, 0x82, 0x00, 0x00, 0x06] + k)
        hres, r = SCardTransmit(hcard, proto, [0xFF, 0x86, 0x00, 0x00, 0x05, 0x01, 0x00, 0x04, 0x60, 0x00])
        if hres == SCARD_S_SUCCESS and len(r) >= 2 and r[-2] == 0x90:
            for b in (4, 5, 6):
                time.sleep(0.003)
                hres, r = SCardTransmit(hcard, proto, [0xFF, 0xB0, 0x00, b, 0x10])
                if hres == SCARD_S_SUCCESS and len(r) >= 18 and r[-2] == 0x90:
                    raw_classic.extend(r[:-2])
            cand = extract_ndef(raw_classic)
            if cand:
                log(f"NDEF read success (Mifare Classic Auth): {cand}")
                return cand, raw_classic
            break

    best_raw = raw_16 or raw_4b or raw_pn532 or raw_classic
    if best_raw:
        log(f"NDEF unreadable: raw_len={len(best_raw)} hex={best_raw[:32].hex()}")
    return None, best_raw


# ----------------------------------------------------------------------------
# WebSocket Clients
# ----------------------------------------------------------------------------
class Clients:
    def __init__(self):
        self.lock = threading.Lock()
        self.info = {}

    def add(self, ws):
        cid = uuid.uuid4().hex[:8]
        with self.lock:
            self.info[ws] = {"id": cid, "page": "?", "visible": True, "focusTs": 0}
        return cid

    def remove(self, ws):
        with self.lock:
            self.info.pop(ws, None)

    def update(self, ws, data):
        with self.lock:
            if ws in self.info:
                c = self.info[ws]
                c["page"] = data.get("page", c["page"])
                c["visible"] = bool(data.get("visible", c["visible"]))
                if data.get("focused"):
                    c["focusTs"] = time.time()

    def pick_handler(self):
        with self.lock:
            if not self.info:
                return None
            items = list(self.info.values())
        visible = [c for c in items if c["visible"]] or items
        visible.sort(key=lambda c: (c["page"].startswith("/barman") or c["page"].startswith("/door"), c["focusTs"]), reverse=True)
        return visible[0]["id"]

    def sockets(self):
        with self.lock:
            return list(self.info.keys())


clients = Clients()
ws_loop: asyncio.AbstractEventLoop | None = None
supabase_ws = None
active_reader = {"name": None}
emitter_lock = threading.Lock()
last_tap = {"uid": None, "time": 0.0}

CACHE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "nfc_cache.json")

def load_card_cache() -> dict[str, str]:
    # Default pre-seed mapping for known stickers
    cache: dict[str, str] = {
        "53B88CFF130001": "TAG-069",
    }
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    cache.update(data)
        except Exception as e:
            log(f"warning loading {CACHE_FILE}: {e}")
    return cache

def save_card_cache(cache: dict[str, str]) -> None:
    try:
        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(cache, f, indent=2)
    except Exception as e:
        log(f"warning saving {CACHE_FILE}: {e}")

card_uid_cache = load_card_cache()


def broadcast(payload: dict) -> None:
    if not ws_loop:
        return
    msg = json.dumps(payload)
    for ws in clients.sockets():
        asyncio.run_coroutine_threadsafe(_safe_send(ws, msg), ws_loop)

    if payload.get("type") == "TAG_TAPPED" and supabase_ws:
        sb_payload = json.dumps({
            "topic": "realtime:party_nfc_relay",
            "event": "broadcast",
            "payload": {
                "type": "broadcast",
                "event": "nfc_tap_relay",
                "payload": {
                    "type": "TAG_TAPPED",
                    "tabId": "acr122u_bridge",
                    "timestamp": payload.get("detectedAt", int(time.time() * 1000)),
                    "tagId": payload.get("tagId"),
                    "rawId": payload.get("hardwareUid") or payload.get("tagId"),
                    "hardwareUid": payload.get("hardwareUid") or payload.get("tagId"),
                }
            },
            "ref": uuid.uuid4().hex[:6]
        })
        asyncio.run_coroutine_threadsafe(_safe_send(supabase_ws, sb_payload), ws_loop)


async def _safe_send(ws, msg):
    if not ws:
        return
    try:
        await ws.send(msg)
    except Exception:
        pass


async def supabase_realtime_loop():
    global supabase_ws
    while True:
        try:
            async with websockets.connect(SUPABASE_WS_URL) as ws:
                supabase_ws = ws
                log("connected to Supabase Realtime cloud relay")
                await ws.send(json.dumps({
                    "topic": "realtime:party_nfc_relay",
                    "event": "phx_join",
                    "payload": {"config": {"broadcast": {"ack": False, "self": False}, "presence": {"key": ""}}},
                    "ref": "1"
                }))
                ref_num = 2
                while True:
                    await asyncio.sleep(25)
                    ref_num += 1
                    await ws.send(json.dumps({
                        "topic": "phoenix",
                        "event": "heartbeat",
                        "payload": {},
                        "ref": str(ref_num)
                    }))
        except Exception as e:
            supabase_ws = None
            log(f"Supabase Realtime disconnected ({e}), reconnecting in 3s...")
            await asyncio.sleep(3)


def kill_competing_bridges():
    """Ensure no duplicate nfc_bridge.py or process is holding port 4567."""
    my_pid = os.getpid()
    if sys.platform == "win32":
        try:
            import subprocess
            out = subprocess.check_output('netstat -aon | findstr ":4567" | findstr "LISTENING"', shell=True, text=True, stderr=subprocess.DEVNULL)
            for line in out.strip().splitlines():
                parts = line.split()
                if parts:
                    pid = int(parts[-1])
                    if pid != my_pid and pid > 0:
                        log(f"Terminating old competing bridge process on port 4567 (PID {pid})...")
                        subprocess.run(f"taskkill /F /PID {pid}", shell=True, capture_output=True)
                        time.sleep(0.3)
        except Exception:
            pass

        try:
            import subprocess
            ps_cmd = (
                f'powershell -NoProfile -Command "'
                f'Get-CimInstance Win32_Process -Filter \\"Name LIKE \'python%\'\\" | '
                f'Where-Object {{ $_.ProcessId -ne {my_pid} -and $_.CommandLine -like \'*nfc_bridge*\' }} | '
                f'ForEach-Object {{ Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }}"'
            )
            subprocess.run(ps_cmd, shell=True, capture_output=True)
            time.sleep(0.3)
        except Exception:
            pass


def run_ws_server():
    global ws_loop
    ws_loop = asyncio.new_event_loop()
    asyncio.set_event_loop(ws_loop)

    async def main_ws():
        asyncio.create_task(supabase_realtime_loop())
        try:
            async with websockets.serve(ws_handler, WS_HOST, WS_PORT):
                await asyncio.Future()
        except OSError as e:
            log(f"FATAL: Port {WS_PORT} already in use or unavailable ({e}). Exiting to prevent conflict.")
            os._exit(1)

    try:
        ws_loop.run_until_complete(main_ws())
    except Exception as e:
        log(f"FATAL in WebSocket server: {e}")
        os._exit(1)


def emit_tap(tag_id: str, hardware_uid: str, source: str, detected_at: float, read_ms: float, ndef: str | None = None) -> str | None:
    with emitter_lock:
        now = time.time()
        # Always deduplicate by physical chip hardware UID so the same card never double-triggers
        card_key = hardware_uid or tag_id
        if card_key and card_key == last_tap["uid"] and now - last_tap["time"] < DEBOUNCE_SECONDS:
            log(f"debounced duplicate tap for card {card_key}")
            return None
        last_tap["uid"], last_tap["time"] = card_key, now
    tap_id = uuid.uuid4().hex[:12]
    handler = clients.pick_handler()
    broadcast(
        {
            "type": "TAG_TAPPED",
            "tapId": tap_id,
            "tagId": tag_id,
            "uid": tag_id,
            "ndef": ndef,
            "hardwareUid": hardware_uid,
            "handlerId": handler,
            "source": source,
            "detectedAt": int(detected_at * 1000),
            "readMs": round(read_ms, 1),
        }
    )
    log(f"⚡ INSTANT TAP tag={tag_id} hw={hardware_uid} ({source}) read={read_ms:.1f}ms -> handler={handler} clients={len(clients.sockets())}")
    return tap_id


async def ws_handler(ws):
    cid = clients.add(ws)
    log(f"browser connected id={cid} (total {len(clients.sockets())})")
    try:
        await ws.send(json.dumps({"type": "BRIDGE_HELLO", "clientId": cid, "reader": active_reader["name"]}))
        async for raw in ws:
            try:
                data = json.loads(raw)
            except ValueError:
                continue
            kind = data.get("type")
            if kind == "CLIENT_STATE":
                clients.update(ws, data)
            elif kind == "SIMULATE_TAP" and data.get("uid"):
                val = str(data["uid"])
                emit_tap(val, val, "simulated", time.time(), 0.0)
    except Exception:
        pass
    finally:
        clients.remove(ws)
        log(f"browser disconnected id={cid} (total {len(clients.sockets())})")


# ----------------------------------------------------------------------------
# Ultra-Fast Native PC/SC Interrupt-Driven Loop
# ----------------------------------------------------------------------------
def run_card_loop():
    while True:
        try:
            hresult, hcontext = SCardEstablishContext(SCARD_SCOPE_USER)
            if hresult != SCARD_S_SUCCESS:
                time.sleep(1)
                continue

            hresult, r_list = SCardListReaders(hcontext, [])
            if hresult != SCARD_S_SUCCESS or not r_list:
                SCardReleaseContext(hcontext)
                time.sleep(1)
                continue

            acr = [r for r in r_list if ("ACR122" in r or "PICC" in r or "ACS" in r) and "IFD" not in r]
            if acr:
                reader_name = acr[0]
            elif sys.platform == "darwin" and len(r_list) == 1:
                reader_name = r_list[0]
                log(f"Using only available smartcard reader on macOS: {reader_name}")
            else:
                log(f"ACR122 reader not detected (found: {r_list}), waiting 2s...")
                SCardReleaseContext(hcontext)
                time.sleep(2)
                continue
            active_reader["name"] = reader_name
            log(f"Ultra-fast kernel listener attached to: {reader_name}")

            hresult, states = SCardGetStatusChange(hcontext, 0, [(reader_name, SCARD_STATE_UNAWARE)])
            last_state = states[0][1] if hresult == SCARD_S_SUCCESS and states else SCARD_STATE_UNAWARE

            while True:
                # Kernel wait: wakes up within 0.1ms of physical card tap
                hresult, states = SCardGetStatusChange(hcontext, 150, [(reader_name, last_state)])
                if hresult == SCARD_E_TIMEOUT:
                    # On timeout, NOTHING CHANGED! Do NOT modify last_state!
                    continue

                if hresult != SCARD_S_SUCCESS:
                    # Reader removed or reset
                    break

                if not states:
                    continue

                new_state = states[0][1]
                was_present = bool(last_state & SCARD_STATE_PRESENT)
                is_present = bool(new_state & SCARD_STATE_PRESENT)
                last_state = new_state & ~SCARD_STATE_CHANGED

                if is_present and not was_present:
                    t0 = time.time()
                    time.sleep(0.035)  # 35ms settling time for transponder EEPROM to stabilize
                    hcard = None
                    proto = None
                    last_hres = None

                    # Fast connect with direct retry
                    for attempt in range(8):
                        hres, hcard, proto = SCardConnect(
                            hcontext, reader_name, SCARD_SHARE_SHARED, SCARD_PROTOCOL_T0 | SCARD_PROTOCOL_T1
                        )
                        last_hres = hres
                        if hres == SCARD_S_SUCCESS:
                            break
                        hcard = None
                        time.sleep(0.02)

                    if hcard is not None:
                        uid = None
                        ndef = None
                        try:
                            # 1. Hardware UID (Get Data APDU)
                            hres, resp = SCardTransmit(hcard, proto, [0xFF, 0xCA, 0x00, 0x00, 0x00])
                            if hres == SCARD_S_SUCCESS and len(resp) >= 2 and resp[-2] == 0x90:
                                uid = "".join(f"{b:02X}" for b in resp[:-2])

                            # Early debounce check: ignore card bounce within DEBOUNCE_SECONDS
                            if uid and uid == last_tap["uid"] and (time.time() - last_tap["time"]) < DEBOUNCE_SECONDS:
                                log(f"ignoring RF bounce for card {uid}")
                                continue

                            # 2. Check persistent cache: if this chip UID is already known, resolve it instantly!
                            if uid and uid in card_uid_cache:
                                ndef = card_uid_cache[uid]
                                log(f"instant resolve from cache for chip {uid} -> {ndef}")

                            # 3. Read NDEF with multi-strategy fallback (Type 2, Mifare Classic)
                            raw = bytearray()
                            if not ndef:
                                for read_attempt in range(4):
                                    ndef, raw = read_card_memory(hcard, proto)
                                    if ndef:
                                        break
                                    time.sleep(0.02)

                            # If NDEF was resolved or read, update persistent cache
                            if uid and ndef:
                                if card_uid_cache.get(uid) != ndef:
                                    card_uid_cache[uid] = ndef
                                    save_card_cache(card_uid_cache)
                        finally:
                            # CRITICAL: SCARD_LEAVE_CARD leaves RF field powered!
                            SCardDisconnect(hcard, SCARD_LEAVE_CARD)

                        read_ms = (time.time() - t0) * 1000
                        if ndef:
                            emit_tap(ndef, uid or ndef, "reader", t0, read_ms, ndef)
                        else:
                            log(f"Ignored card {uid}: no valid NDEF payload detected (raw={len(raw)}B). Strictly reading solely NDEF.")
                    else:
                        log(f"tap detected on {reader_name} but connect failed (hres={hex(last_hres & 0xFFFFFFFF) if last_hres is not None else 'None'})")

                elif not is_present and was_present:
                    # Card lifted: clear debounce immediately so immediate re-tap is instant
                    with emitter_lock:
                        last_tap["uid"] = None
                    log(f"card lifted from {reader_name}")

            SCardReleaseContext(hcontext)
        except Exception as e:
            log(f"Reader loop error: {e}")
            time.sleep(1)


def main():
    log("=" * 50)
    log(f"Ultra-Fast ACR122U bridge starting on ws://{WS_HOST}:{WS_PORT}")

    # Ensure no old orphaned processes are holding the port
    kill_competing_bridges()

    # Start WebSocket server
    threading.Thread(target=run_ws_server, daemon=True).start()

    # Start Ultra-Fast PC/SC Kernel Loop
    card_thread = threading.Thread(target=run_card_loop, daemon=True)
    card_thread.start()
    log("Instant NFC tap listener is active and running!")

    try:
        while True:
            time.sleep(3600)
    except KeyboardInterrupt:
        log("bridge stopped")


if __name__ == "__main__":
    if sys.stdout and hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    main()
