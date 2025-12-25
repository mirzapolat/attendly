import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ArrowLeft, BarChart3, Users, Calendar, TrendingUp, UserCheck, Search, ArrowUpDown, Download, Plus, Minus, Check, X } from 'lucide-react';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Season {
  id: string;
  name: string;
  description: string | null;
}

interface Event {
  id: string;
  name: string;
  event_date: string;
  season_id: string | null;
}

interface AttendanceRecord {
  id: string;
  event_id: string;
  attendee_email: string;
  attendee_name: string;
  status: string;
}

interface MemberStats {
  email: string;
  name: string;
  eventsAttended: number;
  attendanceRate: number;
  attendedEventIds: Set<string>;
}

const SeasonDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [season, setSeason] = useState<Season | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [allUserEvents, setAllUserEvents] = useState<Event[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Member list state
  const [memberSearch, setMemberSearch] = useState('');
  const [memberSortAsc, setMemberSortAsc] = useState(false);

  // Member detail modal state
  const [selectedMember, setSelectedMember] = useState<MemberStats | null>(null);
  const [memberEventSearch, setMemberEventSearch] = useState('');
  const [memberEventFilter, setMemberEventFilter] = useState<'all' | 'attended' | 'not_attended'>('all');

  // Events list state
  const [eventSearch, setEventSearch] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && id) {
      fetchData();
    }
  }, [user, id]);

  const fetchData = async () => {
    const [seasonRes, eventsRes, allEventsRes] = await Promise.all([
      supabase.from('seasons').select('*').eq('id', id).maybeSingle(),
      supabase.from('events').select('*').eq('season_id', id).order('event_date', { ascending: true }),
      supabase.from('events').select('*').eq('admin_id', user!.id).order('event_date', { ascending: true }),
    ]);

    if (seasonRes.data) setSeason(seasonRes.data);
    if (allEventsRes.data) setAllUserEvents(allEventsRes.data);
    if (eventsRes.data) {
      setEvents(eventsRes.data);
      
      // Fetch attendance for all events
      const eventIds = eventsRes.data.map(e => e.id);
      if (eventIds.length > 0) {
        const { data: attendanceData } = await supabase
          .from('attendance_records')
          .select('*')
          .in('event_id', eventIds);
        
        if (attendanceData) setAttendance(attendanceData as AttendanceRecord[]);
      }
    }

    setLoading(false);
  };

  const handleRemoveEventFromSeason = async (eventId: string) => {
    const { error } = await supabase
      .from('events')
      .update({ season_id: null })
      .eq('id', eventId);

    if (error) {
      toast({ title: 'Error', description: 'Failed to remove event from season', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Event removed from season' });
      fetchData();
    }
  };

  const handleAddEventToSeason = async (eventId: string) => {
    const { error } = await supabase
      .from('events')
      .update({ season_id: id })
      .eq('id', eventId);

    if (error) {
      toast({ title: 'Error', description: 'Failed to add event to season', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Event added to season' });
      fetchData();
    }
  };

  // Calculate analytics with deduplication (only count one attendance per member per event)
  const eventAttendanceData = events.map(event => {
    const eventAttendance = attendance.filter(a => a.event_id === event.id);
    // Deduplicate by email
    const uniqueEmails = new Set(eventAttendance.map(a => a.attendee_email));
    return {
      name: format(new Date(event.event_date), 'MMM d'),
      fullName: event.name,
      attendance: uniqueEmails.size,
    };
  });

  // Build member stats with deduplication
  const memberStatsMap = new Map<string, MemberStats>();
  attendance.forEach(record => {
    const existing = memberStatsMap.get(record.attendee_email);
    if (existing) {
      // Only count if they haven't already been counted for this event
      if (!existing.attendedEventIds.has(record.event_id)) {
        existing.attendedEventIds.add(record.event_id);
        existing.eventsAttended++;
      }
    } else {
      memberStatsMap.set(record.attendee_email, {
        email: record.attendee_email,
        name: record.attendee_name,
        eventsAttended: 1,
        attendanceRate: 0,
        attendedEventIds: new Set([record.event_id]),
      });
    }
  });

  const memberStats = Array.from(memberStatsMap.values())
    .map(member => ({
      ...member,
      attendanceRate: events.length > 0 ? Math.round((member.eventsAttended / events.length) * 100) : 0,
    }));

  // Filter and sort member stats
  const filteredMemberStats = memberStats
    .filter(member => {
      const searchLower = memberSearch.toLowerCase();
      return member.name.toLowerCase().includes(searchLower) || 
             member.email.toLowerCase().includes(searchLower);
    })
    .sort((a, b) => {
      const diff = b.eventsAttended - a.eventsAttended;
      return memberSortAsc ? -diff : diff;
    });

  // Calculate total attendance with deduplication
  const totalUniqueAttendance = events.reduce((sum, event) => {
    const eventEmails = new Set(attendance.filter(a => a.event_id === event.id).map(a => a.attendee_email));
    return sum + eventEmails.size;
  }, 0);
  const uniqueAttendees = memberStats.length;
  const avgAttendance = events.length > 0 ? Math.round(totalUniqueAttendance / events.length) : 0;

  // Events not in this season
  const eventsNotInSeason = allUserEvents.filter(e => e.season_id !== id);

  // Filter events list
  const filteredSeasonEvents = events.filter(e => 
    e.name.toLowerCase().includes(eventSearch.toLowerCase())
  );

  // Member detail modal: events for selected member
  const getMemberEvents = () => {
    if (!selectedMember) return [];
    
    return events
      .map(event => {
        const attended = selectedMember.attendedEventIds.has(event.id);
        return { ...event, attended };
      })
      .filter(event => {
        // Search filter
        if (memberEventSearch && !event.name.toLowerCase().includes(memberEventSearch.toLowerCase())) {
          return false;
        }
        // Attendance filter
        if (memberEventFilter === 'attended' && !event.attended) return false;
        if (memberEventFilter === 'not_attended' && event.attended) return false;
        return true;
      })
      .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
  };

  // Export full attendance matrix CSV
  const handleExportAttendanceMatrix = () => {
    if (events.length === 0 || memberStats.length === 0) {
      toast({ title: 'No data', description: 'No attendance data to export', variant: 'destructive' });
      return;
    }

    // Sort events chronologically
    const sortedEvents = [...events].sort((a, b) => 
      new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
    );

    // Helper to escape CSV values
    const escapeCSV = (value: string) => `"${value.replace(/"/g, '""')}"`;

    // Build CSV header
    const headers = [
      escapeCSV('Name'), 
      escapeCSV('Email'), 
      ...sortedEvents.map(e => escapeCSV(`${e.name} (${format(new Date(e.event_date), 'MMM d, yyyy')})`))
    ];
    
    // Build CSV rows
    const rows = memberStats.map(member => {
      const cells = [
        escapeCSV(member.name),
        escapeCSV(member.email),
        ...sortedEvents.map(event => escapeCSV(member.attendedEventIds.has(event.id) ? 'Attended' : '')),
      ];
      return cells.join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${season?.name || 'season'}_attendance_matrix.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({ title: 'Exported', description: 'Attendance matrix exported successfully' });
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse-subtle">Loading...</div>
      </div>
    );
  }

  if (!season) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Season not found</p>
          <Link to="/seasons">
            <Button>Back to Seasons</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/seasons" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Seasons
          </Link>
          <Button onClick={handleExportAttendanceMatrix} variant="outline" size="sm" className="gap-2">
            <Download className="w-4 h-4" />
            Export Matrix
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6" />
            {season.name}
          </h1>
          {season.description && (
            <p className="text-muted-foreground mt-1">{season.description}</p>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gradient-card">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{events.length}</p>
                  <p className="text-sm text-muted-foreground">Events</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{uniqueAttendees}</p>
                  <p className="text-sm text-muted-foreground">Unique Members</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <UserCheck className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalUniqueAttendance}</p>
                  <p className="text-sm text-muted-foreground">Total Attendance</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{avgAttendance}</p>
                  <p className="text-sm text-muted-foreground">Avg per Event</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {events.length === 0 ? (
          <Card className="bg-gradient-card">
            <CardContent className="py-12 text-center">
              <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">No events in this season yet</p>
              <Link to="/events/new">
                <Button>Create an Event</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Attendance Chart */}
            <Card className="bg-gradient-card">
              <CardHeader>
                <CardTitle className="text-lg">Attendance Over Time</CardTitle>
                <CardDescription>Unique attendees per event</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={eventAttendanceData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="name" 
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <YAxis 
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                        labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                      />
                      <Bar 
                        dataKey="attendance" 
                        fill="hsl(var(--primary))" 
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Member Leaderboard */}
            <Card className="bg-gradient-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Member Attendance</CardTitle>
                    <CardDescription>Click on a member to see details</CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMemberSortAsc(!memberSortAsc)}
                    className="gap-1"
                  >
                    <ArrowUpDown className="w-4 h-4" />
                    {memberSortAsc ? 'Asc' : 'Desc'}
                  </Button>
                </div>
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or email..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {filteredMemberStats.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    {memberSearch ? 'No members found' : 'No attendance records yet'}
                  </p>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {filteredMemberStats.map((member, index) => (
                      <div 
                        key={member.email} 
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => {
                          setSelectedMember(member);
                          setMemberEventSearch('');
                          setMemberEventFilter('all');
                        }}
                      >
                        <span className="text-sm text-muted-foreground w-6">
                          {memberSortAsc ? filteredMemberStats.length - index : index + 1}.
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{member.name}</p>
                          <p className="text-sm text-muted-foreground truncate">{member.email}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{member.eventsAttended}/{events.length}</p>
                          <p className="text-sm text-muted-foreground">{member.attendanceRate}%</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Events List */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Events in this Season</h2>
          </div>
          
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search events..."
              value={eventSearch}
              onChange={(e) => setEventSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {filteredSeasonEvents.length === 0 && events.length === 0 ? (
            <Card className="bg-gradient-card">
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">No events in this season</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {filteredSeasonEvents.map((event) => {
                const eventEmails = new Set(attendance.filter(a => a.event_id === event.id).map(a => a.attendee_email));
                return (
                  <Card key={event.id} className="bg-gradient-card">
                    <CardContent className="py-3 flex items-center justify-between">
                      <Link to={`/events/${event.id}`} className="flex-1">
                        <div>
                          <p className="font-medium hover:text-primary transition-colors">{event.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(event.event_date), 'PPP')}
                          </p>
                        </div>
                      </Link>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-semibold">{eventEmails.size}</p>
                          <p className="text-sm text-muted-foreground">attendees</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault();
                            handleRemoveEventFromSeason(event.id);
                          }}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Events not in season */}
          {eventsNotInSeason.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-medium mb-3 text-muted-foreground">Add Events to Season</h3>
              <div className="grid gap-2">
                {eventsNotInSeason.slice(0, 5).map((event) => (
                  <Card key={event.id} className="bg-muted/30 border-dashed">
                    <CardContent className="py-2 flex items-center justify-between">
                      <div>
                        <p className="font-medium">{event.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(event.event_date), 'PPP')}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAddEventToSeason(event.id)}
                        className="text-primary hover:text-primary hover:bg-primary/10"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
                {eventsNotInSeason.length > 5 && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    +{eventsNotInSeason.length - 5} more events available
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Member Detail Modal */}
      <Dialog open={!!selectedMember} onOpenChange={(open) => !open && setSelectedMember(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{selectedMember?.name}</DialogTitle>
            <DialogDescription>{selectedMember?.email}</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search events..."
                  value={memberEventSearch}
                  onChange={(e) => setMemberEventSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant={memberEventFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMemberEventFilter('all')}
              >
                All ({events.length})
              </Button>
              <Button
                variant={memberEventFilter === 'attended' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMemberEventFilter('attended')}
              >
                Attended ({selectedMember?.eventsAttended || 0})
              </Button>
              <Button
                variant={memberEventFilter === 'not_attended' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMemberEventFilter('not_attended')}
              >
                Not Attended ({events.length - (selectedMember?.eventsAttended || 0)})
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {getMemberEvents().map((event) => (
                <div 
                  key={event.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                >
                  <div>
                    <p className="font-medium">{event.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(event.event_date), 'PPP')}
                    </p>
                  </div>
                  <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                    event.attended 
                      ? 'bg-green-500/10 text-green-600 dark:text-green-400' 
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {event.attended ? (
                      <>
                        <Check className="w-4 h-4" />
                        Attended
                      </>
                    ) : (
                      <>
                        <X className="w-4 h-4" />
                        Not Attended
                      </>
                    )}
                  </div>
                </div>
              ))}
              {getMemberEvents().length === 0 && (
                <p className="text-center text-muted-foreground py-8">No events match your search</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SeasonDetail;
