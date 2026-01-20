import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Download } from 'lucide-react';
import { format } from 'date-fns';
import QRCode from 'qrcode';

interface QRCodeExportProps {
  url: string;
  eventName: string;
  eventDate: string;
  brandLogoUrl?: string | null;
  label?: string;
}

const QRCodeExport = ({ url, eventName, eventDate, brandLogoUrl, label = 'Download QR' }: QRCodeExportProps) => {
  const { toast } = useToast();

  const downloadQRCode = useCallback(async () => {
    try {
      // Generate QR code as data URL
      const qrDataUrl = await QRCode.toDataURL(url, {
        width: 300,
        margin: 2,
        errorCorrectionLevel: 'M',
      });

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

      // Load and draw QR code
      const qrImage = new Image();
      qrImage.onload = () => {
        ctx.drawImage(qrImage, padding, labelHeight, qrSize, qrSize);
        let finished = false;

        const finalizeDownload = () => {
          if (finished) return;
          finished = true;
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
        };

        if (!brandLogoUrl) {
          finalizeDownload();
          return;
        }

        const logoImage = new Image();
        logoImage.crossOrigin = 'anonymous';
        logoImage.onload = () => {
          const logoSize = Math.round(qrSize * 0.22);
          const logoX = padding + (qrSize - logoSize) / 2;
          const logoY = labelHeight + (qrSize - logoSize) / 2;
          const logoPadding = Math.max(4, Math.round(logoSize * 0.12));
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(
            logoX - logoPadding,
            logoY - logoPadding,
            logoSize + logoPadding * 2,
            logoSize + logoPadding * 2
          );
          ctx.drawImage(logoImage, logoX, logoY, logoSize, logoSize);
          finalizeDownload();
        };
        logoImage.onerror = () => {
          finalizeDownload();
        };
        logoImage.src = brandLogoUrl;
      };

      qrImage.onerror = () => {
        toast({
          title: 'Error',
          description: 'Failed to generate QR code image',
          variant: 'destructive',
        });
      };

      qrImage.src = qrDataUrl;
    } catch (error) {
      console.error('QR export error:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate QR code',
        variant: 'destructive',
      });
    }
  }, [url, eventName, eventDate, brandLogoUrl, toast]);

  return (
    <Button variant="outline" size="sm" onClick={downloadQRCode} className="gap-2">
      <Download className="w-4 h-4" />
      {label}
    </Button>
  );
};

export default QRCodeExport;
