import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, LogOut, QrCode, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/hooks/useConfirm';

interface WorkspaceInvite {
  id: string;
  workspace_id: string;
  invited_by?: string | null;
  invited_email?: string;
  created_at?: string | null;
  responded_at?: string | null;
  workspaces?: {
    name: string;
    brand_logo_url?: string | null;
  } | null;
  inviter?: {
    full_name: string | null;
    email: string | null;
  } | null;
}

interface AcceptedInvite {
  id: string;
  workspace_id: string;
  invited_email: string;
  responded_at?: string | null;
  workspaces?: {
    name: string;
    brand_logo_url?: string | null;
  } | null;
  invitee_name?: string;
}

interface WorkspaceNotification {
  id: string;
  workspace_id: string;
  message: string;
  created_at?: string | null;
  read_at?: string | null;
}

interface WorkspaceHeaderProps {
  showChangeWorkspace?: boolean;
  withContainer?: boolean;
}

const WorkspaceHeader = ({
  showChangeWorkspace = true,
  withContainer = false,
}: WorkspaceHeaderProps) => {
  const { user, signOut } = useAuth();
  const { clearWorkspace, refresh } = useWorkspace();
  const navigate = useNavigate();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [pendingInvites, setPendingInvites] = useState<WorkspaceInvite[]>([]);
  const [acceptedInvites, setAcceptedInvites] = useState<AcceptedInvite[]>([]);
  const [workspaceNotifications, setWorkspaceNotifications] = useState<WorkspaceNotification[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);

  const getLastSeenKey = (userId: string) => `attendly:notifications:lastSeen:${userId}`;

  const getLastSeen = (userId: string) => {
    if (typeof window === 'undefined') return 0;
    const stored = localStorage.getItem(getLastSeenKey(userId));
    return stored ? Number.parseInt(stored, 10) : 0;
  };

  const setLastSeen = (userId: string, timestamp: number) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(getLastSeenKey(userId), timestamp.toString());
  };

  useEffect(() => {
    if (user?.email) {
      fetchNotifications();
    } else {
      setPendingInvites([]);
      setAcceptedInvites([]);
      setWorkspaceNotifications([]);
    }
  }, [user?.email, user?.id]);

  const fetchNotifications = async () => {
    if (!user?.email || !user.id) {
      return;
    }

    setInvitesLoading(true);
    const [pendingRes, acceptedRes, notificationsRes] = await Promise.all([
      supabase
        .from('workspace_invites')
        .select('id, workspace_id, invited_by, invited_email, created_at, workspaces ( name, brand_logo_url ), inviter:profiles ( full_name, email )')
        .eq('invited_email', user.email)
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
      supabase
        .from('workspace_invites')
        .select('id, workspace_id, invited_email, responded_at, workspaces ( name, owner_id, brand_logo_url )')
        .eq('status', 'accepted')
        .eq('workspaces.owner_id', user.id)
        .order('responded_at', { ascending: false })
        .limit(6),
      supabase
        .from('workspace_notifications')
        .select('id, workspace_id, message, created_at, read_at')
        .eq('recipient_id', user.id)
        .is('read_at', null)
        .order('created_at', { ascending: false })
        .limit(6),
    ]);

    const pending = (pendingRes.data ?? []) as WorkspaceInvite[];
    const acceptedRaw = (acceptedRes.data ?? []) as AcceptedInvite[];
    const ownerAccepted = acceptedRaw.filter(
      (invite) => invite.workspaces?.owner_id === user.id
    );
    const notifications = (notificationsRes.data ?? []) as WorkspaceNotification[];
    const lastSeen = user?.id ? getLastSeen(user.id) : 0;
    const acceptedFiltered = ownerAccepted.filter((invite) => {
      if (!invite.responded_at) return true;
      const respondedAt = Date.parse(invite.responded_at);
      if (Number.isNaN(respondedAt)) return true;
      return respondedAt > lastSeen;
    });

    const inviteeEmails = acceptedFiltered
      .map((invite) => invite.invited_email)
      .filter((email): email is string => Boolean(email));

    let accepted = acceptedFiltered;

    if (inviteeEmails.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('full_name, email')
        .in('email', inviteeEmails);

      const nameByEmail = new Map(
        (profiles ?? []).map((profile) => [profile.email.toLowerCase(), profile.full_name])
      );

      accepted = acceptedFiltered.map((invite) => ({
        ...invite,
        invitee_name: nameByEmail.get(invite.invited_email.toLowerCase()) ?? invite.invited_email,
      }));
    }

    setPendingInvites(pending);
    setAcceptedInvites(accepted);
    setWorkspaceNotifications(notifications);
    setInvitesLoading(false);
  };

  const handleInviteResponse = async (invite: WorkspaceInvite, status: 'accepted' | 'declined') => {
    if (!user) return;

    if (status === 'accepted') {
      const { error: acceptError } = await supabase.rpc('accept_workspace_invite', {
        invite_id: invite.id,
      });

      if (acceptError) {
        toast({
          variant: 'destructive',
          title: 'Invite failed',
          description: acceptError.message,
        });
        return;
      }
    } else {
      const { error: inviteError } = await supabase
        .from('workspace_invites')
        .update({
          status,
          responded_at: new Date().toISOString(),
        })
        .eq('id', invite.id);

      if (inviteError) {
        toast({
          variant: 'destructive',
          title: 'Invite update failed',
          description: inviteError.message,
        });
        return;
      }
    }

    await refresh();
    await fetchNotifications();

    toast({
      title: status === 'accepted' ? 'Workspace joined' : 'Invite declined',
      description:
        status === 'accepted'
          ? `You joined ${invite.workspaces?.name ?? 'the workspace'}.`
          : 'The invitation was declined.',
    });
  };

  const handleNotificationsOpen = async (open: boolean) => {
    if (open || !user?.id) return;
    const now = Date.now();
    setLastSeen(user.id, now);
    setAcceptedInvites([]);

    const unreadIds = workspaceNotifications.map((notification) => notification.id);
    if (unreadIds.length > 0) {
      await supabase
        .from('workspace_notifications')
        .update({ read_at: new Date(now).toISOString() })
        .in('id', unreadIds)
        .eq('recipient_id', user.id);
      setWorkspaceNotifications([]);
    }
  };

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

  const headerTitle = 'Attendly';

  return (
    <header className="bg-background/80 backdrop-blur-sm border-b border-border sticky top-0 z-50">
      <div className={`${withContainer ? 'container mx-auto px-6' : 'px-6'} h-16 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
            <QrCode className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="flex items-center gap-3">
            <span className="font-semibold text-lg leading-tight">{headerTitle}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu onOpenChange={handleNotificationsOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative" title="Notifications">
                <Bell className="w-5 h-5" />
                {pendingInvites.length + acceptedInvites.length + workspaceNotifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 min-w-[1rem] rounded-full bg-primary text-primary-foreground text-[10px] px-1 flex items-center justify-center">
                    {pendingInvites.length + acceptedInvites.length + workspaceNotifications.length}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {invitesLoading ? (
                <div className="px-3 py-3 text-sm text-muted-foreground">Loading notifications...</div>
              ) : pendingInvites.length === 0 &&
                acceptedInvites.length === 0 &&
                workspaceNotifications.length === 0 ? (
                <div className="px-3 py-3 text-sm text-muted-foreground">No new notifications.</div>
              ) : (
                <div className="flex flex-col gap-3 px-3 py-2">
                  {pendingInvites.map((invite) => {
                    const inviterName =
                      invite.inviter?.full_name ??
                      invite.inviter?.email ??
                      'Someone';
                    const workspaceName = invite.workspaces?.name ?? 'Unknown workspace';
                    const workspaceLogo = invite.workspaces?.brand_logo_url ?? null;
                    return (
                      <div key={invite.id} className="space-y-2">
                        <div className="flex items-center gap-3">
                          {workspaceLogo ? (
                            <img
                              src={workspaceLogo}
                              alt={`${workspaceName} logo`}
                              className="h-9 w-9 rounded-full border border-border object-cover bg-background"
                            />
                          ) : (
                            <div className="h-9 w-9 rounded-full border border-border bg-muted/70 text-sm font-semibold text-muted-foreground flex items-center justify-center">
                              {workspaceName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <p className="text-sm font-medium">
                            {inviterName} invited you to workspace{' '}
                            <span className="font-semibold text-foreground">{workspaceName}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleInviteResponse(invite, 'accepted')}
                          >
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleInviteResponse(invite, 'declined')}
                          >
                            Decline
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  {workspaceNotifications.map((notification) => (
                    <div key={notification.id} className="text-sm text-muted-foreground">
                      {notification.message}
                    </div>
                  ))}
                  {acceptedInvites.map((invite) => (
                    <div key={invite.id} className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {invite.invitee_name ?? invite.invited_email}
                      </span>{' '}
                      accepted your invitation to join{' '}
                      {invite.workspaces?.name ?? 'a workspace'}.
                    </div>
                  ))}
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Link to="/settings">
            <Button variant="ghost" size="icon" title="Settings">
              <Settings className="w-5 h-5" />
            </Button>
          </Link>
          <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign out">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </header>
  );
};

export default WorkspaceHeader;
