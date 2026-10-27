import QRCode from 'qrcode';

export interface QROptions {
  width?: number;
  margin?: number;
  color?: {
    dark?: string;
    light?: string;
  };
}

/**
 * Generates an SVG string representation of a QR code.
 */
export async function generateQrSvg(text: string, options: QROptions = {}): Promise<string> {
  try {
    return await QRCode.toString(text, {
      type: 'svg',
      width: options.width || 200,
      margin: options.margin ?? 1,
      color: {
        dark: options.color?.dark || '#000000',
        light: options.color?.light || '#ffffff',
      },
    });
  } catch (err) {
    console.error('Failed to generate QR SVG:', err);
    return '';
  }
}

/**
 * Generates a Data URL (base64 PNG) representation of a QR code.
 */
export async function generateQrDataUrl(text: string, options: QROptions = {}): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      width: options.width || 220,
      margin: options.margin ?? 1,
      color: {
        dark: options.color?.dark || '#000000',
        light: options.color?.light || '#ffffff',
      },
    });
  } catch (err) {
    console.error('Failed to generate QR Data URL:', err);
    return '';
  }
}
