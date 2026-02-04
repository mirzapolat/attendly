import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowRight,
    BadgeCheck,
    BarChart3,
    ClipboardList,
    Home,
    Layers,
    LogIn,
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
import { usePageTitle } from '@/hooks/usePageTitle';

const FEATURE_STEPS = [
    {
        step: '01',
        title: 'Set up your workspace',
        summary: 'Workspaces are where all your events and Analytics live. Invite your team members and start to collaborate on the same events and share the same analytics. A workspace can represent your organization, department, or any group you want to manage together.',
        preview: 'Workspaces, custom branding and all your team members.',
        features: [
            {
                title: 'Workspaces',
                description: 'Group events and analytics under a shared workspace. Keep everything tidy by creating separate workspaces for different teams or departments.',
                icon: Layers,
            },
            {
                title: 'Custom branding',
                description: 'Add your own logo and colors to match your organization’s style. Create a familiar experience for your attendees.',
                icon: Palette,
            },
            {
                title: 'Invite your team',
                description: 'Invite as many team members as you need to help manage events. Every member gets their own login and has access to shared data.',
                icon: Users,
            },
        ],
    },
    {
        step: '02',
        title: 'Create your first event',
        summary: 'Easily set up events with just a few details. When it’s time to check in, attendees can use their phones to scan a rotating QR code at the venue. Our security features ensure that only people who are actually there get marked as present.',
        preview: 'Rotating QR codes and live check-in status.',
        features: [
            {
                title: 'Rotating QR codes',
                description: 'QR codes refresh every few seconds so links can’t be shared or screenshotted. Attendees simply scan the code with their phone camera to check in quickly.',
                icon: QrCode,
            },
            {
                title: 'Security features',
                description: 'Confirm on-site attendance with our optional security checks. This ensures only those physically present are marked as attended and no one can game the system.',
                icon: Shield,
            },
            {
                title: 'Live check-in status',
                description: 'See real-time attendance updates as people check in. Start and stop check-ins whenever you need to, with instant visibility into who’s arrived.',
                icon: BadgeCheck,
            },
        ],
    },
    {
        step: '03',
        title: 'Delegate the workload',
        summary: 'Share the workload by giving trusted team members access to help with check-ins and moderation. You can also monitor all moderation activity from a central dashboard to ensure everything runs smoothly.',
        preview: 'Use moderator links and let team members help out.',
        features: [
            {
                title: 'Moderator links',
                description: 'With moderator links even people without an account can help manage check-ins and moderate attendance temporarily. You can give and revoke access anytime. and control which information they can see.',
                icon: Users,
            },
            {
                title: 'Excuse links',
                description: 'Let people excuse themselves if they can’t make it using excuse links. This way you can keep your attendance data accurate and up to date without having to do it all yourself.',
                icon: UserMinus,
            }
        ],
    },
    {
        step: '04',
        title: 'Keep clean records',
        summary: 'Catch and fix common issues like email typos and duplicate names before they pollute your attendance data. With clear audit logs, you can always see who made changes and when, so you can trust your records.',
        preview: 'Email typo detection and name conflict resolution.',
        features: [
            {
                title: 'Email typo detection',
                description: 'Spot and correct common email typos on the spot. This helps ensure your attendance records are accurate and that attendees receive any follow-up communications without issues.',
                icon: Mail,
            },
            {
                title: 'Name conflict resolution',
                description: 'Resolve duplicate or similar names during check-in to keep your attendance data clean. This way you can avoid confusion and ensure each attendee is counted correctly.',
                icon: UserCheck,
            }
        ],
    },
    {
        step: '05',
        title: 'Export results',
        summary: 'Get insights into your attendance trends with our analytics dashboard. You can easily export attendance reports right after your event ends, so you can share results with your team or stakeholders without any hassle.',
        preview: 'Season analytics, exports, participation trends.',
        features: [
            {
                title: 'Event series analytics',
                description: 'Track attendance trends across multiple events in a series. This helps you understand how your attendance is evolving over time and identify patterns or areas for improvement.',
                icon: BarChart3,
            },
            {
                title: 'Instant exports as CSV',
                description: 'Want to do your own analysis or share attendance data with others? Instantly export your attendance records as a CSV file right after your event ends. No more waiting or manual data entry.',
                icon: ClipboardList,
            },
            {
                title: 'Find your top attendees',
                description: 'See who your most loyal attendees are with our top attendees feature. This helps you identify and reward your most engaged audience members, so you can build stronger relationships with them.',
                icon: Sparkles,
            },
        ],
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

            <header className="relative z-10 px-3 sm:px-6 pt-8">
                <div className="container mx-auto flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-2xl bg-[color:var(--lp-accent-soft)] flex items-center justify-center">
                            <QrCode className="h-5 w-5 text-[color:var(--lp-accent)]" />
                        </div>
                        <Link to="/" className="text-base font-semibold tracking-tight sm:text-lg">
                            Attendly
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

            <main className="relative z-10">
                <section className="px-3 sm:px-6 pb-16 pt-12 md:pt-20">
                    <div className="container mx-auto">
                        <div className="relative">
                            <div
                                className="pointer-events-none absolute -right-24 top-10 h-64 w-64 rounded-full blur-3xl opacity-40"
                                style={{ background: 'radial-gradient(circle, var(--lp-accent-soft) 0%, transparent 70%)' }}
                            />
                            <div
                                className="pointer-events-none absolute -left-16 bottom-0 h-72 w-72 rounded-full blur-3xl opacity-30"
                                style={{ background: 'radial-gradient(circle, var(--lp-accent-fade) 0%, transparent 70%)' }}
                            />
                            <div className="relative grid gap-10 lg:grid-cols-[1.05fr_0.95fr] items-start">
                                <div>
                                    <div
                                        className="inline-flex items-center gap-2 rounded-full border border-[color:var(--lp-border)] px-3 py-1.5 sm:px-4 sm:py-2 text-[10px] sm:text-xs uppercase tracking-[0.15em] sm:tracking-[0.3em] text-[color:var(--lp-muted)] animate-soft-rise"
                                        style={{ '--delay': '40ms' } as CSSProperties}
                                    >
                                        <Sparkles className="h-3 w-3 sm:h-4 sm:w-4 text-[color:var(--lp-accent)]" />
                                        <span className="whitespace-nowrap">Features</span>
                                    </div>
                                    <h1
                                        className="mt-6 text-4xl md:text-5xl lg:text-6xl font-semibold leading-tight tracking-tight animate-soft-rise"
                                        style={{ '--delay': '90ms' } as CSSProperties}
                                    >
                                        How Attendly saves you time every day
                                    </h1>
                                    <p
                                        className="mt-6 text-lg text-[color:var(--lp-muted)] max-w-xl animate-soft-rise"
                                        style={{ '--delay': '140ms' } as CSSProperties}
                                    >
                                        Attendly is build to make attendance management effortless and reliable. What is most important is that your attendance data feels trustworthy so you can focus on what matters most.
                                    </p>
                                    <div className="mt-8 flex flex-wrap gap-3 animate-soft-rise" style={{ '--delay': '190ms' } as CSSProperties}>
                                        <Link to="/auth?mode=signup">
                                            <Button variant="hero" size="lg">
                                                Sign up -&gt;
                                            </Button>
                                        </Link>
                                        <Link to="/">
                                            <Button variant="outline" size="lg" className="border-[color:var(--lp-border)] text-[color:var(--lp-ink)]">
                                                Back to home
                                            </Button>
                                        </Link>
                                    </div>
                                </div>

                                <div className="grid gap-4">
                                    {FEATURE_STEPS.map((step, index) => (
                                        <div
                                            key={step.step}
                                            className="flex items-start gap-4 rounded-2xl border border-[color:var(--lp-border)] bg-[color:var(--lp-bg)] p-4 animate-soft-rise"
                                            style={{ '--delay': `${140 + index * 70}ms` } as CSSProperties}
                                        >
                                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[color:var(--lp-border)] bg-white/70 text-xs font-semibold text-[color:var(--lp-ink)]">
                                                {step.step}
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold">{step.title}</p>
                                                <p className="mt-1 text-xs text-[color:var(--lp-muted)]">{step.preview}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="px-3 sm:px-6 pb-16 md:pb-24">
                    <div className="container mx-auto">
                        <div className="grid gap-10 md:gap-12">
                            {FEATURE_STEPS.map((step, index) => (
                                <div
                                    key={step.title}
                                    className="animate-soft-rise"
                                    style={{ '--delay': `${index * 70}ms` } as CSSProperties}
                                >
                                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                        <div>
                                            <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--lp-border)] px-3 py-1 text-xs uppercase tracking-[0.2em] text-[color:var(--lp-muted)]">
                                                <span className="text-[color:var(--lp-accent)]">Step {step.step}</span>
                                            </div>
                                            <h3 className="mt-4 text-2xl font-semibold">{step.title}</h3>
                                            <p className="mt-3 text-[color:var(--lp-muted)] max-w-2xl">{step.summary}</p>
                                        </div>
                                    </div>
                                    <div className="mt-6 grid gap-4 md:grid-cols-3">
                                        {step.features.map((feature) => (
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
            </main>

            <footer className="px-3 sm:px-6 py-8">
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
                                    to="/"
                                    className="flex items-center gap-3 text-[color:var(--lp-muted)] hover:text-[color:var(--lp-ink)] transition-colors"
                                    onClick={() => setMenuOpen(false)}
                                >
                                    <Home className="h-5 w-5 text-[color:var(--lp-accent)]" />
                                    <span>Home</span>
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
