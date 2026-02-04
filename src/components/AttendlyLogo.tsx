import { cn } from '@/lib/utils';

interface AttendlyLogoProps {
  className?: string;
  alt?: string;
}

const AttendlyLogo = ({ className, alt = 'Attendly logo' }: AttendlyLogoProps) => (
  <img
    src="/attendly-logo.svg"
    alt={alt}
    className={cn('block', className)}
    decoding="async"
  />
);

export default AttendlyLogo;
