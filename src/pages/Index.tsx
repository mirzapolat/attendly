import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { QrCode, Shield, BarChart3, Users } from 'lucide-react';

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
              <QrCode className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg">Attendly</span>
          </div>
          <Link to="/auth">
            <Button variant="default" size="sm">
              Sign In
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="pt-32 pb-20">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center animate-fade-in">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
              Track attendance with
              <span className="text-gradient block mt-2">rotating QR codes</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
              Secure, location-verified attendance tracking. 
              QR codes refresh every 3 seconds to prevent sharing.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/auth?mode=signup">
                <Button variant="hero" size="lg">
                  Get Started
                </Button>
              </Link>
              <Link to="/auth">
                <Button variant="outline" size="lg">
                  Sign In
                </Button>
              </Link>
            </div>
          </div>

          {/* Features */}
          <div className="mt-32 grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="p-6 rounded-xl bg-gradient-card border border-border animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Secure Verification</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Device fingerprinting and location verification prevent proxy attendance.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-gradient-card border border-border animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <QrCode className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Rotating QR Codes</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Codes change every 3 seconds. Old codes expire after 5 seconds.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-gradient-card border border-border animate-slide-up" style={{ animationDelay: '0.3s' }}>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Season Analytics</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Track attendance patterns across multiple events in a season.
              </p>
            </div>
          </div>

          {/* How it works */}
          <div className="mt-32 max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">How it works</h2>
            <div className="grid md:grid-cols-4 gap-6">
              {[
                { step: '1', title: 'Create Event', desc: 'Set name, date, and location' },
                { step: '2', title: 'Display QR', desc: 'Show rotating QR code' },
                { step: '3', title: 'Attendees Scan', desc: 'They submit name & email' },
                { step: '4', title: 'View Analytics', desc: 'Track & verify attendance' },
              ].map((item, index) => (
                <div key={item.step} className="text-center animate-slide-up" style={{ animationDelay: `${0.1 * (index + 1)}s` }}>
                  <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground font-semibold flex items-center justify-center mx-auto mb-3">
                    {item.step}
                  </div>
                  <h4 className="font-medium mb-1">{item.title}</h4>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-6 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Attendly. Simple attendance tracking.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
