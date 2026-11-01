import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, User, Tag, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function AffiliateProfilePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [partnerName, setPartnerName] = useState(user?.name || '');
  const [channelUrl, setChannelUrl] = useState('https://t.me/davintrade_vip');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Partner profile saved!');
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
          <h1 className="text-lg font-black text-foreground">
            Partner Profile
          </h1>
          <p className="text-xs text-muted-foreground">
            Affiliate contact & channel info
          </p>
        </div>
      </div>

      <Card className="border-border/80 bg-card shadow-xl">
        <CardContent className="p-5">
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">
                Partner Name
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={partnerName}
                  onChange={(e) => setPartnerName(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">
                Default Referral Code
              </label>
              <div className="relative">
                <Tag className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={user?.affiliateCode || 'DAVIN_VIP'}
                  disabled
                  className="pl-10 font-mono font-bold opacity-70"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">
                Public Community Channel
              </label>
              <div className="relative">
                <Globe className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={channelUrl}
                  onChange={(e) => setChannelUrl(e.target.value)}
                  className="pl-10 text-xs"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="mt-2 h-11 w-full bg-amber-500 font-bold text-slate-950 hover:bg-amber-400"
            >
              <Save className="mr-2 h-4 w-4" />
              <span>Save Partner Details</span>
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
