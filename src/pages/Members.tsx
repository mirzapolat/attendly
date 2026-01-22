import { useEffect, useMemo, useState } from 'react';
import { Crown, Search, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { usePageTitle } from '@/hooks/usePageTitle';
import WorkspaceLayout from '@/components/WorkspaceLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { themeColors } from '@/hooks/useThemeColor';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { useConfirm } from '@/hooks/useConfirm';

interface MemberProfile {
  id: string;
  full_name: string;
  email: string;
}

interface WorkspaceMember {
  profile_id: string;
  profiles: MemberProfile | null;
  created_at?: string | null;
}

interface PendingInvite {
  id: string;
  invited_email: string;
  created_at: string | null;
}

const Members = () => {
  usePageTitle('Members - Attendly');
  const { currentWorkspace, isOwner, refresh } = useWorkspace();
  const { user } = useAuth();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [transferringId, setTransferringId] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const showActions = isOwner;

  useEffect(() => {
    if (currentWorkspace) {
      fetchMembers();
    }
  }, [currentWorkspace]);

  const fetchMembers = async () => {
    if (!currentWorkspace) return;

    setLoading(true);
    const [membersRes, invitesRes] = await Promise.all([
      supabase
        .from('workspace_members')
        .select('profile_id, created_at, profiles ( id, full_name, email )')
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: true }),
      isOwner
        ? supabase
            .from('workspace_invites')
            .select('id, invited_email, created_at')
            .eq('workspace_id', currentWorkspace.id)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (membersRes.error || invitesRes.error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: membersRes.error?.message ?? invitesRes.error?.message ?? 'Failed to load members.',
      });
      setLoading(false);
      return;
    }

    setMembers((membersRes.data ?? []) as WorkspaceMember[]);
    setPendingInvites((invitesRes.data ?? []) as PendingInvite[]);
    setLoading(false);
  };

  const handleInvite = async () => {
    if (!currentWorkspace || !user) return;

    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      toast({
        variant: 'destructive',
        title: 'Invalid email',
        description: 'Please enter a valid email address.',
      });
      return;
    }

    if (members.some((member) => member.profiles?.email?.toLowerCase() === email)) {
      toast({
        variant: 'destructive',
        title: 'Already a member',
        description: 'That email already belongs to a workspace member.',
      });
      return;
    }

    setInviting(true);
    const { error } = await supabase.from('workspace_invites').insert({
      workspace_id: currentWorkspace.id,
      invited_email: email,
      invited_by: user.id,
    });

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Invite failed',
        description: error.message,
      });
      setInviting(false);
      return;
    }

    setInviteEmail('');
    setInviting(false);
    fetchMembers();
    toast({
      title: 'Invite sent',
      description: 'The member will see a notification in their workspace menu.',
    });
  };

  const handleRemoveMember = async (profileId: string) => {
    if (!currentWorkspace) return;

    const confirmed = await confirm({
      title: 'Remove member?',
      description: 'They will lose access to this workspace.',
      confirmText: 'Remove member',
      variant: 'destructive',
    });
    if (!confirmed) return;

    const { error } = await supabase.rpc('remove_workspace_member', {
      p_workspace_id: currentWorkspace.id,
      p_member_id: profileId,
    });

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Remove failed',
        description: error.message,
      });
      return;
    }

    fetchMembers();
  };

  const handleLeaveWorkspace = async () => {
    if (!currentWorkspace || !user) return;

    const confirmed = await confirm({
      title: 'Leave workspace?',
      description: 'You will lose access to this workspace.',
      confirmText: 'Leave workspace',
      variant: 'destructive',
    });
    if (!confirmed) return;

    const { error } = await supabase
      .from('workspace_members')
      .delete()
      .eq('workspace_id', currentWorkspace.id)
      .eq('profile_id', user.id);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Unable to leave',
        description: error.message,
      });
      return;
    }

    await refresh();
    toast({
      title: 'Workspace left',
      description: 'You have left the workspace.',
    });
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!currentWorkspace || !isOwner) return;

    const confirmed = await confirm({
      title: 'Revoke invite?',
      description: 'The invited user will no longer be able to join with this invite.',
      confirmText: 'Revoke invite',
      variant: 'destructive',
    });
    if (!confirmed) return;

    const { error } = await supabase
      .from('workspace_invites')
      .update({ status: 'revoked', responded_at: new Date().toISOString() })
      .eq('id', inviteId)
      .eq('workspace_id', currentWorkspace.id);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Revoke failed',
        description: error.message,
      });
      return;
    }

    fetchMembers();
    toast({
      title: 'Invite revoked',
      description: 'The invitation has been revoked.',
    });
  };

  const handleTransferOwnershipToMember = async (profileId: string) => {
    if (!currentWorkspace || !isOwner) return;

    const confirmed = await confirm({
      title: 'Transfer ownership?',
      description: 'You will remain a member.',
      confirmText: 'Transfer ownership',
      variant: 'destructive',
    });
    if (!confirmed) return;

    setTransferringId(profileId);
    const { error } = await supabase
      .from('workspaces')
      .update({ owner_id: profileId })
      .eq('id', currentWorkspace.id);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Transfer failed',
        description: error.message,
      });
      setTransferringId(null);
      return;
    }

    await refresh();
    setTransferringId(null);
    toast({
      title: 'Ownership transferred',
      description: 'The new owner can now manage members.',
    });
  };

  const brandColor = useMemo(() => {
    const color = themeColors.find((item) => item.id === currentWorkspace?.brand_color);
    return color?.hex ?? 'hsl(var(--primary))';
  }, [currentWorkspace?.brand_color]);

  const orderedMembers = useMemo(() => {
    if (!currentWorkspace?.owner_id) return members;
    return [...members].sort((a, b) => {
      if (a.profile_id === currentWorkspace.owner_id) return -1;
      if (b.profile_id === currentWorkspace.owner_id) return 1;
      return 0;
    });
  }, [members, currentWorkspace?.owner_id]);

  const filteredMembers = useMemo(() => {
    if (!memberSearch.trim()) return orderedMembers;
    const search = memberSearch.toLowerCase();
    return orderedMembers.filter((member) => {
      const name = member.profiles?.full_name?.toLowerCase() ?? '';
      const email = member.profiles?.email?.toLowerCase() ?? '';
      return name.includes(search) || email.includes(search);
    });
  }, [memberSearch, orderedMembers]);

  return (
    <WorkspaceLayout title="Workspace members">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Members</h1>
          <p className="text-muted-foreground">Manage who can access this workspace.</p>
        </div>
        <div className="flex items-center gap-2">
          {isOwner ? (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="hero">
                  <UserPlus className="w-4 h-4" />
                  Invite member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite a member</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="inviteEmail">Email address</Label>
                    <Input
                      id="inviteEmail"
                      value={inviteEmail}
                      onChange={(event) => setInviteEmail(event.target.value)}
                      placeholder="name@company.com"
                      type="email"
                    />
                  </div>
                  <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
                    {inviting ? 'Sending...' : 'Send invite'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          ) : (
            <Button variant="outline" onClick={handleLeaveWorkspace}>
              Leave workspace
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h2 className="text-xl font-semibold">Workspace members</h2>
        {members.length > 0 && (
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search members..."
              value={memberSearch}
              onChange={(event) => setMemberSearch(event.target.value)}
              className="pl-9"
            />
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-6 text-center text-muted-foreground">Loading members...</div>
      ) : filteredMembers.length === 0 ? (
        <div className="py-6 text-center text-muted-foreground">
          {memberSearch ? 'No members match your search.' : 'No members found.'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[640px] rounded-lg border border-border overflow-hidden">
            <div className="bg-muted/50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground border-l-4 border-transparent">
              <div
                className={`grid gap-3 items-center ${
                  showActions
                    ? 'grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)_minmax(0,1fr)_160px]'
                    : 'grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)_minmax(0,1fr)]'
                }`}
              >
                <span>Name</span>
                <span>Email</span>
                <span>Member since</span>
                {showActions && <span className="justify-self-end">Actions</span>}
              </div>
            </div>
            <div className="divide-y divide-border">
              {filteredMembers.map((member) => {
                const isWorkspaceOwner = member.profile_id === currentWorkspace?.owner_id;
                const isSelf = member.profile_id === user?.id;
            const highlightOwner = isWorkspaceOwner && isSelf;
            const highlightSelf = isSelf && !isWorkspaceOwner;
            return (
              <div
                key={member.profile_id}
                className="px-4 py-3 border-l-4 border-transparent"
                style={
                  highlightOwner
                    ? { borderLeftColor: '#f59e0b', backgroundColor: '#f59e0b1A' }
                    : highlightSelf
                      ? { borderLeftColor: brandColor, backgroundColor: `${brandColor}1A` }
                      : undefined
                }
              >
                    <div
                      className={`grid gap-3 items-center ${
                        showActions
                          ? 'grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)_minmax(0,1fr)_160px]'
                          : 'grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)_minmax(0,1fr)]'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {member.profiles?.full_name ?? 'Unknown'}
                          {isWorkspaceOwner && (
                            <span className="ml-2 inline-flex items-center gap-1 text-xs text-amber-700">
                              <Crown className="h-3.5 w-3.5" />
                              Owner
                            </span>
                          )}
                          {isSelf && !isWorkspaceOwner && (
                            <span className="ml-2 text-xs text-muted-foreground">You</span>
                          )}
                        </p>
                      </div>
                      <div className="text-sm text-muted-foreground truncate">
                        {member.profiles?.email ?? 'No email'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {member.created_at ? format(new Date(member.created_at), 'PPP') : '—'}
                      </div>
                      {showActions && (
                        <div className="flex justify-end gap-2">
                          {isOwner && !isWorkspaceOwner ? (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRemoveMember(member.profile_id)}
                                className="text-destructive hover:text-destructive"
                              >
                                Remove
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleTransferOwnershipToMember(member.profile_id)}
                                disabled={transferringId === member.profile_id}
                              >
                                {transferringId === member.profile_id ? 'Transferring...' : 'Transfer'}
                              </Button>
                            </>
                          ) : (
                            <div className="h-8" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {isOwner && !loading && pendingInvites.length > 0 && (
        <div className="mt-8 space-y-3">
          <div>
            <h2 className="text-xl font-semibold">Pending invites</h2>
            <p className="text-sm text-muted-foreground">
              These members haven&apos;t accepted their invitations yet.
            </p>
          </div>
          <div className="grid gap-3">
            {pendingInvites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{invite.invited_email}</p>
                  {invite.created_at && (
                    <p className="text-xs text-muted-foreground">
                      Invited {format(new Date(invite.created_at), 'PPP')}
                    </p>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={() => handleRevokeInvite(invite.id)}>
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </WorkspaceLayout>
  );
};

export default Members;
