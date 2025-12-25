import { useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Download } from 'lucide-react';
import { format } from 'date-fns';

interface QRCodeExportProps {
  url: string;
  eventName: string;
  eventDate: string;
}

const QRCodeExport = ({ url, eventName, eventDate }: QRCodeExportProps) => {
  const { toast } = useToast();
  const qrContainerRef = useRef<HTMLDivElement>(null);

  const downloadQRCode = useCallback(() => {
    // Create a canvas to draw the QR code with label
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const qrSize = 300;
    const padding = 40;
    const labelHeight = 80;
    const totalWidth = qrSize + padding * 2;
    const totalHeight = qrSize + padding * 2 + labelHeight;

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
    
    ctx.fillText(displayTitle, totalWidth / 2, padding);

    // Draw event date
    ctx.font = '14px Arial, sans-serif';
    ctx.fillStyle = '#666666';
    const formattedDate = format(new Date(eventDate), 'PPP');
    ctx.fillText(formattedDate, totalWidth / 2, padding + 24);

    // Get QR code SVG and convert to image
    const svg = qrContainerRef.current?.querySelector('svg');
    if (!svg) {
      toast({
        title: 'Error',
        description: 'Could not find QR code',
        variant: 'destructive',
      });
      return;
    }

    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      // Draw QR code below the label
      ctx.drawImage(img, padding, labelHeight, qrSize, qrSize);

      // Convert to JPG and download
      const jpgUrl = canvas.toDataURL('image/jpeg', 0.95);
      const link = document.createElement('a');
      link.download = `${eventName.replace(/[^a-z0-9]/gi, '_')}_QR.jpg`;
      link.href = jpgUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(svgUrl);

      toast({
        title: 'Downloaded',
        description: 'QR code saved with event label',
      });
    };
    img.src = svgUrl;
  }, [eventName, eventDate, toast]);

  return (
    <div>
      <div ref={qrContainerRef} className="hidden">
        <QRCodeSVG value={url} size={300} level="M" />
      </div>
      <Button variant="outline" size="sm" onClick={downloadQRCode} className="gap-2">
        <Download className="w-4 h-4" />
        Download QR
      </Button>
    </div>
  );
};

export default QRCodeExport;
