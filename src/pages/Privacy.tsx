import { usePageTitle } from '@/hooks/usePageTitle';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, User, Server, Cookie, BarChart3, Users, FileText, Lock, Globe, Mail, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const Privacy = () => {
  usePageTitle('Datenschutzerklärung - Attendly');

  return (
    <div className="h-screen bg-gradient-subtle overflow-hidden flex flex-col">
      <div className="container mx-auto max-w-4xl px-4 py-4 md:py-6 flex-1 overflow-y-auto">
        <Link to="/">
          <Button variant="ghost" className="mb-4 md:mb-6 gap-2">
            <ArrowLeft className="h-4 w-4" />
            Zurück zur Startseite
          </Button>
        </Link>

        {/* Hero Section */}
        <div className="mb-6 md:mb-12 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-primary/10 mb-4 md:mb-6">
            <Shield className="h-6 w-6 md:h-8 md:w-8 text-primary" />
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-2 md:mb-4">Datenschutzerklärung</h1>
          <p className="text-sm sm:text-base md:text-lg text-muted-foreground max-w-2xl mx-auto px-2">
            Transparenz und Vertrauen sind uns wichtig. Hier erfährst du, wie wir deine Daten schützen und verarbeiten.
          </p>
        </div>

        <article className="space-y-4 md:space-y-6 pb-4">

          <Card className="bg-gradient-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <User className="h-5 w-5 text-primary" />
                1. Verantwortlicher
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-muted-foreground">Verantwortlich für die Datenverarbeitung auf dieser Website ist:</p>
              <div className="rounded-lg bg-muted/50 p-4 space-y-1">
                <p className="font-semibold text-foreground">Mirza Can Polat</p>
                <p className="text-muted-foreground">Dachauer Str. 159</p>
                <p className="text-muted-foreground">80636 München, Deutschland</p>
                <p className="text-muted-foreground">
                  E-Mail: <a href="mailto:hallo@mirzapolat.com" className="text-primary hover:underline font-medium">hallo@mirzapolat.com</a>
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary" />
                2. Datenschutzbeauftragter
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Ein Datenschutzbeauftragter ist nicht bestellt.</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary" />
                3. Allgemeine Hinweise zu Rechtsgrundlagen
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">Wir verarbeiten personenbezogene Daten insbesondere auf folgenden Rechtsgrundlagen:</p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="text-primary font-semibold mt-0.5">•</span>
                  <span className="text-muted-foreground">
                    <strong className="text-foreground">Art. 6 Abs. 1 lit. b DSGVO</strong> (Vertrag / vorvertragliche Maßnahmen), z. B. bei Registrierung und Nutzung deines Accounts
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary font-semibold mt-0.5">•</span>
                  <span className="text-muted-foreground">
                    <strong className="text-foreground">Art. 6 Abs. 1 lit. f DSGVO</strong> (berechtigtes Interesse), z. B. für den sicheren, stabilen Betrieb der Website, Missbrauchsvermeidung und IT-Sicherheit
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary font-semibold mt-0.5">•</span>
                  <span className="text-muted-foreground">
                    <strong className="text-foreground">Art. 6 Abs. 1 lit. a DSGVO</strong> (Einwilligung), sofern ausnahmsweise eine Einwilligung erforderlich wäre (z. B. bei einwilligungspflichtigem Tracking)
                  </span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Server className="h-5 w-5 text-primary" />
                4. Hosting der Website (Vercel)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-muted-foreground">
                Die Website wird über <strong className="text-foreground">Vercel</strong> bereitgestellt (Vercel, Inc.). Dabei werden technisch notwendige Daten verarbeitet, die beim Aufruf der Website anfallen (z. B. IP-Adresse, Zeitstempel, angeforderte Seite/Datei, Geräte-/Browser-Informationen).
              </p>
              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                <p className="text-muted-foreground">
                  <strong className="text-foreground">Zweck:</strong> Bereitstellung, Auslieferung und Sicherheit der Website.
                </p>
                <p className="text-muted-foreground">
                  <strong className="text-foreground">Rechtsgrundlage:</strong> <strong className="text-foreground">Art. 6 Abs. 1 lit. f DSGVO</strong>.
                </p>
              </div>
              <p className="text-muted-foreground">
                Es kann nicht ausgeschlossen werden, dass dabei Daten auch in den USA verarbeitet werden. Vercel ist nach dem <strong className="text-foreground">EU-U.S. Data Privacy Framework (DPF)</strong> zertifiziert.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-primary" />
                5. Content Delivery Network & Sicherheit (Cloudflare)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-muted-foreground">
                Wir nutzen <strong className="text-foreground">Cloudflare</strong> (z. B. als CDN und Schutz vor Angriffen). Dabei werden Verbindungsdaten (u. a. IP-Adresse und technische Zugriffsdaten) verarbeitet, um die Website schnell und sicher auszuliefern und Angriffe abzuwehren.
              </p>
              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                <p className="text-muted-foreground">
                  <strong className="text-foreground">Zweck:</strong> Performance, Stabilität und IT-Sicherheit (z. B. DDoS-Abwehr).
                </p>
                <p className="text-muted-foreground">
                  <strong className="text-foreground">Rechtsgrundlage:</strong> <strong className="text-foreground">Art. 6 Abs. 1 lit. f DSGVO</strong>.
                </p>
              </div>
              <p className="text-muted-foreground">
                Cloudflare verarbeitet Daten ggf. auch außerhalb der EU. Cloudflare ist im <strong className="text-foreground">EU-U.S. Data Privacy Framework (DPF)</strong> als aktiv gelistet.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Server className="h-5 w-5 text-primary" />
                6. Datenbank / Server (Hetzner)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-muted-foreground">
                Die Datenbank und damit zusammenhängende Backend-Daten werden auf Servern von <strong className="text-foreground">Hetzner</strong> betrieben. In der Datenbank können (je nach Nutzung) Account- und Nutzungsdaten gespeichert werden (siehe Abschnitt „Account/Registrierung").
              </p>
              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                <p className="text-muted-foreground">
                  <strong className="text-foreground">Zweck:</strong> Betrieb der Anwendung (Accountverwaltung, Speicherung der für die Nutzung erforderlichen Daten).
                </p>
                <p className="text-muted-foreground">
                  <strong className="text-foreground">Rechtsgrundlage:</strong> <strong className="text-foreground">Art. 6 Abs. 1 lit. b DSGVO</strong> (Vertrag/Nutzung) und <strong className="text-foreground">Art. 6 Abs. 1 lit. f DSGVO</strong> (sicherer Betrieb).
                </p>
              </div>
              <p className="text-muted-foreground text-sm">
                Hinweis: Für Hosting-Anbieter wird regelmäßig ein Vertrag zur Auftragsverarbeitung nach Art. 28 DSGVO genutzt/abgeschlossen. Hetzner stellt hierfür einen AV-Vertrag/DPA bereit.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary" />
                7. Server-Logfiles
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-muted-foreground">
                Beim Zugriff auf die Website fallen typischerweise Server-Logdaten an (z. B. IP-Adresse, Datum/Uhrzeit, aufgerufene URL, Statuscode, User-Agent, Referrer). Diese Daten sind notwendig, um die Website bereitzustellen, Fehler zu analysieren und Missbrauch zu verhindern.
              </p>
              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                <p className="text-muted-foreground">
                  <strong className="text-foreground">Zweck:</strong> Technischer Betrieb, Sicherheit, Fehleranalyse.
                </p>
                <p className="text-muted-foreground">
                  <strong className="text-foreground">Rechtsgrundlage:</strong> <strong className="text-foreground">Art. 6 Abs. 1 lit. f DSGVO</strong>.
                </p>
                <p className="text-muted-foreground">
                  <strong className="text-foreground">Speicherdauer:</strong> Logdaten werden nur so lange gespeichert, wie es für die genannten Zwecke erforderlich ist.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Users className="h-5 w-5 text-primary" />
                8. Registrierung, Account und Login
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-muted-foreground">
                Auf Attendly kannst du einen Account erstellen. Dabei verarbeiten wir die Daten, die du bei der Registrierung bzw. Accountnutzung angibst oder die zur Nutzung technisch erforderlich sind (z. B. Login-/Accountdaten).
              </p>
              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                <p className="text-muted-foreground">
                  <strong className="text-foreground">Zweck:</strong> Bereitstellung der Account-Funktion, Authentifizierung, Missbrauchsprävention, Support.
                </p>
                <p className="text-muted-foreground">
                  <strong className="text-foreground">Rechtsgrundlage:</strong> <strong className="text-foreground">Art. 6 Abs. 1 lit. b DSGVO</strong> (Nutzungsvertrag) sowie <strong className="text-foreground">Art. 6 Abs. 1 lit. f DSGVO</strong> (Sicherheit/Integrität).
                </p>
                <p className="text-muted-foreground">
                  <strong className="text-foreground">Speicherdauer:</strong> Wir speichern Accountdaten grundsätzlich, solange dein Account besteht. Nach Löschung des Accounts werden die Daten gelöscht, sofern keine gesetzlichen Aufbewahrungspflichten entgegenstehen.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Cookie className="h-5 w-5 text-primary" />
                9. Cookies (technisch notwendig)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-muted-foreground">
                Attendly nutzt <strong className="text-foreground">technisch notwendige Cookies</strong> bzw. vergleichbare Speichertechnologien, die für den Login und den Betrieb deines Accounts erforderlich sind (z. B. Session-/Auth-Cookies).
              </p>
              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                <p className="text-muted-foreground">
                  <strong className="text-foreground">Zweck:</strong> Authentifizierung, Sessionverwaltung, sichere Nutzung der Anwendung.
                </p>
                <p className="text-muted-foreground">
                  <strong className="text-foreground">Rechtsgrundlage:</strong> <strong className="text-foreground">Art. 6 Abs. 1 lit. f DSGVO</strong> (berechtigtes Interesse am technisch notwendigen Betrieb) und/oder <strong className="text-foreground">Art. 6 Abs. 1 lit. b DSGVO</strong> (Bereitstellung der Funktionen im Rahmen der Nutzung).
                </p>
              </div>
              <p className="text-muted-foreground">
                Da <strong className="text-foreground">keine Marketing- oder Werbe-Cookies</strong> eingesetzt werden, ist aktuell kein Cookie-Banner allein für diese notwendigen Cookies vorgesehen.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <BarChart3 className="h-5 w-5 text-primary" />
                10. Webanalyse (Vercel Web Analytics)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-muted-foreground">
                Wir verwenden <strong className="text-foreground">Vercel Web Analytics</strong>, um die Nutzung der Website zu verstehen und zu verbessern. Laut Vercel erfolgt dies <strong className="text-foreground">ohne Third-Party-Cookies</strong>; Besucher werden über einen Hash aus der eingehenden Anfrage wiedererkannt, und diese Zuordnung wird laut Vercel nach <strong className="text-foreground">24 Stunden</strong> verworfen.
              </p>
              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                <p className="text-muted-foreground">
                  <strong className="text-foreground">Zweck:</strong> Reichweitenmessung und Verbesserung der Website.
                </p>
                <p className="text-muted-foreground">
                  <strong className="text-foreground">Rechtsgrundlage:</strong> In der Regel <strong className="text-foreground">Art. 6 Abs. 1 lit. f DSGVO</strong> (berechtigtes Interesse an der Optimierung) – sofern die Auswertung tatsächlich ohne einwilligungspflichtige Cookies/Identifier erfolgt.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Users className="h-5 w-5 text-primary" />
                11. Empfänger / Kategorien von Empfängern
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-muted-foreground">
                Zur Erbringung der Website- und App-Funktionen setzen wir Dienstleister ein (insb. Hosting/Netzwerk/Serverbetrieb). Empfänger können sein:
              </p>
              <ul className="space-y-2">
                <li className="flex items-start gap-3">
                  <span className="text-primary font-semibold mt-0.5">•</span>
                  <span className="text-muted-foreground">
                    <strong className="text-foreground">Vercel</strong> (Hosting/Plattformbetrieb)
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary font-semibold mt-0.5">•</span>
                  <span className="text-muted-foreground">
                    <strong className="text-foreground">Cloudflare</strong> (CDN/Sicherheit)
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary font-semibold mt-0.5">•</span>
                  <span className="text-muted-foreground">
                    <strong className="text-foreground">Hetzner</strong> (Server/Datenbankbetrieb)
                  </span>
                </li>
              </ul>
              <p className="text-muted-foreground">
                Wir geben Daten darüber hinaus nur weiter, wenn dies gesetzlich erforderlich ist oder zur Durchsetzung von Rechten notwendig ist.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Globe className="h-5 w-5 text-primary" />
                12. Drittlandübermittlung
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Durch die Einbindung von US-Anbietern (z. B. Vercel, Cloudflare) kann eine Verarbeitung in den USA nicht ausgeschlossen werden. Als Schutzmechanismus kommt insbesondere das <strong className="text-foreground">EU-U.S. Data Privacy Framework (DPF)</strong> in Betracht (Zertifizierungsstatus siehe oben).
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Lock className="h-5 w-5 text-primary" />
                13. Deine Rechte
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-muted-foreground">Du hast jederzeit folgende Rechte:</p>
              <ul className="space-y-2">
                <li className="flex items-start gap-3">
                  <span className="text-primary font-semibold mt-0.5">•</span>
                  <span className="text-muted-foreground">Auskunft (Art. 15 DSGVO)</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary font-semibold mt-0.5">•</span>
                  <span className="text-muted-foreground">Berichtigung (Art. 16 DSGVO)</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary font-semibold mt-0.5">•</span>
                  <span className="text-muted-foreground">Löschung (Art. 17 DSGVO)</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary font-semibold mt-0.5">•</span>
                  <span className="text-muted-foreground">Einschränkung der Verarbeitung (Art. 18 DSGVO)</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary font-semibold mt-0.5">•</span>
                  <span className="text-muted-foreground">Datenübertragbarkeit (Art. 20 DSGVO)</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary font-semibold mt-0.5">•</span>
                  <span className="text-muted-foreground">Widerspruch gegen Verarbeitung auf Basis berechtigter Interessen (Art. 21 DSGVO)</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary font-semibold mt-0.5">•</span>
                  <span className="text-muted-foreground">Widerruf von Einwilligungen (Art. 7 Abs. 3 DSGVO), sofern Einwilligungen eingeholt werden</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary" />
                14. Beschwerderecht
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Du hast das Recht, dich bei einer Datenschutzaufsichtsbehörde zu beschweren (Art. 77 DSGVO), insbesondere in dem Mitgliedstaat deines gewöhnlichen Aufenthalts, deines Arbeitsplatzes oder des Orts des mutmaßlichen Verstoßes.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-primary" />
                15. Stand
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Stand: <strong className="text-foreground">26.01.2026</strong></p>
            </CardContent>
          </Card>
        </article>
      </div>
    </div>
  );
};

export default Privacy;
