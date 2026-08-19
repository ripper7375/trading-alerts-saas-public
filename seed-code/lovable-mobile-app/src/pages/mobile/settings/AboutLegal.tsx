import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  Info,
  FileText,
  Shield,
  Scale,
  ExternalLink,
  ChevronRight,
  Smartphone,
  Code,
  Heart,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

const legalLinks = [
  {
    icon: FileText,
    label: 'Terms of Service',
    description: 'App usage terms and conditions',
    url: '#terms',
  },
  {
    icon: Shield,
    label: 'Privacy Policy',
    description: 'How we handle your data',
    url: '#privacy',
  },
  {
    icon: Scale,
    label: 'Licenses',
    description: 'Open source attributions',
    url: '#licenses',
  },
];

const appInfo = {
  version: '1.0.0',
  build: '2024.01.08',
  platform: 'React + Capacitor',
};

const AboutLegal = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLegalLink = (url: string, label: string) => {
    toast({
      title: label,
      description: 'Opening in browser...',
    });
  };

  const handleVersionTap = () => {
    toast({
      title: 'Build Info',
      description: `Version ${appInfo.version} (${appInfo.build})`,
    });
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/settings')} className="p-1">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-foreground">About</h1>
            <p className="text-sm text-muted-foreground">App info & legal</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 space-y-4 p-4 pb-24">
        {/* App Info Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center">
              {/* App Icon */}
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-lg">
                <Smartphone className="h-10 w-10 text-primary-foreground" />
              </div>

              <h2 className="mb-1 text-xl font-bold text-foreground">
                Trading Alerts
              </h2>
              <p className="mb-3 text-sm text-muted-foreground">
                Your mobile trading companion
              </p>

              <button
                onClick={handleVersionTap}
                className="flex items-center gap-2"
              >
                <Badge variant="secondary" className="text-xs">
                  Version {appInfo.version}
                </Badge>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Version Details */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wide text-muted-foreground">
              <Info className="h-4 w-4" />
              App Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Version</span>
              <span className="text-sm font-medium text-foreground">
                {appInfo.version}
              </span>
            </div>
            <Separator />
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Build</span>
              <span className="text-sm font-medium text-foreground">
                {appInfo.build}
              </span>
            </div>
            <Separator />
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Platform</span>
              <span className="text-sm font-medium text-foreground">
                {appInfo.platform}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Legal Section */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wide text-muted-foreground">
              <Scale className="h-4 w-4" />
              Legal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 p-2">
            {legalLinks.map((link) => (
              <button
                key={link.label}
                onClick={() => handleLegalLink(link.url, link.label)}
                className="flex w-full items-center gap-3 rounded-lg p-3 transition-colors hover:bg-accent"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                  <link.icon className="h-5 w-5 text-secondary-foreground" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-foreground">{link.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {link.description}
                  </p>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Credits */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wide text-muted-foreground">
              <Code className="h-4 w-4" />
              Credits
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-2 text-center">
              <p className="text-sm text-muted-foreground">
                Built with React, Tailwind CSS, and shadcn/ui
              </p>
              <p className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                Made with{' '}
                <Heart className="h-4 w-4 fill-red-500 text-red-500" /> by the
                Trading Alerts Team
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Copyright */}
        <p className="py-4 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Trading Alerts. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default AboutLegal;
