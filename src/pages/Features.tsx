import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowRight,
    BadgeCheck,
    BarChart3,
    Calendar,
    ClipboardList,
    Layers,
    Mail,
    MapPin,
    Menu,
    Palette,
    QrCode,
    Shield,
    Sparkles,
    UserCheck,
    UserMinus,
    Users,
    X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { usePageTitle } from '@/hooks/usePageTitle';

const FEATURE_CATEGORIES = [
    {
        title: 'Workspace foundations',
        summary: 'Bring every team, season, and roster under one organized home base.',
        icon: Layers,
        features: [
            {
                title: 'Workspaces',
                description: 'Organize teams, members, and seasons under one workspace with shared settings.',
                icon: Layers,
            },
            {
                title: 'Custom branding',
                description: 'Apply a logo, workspace name, and accent color so every check-in feels cohesive.',
                icon: Palette,
            },
            {
                title: 'Member directories',
                description: 'Keep rosters tidy with searchable member lists and status at a glance.',
                icon: Users,
            },
        ],
    },
    {
        title: 'Secure check-ins',
        summary: 'Protect attendance verification with layered safeguards and real-time validation.',
        icon: QrCode,
        features: [
            {
                title: 'Rotating QR codes',
                description: 'QR codes refresh every few seconds so screenshots cannot be reused.',
                icon: QrCode,
            },
            {
                title: 'Location checks',
                description: 'Confirm on-site attendance with venue radius verification.',
                icon: MapPin,
            },
            {
                title: 'Live check-in status',
                description: 'Track verified attendance in real time with clear attendance states.',
                icon: BadgeCheck,
            },
        ],
    },
    {
        title: 'Delegation & exceptions',
        summary: 'Share the workload without sacrificing control or audit trails.',
        icon: Shield,
        features: [
            {
                title: 'Moderator links',
                description: 'Delegate check-ins to trusted helpers without giving full admin access.',
                icon: Shield,
            },
            {
                title: 'Excuse links',
                description: 'Let members mark themselves excused with secure, time-bound links.',
                icon: UserMinus,
            },
            {
                title: 'Event oversight',
                description: 'Monitor moderation activity and exceptions from a centralized dashboard.',
                icon: ClipboardList,
            },
        ],
    },
    {
        title: 'Data hygiene & integrity',
        summary: 'Keep your reporting accurate by catching duplicates and anomalies early.',
        icon: UserCheck,
        features: [
            {
                title: 'Email typo detection',
                description: 'Spot similar email addresses and merge typos before analytics drift.',
                icon: Mail,
            },
            {
                title: 'Name conflict resolution',
                description: 'Resolve duplicate names tied to the same email address quickly.',
                icon: UserCheck,
            },
            {
                title: 'Audit-friendly logs',
                description: 'Maintain a clear history of updates for reliable attendance records.',
                icon: ClipboardList,
            },
        ],
    },
    {
        title: 'Insights & growth',
        summary: 'Measure season momentum and understand participation trends across time.',
        icon: BarChart3,
        features: [
            {
                title: 'Season analytics',
                description: 'Compare attendance trends across recurring event series and cohorts.',
                icon: BarChart3,
            },
            {
                title: 'Instant exports',
                description: 'Download attendance reports the moment an event wraps up.',
                icon: ClipboardList,
            },
            {
                title: 'Participation trends',
                description: 'Spot spikes or drop-offs so you can adjust programming quickly.',
                icon: Sparkles,
            },
        ],
    },
];

const WORKFLOW_STEPS = [
    {
        title: 'Create the event',
        description: 'Set the date, venue, and security rules in minutes.',
        icon: Calendar,
    },
    {
        title: 'Share the QR',
        description: 'Display the rotating QR code on a screen or projector.',
        icon: QrCode,
    },
    {
        title: 'Track attendance',
        description: 'See verified check-ins and export reports instantly.',
        icon: Users,
    },
];

const Features = () => {
    usePageTitle('Attendly features');
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <div className="min-h-screen landing-minimal bg-[color:var(--lp-bg)] text-[color:var(--lp-ink)] overflow-hidden">
            <div
                className="pointer-events-none absolute -top-32 right-0 h-80 w-80 rounded-full blur-3xl opacity-40"
                style={{ background: 'radial-gradient(circle, var(--lp-accent-soft) 0%, transparent 70%)' }}
            />
            <div
                className="pointer-events-none absolute -bottom-40 left-0 h-96 w-96 rounded-full blur-3xl opacity-30"
                style={{ background: 'radial-gradient(circle, var(--lp-accent-fade) 0%, transparent 65%)' }}
            />

            <header className="relative z-10 px-4 sm:px-6 pt-8">
                <div className="container mx-auto flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-2xl bg-[color:var(--lp-accent-soft)] flex items-center justify-center">
                            <QrCode className="h-5 w-5 text-[color:var(--lp-accent)]" />
                        </div>
                        <Link to="/" className="text-lg font-semibold tracking-tight">
                            Attendly by Mirza Polat
                        </Link>
                    </div>
                    <div className="hidden items-center gap-6 text-sm md:flex">
                        <div className="flex items-center gap-3">
                            <Link to="/" className="text-[color:var(--lp-muted)] hover:text-[color:var(--lp-ink)] transition-colors">
                                Home
                            </Link>
                        </div>
                        <div className="flex items-center gap-3">
                            <Link to="/auth">
                                <Button variant="outline" className="border-[color:var(--lp-border)] text-[color:var(--lp-ink)]">
                                    Sign In
                                </Button>
                            </Link>
                            <Link to="/auth?mode=signup">
                                <Button variant="hero" className="gap-2">
                                    Start now
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

            <main className="relative z-10">
                <section className="px-4 sm:px-6 pb-12 pt-16 md:pt-24">
                    <div className="container mx-auto grid gap-10 lg:grid-cols-[1.1fr_0.9fr] items-center">
                        <div>
                            <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--lp-border)] px-3 py-1.5 sm:px-4 sm:py-2 text-[10px] sm:text-xs uppercase tracking-[0.15em] sm:tracking-[0.3em] text-[color:var(--lp-muted)] animate-fade-in">
                                <Sparkles className="h-3 w-3 sm:h-4 sm:w-4 text-[color:var(--lp-accent)]" />
                                <span className="whitespace-nowrap">Feature deep dive</span>
                            </div>
                            <h1
                                className="mt-6 text-4xl md:text-5xl lg:text-6xl font-semibold leading-tight tracking-tight animate-fade-in"
                                style={{ animationDelay: '80ms' }}
                            >
                                Everything Attendly offers, grouped for quick scanning.
                            </h1>
                            <p className="mt-6 text-lg text-[color:var(--lp-muted)] max-w-xl animate-fade-in" style={{ animationDelay: '140ms' }}>
                                Explore the full feature set, from secure check-ins to analytics, with details on how each category keeps
                                attendance trustworthy.
                            </p>
                            <div className="mt-8 flex flex-wrap gap-3 animate-slide-up" style={{ animationDelay: '200ms' }}>
                                <Link to="/auth?mode=signup">
                                    <Button variant="hero" size="lg">
                                        Start now -&gt;
                                    </Button>
                                </Link>
                                <Link to="/">
                                    <Button variant="outline" size="lg" className="border-[color:var(--lp-border)] text-[color:var(--lp-ink)]">
                                        Back to home
                                    </Button>
                                </Link>
                            </div>
                        </div>

                        <Card className="border border-[color:var(--lp-border)] bg-[color:var(--lp-card)] shadow-[var(--lp-shadow)]">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-[color:var(--lp-muted)]">
                                    <span>Feature highlights</span>
                                    <span className="rounded-full bg-[color:var(--lp-accent-soft)] px-2 py-1 text-[color:var(--lp-accent)]">
                                        Updated
                                    </span>
                                </div>
                                <div className="mt-6 space-y-4">
                                    {[
                                        { name: 'Secure check-ins', detail: 'Rotating QR + geo checks' },
                                        { name: 'Delegation tools', detail: 'Moderator + excuse links' },
                                        { name: 'Clean analytics', detail: 'Conflict & typo detection' },
                                    ].map((item) => (
                                        <div
                                            key={item.name}
                                            className="flex items-center justify-between rounded-2xl border border-[color:var(--lp-border)] bg-white/60 px-4 py-3"
                                        >
                                            <div>
                                                <p className="font-medium text-[color:var(--lp-ink)]">{item.name}</p>
                                                <p className="text-xs text-[color:var(--lp-muted)]">{item.detail}</p>
                                            </div>
                                            <Sparkles className="h-4 w-4 text-[color:var(--lp-accent)]" />
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-6 grid grid-cols-3 gap-2 text-xs text-[color:var(--lp-muted)]">
                                    {['Workspaces', 'Analytics', 'Security'].map((item) => (
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
                    </div>
                </section>

                <section className="px-4 sm:px-6 py-16">
                    <div className="container mx-auto">
                        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-10">
                            <div>
                                <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--lp-muted)]">Features</p>
                                <h2 className="mt-2 text-3xl md:text-4xl font-semibold">Grouped by the way teams use Attendly</h2>
                            </div>
                            <p className="text-[color:var(--lp-muted)] max-w-xl">
                                Each category expands on what you can do, so you can spot the exact tools your team needs.
                            </p>
                        </div>
                        <div className="grid gap-6">
                            {FEATURE_CATEGORIES.map((category, index) => (
                                <div
                                    key={category.title}
                                    className="rounded-3xl border border-[color:var(--lp-border)] bg-[color:var(--lp-card)] p-6 md:p-8 animate-slide-up"
                                    style={{ animationDelay: `${index * 80}ms` }}
                                >
                                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                        <div>
                                            <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--lp-border)] px-3 py-1 text-xs uppercase tracking-[0.2em] text-[color:var(--lp-muted)]">
                                                <category.icon className="h-4 w-4 text-[color:var(--lp-accent)]" />
                                                {category.title}
                                            </div>
                                            <h3 className="mt-4 text-2xl font-semibold">{category.title}</h3>
                                            <p className="mt-3 text-[color:var(--lp-muted)] max-w-2xl">{category.summary}</p>
                                        </div>
                                        <div className="mt-4 md:mt-0 rounded-2xl border border-[color:var(--lp-border)] bg-[color:var(--lp-bg)] px-4 py-3 text-xs uppercase tracking-[0.2em] text-[color:var(--lp-muted)]">
                                            {category.features.length} capabilities
                                        </div>
                                    </div>
                                    <div className="mt-6 grid gap-4 md:grid-cols-3">
                                        {category.features.map((feature) => (
                                            <div
                                                key={feature.title}
                                                className="rounded-2xl border border-[color:var(--lp-border)] bg-[color:var(--lp-bg)] p-5 transition-colors hover:border-[color:var(--lp-accent)]/40"
                                            >
                                                <feature.icon className="h-5 w-5 text-[color:var(--lp-accent)]" />
                                                <h4 className="mt-4 text-lg font-semibold">{feature.title}</h4>
                                                <p className="mt-2 text-sm text-[color:var(--lp-muted)]">{feature.description}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="px-4 sm:px-6 pb-20">
                    <div className="container mx-auto">
                        <div className="rounded-3xl border border-[color:var(--lp-border)] bg-[color:var(--lp-card)] px-6 py-10">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--lp-muted)]">Workflow</p>
                                    <h2 className="mt-2 text-2xl md:text-3xl font-semibold">From setup to insights in minutes</h2>
                                </div>
                                <Link to="/auth?mode=signup">
                                    <Button variant="outline" className="border-[color:var(--lp-border)] text-[color:var(--lp-ink)]">
                                        Try it now
                                    </Button>
                                </Link>
                            </div>
                            <div className="mt-8 grid gap-4 md:grid-cols-3">
                                {WORKFLOW_STEPS.map((step, index) => (
                                    <div
                                        key={step.title}
                                        className="rounded-2xl border border-[color:var(--lp-border)] bg-[color:var(--lp-bg)] p-5"
                                    >
                                        <div className="flex items-center justify-between">
                                            <step.icon className="h-5 w-5 text-[color:var(--lp-accent)]" />
                                            <span className="text-xs text-[color:var(--lp-muted)]">0{index + 1}</span>
                                        </div>
                                        <h3 className="mt-4 font-semibold">{step.title}</h3>
                                        <p className="mt-2 text-sm text-[color:var(--lp-muted)]">{step.description}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="border-t border-[color:var(--lp-border)] px-4 sm:px-6 py-8">
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
                                    <div className="h-11 w-11 rounded-2xl bg-[color:var(--lp-accent-soft)] flex items-center justify-center">
                                        <QrCode className="h-5 w-5 text-[color:var(--lp-accent)]" />
                                    </div>
                                    <span className="text-lg font-semibold tracking-tight">Attendly</span>
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
                            <div className="mt-12 flex max-w-sm flex-col gap-5 text-lg">
                                <Link
                                    to="/"
                                    className="text-[color:var(--lp-muted)] hover:text-[color:var(--lp-ink)] transition-colors"
                                    onClick={() => setMenuOpen(false)}
                                >
                                    Home
                                </Link>
                            </div>
                            <div className="mt-auto flex w-full flex-col gap-3">
                                <Link to="/auth" onClick={() => setMenuOpen(false)}>
                                    <Button variant="outline" size="lg" className="w-full border-[color:var(--lp-border)] text-[color:var(--lp-ink)]">
                                        Sign In
                                    </Button>
                                </Link>
                                <Link to="/auth?mode=signup" onClick={() => setMenuOpen(false)}>
                                    <Button variant="hero" size="lg" className="w-full gap-2">
                                        Start now
                                        <ArrowRight className="h-4 w-4" />
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Features;
