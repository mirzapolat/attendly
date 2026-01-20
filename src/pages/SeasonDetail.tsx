import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, BarChart3, Users, Calendar, TrendingUp, UserCheck, Search, ArrowUpDown, Download, Plus, Minus, Check, X, Settings, FileText, AlertTriangle, Wand2 } from 'lucide-react';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { sanitizeError } from '@/utils/errorHandler';

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

type AttendanceStatus = 'verified' | 'suspicious' | 'cleared' | 'excused';

interface AttendanceRecord {
  id: string;
  event_id: string;
  attendee_email: string;
  attendee_name: string;
  status: AttendanceStatus;
}

interface MemberStats {
  email: string;
  name: string;
  eventsAttended: number;
  eventsExcused: number;
  attendanceRate: number;
  attendedEventIds: Set<string>;
  excusedEventIds: Set<string>;
}

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const normalizeLocalPart = (localPart: string) =>
  localPart.replace(/\./g, '').replace(/\s+/g, '').toLowerCase();

const normalizeDomain = (domain: string) =>
  domain.replace(/\s+/g, '').toLowerCase();

const splitDomain = (domain: string) => {
  const parts = domain.split('.').filter(Boolean);
  if (parts.length <= 1) {
    return { base: domain, tld: '' };
  }
  const tld = parts.pop() ?? '';
  return { base: parts.join('.'), tld };
};

const longestCommonSubstring = (a: string, b: string) => {
  if (!a || !b) return 0;
  const rows = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  let longest = 0;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      if (a[i - 1] === b[j - 1]) {
        rows[i][j] = rows[i - 1][j - 1] + 1;
        if (rows[i][j] > longest) {
          longest = rows[i][j];
        }
      }
    }
  }
  return longest;
};

const levenshteinDistance = (a: string, b: string) => {
  if (a === b) return 0;
  if (!a || !b) return Math.max(a.length, b.length);

  const matrix: number[][] = Array.from({ length: a.length + 1 }, () =>
    Array.from({ length: b.length + 1 }, () => 0),
  );

  for (let i = 0; i <= a.length; i += 1) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= b.length; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[a.length][b.length];
};

const SeasonDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const { currentWorkspace, loading: workspaceLoading } = useWorkspace();
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
  const [memberEventFilter, setMemberEventFilter] = useState<'all' | 'attended' | 'excused' | 'not_attended'>('all');

  // Events list state
  const [eventSearch, setEventSearch] = useState('');
  const [manageEventsOpen, setManageEventsOpen] = useState(false);
  const [removeEventSearch, setRemoveEventSearch] = useState('');
  const [addEventSearch, setAddEventSearch] = useState('');
  const [seasonSettingsOpen, setSeasonSettingsOpen] = useState(false);
  const [seasonName, setSeasonName] = useState('');
  const [seasonDescription, setSeasonDescription] = useState('');
  const [seasonSaving, setSeasonSaving] = useState(false);
  const [conflictsOpen, setConflictsOpen] = useState(false);
  const [conflictSelections, setConflictSelections] = useState<Record<string, string>>({});
  const [resolvingConflicts, setResolvingConflicts] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!authLoading && user && !workspaceLoading && !currentWorkspace) {
      navigate('/workspaces');
    }
  }, [authLoading, user, workspaceLoading, currentWorkspace, navigate]);

  useEffect(() => {
    if (user && id && currentWorkspace) {
      fetchData();
    }
  }, [user, id, currentWorkspace]);

  const fetchData = async () => {
    try {
      if (!currentWorkspace) {
        throw new Error('Workspace not selected');
      }

      const [seasonRes, eventsRes, allEventsRes] = await Promise.all([
        supabase
          .from('seasons')
          .select('*')
          .eq('id', id)
          .eq('workspace_id', currentWorkspace.id)
          .maybeSingle(),
        supabase
          .from('events')
          .select('*')
          .eq('season_id', id)
          .eq('workspace_id', currentWorkspace.id)
          .order('event_date', { ascending: true }),
        supabase
          .from('events')
          .select('*')
          .eq('workspace_id', currentWorkspace.id)
          .order('event_date', { ascending: true }),
      ]);

      const fetchError = seasonRes.error || eventsRes.error || allEventsRes.error;
      if (fetchError) {
        throw fetchError;
      }

      if (seasonRes.data) setSeason(seasonRes.data);
      if (allEventsRes.data) setAllUserEvents(allEventsRes.data);
      if (eventsRes.data) {
        setEvents(eventsRes.data);
        
        // Fetch attendance for all events
        const eventIds = eventsRes.data.map(e => e.id);
        if (eventIds.length > 0) {
          const { data: attendanceData, error: attendanceError } = await supabase
            .from('attendance_records')
            .select('*')
            .in('event_id', eventIds);

          if (attendanceError) {
            throw attendanceError;
          }
          
          if (attendanceData) setAttendance(attendanceData as AttendanceRecord[]);
        }
      }
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: sanitizeError(error),
      });
    } finally {
      setLoading(false);
    }
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

  const openSeasonSettings = () => {
    if (!season) return;
    setSeasonName(season.name);
    setSeasonDescription(season.description ?? '');
    setSeasonSettingsOpen(true);
  };

  const handleSeasonUpdate = async () => {
    if (!season) return;
    if (!seasonName.trim()) {
      toast({
        title: 'Missing name',
        description: 'Season name is required',
        variant: 'destructive',
      });
      return;
    }

    setSeasonSaving(true);
    const { error } = await supabase
      .from('seasons')
      .update({
        name: seasonName.trim(),
        description: seasonDescription.trim() ? seasonDescription.trim() : null,
      })
      .eq('id', season.id);

    setSeasonSaving(false);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to update season settings',
        variant: 'destructive',
      });
      return;
    }

    setSeason((prev) =>
      prev
        ? {
            ...prev,
            name: seasonName.trim(),
            description: seasonDescription.trim() ? seasonDescription.trim() : null,
          }
        : prev,
    );
    setSeasonSettingsOpen(false);
    toast({ title: 'Season updated' });
  };

  const nameConflicts = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    attendance.forEach((record) => {
      const email = record.attendee_email;
      const name = record.attendee_name.trim();
      if (!email || !name) return;
      if (!map.has(email)) {
        map.set(email, new Map());
      }
      const nameCounts = map.get(email)!;
      nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
    });

    const conflicts = Array.from(map.entries())
      .map(([email, namesMap]) => {
        const names = Array.from(namesMap.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
        return { email, names };
      })
      .filter((entry) => entry.names.length > 1)
      .sort((a, b) => a.email.localeCompare(b.email));

    return conflicts;
  }, [attendance]);

  const hasEmailSuggestions = useMemo(() => {
    const emailSet = new Set<string>();
    attendance.forEach((record) => {
      const normalized = normalizeEmail(record.attendee_email || '');
      if (normalized) {
        emailSet.add(normalized);
      }
    });

    const entries = Array.from(emailSet)
      .map((email) => {
        const [localPart, domainPart] = email.split('@');
        if (!localPart || !domainPart) return null;
        const local = normalizeLocalPart(localPart);
        const domain = normalizeDomain(domainPart);
        const { base: domainBase, tld } = splitDomain(domain);
        if (!local || !domain) return null;
        return { email, local, domain, domainBase, tld };
      })
      .filter(
        (
          entry,
        ): entry is { email: string; local: string; domain: string; domainBase: string; tld: string } =>
          Boolean(entry),
      );

    const DOMAIN_MAX_DISTANCE = 2;

    for (let i = 0; i < entries.length; i += 1) {
      for (let j = i + 1; j < entries.length; j += 1) {
        const a = entries[i];
        const b = entries[j];
        const domainDistance = levenshteinDistance(a.domain, b.domain);
        const localMaxDistance = Math.min(
          3,
          Math.max(1, Math.floor(Math.max(a.local.length, b.local.length) / 4)),
        );
        const localDistance = levenshteinDistance(a.local, b.local);
        if (localDistance === 0 && domainDistance === 0) continue;

        const minLocalLength = Math.min(a.local.length, b.local.length);
        const longestCommon = longestCommonSubstring(a.local, b.local);
        const hasLocalOverlap =
          (minLocalLength >= 4 && longestCommon >= Math.min(5, minLocalLength)) ||
          (a.local.includes(b.local) && b.local.length >= 4) ||
          (b.local.includes(a.local) && a.local.length >= 4);

        const isDomainTypo = domainDistance <= DOMAIN_MAX_DISTANCE;
        const isLocalTypo = localDistance <= localMaxDistance;
        const isTldVariant =
          a.local === b.local &&
          a.domainBase &&
          b.domainBase &&
          a.domainBase === b.domainBase &&
          a.tld &&
          b.tld &&
          a.tld !== b.tld;

        if (!isLocalTypo && !hasLocalOverlap && !isTldVariant) continue;
        if (!isDomainTypo && !hasLocalOverlap && !isTldVariant) continue;

        return true;
      }
    }

    return false;
  }, [attendance]);

  const shouldFlashSanitize = nameConflicts.length > 0 || hasEmailSuggestions;

  useEffect(() => {
    setConflictSelections((prev) => {
      const next = { ...prev };
      const emails = new Set(nameConflicts.map((conflict) => conflict.email));
      Object.keys(next).forEach((email) => {
        if (!emails.has(email)) {
          delete next[email];
        }
      });
      nameConflicts.forEach((conflict) => {
        const existing = prev[conflict.email];
        if (existing && conflict.names.some((name) => name.name === existing)) {
          next[conflict.email] = existing;
        } else if (conflict.names[0]) {
          next[conflict.email] = conflict.names[0].name;
        }
      });
      return next;
    });
  }, [nameConflicts]);

  const resolveNameConflict = async (email: string) => {
    const selectedName = conflictSelections[email];
    if (!selectedName) {
      toast({
        title: 'Choose a name',
        description: 'Select the correct name before applying changes.',
        variant: 'destructive',
      });
      return;
    }

    const eventIds = events.map((event) => event.id);
    if (eventIds.length === 0) return;

    setResolvingConflicts((prev) => ({ ...prev, [email]: true }));
    const { error } = await supabase
      .from('attendance_records')
      .update({ attendee_name: selectedName })
      .eq('attendee_email', email)
      .in('event_id', eventIds);
    setResolvingConflicts((prev) => ({ ...prev, [email]: false }));

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to update attendee names',
        variant: 'destructive',
      });
      return;
    }

    setAttendance((prev) =>
      prev.map((record) =>
        record.attendee_email === email ? { ...record, attendee_name: selectedName } : record,
      ),
    );
    toast({ title: 'Name updated' });
  };

  const isActualAttendance = (record: AttendanceRecord) => record.status !== 'excused';

  // Calculate analytics with deduplication (only count one attendance per member per event)
  const eventAttendanceData = events.map(event => {
    const eventAttendance = attendance.filter(a => a.event_id === event.id && isActualAttendance(a));
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
    const isExcused = record.status === 'excused';

    if (existing) {
      if (isExcused) {
        if (!existing.attendedEventIds.has(record.event_id)) {
          existing.excusedEventIds.add(record.event_id);
        }
      } else {
        existing.attendedEventIds.add(record.event_id);
        if (existing.excusedEventIds.has(record.event_id)) {
          existing.excusedEventIds.delete(record.event_id);
        }
      }
    } else {
      memberStatsMap.set(record.attendee_email, {
        email: record.attendee_email,
        name: record.attendee_name,
        eventsAttended: 0,
        eventsExcused: 0,
        attendanceRate: 0,
        attendedEventIds: new Set(isExcused ? [] : [record.event_id]),
        excusedEventIds: new Set(isExcused ? [record.event_id] : []),
      });
    }
  });

  const memberStats = Array.from(memberStatsMap.values())
    .map(member => ({
      ...member,
      eventsAttended: member.attendedEventIds.size,
      eventsExcused: member.excusedEventIds.size,
      attendanceRate: events.length > 0 ? Math.round((member.attendedEventIds.size / events.length) * 100) : 0,
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
    const eventEmails = new Set(
      attendance
        .filter(a => a.event_id === event.id && isActualAttendance(a))
        .map(a => a.attendee_email)
    );
    return sum + eventEmails.size;
  }, 0);
  const uniqueAttendees = memberStats.filter(member => member.eventsAttended > 0).length;
  const avgAttendance = events.length > 0 ? Math.round(totalUniqueAttendance / events.length) : 0;
  const getNotAttendedCount = (member: MemberStats) =>
    Math.max(0, events.length - member.eventsAttended - member.eventsExcused);

  // Events not in this season
  const eventsNotInSeason = allUserEvents.filter(e => e.season_id !== id);

  // Filter events list
  const filteredSeasonEvents = events.filter(e => 
    e.name.toLowerCase().includes(eventSearch.toLowerCase())
  );
  const filteredRemoveEvents = events.filter((e) =>
    e.name.toLowerCase().includes(removeEventSearch.toLowerCase()),
  );
  const filteredAddEvents = eventsNotInSeason.filter((e) =>
    e.name.toLowerCase().includes(addEventSearch.toLowerCase()),
  );

  // Member detail modal: events for selected member
  const getMemberEvents = () => {
    if (!selectedMember) return [];
    
    return events
      .map(event => {
        const attended = selectedMember.attendedEventIds.has(event.id);
        const excused = selectedMember.excusedEventIds.has(event.id);
        const status = attended ? 'attended' : excused ? 'excused' : 'not_attended';
        return { ...event, status };
      })
      .filter(event => {
        // Search filter
        if (memberEventSearch && !event.name.toLowerCase().includes(memberEventSearch.toLowerCase())) {
          return false;
        }
        // Attendance filter
        if (memberEventFilter === 'attended' && event.status !== 'attended') return false;
        if (memberEventFilter === 'excused' && event.status !== 'excused') return false;
        if (memberEventFilter === 'not_attended' && event.status !== 'not_attended') return false;
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
        ...sortedEvents.map((event) => {
          if (member.attendedEventIds.has(event.id)) {
            return escapeCSV('Attended');
          }
          if (member.excusedEventIds.has(event.id)) {
            return escapeCSV('Excused');
          }
          return escapeCSV('');
        }),
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

  const handleExportMembersCsv = () => {
    if (memberStats.length === 0) {
      toast({ title: 'No data', description: 'No member data to export', variant: 'destructive' });
      return;
    }

    const escapeCSV = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const rows = [...memberStats]
      .map((member) => ({
        ...member,
        notAttended: getNotAttendedCount(member),
      }))
      .sort((a, b) => b.eventsAttended - a.eventsAttended || a.name.localeCompare(b.name));

    const headers = ['Name', 'Email', 'Attended', 'Excused', 'Not Attended'];
    const csvRows = rows.map((member) =>
      [
        escapeCSV(member.name),
        escapeCSV(member.email),
        member.eventsAttended,
        member.eventsExcused,
        member.notAttended,
      ].join(','),
    );

    const csvContent = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${season?.name || 'season'}_members.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({ title: 'Exported', description: 'Member list exported successfully' });
  };

  if (authLoading || workspaceLoading || loading) {
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
            <span className="hidden sm:inline">Seasons</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to={`/seasons/${season.id}/sanitize`}>
              <Button
                variant="outline"
                size="sm"
                className={`gap-2 hover:border-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 ${
                  shouldFlashSanitize
                    ? 'border-emerald-400 text-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-200 animate-pulse'
                    : 'border-border text-foreground bg-background'
                }`}
                style={shouldFlashSanitize ? { animationDuration: '3s' } : undefined}
              >
                <Wand2 className="w-4 h-4" />
                Sanitize data
              </Button>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="w-4 h-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportMembersCsv} className="gap-2">
                  <FileText className="w-4 h-4" />
                  Members CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportAttendanceMatrix} className="gap-2">
                  <Download className="w-4 h-4" />
                  Attendance Matrix
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              onClick={openSeasonSettings}
              variant="outline"
              size="icon"
              title="Season settings"
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
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
                <div className="h-80">
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
                  <div className="space-y-3 max-h-80 overflow-y-auto">
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
                        <div className="flex items-center gap-3 text-sm font-semibold">
                          <span className="text-green-600" title="Attended">
                            {member.eventsAttended}
                          </span>
                          <span className="text-warning" title="Excused">
                            {member.eventsExcused}
                          </span>
                          <span className="text-muted-foreground" title="Not attended">
                            {getNotAttendedCount(member)}
                          </span>
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => setManageEventsOpen(true)}
            >
              Manage Events
            </Button>
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
                const eventEmails = new Set(
                  attendance
                    .filter(a => a.event_id === event.id && isActualAttendance(a))
                    .map(a => a.attendee_email)
                );
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
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
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
                variant={memberEventFilter === 'excused' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMemberEventFilter('excused')}
              >
                Excused ({selectedMember?.eventsExcused || 0})
              </Button>
              <Button
                variant={memberEventFilter === 'not_attended' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMemberEventFilter('not_attended')}
              >
                Not Attended ({selectedMember ? getNotAttendedCount(selectedMember) : 0})
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
                  <div
                    className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                      event.status === 'attended'
                        ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                        : event.status === 'excused'
                          ? 'bg-warning/10 text-warning'
                          : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {event.status === 'attended' ? (
                      <>
                        <Check className="w-4 h-4" />
                        Attended
                      </>
                    ) : event.status === 'excused' ? (
                      <>
                        <Minus className="w-4 h-4" />
                        Excused
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

      {/* Manage Events Modal */}
      <Dialog open={manageEventsOpen} onOpenChange={setManageEventsOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Manage Season Events</DialogTitle>
            <DialogDescription>
              Add events to or remove events from {season.name}.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Remove from Season</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search events in this season..."
                  value={removeEventSearch}
                  onChange={(e) => setRemoveEventSearch(e.target.value)}
                  className="pl-9 mt-1"
                />
              </div>
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {filteredRemoveEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No matching events found.</p>
                ) : (
                  filteredRemoveEvents.map((event) => (
                    <Card key={event.id} className="bg-muted/30">
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
                          onClick={() => handleRemoveEventFromSeason(event.id)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium">Add to Season</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search events to add..."
                  value={addEventSearch}
                  onChange={(e) => setAddEventSearch(e.target.value)}
                  className="pl-9 mt-1"
                />
              </div>
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {filteredAddEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No matching events found.</p>
                ) : (
                  filteredAddEvents.map((event) => (
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
                  ))
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Season Settings Modal */}
      <Dialog open={seasonSettingsOpen} onOpenChange={setSeasonSettingsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Season</DialogTitle>
            <DialogDescription>Update the season name and description.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="season-name">Name</Label>
              <Input
                id="season-name"
                value={seasonName}
                onChange={(e) => setSeasonName(e.target.value)}
                placeholder="Season name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="season-description">Description</Label>
              <Textarea
                id="season-description"
                value={seasonDescription}
                onChange={(e) => setSeasonDescription(e.target.value)}
                placeholder="Optional description"
                rows={4}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setSeasonSettingsOpen(false)}
                disabled={seasonSaving}
              >
                Cancel
              </Button>
              <Button onClick={handleSeasonUpdate} disabled={seasonSaving}>
                {seasonSaving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Name Conflict Resolution Modal */}
      <Dialog open={conflictsOpen} onOpenChange={setConflictsOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Resolve Name Conflicts</DialogTitle>
            <DialogDescription>
              Choose the correct name for each email. The selected name will replace all
              records in this season.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
            {nameConflicts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No name conflicts found.</p>
            ) : (
              nameConflicts.map((conflict) => (
                <Card key={conflict.email} className="bg-muted/30">
                  <CardContent className="py-4 space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium">{conflict.email}</p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex-1">
                        <Label className="text-sm font-medium">Correct name</Label>
                        <Select
                          value={conflictSelections[conflict.email] ?? ''}
                          onValueChange={(value) =>
                            setConflictSelections((prev) => ({
                              ...prev,
                              [conflict.email]: value,
                            }))
                          }
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select a name" />
                          </SelectTrigger>
                          <SelectContent>
                            {conflict.names.map((nameOption) => (
                              <SelectItem key={nameOption.name} value={nameOption.name}>
                                {nameOption.name} ({nameOption.count})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        onClick={() => resolveNameConflict(conflict.email)}
                        disabled={resolvingConflicts[conflict.email]}
                        className="sm:self-end"
                      >
                        {resolvingConflicts[conflict.email] ? 'Updating...' : 'Apply'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SeasonDetail;
