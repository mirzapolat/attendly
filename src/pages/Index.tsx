import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    ArrowRight,
    BarChart3,
    Calendar,
    Download,
    Fingerprint,
    Github,
    MapPin,
    QrCode,
    Shield,
    Sparkles,
    UserCheck,
    UserMinus,
    Users,
    Zap,
} from 'lucide-react';
import { usePageTitle } from '@/hooks/usePageTitle';

const FEATURE_CARDS = [
    {
        title: 'Rotating QR codes',
        description: 'Codes refresh every few seconds to prevent forwarding.',
        icon: QrCode,
    },
    {
        title: 'Location checks',
        description: 'Confirm on-site attendance with a venue radius.',
        icon: MapPin,
    },
    {
        title: 'Device fingerprinting',
        description: 'Stop repeat submissions from the same device.',
        icon: Fingerprint,
    },
    {
        title: 'Moderator links',
        description: 'Delegate check-ins without sharing admin access.',
        icon: Shield,
    },
    {
        title: 'Excuse links',
        description: 'Let members mark themselves excused with a secure link.',
        icon: UserMinus,
    },
    {
        title: 'Name conflict resolution',
        description: 'Catch duplicates before they affect reporting.',
        icon: UserCheck,
    },
    {
        title: 'Season analytics',
        description: 'Compare attendance trends across event series.',
        icon: BarChart3,
    },
    {
        title: 'Exports',
        description: 'Download attendance lists and matrices instantly.',
        icon: Download,
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

const Index = () => {
    usePageTitle('Attendly by Mirza Polat');

    return (
        <div className="min-h-screen landing-minimal bg-[color:var(--lp-bg)] text-[color:var(--lp-ink)] overflow-hidden">
            <div className="pointer-events-none absolute -top-32 right-0 h-80 w-80 rounded-full blur-3xl opacity-40" style={{
                background: 'radial-gradient(circle, var(--lp-accent-soft) 0%, transparent 70%)',
            }} />
            <div className="pointer-events-none absolute -bottom-40 left-0 h-96 w-96 rounded-full blur-3xl opacity-30" style={{
                background: 'radial-gradient(circle, var(--lp-accent-fade) 0%, transparent 65%)',
            }} />

            <header className="relative z-10 px-6 pt-8">
                <div className="container mx-auto flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-2xl bg-[color:var(--lp-accent-soft)] flex items-center justify-center">
                            <QrCode className="h-5 w-5 text-[color:var(--lp-accent)]" />
                        </div>
                        <span className="text-lg font-semibold tracking-tight">Attendly</span>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                        <div className="flex items-center gap-3">
                            <a href="#features" className="text-[color:var(--lp-muted)] hover:text-[color:var(--lp-ink)] transition-colors">
                                Features
                            </a>
                            <a href="#workflow" className="text-[color:var(--lp-muted)] hover:text-[color:var(--lp-ink)] transition-colors">
                                Workflow
                            </a>
                        </div>
                        <div className="flex items-center gap-3">
                            <a
                                href="https://github.com/mirzapolat/attendly"
                                target="_blank"
                                rel="noreferrer"
                            >
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="border-[color:var(--lp-border)] text-[color:var(--lp-ink)]"
                                    aria-label="Attendly on GitHub"
                                    title="Attendly on GitHub"
                                >
                                    <Github className="h-4 w-4" />
                                </Button>
                            </a>
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
                </div>
            </header>

            <main className="relative z-10">
                <section className="px-6 pb-16 pt-16 md:pt-24">
                    <div className="container mx-auto grid gap-12 lg:grid-cols-[1.1fr_0.9fr] items-center">
                        <div>
                            <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--lp-border)] px-4 py-2 text-xs uppercase tracking-[0.3em] text-[color:var(--lp-muted)] animate-fade-in">
                                <Sparkles className="h-4 w-4 text-[color:var(--lp-accent)]" />
                                Attendance, clean and accountable
                            </div>
                            <h1 className="mt-6 text-4xl md:text-5xl lg:text-6xl font-semibold leading-tight tracking-tight animate-fade-in" style={{ animationDelay: '80ms' }}>
                                Attendance that stays honest{' '}
                                <span className="text-[color:var(--lp-accent)]">without extra effort.</span>
                            </h1>
                            <p className="mt-6 text-lg text-[color:var(--lp-muted)] max-w-xl animate-fade-in" style={{ animationDelay: '140ms' }}>
                                Run events with rotating QR codes, location checks, and device fingerprinting.
                                See clean attendance data, resolve conflicts early, and share moderation safely.
                            </p>
                            <div className="mt-8 flex flex-wrap gap-3 animate-slide-up" style={{ animationDelay: '200ms' }}>
                                <Link to="/auth?mode=signup">
                                    <Button variant="hero" size="lg" className="gap-2">
                                        Create account
                                        <Zap className="h-4 w-4" />
                                    </Button>
                                </Link>
                                <Link to="/auth">
                                    <Button variant="outline" size="lg" className="border-[color:var(--lp-border)] text-[color:var(--lp-ink)]">
                                        View dashboard
                                    </Button>
                                </Link>
                            </div>
                            <div className="mt-10 grid gap-3 sm:grid-cols-3 text-sm text-[color:var(--lp-muted)]">
                                {[
                                    'QR rotates every 3 seconds',
                                    'Location verified check-ins',
                                    'Multi-submit protection',
                                ].map((item) => (
                                    <div key={item} className="rounded-2xl border border-[color:var(--lp-border)] bg-[color:var(--lp-card)] px-4 py-3">
                                        {item}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="relative">
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
                                        {['Moderation', 'Excuse links', 'Conflict review'].map((item) => (
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
                            <div className="absolute -bottom-6 -left-6 rounded-2xl border border-[color:var(--lp-border)] bg-[color:var(--lp-accent-soft)] px-4 py-3 text-xs text-[color:var(--lp-ink)] shadow-[var(--lp-shadow)]">
                                Live sync every 1s
                            </div>
                        </div>
                    </div>
                </section>

                <section id="features" className="px-6 py-20">
                    <div className="container mx-auto">
                        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-10">
                            <div>
                                <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--lp-muted)]">Features</p>
                                <h2 className="mt-2 text-3xl md:text-4xl font-semibold">Everything you need to verify attendance</h2>
                            </div>
                            <p className="text-[color:var(--lp-muted)] max-w-xl">
                                Keep participation clean with layered security, flexible delegation, and export-ready insights.
                            </p>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {FEATURE_CARDS.map((feature, index) => (
                                <div
                                    key={feature.title}
                                    className="rounded-2xl border border-[color:var(--lp-border)] bg-[color:var(--lp-card)] p-5 transition-colors hover:border-[color:var(--lp-accent)]/40 animate-slide-up"
                                    style={{ animationDelay: `${index * 60}ms` }}
                                >
                                    <feature.icon className="h-5 w-5 text-[color:var(--lp-accent)]" />
                                    <h3 className="mt-4 text-lg font-semibold">{feature.title}</h3>
                                    <p className="mt-2 text-sm text-[color:var(--lp-muted)]">{feature.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section id="workflow" className="px-6 pb-20">
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

                <section className="px-6 pb-20">
                    <div className="container mx-auto">
                        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                            <div className="rounded-3xl border border-[color:var(--lp-border)] bg-[color:var(--lp-card)] p-8">
                                <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--lp-muted)]">Delegation</p>
                                <h2 className="mt-3 text-2xl md:text-3xl font-semibold">Spread the workload safely</h2>
                                <p className="mt-4 text-[color:var(--lp-muted)]">
                                    Use moderation links to let trusted helpers manage check-ins.
                                    Excuse links handle exceptions automatically so you stay focused on the event.
                                </p>
                                <div className="mt-6 flex flex-wrap gap-2 text-xs">
                                    {['Moderator view', 'Excuse automation', 'Limited permissions'].map((item) => (
                                        <span key={item} className="rounded-full border border-[color:var(--lp-border)] bg-[color:var(--lp-bg)] px-3 py-1">
                                            {item}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div className="rounded-3xl border border-[color:var(--lp-border)] bg-[color:var(--lp-card)] p-8">
                                <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--lp-muted)]">Data hygiene</p>
                                <h2 className="mt-3 text-2xl md:text-3xl font-semibold">Clean data from the start</h2>
                                <p className="mt-4 text-[color:var(--lp-muted)]">
                                    Name conflict resolution, device checks, and location validation keep your reports reliable.
                                </p>
                                <div className="mt-6 flex flex-wrap gap-2 text-xs">
                                    {['Conflict review', 'Fingerprint alerts', 'Geo verification'].map((item) => (
                                        <span key={item} className="rounded-full border border-[color:var(--lp-border)] bg-[color:var(--lp-bg)] px-3 py-1">
                                            {item}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="px-6 pb-24">
                    <div className="container mx-auto">
                        <div className="rounded-3xl border border-[color:var(--lp-border)] bg-[color:var(--lp-card)] px-8 py-12 text-center shadow-[var(--lp-shadow)]">
                            <h2 className="text-3xl md:text-4xl font-semibold">Ready to simplify attendance?</h2>
                            <p className="mt-4 text-[color:var(--lp-muted)] max-w-2xl mx-auto">
                                Set up your first event, invite moderators, and export clean reports in minutes.
                            </p>
                            <div className="mt-6 flex flex-wrap justify-center gap-3">
                                <Link to="/auth?mode=signup">
                                    <Button variant="hero" size="lg" className="gap-2">
                                        Create account
                                        <ArrowRight className="h-4 w-4" />
                                    </Button>
                                </Link>
                                <Link to="/auth">
                                    <Button variant="outline" size="lg" className="border-[color:var(--lp-border)] text-[color:var(--lp-ink)]">
                                        Sign in
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="border-t border-[color:var(--lp-border)] px-6 py-8 text-center text-xs text-[color:var(--lp-muted)]">
                Built with ❤️ by Mirza Polat. Attendance data should feel trustworthy.
            </footer>
        </div>
    );
};

export default Index;
