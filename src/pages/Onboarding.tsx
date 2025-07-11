
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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface OnboardingProps {
  user: any;
  onComplete: () => void;
}

const Onboarding = ({ user, onComplete }: OnboardingProps) => {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    incomeGoal: "",
    customIncomeGoal: "",
    whyIncome: "",
    successMeaning: [] as string[],
    otherSuccessReason: "",
    timeCommitment: "",
    ecommerceExperience: "",
    ecommerceExplain: "",
    facebookAdsExperience: "",
    facebookAdsExplain: "",
    shopifyExperience: "",
    shopifyExplain: "",
    biggestBlocker: "",
    blockerExplain: "",
    thirtyDayGoal: "",
    goalExplain: ""
  });

  const totalSteps = 9;
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

  const ecommerceOptions = [
    { value: "complete_beginner", label: "No, I'm a complete beginner" },
    { value: "tried_not_launched", label: "I tried but didn't launch" },
    { value: "launched_no_sales", label: "I launched but didn't get sales" },
    { value: "few_sales", label: "I made a few sales" },
    { value: "running_actively", label: "I'm running a store actively right now" },
    { value: "explain", label: "Explain" }
  ];

  const facebookAdsOptions = [
    { value: "never_run", label: "I've never run ads" },
    { value: "seen_tutorials", label: "I've seen tutorials but never tried" },
    { value: "boosted_posts", label: "I boosted posts only" },
    { value: "tried_confused", label: "I tried Ads Manager but got confused" },
    { value: "full_campaigns", label: "I've run full campaigns before" },
    { value: "explain", label: "Explain" }
  ];

  const shopifyOptions = [
    { value: "never_opened", label: "Never opened it" },
    { value: "opened_not_built", label: "Opened but didn't build a store" },
    { value: "built_not_launched", label: "I built a store but didn't launch" },
    { value: "store_live", label: "I have a store live" },
    { value: "making_sales", label: "I'm making sales right now" },
    { value: "explain", label: "Explain" }
  ];

  const blockerOptions = [
    { value: "dont_know_start", label: "I don't know how to start" },
    { value: "product_research", label: "I'm stuck on product research" },
    { value: "facebook_ads_confusing", label: "Facebook Ads are confusing" },
    { value: "shopify_confusing", label: "Shopify is confusing" },
    { value: "no_motivation", label: "No motivation, I start but stop" },
    { value: "no_time", label: "I don't have time" },
    { value: "other", label: "Other" },
    { value: "explain", label: "Explain" }
  ];

  const thirtyDayOptions = [
    { value: "launch_product", label: "Launch my first product" },
    { value: "run_first_ad", label: "Run my first ad" },
    { value: "first_sale", label: "Get my first sale" },
    { value: "freelance_client", label: "Close a freelance client" },
    { value: "automate_ai", label: "Automate something using AI" },
    { value: "dont_know", label: "Don't know yet, just want to start" },
    { value: "explain", label: "Explain" }
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
      case 5:
        if (!formData.ecommerceExperience) return false;
        if (formData.ecommerceExperience === "explain" && !formData.ecommerceExplain.trim()) return false;
        return true;
      case 6:
        if (!formData.facebookAdsExperience) return false;
        if (formData.facebookAdsExperience === "explain" && !formData.facebookAdsExplain.trim()) return false;
        return true;
      case 7:
        if (!formData.shopifyExperience) return false;
        if (formData.shopifyExperience === "explain" && !formData.shopifyExplain.trim()) return false;
        return true;
      case 8:
        if (!formData.biggestBlocker) return false;
        if (formData.biggestBlocker === "explain" && !formData.blockerExplain.trim()) return false;
        return true;
      case 9:
        if (!formData.thirtyDayGoal) return false;
        if (formData.thirtyDayGoal === "explain" && !formData.goalExplain.trim()) return false;
        return true;
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
    try {
      console.log('Submitting onboarding data:', formData);

      // Map form data to the specific database columns
      const incomeGoal = formData.incomeGoal === "custom" ? formData.customIncomeGoal : formData.incomeGoal;
      const successMeaning = formData.successMeaning.includes("other") 
        ? [...formData.successMeaning.filter(s => s !== "other"), formData.otherSuccessReason].join(", ")
        : formData.successMeaning.join(", ");
      
      const ecommerceExp = formData.ecommerceExperience === "explain" 
        ? formData.ecommerceExplain 
        : formData.ecommerceExperience;
      
      const facebookAdsExp = formData.facebookAdsExperience === "explain" 
        ? formData.facebookAdsExplain 
        : formData.facebookAdsExperience;
      
      const shopifyExp = formData.shopifyExperience === "explain" 
        ? formData.shopifyExplain 
        : formData.shopifyExperience;
      
      const blocker = formData.biggestBlocker === "explain" || formData.biggestBlocker === "other"
        ? formData.blockerExplain 
        : formData.biggestBlocker;
      
      const thirtyDayGoal = formData.thirtyDayGoal === "explain" 
        ? formData.goalExplain 
        : formData.thirtyDayGoal;

      const { error } = await supabase
        .from('users')
        .update({
          onboarding_done: true,
          onboarding_data: formData, // Keep the original JSON for reference
          "What's your income goal in the next 3 months?": incomeGoal,
          "Why do you want to make this income?": formData.whyIncome,
          "If you succeed in this program, what would that mean for you pe": successMeaning,
          "How much time can you give to this program every week?": formData.timeCommitment,
          "Have you ever tried starting an ecommerce store before?": ecommerceExp,
          "Do you know how to run Facebook Ads?": facebookAdsExp,
          "What is your experience with Shopify?": shopifyExp,
          "What do you feel is your biggest blocker right now?": blocker,
          "Which of these excites you most to achieve in the next 30 days?": thirtyDayGoal
        })
        .eq('id', user.id);

      if (error) {
        console.error('Database update error:', error);
        throw error;
      }

      console.log('Onboarding data saved successfully');

      toast({
        title: "Onboarding Complete!",
        description: "Welcome to Growth OS. Let's start your journey!",
      });

      onComplete();
    } catch (error) {
      console.error('Onboarding error:', error);
      toast({
        title: "Error",
        description: "Failed to save onboarding data. Please try again.",
        variant: "destructive",
      });
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

  const getStepTitle = () => {
    if (step <= 4) return "Let's Set Your Goals";
    return "Skill Level & Knowledge Check";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <CardTitle className="text-2xl font-bold text-gray-800">
              {getStepTitle()}
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

          {step === 5 && (
            <div className="space-y-6">
              <div>
                <Label className="text-lg font-medium mb-4 block">
                  Have you ever tried starting an ecommerce store before? 🛍️
                </Label>
                <RadioGroup
                  value={formData.ecommerceExperience}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, ecommerceExperience: value }))}
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
                
                {formData.ecommerceExperience === "explain" && (
                  <div className="mt-4">
                    <Label htmlFor="ecommerceExplain" className="text-base font-medium">
                      Please explain:
                    </Label>
                    <Textarea
                      id="ecommerceExplain"
                      value={formData.ecommerceExplain}
                      onChange={(e) => setFormData(prev => ({ ...prev, ecommerceExplain: e.target.value }))}
                      placeholder="Tell us about your ecommerce experience..."
                      className="mt-2 min-h-24 text-base"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-6">
              <div>
                <Label className="text-lg font-medium mb-4 block">
                  Do you know how to run Facebook Ads? 📱
                </Label>
                <RadioGroup
                  value={formData.facebookAdsExperience}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, facebookAdsExperience: value }))}
                  className="space-y-3"
                >
                  {facebookAdsOptions.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <RadioGroupItem value={option.value} id={option.value} />
                      <Label htmlFor={option.value} className="text-base cursor-pointer">
                        {option.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
                
                {formData.facebookAdsExperience === "explain" && (
                  <div className="mt-4">
                    <Label htmlFor="facebookAdsExplain" className="text-base font-medium">
                      Please explain:
                    </Label>
                    <Textarea
                      id="facebookAdsExplain"
                      value={formData.facebookAdsExplain}
                      onChange={(e) => setFormData(prev => ({ ...prev, facebookAdsExplain: e.target.value }))}
                      placeholder="Tell us about your Facebook Ads experience..."
                      className="mt-2 min-h-24 text-base"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 7 && (
            <div className="space-y-6">
              <div>
                <Label className="text-lg font-medium mb-4 block">
                  What is your experience with Shopify? 🛒
                </Label>
                <RadioGroup
                  value={formData.shopifyExperience}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, shopifyExperience: value }))}
                  className="space-y-3"
                >
                  {shopifyOptions.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <RadioGroupItem value={option.value} id={option.value} />
                      <Label htmlFor={option.value} className="text-base cursor-pointer">
                        {option.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
                
                {formData.shopifyExperience === "explain" && (
                  <div className="mt-4">
                    <Label htmlFor="shopifyExplain" className="text-base font-medium">
                      Please explain:
                    </Label>
                    <Textarea
                      id="shopifyExplain"
                      value={formData.shopifyExplain}
                      onChange={(e) => setFormData(prev => ({ ...prev, shopifyExplain: e.target.value }))}
                      placeholder="Tell us about your Shopify experience..."
                      className="mt-2 min-h-24 text-base"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 8 && (
            <div className="space-y-6">
              <div>
                <Label className="text-lg font-medium mb-4 block">
                  What do you feel is your biggest blocker right now? 🚧
                </Label>
                <RadioGroup
                  value={formData.biggestBlocker}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, biggestBlocker: value }))}
                  className="space-y-3"
                >
                  {blockerOptions.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <RadioGroupItem value={option.value} id={option.value} />
                      <Label htmlFor={option.value} className="text-base cursor-pointer">
                        {option.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
                
                {(formData.biggestBlocker === "other" || formData.biggestBlocker === "explain") && (
                  <div className="mt-4">
                    <Label htmlFor="blockerExplain" className="text-base font-medium">
                      Please explain:
                    </Label>
                    <Textarea
                      id="blockerExplain"
                      value={formData.blockerExplain}
                      onChange={(e) => setFormData(prev => ({ ...prev, blockerExplain: e.target.value }))}
                      placeholder="Tell us about your biggest blocker..."
                      className="mt-2 min-h-24 text-base"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 9 && (
            <div className="space-y-6">
              <div>
                <Label className="text-lg font-medium mb-4 block">
                  Which of these excites you most to achieve in the next 30 days? 🎯
                </Label>
                <RadioGroup
                  value={formData.thirtyDayGoal}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, thirtyDayGoal: value }))}
                  className="space-y-3"
                >
                  {thirtyDayOptions.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <RadioGroupItem value={option.value} id={option.value} />
                      <Label htmlFor={option.value} className="text-base cursor-pointer">
                        {option.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
                
                {formData.thirtyDayGoal === "explain" && (
                  <div className="mt-4">
                    <Label htmlFor="goalExplain" className="text-base font-medium">
                      Please explain:
                    </Label>
                    <Textarea
                      id="goalExplain"
                      value={formData.goalExplain}
                      onChange={(e) => setFormData(prev => ({ ...prev, goalExplain: e.target.value }))}
                      placeholder="Tell us what excites you most..."
                      className="mt-2 min-h-24 text-base"
                    />
                  </div>
                )}
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
