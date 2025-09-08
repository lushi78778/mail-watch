import * as React from 'react';
import { cn } from '../../lib/utils';

function Alert({ className, variant = 'default', ...props }) {
  return (
    <div
      role="alert"
      className={cn(
        'relative w-full rounded-lg border p-4',
        variant === 'destructive' && 'border-destructive/50 text-destructive',
        className
      )}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }) {
  return <h5 className={cn('mb-1 font-medium leading-none tracking-tight', className)} {...props} />;
}

function AlertDescription({ className, ...props }) {
  return <div className={cn('text-sm [&_p]:leading-relaxed text-muted-foreground', className)} {...props} />;
}

export { Alert, AlertTitle, AlertDescription };

