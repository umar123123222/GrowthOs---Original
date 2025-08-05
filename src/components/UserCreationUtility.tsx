import React, { useState } from 'react';
import { useUserManagement } from '@/hooks/useUserManagement';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

const usersToCreate = [
  {
    target_email: 'umaridmpakistan@gmail.com',
    target_password: 'Umaridmpakistan@gmail.com6',
    target_role: 'superadmin' as const,
    target_full_name: 'Super Admin User'
  },
  {
    target_email: 'umarservices0@gmail.com',
    target_password: '0Exh0&RR',
    target_role: 'admin' as const,
    target_full_name: 'Admin User'
  },
  {
    target_email: 'aliegamerz167@gmail.com',
    target_password: 'hC%l8SZr3',
    target_role: 'mentor' as const,
    target_full_name: 'Mentor User'
  },
  {
    target_email: 'tes21312321t@gmail.com',
    target_password: 'q2%omRhLCySS',
    target_role: 'student' as const,
    target_full_name: 'Student User'
  },
  {
    target_email: 'billing@idmpakistan.pk',
    target_password: 'G6]]GZ:P>I0v',
    target_role: 'enrollment_manager' as const,
    target_full_name: 'Enrollment Manager'
  }
];

export const UserCreationUtility = () => {
  const { createUser, loading } = useUserManagement();
  const { toast } = useToast();
  const [createdUsers, setCreatedUsers] = useState<string[]>([]);

  const createAllUsers = async () => {
    let successCount = 0;
    let failCount = 0;

    for (const userData of usersToCreate) {
      try {
        const success = await createUser(userData);
        if (success) {
          successCount++;
          setCreatedUsers(prev => [...prev, userData.target_email]);
        } else {
          failCount++;
        }
      } catch (error) {
        failCount++;
      }
    }

    toast({
      title: "User Creation Complete",
      description: `Successfully created ${successCount} users. ${failCount} failed.`,
      variant: successCount > 0 ? "default" : "destructive"
    });
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Create System Users</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {usersToCreate.map((user, index) => (
            <div key={index} className="flex justify-between items-center p-2 bg-muted rounded">
              <div>
                <span className="font-medium">{user.target_role}</span>
                <span className="text-muted-foreground ml-2">{user.target_email}</span>
              </div>
              {createdUsers.includes(user.target_email) && (
                <span className="text-green-600 text-sm">✓ Created</span>
              )}
            </div>
          ))}
        </div>
        
        <Button 
          onClick={createAllUsers} 
          disabled={loading}
          className="w-full"
        >
          {loading ? 'Creating Users...' : 'Create All Users'}
        </Button>
      </CardContent>
    </Card>
  );
};