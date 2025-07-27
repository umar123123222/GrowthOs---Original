import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { useUserManagement } from "@/hooks/useUserManagement";
import { useToast } from "@/hooks/use-toast";

interface CreateStudentDialogProps {
  onStudentCreated?: () => void;
}

export const CreateStudentDialog = ({ onStudentCreated }: CreateStudentDialogProps) => {
  const { createUser, loading } = useUserManagement();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    fullName: "",
    tempPassword: ""
  });
  const [errors, setErrors] = useState({
    email: "",
    fullName: "",
    tempPassword: ""
  });

  const validatePassword = (password: string): string => {
    if (password.length < 8) {
      return "Password must be at least 8 characters long";
    }
    if (!/[A-Z]/.test(password)) {
      return "Password must contain at least one uppercase letter";
    }
    if (!/[a-z]/.test(password)) {
      return "Password must contain at least one lowercase letter";
    }
    if (!/\d/.test(password)) {
      return "Password must contain at least one digit";
    }
    return "";
  };

  const validateEmail = (email: string): string => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      return "Email is required";
    }
    if (!emailRegex.test(email)) {
      return "Please enter a valid email address";
    }
    return "";
  };

  const validateFullName = (fullName: string): string => {
    if (fullName && fullName.length < 3) {
      return "Full name must be at least 3 characters long";
    }
    return "";
  };

  const handleFieldChange = (field: keyof typeof formData, value: string) => {
    setFormData({ ...formData, [field]: value });
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors({ ...errors, [field]: "" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all fields
    const emailError = validateEmail(formData.email);
    const fullNameError = validateFullName(formData.fullName);
    const passwordError = validatePassword(formData.tempPassword);
    
    const newErrors = {
      email: emailError,
      fullName: fullNameError,
      tempPassword: passwordError
    };
    
    setErrors(newErrors);
    
    // Check if there are any errors
    if (emailError || fullNameError || passwordError) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please fix the errors in the form"
      });
      return;
    }

    const success = await createUser({
      target_email: formData.email,
      target_password: formData.tempPassword,
      target_role: 'student',
      target_full_name: formData.fullName || formData.email
    });

    if (success) {
      setFormData({ email: "", fullName: "", tempPassword: "" });
      setErrors({ email: "", fullName: "", tempPassword: "" });
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Student</DialogTitle>
          <DialogDescription>
            Create a new student account with login credentials
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleFieldChange('email', e.target.value)}
              placeholder="student@example.com"
              required
              className={errors.email ? "border-destructive" : ""}
            />
            {errors.email && (
              <p className="text-sm text-destructive mt-1">{errors.email}</p>
            )}
          </div>
          <div>
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              value={formData.fullName}
              onChange={(e) => handleFieldChange('fullName', e.target.value)}
              placeholder="Enter student's full name"
              className={errors.fullName ? "border-destructive" : ""}
            />
            {errors.fullName && (
              <p className="text-sm text-destructive mt-1">{errors.fullName}</p>
            )}
          </div>
          <div>
            <Label htmlFor="tempPassword">Temporary Password *</Label>
            <Input
              id="tempPassword"
              type="password"
              value={formData.tempPassword}
              onChange={(e) => handleFieldChange('tempPassword', e.target.value)}
              placeholder="Create a temporary password"
              required
              className={errors.tempPassword ? "border-destructive" : ""}
            />
            {errors.tempPassword && (
              <p className="text-sm text-destructive mt-1">{errors.tempPassword}</p>
            )}
          </div>
          <Button 
            type="submit" 
            disabled={loading}
            className="w-full"
          >
            {loading ? "Creating..." : "Create Student"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};