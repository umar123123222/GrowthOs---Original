import { useEffect, useState } from "react";
import { SubmissionsManagement } from "@/components/assignments/SubmissionsManagement";
import { InactiveLMSBanner } from "@/components/InactiveLMSBanner";
import { StudentAssignmentList } from "@/components/assignments/StudentAssignmentList";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AssignmentsProps {
  user?: any;
}

const Assignments = ({ user }: AssignmentsProps = {}) => {
  // Basic SEO for the page
  useEffect(() => {
    document.title = "Assignments | Student Tasks";
    const desc = "View, submit, and track your assignments with sequential unlocks.";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', desc);

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', `${window.location.origin}/assignments`);
  }, []);

  const [tab, setTab] = useState<'unlocked' | 'submitted'>('unlocked');

  // Keep staff/mentor view exactly as before
  if (user?.role === 'mentor' || user?.role === 'admin' || user?.role === 'superadmin') {
    return <SubmissionsManagement userRole={user.role} />;
  }

  // Student view uses the dedicated list with correct locking logic
  return (
    <main className="p-3 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <header className="space-y-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">My Assignments</h1>
          <p className="text-sm text-muted-foreground mt-1">Track your progress and submit your work</p>
        </div>
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'unlocked' | 'submitted')}>
          <TabsList className="bg-muted/60 p-1 rounded-xl">
            <TabsTrigger value="unlocked" className="rounded-lg data-[state=active]:shadow-sm font-semibold">Unlocked</TabsTrigger>
            <TabsTrigger value="submitted" className="rounded-lg data-[state=active]:shadow-sm font-semibold">Submitted</TabsTrigger>
          </TabsList>
        </Tabs>
      </header>
      <InactiveLMSBanner show={user?.role === 'student' && user?.lms_status === 'inactive'} />
      <section aria-label="Student assignments list">
        <StudentAssignmentList filterMode={tab} />
      </section>
    </main>
  );
};

export default Assignments;