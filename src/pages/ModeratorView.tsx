import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { QRCodeSVG } from 'qrcode.react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  ArrowLeft, QrCode, Users, MapPin, Calendar, 
  AlertTriangle, CheckCircle, Shield, Trash2, RefreshCw, Eye, EyeOff, UserPlus, Copy, Radio
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
  moderation_enabled: boolean;
}

interface AttendanceRecord {
  id: string;
  attendee_name: string;
  attendee_email: string;
  status: 'verified' | 'suspicious' | 'cleared';
  suspicious_reason: string | null;
  location_provided: boolean;
  location_lat: number | null;
  location_lng: number | null;
  recorded_at: string;
}

interface KnownAttendee {
  attendee_name: string;
  attendee_email: string;
}

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

  const [event, setEvent] = useState<Event | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
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
  const [suggestions, setSuggestions] = useState<KnownAttendee[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [liveUpdatesEnabled, setLiveUpdatesEnabled] = useState(true);

  const fetchModeratorState = useCallback(
    async (opts?: { includeAttendance?: boolean }) => {
      if (!eventId || !token) {
        setAuthorized(false);
        setEvent(null);
        setAttendance([]);
        setLoading(false);
        return;
      }

      const includeAttendance = opts?.includeAttendance ?? true;

      const { data, error } = await supabase.functions.invoke('moderator-state', {
        body: { eventId, token, includeAttendance },
      });

      if (error) {
        console.error('moderator-state invoke error', error);
        setAuthorized(false);
        setEvent(null);
        setAttendance([]);
        setLoading(false);
        return;
      }

      if (!data?.authorized) {
        setAuthorized(false);
        setEvent(null);
        setAttendance([]);
        setLoading(false);
        return;
      }

      const nextEvent = data.event as Event;
      setAuthorized(true);
      setEvent(nextEvent);
      setQrToken(nextEvent.rotating_qr_enabled ? (nextEvent.current_qr_token ?? '') : 'static');

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
    }, 1000);

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
      setTimeLeft(3);
      countdownIntervalRef.current = window.setInterval(() => {
        setTimeLeft((prev) => (prev > 1 ? prev - 1 : 3));
      }, 1000);
    }

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [event?.is_active, event?.rotating_qr_enabled]);

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

  // QR code display for active events
  useEffect(() => {
    // qrToken is derived from the latest polled event state
    if (event?.is_active && !event?.rotating_qr_enabled) {
      setQrToken('static');
    }
  }, [event?.is_active, event?.rotating_qr_enabled]);

  const fetchSuggestions = async (searchName: string) => {
    if (!event || searchName.length < 2) {
      setSuggestions([]);
      return;
    }

    const { data: eventData } = await supabase
      .from('events')
      .select('season_id')
      .eq('id', eventId)
      .maybeSingle();

    if (!eventData?.season_id) {
      setSuggestions([]);
      return;
    }

    const { data: seasonEvents } = await supabase
      .from('events')
      .select('id')
      .eq('season_id', eventData.season_id);

    if (!seasonEvents?.length) {
      setSuggestions([]);
      return;
    }

    const eventIds = seasonEvents.map(e => e.id);
    const { data: attendees } = await supabase
      .from('attendance_records')
      .select('attendee_name, attendee_email')
      .in('event_id', eventIds)
      .ilike('attendee_name', `%${searchName}%`);

    if (attendees) {
      const unique = Array.from(
        new Map(attendees.map(a => [a.attendee_email, a])).values()
      );
      setSuggestions(unique);
    }
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

    const { error } = await supabase
      .from('attendance_records')
      .insert({
        event_id: eventId,
        attendee_name: manualName.trim(),
        attendee_email: manualEmail.trim().toLowerCase(),
        device_fingerprint: `moderator-${crypto.randomUUID()}`,
        status: 'verified',
        location_provided: false,
      });

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to add attendee',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Attendee added',
        description: `${manualName} has been added`,
      });
      setManualName('');
      setManualEmail('');
      setShowAddForm(false);
      setSuggestions([]);
    }
  };

  const selectSuggestion = (suggestion: KnownAttendee) => {
    setManualName(suggestion.attendee_name);
    setManualEmail(suggestion.attendee_email);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const updateStatus = async (recordId: string, newStatus: 'verified' | 'suspicious' | 'cleared') => {
    const { error } = await supabase
      .from('attendance_records')
      .update({ status: newStatus, suspicious_reason: newStatus === 'cleared' ? null : undefined })
      .eq('id', recordId);

    if (!error) {
      await fetchModeratorState({ includeAttendance: true });
      toast({
        title: 'Status updated',
        description: `Attendee marked as ${newStatus}`,
      });
    }
  };

  const deleteRecord = async (recordId: string) => {
    const { error } = await supabase
      .from('attendance_records')
      .delete()
      .eq('id', recordId);

    if (!error) {
      await fetchModeratorState({ includeAttendance: true });
      toast({ title: 'Record deleted' });
    }
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
            This moderation link is invalid or has been deactivated.
          </p>
          <Link to="/">
            <Button>Go Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  const verifiedCount = attendance.filter(a => a.status === 'verified' || a.status === 'cleared').length;
  const suspiciousCount = attendance.filter(a => a.status === 'suspicious').length;

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
                      <QRCodeSVG value={qrUrl} size={280} level="M" includeMargin />
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

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mt-4">
              <Card className="bg-gradient-card">
                <CardContent className="py-4 text-center">
                  <Users className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-2xl font-bold">{attendance.length}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-card">
                <CardContent className="py-4 text-center">
                  <CheckCircle className="w-5 h-5 mx-auto mb-1 text-success" />
                  <p className="text-2xl font-bold">{verifiedCount}</p>
                  <p className="text-xs text-muted-foreground">Verified</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-card">
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAllDetails(!showAllDetails)}
                  className="gap-2"
                >
                  {showAllDetails ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  {showAllDetails ? 'Hide' : 'Show'}
                </Button>
              </div>
            </div>

            {/* Manual Add Form */}
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
                    <div className="flex gap-2">
                      <Button size="sm" onClick={addManualAttendee} className="flex-1">
                        Add Attendee
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => {
                        setShowAddForm(false);
                        setManualName('');
                        setManualEmail('');
                        setSuggestions([]);
                      }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {attendance.length === 0 ? (
              <Card className="bg-gradient-card">
                <CardContent className="py-12 text-center">
                  <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No attendance records yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {attendance.map((record) => (
                  <Card key={record.id} className={`bg-gradient-card ${record.status === 'suspicious' ? 'border-warning/50' : ''}`}>
                    <CardContent className="py-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p 
                              className={`font-medium truncate ${!showAllDetails && !revealedNames.has(record.id) ? 'cursor-pointer hover:text-primary' : ''}`}
                              onClick={() => !showAllDetails && toggleRevealName(record.id)}
                              title={!showAllDetails && !revealedNames.has(record.id) ? 'Click to reveal' : undefined}
                            >
                              {showAllDetails || revealedNames.has(record.id) 
                                ? record.attendee_name 
                                : maskName(record.attendee_name)}
                            </p>
                            <Badge variant={
                              record.status === 'verified' ? 'default' :
                              record.status === 'suspicious' ? 'destructive' : 'secondary'
                            }>
                              {record.status}
                            </Badge>
                          </div>
                          <p 
                            className={`text-sm text-muted-foreground truncate ${!showAllDetails && !revealedEmails.has(record.id) ? 'cursor-pointer hover:text-primary' : ''}`}
                            onClick={() => !showAllDetails && toggleRevealEmail(record.id)}
                            title={!showAllDetails && !revealedEmails.has(record.id) ? 'Click to reveal' : undefined}
                          >
                            {showAllDetails || revealedEmails.has(record.id) 
                              ? record.attendee_email 
                              : maskEmail(record.attendee_email)}
                          </p>
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
                                    navigator.clipboard.writeText(`${record.location_lat}, ${record.location_lng}`);
                                    toast({
                                      title: 'Copied',
                                      description: 'Coordinates copied to clipboard',
                                    });
                                  }}
                                  title="Copy attendee coordinates"
                                >
                                  <Copy className="w-3 h-3" />
                                  Copy coords
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
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
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default ModeratorView;
