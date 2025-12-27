'use client';

import { useToast } from '@/hooks/use-toast';
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/ui/toast';

/**
 * Toaster component for displaying toast notifications
 *
 * Place this component at the root of your layout to enable toast notifications.
 * Use the useToast hook to trigger toasts from any component.
 *
 * @example
 * ```tsx
 * // In your layout
 * export default function Layout({ children }) {
 *   return (
 *     <>
 *       {children}
 *       <Toaster />
 *     </>
 *   );
 * }
 *
 * // In your component
 * function MyComponent() {
 *   const { success, error } = useToast();
 *
 *   const handleAction = async () => {
 *     try {
 *       await doSomething();
 *       success('Action completed', 'Your changes have been saved.');
 *     } catch (err) {
 *       error('Action failed', 'Please try again.');
 *     }
 *   };
 *
 *   return <button onClick={handleAction}>Do Action</button>;
 * }
 * ```
 */
export function Toaster(): React.ReactElement {
  const { toasts, removeToast } = useToast();

  // Map toast types to variants
  const getVariant = (
    type: 'success' | 'error' | 'warning' | 'info'
  ): 'default' | 'destructive' | 'success' | 'warning' => {
    switch (type) {
      case 'success':
        return 'success';
      case 'error':
        return 'destructive';
      case 'warning':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <ToastProvider>
      {toasts.map(({ id, title, description, type }) => (
        <Toast
          key={id}
          variant={getVariant(type)}
          onOpenChange={(open) => {
            if (!open) {
              removeToast(id);
            }
          }}
        >
          <div className="grid gap-1">
            {title && <ToastTitle>{title}</ToastTitle>}
            {description && <ToastDescription>{description}</ToastDescription>}
          </div>
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}

export default Toaster;
