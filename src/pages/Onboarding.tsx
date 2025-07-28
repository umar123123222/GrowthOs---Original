import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useOnboardingSubmission } from "@/hooks/useOnboardingSubmission";

interface OnboardingProps {
  user: any;
  onComplete: () => void;
}

const Onboarding = ({ user, onComplete }: OnboardingProps) => {
  const { submitOnboardingAnswers, loading } = useOnboardingSubmission();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    income_goal: "",
    motivation: "",
    ecommerce_experience: "",
    perceived_blockers: [] as string[],
    thirty_day_aspirations: ""
  });

  const totalSteps = 5;
  const progress = (step / totalSteps) * 100;

  const incomeOptions = [
    { value: "20000", label: "Rs. 20,000/month" },
    { value: "50000", label: "Rs. 50,000/month" },
    { value: "100000", label: "Rs. 100,000/month" },
    { value: "200000", label: "Rs. 200,000+/month" }
  ];

  const ecommerceOptions = [
    { value: "complete_beginner", label: "No, I'm a complete beginner" },
    { value: "tried_not_launched", label: "I tried but didn't launch" },
    { value: "launched_no_sales", label: "I launched but didn't get sales" },
    { value: "few_sales", label: "I made a few sales" },
    { value: "running_actively", label: "I'm running a store actively right now" }
  ];

  const blockerOptions = [
    { value: "dont_know_start", label: "I don't know how to start" },
    { value: "product_research", label: "I'm stuck on product research" },
    { value: "facebook_ads_confusing", label: "Facebook Ads are confusing" },
    { value: "shopify_confusing", label: "Shopify is confusing" },
    { value: "no_motivation", label: "No motivation, I start but stop" },
    { value: "no_time", label: "I don't have time" }
  ];

  const validateStep = () => {
    switch (step) {
      case 1:
        return formData.income_goal !== "";
      case 2:
        return formData.motivation.trim() !== "";
      case 3:
        return formData.ecommerce_experience !== "";
      case 4:
        return formData.perceived_blockers.length > 0;
      case 5:
        return formData.thirty_day_aspirations.trim() !== "";
      default:
        return true;
    }
  };

  const handleNext = async () => {
    if (!validateStep()) return;
    
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      await handleSubmit();
    }
  };

  const handleSubmit = async () => {
    const success = await submitOnboardingAnswers(user.id, formData);
    if (success) {
      onComplete();
    }
  };

  const handleBlockerChange = (value: string, checked: boolean) => {
    if (checked) {
      setFormData(prev => ({
        ...prev,
        perceived_blockers: [...prev.perceived_blockers, value]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        perceived_blockers: prev.perceived_blockers.filter(item => item !== value)
      }));
    }
  };

  const canProceed = validateStep();

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-elevated border-0">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
            <CardTitle className="text-xl sm:text-2xl font-bold text-foreground">
              Welcome to IDM Pakistan! Let's get to know you better.
            </CardTitle>
            <span className="text-sm text-muted-foreground whitespace-nowrap">Step {step} of {totalSteps}</span>
          </div>
          <Progress value={progress} className="h-3" />
        </CardHeader>
        
        <CardContent className="space-y-6">
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <Label className="text-lg font-medium mb-4 block">
                  What's your income goal in the next 3 months? 💰
                </Label>
                <RadioGroup
                  value={formData.income_goal}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, income_goal: value }))}
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
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <Label htmlFor="motivation" className="text-lg font-medium">
                  Why do you want to make this income? What motivates you? 🎯
                </Label>
                <Textarea
                  id="motivation"
                  value={formData.motivation}
                  onChange={(e) => setFormData(prev => ({ ...prev, motivation: e.target.value }))}
                  placeholder="e.g., For taking my parents to Umrah, to buy a new car, to quit job, to help my family..."
                  className="mt-2 min-h-32 text-lg"
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <Label className="text-lg font-medium mb-4 block">
                  Have you ever tried starting an ecommerce store before? 🛒
                </Label>
                <RadioGroup
                  value={formData.ecommerce_experience}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, ecommerce_experience: value }))}
                  className="space-y-3"
                >
                  {ecommerceOptions.map((option) => (
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

          {step === 4 && (
            <div className="space-y-6">
              <div>
                <Label className="text-lg font-medium mb-4 block">
                  What do you feel are your biggest blockers right now? 🚧
                </Label>
                <p className="text-sm text-gray-600 mb-4">Select all that apply:</p>
                <div className="space-y-3">
                  {blockerOptions.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={option.value}
                        checked={formData.perceived_blockers.includes(option.value)}
                        onCheckedChange={(checked) => handleBlockerChange(option.value, checked as boolean)}
                      />
                      <Label htmlFor={option.value} className="text-base cursor-pointer">
                        {option.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6">
              <div>
                <Label htmlFor="aspirations" className="text-lg font-medium">
                  What do you hope to achieve in the next 30 days? 🌟
                </Label>
                <Textarea
                  id="aspirations"
                  value={formData.thirty_day_aspirations}
                  onChange={(e) => setFormData(prev => ({ ...prev, thirty_day_aspirations: e.target.value }))}
                  placeholder="e.g., Launch my first product, run my first ad, get my first sale, learn Shopify..."
                  className="mt-2 min-h-32 text-lg"
                />
              </div>
            </div>
          )}

          <div className="flex justify-between pt-6">
            <Button
              variant="outline"
              onClick={() => setStep(Math.max(1, step - 1))}
              disabled={step === 1}
            >
              Previous
            </Button>
            
            <Button 
              onClick={handleNext}
              className="w-full max-w-xs"
              size="lg"
              disabled={!canProceed || loading}
            >
              {loading ? 'Saving...' : (step === totalSteps ? 'Complete Onboarding' : 'Next Step')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Onboarding;