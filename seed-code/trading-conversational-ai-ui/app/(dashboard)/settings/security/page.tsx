'use client';

import { useState } from 'react';
import AppHeader from '@/components/layout/app-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Lock, Smartphone, Laptop, Trash2 } from 'lucide-react';

export default function SecuritySettingsPage() {
  const [is2faEnabled, setIs2faEnabled] = useState(true);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const activeSessions = [
    {
      id: '1',
      device: 'Chrome on Windows 11',
      location: 'New York, US',
      ip: '192.168.1.1',
      lastActive: 'Active Now',
      current: true,
    },
    {
      id: '2',
      device: 'Safari on iPhone 15',
      location: 'London, UK',
      ip: '10.0.0.42',
      lastActive: '2 hours ago',
      current: false,
    },
  ];

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#06070a] select-none">
      <AppHeader
        title="Security & 2FA Settings"
        subtitle="Password Management, Two-Factor Authentication & Active Sessions"
      />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 p-4 md:p-6">
        {/* 2FA Card */}
        <div className="space-y-4 rounded-2xl border border-slate-800/80 bg-[#090c14] p-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-amber-400" />
              <div>
                <h2 className="text-sm font-extrabold text-slate-100">
                  Two-Factor Authentication (TOTP)
                </h2>
                <p className="text-[11px] text-slate-400">
                  Secure your account with Google Authenticator or Authy
                </p>
              </div>
            </div>

            <Switch checked={is2faEnabled} onCheckedChange={setIs2faEnabled} />
          </div>

          {is2faEnabled && (
            <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
              <span className="font-semibold">✓ 2FA Authentication Active</span>
              <Button
                size="sm"
                variant="outline"
                className="h-6 border-emerald-500/40 text-[10px]"
              >
                View Backup Codes
              </Button>
            </div>
          )}
        </div>

        {/* Change Password Card */}
        <div className="space-y-4 rounded-2xl border border-slate-800/80 bg-[#090c14] p-6 shadow-xl">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Lock className="h-5 w-5 text-amber-400" />
            <h2 className="text-sm font-extrabold text-slate-100">
              Change Master Password
            </h2>
          </div>

          <form className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300">
                Current Password
              </Label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••••••"
                className="border-slate-750 bg-[#06080e] text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300">
                New Password
              </Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••••••"
                className="border-slate-750 bg-[#06080e] text-xs"
              />
            </div>

            <Button className="h-9 bg-gradient-to-r from-amber-500 to-amber-600 text-xs font-extrabold text-slate-950 hover:from-amber-400 hover:to-amber-500">
              Update Password
            </Button>
          </form>
        </div>

        {/* Active Sessions Card */}
        <div className="space-y-4 rounded-2xl border border-slate-800/80 bg-[#090c14] p-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-extrabold text-slate-100">
              Active Login Sessions
            </h2>
            <Badge className="border-slate-700 bg-slate-800 font-mono text-[9px] text-slate-300">
              {activeSessions.length} Devices
            </Badge>
          </div>

          <div className="divide-y divide-slate-800/60">
            {activeSessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between py-3 text-xs"
              >
                <div className="flex items-center gap-3">
                  {session.device.includes('iPhone') ? (
                    <Smartphone className="h-5 w-5 shrink-0 text-amber-400" />
                  ) : (
                    <Laptop className="h-5 w-5 shrink-0 text-amber-400" />
                  )}
                  <div>
                    <div className="flex items-center gap-2 font-bold text-slate-200">
                      {session.device}
                      {session.current && (
                        <Badge className="border-emerald-500/40 bg-emerald-500/15 font-mono text-[8px] text-emerald-400">
                          This Device
                        </Badge>
                      )}
                    </div>
                    <div className="font-mono text-[10px] text-slate-400">
                      {session.ip} • {session.location} • {session.lastActive}
                    </div>
                  </div>
                </div>

                {!session.current && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-rose-400 hover:bg-rose-500/20"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
