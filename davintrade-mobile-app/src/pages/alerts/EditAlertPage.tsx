import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Trash2, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useNotifications } from '@/contexts/NotificationContext';
import { toast } from 'sonner';

export default function EditAlertPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { alerts, deleteAlert, playAlertChime } = useNotifications();

  const existing = alerts.find((a) => a.id === id) || alerts[0];

  const [targetPrice, setTargetPrice] = useState(
    existing ? existing.targetPrice.toString() : '2650.00'
  );
  const [sound, setSound] = useState(
    existing ? existing.sound : 'chime_crystal'
  );
  const [note, setNote] = useState(existing?.note || '');

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Alert settings updated successfully');
    navigate('/alerts');
  };

  const handleDelete = () => {
    if (existing) {
      deleteAlert(existing.id);
      navigate('/alerts');
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
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
              Edit Alert Rule
            </h1>
            <p className="text-xs text-muted-foreground">
              {existing?.symbol} • {existing?.timeframe}
            </p>
          </div>
        </div>

        <Button
          variant="destructive"
          size="sm"
          onClick={handleDelete}
          className="h-8 gap-1 text-xs"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>Delete</span>
        </Button>
      </div>

      <Card className="border-border/80 bg-card shadow-xl">
        <CardContent className="p-5">
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Target Price ($)
              </label>
              <Input
                type="number"
                step="any"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                className="h-12 font-mono text-lg font-bold"
                required
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground">
                  Alert Chime
                </label>
                <button
                  type="button"
                  onClick={() => playAlertChime('breakout')}
                  className="flex items-center gap-1 text-[11px] font-bold text-amber-500 hover:underline"
                >
                  <Volume2 className="h-3 w-3" />
                  <span>Preview Audio</span>
                </button>
              </div>
              <Select value={sound} onValueChange={setSound}>
                <SelectTrigger className="h-11 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="chime_crystal">
                    Crystal Chime (High Priority)
                  </SelectItem>
                  <SelectItem value="chime_bell">Trading Bell Chime</SelectItem>
                  <SelectItem value="radar_beep">MT5 Radar Beep</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">
                Note / Strategy Tag
              </label>
              <Input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Alert note..."
                className="text-xs"
              />
            </div>

            <Button
              type="submit"
              className="mt-2 h-11 w-full bg-amber-500 font-bold text-slate-950 shadow-md shadow-amber-500/25 hover:bg-amber-400"
            >
              <Save className="mr-2 h-4 w-4" />
              <span>Save Changes</span>
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
