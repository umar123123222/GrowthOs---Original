import { UserCreationUtility } from "@/components/UserCreationUtility";
import { createAllUsers } from "@/scripts/createUsers";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

const Index = () => {
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateUsers = async () => {
    setIsCreating(true);
    try {
      const result = await createAllUsers();
      toast({
        title: "User Creation Complete",
        description: `Successfully created ${result.successCount} users. ${result.failCount} failed.`,
        variant: result.successCount > 0 ? "default" : "destructive"
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create users",
        variant: "destructive"
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-4xl space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">System Setup</h1>
          <p className="text-xl text-muted-foreground">Create initial users for the system</p>
        </div>
        
        <div className="flex justify-center">
          <Button 
            onClick={handleCreateUsers} 
            disabled={isCreating}
            size="lg"
            className="px-8"
          >
            {isCreating ? 'Creating Users...' : 'Create All System Users'}
          </Button>
        </div>
        
        <UserCreationUtility />
      </div>
    </div>
  );
};

export default Index;
