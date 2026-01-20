import { useEffect, useState, useCallback, useRef, useMemo, type CSSProperties, type MouseEvent } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { getRuntimeEnv } from '@/lib/runtimeEnv';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { QRCodeSVG } from 'qrcode.react';
import { 
  ArrowLeft, QrCode, Users, MapPin, Calendar, Play, Square, 
  AlertTriangle, CheckCircle, Shield, Trash2, RefreshCw, Eye, EyeOff, UserPlus, Settings, Copy, Users2, Search, UserMinus
} from 'lucide-react';
import { format } from 'date-fns';
import EventSettings from '@/components/EventSettings';
import ModerationSettings from '@/components/ModerationSettings';
import ExcuseLinkSettings from '@/components/ExcuseLinkSettings';
import AttendeeActions from '@/components/AttendeeActions';
import QRCodeExport from '@/components/QRCodeExport';
import { sanitizeError } from '@/utils/errorHandler';

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
  qr_token_expires_at: string | null;
  rotating_qr_enabled: boolean;
  device_fingerprint_enabled: boolean;
  location_check_enabled: boolean;
  moderation_enabled: boolean;
  moderator_show_full_name: boolean;
  moderator_show_email: boolean;
}

interface AttendanceRecord {
  id: string;
  attendee_name: string;
  attendee_email: string;
  status: 'verified' | 'suspicious' | 'cleared' | 'excused';
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

const POLL_INTERVAL_MS = 1100;

// Helper to mask last name (keep first name visible)
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

const EventDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user, session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const [event, setEvent] = useState<Event | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrToken, setQrToken] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState(3);
  const intervalRef = useRef<number | null>(null);
  
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
  
  // Settings modals
  const [showSettings, setShowSettings] = useState(false);
  const [showModeration, setShowModeration] = useState(false);
  const [showExcuseLinks, setShowExcuseLinks] = useState(false);

  // Search and filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'suspicious'>('all');
  const [showConfetti, setShowConfetti] = useState(false);

  const confettiPieces = useMemo(() => {
    const colors = ['#16a34a', '#22c55e', '#14b8a6', '#f59e0b', '#84cc16'];
    return Array.from({ length: 18 }, (_, index) => ({
      id: index,
      left: Math.random() * 100,
      size: 4 + Math.random() * 6,
      color: colors[index % colors.length],
      duration: 1800 + Math.random() * 1400,
      delay: Math.random() * 500,
      drift: (Math.random() - 0.5) * 140,
    }));
  }, []);

  const justCreated = Boolean((location.state as { justCreated?: boolean } | null)?.justCreated);
  const shouldWarnOnLeave = Boolean(event?.is_active && event?.rotating_qr_enabled);

  const fetchEvent = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: sanitizeError(error),
      });
      setLoading(false);
      return;
    }

    if (data) {
      setEvent(data);
    }
    setLoading(false);
  }, [id, toast]);

  const fetchAttendance = useCallback(async (opts?: { silent?: boolean }) => {
    if (!id) return;
    const { data, error } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('event_id', id)
      .order('recorded_at', { ascending: false });

    if (error) {
      if (!opts?.silent) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: sanitizeError(error),
        });
      }
      return;
    }

    if (data) setAttendance(data as AttendanceRecord[]);
  }, [id, toast]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!justCreated || !id) return;
    setShowConfetti(true);
    const timer = window.setTimeout(() => setShowConfetti(false), 2800);
    navigate(`/events/${id}`, { replace: true });
    return () => window.clearTimeout(timer);
  }, [justCreated, id, navigate]);

  useEffect(() => {
    if (!user || !id) return;
    fetchEvent();
    fetchAttendance();
    const intervalId = window.setInterval(() => {
      void fetchAttendance({ silent: true });
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [user, id, fetchEvent, fetchAttendance]);

  useEffect(() => {
    if (!shouldWarnOnLeave) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = 'Leaving will stop the event and pause rotating QR codes.';
    };

    const handlePageHide = () => {
      if (!id || !session?.access_token) {
        return;
      }

      const runtimeEnv = getRuntimeEnv();
      const supabaseUrl = runtimeEnv.VITE_SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey =
        runtimeEnv.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      if (!supabaseUrl || !supabaseKey) {
        return;
      }

      const payload = JSON.stringify({
        is_active: false,
        current_qr_token: null,
        qr_token_expires_at: null,
      });

      void fetch(`${supabaseUrl}/rest/v1/events?id=eq.${id}`, {
        method: 'PATCH',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: payload,
        keepalive: true,
      });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [shouldWarnOnLeave, id, session?.access_token]);

  const stopEventForExit = async () => {
    if (!event?.is_active || !id) {
      return true;
    }

    const { error } = await supabase
      .from('events')
      .update({
        is_active: false,
        current_qr_token: null,
        qr_token_expires_at: null,
      })
      .eq('id', id);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: sanitizeError(error),
      });
      return false;
    }

    setEvent((prev) => (prev ? { ...prev, is_active: false } : null));
    return true;
  };

  const handleDashboardClick = async (clickEvent: MouseEvent<HTMLAnchorElement>) => {
    if (!shouldWarnOnLeave) {
      return;
    }

    clickEvent.preventDefault();
    const confirmed = window.confirm(
      'Leaving this page will stop the event and pause rotating QR codes. Do you want to proceed?'
    );
    if (!confirmed) {
      return;
    }
    const stopped = await stopEventForExit();
    if (stopped) {
      navigate('/dashboard');
    }
  };

  const toggleRevealName = (recordId: string) => {
    setRevealedNames((prev) => {
      const next = new Set(prev);
      if (next.has(recordId)) {
        next.delete(recordId);
      } else {
        next.add(recordId);
      }
      return next;
    });
  };

  const toggleRevealEmail = (recordId: string) => {
    setRevealedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(recordId)) {
        next.delete(recordId);
      } else {
        next.add(recordId);
      }
      return next;
    });
  };

  const generateToken = useCallback(() => {
    // Embed timestamp in token for validation: uuid_timestamp
    const timestamp = Date.now();
    return `${crypto.randomUUID()}_${timestamp}`;
  }, []);

  // Fetch known attendees from same season for autocomplete
  const fetchSuggestions = async (searchName: string) => {
    if (!event || searchName.length < 2) {
      setSuggestions([]);
      return;
    }

    // First get the event's season_id
    const { data: eventData } = await supabase
      .from('events')
      .select('season_id')
      .eq('id', id)
      .maybeSingle();

    if (!eventData?.season_id) {
      setSuggestions([]);
      return;
    }

    // Get all events in the same season
    const { data: seasonEvents } = await supabase
      .from('events')
      .select('id')
      .eq('season_id', eventData.season_id);

    if (!seasonEvents?.length) {
      setSuggestions([]);
      return;
    }

    const eventIds = seasonEvents.map(e => e.id);

    // Get unique attendees from those events matching the search
    const { data: attendees } = await supabase
      .from('attendance_records')
      .select('attendee_name, attendee_email')
      .in('event_id', eventIds)
      .ilike('attendee_name', `%${searchName}%`);

    if (attendees) {
      // Dedupe by email
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
        event_id: id,
        attendee_name: manualName.trim(),
        attendee_email: manualEmail.trim().toLowerCase(),
        device_fingerprint: `manual-${crypto.randomUUID()}`,
        status: manualExcused ? 'excused' : 'verified',
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
        description: manualExcused
          ? `${manualName} has been added as excused`
          : `${manualName} has been added manually`,
      });
      setManualName('');
      setManualEmail('');
      setManualExcused(false);
      setShowAddForm(false);
      setSuggestions([]);
      await fetchAttendance({ silent: true });
    }
  };

  const selectSuggestion = (suggestion: KnownAttendee) => {
    setManualName(suggestion.attendee_name);
    setManualEmail(suggestion.attendee_email);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const updateQRCode = useCallback(async () => {
    if (!event?.is_active || !event?.rotating_qr_enabled) return;

    const newToken = generateToken();
    // 10 second validity: 3s display + 7s grace period for scan time
    const expiresAt = new Date(Date.now() + 10000).toISOString();

    await supabase
      .from('events')
      .update({
        current_qr_token: newToken,
        qr_token_expires_at: expiresAt,
      })
      .eq('id', id);

    setQrToken(newToken);
    setTimeLeft(3);
  }, [id, event?.is_active, event?.rotating_qr_enabled, generateToken]);

  useEffect(() => {
    if (event?.is_active && event?.rotating_qr_enabled) {
      updateQRCode();
      intervalRef.current = window.setInterval(() => {
        updateQRCode();
      }, 3000);

      const countdownInterval = window.setInterval(() => {
        setTimeLeft((prev) => (prev > 1 ? prev - 1 : 3));
      }, 1000);

      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        clearInterval(countdownInterval);
      };
    } else if (event?.is_active && !event?.rotating_qr_enabled) {
      // Static QR - set once
      setQrToken('static');
    }
  }, [event?.is_active, event?.rotating_qr_enabled, updateQRCode]);

  const handleEventUpdate = (updates: Partial<Event>) => {
    setEvent((prev) => prev ? { ...prev, ...updates } : null);
  };

  const toggleActive = async () => {
    const newStatus = !event?.is_active;
    
    const { error } = await supabase
      .from('events')
      .update({ 
        is_active: newStatus,
        current_qr_token: newStatus ? generateToken() : null,
        qr_token_expires_at: newStatus ? new Date(Date.now() + 10000).toISOString() : null,
      })
      .eq('id', id);

    if (!error) {
      setEvent((prev) => prev ? { ...prev, is_active: newStatus } : null);
      toast({
        title: newStatus ? 'Event started' : 'Event stopped',
        description: newStatus ? 'QR code is now active' : 'QR code is now inactive',
      });
    }
  };

  const updateStatus = async (
    recordId: string,
    newStatus: 'verified' | 'suspicious' | 'cleared' | 'excused'
  ) => {
    const { error } = await supabase
      .from('attendance_records')
      .update({
        status: newStatus,
        suspicious_reason: newStatus === 'suspicious' ? undefined : null,
      })
      .eq('id', recordId);

    if (!error) {
      fetchAttendance();
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
      fetchAttendance();
      toast({
        title: 'Record deleted',
      });
    }
  };

  const qrUrl = `${window.location.origin}/attend/${id}?token=${qrToken}`;

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse-subtle">Loading...</div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Event not found</p>
          <Link to="/dashboard" onClick={handleDashboardClick}>
            <Button>Back to Events</Button>
          </Link>
        </div>
      </div>
    );
  }

  const verifiedCount = attendance.filter(a => a.status === 'verified' || a.status === 'cleared').length;
  const suspiciousCount = attendance.filter(a => a.status === 'suspicious').length;
  const excusedCount = attendance.filter(a => a.status === 'excused').length;

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {showConfetti && (
        <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
          {confettiPieces.map((piece) => {
            const confettiStyle = {
              left: `${piece.left}%`,
              width: `${piece.size}px`,
              height: `${piece.size}px`,
              backgroundColor: piece.color,
              animationDuration: `${piece.duration}ms`,
              animationDelay: `${piece.delay}ms`,
              ['--confetti-drift' as string]: `${piece.drift}px`,
            } as CSSProperties;
            return <span key={piece.id} className="confetti-piece" style={confettiStyle} />;
          })}
        </div>
      )}
      {showSettings && event && (
        <EventSettings
          event={event}
          onClose={() => setShowSettings(false)}
          onUpdate={handleEventUpdate}
        />
      )}
      {showModeration && event && (
        <ModerationSettings
          eventId={event.id}
          eventName={event.name}
          moderationEnabled={event.moderation_enabled}
          moderatorShowFullName={event.moderator_show_full_name}
          moderatorShowEmail={event.moderator_show_email}
          onClose={() => setShowModeration(false)}
          onUpdate={(settings) => setEvent((prev) => prev ? { ...prev, ...settings } : null)}
        />
      )}
      {showExcuseLinks && event && (
        <ExcuseLinkSettings
          eventId={event.id}
          eventName={event.name}
          onClose={() => setShowExcuseLinks(false)}
        />
      )}
      <header className="bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            to="/dashboard"
            onClick={handleDashboardClick}
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Events
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setShowModeration(true)} title="Moderation settings">
              <Users2 className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setShowExcuseLinks(true)} title="Excuse links">
              <UserMinus className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setShowSettings(true)} title="Event settings">
              <Settings className="w-4 h-4" />
            </Button>
            <Button
              variant={event.is_active ? 'destructive' : 'hero'}
              onClick={toggleActive}
            >
              {event.is_active ? (
                <>
                  <Square className="w-4 h-4" />
                  Stop Event
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Start Event
                </>
              )}
            </Button>
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
                {event.description && (
                  <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                )}
                <CardDescription className="flex items-center gap-4 flex-wrap">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {format(new Date(event.event_date), 'PPP p')}
                  </span>
                  {event.location_check_enabled && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {event.location_name}
                    </span>
                  )}
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
                    {!event.rotating_qr_enabled && (
                      <div className="mt-4">
                        <QRCodeExport
                          url={qrUrl}
                          eventName={event.name}
                          eventDate={event.event_date}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <QrCode className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">
                      Start the event to display the QR code
                    </p>
                    <Button onClick={toggleActive} variant="hero">
                      <Play className="w-4 h-4" />
                      Start Event
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Stats - clickable filters */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
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
                className={`bg-gradient-card cursor-pointer transition-all hover:ring-2 hover:ring-warning/50 ${statusFilter === 'excused' ? 'ring-2 ring-warning' : ''}`}
                onClick={() => setStatusFilter('excused')}
              >
                <CardContent className="py-4 text-center">
                  <UserMinus className="w-5 h-5 mx-auto mb-1 text-warning" />
                  <p className="text-2xl font-bold">{excusedCount}</p>
                  <p className="text-xs text-muted-foreground">Excused</p>
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
              <div className="flex gap-2 flex-wrap">
                <AttendeeActions
                  eventId={id!}
                  eventName={event.name}
                  attendance={attendance}
                  onImportComplete={fetchAttendance}
                />
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
                  {showAllDetails ? 'Hide' : 'Details'}
                </Button>
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
                  (statusFilter === 'suspicious' && record.status === 'suspicious') ||
                  (statusFilter === 'excused' && record.status === 'excused');
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
                              className={`font-medium truncate ${!showAllDetails && !revealedNames.has(record.id) ? 'cursor-pointer hover:text-primary' : ''}`}
                              onClick={() => !showAllDetails && toggleRevealName(record.id)}
                              title={!showAllDetails && !revealedNames.has(record.id) ? 'Click to reveal' : undefined}
                            >
                              {showAllDetails || revealedNames.has(record.id) 
                                ? record.attendee_name 
                                : maskName(record.attendee_name)}
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

export default EventDetail;
