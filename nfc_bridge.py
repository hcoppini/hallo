"""
ACR122U -> Bar Station bridge.

Uses pyscard CardMonitor for robust, event-driven NFC tap detection.
Reads written NDEF tag content (e.g. https://.../t/69 -> Tag #69) and chip UID,
pushing it to the browser over local WebSocket (ws://127.0.0.1:4567).
"""

import asyncio
import json
import os
import sys
import threading
import time
import uuid

import websockets
from smartcard.CardMonitoring import CardMonitor, CardObserver
from smartcard.System import readers as get_readers
from smartcard.util import toHexString

WS_HOST = "127.0.0.1"
WS_PORT = 4567
DEBOUNCE_SECONDS = 0.8  # quick debounce between identical taps
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
    if not msg:
        return None
    header = msg[0]
    type_len = msg[1]
    sr = bool(header & 0x10)
    il = bool(header & 0x08)
    if sr:
        payload_len = msg[2]
        idx = 3
    else:
        payload_len = int.from_bytes(msg[2:6], "big")
        idx = 6
    if il:
        id_len = msg[idx]
        idx += 1 + id_len
    type_bytes = msg[idx : idx + type_len]
    idx += type_len
    payload = msg[idx : idx + payload_len]

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


# ----------------------------------------------------------------------------
# WebSocket side
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
        visible.sort(key=lambda c: (c["page"].startswith("/barman"), c["focusTs"]), reverse=True)
        return visible[0]["id"]

    def sockets(self):
        with self.lock:
            return list(self.info.keys())


clients = Clients()
ws_loop: asyncio.AbstractEventLoop | None = None
active_reader = {"name": None}
emitter_lock = threading.Lock()
last_tap = {"uid": None, "time": 0.0}


def broadcast(payload: dict) -> None:
    if not ws_loop:
        return
    msg = json.dumps(payload)
    for ws in clients.sockets():
        asyncio.run_coroutine_threadsafe(_safe_send(ws, msg), ws_loop)


async def _safe_send(ws, msg):
    try:
        await ws.send(msg)
    except Exception:
        pass


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
    log(f"TAP tag={tag_id} hw={hardware_uid} ({source}) read={read_ms:.0f}ms -> handler={handler} clients={len(clients.sockets())}")
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


def run_ws_server():
    global ws_loop
    ws_loop = asyncio.new_event_loop()
    asyncio.set_event_loop(ws_loop)

    async def main():
        async with websockets.serve(ws_handler, WS_HOST, WS_PORT):
            await asyncio.Future()

    ws_loop.run_until_complete(main())


# ----------------------------------------------------------------------------
# CardMonitor Reader Observer
# ----------------------------------------------------------------------------
class BarStationObserver(CardObserver):
    def update(self, observable, actions):
        addedcards, removedcards = actions
        for card in addedcards:
            reader_name = str(card.reader)
            if "ACR122" not in reader_name and "PICC" not in reader_name:
                continue
            t0 = time.time()
            deadline = time.time() + 0.6
            conn = None
            while time.time() < deadline:
                try:
                    conn = card.createConnection()
                    conn.connect()
                    break
                except Exception:
                    conn = None
                    time.sleep(0.015)
            if not conn:
                log(f"card tap detected on {reader_name} but connect failed")
                continue

            uid = None
            ndef = None
            try:
                # 1. Hardware UID (Get Data APDU)
                resp, sw1, sw2 = conn.transmit([0xFF, 0xCA, 0x00, 0x00, 0x00])
                if sw1 == 0x90 and sw2 == 0x00:
                    uid = toHexString(resp).replace(" ", "")

                # 2. Read NDEF (pages 4, 8, 12)
                raw = bytearray()
                for page in (4, 8, 12):
                    r, s1, s2 = conn.transmit([0xFF, 0xB0, 0x00, page, 0x10])
                    if s1 == 0x90 and s2 == 0x00:
                        raw.extend(r)
                    else:
                        break
                ndef = parse_ndef(raw)
            finally:
                try:
                    conn.disconnect()
                except Exception:
                    pass

            read_ms = (time.time() - t0) * 1000
            effective_tag = ndef or uid
            if effective_tag:
                emit_tap(effective_tag, uid or effective_tag, "reader", t0, read_ms, ndef)
            else:
                log(f"empty card read on {reader_name} in {read_ms:.0f}ms")

        for card in removedcards:
            reader_name = str(card.reader)
            if "ACR122" in reader_name or "PICC" in reader_name:
                log(f"card lifted from {reader_name}")


def main():
    log("=" * 50)
    log(f"ACR122U CardMonitor bridge starting, ws://{WS_HOST}:{WS_PORT}")

    # Check reader at startup
    try:
        r_list = get_readers()
        acr = [r for r in r_list if "ACR122" in str(r) or "PICC" in str(r)]
        active_reader["name"] = str(acr[0]) if acr else (str(r_list[0]) if r_list else None)
        log(f"reader: {active_reader['name'] or 'NOT CONNECTED'}")
    except Exception as e:
        log(f"reader check error: {e}")

    # Start WebSocket server
    threading.Thread(target=run_ws_server, daemon=True).start()

    # Start CardMonitor
    card_monitor = CardMonitor()
    observer = BarStationObserver()
    card_monitor.addObserver(observer)
    log("CardMonitor active and listening for wristband taps...")

    try:
        while True:
            time.sleep(3600)
    except KeyboardInterrupt:
        card_monitor.deleteObserver(observer)
        log("bridge stopped")


if __name__ == "__main__":
    if sys.stdout and hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    main()
