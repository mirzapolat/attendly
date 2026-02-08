import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Settings, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useConfirm } from '@/hooks/useConfirm';
import { supabase } from '@/integrations/supabase/client';
import AccountSettingsDialog from '@/components/AccountSettingsDialog';

const AccountMenu = () => {
  const { user, signOut } = useAuth();
  const { clearWorkspace } = useWorkspace();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState<string | null>(null);
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const loadProfileName = useCallback(async () => {
    if (!user?.id) {
      if (isMounted.current) {
        setFullName(null);
      }
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle();

    if (!isMounted.current) return;
    if (error) {
      setFullName(null);
      return;
    }

    const trimmed = data?.full_name?.trim();
    setFullName(trimmed ? trimmed : null);
  }, [user?.id]);

  useEffect(() => {
    loadProfileName();
  }, [loadProfileName]);

  const metaName =
    typeof user?.user_metadata?.full_name === 'string'
      ? user.user_metadata.full_name.trim()
      : null;
  const displayName = fullName ?? (metaName && metaName.length > 0 ? metaName : null);
  const displayEmail = user?.email ?? 'Signed in';

  const handleSignOut = async () => {
    const confirmed = await confirm({
      title: 'Sign out?',
      description: 'Are you sure you want to sign out?',
      confirmText: 'Sign out',
      cancelText: 'Cancel',
    });
    if (!confirmed) return;

    await signOut();
    clearWorkspace();
    navigate('/');
  };

  return (
    <>
      <DropdownMenu onOpenChange={(open) => open && loadProfileName()}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            title="Account"
            className="shadow-none hover:shadow-none"
          >
            <User className="w-5 h-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Account</span>
            {displayName ? (
              <>
                <span className="text-sm font-medium text-foreground truncate">
                  {displayName}
                </span>
                <span className="text-xs text-muted-foreground truncate">
                  {displayEmail}
                </span>
              </>
            ) : (
              <span className="text-sm font-medium text-foreground truncate">
                {displayEmail}
              </span>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => setAccountSettingsOpen(true)}
            className="cursor-pointer gap-2"
          >
            <Settings className="w-4 h-4" />
            Account settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={handleSignOut}
            className="cursor-pointer gap-2 text-destructive focus:text-destructive"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AccountSettingsDialog
        open={accountSettingsOpen}
        onOpenChange={(open) => {
          setAccountSettingsOpen(open);
          if (!open) {
            void loadProfileName();
          }
        }}
      />
    </>
  );
};

export default AccountMenu;
