import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  User,
  Mail,
  Award,
  Camera,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function ProfileSettingsPage() {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [email] = useState(user?.email || '');
  const [experience, setExperience] = useState<
    'beginner' | 'intermediate' | 'institutional'
  >('intermediate');
  const [favoriteSymbol, setFavoriteSymbol] = useState('XAUUSD');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateUser({ name });
    toast.success('Profile preferences updated successfully');
  };

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
          <h1 className="text-lg font-black text-foreground">User Profile</h1>
          <p className="text-xs text-muted-foreground">
            Manage your trader identity & preferences
          </p>
        </div>
      </div>

      {/* Avatar Card */}
      <Card className="border-border/80 bg-card">
        <CardContent className="flex items-center gap-4 p-4">
          <div className="relative">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl border-2 border-amber-500/30 bg-amber-500/20 text-xl font-black text-amber-500">
              {name.charAt(0) || 'U'}
            </div>
            <button
              type="button"
              onClick={() =>
                toast.info('Avatar upload: Select image from photo library')
              }
              className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-slate-950 shadow-md"
            >
              <Camera className="h-3.5 w-3.5" />
            </button>
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">
              {name || 'Trader'}
            </h3>
            <p className="text-xs text-muted-foreground">{email}</p>
            <Badge variant="outline" className="mt-1 font-mono text-[9px]">
              Role: {user?.role}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-card shadow-xl">
        <CardContent className="p-5">
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">
                Display Name
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-10 text-xs"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={email}
                  disabled
                  className="pl-10 text-xs opacity-70"
                />
              </div>
              <span className="text-[10px] text-muted-foreground">
                Email is verified and linked to your SaaS subscription.
              </span>
            </div>

            {/* Trading Experience Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Trading Experience
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'beginner', label: 'Beginner', desc: '< 1 Year' },
                  {
                    id: 'intermediate',
                    label: 'Pro Trader',
                    desc: '1-3 Years',
                  },
                  {
                    id: 'institutional',
                    label: 'Institutional',
                    desc: '3+ Years',
                  },
                ].map((lvl) => (
                  <button
                    key={lvl.id}
                    type="button"
                    onClick={() => setExperience(lvl.id as any)}
                    className={`flex flex-col justify-between rounded-xl border p-2.5 text-left transition-all ${
                      experience === lvl.id
                        ? 'border-amber-500 bg-amber-500/15 text-foreground'
                        : 'border-border/60 bg-muted/20 text-muted-foreground'
                    }`}
                  >
                    <span className="text-xs font-bold">{lvl.label}</span>
                    <span className="text-[9px] text-muted-foreground">
                      {lvl.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <Button
              type="submit"
              className="mt-2 h-11 w-full bg-amber-500 font-bold text-slate-950 hover:bg-amber-400"
            >
              <Save className="mr-2 h-4 w-4" />
              <span>Save Profile Preferences</span>
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
