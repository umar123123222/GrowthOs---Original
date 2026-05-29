import { useState, useEffect, useMemo } from 'react';
import { safeLogger } from '@/lib/safe-logger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserManagement } from '@/hooks/useUserManagement';
import { Plus, Activity, Trash2, Key, Ban, ShieldCheck, Search, Users, ShieldAlert, GraduationCap, Eye, UserCog, LifeBuoy } from 'lucide-react';
import { useAuth, User } from '@/hooks/useAuth';
import AdminTeams from '@/components/admin/AdminTeams';
import { ActivityLogsDialog } from '@/components/ActivityLogsDialog';

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  role: string;
  lms_user_id: string;
  created_at: string;
  last_active_at: string;
  status: string;
  login_blocked?: boolean;
  password_display?: string;
}

const ROLE_META: Record<string, { label: string; className: string; icon: any }> = {
  superadmin: { label: 'Superadmin', className: 'bg-purple-100 text-purple-700 border-purple-200', icon: ShieldAlert },
  admin: { label: 'Admin', className: 'bg-blue-100 text-blue-700 border-blue-200', icon: ShieldCheck },
  mentor: { label: 'Mentor', className: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: GraduationCap },
  enrollment_manager: { label: 'Enrollment Mgr', className: 'bg-amber-100 text-amber-700 border-amber-200', icon: UserCog },
  support_member: { label: 'Support', className: 'bg-cyan-100 text-cyan-700 border-cyan-200', icon: LifeBuoy },
  viewer: { label: 'Viewer', className: 'bg-slate-100 text-slate-700 border-slate-200', icon: Eye },
};

const getInitials = (name: string) =>
  name.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
  'bg-purple-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-pink-500',
];
const avatarColor = (id: string) => AVATAR_COLORS[id.charCodeAt(0) % AVATAR_COLORS.length];

const Teams = () => {
  const { user }: { user: User | null } = useAuth();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [credentialDialogOpen, setCredentialDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [newMember, setNewMember] = useState({ full_name: '', email: '', role: '' });
  const [isAdding, setIsAdding] = useState(false);
  const { toast } = useToast();
  const { deleteUser } = useUserManagement();

  const fetchTeamMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .in('role', user?.role === 'superadmin'
          ? ['superadmin', 'admin', 'mentor', 'enrollment_manager', 'support_member', 'viewer']
          : ['admin', 'mentor', 'enrollment_manager', 'support_member', 'viewer'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTeamMembers(data || []);
    } catch (error: any) {
      toast({ title: 'Error', description: 'Failed to load team members', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!newMember.full_name.trim() || !newMember.email.trim() || !newMember.role) {
      toast({ title: 'Error', description: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newMember.email)) {
      toast({ title: 'Invalid Email', description: 'Please enter a valid email address', variant: 'destructive' });
      return;
    }
    setIsAdding(true);
    try {
      const { data: existingUser } = await supabase
        .from('users').select('id, email, role')
        .eq('email', newMember.email.toLowerCase()).maybeSingle();
      if (existingUser) {
        toast({ title: 'Email Already Exists', description: `A ${existingUser.role} with email ${existingUser.email} already exists.`, variant: 'destructive' });
        setIsAdding(false);
        return;
      }
    } catch (e) { safeLogger.warn('Email existence check failed, proceeding to create', e); }
    try {
      const response = await supabase.functions.invoke('create-enhanced-team-member', {
        body: { email: newMember.email.toLowerCase().trim(), full_name: newMember.full_name.trim(), role: newMember.role }
      });
      if (response.error) {
        let errorMessage = 'Failed to create team member';
        if (response.error.message) {
          try { const d = JSON.parse(response.error.message); errorMessage = d.error || d.message || response.error.message; }
          catch { errorMessage = response.error.message; }
        }
        throw new Error(errorMessage);
      }
      if (!response.data?.success) throw new Error(response.data?.error || 'Failed to create team member');
      try {
        safeLogger.info('Triggering email queue processing for new team member');
        await supabase.functions.invoke('process-email-queue');
        toast({ title: 'Success', description: `${newMember.role} account created and credential email sent to ${newMember.email}` });
      } catch {
        toast({ title: 'Warning', description: `Account created but failed to send credential email. Password: ${response.data?.generated_password || 'Contact admin'}`, variant: 'destructive' });
      }
      setNewMember({ full_name: '', email: '', role: '' });
      setIsAddDialogOpen(false);
      fetchTeamMembers();
    } catch (error: any) {
      toast({ title: 'Error', description: 'Failed to add team member: ' + error.message, variant: 'destructive' });
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteMember = async (memberId: string, memberName: string) => {
    const success = await deleteUser(memberId);
    if (success) {
      toast({ title: 'Success', description: `${memberName} has been deleted successfully` });
      fetchTeamMembers();
    }
  };

  const handleToggleBan = async (member: TeamMember) => {
    const blocked = !member.login_blocked;
    const { data, error } = await supabase.rpc('set_user_login_blocked', { target_user_id: member.id, blocked });
    if (error || (data as any)?.success === false) {
      toast({ title: 'Error', description: (data as any)?.error || error?.message || 'Failed to update login access', variant: 'destructive' });
      return;
    }
    toast({
      title: blocked ? 'Login banned' : 'Login restored',
      description: `${member.full_name} ${blocked ? 'can no longer sign in' : 'can sign in again'}.`,
    });
    fetchTeamMembers();
  };

  useEffect(() => { fetchTeamMembers(); }, []);

  const counts = useMemo(() => ({
    total: teamMembers.length,
    admin: teamMembers.filter(m => m.role === 'admin').length,
    mentor: teamMembers.filter(m => m.role === 'mentor').length,
    viewer: teamMembers.filter(m => m.role === 'viewer').length,
    support: teamMembers.filter(m => m.role === 'support_member').length,
    em: teamMembers.filter(m => m.role === 'enrollment_manager').length,
    banned: teamMembers.filter(m => m.login_blocked).length,
  }), [teamMembers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return teamMembers.filter(m => {
      if (roleFilter !== 'all' && m.role !== roleFilter) return false;
      if (!q) return true;
      return m.full_name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q);
    });
  }, [teamMembers, search, roleFilter]);

  if (user?.role === 'admin') return <AdminTeams />;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Loading team members…</p>
        </div>
      </div>
    );
  }

  const StatCard = ({ icon: Icon, label, value, tint }: any) => (
    <Card className="border-border/60 hover:shadow-md transition-shadow">
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${tint}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
          <p className="text-2xl font-bold text-foreground leading-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Team</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage admins, mentors, support and viewers — {counts.total} members</p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="shadow-sm"><Plus className="w-4 h-4 mr-2" />Add Team Member</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add New Team Member</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Full Name *</Label>
                  <Input id="name" value={newMember.full_name} onChange={e => setNewMember({ ...newMember, full_name: e.target.value })} placeholder="Enter full name" />
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input id="email" type="email" value={newMember.email} onChange={e => setNewMember({ ...newMember, email: e.target.value })} placeholder="Enter email address" />
                </div>
                <div>
                  <Label htmlFor="role">Role *</Label>
                  <Select value={newMember.role} onValueChange={value => setNewMember({ ...newMember, role: value })}>
                    <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                    <SelectContent>
                      {user?.role === 'superadmin' && <SelectItem value="admin">Admin</SelectItem>}
                      <SelectItem value="mentor">Mentor</SelectItem>
                      <SelectItem value="enrollment_manager">Enrollment Manager</SelectItem>
                      <SelectItem value="support_member">Support Member</SelectItem>
                      <SelectItem value="viewer">Viewer (read-only)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAddMember} disabled={isAdding} className="w-full">
                  {isAdding ? 'Adding…' : 'Add Team Member'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard icon={Users} label="Total" value={counts.total} tint="bg-primary/10 text-primary" />
          <StatCard icon={ShieldCheck} label="Admins" value={counts.admin} tint="bg-blue-100 text-blue-700" />
          <StatCard icon={GraduationCap} label="Mentors" value={counts.mentor} tint="bg-emerald-100 text-emerald-700" />
          <StatCard icon={UserCog} label="Enrollment" value={counts.em} tint="bg-amber-100 text-amber-700" />
          <StatCard icon={LifeBuoy} label="Support" value={counts.support} tint="bg-cyan-100 text-cyan-700" />
          <StatCard icon={Eye} label="Viewers" value={counts.viewer} tint="bg-slate-100 text-slate-700" />
        </div>

        {/* Members Card */}
        <Card className="border-border/60">
          <CardHeader className="border-b border-border/60">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <CardTitle>Team Members</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">{filtered.length} shown · {counts.banned} banned</p>
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-72">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or email…" className="pl-9" />
                </div>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All roles</SelectItem>
                    {user?.role === 'superadmin' && <SelectItem value="superadmin">Superadmin</SelectItem>}
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="mentor">Mentor</SelectItem>
                    <SelectItem value="enrollment_manager">Enrollment Mgr</SelectItem>
                    <SelectItem value="support_member">Support</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="py-16 text-center">
                <Users className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">No team members match your filters.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Active</TableHead>
                    <TableHead className="text-right pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(member => {
                    const meta = ROLE_META[member.role] || ROLE_META.viewer;
                    const RoleIcon = meta.icon;
                    return (
                      <TableRow key={member.id} className="group">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarFallback className={`${avatarColor(member.id)} text-white text-xs font-semibold`}>
                                {getInitials(member.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="font-medium text-foreground truncate">{member.full_name}</p>
                              <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`gap-1 ${meta.className}`}>
                            <RoleIcon className="w-3 h-3" />
                            {meta.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {member.login_blocked ? (
                            <Badge variant="destructive" className="gap-1"><Ban className="w-3 h-3" />Banned</Badge>
                          ) : (
                            <Badge variant="outline" className={member.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 gap-1' : 'bg-muted text-muted-foreground gap-1'}>
                              <span className={`w-1.5 h-1.5 rounded-full ${member.status === 'Active' ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />
                              {member.status || 'Inactive'}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {member.last_active_at ? new Date(member.last_active_at).toLocaleDateString() : 'Never'}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                            <Dialog open={credentialDialogOpen && selectedMember?.id === member.id} onOpenChange={open => { setCredentialDialogOpen(open); if (!open) setSelectedMember(null); }}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <DialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={async () => {
                                      setSelectedMember(member);
                                      if (user?.role === 'superadmin') {
                                        const { data, error } = await supabase.rpc('get_team_member_password', { member_id: member.id });
                                        if (!error && data) setSelectedMember({ ...member, password_display: data });
                                      }
                                    }}>
                                      <Key className="w-4 h-4" />
                                    </Button>
                                  </DialogTrigger>
                                </TooltipTrigger>
                                <TooltipContent>Credentials</TooltipContent>
                              </Tooltip>
                              <DialogContent className="max-w-lg">
                                <DialogHeader><DialogTitle>Login Credentials — {selectedMember?.full_name}</DialogTitle></DialogHeader>
                                <div className="space-y-3">
                                  <div>
                                    <Label className="text-sm font-medium">Email</Label>
                                    <p className="text-sm bg-muted px-3 py-2 rounded">{selectedMember?.email}</p>
                                  </div>
                                  <div>
                                    <Label className="text-sm font-medium">{user?.role === 'superadmin' ? 'Password' : 'Access'}</Label>
                                    {user?.role === 'superadmin' ? (
                                      <p className="text-sm bg-muted px-3 py-2 rounded font-mono">{selectedMember?.password_display || 'Loading password…'}</p>
                                    ) : (
                                      <p className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded">Credentials are securely managed through the system</p>
                                    )}
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>

                            <ActivityLogsDialog userId={member.id} userName={member.full_name}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8"><Activity className="w-4 h-4" /></Button>
                                </TooltipTrigger>
                                <TooltipContent>Activity logs</TooltipContent>
                              </Tooltip>
                            </ActivityLogsDialog>

                            <AlertDialog>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      {member.login_blocked ? <ShieldCheck className="w-4 h-4 text-emerald-600" /> : <Ban className="w-4 h-4 text-amber-600" />}
                                    </Button>
                                  </AlertDialogTrigger>
                                </TooltipTrigger>
                                <TooltipContent>{member.login_blocked ? 'Unban login' : 'Ban login'}</TooltipContent>
                              </Tooltip>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>{member.login_blocked ? 'Restore login access?' : 'Ban from logging in?'}</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {member.login_blocked
                                      ? `${member.full_name} will be able to sign in again.`
                                      : `${member.full_name} will be immediately blocked from signing in. Their data is preserved.`}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleToggleBan(member)}>
                                    {member.login_blocked ? 'Restore access' : 'Ban login'}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>

                            <AlertDialog>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                </TooltipTrigger>
                                <TooltipContent>Delete</TooltipContent>
                              </Tooltip>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete {member.full_name} and remove all their data. This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteMember(member.id, member.full_name)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
};

export default Teams;
