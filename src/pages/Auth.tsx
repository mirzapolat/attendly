import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { QrCode, ArrowLeft } from 'lucide-react';
import { z } from 'zod';
import { usePageTitle } from '@/hooks/usePageTitle';
import { STORAGE_KEYS } from '@/constants/storageKeys';

const signInSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const signUpSchema = signInSchema.extend({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
});

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

  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      navigate('/workspaces');
    }
  }, [user, navigate]);

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
          if (data?.session) {
            toast({
              title: 'Welcome aboard!',
              description: 'Account created successfully. You are now signed in.',
            });
            // Navigation happens via useEffect detecting user change
          } else {
             toast({
              title: 'Account created',
              description: 'Please check your email to confirm your account before logging in.',
            });
          }
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

  const pageTitle = mode === 'signin' ? 'Sign In to Attendly' : 'Sign Up to Attendly';
  usePageTitle(pageTitle);

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
            <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center mx-auto mb-4">
              <QrCode className="w-7 h-7 text-primary-foreground" />
            </div>
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
