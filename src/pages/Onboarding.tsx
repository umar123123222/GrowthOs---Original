
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface OnboardingProps {
  onComplete: () => void;
}

const Onboarding = ({ onComplete }: OnboardingProps) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    incomeGoal: "",
    whySuccess: "",
    dreamGoal: "",
    timeline: "",
    experience: ""
  });

  const totalSteps = 3;
  const progress = (step / totalSteps) * 100;

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      // Trigger webhook to n8n here
      console.log("Sending onboarding data to n8n:", formData);
      onComplete();
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <CardTitle className="text-2xl font-bold text-gray-800">
              Let's Set Your Goals
            </CardTitle>
            <span className="text-sm text-gray-500">Step {step} of {totalSteps}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </CardHeader>
        
        <CardContent className="space-y-6">
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <Label htmlFor="incomeGoal" className="text-lg font-medium">
                  What's your monthly income goal? 💰
                </Label>
                <Input
                  id="incomeGoal"
                  type="text"
                  value={formData.incomeGoal}
                  onChange={(e) => handleInputChange("incomeGoal", e.target.value)}
                  placeholder="e.g., PKR 100,000"
                  className="mt-2 h-12 text-lg"
                />
              </div>
              
              <div>
                <Label htmlFor="timeline" className="text-lg font-medium">
                  When do you want to achieve this? ⏰
                </Label>
                <Input
                  id="timeline"
                  type="text"
                  value={formData.timeline}
                  onChange={(e) => handleInputChange("timeline", e.target.value)}
                  placeholder="e.g., Within 6 months"
                  className="mt-2 h-12 text-lg"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <Label htmlFor="whySuccess" className="text-lg font-medium">
                  Why do you want to succeed? What's your deeper motivation? 🎯
                </Label>
                <Textarea
                  id="whySuccess"
                  value={formData.whySuccess}
                  onChange={(e) => handleInputChange("whySuccess", e.target.value)}
                  placeholder="e.g., I want to support my family, buy a house, travel the world..."
                  className="mt-2 min-h-32 text-lg"
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <Label htmlFor="dreamGoal" className="text-lg font-medium">
                  What's your ultimate dream goal? 🌟
                </Label>
                <Textarea
                  id="dreamGoal"
                  value={formData.dreamGoal}
                  onChange={(e) => handleInputChange("dreamGoal", e.target.value)}
                  placeholder="e.g., Go for Umrah, buy a BMW, own a villa..."
                  className="mt-2 min-h-32 text-lg"
                />
              </div>
              
              <div>
                <Label htmlFor="experience" className="text-lg font-medium">
                  Previous business experience? 📈
                </Label>
                <Input
                  id="experience"
                  type="text"
                  value={formData.experience}
                  onChange={(e) => handleInputChange("experience", e.target.value)}
                  placeholder="e.g., Beginner, Some experience, Expert"
                  className="mt-2 h-12 text-lg"
                />
              </div>
            </div>
          )}

          <div className="flex justify-between pt-6">
            <Button
              onClick={() => setStep(Math.max(1, step - 1))}
              variant="outline"
              disabled={step === 1}
            >
              Previous
            </Button>
            
            <Button
              onClick={handleNext}
              className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white px-8"
            >
              {step === totalSteps ? "Complete Setup" : "Next"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Onboarding;
