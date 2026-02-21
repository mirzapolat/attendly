import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowRight,
    FileText,
    Github,
    Home,
    LogIn,
    Mail,
    Menu,
    Sparkles,
    User,
    X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePageTitle } from '@/hooks/usePageTitle';
import { APP_NAME, APP_REPOSITORY_URL, appPageTitle } from '@/constants/appBrand';
import AppLogo from '@/components/AppLogo';

const Impressum = () => {
    usePageTitle(appPageTitle('Impressum'));
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
                        <div className="h-11 w-11">
                            <AppLogo className="h-full w-full" />
                        </div>
                        <Link to="/" className="text-base font-semibold tracking-tight sm:text-lg">
                            {APP_NAME}
                        </Link>
                    </div>
                    <div className="hidden items-center gap-6 text-sm md:flex">
                        <div className="flex items-center gap-3">
                            <Link to="/" className="text-[color:var(--lp-muted)] hover:text-[color:var(--lp-ink)] transition-colors">
                                Home
                            </Link>
                            <Link to="/features" className="text-[color:var(--lp-muted)] hover:text-[color:var(--lp-ink)] transition-colors">
                                Features
                            </Link>
                            <a
                                href={APP_REPOSITORY_URL}
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

            <main className="relative z-10">
                <section className="px-3 sm:px-6 pb-12 pt-12 md:pt-20">
                    <div className="container mx-auto max-w-4xl">
                        <div
                            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--lp-border)] px-3 py-1.5 sm:px-4 sm:py-2 text-[10px] sm:text-xs uppercase tracking-[0.15em] sm:tracking-[0.3em] text-[color:var(--lp-muted)] animate-soft-rise"
                            style={{ '--delay': '40ms' } as CSSProperties}
                        >
                            <FileText className="h-3 w-3 sm:h-4 sm:w-4 text-[color:var(--lp-accent)]" />
                            <span className="whitespace-nowrap">Impressum</span>
                        </div>
                        <h1
                            className="mt-6 text-4xl md:text-5xl lg:text-6xl font-semibold leading-tight tracking-tight animate-soft-rise"
                            style={{ '--delay': '90ms' } as CSSProperties}
                        >
                            Rechtliche Angaben
                        </h1>
                        <p
                            className="mt-6 text-lg text-[color:var(--lp-muted)] max-w-2xl animate-soft-rise"
                            style={{ '--delay': '140ms' } as CSSProperties}
                        >
                            Rechtliche Angaben gemäß den gesetzlichen Bestimmungen.
                        </p>
                    </div>
                </section>

                <section className="px-3 sm:px-6 pb-16 md:pb-24">
                    <div className="container mx-auto max-w-4xl">
                        <article className="grid gap-6">
                            <Card className="rounded-2xl border border-[color:var(--lp-border)] bg-[color:var(--lp-bg)] shadow-none">
                                <CardHeader className="pb-4">
                                    <CardTitle className="flex items-center gap-3 text-lg">
                                        <FileText className="h-5 w-5 text-primary" />
                                        Angaben gemäß § 5 Digitale-Dienste-Gesetz (DDG)
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3 text-sm text-muted-foreground">
                                    <div className="rounded-xl border border-[color:var(--lp-border)] bg-white/60 p-4">
                                        <div className="flex items-start gap-3">
                                            <User className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                                            <div>
                                                <p className="font-semibold text-foreground">Mirza Can Polat</p>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="rounded-2xl border border-[color:var(--lp-border)] bg-[color:var(--lp-bg)] shadow-none">
                                <CardHeader className="pb-4">
                                    <CardTitle className="flex items-center gap-3 text-lg">
                                        <Mail className="h-5 w-5 text-primary" />
                                        Kontakt
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="text-sm text-muted-foreground">
                                    <div className="rounded-xl border border-[color:var(--lp-border)] bg-white/60 p-4">
                                        <p>
                                            E-Mail:{' '}
                                            <a
                                                href="mailto:hallo@mirzapolat.com"
                                                className="text-primary hover:underline font-medium"
                                            >
                                                hallo@mirzapolat.com
                                            </a>
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="rounded-2xl border border-[color:var(--lp-border)] bg-[color:var(--lp-bg)] shadow-none">
                                <CardHeader className="pb-4">
                                    <CardTitle className="flex items-center gap-3 text-lg">
                                        <User className="h-5 w-5 text-primary" />
                                        Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3 text-sm text-muted-foreground">
                                    <div className="rounded-xl border border-[color:var(--lp-border)] bg-white/60 p-4">
                                        <div className="flex items-start gap-3">
                                            <User className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                                            <div>
                                                <p className="font-semibold text-foreground">Mirza Can Polat</p>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </article>
                    </div>
                </section>
            </main>

            <footer className="px-3 sm:px-6 py-8">
                <div className="container mx-auto flex flex-col items-center gap-4 text-xs text-[color:var(--lp-muted)]">
                    <p>Built with ❤️ by Mirza Polat.</p>
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
                                        <AppLogo className="h-full w-full" />
                                    </div>
                                    <span className="text-base font-semibold tracking-tight sm:text-lg">{APP_NAME}</span>
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
                                <Link
                                    to="/features"
                                    className="flex items-center gap-3 text-[color:var(--lp-muted)] hover:text-[color:var(--lp-ink)] transition-colors"
                                    onClick={() => setMenuOpen(false)}
                                >
                                    <Sparkles className="h-5 w-5 text-[color:var(--lp-accent)]" />
                                    <span>Features</span>
                                </Link>
                                <a
                                    href={APP_REPOSITORY_URL}
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

export default Impressum;
