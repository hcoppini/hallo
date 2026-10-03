/**
 * Web NFC API (NDEFReader) integration for Chrome on Android.
 * Handles reading serial numbers, NDEF records (URL and text),
 * programming physical stickers, and keeping the screen awake via WakeLock.
 */

declare global {
  interface Window {
    NDEFReader?: {
      new (): NDEFReaderInstance;
    };
  }
}

export interface NDEFReaderInstance {
  scan: () => Promise<void>;
  write: (message: NDEFMessageInit) => Promise<void>;
  onreading: ((event: NDEFReadingEvent) => void) | null;
  onreadingerror: ((event: Event) => void) | null;
}

export interface NDEFReadingEvent extends Event {
  serialNumber: string;
  message: {
    records: Array<{
      recordType: string;
      mediaType?: string;
      data?: DataView;
      encoding?: string;
    }>;
  };
}

export interface NDEFMessageInit {
  records: Array<{
    recordType: 'url' | 'text';
    data: string;
  }>;
}

export function isWebNfcSupported(): boolean {
  return typeof window !== 'undefined' && 'NDEFReader' in window;
}

export class NfcController {
  private reader: NDEFReaderInstance | null = null;
  private isScanning: boolean = false;
  private wakeLock: WakeLockSentinel | null = null;

  /**
   * Acquire a screen wake lock so the phone stays awake during active scanning.
   */
  async requestWakeLock(): Promise<boolean> {
    if (typeof window === 'undefined' || !('wakeLock' in navigator) || !navigator.wakeLock) {
      return false;
    }
    try {
      this.wakeLock = await navigator.wakeLock.request('screen');
      this.wakeLock.addEventListener('release', () => {
        this.wakeLock = null;
      });
      return true;
    } catch {
      return false;
    }
  }

  async releaseWakeLock(): Promise<void> {
    if (this.wakeLock) {
      try {
        await this.wakeLock.release();
      } catch {
        // ignore
      }
      this.wakeLock = null;
    }
  }

  async startScan(
    onTag: (tagId: string, hardwareUid?: string, recordPayload?: string) => void,
    onError?: (err: Error) => void
  ): Promise<boolean> {
    if (!isWebNfcSupported() || !window.NDEFReader) {
      onError?.(new Error('Web NFC is not supported on this browser/platform. Requires Chrome on Android.'));
      return false;
    }

    try {
      // Keep screen awake while scanning
      await this.requestWakeLock();

      this.reader = new window.NDEFReader();
      await this.reader.scan();
      this.isScanning = true;

      this.reader.onreading = (event: NDEFReadingEvent) => {
        const hardwareUid = event.serialNumber
          ? event.serialNumber.replace(/:/g, '').toUpperCase()
          : undefined;

        let detectedTagId = hardwareUid || '';
        let payloadString: string | undefined;

        // Try reading NDEF records (both URL and Text)
        if (event.message?.records && event.message.records.length > 0) {
          for (const record of event.message.records) {
            if (record.data) {
              const decoder = new TextDecoder(record.encoding || 'utf-8');
              const textContent = decoder.decode(record.data);
              payloadString = textContent;

              // Extract tag id if record is URL
              const urlMatch =
                textContent.match(/\/t\/([^/?#]+)/i) ||
                textContent.match(/[?&](?:tag|id)=([^&]+)/i);

              if (urlMatch && urlMatch[1]) {
                detectedTagId = urlMatch[1].toUpperCase();
                break;
              }

              // Extract tag id if record is plain text (e.g. "TAG-005" or "5")
              const textMatch = textContent.match(/(?:TAG|GUEST)?[-_#\s]*0*([1-9]\d{0,2})/i);
              if (textMatch && textMatch[1]) {
                const num = parseInt(textMatch[1], 10);
                detectedTagId = `TAG-${num.toString().padStart(3, '0')}`;
                break;
              }
            }
          }
        }

        if (detectedTagId || hardwareUid) {
          onTag(detectedTagId || hardwareUid || '', hardwareUid, payloadString);
        }
      };

      this.reader.onreadingerror = () => {
        onError?.(new Error('Tag read error. Hold the wristband firmly against the phone.'));
      };

      return true;
    } catch (err) {
      this.isScanning = false;
      this.releaseWakeLock();
      onError?.(err instanceof Error ? err : new Error(String(err)));
      return false;
    }
  }

  /**
   * Writes a URL record directly to a physical NFC sticker
   */
  async writeUrl(url: string): Promise<boolean> {
    if (!isWebNfcSupported() || !window.NDEFReader) {
      throw new Error('Web NFC writing is not supported on this device. Chrome on Android is required.');
    }

    const writer = new window.NDEFReader();
    await writer.write({
      records: [{ recordType: 'url', data: url }],
    });
    return true;
  }

  getScanningState(): boolean {
    return this.isScanning;
  }
}

export const nfcController = new NfcController();
