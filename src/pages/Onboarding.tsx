
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface OnboardingProps {
  onComplete: () => void;
}

const Onboarding = ({ onComplete }: OnboardingProps) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    incomeGoal: "",
    customIncomeGoal: "",
    whyIncome: "",
    successMeaning: [] as string[],
    otherSuccessReason: "",
    timeCommitment: ""
  });

  const totalSteps = 4;
  const progress = (step / totalSteps) * 100;

  const incomeOptions = [
    { value: "20000", label: "Rs. 20,000/month" },
    { value: "50000", label: "Rs. 50,000/month" },
    { value: "100000", label: "Rs. 100,000/month" },
    { value: "200000", label: "Rs. 200,000+/month" },
    { value: "custom", label: "Custom amount" }
  ];

  const successOptions = [
    { value: "help_family", label: "Help my family" },
    { value: "quit_job", label: "Quit my job" },
    { value: "launch_store", label: "Launch my dream Ecommerce store" },
    { value: "help_someone", label: "Help someone dear" },
    { value: "buy_car", label: "Buy a car" },
    { value: "travel_abroad", label: "Travel abroad" },
    { value: "fund_education", label: "Fund my education" },
    { value: "other", label: "Other" }
  ];

  const timeOptions = [
    { value: "less_5", label: "Less than 5 hours" },
    { value: "5_10", label: "5–10 hours" },
    { value: "10_20", label: "10–20 hours" },
    { value: "20_plus", label: "20+ hours (I'm fully committed)" }
  ];

  const validateStep = () => {
    switch (step) {
      case 1:
        if (!formData.incomeGoal) return false;
        if (formData.incomeGoal === "custom" && !formData.customIncomeGoal) return false;
        return true;
      case 2:
        return formData.whyIncome.trim() !== "";
      case 3:
        if (formData.successMeaning.length === 0) return false;
        if (formData.successMeaning.includes("other") && !formData.otherSuccessReason.trim()) return false;
        return true;
      case 4:
        return formData.timeCommitment !== "";
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (!validateStep()) return;
    
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      // Trigger webhook to n8n here
      console.log("Sending onboarding data to n8n:", formData);
      onComplete();
    }
  };

  const handleSuccessMeaningChange = (value: string, checked: boolean) => {
    if (checked) {
      setFormData(prev => ({
        ...prev,
        successMeaning: [...prev.successMeaning, value]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        successMeaning: prev.successMeaning.filter(item => item !== value)
      }));
    }
  };

  const canProceed = validateStep();

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
                <Label className="text-lg font-medium mb-4 block">
                  What's your income goal in the next 3 months? 💰
                </Label>
                <RadioGroup
                  value={formData.incomeGoal}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, incomeGoal: value }))}
                  className="space-y-3"
                >
                  {incomeOptions.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <RadioGroupItem value={option.value} id={option.value} />
                      <Label htmlFor={option.value} className="text-base cursor-pointer">
                        {option.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
                
                {formData.incomeGoal === "custom" && (
                  <div className="mt-4">
                    <Label htmlFor="customAmount" className="text-base font-medium">
                      Enter your custom monthly income goal:
                    </Label>
                    <Input
                      id="customAmount"
                      type="text"
                      value={formData.customIncomeGoal}
                      onChange={(e) => setFormData(prev => ({ ...prev, customIncomeGoal: e.target.value }))}
                      placeholder="e.g., Rs. 150,000"
                      className="mt-2 h-12 text-lg"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <Label htmlFor="whyIncome" className="text-lg font-medium">
                  Why do you want to make this income? 🎯
                </Label>
                <Textarea
                  id="whyIncome"
                  value={formData.whyIncome}
                  onChange={(e) => setFormData(prev => ({ ...prev, whyIncome: e.target.value }))}
                  placeholder="e.g., For taking my parents to Umrah, to buy a new car, to quit job..."
                  className="mt-2 min-h-32 text-lg"
                />
                <p className="text-sm text-gray-500 mt-2">
                  Examples: For taking my parents to Umrah, to buy a new car, to quit job, for Umrah etc.
                </p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <Label className="text-lg font-medium mb-4 block">
                  If you succeed in this program, what would that mean for you personally? 🌟
                </Label>
                <p className="text-sm text-gray-600 mb-4">Select all that apply:</p>
                <div className="space-y-3">
                  {successOptions.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={option.value}
                        checked={formData.successMeaning.includes(option.value)}
                        onCheckedChange={(checked) => handleSuccessMeaningChange(option.value, checked as boolean)}
                      />
                      <Label htmlFor={option.value} className="text-base cursor-pointer">
                        {option.label}
                      </Label>
                    </div>
                  ))}
                </div>
                
                {formData.successMeaning.includes("other") && (
                  <div className="mt-4">
                    <Label htmlFor="otherReason" className="text-base font-medium">
                      Please specify:
                    </Label>
                    <Input
                      id="otherReason"
                      type="text"
                      value={formData.otherSuccessReason}
                      onChange={(e) => setFormData(prev => ({ ...prev, otherSuccessReason: e.target.value }))}
                      placeholder="Enter your reason..."
                      className="mt-2 h-12 text-lg"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div>
                <Label className="text-lg font-medium mb-4 block">
                  How much time can you give to this program every week? ⏰
                </Label>
                <RadioGroup
                  value={formData.timeCommitment}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, timeCommitment: value }))}
                  className="space-y-3"
                >
                  {timeOptions.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <RadioGroupItem value={option.value} id={option.value} />
                      <Label htmlFor={option.value} className="text-base cursor-pointer">
                        {option.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
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
              disabled={!canProceed}
              className={`px-8 ${
                canProceed 
                  ? "bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white" 
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
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
