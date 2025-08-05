import { supabase } from '@/integrations/supabase/client';

const usersToCreate = [
  {
    target_email: 'umaridmpakistan@gmail.com',
    target_password: 'Umaridmpakistan@gmail.com6',
    target_role: 'superadmin',
    target_full_name: 'Super Admin User'
  },
  {
    target_email: 'umarservices0@gmail.com',
    target_password: '0Exh0&RR',
    target_role: 'admin',
    target_full_name: 'Admin User'
  },
  {
    target_email: 'aliegamerz167@gmail.com',
    target_password: 'hC%l8SZr3',
    target_role: 'mentor',
    target_full_name: 'Mentor User'
  },
  {
    target_email: 'tes21312321t@gmail.com',
    target_password: 'q2%omRhLCySS',
    target_role: 'student',
    target_full_name: 'Student User'
  },
  {
    target_email: 'billing@idmpakistan.pk',
    target_password: 'G6]]GZ:P>I0v',
    target_role: 'enrollment_manager',
    target_full_name: 'Enrollment Manager'
  }
];

export const createAllUsers = async () => {
  let successCount = 0;
  let failCount = 0;
  const results = [];

  for (const userData of usersToCreate) {
    try {
      console.log(`Creating user: ${userData.target_email} with role: ${userData.target_role}`);
      
      const { data, error } = await supabase.functions.invoke('create-user-with-role', {
        body: userData
      });

      if (error || data?.error) {
        console.error(`Failed to create ${userData.target_email}:`, data?.error || error?.message);
        failCount++;
        results.push({ email: userData.target_email, success: false, error: data?.error || error?.message });
      } else {
        console.log(`Successfully created ${userData.target_email}`);
        successCount++;
        results.push({ email: userData.target_email, success: true });
      }
    } catch (error: any) {
      console.error(`Exception creating ${userData.target_email}:`, error.message);
      failCount++;
      results.push({ email: userData.target_email, success: false, error: error.message });
    }
  }

  console.log(`User creation complete: ${successCount} successful, ${failCount} failed`);
  return { successCount, failCount, results };
};

// Auto-execute when this script is loaded
if (typeof window !== 'undefined') {
  (window as any).createUsers = createAllUsers;
  console.log('User creation script loaded. Call window.createUsers() to create all users.');
}