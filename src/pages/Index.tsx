import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    QrCode, Shield, BarChart3, Users, MapPin, Clock,
    Fingerprint, Download, UserCheck, Zap, ArrowRight, Sparkles
} from 'lucide-react';

const Index = () => {
    return (
        <div className="min-h-screen bg-background overflow-hidden">
            {/* Top Section - Quick Sign In */}
            <section className="relative py-8 px-6">
                <div className="container mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <QrCode className="w-5 h-5 text-primary" />
                        </div>
                        <span className="text-xl font-bold">Attendly</span>
                    </div>
                    <Link to="/auth">
                        <Button variant="outline" className="gap-2">
                            Sign In
                            <ArrowRight className="w-4 h-4" />
                        </Button>
                    </Link>
                </div>
            </section>

            {/* Hero Section */}
            <section className="relative py-20 px-6">
                <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
                <div className="container mx-auto max-w-5xl text-center relative">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8 animate-fade-in">
                        <Sparkles className="w-4 h-4" />
                        Secure attendance tracking made simple
                    </div>
                    <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 animate-fade-in">
                        Stop chasing
                        <span className="text-gradient block mt-2">attendance sheets</span>
                    </h1>
                    <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed animate-fade-in">
                        QR codes that rotate every 3 seconds. Location verification. Device fingerprinting.
                        Know exactly who showed up.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center animate-slide-up">
                        <Link to="/auth?mode=signup">
                            <Button variant="hero" size="lg" className="gap-2 text-lg px-8">
                                Get Started
                                <Zap className="w-5 h-5" />
                            </Button>
                        </Link>
                    </div>
                </div>
            </section>

            {/* Live Demo Visual */}
            <section className="py-16 px-6">
                <div className="container mx-auto max-w-4xl">
                    <Card className="bg-gradient-card border-2 border-primary/20 overflow-hidden">
                        <CardContent className="p-0">
                            <div className="grid md:grid-cols-2">
                                <div className="p-8 md:p-12 flex flex-col justify-center">
                                    <div className="flex items-center gap-2 text-primary mb-4">
                                        <Clock className="w-5 h-5" />
                                        <span className="text-sm font-medium">Refreshes every 3 seconds</span>
                                    </div>
                                    <h2 className="text-2xl md:text-3xl font-bold mb-4">
                                        QR codes that outsmart screenshot sharing
                                    </h2>
                                    <p className="text-muted-foreground mb-6">
                                        By the time someone shares a screenshot, the code has already expired.
                                        Old codes are rejected after just 5 seconds.
                                    </p>
                                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                        <div className="flex items-center gap-1">
                                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                            <span>Live rotation</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <div className="w-2 h-2 rounded-full bg-primary" />
                                            <span>Auto-sync</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-muted/30 p-8 flex items-center justify-center">
                                    <div className="relative">
                                        <div className="w-48 h-48 rounded-2xl bg-background border-2 border-border flex items-center justify-center shadow-2xl">
                                            <QrCode className="w-32 h-32 text-foreground/80" />
                                        </div>
                                        <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold shadow-lg">
                                            3s
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* Features Grid */}
            <section className="py-20 px-6 bg-muted/30">
                <div className="container mx-auto max-w-6xl">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">
                            Every tool you need to
                            <span className="text-gradient"> verify attendance</span>
                        </h2>
                        <p className="text-muted-foreground max-w-2xl mx-auto">
                            Built for organizers who are tired of fake check-ins and manual tracking.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <Card className="bg-gradient-card group hover:border-primary/50 transition-all duration-300">
                            <CardContent className="p-6">
                                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                                    <QrCode className="w-6 h-6 text-primary" />
                                </div>
                                <h3 className="text-lg font-semibold mb-2">Rotating QR Codes</h3>
                                <p className="text-muted-foreground text-sm leading-relaxed">
                                    New code every 3 seconds. Expired codes are rejected within 5 seconds. No more screenshot sharing.
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="bg-gradient-card group hover:border-primary/50 transition-all duration-300">
                            <CardContent className="p-6">
                                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                                    <MapPin className="w-6 h-6 text-primary" />
                                </div>
                                <h3 className="text-lg font-semibold mb-2">Location Verification</h3>
                                <p className="text-muted-foreground text-sm leading-relaxed">
                                    Set a radius around your venue. Only people physically present can check in.
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="bg-gradient-card group hover:border-primary/50 transition-all duration-300">
                            <CardContent className="p-6">
                                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                                    <Fingerprint className="w-6 h-6 text-primary" />
                                </div>
                                <h3 className="text-lg font-semibold mb-2">Device Fingerprinting</h3>
                                <p className="text-muted-foreground text-sm leading-relaxed">
                                    Detect when the same device checks in multiple people. Flag suspicious patterns automatically.
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="bg-gradient-card group hover:border-primary/50 transition-all duration-300">
                            <CardContent className="p-6">
                                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                                    <Shield className="w-6 h-6 text-primary" />
                                </div>
                                <h3 className="text-lg font-semibold mb-2">Moderator Access</h3>
                                <p className="text-muted-foreground text-sm leading-relaxed">
                                    Share secure links with helpers. They can display QR codes and manage attendance without admin access.
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="bg-gradient-card group hover:border-primary/50 transition-all duration-300">
                            <CardContent className="p-6">
                                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                                    <BarChart3 className="w-6 h-6 text-primary" />
                                </div>
                                <h3 className="text-lg font-semibold mb-2">Season Analytics</h3>
                                <p className="text-muted-foreground text-sm leading-relaxed">
                                    Group events into seasons. Track member attendance patterns and generate leaderboards.
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="bg-gradient-card group hover:border-primary/50 transition-all duration-300">
                            <CardContent className="p-6">
                                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                                    <Download className="w-6 h-6 text-primary" />
                                </div>
                                <h3 className="text-lg font-semibold mb-2">Export Everything</h3>
                                <p className="text-muted-foreground text-sm leading-relaxed">
                                    Download attendance lists as CSV. Export full attendance matrices with members and events.
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section className="py-20 px-6">
                <div className="container mx-auto max-w-5xl">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">
                            Up and running in minutes
                        </h2>
                        <p className="text-muted-foreground">
                            No complex setup. No training required.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-4 gap-8">
                        {[
                            {
                                step: '1',
                                icon: Users,
                                title: 'Create Event',
                                desc: 'Set your event name, date, and venue location'
                            },
                            {
                                step: '2',
                                icon: QrCode,
                                title: 'Display QR',
                                desc: 'Show the rotating QR code on a screen or projector'
                            },
                            {
                                step: '3',
                                icon: UserCheck,
                                title: 'Attendees Scan',
                                desc: 'They scan, enter their details, and are verified instantly'
                            },
                            {
                                step: '4',
                                icon: BarChart3,
                                title: 'Track & Export',
                                desc: 'View real-time attendance and export reports'
                            },
                        ].map((item, index) => (
                            <div key={item.step} className="text-center relative">
                                {index < 3 && (
                                    <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-px bg-border" />
                                )}
                                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4 relative z-10">
                                    <item.icon className="w-7 h-7 text-primary" />
                                </div>
                                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground font-semibold flex items-center justify-center mx-auto mb-3 text-sm">
                                    {item.step}
                                </div>
                                <h4 className="font-semibold mb-2">{item.title}</h4>
                                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 px-6">
                <div className="container mx-auto max-w-3xl">
                    <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20">
                        <CardContent className="p-12 text-center">
                            <h2 className="text-3xl md:text-4xl font-bold mb-4">
                                Ready to simplify attendance?
                            </h2>
                            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
                                Get started with tracking attendance at your own events in under 2 minutes.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                <Link to="/auth?mode=signup">
                                    <Button variant="hero" size="lg" className="gap-2">
                                        Create Account
                                        <ArrowRight className="w-5 h-5" />
                                    </Button>
                                </Link>
                                <Link to="/auth">
                                    <Button variant="outline" size="lg">
                                        Sign In
                                    </Button>
                                </Link>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-border py-8">
                <div className="container mx-auto px-6 text-center text-sm text-muted-foreground">
                    <p>Created with ❤️ by Mirza Polat</p>
                </div>
            </footer>
        </div>
    );
};

export default Index;
