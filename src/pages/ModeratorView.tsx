import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/hooks/useConfirm';
import { QRCodeSVG } from 'qrcode.react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { usePageTitle } from '@/hooks/usePageTitle';
import { 
  ArrowLeft, QrCode, Users, MapPin, Calendar, 
  AlertTriangle, CheckCircle, Shield, Trash2, RefreshCw, Eye, EyeOff, UserPlus, Copy, Radio, Search, UserMinus
} from 'lucide-react';
import { format } from 'date-fns';

interface Event {
  id: string;
  name: string;
  description: string | null;
  event_date: string;
  location_name: string;
  location_lat: number;
  location_lng: number;
  location_radius_meters: number;
  is_active: boolean;
  current_qr_token: string | null;
  rotating_qr_enabled: boolean;
  rotating_qr_interval_seconds?: number | null;
  moderation_enabled: boolean;
  moderator_show_full_name: boolean;
  moderator_show_email: boolean;
  brand_logo_url?: string | null;
}

interface AttendanceRecord {
  id: string;
  attendee_name: string;
  attendee_email: string | null;
  status: 'verified' | 'suspicious' | 'cleared' | 'excused';
  suspicious_reason: string | null;
  location_provided: boolean;
  location_lat: number | null;
  location_lng: number | null;
  recorded_at: string;
}

interface KnownAttendee {
  attendee_name: string;
  attendee_email: string | null;
}

const POLL_INTERVAL_MS = 1100;

// Helper to mask last name
const maskName = (fullName: string): string => {
  const parts = fullName.trim().split(' ');
  if (parts.length <= 1) return fullName;
  const firstName = parts[0];
  const maskedLast = parts.slice(1).map(p => p[0] + '•'.repeat(Math.max(0, p.length - 1))).join(' ');
  return `${firstName} ${maskedLast}`;
};

// Helper to mask email
const maskEmail = (email: string): string => {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const maskedLocal = local[0] + '•'.repeat(Math.max(0, local.length - 1));
  return `${maskedLocal}@${domain}`;
};

const ModeratorView = () => {
  const { eventId, token } = useParams<{ eventId: string; token: string }>();
  const { toast } = useToast();
  const confirm = useConfirm();

  const [event, setEvent] = useState<Event | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [unauthorizedMessage, setUnauthorizedMessage] = useState<string | null>(null);
  const [qrToken, setQrToken] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState(3);
  const pollIntervalRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const liveUpdatesRef = useRef(true);

  // Privacy controls
  const [showAllDetails, setShowAllDetails] = useState(false);
  const [revealedNames, setRevealedNames] = useState<Set<string>>(new Set());
  const [revealedEmails, setRevealedEmails] = useState<Set<string>>(new Set());

  // Manual add attendee
  const [showAddForm, setShowAddForm] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualExcused, setManualExcused] = useState(false);
  const [suggestions, setSuggestions] = useState<KnownAttendee[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [liveUpdatesEnabled, setLiveUpdatesEnabled] = useState(true);

  // Search and filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'suspicious'>('all');

  const pageTitle = event?.name ? `${event.name} - Moderator View` : 'Moderator View - Attendly';
  usePageTitle(pageTitle);

  const parseFunctionError = async (error: unknown): Promise<{ reason?: string; status?: number }> => {
    if (!error || typeof error !== 'object') return {};
    const maybeError = error as { context?: Response; status?: number };
    const status = maybeError.status ?? maybeError.context?.status;

    if (!maybeError.context) {
      return { status };
    }

    try {
      const body = await maybeError.context.clone().json();
      return { reason: body?.reason, status };
    } catch {
      return { status };
    }
  };

  const resolveUnauthorizedMessage = (reason?: string | null): string => {
    switch (reason) {
      case 'link_expired':
        return 'This moderation link has expired.';
      case 'link_inactive':
        return 'This moderation link has been deactivated.';
      case 'moderation_disabled':
        return 'Moderation is disabled for this event.';
      case 'missing_migrations':
        return 'Moderation is not fully configured. Ask the admin to run the latest database migrations.';
      case 'function_not_found':
        return 'Moderation service is not deployed. Ask the admin to deploy Edge Functions.';
      case 'server_error':
      case 'link_error':
      case 'event_error':
        return 'Unable to validate this moderation link right now. Please try again.';
      case 'missing_params':
      case 'link_not_found':
      case 'event_missing':
      default:
        return 'This moderation link is invalid or has been deactivated.';
    }
  };

  const fetchModeratorState = useCallback(
    async (opts?: { includeAttendance?: boolean }) => {
      if (!eventId || !token) {
        setAuthorized(false);
        setEvent(null);
        setAttendance([]);
        setLoading(false);
        setUnauthorizedMessage(resolveUnauthorizedMessage('missing_params'));
        return;
      }

      const includeAttendance = opts?.includeAttendance ?? true;

      const { data, error } = await supabase.functions.invoke('moderator-state', {
        body: { eventId, token, includeAttendance },
      });

      if (error) {
        const parsed = await parseFunctionError(error);
        const reason = parsed.reason ?? (parsed.status === 404 ? 'function_not_found' : null);
        console.error('moderator-state invoke error', error);
        setAuthorized(false);
        setEvent(null);
        setAttendance([]);
        setLoading(false);
        setUnauthorizedMessage(
          reason ? resolveUnauthorizedMessage(reason) : 'Unable to reach moderation service. Please refresh and try again.'
        );
        return;
      }

      if (!data?.authorized) {
        setAuthorized(false);
        setEvent(null);
        setAttendance([]);
        setLoading(false);
        setUnauthorizedMessage(resolveUnauthorizedMessage(data?.reason ?? null));
        return;
      }

      const nextEvent = data.event as Event;
      setAuthorized(true);
      setEvent(nextEvent);
      setUnauthorizedMessage(null);

      if (includeAttendance && Array.isArray(data.attendance)) {
        setAttendance(data.attendance as AttendanceRecord[]);
      }

      setLoading(false);
    },
    [eventId, token]
  );

  useEffect(() => {
    fetchModeratorState({ includeAttendance: true });

    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    pollIntervalRef.current = window.setInterval(() => {
      fetchModeratorState({ includeAttendance: liveUpdatesRef.current });
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [fetchModeratorState]);

  useEffect(() => {
    // local countdown indicator for rotating QR
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    if (event?.is_active && event?.rotating_qr_enabled) {
      const rotationSeconds = Math.min(60, Math.max(2, Number(event.rotating_qr_interval_seconds ?? 3)));
      setTimeLeft(rotationSeconds);
      countdownIntervalRef.current = window.setInterval(() => {
        setTimeLeft((prev) => (prev > 1 ? prev - 1 : rotationSeconds));
      }, 1000);
    }

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [event?.is_active, event?.rotating_qr_enabled, event?.current_qr_token]);

  useEffect(() => {
    if (event?.is_active && event?.rotating_qr_enabled) {
      setQrToken(event.current_qr_token ?? '');
      return;
    }

    if (event?.is_active && !event?.rotating_qr_enabled) {
      setQrToken('static');
      return;
    }

    setQrToken('');
  }, [event?.is_active, event?.rotating_qr_enabled, event?.current_qr_token]);

  // Handle live updates toggle - refetch when re-enabled
  const handleLiveUpdatesToggle = (enabled: boolean) => {
    setLiveUpdatesEnabled(enabled);
    liveUpdatesRef.current = enabled;
    if (enabled) {
      fetchModeratorState({ includeAttendance: true });
    }
  };

  const toggleRevealName = (recordId: string) => {
    setRevealedNames((prev) => {
      const next = new Set(prev);
      if (next.has(recordId)) next.delete(recordId);
      else next.add(recordId);
      return next;
    });
  };

  const toggleRevealEmail = (recordId: string) => {
    setRevealedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(recordId)) next.delete(recordId);
      else next.add(recordId);
      return next;
    });
  };

  const fetchSuggestions = async (searchName: string) => {
    if (!event || searchName.length < 2 || !eventId || !token) {
      setSuggestions([]);
      return;
    }

    const { data, error } = await supabase.functions.invoke('moderator-action', {
      body: { eventId, token, action: 'search_attendees', searchName },
    });

    if (error || !data?.success || !Array.isArray(data.attendees)) {
      setSuggestions([]);
      return;
    }

    setSuggestions(data.attendees as KnownAttendee[]);
  };

  const addManualAttendee = async () => {
    if (!manualName.trim() || !manualEmail.trim()) {
      toast({
        title: 'Missing information',
        description: 'Please enter both name and email',
        variant: 'destructive',
      });
      return;
    }

    const { data, error } = await supabase.functions.invoke('moderator-action', {
      body: {
        eventId,
        token,
        action: 'add_attendee',
        attendeeName: manualName.trim(),
        attendeeEmail: manualEmail.trim().toLowerCase(),
        attendeeStatus: manualExcused ? 'excused' : 'verified',
      },
    });

    if (error || !data?.success) {
      toast({
        title: 'Error',
        description: data?.error || 'Failed to add attendee',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Attendee added',
        description: manualExcused
          ? `${manualName} has been added as excused`
          : `${manualName} has been added`,
      });
      setManualName('');
      setManualEmail('');
      setManualExcused(false);
      setShowAddForm(false);
      setSuggestions([]);
      await fetchModeratorState({ includeAttendance: true });
    }
  };

  const selectSuggestion = (suggestion: KnownAttendee) => {
    setManualName(suggestion.attendee_name);
    setManualEmail(suggestion.attendee_email ?? '');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const updateStatus = async (
    recordId: string,
    newStatus: 'verified' | 'suspicious' | 'cleared' | 'excused'
  ) => {
    const { data, error } = await supabase.functions.invoke('moderator-action', {
      body: {
        eventId,
        token,
        action: 'update_status',
        recordId,
        newStatus,
      },
    });

    if (error || !data?.success) {
      toast({
        title: 'Error',
        description: data?.error || 'Failed to update status',
        variant: 'destructive',
      });
    } else {
      await fetchModeratorState({ includeAttendance: true });
      toast({
        title: 'Status updated',
        description: `Attendee marked as ${newStatus}`,
      });
    }
  };

  const deleteRecord = async (recordId: string) => {
    const record = attendance.find(r => r.id === recordId);
    const attendeeName = record ? getDisplayName(record) : 'this attendee';
    
    const confirmed = await confirm({
      title: 'Delete attendee?',
      description: `Are you sure you want to delete ${attendeeName} from the attendance list? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'destructive',
    });

    if (!confirmed) return;

    const { data, error } = await supabase.functions.invoke('moderator-action', {
      body: {
        eventId,
        token,
        action: 'delete_record',
        recordId,
      },
    });

    if (error || !data?.success) {
      toast({
        title: 'Error',
        description: data?.error || 'Failed to delete record',
        variant: 'destructive',
      });
    } else {
      await fetchModeratorState({ includeAttendance: true });
      toast({ title: 'Record deleted' });
    }
  };

  // Helper functions respecting privacy settings
  const getDisplayName = (record: AttendanceRecord): string => {
    if (!event) return record.attendee_name;
    
    if (event.moderator_show_full_name) {
      // Admin allows full name, but still use reveal toggle
      if (showAllDetails || revealedNames.has(record.id)) {
        return record.attendee_name;
      }
      return maskName(record.attendee_name);
    } else {
      // Admin restricted - only show first name
      const firstName = record.attendee_name.split(' ')[0];
      return firstName;
    }
  };

  const getDisplayEmail = (record: AttendanceRecord): string | null => {
    if (!event) return null;
    
    if (!event.moderator_show_email) {
      // Admin restricted - don't show email at all
      return null;
    }

    if (!record.attendee_email) {
      return null;
    }
    
    // Admin allows email, but still use reveal toggle
    if (showAllDetails || revealedEmails.has(record.id)) {
      return record.attendee_email;
    }
    return maskEmail(record.attendee_email);
  };

  const canRevealName = (): boolean => {
    return event?.moderator_show_full_name ?? false;
  };

  const canRevealEmail = (): boolean => {
    return event?.moderator_show_email ?? false;
  };

  const qrUrl = `${window.location.origin}/attend/${eventId}?token=${qrToken}`;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse-subtle">Loading...</div>
      </div>
    );
  }

  if (!authorized || !event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-xl font-semibold mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-4">
            {unauthorizedMessage ?? 'This moderation link is invalid or has been deactivated.'}
          </p>
          <Button onClick={() => window.location.reload()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Page
          </Button>
        </div>
      </div>
    );
  }

  const verifiedCount = attendance.filter(a => a.status === 'verified' || a.status === 'cleared').length;
  const suspiciousCount = attendance.filter(a => a.status === 'suspicious').length;
  const qrLogoSettings = event?.brand_logo_url
    ? { src: event.brand_logo_url, height: 56, width: 56, excavate: true }
    : undefined;

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-6 h-16 flex items-center">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <span className="font-semibold">Moderator View</span>
            <Badge variant="secondary">Limited Access</Badge>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* QR Code Section */}
          <div>
            <Card className="bg-gradient-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <QrCode className="w-5 h-5" />
                  {event.name}
                </CardTitle>
                <CardDescription className="flex items-center gap-4 flex-wrap">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {format(new Date(event.event_date), 'PPP p')}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {event.location_name}
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                {event.is_active ? (
                  <div className="text-center">
                    <div className="inline-block p-4 bg-background rounded-2xl shadow-lg mb-4">
                      <QRCodeSVG
                        value={qrUrl}
                        size={280}
                        level="M"
                        includeMargin
                        imageSettings={qrLogoSettings}
                      />
                    </div>
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      {event.rotating_qr_enabled ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Refreshing in {timeLeft}s
                        </>
                      ) : (
                        <span>Static QR Code</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Attendees scan this code to mark attendance
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <QrCode className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      Event is not active. Waiting for admin to start.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Stats - clickable filters */}
            <div className="grid grid-cols-3 gap-4 mt-4">
              <Card 
                className={`bg-gradient-card cursor-pointer transition-all hover:ring-2 hover:ring-primary/50 ${statusFilter === 'all' ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setStatusFilter('all')}
              >
                <CardContent className="py-4 text-center">
                  <Users className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-2xl font-bold">{attendance.length}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </CardContent>
              </Card>
              <Card 
                className={`bg-gradient-card cursor-pointer transition-all hover:ring-2 hover:ring-success/50 ${statusFilter === 'verified' ? 'ring-2 ring-success' : ''}`}
                onClick={() => setStatusFilter('verified')}
              >
                <CardContent className="py-4 text-center">
                  <CheckCircle className="w-5 h-5 mx-auto mb-1 text-success" />
                  <p className="text-2xl font-bold">{verifiedCount}</p>
                  <p className="text-xs text-muted-foreground">Verified</p>
                </CardContent>
              </Card>
              <Card 
                className={`bg-gradient-card cursor-pointer transition-all hover:ring-2 hover:ring-warning/50 ${statusFilter === 'suspicious' ? 'ring-2 ring-warning' : ''}`}
                onClick={() => setStatusFilter('suspicious')}
              >
                <CardContent className="py-4 text-center">
                  <AlertTriangle className="w-5 h-5 mx-auto mb-1 text-warning" />
                  <p className="text-2xl font-bold">{suspiciousCount}</p>
                  <p className="text-xs text-muted-foreground">Suspicious</p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Attendance List */}
          <div>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Users className="w-5 h-5" />
                Attendance ({attendance.length})
              </h2>
              <div className="flex gap-2 flex-wrap items-center">
                <div className="flex items-center gap-2 mr-2">
                  <Switch
                    id="live-updates"
                    checked={liveUpdatesEnabled}
                    onCheckedChange={handleLiveUpdatesToggle}
                  />
                  <Label htmlFor="live-updates" className="flex items-center gap-1 text-sm cursor-pointer">
                    <Radio className={`w-3 h-3 ${liveUpdatesEnabled ? 'text-success animate-pulse' : 'text-muted-foreground'}`} />
                    Live
                  </Label>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  Add
                </Button>
                {(canRevealName() || canRevealEmail()) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAllDetails(!showAllDetails)}
                    className="gap-2"
                  >
                    {showAllDetails ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    {showAllDetails ? 'Hide' : 'Show'}
                  </Button>
                )}
              </div>
            </div>

            {/* Search bar */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            {showAddForm && (
              <Card className="bg-gradient-card mb-4">
                <CardContent className="py-4">
                  <div className="space-y-3">
                    <div className="relative">
                      <Input
                        placeholder="Name"
                        value={manualName}
                        onChange={(e) => {
                          setManualName(e.target.value);
                          setShowSuggestions(true);
                          fetchSuggestions(e.target.value);
                        }}
                        onFocus={() => setShowSuggestions(true)}
                      />
                      {showSuggestions && suggestions.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                          {suggestions.map((s, idx) => (
                            <button
                              key={idx}
                              className="w-full px-3 py-2 text-left hover:bg-muted transition-colors border-b border-border last:border-0"
                              onClick={() => selectSuggestion(s)}
                            >
                              <p className="font-medium text-sm">{s.attendee_name}</p>
                              <p className="text-xs text-muted-foreground">{s.attendee_email}</p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <Input
                      placeholder="Email"
                      type="email"
                      value={manualEmail}
                      onChange={(e) => setManualEmail(e.target.value)}
                    />
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-border text-warning focus:ring-warning"
                        checked={manualExcused}
                        onChange={(e) => setManualExcused(e.target.checked)}
                      />
                      Mark as excused (not attended)
                    </label>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={addManualAttendee} className="flex-1">
                        Add Attendee
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => {
                        setShowAddForm(false);
                        setManualName('');
                        setManualEmail('');
                        setManualExcused(false);
                        setSuggestions([]);
                      }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {(() => {
              const filteredAttendance = attendance.filter((record) => {
                const matchesSearch = searchQuery === '' || 
                  record.attendee_name.toLowerCase().includes(searchQuery.toLowerCase());
                const matchesStatus = statusFilter === 'all' ||
                  (statusFilter === 'verified' && (record.status === 'verified' || record.status === 'cleared')) ||
                  (statusFilter === 'suspicious' && record.status === 'suspicious');
                return matchesSearch && matchesStatus;
              });

              if (attendance.length === 0) {
                return (
                  <Card className="bg-gradient-card">
                    <CardContent className="py-12 text-center">
                      <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No attendance records yet</p>
                    </CardContent>
                  </Card>
                );
              }

              if (filteredAttendance.length === 0) {
                return (
                  <Card className="bg-gradient-card">
                    <CardContent className="py-12 text-center">
                      <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No matching attendees found</p>
                    </CardContent>
                  </Card>
                );
              }

              return (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {filteredAttendance.map((record) => (
                  <Card key={record.id} className={`bg-gradient-card ${record.status === 'suspicious' ? 'border-warning/50' : ''}`}>
                    <CardContent className="py-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p 
                              className={`font-medium truncate ${canRevealName() && !showAllDetails && !revealedNames.has(record.id) ? 'cursor-pointer hover:text-primary' : ''}`}
                              onClick={() => canRevealName() && !showAllDetails && toggleRevealName(record.id)}
                              title={canRevealName() && !showAllDetails && !revealedNames.has(record.id) ? 'Click to reveal' : undefined}
                            >
                              {getDisplayName(record)}
                            </p>
                            <Badge
                              variant={
                                record.status === 'verified'
                                  ? 'default'
                                  : record.status === 'suspicious'
                                    ? 'destructive'
                                    : 'secondary'
                              }
                              className={
                                record.status === 'excused'
                                  ? 'bg-warning/10 text-warning border-warning/20'
                                  : undefined
                              }
                            >
                              {record.status}
                            </Badge>
                          </div>
                          {getDisplayEmail(record) !== null && (
                            <p 
                              className={`text-sm text-muted-foreground truncate ${canRevealEmail() && !showAllDetails && !revealedEmails.has(record.id) ? 'cursor-pointer hover:text-primary' : ''}`}
                              onClick={() => canRevealEmail() && !showAllDetails && toggleRevealEmail(record.id)}
                              title={canRevealEmail() && !showAllDetails && !revealedEmails.has(record.id) ? 'Click to reveal' : undefined}
                            >
                              {getDisplayEmail(record)}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span>{format(new Date(record.recorded_at), 'p')}</span>
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {record.location_provided ? 'Location verified' : 'No location'}
                            </span>
                          </div>
                          {record.suspicious_reason && (
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-xs text-warning flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                {record.suspicious_reason}
                              </p>
                              {record.location_lat != null && record.location_lng != null && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 px-1.5 text-xs gap-1"
                                  onClick={() => {
                                    window.open(`https://www.google.com/maps?q=${record.location_lat},${record.location_lng}`, '_blank');
                                  }}
                                  title="Show on Google Maps"
                                >
                                  <MapPin className="w-3 h-3" />
                                  Show on map
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {record.status === 'excused' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => updateStatus(record.id, 'verified')}
                              title="Mark as attending"
                            >
                              <CheckCircle className="w-4 h-4 text-success" />
                            </Button>
                          )}
                          {(record.status === 'verified' || record.status === 'cleared') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => updateStatus(record.id, 'excused')}
                              title="Mark as excused"
                            >
                              <UserMinus className="w-4 h-4 text-warning" />
                            </Button>
                          )}
                          {record.status === 'suspicious' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => updateStatus(record.id, 'cleared')}
                              title="Clear flag"
                            >
                              <Shield className="w-4 h-4 text-success" />
                            </Button>
                          )}
                          {record.status === 'cleared' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => updateStatus(record.id, 'suspicious')}
                              title="Flag as suspicious"
                            >
                              <AlertTriangle className="w-4 h-4 text-warning" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteRecord(record.id)}
                            title="Delete record"
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                </div>
              );
            })()}
          </div>
        </div>
      </main>
    </div>
  );
};

export default ModeratorView;
