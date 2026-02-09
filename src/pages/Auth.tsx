import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';
import { z } from 'zod';
import { usePageTitle } from '@/hooks/usePageTitle';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import { OTPInput, SlotProps } from 'input-otp';
import { cn } from '@/lib/utils';
import AttendlyLogo from '@/components/AttendlyLogo';
import { useWorkspace } from '@/hooks/useWorkspace';

const signInSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const signUpSchema = signInSchema.extend({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
});

const OtpSlot = (props: SlotProps) => (
  <div
    className={cn(
      'relative flex h-12 w-10 items-center justify-center rounded-xl border border-border bg-background text-lg font-semibold transition-all',
      'text-foreground shadow-sm',
      props.isActive && 'border-primary ring-2 ring-primary/30'
    )}
  >
    <span className={cn('transition-opacity', props.char ? 'opacity-100' : 'opacity-30')}>
      {props.char ?? props.placeholderChar}
    </span>
  </div>
);

const Auth = () => {
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get('mode') === 'signup' ? 'signup' : 'signin';
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [signupPendingEmail, setSignupPendingEmail] = useState<string | null>(null);
  const [signupAutoConfirmed, setSignupAutoConfirmed] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [verificationSuccess, setVerificationSuccess] = useState(false);

  const { signIn, signUp, user } = useAuth();
  const {
    workspaces,
    currentWorkspace,
    loading: workspaceLoading,
    selectWorkspace,
  } = useWorkspace();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!user || signupPendingEmail || workspaceLoading) return;

    if (currentWorkspace) {
      navigate('/dashboard');
      return;
    }

    if (workspaces.length > 0) {
      selectWorkspace(workspaces[0].id);
      navigate('/dashboard');
      return;
    }

    navigate('/dashboard');
  }, [user, signupPendingEmail, workspaceLoading, currentWorkspace, workspaces, selectWorkspace, navigate]);

  const validateForm = () => {
    try {
      if (mode === 'signup') {
        signUpSchema.parse({ email, password, fullName });
      } else {
        signInSchema.parse({ email, password });
      }
      setErrors({});
      return true;
    } catch (err) {
      if (err instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        err.errors.forEach((error) => {
          if (error.path[0]) {
            newErrors[error.path[0] as string] = error.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);

    try {
      if (mode === 'signup') {
        const { data, error } = await signUp(email, password, fullName);
        if (error) {
          if (error.message.includes('already registered')) {
            toast({
              variant: 'destructive',
              title: 'Account exists',
              description: 'This email is already registered. Please sign in.',
            });
          } 
          else if (error.message.includes('Signups not allowed')) {
            toast({
              variant: 'destructive',
              title: 'Signups not allowed',
              description: 'New signups are currently deactivated by the system administrator. Please contact support for assistance.',
            });
          } else {
            toast({
              variant: 'destructive',
              title: 'Error',
              description: error.message,
            });
          }
        } else {
          localStorage.setItem(STORAGE_KEYS.welcome, 'signup');
          // Check if session was established (email confirmation disabled) or not (enabled)
          setSignupPendingEmail(email.trim());
          setSignupAutoConfirmed(Boolean(data?.session));
          setVerificationCode('');
          setVerificationError(null);
          setVerificationSuccess(false);
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          toast({
            variant: 'destructive',
            title: 'Sign in failed',
            description: 'Invalid email or password.',
          });
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      toast({
        variant: 'destructive',
        title: 'Email required',
        description: 'Enter your email above so we can send a reset link.',
      });
      return;
    }

    try {
      signInSchema.pick({ email: true }).parse({ email: trimmedEmail });
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast({
          variant: 'destructive',
          title: 'Invalid email',
          description: 'Please enter a valid email address first.',
        });
        return;
      }
    }

    setResetting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
      redirectTo: `${window.location.origin}/settings`,
    });
    setResetting(false);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Reset failed',
        description: error.message,
      });
      return;
    }

    toast({
      title: 'Check your email',
      description: 'We sent a password reset link to your inbox.',
    });
  };

  const verifyCode = async (rawCode: string) => {
    if (!signupPendingEmail || verifying) return;
    const trimmedCode = rawCode.trim();
    if (!trimmedCode) {
      setVerificationError('Enter the verification code from your email.');
      return;
    }

    setVerifying(true);
    setVerificationError(null);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: signupPendingEmail,
        token: trimmedCode,
        type: 'signup',
      });

      if (error) {
        setVerificationError(error.message);
        setVerificationSuccess(false);
        return;
      }

      setVerificationSuccess(true);
      setVerificationError(null);
      setSignupPendingEmail(null);
      setSignupAutoConfirmed(false);
      return;
    } catch (err) {
      setVerificationError(err instanceof Error ? err.message : 'Unable to verify code. Please try again.');
      setVerificationSuccess(false);
    } finally {
      setVerifying(false);
    }
  };

  const handleVerifyCode = async (event: React.FormEvent) => {
    event.preventDefault();
    await verifyCode(verificationCode);
  };

  useEffect(() => {
    if (!signupPendingEmail) return;
    if (verificationSuccess) return;
    if (verifying) return;
    if (verificationCode.trim().length === 6) {
      void verifyCode(verificationCode);
    }
  }, [signupPendingEmail, verificationCode, verificationSuccess, verifying]);

  const handleChangeEmail = () => {
    setSignupPendingEmail(null);
    setSignupAutoConfirmed(false);
    setVerificationCode('');
    setVerificationError(null);
    setVerificationSuccess(false);
    setMode('signup');
  };

  const pageTitle = signupPendingEmail
    ? 'Confirm your email - Attendly'
    : mode === 'signin'
      ? 'Sign In to Attendly'
      : 'Sign Up to Attendly';
  usePageTitle(pageTitle);

  if (signupPendingEmail) {
    const canContinue = signupAutoConfirmed || verificationSuccess;
    return (
      <div className="min-h-screen bg-gradient-subtle flex flex-col">
        <header className="p-6">
          <Button asChild variant="glass" size="sm" className="rounded-full px-3">
            <Link to="/">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
          </Button>
        </header>

        <main className="flex-1 flex items-center justify-center px-6 pb-12">
          <div className="w-full max-w-md animate-scale-in">
            <div className="rounded-2xl border border-border bg-background/90 p-8 shadow-lg">
              <div className="text-center mb-6">
                <AttendlyLogo className="mx-auto mb-4 h-12 w-12" />
                <h1 className="text-2xl font-bold">Confirm your email</h1>
                <p className="text-muted-foreground mt-2">
                  {signupAutoConfirmed
                    ? 'Your account is ready. If you received a verification code, enter it below to verify your email.'
                    : 'We sent a confirmation email to '}
                  {!signupAutoConfirmed && (
                    <span className="font-medium text-foreground">{signupPendingEmail}</span>
                  )}
                  {!signupAutoConfirmed && '. Follow the link or enter the code below.'}
                </p>
              </div>

              <form onSubmit={handleVerifyCode} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="verificationCode" className="block text-center">
                    Verification code
                  </Label>
                  <OTPInput
                    id="verificationCode"
                    value={verificationCode}
                    onChange={setVerificationCode}
                    maxLength={6}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    containerClassName="flex items-center justify-center gap-2"
                    render={({ slots }) => (
                      <>
                        {slots.map((slot, idx) => (
                          <OtpSlot key={idx} {...slot} />
                        ))}
                      </>
                    )}
                  />
                </div>

                {verificationError && (
                  <p className="text-sm text-destructive">{verificationError}</p>
                )}
                {verificationSuccess && (
                  <p className="text-sm text-success">Email confirmed. You’re all set.</p>
                )}

                <Button type="submit" className="w-full" size="lg" disabled={verifying}>
                  {verifying ? 'Verifying…' : 'Verify email'}
                </Button>
              </form>

              <div className="mt-6 flex flex-col gap-3 text-sm text-muted-foreground">
                {canContinue && (
                  <Button
                    type="button"
                    className="w-full"
                    onClick={() => {
                      setSignupPendingEmail(null);
                      setSignupAutoConfirmed(false);
                      navigate('/dashboard');
                    }}
                  >
                    Continue to workspace
                  </Button>
                )}
                <p>Didn’t receive the email? Check spam or use a different address.</p>
                <Button type="button" variant="outline" onClick={handleChangeEmail}>
                  Use a different email
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setSignupPendingEmail(null);
                    setSignupAutoConfirmed(false);
                    setMode('signin');
                  }}
                >
                  Back to sign in
                </Button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle flex flex-col">
      <header className="p-6">
        <Button asChild variant="glass" size="sm" className="rounded-full px-3">
          <Link to="/">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
        </Button>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 pb-12">
        <div className="w-full max-w-sm animate-scale-in">
          <div className="text-center mb-8">
            <AttendlyLogo className="mx-auto mb-4 h-12 w-12" />
            <h1 className="text-2xl font-bold">
              {mode === 'signin' ? 'Welcome back' : 'Create account'}
            </h1>
            <p className="text-muted-foreground mt-1">
              {mode === 'signin' ? 'Sign in to your account' : 'Start tracking attendance'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe"
                  className={errors.fullName ? 'border-destructive' : ''}
                />
                {errors.fullName && (
                  <p className="text-sm text-destructive">{errors.fullName}</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={errors.email ? 'border-destructive' : ''}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={errors.password ? 'border-destructive' : ''}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password}</p>
              )}
            </div>
            {mode === 'signin' && (
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-sm text-primary hover:underline font-medium"
                  disabled={resetting}
                >
                  {resetting ? 'Sending reset link…' : 'Forgot password?'}
                </button>
              </div>
            )}

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              type="button"
              onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
              className="text-primary hover:underline font-medium"
            >
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </main>
    </div>
  );
};

export default Auth;
