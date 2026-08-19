import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const PaymentSuccess = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Auto-redirect after 10 seconds
    const timer = setTimeout(() => {
      navigate('/dashboard');
    }, 10000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
      {/* Success Animation */}
      <div className="relative mb-8">
        <div className="flex h-24 w-24 animate-pulse items-center justify-center rounded-full bg-green-500/10">
          <CheckCircle className="h-16 w-16 text-green-500" />
        </div>
        <Sparkles className="absolute -right-2 -top-2 h-6 w-6 animate-bounce text-primary" />
        <Sparkles className="absolute -bottom-1 -left-3 h-5 w-5 animate-bounce text-primary delay-150" />
      </div>

      {/* Success Message */}
      <h1 className="mb-2 text-center text-2xl font-bold text-foreground">
        Payment Successful!
      </h1>
      <p className="mb-8 max-w-sm text-center text-muted-foreground">
        Thank you for subscribing. Your account has been upgraded and you now
        have access to all premium features.
      </p>

      {/* Features Card */}
      <Card className="mb-8 w-full max-w-sm border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <h3 className="mb-3 font-medium text-foreground">What's included:</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 flex-shrink-0 text-green-500" />
              Unlimited watchlist items
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 flex-shrink-0 text-green-500" />
              Advanced alerts with conditions
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 flex-shrink-0 text-green-500" />
              Real-time price updates
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 flex-shrink-0 text-green-500" />
              Priority support
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="w-full max-w-sm space-y-3">
        <Button className="h-12 w-full" onClick={() => navigate('/dashboard')}>
          Go to Dashboard
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          className="h-12 w-full"
          onClick={() => navigate('/settings/subscription')}
        >
          View Subscription Details
        </Button>
      </div>

      {/* Auto-redirect notice */}
      <p className="mt-6 text-xs text-muted-foreground">
        You'll be redirected to the dashboard in a few seconds...
      </p>
    </div>
  );
};

export default PaymentSuccess;
