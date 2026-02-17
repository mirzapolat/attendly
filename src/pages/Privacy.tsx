import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowRight,
    BarChart3,
    Calendar,
    Cookie,
    FileText,
    Github,
    Globe,
    Home,
    Lock,
    LogIn,
    Menu,
    Server,
    Shield,
    Sparkles,
    User,
    Users,
    X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePageTitle } from '@/hooks/usePageTitle';
import AttendlyLogo from '@/components/AttendlyLogo';

const Privacy = () => {
    usePageTitle('Datenschutzerklärung - Attendly');
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
                            <AttendlyLogo className="h-full w-full" />
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

            <main className="relative z-10">
                <section className="px-3 sm:px-6 pb-12 pt-12 md:pt-20">
                    <div className="container mx-auto max-w-4xl">
                        <div
                            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--lp-border)] px-3 py-1.5 sm:px-4 sm:py-2 text-[10px] sm:text-xs uppercase tracking-[0.15em] sm:tracking-[0.3em] text-[color:var(--lp-muted)] animate-soft-rise"
                            style={{ '--delay': '40ms' } as CSSProperties}
                        >
                            <Shield className="h-3 w-3 sm:h-4 sm:w-4 text-[color:var(--lp-accent)]" />
                            <span className="whitespace-nowrap">Datenschutz</span>
                        </div>
                        <h1
                            className="mt-6 text-4xl md:text-5xl lg:text-6xl font-semibold leading-tight tracking-tight animate-soft-rise"
                            style={{ '--delay': '90ms' } as CSSProperties}
                        >
                            Datenschutzerklärung
                        </h1>
                        <p
                            className="mt-6 text-lg text-[color:var(--lp-muted)] max-w-2xl animate-soft-rise"
                            style={{ '--delay': '140ms' } as CSSProperties}
                        >
                            Transparenz und Vertrauen sind uns wichtig. Hier erfährst du, wie wir deine Daten schützen und
                            verarbeiten.
                        </p>
                    </div>
                </section>

                <section className="px-3 sm:px-6 pb-16 md:pb-24">
                    <div className="container mx-auto max-w-4xl">
                        <article className="grid gap-6">
                            <Card className="rounded-2xl border border-[color:var(--lp-border)] bg-[color:var(--lp-bg)] shadow-none">
                                <CardHeader className="pb-4">
                                    <CardTitle className="flex items-center gap-3 text-lg">
                                        <User className="h-5 w-5 text-primary" />
                                        1. Verantwortlicher
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3 text-sm text-muted-foreground">
                                    <p>Verantwortlich für die Datenverarbeitung auf dieser Website ist:</p>
                                    <div className="rounded-xl border border-[color:var(--lp-border)] bg-white/60 p-4 space-y-1">
                                        <p className="font-semibold text-foreground">Mirza Can Polat</p>
                                        <p>Dachauer Str. 159</p>
                                        <p>80636 München, Deutschland</p>
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
                                        <FileText className="h-5 w-5 text-primary" />
                                        2. Datenschutzbeauftragter
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="text-sm text-muted-foreground">
                                    <p>Ein Datenschutzbeauftragter ist nicht bestellt.</p>
                                </CardContent>
                            </Card>

                            <Card className="rounded-2xl border border-[color:var(--lp-border)] bg-[color:var(--lp-bg)] shadow-none">
                                <CardHeader className="pb-4">
                                    <CardTitle className="flex items-center gap-3 text-lg">
                                        <FileText className="h-5 w-5 text-primary" />
                                        3. Allgemeine Hinweise zu Rechtsgrundlagen
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4 text-sm text-muted-foreground">
                                    <p>Wir verarbeiten personenbezogene Daten insbesondere auf folgenden Rechtsgrundlagen:</p>
                                    <ul className="space-y-3">
                                        <li className="flex items-start gap-3">
                                            <span className="text-primary font-semibold mt-0.5">•</span>
                                            <span>
                                                <strong className="text-foreground">Art. 6 Abs. 1 lit. b DSGVO</strong> (Vertrag /
                                                vorvertragliche Maßnahmen), z. B. bei Registrierung und Nutzung deines Accounts
                                            </span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <span className="text-primary font-semibold mt-0.5">•</span>
                                            <span>
                                                <strong className="text-foreground">Art. 6 Abs. 1 lit. f DSGVO</strong> (berechtigtes
                                                Interesse), z. B. für den sicheren, stabilen Betrieb der Website, Missbrauchsvermeidung
                                                und IT-Sicherheit
                                            </span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <span className="text-primary font-semibold mt-0.5">•</span>
                                            <span>
                                                <strong className="text-foreground">Art. 6 Abs. 1 lit. a DSGVO</strong> (Einwilligung),
                                                sofern ausnahmsweise eine Einwilligung erforderlich wäre (z. B. bei einwilligungspflichtigem
                                                Tracking)
                                            </span>
                                        </li>
                                    </ul>
                                </CardContent>
                            </Card>

                            <Card className="rounded-2xl border border-[color:var(--lp-border)] bg-[color:var(--lp-bg)] shadow-none">
                                <CardHeader className="pb-4">
                                    <CardTitle className="flex items-center gap-3 text-lg">
                                        <Server className="h-5 w-5 text-primary" />
                                        4. Hosting der Website (Vercel)
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3 text-sm text-muted-foreground">
                                    <p>
                                        Die Website wird über <strong className="text-foreground">Vercel</strong> bereitgestellt (Vercel,
                                        Inc.). Dabei werden technisch notwendige Daten verarbeitet, die beim Aufruf der Website anfallen
                                        (z. B. IP-Adresse, Zeitstempel, angeforderte Seite/Datei, Geräte-/Browser-Informationen).
                                    </p>
                                    <div className="rounded-xl border border-[color:var(--lp-border)] bg-white/60 p-4 space-y-2">
                                        <p>
                                            <strong className="text-foreground">Zweck:</strong> Bereitstellung, Auslieferung und Sicherheit
                                            der Website.
                                        </p>
                                        <p>
                                            <strong className="text-foreground">Rechtsgrundlage:</strong>{' '}
                                            <strong className="text-foreground">Art. 6 Abs. 1 lit. f DSGVO</strong>.
                                        </p>
                                    </div>
                                    <p>
                                        Es kann nicht ausgeschlossen werden, dass dabei Daten auch in den USA verarbeitet werden. Vercel
                                        ist nach dem <strong className="text-foreground">EU-U.S. Data Privacy Framework (DPF)</strong>
                                        zertifiziert.
                                    </p>
                                </CardContent>
                            </Card>

                            <Card className="rounded-2xl border border-[color:var(--lp-border)] bg-[color:var(--lp-bg)] shadow-none">
                                <CardHeader className="pb-4">
                                    <CardTitle className="flex items-center gap-3 text-lg">
                                        <Shield className="h-5 w-5 text-primary" />
                                        5. Content Delivery Network &amp; Sicherheit (Cloudflare)
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3 text-sm text-muted-foreground">
                                    <p>
                                        Wir nutzen <strong className="text-foreground">Cloudflare</strong> (z. B. als CDN und Schutz vor
                                        Angriffen). Dabei werden Verbindungsdaten (u. a. IP-Adresse und technische Zugriffsdaten)
                                        verarbeitet, um die Website schnell und sicher auszuliefern und Angriffe abzuwehren.
                                    </p>
                                    <div className="rounded-xl border border-[color:var(--lp-border)] bg-white/60 p-4 space-y-2">
                                        <p>
                                            <strong className="text-foreground">Zweck:</strong> Performance, Stabilität und IT-Sicherheit (z.
                                            B. DDoS-Abwehr).
                                        </p>
                                        <p>
                                            <strong className="text-foreground">Rechtsgrundlage:</strong>{' '}
                                            <strong className="text-foreground">Art. 6 Abs. 1 lit. f DSGVO</strong>.
                                        </p>
                                    </div>
                                    <p>
                                        Cloudflare verarbeitet Daten ggf. auch außerhalb der EU. Cloudflare ist im{' '}
                                        <strong className="text-foreground">EU-U.S. Data Privacy Framework (DPF)</strong> als aktiv gelistet.
                                    </p>
                                </CardContent>
                            </Card>

                            <Card className="rounded-2xl border border-[color:var(--lp-border)] bg-[color:var(--lp-bg)] shadow-none">
                                <CardHeader className="pb-4">
                                    <CardTitle className="flex items-center gap-3 text-lg">
                                        <Server className="h-5 w-5 text-primary" />
                                        6. Datenbank / Server (Hetzner)
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3 text-sm text-muted-foreground">
                                    <p>
                                        Die Datenbank und damit zusammenhängende Backend-Daten werden auf Servern von{' '}
                                        <strong className="text-foreground">Hetzner</strong> betrieben. In der Datenbank können (je nach
                                        Nutzung) Account- und Nutzungsdaten gespeichert werden (siehe Abschnitt „Account/Registrierung").
                                    </p>
                                    <div className="rounded-xl border border-[color:var(--lp-border)] bg-white/60 p-4 space-y-2">
                                        <p>
                                            <strong className="text-foreground">Zweck:</strong> Betrieb der Anwendung (Accountverwaltung,
                                            Speicherung der für die Nutzung erforderlichen Daten).
                                        </p>
                                        <p>
                                            <strong className="text-foreground">Rechtsgrundlage:</strong>{' '}
                                            <strong className="text-foreground">Art. 6 Abs. 1 lit. b DSGVO</strong> (Vertrag/Nutzung) und{' '}
                                            <strong className="text-foreground">Art. 6 Abs. 1 lit. f DSGVO</strong> (sicherer Betrieb).
                                        </p>
                                    </div>
                                    <p className="text-xs">
                                        Hinweis: Für Hosting-Anbieter wird regelmäßig ein Vertrag zur Auftragsverarbeitung nach Art. 28
                                        DSGVO genutzt/abgeschlossen. Hetzner stellt hierfür einen AV-Vertrag/DPA bereit.
                                    </p>
                                </CardContent>
                            </Card>

                            <Card className="rounded-2xl border border-[color:var(--lp-border)] bg-[color:var(--lp-bg)] shadow-none">
                                <CardHeader className="pb-4">
                                    <CardTitle className="flex items-center gap-3 text-lg">
                                        <FileText className="h-5 w-5 text-primary" />
                                        7. Server-Logfiles
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3 text-sm text-muted-foreground">
                                    <p>
                                        Beim Zugriff auf die Website fallen typischerweise Server-Logdaten an (z. B. IP-Adresse,
                                        Datum/Uhrzeit, aufgerufene URL, Statuscode, User-Agent, Referrer). Diese Daten sind notwendig, um
                                        die Website bereitzustellen, Fehler zu analysieren und Missbrauch zu verhindern.
                                    </p>
                                    <div className="rounded-xl border border-[color:var(--lp-border)] bg-white/60 p-4 space-y-2">
                                        <p>
                                            <strong className="text-foreground">Zweck:</strong> Technischer Betrieb, Sicherheit, Fehleranalyse.
                                        </p>
                                        <p>
                                            <strong className="text-foreground">Rechtsgrundlage:</strong>{' '}
                                            <strong className="text-foreground">Art. 6 Abs. 1 lit. f DSGVO</strong>.
                                        </p>
                                        <p>
                                            <strong className="text-foreground">Speicherdauer:</strong> Logdaten werden nur so lange gespeichert,
                                            wie es für die genannten Zwecke erforderlich ist.
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="rounded-2xl border border-[color:var(--lp-border)] bg-[color:var(--lp-bg)] shadow-none">
                                <CardHeader className="pb-4">
                                    <CardTitle className="flex items-center gap-3 text-lg">
                                        <Users className="h-5 w-5 text-primary" />
                                        8. Registrierung, Account und Login
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3 text-sm text-muted-foreground">
                                    <p>
                                        Auf Attendly kannst du einen Account erstellen. Dabei verarbeiten wir die Daten, die du bei der
                                        Registrierung bzw. Accountnutzung angibst oder die zur Nutzung technisch erforderlich sind (z. B.
                                        Login-/Accountdaten).
                                    </p>
                                    <div className="rounded-xl border border-[color:var(--lp-border)] bg-white/60 p-4 space-y-2">
                                        <p>
                                            <strong className="text-foreground">Zweck:</strong> Bereitstellung der Account-Funktion,
                                            Authentifizierung, Missbrauchsprävention, Support.
                                        </p>
                                        <p>
                                            <strong className="text-foreground">Rechtsgrundlage:</strong>{' '}
                                            <strong className="text-foreground">Art. 6 Abs. 1 lit. b DSGVO</strong> (Nutzungsvertrag) sowie{' '}
                                            <strong className="text-foreground">Art. 6 Abs. 1 lit. f DSGVO</strong> (Sicherheit/Integrität).
                                        </p>
                                        <p>
                                            <strong className="text-foreground">Speicherdauer:</strong> Wir speichern Accountdaten grundsätzlich,
                                            solange dein Account besteht. Nach Löschung des Accounts werden die Daten gelöscht, sofern keine
                                            gesetzlichen Aufbewahrungspflichten entgegenstehen.
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="rounded-2xl border border-[color:var(--lp-border)] bg-[color:var(--lp-bg)] shadow-none">
                                <CardHeader className="pb-4">
                                    <CardTitle className="flex items-center gap-3 text-lg">
                                        <Cookie className="h-5 w-5 text-primary" />
                                        9. Cookies (technisch notwendig)
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3 text-sm text-muted-foreground">
                                    <p>
                                        Attendly nutzt <strong className="text-foreground">technisch notwendige Cookies</strong> bzw.
                                        vergleichbare Speichertechnologien, die für den Login und den Betrieb deines Accounts erforderlich
                                        sind (z. B. Session-/Auth-Cookies).
                                    </p>
                                    <div className="rounded-xl border border-[color:var(--lp-border)] bg-white/60 p-4 space-y-2">
                                        <p>
                                            <strong className="text-foreground">Zweck:</strong> Authentifizierung, Sessionverwaltung, sichere
                                            Nutzung der Anwendung.
                                        </p>
                                        <p>
                                            <strong className="text-foreground">Rechtsgrundlage:</strong>{' '}
                                            <strong className="text-foreground">Art. 6 Abs. 1 lit. f DSGVO</strong> (berechtigtes Interesse am
                                            technisch notwendigen Betrieb) und/oder <strong className="text-foreground">Art. 6 Abs. 1 lit. b
                                            DSGVO</strong> (Bereitstellung der Funktionen im Rahmen der Nutzung).
                                        </p>
                                    </div>
                                    <p>
                                        Da <strong className="text-foreground">keine Marketing- oder Werbe-Cookies</strong> eingesetzt werden,
                                        ist aktuell kein Cookie-Banner allein für diese notwendigen Cookies vorgesehen.
                                    </p>
                                </CardContent>
                            </Card>

                            <Card className="rounded-2xl border border-[color:var(--lp-border)] bg-[color:var(--lp-bg)] shadow-none">
                                <CardHeader className="pb-4">
                                    <CardTitle className="flex items-center gap-3 text-lg">
                                        <BarChart3 className="h-5 w-5 text-primary" />
                                        10. Webanalyse (Vercel Web Analytics)
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3 text-sm text-muted-foreground">
                                    <p>
                                        Wir verwenden <strong className="text-foreground">Vercel Web Analytics</strong>, um die Nutzung der
                                        Website zu verstehen und zu verbessern. Laut Vercel erfolgt dies{' '}
                                        <strong className="text-foreground">ohne Third-Party-Cookies</strong>; Besucher werden über einen
                                        Hash aus der eingehenden Anfrage wiedererkannt, und diese Zuordnung wird laut Vercel nach{' '}
                                        <strong className="text-foreground">24 Stunden</strong> verworfen.
                                    </p>
                                    <div className="rounded-xl border border-[color:var(--lp-border)] bg-white/60 p-4 space-y-2">
                                        <p>
                                            <strong className="text-foreground">Zweck:</strong> Reichweitenmessung und Verbesserung der
                                            Website.
                                        </p>
                                        <p>
                                            <strong className="text-foreground">Rechtsgrundlage:</strong> In der Regel{' '}
                                            <strong className="text-foreground">Art. 6 Abs. 1 lit. f DSGVO</strong> (berechtigtes Interesse an
                                            der Optimierung) – sofern die Auswertung tatsächlich ohne einwilligungspflichtige
                                            Cookies/Identifier erfolgt.
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="rounded-2xl border border-[color:var(--lp-border)] bg-[color:var(--lp-bg)] shadow-none">
                                <CardHeader className="pb-4">
                                    <CardTitle className="flex items-center gap-3 text-lg">
                                        <Users className="h-5 w-5 text-primary" />
                                        11. Empfänger / Kategorien von Empfängern
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3 text-sm text-muted-foreground">
                                    <p>
                                        Zur Erbringung der Website- und App-Funktionen setzen wir Dienstleister ein (insb.
                                        Hosting/Netzwerk/Serverbetrieb). Empfänger können sein:
                                    </p>
                                    <ul className="space-y-2">
                                        <li className="flex items-start gap-3">
                                            <span className="text-primary font-semibold mt-0.5">•</span>
                                            <span>
                                                <strong className="text-foreground">Vercel</strong> (Hosting/Plattformbetrieb)
                                            </span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <span className="text-primary font-semibold mt-0.5">•</span>
                                            <span>
                                                <strong className="text-foreground">Cloudflare</strong> (CDN/Sicherheit)
                                            </span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <span className="text-primary font-semibold mt-0.5">•</span>
                                            <span>
                                                <strong className="text-foreground">Hetzner</strong> (Server/Datenbankbetrieb)
                                            </span>
                                        </li>
                                    </ul>
                                    <p>
                                        Wir geben Daten darüber hinaus nur weiter, wenn dies gesetzlich erforderlich ist oder zur
                                        Durchsetzung von Rechten notwendig ist.
                                    </p>
                                </CardContent>
                            </Card>

                            <Card className="rounded-2xl border border-[color:var(--lp-border)] bg-[color:var(--lp-bg)] shadow-none">
                                <CardHeader className="pb-4">
                                    <CardTitle className="flex items-center gap-3 text-lg">
                                        <Globe className="h-5 w-5 text-primary" />
                                        12. Drittlandübermittlung
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="text-sm text-muted-foreground">
                                    <p>
                                        Durch die Einbindung von US-Anbietern (z. B. Vercel, Cloudflare) kann eine Verarbeitung in den USA
                                        nicht ausgeschlossen werden. Als Schutzmechanismus kommt insbesondere das{' '}
                                        <strong className="text-foreground">EU-U.S. Data Privacy Framework (DPF)</strong> in Betracht
                                        (Zertifizierungsstatus siehe oben).
                                    </p>
                                </CardContent>
                            </Card>

                            <Card className="rounded-2xl border border-[color:var(--lp-border)] bg-[color:var(--lp-bg)] shadow-none">
                                <CardHeader className="pb-4">
                                    <CardTitle className="flex items-center gap-3 text-lg">
                                        <Lock className="h-5 w-5 text-primary" />
                                        13. Deine Rechte
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3 text-sm text-muted-foreground">
                                    <p>Du hast jederzeit folgende Rechte:</p>
                                    <ul className="space-y-2">
                                        <li className="flex items-start gap-3">
                                            <span className="text-primary font-semibold mt-0.5">•</span>
                                            <span>Auskunft (Art. 15 DSGVO)</span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <span className="text-primary font-semibold mt-0.5">•</span>
                                            <span>Berichtigung (Art. 16 DSGVO)</span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <span className="text-primary font-semibold mt-0.5">•</span>
                                            <span>Löschung (Art. 17 DSGVO)</span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <span className="text-primary font-semibold mt-0.5">•</span>
                                            <span>Einschränkung der Verarbeitung (Art. 18 DSGVO)</span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <span className="text-primary font-semibold mt-0.5">•</span>
                                            <span>Datenübertragbarkeit (Art. 20 DSGVO)</span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <span className="text-primary font-semibold mt-0.5">•</span>
                                            <span>Widerspruch gegen Verarbeitung auf Basis berechtigter Interessen (Art. 21 DSGVO)</span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <span className="text-primary font-semibold mt-0.5">•</span>
                                            <span>Widerruf von Einwilligungen (Art. 7 Abs. 3 DSGVO), sofern Einwilligungen eingeholt werden</span>
                                        </li>
                                    </ul>
                                </CardContent>
                            </Card>

                            <Card className="rounded-2xl border border-[color:var(--lp-border)] bg-[color:var(--lp-bg)] shadow-none">
                                <CardHeader className="pb-4">
                                    <CardTitle className="flex items-center gap-3 text-lg">
                                        <FileText className="h-5 w-5 text-primary" />
                                        14. Beschwerderecht
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="text-sm text-muted-foreground">
                                    <p>
                                        Du hast das Recht, dich bei einer Datenschutzaufsichtsbehörde zu beschweren (Art. 77 DSGVO),
                                        insbesondere in dem Mitgliedstaat deines gewöhnlichen Aufenthalts, deines Arbeitsplatzes oder des
                                        Orts des mutmaßlichen Verstoßes.
                                    </p>
                                </CardContent>
                            </Card>

                            <Card className="rounded-2xl border border-[color:var(--lp-border)] bg-[color:var(--lp-bg)] shadow-none">
                                <CardHeader className="pb-4">
                                    <CardTitle className="flex items-center gap-3 text-lg">
                                        <Calendar className="h-5 w-5 text-primary" />
                                        15. Stand
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="text-sm text-muted-foreground">
                                    <p>
                                        Stand: <strong className="text-foreground">26.01.2026</strong>
                                    </p>
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

export default Privacy;
