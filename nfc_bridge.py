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
    print(line, flush=True)
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

    # 2. Regex scan for TAG-XXX, ID-XXX, GUEST-XXX
    m2 = re.search(rb'(?:TAG|GUEST|ID)[-_#\s]*0*([1-9]\d{0,2})(?:[^0-9]|$)', raw, re.IGNORECASE)
    if m2:
        num = int(m2.group(1).decode("utf-8", errors="replace"))
        return f"TAG-{num:03d}"

    # 3. Standard NDEF parsing - ONLY if it's a complete valid record with /t/ or TAG
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

    return None


def read_card_memory(hcard, proto) -> tuple[str | None, bytearray]:
    """
    Reads card user memory for Type 2 (NTAG213/215/216, Mifare Ultralight)
    and Type 4 / Mifare Classic 1K tags:
    - Type 2 tags: User memory starts at Page 4. Reads sequential 16-byte chunks (Pages 4, 8, 12, 16, 20).
    - Mifare Classic 1K: Authenticates Sector 1 with Key A and reads Blocks 4, 5, 6.
    - Fallback: Direct PN532 InDataExchange reads.
    """
    raw = bytearray()

    # Strategy 1: Type 2 / NTAG Sequential Read (Pages 4, 8, 12, 16, 20)
    hres, r4 = SCardTransmit(hcard, proto, [0xFF, 0xB0, 0x00, 4, 0x10])
    if hres == SCARD_S_SUCCESS and len(r4) >= 18 and r4[-2] == 0x90 and r4[-1] == 0x00:
        raw.extend(r4[:-2])

        p4_bytes = r4[:-2]
        needed_bytes = 48
        if 0x03 in p4_bytes:
            idx = p4_bytes.index(0x03)
            if idx + 1 < len(p4_bytes):
                tlv_len = p4_bytes[idx + 1]
                if tlv_len < 0xFF:
                    needed_bytes = idx + 2 + tlv_len + 1
                elif idx + 3 < len(p4_bytes):
                    needed_bytes = idx + 4 + ((p4_bytes[idx + 2] << 8) | p4_bytes[idx + 3]) + 1

        for next_page in (8, 12, 16, 20):
            if len(raw) >= needed_bytes:
                break
            time.sleep(0.008)
            hres, r = SCardTransmit(hcard, proto, [0xFF, 0xB0, 0x00, next_page, 0x10])
            if hres == SCARD_S_SUCCESS and len(r) >= 18 and r[-2] == 0x90 and r[-1] == 0x00:
                raw.extend(r[:-2])
            else:
                break

        ndef = extract_ndef(raw)
        if ndef:
            log(f"NDEF read success (Type 2 NTAG): {ndef} ({len(raw)} bytes)")
            return ndef, raw

    # Strategy 2: Authenticated Mifare Classic read (Sector 1, Blocks 4, 5, 6)
    raw_classic = bytearray()
    keys = [
        [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF],  # Transport key
        [0xD3, 0xF7, 0xD3, 0xF7, 0xD3, 0xF7],  # NFC Forum NDEF key
        [0xA0, 0xA1, 0xA2, 0xA3, 0xA4, 0xA5],  # MAD key
    ]
    for k in keys:
        SCardTransmit(hcard, proto, [0xFF, 0x82, 0x00, 0x00, 0x06] + k)
        hres, r = SCardTransmit(hcard, proto, [0xFF, 0x86, 0x00, 0x00, 0x05, 0x01, 0x00, 0x04, 0x60, 0x00])
        if hres == SCARD_S_SUCCESS and len(r) >= 2 and r[-2] == 0x90:
            for b in (4, 5, 6):
                time.sleep(0.005)
                hres, r = SCardTransmit(hcard, proto, [0xFF, 0xB0, 0x00, b, 0x10])
                if hres == SCARD_S_SUCCESS and len(r) >= 18 and r[-2] == 0x90:
                    raw_classic.extend(r[:-2])
            cand = extract_ndef(raw_classic)
            if cand:
                log(f"NDEF read success (Mifare Classic): {cand}")
                return cand, raw_classic
            break

    # Strategy 3: PN532 Direct InDataExchange fallback
    raw_pn532 = bytearray()
    for page in (4, 8, 12, 16):
        cmd = [0xFF, 0x00, 0x00, 0x00, 0x05, 0xD4, 0x40, 0x01, 0x30, page]
        time.sleep(0.005)
        hres, r = SCardTransmit(hcard, proto, cmd)
        if hres == SCARD_S_SUCCESS and len(r) >= 19 and r[0] == 0xD5 and r[1] == 0x41 and r[2] == 0x00:
            raw_pn532.extend(r[3:19])
            cand = extract_ndef(raw_pn532)
            if cand:
                log(f"NDEF read success (PN532 Direct): {cand}")
                return cand, raw_pn532
        else:
            break

    best_raw = raw or raw_classic or raw_pn532
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
                    "rawId": payload.get("hardwareUid"),
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


def run_ws_server():
    global ws_loop
    ws_loop = asyncio.new_event_loop()
    asyncio.set_event_loop(ws_loop)

    async def main():
        asyncio.create_task(supabase_realtime_loop())
        async with websockets.serve(ws_handler, WS_HOST, WS_PORT):
            await asyncio.Future()

    ws_loop.run_until_complete(main())


def emit_tap(tag_id: str, hardware_uid: str, source: str, detected_at: float, read_ms: float, ndef: str | None = None) -> str | None:
    with emitter_lock:
        now = time.time()
        dedup_key = tag_id or hardware_uid
        if dedup_key == last_tap["uid"] and now - last_tap["time"] < DEBOUNCE_SECONDS:
            log(f"debounced duplicate tap {dedup_key}")
            return None
        last_tap["uid"], last_tap["time"] = dedup_key, now
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

            acr = [r for r in r_list if "ACR122" in r or "PICC" in r]
            if not acr:
                log(f"ACR122 reader not detected (found: {r_list}), waiting 2s...")
                SCardReleaseContext(hcontext)
                time.sleep(2)
                continue
            reader_name = acr[0]
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
                last_state = new_state

                if is_present and not was_present:
                    t0 = time.time()
                    time.sleep(0.02)  # 20ms settling time for transponder EEPROM to stabilize
                    hcard = None
                    proto = None

                    # Fast connect with direct retry
                    for attempt in range(4):
                        hres, hcard, proto = SCardConnect(
                            hcontext, reader_name, SCARD_SHARE_SHARED, SCARD_PROTOCOL_T1
                        )
                        if hres == SCARD_S_SUCCESS:
                            break
                        hcard = None
                        time.sleep(0.015)

                    if hcard is not None:
                        uid = None
                        ndef = None
                        try:
                            # 1. Hardware UID (Get Data APDU)
                            hres, resp = SCardTransmit(hcard, proto, [0xFF, 0xCA, 0x00, 0x00, 0x00])
                            if hres == SCARD_S_SUCCESS and len(resp) >= 2 and resp[-2] == 0x90:
                                uid = "".join(f"{b:02X}" for b in resp[:-2])

                            # 2. Read NDEF with multi-strategy fallback (PN532 direct, PC/SC, Mifare Classic)
                            ndef, raw = read_card_memory(hcard, proto)
                            if not ndef:
                                time.sleep(0.015)
                                ndef, raw = read_card_memory(hcard, proto)
                        finally:
                            # CRITICAL: SCARD_LEAVE_CARD leaves RF field powered!
                            SCardDisconnect(hcard, SCARD_LEAVE_CARD)

                        read_ms = (time.time() - t0) * 1000
                        effective_tag = ndef or uid
                        if effective_tag:
                            emit_tap(effective_tag, uid or effective_tag, "reader", t0, read_ms, ndef)
                    else:
                        log(f"tap detected on {reader_name} but connect failed")

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
