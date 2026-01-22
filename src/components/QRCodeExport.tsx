import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Download } from 'lucide-react';
import { format } from 'date-fns';
import { QRCodeCanvas } from 'qrcode.react';

interface QRCodeExportProps {
  url: string;
  eventName: string;
  eventDate: string;
  brandLogoUrl?: string | null;
  label?: string;
  mode?: 'display' | 'labeled';
  size?: number;
  includeMargin?: boolean;
}

const QRCodeExport = ({
  url,
  eventName,
  eventDate,
  brandLogoUrl,
  label = 'Download QR',
  mode = 'labeled',
  size,
  includeMargin = true,
}: QRCodeExportProps) => {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [logoStatus, setLogoStatus] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle');

  const qrSize = useMemo(() => (size ?? (mode === 'display' ? 280 : 300)), [mode, size]);
  const resolvedLogoUrl = logoDataUrl ?? brandLogoUrl ?? null;
  const imageSettings = useMemo(() => {
    if (!resolvedLogoUrl) return undefined;
    const logoSize = Math.round(qrSize * 0.2);
    return {
      src: resolvedLogoUrl,
      height: logoSize,
      width: logoSize,
      excavate: true,
      crossOrigin: 'anonymous',
    };
  }, [resolvedLogoUrl, qrSize]);

  useEffect(() => {
    if (!brandLogoUrl) {
      setLogoDataUrl(null);
      setLogoStatus('idle');
      return;
    }

    if (brandLogoUrl.startsWith('data:')) {
      setLogoDataUrl(brandLogoUrl);
      setLogoStatus('ready');
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    setLogoStatus('loading');

    fetch(brandLogoUrl, { signal: controller.signal, mode: 'cors' })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to fetch logo');
        }
        return response.blob();
      })
      .then(
        (blob) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error('Failed to read logo'));
            reader.readAsDataURL(blob);
          })
      )
      .then((dataUrl) => {
        if (cancelled) return;
        setLogoDataUrl(dataUrl);
        setLogoStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setLogoDataUrl(null);
        setLogoStatus('failed');
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [brandLogoUrl]);

  const downloadQRCode = useCallback(async () => {
    try {
      if (brandLogoUrl && logoStatus === 'loading') {
        toast({
          title: 'Logo loading',
          description: 'Please try again once the logo is ready.',
        });
        return;
      }

      const qrCanvas = canvasRef.current;
      if (!qrCanvas) {
        toast({
          title: 'Error',
          description: 'QR code is not ready yet.',
          variant: 'destructive',
        });
        return;
      }

      if (mode === 'display') {
        if (!qrCanvas) {
          toast({
            title: 'Error',
            description: 'QR code is not ready yet.',
            variant: 'destructive',
          });
          return;
        }

        try {
          const jpgUrl = qrCanvas.toDataURL('image/jpeg', 0.95);
          const link = document.createElement('a');
          link.download = `${eventName.replace(/[^a-z0-9]/gi, '_')}_QR.jpg`;
          link.href = jpgUrl;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          toast({
            title: 'Downloaded',
            description: 'QR code saved',
          });
        } catch (error) {
          console.error('QR export error:', error);
          toast({
            title: 'Error',
            description: 'Failed to generate QR code',
            variant: 'destructive',
          });
        }
        return;
      }

      // Create canvas to combine label and QR code
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        toast({
          title: 'Error',
          description: 'Could not create canvas',
          variant: 'destructive',
        });
        return;
      }

      const qrSize = 300;
      const padding = 40;
      const labelHeight = 70;
      const totalWidth = qrSize + padding * 2;
      const totalHeight = qrSize + padding + labelHeight;

      canvas.width = totalWidth;
      canvas.height = totalHeight;

      // White background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, totalWidth, totalHeight);

      // Draw event title
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 18px Arial, sans-serif';
      ctx.textAlign = 'center';

      // Truncate title if too long
      let displayTitle = eventName;
      while (ctx.measureText(displayTitle).width > totalWidth - 40 && displayTitle.length > 0) {
        displayTitle = displayTitle.slice(0, -1);
      }
      if (displayTitle !== eventName) {
        displayTitle = displayTitle.slice(0, -3) + '...';
      }

      ctx.fillText(displayTitle, totalWidth / 2, 30);

      // Draw event date
      ctx.font = '14px Arial, sans-serif';
      ctx.fillStyle = '#666666';
      const formattedDate = format(new Date(eventDate), 'PPP');
      ctx.fillText(formattedDate, totalWidth / 2, 52);

      ctx.drawImage(qrCanvas, padding, labelHeight, qrSize, qrSize);

      try {
        const jpgUrl = canvas.toDataURL('image/jpeg', 0.95);
        const link = document.createElement('a');
        link.download = `${eventName.replace(/[^a-z0-9]/gi, '_')}_QR.jpg`;
        link.href = jpgUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast({
          title: 'Downloaded',
          description: 'QR code saved with event label',
        });
      } catch (error) {
        console.error('QR export error:', error);
        toast({
          title: 'Error',
          description: 'Failed to generate QR code',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('QR export error:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate QR code',
        variant: 'destructive',
      });
    }
  }, [brandLogoUrl, logoStatus, eventName, eventDate, toast, mode, qrSize]);

  return (
    <>
      <Button variant="outline" size="sm" onClick={downloadQRCode} className="gap-2">
        <Download className="w-4 h-4" />
        {label}
      </Button>
      <QRCodeCanvas
        ref={canvasRef}
        value={url}
        size={qrSize}
        level="M"
        includeMargin={includeMargin}
        imageSettings={imageSettings}
        className="absolute -left-[9999px] -top-[9999px] opacity-0 pointer-events-none"
      />
    </>
  );
};

export default QRCodeExport;
