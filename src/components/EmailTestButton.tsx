import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Mail } from "lucide-react";

export const EmailTestButton = () => {
  const { toast } = useToast();

  const testEmailProcessing = async () => {
    try {
      console.log("Testing email processing...");
      const response = await supabase.functions.invoke('test-email-processing');
      
      console.log("Test email processing response:", response);
      
      if (response.error) {
        console.error("Email test error:", response.error);
        toast({
          title: "Email Test Failed",
          description: response.error.message || "Failed to process emails",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Email Test Successful",
          description: "Check the logs for details",
        });
      }
    } catch (error: any) {
      console.error("Error testing email processing:", error);
      toast({
        title: "Email Test Failed",
        description: "Check console for details",
        variant: "destructive",
      });
    }
  };

  return (
    <Button onClick={testEmailProcessing} variant="outline" size="sm">
      <Mail className="w-4 h-4 mr-2" />
      Test Email Processing
    </Button>
  );
};