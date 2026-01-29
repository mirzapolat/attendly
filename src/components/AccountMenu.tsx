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

const AccountMenu = () => {
  const { user, signOut } = useAuth();
  const { clearWorkspace } = useWorkspace();
  const confirm = useConfirm();
  const navigate = useNavigate();

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
    <DropdownMenu>
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
          <span className="text-sm font-medium text-foreground truncate">
            {user?.email ?? 'Signed in'}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => navigate('/settings')}
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
  );
};

export default AccountMenu;
