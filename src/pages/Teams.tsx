import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Activity, Eye, Edit, Trash2, Key } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import AdminTeams from '@/components/admin/AdminTeams';
import { ActivityLogsDialog } from '@/components/ActivityLogsDialog';
import { CredentialDisplay } from '@/components/ui/credential-display';
import { generateSecurePassword } from '@/utils/passwordGenerator';

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  role: string;
  lms_user_id: string;
  lms_password: string;
  created_at: string;
  last_active_at: string;
  status: string;
  temp_password?: string;
}

const Teams = () => {
  const { user } = useAuth();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [credentialDialogOpen, setCredentialDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [newMember, setNewMember] = useState({
    full_name: '',
    email: '',
    role: '',
    lms_user_id: '',
    lms_password: ''
  });
  const { toast } = useToast();

  const fetchTeamMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .in('role', ['admin', 'mentor'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTeamMembers(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load team members",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const sendInvitationEmail = async (email: string, fullName: string, role: string, tempPassword: string) => {
    try {
      const loginUrl = `${window.location.origin}/login`;
      
      const response = await supabase.functions.invoke('send-admin-invitation', {
        body: {
          email,
          full_name: fullName,
          role,
          temp_password: tempPassword,
          login_url: loginUrl
        }
      });

      if (response.error) {
        console.error('Error sending invitation:', response.error);
        throw response.error;
      }

      return response.data;
    } catch (error) {
      console.error('Failed to send invitation email:', error);
      throw error;
    }
  };

  const handleAddMember = async () => {
    if (!newMember.full_name || !newMember.email || !newMember.role) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    try {
      // Generate a secure temporary password
      const tempPassword = generateSecurePassword();
      
      // Create auth user first
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: newMember.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: newMember.full_name
        }
      });

      if (authError) throw authError;

      // Update user with additional information including temp_password for credential viewing
      const { error: updateError } = await supabase
        .from('users')
        .update({
          full_name: newMember.full_name,
          email: newMember.email,
          role: newMember.role,
          lms_user_id: newMember.lms_user_id,
          lms_password: newMember.lms_password,
          status: 'Active',
          temp_password: tempPassword // Store for credential viewing
        })
        .eq('id', authData.user.id);

      if (updateError) throw updateError;

      // Send invitation email
      try {
        await sendInvitationEmail(newMember.email, newMember.full_name, newMember.role, tempPassword);
        
        toast({
          title: "Success",
          description: `${newMember.role} account created and invitation email sent to ${newMember.email}`
        });
      } catch (emailError) {
        // User was created but email failed
        toast({
          title: "Partial Success",
          description: `Account created but failed to send invitation email. Manual credentials: ${tempPassword}`,
          variant: "destructive"
        });
      }

      setNewMember({
        full_name: '',
        email: '',
        role: '',
        lms_user_id: '',
        lms_password: ''
      });
      setIsAddDialogOpen(false);
      fetchTeamMembers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to add team member: " + error.message,
        variant: "destructive"
      });
    }
  };

  const handleDeleteMember = async (memberId: string, memberName: string) => {
    try {
      // Delete from users table (this will handle the auth cleanup via trigger if needed)
      const { error: dbError } = await supabase
        .from('users')
        .delete()
        .eq('id', memberId);

      if (dbError) throw dbError;

      toast({
        title: "Success",
        description: `${memberName} has been deleted successfully`
      });

      fetchTeamMembers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to delete team member: " + error.message,
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    fetchTeamMembers();
  }, []);

  // Show restricted admin version for admin users
  if (user?.role === 'admin') {
    return <AdminTeams />;
  }

  const adminCount = teamMembers.filter(m => m.role === 'admin').length;
  const mentorCount = teamMembers.filter(m => m.role === 'mentor').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading team members...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Teams</h1>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Team Member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Team Member</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  value={newMember.full_name}
                  onChange={(e) => setNewMember({...newMember, full_name: e.target.value})}
                  placeholder="Enter full name"
                />
              </div>
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={newMember.email}
                  onChange={(e) => setNewMember({...newMember, email: e.target.value})}
                  placeholder="Enter email address"
                />
              </div>
              <div>
                <Label htmlFor="role">Role *</Label>
                <Select value={newMember.role} onValueChange={(value) => setNewMember({...newMember, role: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="mentor">Mentor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="lms_user">LMS User ID</Label>
                <Input
                  id="lms_user"
                  value={newMember.lms_user_id}
                  onChange={(e) => setNewMember({...newMember, lms_user_id: e.target.value})}
                  placeholder="Enter LMS user ID"
                />
              </div>
              <div>
                <Label htmlFor="lms_password">LMS Password</Label>
                <Input
                  id="lms_password"
                  type="password"
                  value={newMember.lms_password}
                  onChange={(e) => setNewMember({...newMember, lms_password: e.target.value})}
                  placeholder="Enter LMS password"
                />
              </div>
              <Button onClick={handleAddMember} className="w-full">
                Add Team Member
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Total Admins</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{adminCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Total Mentors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{mentorCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Team Members Table */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>LMS User ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Active</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamMembers.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">{member.full_name}</TableCell>
                  <TableCell>{member.email}</TableCell>
                  <TableCell>
                    <Badge variant={member.role === 'admin' ? 'default' : 'secondary'}>
                      {member.role}
                    </Badge>
                  </TableCell>
                  <TableCell>{member.lms_user_id || 'N/A'}</TableCell>
                  <TableCell>
                    <Badge variant={member.status === 'Active' ? 'default' : 'destructive'}>
                      {member.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {member.last_active_at ? new Date(member.last_active_at).toLocaleDateString() : 'Never'}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Dialog open={credentialDialogOpen && selectedMember?.id === member.id} 
                             onOpenChange={(open) => {
                               setCredentialDialogOpen(open);
                               if (!open) setSelectedMember(null);
                             }}>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedMember(member)}
                          >
                            <Key className="w-4 h-4 mr-1" />
                            Credentials
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg">
                          <DialogHeader>
                            <DialogTitle>Login Credentials - {member.full_name}</DialogTitle>
                          </DialogHeader>
                          <CredentialDisplay
                            email={member.email}
                            password={member.temp_password}
                            lmsUserId={member.lms_user_id}
                            lmsPassword={member.lms_password}
                          />
                        </DialogContent>
                      </Dialog>
                      
                      <ActivityLogsDialog>
                        <Button variant="outline" size="sm">
                          <Activity className="w-4 h-4 mr-1" />
                          Activity
                        </Button>
                      </ActivityLogsDialog>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Trash2 className="w-4 h-4 mr-1" />
                            Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete {member.full_name} and remove all their data. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteMember(member.id, member.full_name)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

    </div>
  );
};

export default Teams;
