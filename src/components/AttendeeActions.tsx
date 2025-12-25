import { useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Download, Upload, FileText, UserPlus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';

interface AttendanceRecord {
  id: string;
  attendee_name: string;
  attendee_email: string;
  status: 'verified' | 'suspicious' | 'cleared';
  suspicious_reason: string | null;
  location_provided: boolean;
  recorded_at: string;
  device_fingerprint?: string;
  location_lat?: number | null;
  location_lng?: number | null;
}

interface AttendeeActionsProps {
  eventId: string;
  eventName: string;
  attendance: AttendanceRecord[];
  onImportComplete: () => void;
}

const AttendeeActions = ({
  eventId,
  eventName,
  attendance,
  onImportComplete,
}: AttendeeActionsProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [manualImportOpen, setManualImportOpen] = useState(false);
  const [emailsText, setEmailsText] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const exportToCsv = async () => {
    // Fetch full attendance records including fingerprint
    const { data } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('event_id', eventId)
      .order('recorded_at', { ascending: true });

    if (!data || data.length === 0) {
      toast({
        title: 'No data to export',
        description: 'There are no attendance records for this event',
        variant: 'destructive',
      });
      return;
    }

    const headers = [
      'Name',
      'Email',
      'Status',
      'Suspicious Reason',
      'Location Provided',
      'Location Lat',
      'Location Lng',
      'Device Fingerprint',
      'Recorded At',
    ];

    const rows = data.map((record) => [
      record.attendee_name,
      record.attendee_email,
      record.status,
      record.suspicious_reason || '',
      record.location_provided ? 'Yes' : 'No',
      record.location_lat?.toString() || '',
      record.location_lng?.toString() || '',
      record.device_fingerprint,
      new Date(record.recorded_at).toISOString(),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `${eventName.replace(/[^a-z0-9]/gi, '_')}_attendees.csv`
    );
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: 'Export complete',
      description: `Exported ${data.length} attendance records`,
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n').filter((line) => line.trim());

        if (lines.length < 2) {
          toast({
            title: 'Invalid file',
            description: 'CSV file must have a header row and at least one data row',
            variant: 'destructive',
          });
          return;
        }

        // Parse header
        const header = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, '').toLowerCase());
        const nameIndex = header.findIndex((h) => h.includes('name'));
        const emailIndex = header.findIndex((h) => h.includes('email'));

        if (nameIndex === -1 || emailIndex === -1) {
          toast({
            title: 'Invalid file format',
            description: 'CSV must contain Name and Email columns',
            variant: 'destructive',
          });
          return;
        }

        const statusIndex = header.findIndex((h) => h.includes('status'));
        const suspiciousReasonIndex = header.findIndex((h) => h.includes('suspicious'));
        const locationProvidedIndex = header.findIndex((h) => h.includes('location provided'));
        const fingerprintIndex = header.findIndex((h) => h.includes('fingerprint'));

        // Parse rows
        const records = [];
        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]);
          const name = values[nameIndex]?.trim();
          const email = values[emailIndex]?.trim().toLowerCase();

          if (!name || !email) continue;

          let status: 'verified' | 'suspicious' | 'cleared' = 'verified';
          if (statusIndex !== -1) {
            const statusValue = values[statusIndex]?.trim().toLowerCase();
            if (statusValue === 'suspicious') status = 'suspicious';
            else if (statusValue === 'cleared') status = 'cleared';
          }

          records.push({
            event_id: eventId,
            attendee_name: name,
            attendee_email: email,
            device_fingerprint: fingerprintIndex !== -1 && values[fingerprintIndex]
              ? values[fingerprintIndex].trim()
              : `import-${crypto.randomUUID()}`,
            status,
            suspicious_reason: suspiciousReasonIndex !== -1 ? values[suspiciousReasonIndex]?.trim() || null : null,
            location_provided:
              locationProvidedIndex !== -1
                ? values[locationProvidedIndex]?.trim().toLowerCase() === 'yes'
                : false,
          });
        }

        if (records.length === 0) {
          toast({
            title: 'No valid records',
            description: 'No valid attendance records found in the file',
            variant: 'destructive',
          });
          return;
        }

        const { error } = await supabase.from('attendance_records').insert(records);

        if (error) {
          console.error('Import error:', error);
          toast({
            title: 'Import failed',
            description: 'Some records may have failed to import',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Import complete',
            description: `Imported ${records.length} attendance records`,
          });
          onImportComplete();
        }
      } catch (error) {
        console.error('Parse error:', error);
        toast({
          title: 'Import failed',
          description: 'Failed to parse CSV file',
          variant: 'destructive',
        });
      }

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };

    reader.readAsText(file);
  };

  const handleManualImport = async () => {
    const lines = emailsText
      .split('\n')
      .map((line) => line.trim().toLowerCase())
      .filter((line) => line && line.includes('@'));

    if (lines.length === 0) {
      toast({
        title: 'No valid emails',
        description: 'Please enter at least one valid email address',
        variant: 'destructive',
      });
      return;
    }

    setIsImporting(true);

    const records = lines.map((email) => ({
      event_id: eventId,
      attendee_name: email.split('@')[0],
      attendee_email: email,
      device_fingerprint: `manual-${crypto.randomUUID()}`,
      status: 'verified' as const,
      location_provided: false,
    }));

    const { error } = await supabase.from('attendance_records').insert(records);

    setIsImporting(false);

    if (error) {
      console.error('Manual import error:', error);
      toast({
        title: 'Import failed',
        description: 'Some records may have failed to import',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Import complete',
        description: `Imported ${records.length} attendees`,
      });
      setManualImportOpen(false);
      setEmailsText('');
      onImportComplete();
    }
  };

  // Helper to parse CSV line handling quoted values
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  };

  return (
    <>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={exportToCsv} className="gap-2">
          <Download className="w-4 h-4" />
          Export CSV
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          className="hidden"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Upload className="w-4 h-4" />
              Import
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="gap-2">
              <FileText className="w-4 h-4" />
              CSV File
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setManualImportOpen(true)} className="gap-2">
              <UserPlus className="w-4 h-4" />
              Manual Entry
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={manualImportOpen} onOpenChange={setManualImportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manual Import</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter email addresses, one per line. The name will be extracted from the email.
            </p>
            <Textarea
              placeholder="john.doe@example.com&#10;jane.smith@example.com&#10;..."
              value={emailsText}
              onChange={(e) => setEmailsText(e.target.value)}
              rows={8}
              className="font-mono text-sm"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setManualImportOpen(false)}
              disabled={isImporting}
            >
              Cancel
            </Button>
            <Button onClick={handleManualImport} disabled={isImporting || !emailsText.trim()}>
              {isImporting ? 'Importing...' : 'Import'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AttendeeActions;
