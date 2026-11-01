import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

export default function AffiliateStatementsPage() {
  const navigate = useNavigate();

  const STATEMENTS = [
    {
      month: 'July 2026',
      amount: '$382.50',
      referrals: 14,
      format: 'PDF & CSV',
    },
    {
      month: 'June 2026',
      amount: '$294.00',
      referrals: 11,
      format: 'PDF & CSV',
    },
    { month: 'May 2026', amount: '$180.20', referrals: 7, format: 'PDF & CSV' },
  ];

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
            Monthly Statements
          </h1>
          <p className="text-xs text-muted-foreground">
            Download tax and revenue reports
          </p>
        </div>
      </div>

      <div className="space-y-2.5">
        {STATEMENTS.map((s) => (
          <Card key={s.month} className="border-border/80 bg-card">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/60 text-foreground">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-foreground">
                    {s.month}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Earnings: {s.amount} • {s.referrals} active referrals
                  </div>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  toast.success(`Statement for ${s.month} downloaded (CSV/PDF)`)
                }
                className="h-8 gap-1.5 text-xs font-semibold"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download</span>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
