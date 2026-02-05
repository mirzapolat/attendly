import { Link } from 'react-router-dom';
import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    ArrowRight,
    Github,
    LogIn,
    Menu,
    Radio,
    Sparkles,
    X,
} from 'lucide-react';
import { usePageTitle } from '@/hooks/usePageTitle';
import AttendlyLogo from '@/components/AttendlyLogo';

const Index = () => {
    usePageTitle('Attendly by Mirza Polat');
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <div className="relative min-h-screen landing-minimal bg-[color:var(--lp-bg)] text-[color:var(--lp-ink)] overflow-hidden flex flex-col">
            <div className="pointer-events-none absolute -top-32 right-0 h-80 w-80 rounded-full blur-3xl opacity-40" style={{
                background: 'radial-gradient(circle, var(--lp-accent-soft) 0%, transparent 70%)',
            }} />
            <div className="pointer-events-none absolute -bottom-40 left-0 h-96 w-96 rounded-full blur-3xl opacity-30" style={{
                background: 'radial-gradient(circle, var(--lp-accent-fade) 0%, transparent 65%)',
            }} />

            <header className="relative z-10 px-4 sm:px-6 pt-8">
                <div className="container mx-auto flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="h-11 w-11">
                            <AttendlyLogo className="h-full w-full" />
                        </div>
                        <span className="text-base font-semibold tracking-tight sm:text-lg">Attendly</span>
                    </div>
                    <div className="hidden items-center gap-6 text-sm md:flex">
                        <div className="flex items-center gap-3">
                            <Link to="/features" className="text-[color:var(--lp-muted)] hover:text-[color:var(--lp-ink)] transition-colors">
                                Features
                            </Link>
                            <a
                                href="https://github.com/mirzapolat/attendly"
                                target="_blank"
                                rel="noreferrer"
                                className="text-[color:var(--lp-muted)] hover:text-[color:var(--lp-ink)] transition-colors"
                            >
                                GitHub
                            </a>
                        </div>
                        <div className="flex items-center gap-3">
                            <Link to="/auth">
                                <Button variant="outline" className="border-[color:var(--lp-border)] text-[color:var(--lp-ink)]">
                                    Sign In
                                </Button>
                            </Link>
                            <Link to="/auth?mode=signup">
                                <Button variant="hero" className="gap-2">
                                    Sign up
                                    <ArrowRight className="h-4 w-4" />
                                </Button>
                            </Link>
                        </div>
                    </div>
                    <div className="flex items-center md:hidden">
                        <Button
                            variant="outline"
                            size="icon"
                            className="border-[color:var(--lp-border)] text-[color:var(--lp-ink)]"
                            onClick={() => setMenuOpen(true)}
                            aria-label="Open menu"
                            title="Open menu"
                        >
                            <Menu className="h-5 w-5" />
                        </Button>
                    </div>
                </div>
            </header>

            <main className="relative z-10 flex-1 flex items-center">
                <section className="w-full px-4 sm:px-6 py-12 md:py-16">
                    <div className="container mx-auto grid gap-12 lg:grid-cols-[1.1fr_0.9fr] items-center">
                        <div>
                            <div
                                className="inline-flex items-center gap-2 rounded-full border border-[color:var(--lp-border)] px-3 py-1.5 sm:px-4 sm:py-2 text-[10px] sm:text-xs uppercase tracking-[0.15em] sm:tracking-[0.3em] text-[color:var(--lp-muted)] animate-soft-rise"
                                style={{ '--delay': '40ms' } as CSSProperties}
                            >
                                <Sparkles className="h-3 w-3 sm:h-4 sm:w-4 text-[color:var(--lp-accent)]" />
                                <span className="whitespace-nowrap">Easy and secure</span>
                            </div>
                            <h1
                                className="mt-6 text-4xl md:text-5xl lg:text-6xl font-semibold leading-tight tracking-tight animate-soft-rise"
                                style={{ '--delay': '90ms' } as CSSProperties}
                            >
                                Simplify attendance tracking{' '}
                                <span className="text-[color:var(--lp-accent)]">elegantly.</span>
                            </h1>
                            <p
                                className="mt-6 text-lg text-[color:var(--lp-muted)] max-w-xl animate-soft-rise"
                                style={{ '--delay': '140ms' } as CSSProperties}
                            >
                                Attendly simplifies attendance tracking for educators and students, providing a seamless experience that saves time and helps you do more of what matters most.
                            </p>
                            <div className="mt-8 flex flex-wrap gap-3 animate-soft-rise" style={{ '--delay': '190ms' } as CSSProperties}>
                                <Link to="/auth?mode=signup">
                                    <Button variant="hero" size="lg">
                                        Sign up -&gt;
                                    </Button>
                                </Link>
                                <Link to="/features">
                                    <Button variant="outline" size="lg" className="border-[color:var(--lp-border)] text-[color:var(--lp-ink)]">
                                        Features
                                    </Button>
                                </Link>
                            </div>
                        </div>

                        <div
                            className="relative mt-6 sm:mt-0 hidden lg:block animate-soft-rise"
                            style={{ '--delay': '160ms' } as CSSProperties}
                        >
                            <Card className="border border-[color:var(--lp-border)] bg-[color:var(--lp-card)] shadow-[var(--lp-shadow)]">
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-[color:var(--lp-muted)]">
                                        <span>Live check-in</span>
                                        <span className="rounded-full bg-[color:var(--lp-accent-soft)] px-2 py-1 text-[color:var(--lp-accent)]">
                                            Active
                                        </span>
                                    </div>
                                    <div className="mt-6 space-y-4">
                                        {[
                                            { name: 'Friday Workshop', count: '42 verified', status: 'Green zone' },
                                            { name: 'Guest Lecture', count: '5 excused', status: 'Excuse link' },
                                            { name: 'Study Group', count: '2 flagged', status: 'Review' },
                                        ].map((item) => (
                                            <div
                                                key={item.name}
                                                className="flex items-center justify-between rounded-2xl border border-[color:var(--lp-border)] bg-white/60 px-4 py-3"
                                            >
                                                <div>
                                                    <p className="font-medium text-[color:var(--lp-ink)]">{item.name}</p>
                                                    <p className="text-xs text-[color:var(--lp-muted)]">{item.count}</p>
                                                </div>
                                                <span className="text-xs text-[color:var(--lp-muted)]">{item.status}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-6 grid grid-cols-3 gap-2 text-xs text-[color:var(--lp-muted)]">
                                        {['Moderation', 'Excuse links', 'Analytics'].map((item) => (
                                            <div
                                                key={item}
                                                className="rounded-xl border border-[color:var(--lp-border)] bg-[color:var(--lp-bg)] px-3 py-2 text-center"
                                            >
                                                {item}
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                            <div className="absolute -bottom-6 left-2 sm:-left-6 flex items-center gap-2 rounded-2xl border border-[color:var(--lp-border)] bg-[color:var(--lp-accent-soft)] px-4 py-3 text-xs text-[color:var(--lp-ink)] shadow-[var(--lp-shadow)]">
                                <Radio className="h-4 w-4 text-[color:var(--lp-accent)]" />
                                <span className="text-[10px] uppercase tracking-[0.3em]">Live</span>
                            </div>
                        </div>
                    </div>
                </section>

            </main>

            <footer className="mt-auto px-4 sm:px-6 pt-8 pb-8">
                <div className="container mx-auto flex flex-col items-center gap-4 text-xs text-[color:var(--lp-muted)]">
                    <p>Built with ❤️ by Mirza Polat. Attendance data should feel trustworthy.</p>
                    <div className="flex items-center gap-4">
                        <Link to="/privacy" className="hover:text-[color:var(--lp-ink)] transition-colors underline">
                            Datenschutzerklärung
                        </Link>
                        <Link to="/impressum" className="hover:text-[color:var(--lp-ink)] transition-colors underline">
                            Impressum
                        </Link>
                    </div>
                </div>
            </footer>

            {menuOpen && (
                <div className="fixed inset-0 z-50 bg-[color:var(--lp-bg)]">
                    <div className="flex h-full flex-col px-4 sm:px-6 py-8">
                        <div className="container mx-auto flex h-full flex-col">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-11 w-11">
                                        <AttendlyLogo className="h-full w-full" />
                                    </div>
                                    <span className="text-base font-semibold tracking-tight sm:text-lg">Attendly</span>
                                </div>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="border-[color:var(--lp-border)] text-[color:var(--lp-ink)]"
                                    onClick={() => setMenuOpen(false)}
                                    aria-label="Close menu"
                                    title="Close menu"
                                >
                                    <X className="h-5 w-5" />
                                </Button>
                            </div>
                            <div className="mt-8 flex w-full gap-3">
                                <Link to="/auth" className="flex-1" onClick={() => setMenuOpen(false)}>
                                    <Button
                                        variant="outline"
                                        size="lg"
                                        className="w-full gap-2 border-[color:var(--lp-border)] text-[color:var(--lp-ink)]"
                                    >
                                        <LogIn className="h-4 w-4" />
                                        Sign In
                                    </Button>
                                </Link>
                                <Link to="/auth?mode=signup" className="flex-1" onClick={() => setMenuOpen(false)}>
                                    <Button variant="hero" size="lg" className="w-full gap-2">
                                        Sign up
                                        <ArrowRight className="h-4 w-4" />
                                    </Button>
                                </Link>
                            </div>
                            <div className="mt-10 flex w-full flex-col gap-5 text-lg pl-3">
                                <Link
                                    to="/features"
                                    className="flex items-center gap-3 text-[color:var(--lp-muted)] hover:text-[color:var(--lp-ink)] transition-colors"
                                    onClick={() => setMenuOpen(false)}
                                >
                                    <Sparkles className="h-5 w-5 text-[color:var(--lp-accent)]" />
                                    <span>Features</span>
                                </Link>
                                <a
                                    href="https://github.com/mirzapolat/attendly"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-3 text-[color:var(--lp-muted)] hover:text-[color:var(--lp-ink)] transition-colors"
                                    onClick={() => setMenuOpen(false)}
                                >
                                    <Github className="h-5 w-5 text-[color:var(--lp-accent)]" />
                                    <span>GitHub</span>
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Index;
