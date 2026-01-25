import { usePageTitle } from '@/hooks/usePageTitle';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, Mail, User, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const Impressum = () => {
  usePageTitle('Impressum - Attendly');

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
            <FileText className="h-6 w-6 md:h-8 md:w-8 text-primary" />
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-2 md:mb-4">Impressum</h1>
          <p className="text-sm sm:text-base md:text-lg text-muted-foreground max-w-2xl mx-auto px-2">
            Rechtliche Angaben gemäß den gesetzlichen Bestimmungen
          </p>
        </div>

        <article className="space-y-4 md:space-y-6 pb-4">
          <Card className="bg-gradient-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary" />
                Angaben gemäß § 5 Digitale-Dienste-Gesetz (DDG)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-foreground">Mirza Can Polat</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Dachauer Str. 159</p>
                    <p className="text-muted-foreground">80636 München</p>
                    <p className="text-muted-foreground">Deutschland</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-primary" />
                Kontakt
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-muted-foreground">
                  E-Mail: <a href="mailto:hallo@mirzapolat.com" className="text-primary hover:underline font-medium">hallo@mirzapolat.com</a>
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <User className="h-5 w-5 text-primary" />
                Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-foreground">Mirza Can Polat</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Dachauer Str. 159</p>
                    <p className="text-muted-foreground">80636 München</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </article>
      </div>
    </div>
  );
};

export default Impressum;
