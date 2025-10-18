import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { useInstallmentOptions } from '@/hooks/useInstallmentOptions'
import { useEnhancedStudentCreation } from '@/hooks/useEnhancedStudentCreation'

interface EnhancedStudentCreationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onStudentCreated: () => void
}

export const EnhancedStudentCreationDialog: React.FC<EnhancedStudentCreationDialogProps> = ({
  open,
  onOpenChange,
  onStudentCreated
}) => {
  const { createStudent, isLoading } = useEnhancedStudentCreation()
  const { options: installmentOptions, isLoading: installmentLoading } = useInstallmentOptions()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [currentStep, setCurrentStep] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)
  const [createdStudentInfo, setCreatedStudentInfo] = useState<any>(null)
  
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    installment_count: 1
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isSubmitting || isLoading) return
    setIsSubmitting(true)
    setCurrentStep('Validating information...')
    
    try {
      if (!formData.email || !formData.full_name || !formData.phone || formData.installment_count < 1) {
        return
      }

      setCurrentStep('Creating user account...')
      await new Promise(resolve => setTimeout(resolve, 300))
      
      setCurrentStep('Setting up student profile...')
      const result = await createStudent({
        full_name: formData.full_name,
        email: formData.email,
        phone: formData.phone,
        installment_count: formData.installment_count
      })

      if (result.success) {
        setCurrentStep('Sending credentials email...')
        await new Promise(resolve => setTimeout(resolve, 500))
        
        setCreatedStudentInfo(result.data)
        setShowSuccess(true)
        setCurrentStep('')
        
        // Reset form and close after showing success
        setTimeout(() => {
          setFormData({
            full_name: '',
            email: '',
            phone: '',
            installment_count: 1
          })
          setShowSuccess(false)
          setCreatedStudentInfo(null)
          onOpenChange(false)
          onStudentCreated()
        }, 3000)
      }
    } finally {
      if (!showSuccess) {
        setIsSubmitting(false)
        setCurrentStep('')
      }
    }
  }

  const handleInputChange = (field: keyof typeof formData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !isSubmitting && onOpenChange(open)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {showSuccess ? '✅ Student Created Successfully!' : 'Add New Student'}
          </DialogTitle>
        </DialogHeader>
        
        {showSuccess ? (
          <div className="space-y-4 py-6">
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                <strong>{createdStudentInfo?.full_name}</strong> has been added successfully.
              </p>
              <p className="text-xs text-muted-foreground">
                Student ID: <strong>{createdStudentInfo?.student_id}</strong>
              </p>
              <p className="text-xs text-muted-foreground">
                Credentials have been sent to <strong>{createdStudentInfo?.email}</strong>
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Student Name *</Label>
            <Input
              id="full_name"
              value={formData.full_name}
              onChange={(e) => handleInputChange('full_name', e.target.value)}
              placeholder="Enter student's full name"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              placeholder="Enter email address"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number *</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              placeholder="Enter phone number"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="installments">Number of Installments *</Label>
            <Select 
              value={formData.installment_count.toString()} 
              onValueChange={(value) => handleInputChange('installment_count', parseInt(value))}
              disabled={installmentLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select installment plan" />
              </SelectTrigger>
              <SelectContent>
                {installmentOptions.map((option) => {
                  const count = parseInt(option.value.split('_')[0])
                  return (
                    <SelectItem key={option.value} value={count.toString()}>
                      {option.label}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
          
            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading || isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading || isSubmitting || !formData.email || !formData.full_name || !formData.phone || installmentLoading}
              >
                {(isLoading || isSubmitting) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Student
              </Button>
            </div>
            
            {(isLoading || isSubmitting) && currentStep && (
              <div className="pt-2 space-y-2">
                <p className="text-sm text-muted-foreground text-center flex items-center justify-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {currentStep}
                </p>
                <div className="text-xs text-muted-foreground text-center">
                  {currentStep.includes('account') && 'Step 1/3'}
                  {currentStep.includes('profile') && 'Step 2/3'}
                  {currentStep.includes('email') && 'Step 3/3 - Almost done!'}
                </div>
              </div>
            )}
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}