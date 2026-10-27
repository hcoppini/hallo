"""
 Ultra-Fast ACR122U NFC Bridge for Halloween Party Web App
Listens to native Windows SmartCard kernel events and broadcasts taps to the web browser via WebSocket.
"""

import sys
import time
import json
import asyncio
import threading

try:
    import websockets
except ImportError:
    print("[ERROR] websockets not found. Run: pip install websockets")
    sys.exit(1)

try:
    from smartcard.CardMonitoring import CardMonitor, CardObserver
except ImportError:
    print("[ERROR] pyscard not found. Run: pip install pyscard")
    sys.exit(1)

WS_PORT = 4567
connected_clients = set()
ws_loop = None

def parse_ndef_url(data_bytes):
    """Extracts tag slug like TAG-042 from NTAG block 4-7 if written."""
    try:
        import re
        text = bytes(data_bytes).decode('utf-8', errors='ignore')
        m = re.search(r'(TAG[-_]\d{1,3})', text, re.IGNORECASE)
        if m:
            return m.group(1).upper()
        m_num = re.search(r'/t/([A-Za-z0-9\-_]+)', text)
        if m_num:
            return m_num.group(1).upper()
    except Exception:
        pass
    return None

class NFCBridgeObserver(CardObserver):
    def update(self, observable, actions):
        added_cards, removed_cards = actions
        for card in added_cards:
            reader_name = str(card.reader)
            if "ACR122" not in reader_name and "PICC" not in reader_name:
                continue

            t0 = time.time()
            try:
                card.connection = card.createConnection()
                card.connection.connect()

                # APDU: Get Card UID (FF CA 00 00 00)
                data, sw1, sw2 = card.connection.transmit([0xFF, 0xCA, 0x00, 0x00, 0x00])
                if sw1 == 0x90 and sw2 == 0x00:
                    uid = "".join(f"{b:02X}" for b in data)
                    tag_id = uid

                    # Try reading block 4 for NDEF
                    try:
                        b4, s1, s2 = card.connection.transmit([0xFF, 0xB0, 0x00, 0x04, 0x10])
                        if s1 == 0x90 and s2 == 0x00:
                            parsed = parse_ndef_url(b4)
                            if parsed:
                                tag_id = parsed
                    except Exception:
                        pass

                    elapsed_ms = (time.time() - t0) * 1000
                    print(f" [TAP DETECTED in {elapsed_ms:.1f}ms] Tag: {tag_id} (UID: {uid})")

                    msg = json.dumps({
                        "type": "TAG_TAPPED",
                        "tagId": tag_id,
                        "hardwareUid": uid,
                        "timestamp": int(time.time() * 1000)
                    })

                    # Broadcast to connected browser tabs
                    if ws_loop and connected_clients:
                        for ws in list(connected_clients):
                            try:
                                asyncio.run_coroutine_threadsafe(ws.send(msg), ws_loop)
                            except Exception:
                                connected_clients.discard(ws)

                card.connection.disconnect()
            except Exception as e:
                print(f"[CARD ERROR] {e}")

async def ws_handler(websocket):
    connected_clients.add(websocket)
    print(f" Web browser connected to NFC Bridge! (active clients: {len(connected_clients)})")
    try:
        await websocket.wait_closed()
    finally:
        connected_clients.discard(websocket)
        print(f" Web browser disconnected (active clients: {len(connected_clients)})")

def start_ws_server():
    global ws_loop
    ws_loop = asyncio.new_event_loop()
    asyncio.set_event_loop(ws_loop)

    async def main():
        async with websockets.serve(ws_handler, "127.0.0.1", WS_PORT):
            await asyncio.Future()

    ws_loop.run_until_complete(main())

def main():
    print("=======================================================")
    print("   ACR122U NFC Hardware Bridge Active")
    print(f"   Listening on ws://127.0.0.1:{WS_PORT}")
    print("=======================================================")

    # 1. Start WebSocket server thread
    ws_thread = threading.Thread(target=start_ws_server, daemon=True)
    ws_thread.start()

    # 2. Attach CardMonitor
    monitor = CardMonitor()
    observer = NFCBridgeObserver()
    monitor.addObserver(observer)
    print("Ready! Tap any card or wristband to the ACR122U reader...")

    try:
        while True:
            time.sleep(1.0)
    except KeyboardInterrupt:
        monitor.deleteObserver(observer)
        print("Bridge stopped.")

if __name__ == "__main__":
    main()
