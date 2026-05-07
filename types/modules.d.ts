// Type stubs for packages installed at build time
declare module 'expo-clipboard' {
  export function setStringAsync(text: string): Promise<void>;
  export function getStringAsync(): Promise<string>;
}

declare module 'expo-sharing' {
  export function isAvailableAsync(): Promise<boolean>;
  export function shareAsync(url: string, options?: { dialogTitle?: string; mimeType?: string }): Promise<void>;
}

declare module 'expo-sensors' {
  export const Accelerometer: {
    setUpdateInterval(ms: number): void;
    addListener(callback: (data: { x: number; y: number; z: number }) => void): { remove(): void };
  };
}

declare module 'react-native-image-colors' {
  export type ImageColorsResult =
    | { platform: 'ios'; primary?: string; secondary?: string; background?: string; detail?: string }
    | { platform: 'android'; vibrant?: string; dominant?: string; darkVibrant?: string; lightVibrant?: string; darkMuted?: string; lightMuted?: string; muted?: string };

  export const ImageColors: {
    getColors(
      uri: string,
      config?: { fallback?: string; cache?: boolean; key?: string }
    ): Promise<ImageColorsResult>;
  };
}

declare module 'react-native-qrcode-svg' {
  import { ComponentType } from 'react';
  interface QRCodeProps {
    value: string;
    size?: number;
    color?: string;
    backgroundColor?: string;
    logo?: any;
    logoSize?: number;
    logoBackgroundColor?: string;
    logoMargin?: number;
    logoBorderRadius?: number;
    quietZone?: number;
    enableLinearGradient?: boolean;
    gradientDirection?: string[];
    linearGradient?: string[];
    ecl?: 'L' | 'M' | 'Q' | 'H';
    getRef?: (ref: any) => void;
    onError?: (error: Error) => void;
  }
  const QRCode: ComponentType<QRCodeProps>;
  export default QRCode;
}
