import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Mail, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useToast } from '@/hooks/use-toast';
import { usePageTitle } from '@/hooks/usePageTitle';
import WorkspaceLayout from '@/components/WorkspaceLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { sanitizeError } from '@/utils/errorHandler';

interface Season {
  id: string;
  name: string;
  description: string | null;
}

interface EventSummary {
  id: string;
  name: string;
  event_date: string;
}

type AttendanceStatus = 'verified' | 'suspicious' | 'cleared' | 'excused';

interface AttendanceRecord {
  id: string;
  event_id: string;
  attendee_email: string;
  attendee_name: string;
  status: AttendanceStatus;
}

interface EmailSuggestion {
  id: string;
  emailA: string;
  emailB: string;
  countA: number;
  countB: number;
  distance: number;
}

interface NameConflict {
  email: string;
  names: { name: string; count: number }[];
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

const getSuggestionKey = (emailA: string, emailB: string) =>
  [emailA, emailB].sort().join('::');

const SeasonSanitize = () => {
  usePageTitle('Season Sanitization - Attendly');
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const { currentWorkspace, loading: workspaceLoading } = useWorkspace();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [season, setSeason] = useState<Season | null>(null);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<'emails' | 'names'>('emails');

  const [suggestionSelections, setSuggestionSelections] = useState<Record<string, string>>({});
  const [suggestionOverrides, setSuggestionOverrides] = useState<Record<string, string>>({});
  const [suggestionOverrideOpen, setSuggestionOverrideOpen] = useState<Record<string, boolean>>({});
  const [mergeLoading, setMergeLoading] = useState<Record<string, boolean>>({});
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Record<string, boolean>>({});
  const [manualEmailA, setManualEmailA] = useState('');
  const [manualEmailB, setManualEmailB] = useState('');
  const [manualCorrectEmail, setManualCorrectEmail] = useState('');
  const [manualMergeLoading, setManualMergeLoading] = useState(false);

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

      setLoading(true);
      const [seasonRes, eventsRes] = await Promise.all([
        supabase
          .from('seasons')
          .select('*')
          .eq('id', id)
          .eq('workspace_id', currentWorkspace.id)
          .maybeSingle(),
        supabase
          .from('events')
          .select('id, name, event_date')
          .eq('season_id', id)
          .eq('workspace_id', currentWorkspace.id)
          .order('event_date', { ascending: true }),
      ]);

      if (seasonRes.error || eventsRes.error) {
        throw seasonRes.error || eventsRes.error;
      }

      if (seasonRes.data) {
        setSeason(seasonRes.data);
      }
      setEvents(eventsRes.data ?? []);

      const eventIds = (eventsRes.data ?? []).map((event) => event.id);
      if (eventIds.length === 0) {
        setAttendance([]);
        setLoading(false);
        return;
      }

      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance_records')
        .select('id, event_id, attendee_email, attendee_name, status')
        .in('event_id', eventIds);

      if (attendanceError) {
        throw attendanceError;
      }

      setAttendance((attendanceData ?? []) as AttendanceRecord[]);
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

  const eventIds = useMemo(() => events.map((event) => event.id), [events]);

  const emailStats = useMemo(() => {
    const map = new Map<string, number>();
    attendance.forEach((record) => {
      const normalized = normalizeEmail(record.attendee_email || '');
      if (!normalized) return;
      map.set(normalized, (map.get(normalized) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([email, count]) => ({ email, count }))
      .sort((a, b) => b.count - a.count || a.email.localeCompare(b.email));
  }, [attendance]);

  const emailCountLookup = useMemo(
    () => new Map(emailStats.map((entry) => [entry.email, entry.count])),
    [emailStats],
  );

  const emailOptions = useMemo(
    () => [...emailStats].sort((a, b) => a.email.localeCompare(b.email)),
    [emailStats],
  );

  const emailSuggestions = useMemo(() => {
    const entries = emailStats
      .map(({ email }) => {
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

    const suggestions: EmailSuggestion[] = [];
    const MAX_SUGGESTIONS = 24;
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

        suggestions.push({
          id: getSuggestionKey(a.email, b.email),
          emailA: a.email,
          emailB: b.email,
          countA: emailCountLookup.get(a.email) ?? 0,
          countB: emailCountLookup.get(b.email) ?? 0,
          distance: isTldVariant ? localDistance : localDistance + Math.min(domainDistance, 3),
        });

        if (suggestions.length >= MAX_SUGGESTIONS) {
          break;
        }
      }
      if (suggestions.length >= MAX_SUGGESTIONS) {
        break;
      }
    }

    return suggestions.sort(
      (a, b) => a.distance - b.distance || (b.countA + b.countB) - (a.countA + a.countB),
    );
  }, [emailStats, emailCountLookup]);

  const visibleSuggestions = useMemo(
    () => emailSuggestions.filter((suggestion) => !dismissedSuggestions[suggestion.id]),
    [emailSuggestions, dismissedSuggestions],
  );

  useEffect(() => {
    setSuggestionSelections((prev) => {
      const next: Record<string, string> = {};
      emailSuggestions.forEach((suggestion) => {
        const existing = prev[suggestion.id];
        if (existing === suggestion.emailA || existing === suggestion.emailB) {
          next[suggestion.id] = existing;
          return;
        }
        const defaultChoice = suggestion.countA >= suggestion.countB ? suggestion.emailA : suggestion.emailB;
        next[suggestion.id] = defaultChoice;
      });
      return next;
    });
  }, [emailSuggestions]);

  const applyEmailMerge = async (correctEmail: string, wrongEmail: string, loadingKey: string) => {
    if (!eventIds.length) return;
    if (!correctEmail || !wrongEmail || correctEmail === wrongEmail) {
      toast({
        title: 'Choose different emails',
        description: 'Select the correct email and the one to replace.',
        variant: 'destructive',
      });
      return;
    }

    setMergeLoading((prev) => ({ ...prev, [loadingKey]: true }));
    const { error } = await supabase
      .from('attendance_records')
      .update({ attendee_email: correctEmail })
      .eq('attendee_email', wrongEmail)
      .in('event_id', eventIds);
    setMergeLoading((prev) => ({ ...prev, [loadingKey]: false }));

    if (error) {
      toast({
        title: 'Merge failed',
        description: sanitizeError(error),
        variant: 'destructive',
      });
      return;
    }

    setAttendance((prev) =>
      prev.map((record) =>
        record.attendee_email === wrongEmail
          ? { ...record, attendee_email: correctEmail }
          : record,
      ),
    );
    toast({
      title: 'Emails merged',
      description: `${wrongEmail} → ${correctEmail}`,
    });
  };

  const handleSuggestionMerge = async (suggestion: EmailSuggestion) => {
    const overrideValue = suggestionOverrides[suggestion.id]?.trim();
    if (overrideValue) {
      const correctEmail = normalizeEmail(overrideValue);
      if (!correctEmail) {
        toast({
          title: 'Invalid email',
          description: 'Enter a valid email address.',
          variant: 'destructive',
        });
        return;
      }

      if (!eventIds.length) return;

      setMergeLoading((prev) => ({ ...prev, [suggestion.id]: true }));
      const { error } = await supabase
        .from('attendance_records')
        .update({ attendee_email: correctEmail })
        .in('attendee_email', [suggestion.emailA, suggestion.emailB])
        .in('event_id', eventIds);
      setMergeLoading((prev) => ({ ...prev, [suggestion.id]: false }));

      if (error) {
        toast({
          title: 'Merge failed',
          description: sanitizeError(error),
          variant: 'destructive',
        });
        return;
      }

      setAttendance((prev) =>
        prev.map((record) =>
          record.attendee_email === suggestion.emailA || record.attendee_email === suggestion.emailB
            ? { ...record, attendee_email: correctEmail }
            : record,
        ),
      );
      setSuggestionOverrides((prev) => ({ ...prev, [suggestion.id]: '' }));
      toast({
        title: 'Emails merged',
        description: `${suggestion.emailA}, ${suggestion.emailB} → ${correctEmail}`,
      });
      return;
    }

    const selected = suggestionSelections[suggestion.id];
    const correctEmail = selected ?? suggestion.emailA;
    const wrongEmail = correctEmail === suggestion.emailA ? suggestion.emailB : suggestion.emailA;
    await applyEmailMerge(correctEmail, wrongEmail, suggestion.id);
  };

  const handleManualMerge = async () => {
    const emailA = normalizeEmail(manualEmailA);
    const emailB = normalizeEmail(manualEmailB);
    if (!emailA || !emailB) {
      toast({
        title: 'Missing emails',
        description: 'Add both emails before merging.',
        variant: 'destructive',
      });
      return;
    }

    const correct = normalizeEmail(manualCorrectEmail);
    if (correct !== emailA && correct !== emailB) {
      toast({
        title: 'Choose the correct email',
        description: 'Pick which of the two emails should remain.',
        variant: 'destructive',
      });
      return;
    }

    const wrong = correct === emailA ? emailB : emailA;
    setManualMergeLoading(true);
    await applyEmailMerge(correct, wrong, 'manual');
    setManualMergeLoading(false);
    setManualEmailA('');
    setManualEmailB('');
    setManualCorrectEmail('');
  };

  const nameConflicts = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    attendance.forEach((record) => {
      const email = normalizeEmail(record.attendee_email || '');
      const name = record.attendee_name.trim();
      if (!email || !name) return;
      if (!map.has(email)) {
        map.set(email, new Map());
      }
      const nameCounts = map.get(email)!;
      nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
    });

    return Array.from(map.entries())
      .map(([email, namesMap]) => {
        const names = Array.from(namesMap.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
        return { email, names };
      })
      .filter((entry) => entry.names.length > 1)
      .sort((a, b) => a.email.localeCompare(b.email));
  }, [attendance]);

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

  const resolveNameConflict = async (conflict: NameConflict) => {
    const selectedName = conflictSelections[conflict.email];
    if (!selectedName) {
      toast({
        title: 'Choose a name',
        description: 'Select the correct name before applying changes.',
        variant: 'destructive',
      });
      return;
    }

    if (!eventIds.length) return;

    setResolvingConflicts((prev) => ({ ...prev, [conflict.email]: true }));
    const { error } = await supabase
      .from('attendance_records')
      .update({ attendee_name: selectedName })
      .eq('attendee_email', conflict.email)
      .in('event_id', eventIds);
    setResolvingConflicts((prev) => ({ ...prev, [conflict.email]: false }));

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
        normalizeEmail(record.attendee_email) === conflict.email
          ? { ...record, attendee_name: selectedName }
          : record,
      ),
    );
    toast({ title: 'Name updated' });
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
    <WorkspaceLayout title="Season sanitization">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <p className="text-sm text-muted-foreground">Season sanitization</p>
          <h1 className="text-2xl font-bold">{season.name}</h1>
          <p className="text-muted-foreground">
            Fix email typos and name conflicts so analytics stay accurate.
          </p>
        </div>
        <Link to={`/seasons/${season.id}`}>
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4" />
            Back to season
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-8 text-sm">
        <span
          className={`inline-flex h-7 w-7 items-center justify-center rounded-full border ${
            step === 'emails' ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'
          }`}
        >
          1
        </span>
        <span className={step === 'emails' ? 'font-semibold' : 'text-muted-foreground'}>
          Email typos
        </span>
        <ArrowRight className="w-4 h-4 text-muted-foreground" />
        <span
          className={`inline-flex h-7 w-7 items-center justify-center rounded-full border ${
            step === 'names' ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'
          }`}
        >
          2
        </span>
        <span className={step === 'names' ? 'font-semibold' : 'text-muted-foreground'}>
          Name conflicts
        </span>
      </div>

      {step === 'emails' ? (
        <div className="space-y-8">
          <Card className="bg-gradient-card">
            <CardContent className="py-6 space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="w-4 h-4" />
                {emailStats.length} unique emails • {emailSuggestions.length} suggested merges
              </div>

              {visibleSuggestions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No similar emails detected yet. You can still merge emails manually below.
                </p>
              ) : (
                <div className="grid gap-3">
                  {visibleSuggestions.map((suggestion) => {
                    const suggestionOptions = [
                      { email: suggestion.emailA, count: suggestion.countA },
                      { email: suggestion.emailB, count: suggestion.countB },
                    ].sort((a, b) => a.email.localeCompare(b.email));

                    return (
                      <Card key={suggestion.id} className="bg-background/60">
                        <CardContent className="py-4 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="space-y-1">
                              <p className="text-sm font-medium">Possible typo detected</p>
                              <p className="text-xs text-muted-foreground">
                                Distance {suggestion.distance} • {suggestion.countA + suggestion.countB} records
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setDismissedSuggestions((prev) => ({
                                    ...prev,
                                    [suggestion.id]: true,
                                  }))
                                }
                              >
                                Dismiss
                              </Button>
                              <Button
                                size="sm"
                                variant="hero"
                                onClick={() => handleSuggestionMerge(suggestion)}
                                disabled={mergeLoading[suggestion.id]}
                              >
                                {mergeLoading[suggestion.id] ? 'Merging...' : 'Merge'}
                              </Button>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                              Click the correct email
                            </Label>
                            <div className="grid gap-3 md:grid-cols-2">
                              {suggestionOptions.map((option) => {
                                const selected = suggestionSelections[suggestion.id] === option.email;
                                return (
                                  <button
                                    key={option.email}
                                    type="button"
                                    onClick={() =>
                                      setSuggestionSelections((prev) => ({
                                        ...prev,
                                        [suggestion.id]: option.email,
                                      }))
                                    }
                                    className={`rounded-md border p-3 text-left text-sm transition-colors ${
                                      selected
                                        ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
                                        : 'border-border hover:border-primary/40'
                                    }`}
                                  >
                                    <p className="font-medium">{option.email}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {option.count} records {selected ? '• Selected' : ''}
                                    </p>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          {!suggestionOverrideOpen[suggestion.id] ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="justify-start px-0"
                              onClick={() =>
                                setSuggestionOverrideOpen((prev) => ({
                                  ...prev,
                                  [suggestion.id]: true,
                                }))
                              }
                            >
                              Enter a different email
                            </Button>
                          ) : (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                                  Custom correct email
                                </Label>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    setSuggestionOverrideOpen((prev) => ({
                                      ...prev,
                                      [suggestion.id]: false,
                                    }))
                                  }
                                >
                                  Hide
                                </Button>
                              </div>
                              <Input
                                placeholder="correct@email.com"
                                value={suggestionOverrides[suggestion.id] ?? ''}
                                onChange={(event) =>
                                  setSuggestionOverrides((prev) => ({
                                    ...prev,
                                    [suggestion.id]: event.target.value,
                                  }))
                                }
                              />
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-card">
            <CardContent className="py-6 space-y-4">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-lg font-semibold">Manual merge</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Manually merge two emails when the suggestions miss a case.
              </p>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Email A</Label>
                    <Select value={manualEmailA} onValueChange={setManualEmailA}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose an email" />
                      </SelectTrigger>
                      <SelectContent>
                        {emailOptions.map((entry) => (
                          <SelectItem key={entry.email} value={entry.email}>
                            {entry.email} ({entry.count})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {manualEmailA && (
                      <p className="text-xs text-muted-foreground">
                        {emailCountLookup.get(normalizeEmail(manualEmailA)) ?? 0} records
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Email B</Label>
                    <Select value={manualEmailB} onValueChange={setManualEmailB}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose an email" />
                      </SelectTrigger>
                      <SelectContent>
                        {emailOptions
                          .filter((entry) => entry.email !== manualEmailA)
                          .map((entry) => (
                            <SelectItem key={entry.email} value={entry.email}>
                              {entry.email} ({entry.count})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {manualEmailB && (
                      <p className="text-xs text-muted-foreground">
                        {emailCountLookup.get(normalizeEmail(manualEmailB)) ?? 0} records
                      </p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Select the correct email</Label>
                  <Select value={manualCorrectEmail} onValueChange={setManualCorrectEmail}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose correct email" />
                    </SelectTrigger>
                    <SelectContent>
                      {manualEmailA && (
                        <SelectItem value={normalizeEmail(manualEmailA)}>
                          {normalizeEmail(manualEmailA)}
                        </SelectItem>
                      )}
                      {manualEmailB && (
                        <SelectItem value={normalizeEmail(manualEmailB)}>
                          {normalizeEmail(manualEmailB)}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleManualMerge} disabled={manualMergeLoading}>
                  {manualMergeLoading ? 'Merging...' : 'Merge emails'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={() => setStep('names')}>
              Continue to name conflicts
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <Card className="bg-gradient-card">
            <CardContent className="py-6 space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="w-4 h-4" />
                {nameConflicts.length} name conflicts detected
              </div>

              {nameConflicts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No name conflicts found. Your season data looks consistent.
                </p>
              ) : (
                <div className="space-y-3">
                  {nameConflicts.map((conflict) => (
                    <Card key={conflict.email} className="bg-background/60">
                      <CardContent className="py-4 space-y-3">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div>
                            <p className="text-sm font-medium">{conflict.email}</p>
                            <p className="text-xs text-muted-foreground">
                              {conflict.names.reduce((sum, item) => sum + item.count, 0)} records
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="hero"
                            onClick={() => resolveNameConflict(conflict)}
                            disabled={resolvingConflicts[conflict.email]}
                          >
                            {resolvingConflicts[conflict.email] ? 'Updating...' : 'Apply'}
                          </Button>
                        </div>
                        <Select
                          value={conflictSelections[conflict.email] ?? ''}
                          onValueChange={(value) =>
                            setConflictSelections((prev) => ({
                              ...prev,
                              [conflict.email]: value,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choose the correct name" />
                          </SelectTrigger>
                          <SelectContent>
                            {conflict.names.map((nameOption) => (
                              <SelectItem key={nameOption.name} value={nameOption.name}>
                                {nameOption.name} ({nameOption.count})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex items-center justify-between gap-3">
            <Button variant="outline" onClick={() => setStep('emails')}>
              Back to email typos
            </Button>
            <Link to={`/seasons/${season.id}`}>
              <Button variant="hero">Finish</Button>
            </Link>
          </div>
        </div>
      )}
    </WorkspaceLayout>
  );
};

export default SeasonSanitize;
