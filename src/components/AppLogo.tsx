import { APP_LOGO_PATH, APP_NAME } from '@/constants/appBrand';
import { cn } from '@/lib/utils';

interface AppLogoProps {
  className?: string;
  alt?: string;
}

const AppLogo = ({ className, alt = `${APP_NAME} logo` }: AppLogoProps) => (
  <img
    src={APP_LOGO_PATH}
    alt={alt}
    className={cn('block', className)}
    decoding="async"
  />
);

export default AppLogo;
