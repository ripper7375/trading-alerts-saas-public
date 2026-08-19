import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tag, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function AffiliateRegisterPage() {
  const navigate = useNavigate();
  const { switchRole } = useAuth();
  const [customCode, setCustomCode] = useState('');
  const [channelUrl, setChannelUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customCode) {
      toast.error('Please enter a desired referral code');
      return;
    }
    toast.success('Affiliate partner account registered!');
    switchRole('AF'); // Switch role to Affiliate+Free
    navigate('/affiliate/dashboard');
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-black text-foreground">
          Affiliate Registration
        </h1>
        <p className="text-xs text-muted-foreground">
          Setup your custom referral code
        </p>
      </div>

      <Card className="border-border/80 bg-card shadow-xl">
        <CardContent className="p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">
                Desired Referral Code
              </label>
              <div className="relative">
                <Tag className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
                  placeholder="e.g. TRADER_VIP"
                  className="pl-10 font-mono font-bold uppercase"
                  required
                />
              </div>
              <span className="text-[10px] text-muted-foreground">
                Your link: https://davintrade.com/?ref={customCode || 'CODE'}
              </span>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">
                Community / Channel / Social URL
              </label>
              <Input
                value={channelUrl}
                onChange={(e) => setChannelUrl(e.target.value)}
                placeholder="https://t.me/your_channel or Twitter"
              />
            </div>

            <Button
              type="submit"
              className="mt-2 h-11 w-full bg-amber-500 font-bold text-slate-950 shadow-md shadow-amber-500/25 hover:bg-amber-400"
            >
              <span>Activate Affiliate Account</span>
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
