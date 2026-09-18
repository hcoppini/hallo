/**
 * Web NFC API (NDEFReader) integration for Chrome on Android.
 * Handles reading serial numbers, NDEF records, and writing URL tags.
 */

// Web NFC type declarations
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

  async startScan(
    onTag: (tagId: string, urlData?: string) => void,
    onError?: (err: Error) => void
  ): Promise<boolean> {
    if (!isWebNfcSupported() || !window.NDEFReader) {
      onError?.(new Error('Web NFC is not supported on this browser/platform.'));
      return false;
    }

    try {
      this.reader = new window.NDEFReader();
      await this.reader.scan();
      this.isScanning = true;

      this.reader.onreading = (event: NDEFReadingEvent) => {
        let tagId = event.serialNumber ? event.serialNumber.replace(/:/g, '').toUpperCase() : '';
        let urlData: string | undefined;

        // Try reading NDEF records if available
        if (event.message?.records) {
          for (const record of event.message.records) {
            if (record.recordType === 'url' && record.data) {
              const decoder = new TextDecoder();
              urlData = decoder.decode(record.data);
              // If the URL contains tag ID, extract it
              const match = urlData.match(/[?&]id=([^&]+)/) || urlData.match(/\/t\/([^/?#]+)/);
              if (match && match[1]) {
                tagId = match[1].toUpperCase();
              }
            }
          }
        }

        if (tagId) {
          onTag(tagId, urlData);
        }
      };

      this.reader.onreadingerror = () => {
        onError?.(new Error('Failed to read NFC tag. Please hold tag closer.'));
      };

      return true;
    } catch (err) {
      this.isScanning = false;
      onError?.(err instanceof Error ? err : new Error(String(err)));
      return false;
    }
  }

  async writeUrl(url: string): Promise<boolean> {
    if (!isWebNfcSupported() || !window.NDEFReader) {
      throw new Error('Web NFC writing is not supported on this browser.');
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
