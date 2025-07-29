import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useSecureStudentCreation, CreateStudentData } from '@/hooks/useSecureStudentCreation';
import { useInstallmentOptions } from '@/hooks/useInstallmentOptions';
import { useAuth } from '@/hooks/useAuth';

interface SecureStudentCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStudentCreated: () => void;
}

export const SecureStudentCreationDialog = ({
  open,
  onOpenChange,
  onStudentCreated,
}: SecureStudentCreationDialogProps) => {
  const { user, hasRole } = useAuth();
  const { createStudent, isCreating } = useSecureStudentCreation();
  const { options: plans, isLoading: plansLoading } = useInstallmentOptions();
  const plansError = null; // useInstallmentOptions doesn't have error state

  const [formData, setFormData] = useState<CreateStudentData>({
    full_name: '',
    email: '',
    phone: '',
    fees_structure: '',
  });

  const [errors, setErrors] = useState<Partial<CreateStudentData>>({});

  // Check if user has permission
  const hasPermission = hasRole(['superadmin', 'admin', 'enrollment_manager']);

  const validateForm = (): boolean => {
    const newErrors: Partial<CreateStudentData> = {};

    if (!formData.full_name || formData.full_name.trim().length < 3) {
      newErrors.full_name = 'Full name must be at least 3 characters';
    }

    if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.phone || !/^\+\d{10,}$/.test(formData.phone)) {
      newErrors.phone = 'Phone must start with + and have at least 10 digits';
    }

    if (!formData.fees_structure) {
      newErrors.fees_structure = 'Please select a fees structure';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!hasPermission) {
      return;
    }

    if (!validateForm()) {
      return;
    }

    const result = await createStudent(formData);

    if (result.success) {
      // Reset form
      setFormData({
        full_name: '',
        email: '',
        phone: '',
        fees_structure: '',
      });
      setErrors({});
      onOpenChange(false);
      onStudentCreated();
    }
  };

  const handleInputChange = (field: keyof CreateStudentData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  if (!hasPermission) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Access Denied</DialogTitle>
          </DialogHeader>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              You don't have permission to create students. Only superadmins, admins, and enrollment managers can create student accounts.
            </AlertDescription>
          </Alert>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Student</DialogTitle>
        </DialogHeader>

        {plansError && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {plansError}. Please configure installment plans in company settings before creating students.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Full Name *</Label>
            <Input
              id="full_name"
              value={formData.full_name}
              onChange={(e) => handleInputChange('full_name', e.target.value)}
              placeholder="Enter student's full name"
              disabled={isCreating || !!plansError}
            />
            {errors.full_name && (
              <p className="text-sm text-destructive">{errors.full_name}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value.toLowerCase())}
              placeholder="Enter student's email"
              disabled={isCreating || !!plansError}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number *</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              placeholder="+1234567890"
              disabled={isCreating || !!plansError}
            />
            {errors.phone && (
              <p className="text-sm text-destructive">{errors.phone}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="fees_structure">Fees Structure *</Label>
            <Select
              value={formData.fees_structure}
              onValueChange={(value) => handleInputChange('fees_structure', value)}
              disabled={isCreating || plansLoading || !!plansError}
            >
              <SelectTrigger>
                <SelectValue placeholder={
                  plansLoading 
                    ? "Loading plans..." 
                    : plansError 
                      ? "Plans not available" 
                      : "Select fees structure"
                } />
              </SelectTrigger>
              <SelectContent>
                {plans.map((plan) => (
                  <SelectItem key={plan.value} value={plan.value}>
                    {plan.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.fees_structure && (
              <p className="text-sm text-destructive">{errors.fees_structure}</p>
            )}
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isCreating}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isCreating || !!plansError || plansLoading}
              className="flex-1"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Student'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};