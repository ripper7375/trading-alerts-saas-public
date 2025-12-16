'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Zod validation schema
const alertSchema = z.object({
  symbol: z.string().min(1, 'Symbol is required'),
  timeframe: z.string().min(1, 'Timeframe is required'),
  alertType: z.enum(['near', 'cross', 'fractal'], {
    errorMap: () => ({ message: 'Select an alert type' }),
  }),
  targetLine: z.string().min(1, 'Select a target line'),
  tolerance: z.number().min(0.05).max(1.0),
  notifications: z
    .object({
      email: z.boolean(),
      push: z.boolean(),
      sms: z.boolean(),
    })
    .refine((data) => data.email || data.push || data.sms, {
      message: 'Select at least one notification method',
    }),
  name: z.string().max(50, 'Name must be 50 characters or less').optional(),
});

type AlertFormData = z.infer<typeof alertSchema>;

interface TargetLine {
  id: string;
  type: string;
  price: number;
  name: string;
  color: 'red' | 'green' | 'blue' | 'orange';
  icon: string;
}

interface PrefilledData {
  symbol: string;
  timeframe: string;
  targetLine: string;
}

interface CreateAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefilledData: PrefilledData;
  userTier: 'FREE' | 'PRO';
  currentAlertCount: number;
}

// Mock target lines data
const TARGET_LINES: TargetLine[] = [
  {
    id: 'p-p1',
    type: 'Resistance',
    price: 2655.2,
    name: 'P-P1',
    color: 'red',
    icon: '🔴',
  },
  {
    id: 'b-b1',
    type: 'Support',
    price: 2645.0,
    name: 'B-B1',
    color: 'green',
    icon: '🟢',
  },
  {
    id: 'b-p1',
    type: 'Ascending Support',
    price: 2648.3,
    name: 'B-P1',
    color: 'blue',
    icon: '🔵',
  },
  {
    id: 'p-b1',
    type: 'Descending Resistance',
    price: 2652.5,
    name: 'P-B1',
    color: 'orange',
    icon: '🟠',
  },
];

export default function CreateAlertModal({
  isOpen,
  onClose,
  prefilledData,
  userTier,
  currentAlertCount,
}: CreateAlertModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showLimitError, setShowLimitError] = useState(false);

  const maxAlerts = userTier === 'FREE' ? 5 : 20;
  const alertsRemaining = maxAlerts - currentAlertCount;
  const alertPercentage = (currentAlertCount / maxAlerts) * 100;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AlertFormData>({
    resolver: zodResolver(alertSchema),
    defaultValues: {
      symbol: prefilledData.symbol,
      timeframe: prefilledData.timeframe,
      alertType: 'near',
      targetLine: prefilledData.targetLine,
      tolerance: 0.1,
      notifications: {
        email: true,
        push: true,
        sms: userTier === 'PRO',
      },
      name: `${prefilledData.symbol} ${prefilledData.timeframe} Support ${TARGET_LINES.find((l) => l.id === prefilledData.targetLine)?.name || ''}`,
    },
  });

  const tolerance = watch('tolerance');
  const targetLineId = watch('targetLine');
  const alertType = watch('alertType');
  const notificationsEmail = watch('notifications.email');
  const notificationsPush = watch('notifications.push');
  const notificationsSms = watch('notifications.sms');
  const alertName = watch('name') || '';

  const selectedLine = TARGET_LINES.find((l) => l.id === targetLineId);
  const targetPrice = selectedLine?.price || 0;
  const toleranceDollar = (targetPrice * tolerance) / 100;
  const minPrice = targetPrice - toleranceDollar;
  const maxPrice = targetPrice + toleranceDollar;

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  const onSubmit = async (data: AlertFormData) => {
    // Check tier limit
    if (currentAlertCount >= maxAlerts) {
      setShowLimitError(true);
      return;
    }

    setIsLoading(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));

    setIsLoading(false);
    setShowSuccess(true);

    // Auto-close after success animation
    setTimeout(() => {
      setShowSuccess(false);
      onClose();
    }, 2000);

    console.log('Alert created:', data);
  };

  if (!isOpen) return null;

  // Limit error modal
  if (showLimitError) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        onClick={() => setShowLimitError(false)}
      >
        <div
          className="max-w-md rounded-2xl bg-white p-8 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-4 text-center text-6xl">❌</div>
          <h2 className="mb-4 text-center text-3xl font-bold text-gray-900">
            Alert Limit Reached
          </h2>
          <p className="mb-6 text-center text-gray-600">
            You've reached your {userTier} tier limit of {maxAlerts} alerts.
            {userTier === 'FREE' && ' Upgrade to PRO for 20 alerts.'}
          </p>
          <div className="flex gap-4">
            {userTier === 'FREE' && (
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                onClick={() => console.log('Upgrade clicked')}
              >
                Upgrade to PRO
              </Button>
            )}
            <Button
              variant="outline"
              className="flex-1 bg-transparent"
              onClick={() => {
                setShowLimitError(false);
                onClose();
              }}
            >
              Manage Existing Alerts
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (showSuccess) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="animate-in fade-in zoom-in max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl duration-300">
          <div className="mb-4 text-8xl animate-in zoom-in duration-500">
            ✅
          </div>
          <h2 className="mb-2 text-2xl font-bold text-green-600">
            Alert created successfully!
          </h2>
          <p className="text-gray-600">
            You'll be notified when price reaches ${targetPrice.toFixed(2)} ±
            {tolerance.toFixed(2)}%
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="animate-in slide-in-from-bottom fade-in max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-8 shadow-2xl duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 cursor-pointer text-3xl text-gray-400 transition-colors hover:text-gray-600"
        >
          ×
        </button>

        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mb-4 text-5xl">🔔</div>
          <h1 className="mb-2 text-3xl font-bold text-gray-900">
            Create Price Alert
          </h1>
          <p className="text-gray-600">
            Get notified when price reaches your target
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Symbol Field (Locked) */}
          <div>
            <Label className="mb-2 block font-medium text-gray-700">
              Symbol
            </Label>
            <div className="relative">
              <Input
                {...register('symbol')}
                value={prefilledData.symbol}
                disabled
                className="cursor-not-allowed bg-gray-100 pr-10 opacity-70"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                🔒
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-500">(Selected from chart)</p>
          </div>

          {/* Timeframe Field (Locked) */}
          <div>
            <Label className="mb-2 block font-medium text-gray-700">
              Timeframe
            </Label>
            <div className="relative">
              <Input
                {...register('timeframe')}
                value={prefilledData.timeframe}
                disabled
                className="cursor-not-allowed bg-gray-100 pr-10 opacity-70"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                🔒
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-500">(Selected from chart)</p>
          </div>

          {/* Alert Type (Radio buttons) */}
          <div>
            <Label className="mb-3 block font-medium text-gray-700">
              Alert Type
            </Label>
            <RadioGroup
              value={alertType}
              onValueChange={(value) =>
                setValue('alertType', value as 'near' | 'cross' | 'fractal')
              }
              className="space-y-3"
            >
              <div
                className={`cursor-pointer rounded-lg border-2 p-4 transition-all hover:border-blue-500 ${
                  alertType === 'near'
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200'
                }`}
                onClick={() => setValue('alertType', 'near')}
              >
                <div className="flex items-center">
                  <RadioGroupItem value="near" id="near" />
                  <Label htmlFor="near" className="ml-2 cursor-pointer">
                    Price near Support/Resistance
                  </Label>
                </div>
                <p className="ml-6 text-sm text-gray-500">
                  Alert when price comes within tolerance range
                </p>
              </div>

              <div
                className={`cursor-pointer rounded-lg border-2 p-4 transition-all hover:border-blue-500 ${
                  alertType === 'cross'
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200'
                }`}
                onClick={() => setValue('alertType', 'cross')}
              >
                <div className="flex items-center">
                  <RadioGroupItem value="cross" id="cross" />
                  <Label htmlFor="cross" className="ml-2 cursor-pointer">
                    Price crosses Support/Resistance
                  </Label>
                </div>
                <p className="ml-6 text-sm text-gray-500">
                  Alert only when price breaks through the level
                </p>
              </div>

              <div
                className={`cursor-pointer rounded-lg border-2 p-4 transition-all hover:border-blue-500 ${
                  alertType === 'fractal'
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200'
                }`}
                onClick={() => setValue('alertType', 'fractal')}
              >
                <div className="flex items-center">
                  <RadioGroupItem value="fractal" id="fractal" />
                  <Label htmlFor="fractal" className="ml-2 cursor-pointer">
                    New fractal detected
                  </Label>
                </div>
                <p className="ml-6 text-sm text-gray-500">
                  Alert when new fractal pattern forms
                </p>
              </div>
            </RadioGroup>
            {errors.alertType && (
              <p className="mt-1 text-sm text-red-600">
                {errors.alertType.message}
              </p>
            )}
          </div>

          {/* Target Line (Dropdown) */}
          <div>
            <Label className="mb-2 block font-medium text-gray-700">
              Target Line
            </Label>
            <Select
              value={targetLineId}
              onValueChange={(value) => setValue('targetLine', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TARGET_LINES.map((line) => (
                  <SelectItem key={line.id} value={line.id}>
                    <div className="flex items-center gap-2">
                      <span>{line.icon}</span>
                      <span>
                        {line.name}: ${line.price.toFixed(2)} ({line.type})
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.targetLine && (
              <p className="mt-1 text-sm text-red-600">
                {errors.targetLine.message}
              </p>
            )}
          </div>

          {/* Tolerance Slider */}
          <div>
            <Label className="mb-2 block font-medium text-gray-700">
              Tolerance
            </Label>
            <div className="mb-2 text-center">
              <span className="text-2xl font-bold text-blue-600">
                ± {tolerance.toFixed(2)}%
              </span>
              <span className="ml-2 text-gray-600">
                (±${toleranceDollar.toFixed(2)})
              </span>
            </div>
            <Slider
              value={[tolerance]}
              onValueChange={(value) => setValue('tolerance', value[0])}
              min={0.05}
              max={1.0}
              step={0.05}
              className="mb-3"
            />
            <div className="mt-3 rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
              <p className="mb-2 text-sm text-gray-700">
                Alert will trigger when price reaches:
              </p>
              <p className="text-xl font-bold text-gray-900">
                ${minPrice.toFixed(2)} - ${maxPrice.toFixed(2)}
              </p>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full bg-blue-600"
                  style={{ width: `${(tolerance / 1.0) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Notification Methods (Checkboxes) */}
          <div>
            <Label className="mb-3 block font-medium text-gray-700">
              Notification Method
            </Label>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="email"
                  checked={notificationsEmail}
                  onCheckedChange={(checked) =>
                    setValue('notifications.email', checked as boolean)
                  }
                />
                <Label
                  htmlFor="email"
                  className="flex cursor-pointer items-center gap-2"
                >
                  <span>✉️</span>
                  <span>Email</span>
                </Label>
              </div>

              <div className="flex items-center space-x-3">
                <Checkbox
                  id="push"
                  checked={notificationsPush}
                  onCheckedChange={(checked) =>
                    setValue('notifications.push', checked as boolean)
                  }
                />
                <Label
                  htmlFor="push"
                  className="flex cursor-pointer items-center gap-2"
                >
                  <span>📱</span>
                  <span>Push Notification</span>
                </Label>
              </div>

              <div className="flex items-center space-x-3">
                <Checkbox
                  id="sms"
                  checked={notificationsSms}
                  onCheckedChange={(checked) =>
                    setValue('notifications.sms', checked as boolean)
                  }
                  disabled={userTier === 'FREE'}
                />
                <Label
                  htmlFor="sms"
                  className={`flex cursor-pointer items-center gap-2 ${
                    userTier === 'FREE' ? 'cursor-not-allowed opacity-50' : ''
                  }`}
                  title={
                    userTier === 'FREE'
                      ? 'Upgrade to PRO to enable SMS notifications'
                      : ''
                  }
                >
                  <span>💬</span>
                  <span>SMS {userTier === 'FREE' && '(PRO only) 🔒'}</span>
                </Label>
              </div>
            </div>
            {errors.notifications && (
              <p className="mt-2 text-sm text-red-600">
                {errors.notifications.message}
              </p>
            )}
          </div>

          {/* Alert Name (Optional) */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label className="font-medium text-gray-700">
                Alert Name (optional)
              </Label>
              <span className="text-xs text-gray-500">
                {alertName.length}/50
              </span>
            </div>
            <Input
              {...register('name')}
              placeholder="e.g., Gold H1 Support B-B1"
              maxLength={50}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

          {/* Tier Validation Warning */}
          <div
            className={`rounded-lg border-l-4 p-4 ${
              userTier === 'FREE'
                ? 'border-yellow-500 bg-yellow-50'
                : 'border-green-500 bg-green-50'
            }`}
          >
            <p
              className={`mb-2 font-semibold ${userTier === 'FREE' ? 'text-yellow-800' : 'text-green-800'}`}
            >
              {userTier === 'FREE' ? '⚠️' : '✓'} Alerts Used:{' '}
              {currentAlertCount}/{maxAlerts} ({userTier} Tier)
            </p>
            <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className={`h-full ${userTier === 'FREE' ? 'bg-yellow-500' : 'bg-green-500'}`}
                style={{ width: `${alertPercentage}%` }}
              />
            </div>
            {userTier === 'FREE' && (
              <>
                <p className="mb-1 text-sm text-yellow-700">
                  You have {alertsRemaining} alert
                  {alertsRemaining !== 1 ? 's' : ''} remaining. Upgrade to PRO
                  for 20 alerts.
                </p>
                <a
                  href="#"
                  className="text-sm text-blue-600 underline"
                  onClick={(e) => {
                    e.preventDefault();
                    console.log('See upgrade options');
                  }}
                >
                  See upgrade options
                </a>
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="px-6 py-3 bg-transparent"
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-blue-600 px-8 py-3 font-semibold shadow-lg hover:bg-blue-700"
            >
              {isLoading ? (
                <>
                  <svg
                    className="mr-2 h-4 w-4 animate-spin"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Creating...
                </>
              ) : (
                'Create Alert'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
