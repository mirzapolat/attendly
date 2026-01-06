import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { applyThemeColor, useThemeColor } from '@/hooks/useThemeColor';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { z } from 'zod';
import { sanitizeError } from '@/utils/errorHandler';

interface EventInfo {
  id: string;
  name: string;
  event_date: string;
  theme_color?: string | null;
}

const excuseSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Please enter a valid email').max(255),
});

type SubmitState = 'loading' | 'form' | 'success' | 'error' | 'expired' | 'inactive';

const Excuse = () => {
  const { eventId, token } = useParams<{ eventId: string; token: string }>();
  const { themeColor } = useThemeColor();
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitState, setSubmitState] = useState<SubmitState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [eventThemeColor, setEventThemeColor] = useState<string | null>(null);

  useEffect(() => {
    if (eventThemeColor) {
      applyThemeColor(eventThemeColor);
      return () => applyThemeColor(themeColor);
    }

    applyThemeColor(themeColor);
  }, [eventThemeColor, themeColor]);

  useEffect(() => {
    if (!eventId || !token) return;

    setEvent(null);
    setName('');
    setEmail('');
    setErrors({});
    setErrorMessage(null);
    setEventThemeColor(null);
    setSubmitState('loading');

    startExcuseFlow();
  }, [eventId, token]);

  const resolveStartErrorMessage = (reason?: string | null): string => {
    switch (reason) {
      case 'missing_migrations':
        return "Excuse links aren't fully configured yet. Ask the organizer to run the latest database migrations.";
      case 'link_expired':
        return 'This excuse link has expired.';
      case 'link_inactive':
        return 'This excuse link has been deactivated.';
      case 'link_not_found':
        return 'This excuse link is invalid.';
      default:
        return 'Unable to load this excuse link right now. Please try again later.';
    }
  };

  const startExcuseFlow = async () => {
    if (!eventId || !token) return;

    const { data, error } = await supabase.functions.invoke('excuse-start', {
      body: { eventId, token },
    });

    if (error || !data?.authorized || !data?.event) {
      const reason = data?.reason ?? null;
      if (reason === 'link_expired') {
        setSubmitState('expired');
      } else if (reason === 'link_inactive') {
        setSubmitState('inactive');
      } else {
        setSubmitState('error');
      }
      setErrorMessage(resolveStartErrorMessage(reason));
      return;
    }

    setEvent(data.event as EventInfo);
    setEventThemeColor((data.event as EventInfo).theme_color ?? 'default');
    setSubmitState('form');
  };

  const submitExcuse = async () => {
    setErrors({});
    setErrorMessage(null);

    try {
      const parsed = excuseSchema.parse({ name, email });
      setSubmitState('loading');

      const { data, error } = await supabase.functions.invoke('excuse-submit', {
        body: {
          eventId,
          token,
          attendeeName: parsed.name.trim(),
          attendeeEmail: parsed.email.trim().toLowerCase(),
        },
      });

      if (error || !data?.success) {
        const reason = data?.reason ?? 'server_error';
        if (reason === 'link_expired') {
          setSubmitState('expired');
          setErrorMessage(resolveStartErrorMessage('link_expired'));
          return;
        }
        if (reason === 'link_inactive') {
          setSubmitState('inactive');
          setErrorMessage(resolveStartErrorMessage('link_inactive'));
          return;
        }
        setSubmitState('error');
        setErrorMessage(resolveStartErrorMessage(reason));
        return;
      }

      setSubmitState('success');
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of error.issues) {
          fieldErrors[issue.path[0] as string] = issue.message;
        }
        setErrors(fieldErrors);
        setSubmitState('form');
        return;
      }
      setErrorMessage(sanitizeError(error));
      setSubmitState('error');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center px-4 py-10">
      <Card className="w-full max-w-xl bg-gradient-card">
        <CardHeader>
          <CardTitle>Excused Attendance</CardTitle>
          {event ? (
            <CardDescription>
              {event.name} • {format(new Date(event.event_date), 'PPP p')}
            </CardDescription>
          ) : (
            <CardDescription>Submit your excuse for this event</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {submitState === 'loading' && (
            <p className="text-sm text-muted-foreground">Loading...</p>
          )}

          {submitState === 'form' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Submit your name and email to be marked as excused for this event.
              </p>
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                />
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>
              <Button onClick={submitExcuse} className="w-full">
                Submit Excuse
              </Button>
            </div>
          )}

          {submitState === 'success' && (
            <div className="text-center py-8 space-y-3">
              <CheckCircle className="w-10 h-10 text-success mx-auto" />
              <p className="text-lg font-semibold">Excuse submitted</p>
              <p className="text-sm text-muted-foreground">
                You have been marked as excused for this event.
              </p>
            </div>
          )}

          {(submitState === 'error' ||
            submitState === 'expired' ||
            submitState === 'inactive') && (
            <div className="text-center py-8 space-y-3">
              <AlertTriangle className="w-10 h-10 text-warning mx-auto" />
              <p className="text-lg font-semibold">Unable to submit excuse</p>
              <p className="text-sm text-muted-foreground">
                {errorMessage ?? 'Please contact the organizer for a new link.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Excuse;
