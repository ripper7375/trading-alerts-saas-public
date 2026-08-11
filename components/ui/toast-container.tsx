'use client';

import { X, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration: number;
}

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

const toastStyles: Record<
  ToastType,
  { bg: string; icon: string; border: string }
> = {
  success: {
    bg: 'bg-green-50 dark:bg-green-900/20',
    icon: 'text-green-500',
    border: 'border-green-200 dark:border-green-800',
  },
  error: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    icon: 'text-red-500',
    border: 'border-red-200 dark:border-red-800',
  },
  warning: {
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    icon: 'text-yellow-500',
    border: 'border-yellow-200 dark:border-yellow-800',
  },
  info: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    icon: 'text-blue-500',
    border: 'border-blue-200 dark:border-blue-800',
  },
};

const ToastIcon = ({
  type,
  className,
}: {
  type: ToastType;
  className?: string;
}) => {
  const iconProps = { className: cn('w-5 h-5', className) };
  switch (type) {
    case 'success':
      return <CheckCircle {...iconProps} />;
    case 'error':
      return <XCircle {...iconProps} />;
    case 'warning':
      return <AlertTriangle {...iconProps} />;
    case 'info':
      return <Info {...iconProps} />;
  }
};

export function ToastContainer({
  toasts,
  onDismiss,
}: ToastContainerProps): React.ReactElement | null {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-2">
      {toasts.map((toast) => {
        const styles = toastStyles[toast.type];
        return (
          <div
            key={toast.id}
            className={cn(
              'animate-in slide-in-from-right-full flex items-start gap-3 rounded-lg border p-4 shadow-lg duration-300',
              styles.bg,
              styles.border
            )}
            role="alert"
          >
            <ToastIcon type={toast.type} className={styles.icon} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {toast.title}
              </p>
              {toast.description && (
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  {toast.description}
                </p>
              )}
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-200"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default ToastContainer;
