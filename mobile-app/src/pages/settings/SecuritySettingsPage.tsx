import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ShieldCheck,
  Lock,
  Smartphone,
  ChevronRight,
  Key,
  QrCode,
  Copy,
  Fingerprint,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

export default function SecuritySettingsPage() {
  const navigate = useNavigate();
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);
  const [biometricsEnabled, setBiometricsEnabled] = useState(true);
  const [is2faModalOpen, setIs2faModalOpen] = useState(false);
  const [totpCode, setTotpCode] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    toast.success('Password changed successfully');
    setCurrentPassword('');
    setNewPassword('');
  };

  const handleVerifyTotp = (e: React.FormEvent) => {
    e.preventDefault();
    if (totpCode.length !== 6) {
      toast.error('Please enter 6-digit TOTP code');
      return;
    }
    setTwoFactorEnabled(true);
    setIs2faModalOpen(false);
    toast.success('Two-Factor Authentication is now armed!');
  };

  const getPasswordStrength = () => {
    if (!newPassword) return 0;
    let score = 0;
    if (newPassword.length >= 6) score += 25;
    if (newPassword.length >= 10) score += 25;
    if (/[A-Z]/.test(newPassword)) score += 25;
    if (/[0-9!@#$%^&*]/.test(newPassword)) score += 25;
    return score;
  };

  const strength = getPasswordStrength();

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => navigate(-1)}
          className="h-8 w-8 rounded-xl"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-lg font-black text-foreground">Security & 2FA</h1>
          <p className="text-xs text-muted-foreground">
            Protect your trading account
          </p>
        </div>
      </div>

      {/* 2FA Card */}
      <Card className="border-border/80 bg-card">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">
                Two-Factor Authentication (TOTP)
              </div>
              <div className="text-[10px] text-muted-foreground">
                Google Authenticator / Authy
              </div>
            </div>
          </div>

          <Dialog open={is2faModalOpen} onOpenChange={setIs2faModalOpen}>
            <DialogTrigger asChild>
              <Button
                variant={twoFactorEnabled ? 'outline' : 'default'}
                size="sm"
                className="h-8 text-xs font-bold"
              >
                {twoFactorEnabled ? 'Configured' : 'Setup 2FA'}
              </Button>
            </DialogTrigger>

            <DialogContent className="max-w-xs border-border/80 bg-card">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-sm font-black text-foreground">
                  <QrCode className="h-4 w-4 text-amber-500" />
                  Scan Authenticator QR
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-3 p-2 text-center">
                {/* QR Code Placeholder */}
                <div className="mx-auto flex h-36 w-36 items-center justify-center rounded-2xl border bg-white p-2 shadow-inner">
                  <QrCode className="h-28 w-28 text-slate-950" />
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground">
                    Or enter manual key:
                  </span>
                  <div className="flex items-center justify-between rounded-xl bg-muted/60 p-2 font-mono text-xs font-bold">
                    <span>JBSW Y3DP EHPK 3PXP</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText('JBSWY3DPEHPK3PXP');
                        toast.success('Key copied!');
                      }}
                      className="p-1 hover:text-amber-500"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <form onSubmit={handleVerifyTotp} className="space-y-2 pt-1">
                  <Input
                    type="text"
                    maxLength={6}
                    value={totpCode}
                    onChange={(e) =>
                      setTotpCode(e.target.value.replace(/\D/g, ''))
                    }
                    placeholder="000000"
                    className="h-11 text-center font-mono text-lg font-black tracking-widest"
                    required
                  />
                  <Button
                    type="submit"
                    className="h-10 w-full bg-amber-500 text-xs font-bold text-slate-950 hover:bg-amber-400"
                  >
                    Confirm & Enable 2FA
                  </Button>
                </form>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* Biometric FaceID / TouchID Toggle */}
      <Card className="border-border/80 bg-card">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/20 text-primary">
              <Fingerprint className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">
                Biometric Login (FaceID / Fingerprint)
              </div>
              <div className="text-[10px] text-muted-foreground">
                Fast native unlock on mobile devices
              </div>
            </div>
          </div>
          <Switch
            checked={biometricsEnabled}
            onCheckedChange={(checked) => {
              setBiometricsEnabled(checked);
              toast.info(`Biometrics ${checked ? 'Armed' : 'Disabled'}`);
            }}
          />
        </CardContent>
      </Card>

      {/* Activity Log Link */}
      <Card
        onClick={() => navigate('/settings/security/activity')}
        className="cursor-pointer border-border/80 bg-card hover:bg-muted/20"
      >
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">
                Security Activity Log
              </div>
              <div className="text-[10px] text-muted-foreground">
                Device login history & active sessions
              </div>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </CardContent>
      </Card>

      {/* Change Password Form */}
      <Card className="border-border/80 bg-card shadow-xl">
        <CardContent className="p-5">
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Change Password
            </h3>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">
                Current Password
              </label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="text-xs"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">
                New Password
              </label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="text-xs"
                required
              />

              {/* Password Strength Meter */}
              {newPassword && (
                <div className="space-y-1 pt-1">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full transition-all ${
                        strength < 50
                          ? 'bg-rose-500'
                          : strength < 75
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                      }`}
                      style={{ width: `${strength}%` }}
                    />
                  </div>
                  <span className="block text-right text-[9px] font-semibold text-muted-foreground">
                    {strength < 50
                      ? 'Weak'
                      : strength < 75
                        ? 'Moderate'
                        : 'Strong'}
                  </span>
                </div>
              )}
            </div>

            <Button
              type="submit"
              className="mt-2 h-11 w-full bg-amber-500 text-xs font-bold text-slate-950 hover:bg-amber-400"
            >
              <Key className="mr-2 h-4 w-4" />
              <span>Update Password</span>
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
