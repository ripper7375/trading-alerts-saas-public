import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Fingerprint, ArrowRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

export default function Verify2FAPage() {
  const navigate = useNavigate();
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    const clean = value.replace(/\D/g, '');
    const newDigits = [...digits];

    if (clean.length > 1) {
      // Paste detected
      const chars = clean.slice(0, 6).split('');
      for (let i = 0; i < 6; i++) {
        newDigits[i] = chars[i] || '';
      }
      setDigits(newDigits);
      inputsRef.current[Math.min(chars.length, 5)]?.focus();
      return;
    }

    newDigits[index] = clean;
    setDigits(newDigits);

    if (clean && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const code = digits.join('');
    if (code.length !== 6) {
      toast.error('Please enter all 6 digits');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.success('2FA verification successful!');
      navigate('/terminal');
    }, 800);
  };

  const handleBiometricAuth = () => {
    toast.success('Biometric FaceID / Fingerprint recognized!');
    navigate('/terminal');
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-4">
      <Card className="w-full max-w-sm border-border/80 bg-card shadow-2xl">
        <CardContent className="space-y-5 p-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-500">
            <ShieldCheck className="h-8 w-8" />
          </div>

          <div>
            <h1 className="text-xl font-black text-foreground">
              Two-Factor Authentication
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Enter the 6-digit code from Google Authenticator or Authy
            </p>
          </div>

          <form onSubmit={handleVerify} className="space-y-4">
            {/* 6 Digit Input Boxes */}
            <div className="flex justify-center gap-2">
              {digits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => (inputsRef.current[idx] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  className="h-12 w-11 rounded-xl border border-input bg-background text-center font-mono text-lg font-black text-foreground focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              ))}
            </div>

            <Button
              type="submit"
              disabled={loading || digits.join('').length < 6}
              className="h-11 w-full bg-amber-500 text-xs font-bold text-slate-950 hover:bg-amber-400"
            >
              <span>{loading ? 'Verifying...' : 'Authenticate'}</span>
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>

          {/* Biometric Fallback Button */}
          <div className="border-t border-border/60 pt-2">
            <Button
              variant="outline"
              type="button"
              onClick={handleBiometricAuth}
              className="h-10 w-full gap-2 text-xs font-bold"
            >
              <Fingerprint className="h-4 w-4 text-primary" />
              <span>Use Biometric FaceID / Fingerprint</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
