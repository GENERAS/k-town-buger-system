import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QrCodeImageProps {
  value: string;
  size?: number;
  label: string;
}

export function QrCodeImage({ value, size = 140, label }: QrCodeImageProps) {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, {
      width: size * 2,
      margin: 1,
      color: { dark: '#141413', light: '#FFFFFF' },
    })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch(() => {
        if (active) setDataUrl('');
      });
    return () => {
      active = false;
    };
  }, [value, size]);

  if (!dataUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        className="bg-stone-100 border border-stone-200 rounded-lg flex items-center justify-center text-xs text-stone-500"
      >
        Generating QR...
      </div>
    );
  }

  return (
    <img
      src={dataUrl}
      alt={`QR code for ${label}`}
      width={size}
      height={size}
      className="rounded-lg border border-stone-200 bg-white p-1"
    />
  );
}
