import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { useUserManagement } from "@/hooks/useUserManagement";
import { useToast } from "@/hooks/use-toast";
import { useStudentFormValidation, type StudentFormData } from "@/hooks/useStudentFormValidation";
import { useInstallmentOptions } from "@/hooks/useInstallmentOptions";
import { generateSecurePassword } from "@/utils/passwordGenerator";

interface CreateStudentDialogProps {
  onStudentCreated?: () => void;
}

export const CreateStudentDialog = ({ onStudentCreated }: CreateStudentDialogProps) => {
  const { createUser, loading } = useUserManagement();
  const { toast } = useToast();
  const { errors, clearFieldError, validateAndSetErrors } = useStudentFormValidation();
  const { options, defaultValue } = useInstallmentOptions();
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState<StudentFormData>({
    full_name: "",
    email: "",
    phone: "",
    fees_structure: defaultValue
  });

  const handleFieldChange = (field: keyof StudentFormData, value: string) => {
    setFormData({ ...formData, [field]: value });
    
    // Clear error when user starts typing
    if (errors[field]) {
      clearFieldError(field);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all fields using the comprehensive validation hook
    const isValid = await validateAndSetErrors(formData);
    
    if (!isValid) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please fix the errors in the form"
      });
      return;
    }

    // Generate secure temporary password
    const tempPassword = generateSecurePassword();

    const success = await createUser({
      target_email: formData.email,
      target_password: tempPassword,
      target_role: 'student',
      target_full_name: formData.full_name || formData.email
    });

    if (success) {
      setFormData({ 
        full_name: "", 
        email: "", 
        phone: "", 
        fees_structure: defaultValue 
      });
      setIsOpen(false);
      onStudentCreated?.();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Add Student
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Student</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="fullName">Full Name *</Label>
            <Input
              id="fullName"
              value={formData.full_name}
              onChange={(e) => handleFieldChange('full_name', e.target.value)}
              placeholder="Enter full name (minimum 3 characters)"
              required
              className={errors.full_name ? "border-destructive" : ""}
            />
            {errors.full_name && (
              <p className="text-sm text-destructive mt-1">{errors.full_name}</p>
            )}
          </div>
          
          <div>
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleFieldChange('email', e.target.value)}
              placeholder="Enter valid email address"
              required
              className={errors.email ? "border-destructive" : ""}
            />
            {errors.email && (
              <p className="text-sm text-destructive mt-1">{errors.email}</p>
            )}
          </div>

          <div>
            <Label htmlFor="phone">Phone *</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => handleFieldChange('phone', e.target.value)}
              placeholder="Phone must start with a country code, e.g. '+92...'"
              required
              className={errors.phone ? "border-destructive" : ""}
            />
            {errors.phone && (
              <p className="text-sm text-destructive mt-1">{errors.phone}</p>
            )}
          </div>

          <div>
            <Label htmlFor="feesStructure">Fees Structure *</Label>
            <Select
              value={formData.fees_structure}
              onValueChange={(value) => handleFieldChange('fees_structure', value)}
              required
            >
              <SelectTrigger className={errors.fees_structure ? "border-destructive" : ""}>
                <SelectValue placeholder="Select installment option" />
              </SelectTrigger>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.fees_structure && (
              <p className="text-sm text-destructive mt-1">{errors.fees_structure}</p>
            )}
          </div>

          <div className="text-sm text-muted-foreground space-y-1 py-2">
            <p>• LMS User ID will be set to the student's email</p>
            <p>• Temporary password will be auto-generated</p>
            <p>• LMS status will be inactive until first payment</p>
          </div>

          <div className="flex gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              className="flex-1"
            >
              {loading ? "Creating..." : "Add Student"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};