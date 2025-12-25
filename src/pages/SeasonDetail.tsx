import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, BarChart3, Users, Calendar, TrendingUp, UserCheck } from 'lucide-react';
import { format } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface Season {
  id: string;
  name: string;
  description: string | null;
}

interface Event {
  id: string;
  name: string;
  event_date: string;
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
}

const SeasonDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [season, setSeason] = useState<Season | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

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
    const [seasonRes, eventsRes] = await Promise.all([
      supabase.from('seasons').select('*').eq('id', id).maybeSingle(),
      supabase.from('events').select('*').eq('season_id', id).order('event_date', { ascending: true }),
    ]);

    if (seasonRes.data) setSeason(seasonRes.data);
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

  // Calculate analytics
  const eventAttendanceData = events.map(event => {
    const eventAttendance = attendance.filter(a => a.event_id === event.id);
    return {
      name: format(new Date(event.event_date), 'MMM d'),
      fullName: event.name,
      attendance: eventAttendance.length,
    };
  });

  const memberStatsMap = new Map<string, MemberStats>();
  attendance.forEach(record => {
    const existing = memberStatsMap.get(record.attendee_email);
    if (existing) {
      existing.eventsAttended++;
    } else {
      memberStatsMap.set(record.attendee_email, {
        email: record.attendee_email,
        name: record.attendee_name,
        eventsAttended: 1,
        attendanceRate: 0,
      });
    }
  });

  const memberStats = Array.from(memberStatsMap.values())
    .map(member => ({
      ...member,
      attendanceRate: events.length > 0 ? Math.round((member.eventsAttended / events.length) * 100) : 0,
    }))
    .sort((a, b) => b.eventsAttended - a.eventsAttended);

  const totalAttendance = attendance.length;
  const uniqueAttendees = memberStats.length;
  const avgAttendance = events.length > 0 ? Math.round(totalAttendance / events.length) : 0;

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
        <div className="container mx-auto px-6 h-16 flex items-center">
          <Link to="/seasons" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Seasons
          </Link>
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
                  <p className="text-2xl font-bold">{totalAttendance}</p>
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
                <CardDescription>Number of attendees per event</CardDescription>
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
                <CardTitle className="text-lg">Member Attendance</CardTitle>
                <CardDescription>Sorted by number of events attended</CardDescription>
              </CardHeader>
              <CardContent>
                {memberStats.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No attendance records yet</p>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {memberStats.slice(0, 10).map((member, index) => (
                      <div key={member.email} className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground w-6">{index + 1}.</span>
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
        {events.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-4">Events in this Season</h2>
            <div className="grid gap-3">
              {events.map((event) => {
                const eventAttendance = attendance.filter(a => a.event_id === event.id).length;
                return (
                  <Link key={event.id} to={`/events/${event.id}`}>
                    <Card className="bg-gradient-card hover:border-primary/50 transition-colors">
                      <CardContent className="py-3 flex items-center justify-between">
                        <div>
                          <p className="font-medium">{event.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(event.event_date), 'PPP')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{eventAttendance}</p>
                          <p className="text-sm text-muted-foreground">attendees</p>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default SeasonDetail;
