import React, { useState, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, BadgePercent } from 'lucide-react'
import { useInstallmentOptions } from '@/hooks/useInstallmentOptions'
import { useEnhancedStudentCreation } from '@/hooks/useEnhancedStudentCreation'
import { useAuth } from '@/hooks/useAuth'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

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
  
  const { hasRole } = useAuth()
  const canApplyDiscount = hasRole(['admin', 'superadmin'])
  
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    installment_count: 1,
    discount_type: 'none' as 'none' | 'fixed' | 'percentage',
    discount_amount: 0,
    discount_percentage: 0
  })

  // Fetch original fee amount
  const { data: companySettings } = useQuery({
    queryKey: ['company-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_settings')
        .select('original_fee_amount, currency')
        .eq('id', 1)
        .single()
      if (error) throw error
      return data
    }
  })

  const originalFee = companySettings?.original_fee_amount || 0
  const currency = companySettings?.currency || 'PKR'

  // Calculate final amount with discount
  const calculatedAmounts = useMemo(() => {
    let finalAmount = originalFee
    let discountApplied = 0

    if (formData.discount_type === 'percentage' && formData.discount_percentage > 0) {
      discountApplied = originalFee * (formData.discount_percentage / 100)
      finalAmount = originalFee - discountApplied
    } else if (formData.discount_type === 'fixed' && formData.discount_amount > 0) {
      discountApplied = formData.discount_amount
      finalAmount = originalFee - discountApplied
    }

    finalAmount = Math.max(0, finalAmount)
    const perInstallment = formData.installment_count > 0 ? finalAmount / formData.installment_count : 0

    return {
      originalFee,
      discountApplied,
      finalAmount,
      perInstallment
    }
  }, [originalFee, formData.discount_type, formData.discount_amount, formData.discount_percentage, formData.installment_count])

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
        installment_count: formData.installment_count,
        discount_amount: formData.discount_type === 'fixed' ? formData.discount_amount : 0,
        discount_percentage: formData.discount_type === 'percentage' ? formData.discount_percentage : 0
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
            installment_count: 1,
            discount_type: 'none',
            discount_amount: 0,
            discount_percentage: 0
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
      <DialogContent className="max-w-2xl">
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
          {/* Two-column grid for main fields */}
          <div className="grid grid-cols-2 gap-4">
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
                onChange={(e) => {
                  let value = e.target.value.replace(/[^\d-]/g, '')
                  if (!value.startsWith('92-') && value.length > 0) {
                    value = '92-' + value.replace(/^92-?/, '')
                  }
                  handleInputChange('phone', value)
                }}
                placeholder="92-3001234567"
                pattern="92-[0-9]{10}"
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
          </div>

          {/* Admin-Only Discount Section - Full Width */}
          {canApplyDiscount && (
            <Card className="border-orange-200 bg-orange-50/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BadgePercent className="h-4 w-4" />
                  Discount (Admin Only)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Discount Type</Label>
                    <Select
                      value={formData.discount_type}
                      onValueChange={(value: 'none' | 'fixed' | 'percentage') => {
                        setFormData(prev => ({ 
                          ...prev, 
                          discount_type: value,
                          discount_amount: 0,
                          discount_percentage: 0
                        }))
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Discount</SelectItem>
                        <SelectItem value="fixed">Fixed Amount</SelectItem>
                        <SelectItem value="percentage">Percentage</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                {formData.discount_type === 'fixed' && (
                  <div className="space-y-2">
                    <Label>Discount Amount ({currency})</Label>
                    <Input
                      type="number"
                      min="0"
                      max={originalFee - 1}
                      step="0.01"
                      value={formData.discount_amount}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0
                        handleInputChange('discount_amount', Math.min(originalFee - 1, Math.max(0, value)))
                      }}
                      placeholder="0.00"
                    />
                    <p className="text-xs text-muted-foreground">Must leave at least {currency} 1 after discount</p>
                  </div>
                )}

                {formData.discount_type === 'percentage' && (
                  <div className="space-y-2">
                    <Label>Discount Percentage (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="99"
                      step="0.01"
                      value={formData.discount_percentage}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0
                        handleInputChange('discount_percentage', Math.min(99, Math.max(0, value)))
                      }}
                      placeholder="0.00"
                    />
                    <p className="text-xs text-muted-foreground">Maximum 99% discount allowed</p>
                  </div>
                )}
                </div>

                {formData.discount_type !== 'none' && (
                  <div className="pt-2 space-y-1 border-t border-orange-200">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Original Fee:</span>
                      <span className="font-medium">{currency} {calculatedAmounts.originalFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-orange-600">
                      <span>Discount:</span>
                      <span className="font-medium">- {currency} {calculatedAmounts.discountApplied.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-base font-semibold border-t border-orange-200 pt-1">
                      <span>Final Fee:</span>
                      <span>{currency} {calculatedAmounts.finalAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Per Installment:</span>
                      <span>{currency} {calculatedAmounts.perInstallment.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          
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