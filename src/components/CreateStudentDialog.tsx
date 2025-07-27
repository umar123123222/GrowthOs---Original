import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { useUserManagement } from "@/hooks/useUserManagement";

interface CreateStudentDialogProps {
  onStudentCreated?: () => void;
}

export const CreateStudentDialog = ({ onStudentCreated }: CreateStudentDialogProps) => {
  const { createUser, loading } = useUserManagement();
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    fullName: "",
    tempPassword: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.tempPassword) {
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
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              placeholder="student@example.com"
              required
            />
          </div>
          <div>
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              value={formData.fullName}
              onChange={(e) => setFormData({...formData, fullName: e.target.value})}
              placeholder="Enter student's full name"
            />
          </div>
          <div>
            <Label htmlFor="tempPassword">Temporary Password *</Label>
            <Input
              id="tempPassword"
              type="password"
              value={formData.tempPassword}
              onChange={(e) => setFormData({...formData, tempPassword: e.target.value})}
              placeholder="Create a temporary password"
              required
            />
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