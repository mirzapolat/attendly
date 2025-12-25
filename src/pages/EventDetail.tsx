import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { QRCodeSVG } from 'qrcode.react';
import { 
  ArrowLeft, QrCode, Users, MapPin, Calendar, Play, Square, 
  AlertTriangle, CheckCircle, Shield, Trash2, RefreshCw, Eye, EyeOff, UserPlus
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
  qr_token_expires_at: string | null;
}

interface AttendanceRecord {
  id: string;
  attendee_name: string;
  attendee_email: string;
  status: 'verified' | 'suspicious' | 'cleared';
  suspicious_reason: string | null;
  location_provided: boolean;
  recorded_at: string;
}

interface KnownAttendee {
  attendee_name: string;
  attendee_email: string;
}

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
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [event, setEvent] = useState<Event | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrToken, setQrToken] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState(3);
  const intervalRef = useRef<number | null>(null);
  const tokenTimeoutRef = useRef<number | null>(null);
  
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

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && id) {
      fetchEvent();
      fetchAttendance();
      
      // Subscribe to real-time attendance updates
      const channel = supabase
        .channel('attendance-updates')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'attendance_records',
            filter: `event_id=eq.${id}`
          },
          (payload) => {
            console.log('New attendance:', payload);
            setAttendance((prev) => [payload.new as AttendanceRecord, ...prev]);
            toast({
              title: 'New attendee',
              description: `${maskName((payload.new as AttendanceRecord).attendee_name)} checked in`,
            });
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'attendance_records',
            filter: `event_id=eq.${id}`
          },
          (payload) => {
            setAttendance((prev) => 
              prev.map((r) => r.id === (payload.new as AttendanceRecord).id ? payload.new as AttendanceRecord : r)
            );
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'attendance_records',
            filter: `event_id=eq.${id}`
          },
          (payload) => {
            setAttendance((prev) => prev.filter((r) => r.id !== (payload.old as { id: string }).id));
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, id]);

  const fetchEvent = async () => {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (data) {
      setEvent(data);
    }
    setLoading(false);
  };

  const fetchAttendance = async () => {
    const { data } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('event_id', id)
      .order('recorded_at', { ascending: false });

    if (data) setAttendance(data as AttendanceRecord[]);
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
    // Use cryptographically secure random token
    return crypto.randomUUID();
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
        device_fingerprint: 'manual-entry',
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
        description: `${manualName} has been added manually`,
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

  const updateQRCode = useCallback(async () => {
    if (!event?.is_active) return;

    const newToken = generateToken();
    const expiresAt = new Date(Date.now() + 8000).toISOString(); // 5 seconds after next change (3s interval + 5s grace)

    await supabase
      .from('events')
      .update({
        current_qr_token: newToken,
        qr_token_expires_at: expiresAt,
      })
      .eq('id', id);

    setQrToken(newToken);
    setTimeLeft(3);
  }, [id, event?.is_active, generateToken]);

  useEffect(() => {
    if (event?.is_active) {
      updateQRCode();
      intervalRef.current = window.setInterval(() => {
        updateQRCode();
      }, 3000);

      // Countdown timer
      const countdownInterval = window.setInterval(() => {
        setTimeLeft((prev) => (prev > 1 ? prev - 1 : 3));
      }, 1000);

      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        clearInterval(countdownInterval);
      };
    }
  }, [event?.is_active, updateQRCode]);

  const toggleActive = async () => {
    const newStatus = !event?.is_active;
    
    const { error } = await supabase
      .from('events')
      .update({ 
        is_active: newStatus,
        current_qr_token: newStatus ? generateToken() : null,
        qr_token_expires_at: newStatus ? new Date(Date.now() + 8000).toISOString() : null,
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

  const updateStatus = async (recordId: string, newStatus: 'verified' | 'suspicious' | 'cleared') => {
    const { error } = await supabase
      .from('attendance_records')
      .update({ status: newStatus, suspicious_reason: newStatus === 'cleared' ? null : undefined })
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
          <Link to="/dashboard">
            <Button>Back to Dashboard</Button>
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
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Link>
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
                      />
                    </div>
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Refreshing in {timeLeft}s
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Attendees scan this code to mark attendance
                    </p>
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
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Users className="w-5 h-5" />
                Attendance ({attendance.length})
              </h2>
              <div className="flex gap-2">
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
                            <p className="text-xs text-warning mt-1 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              {record.suspicious_reason}
                            </p>
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

export default EventDetail;
