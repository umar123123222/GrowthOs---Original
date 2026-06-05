import React, { useState, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, BadgePercent, BookOpen, Route, Settings2, ChevronDown, ChevronUp, Users, UserPlus, Upload, User, Mail, Phone, GraduationCap, CheckCircle2, Sparkles } from 'lucide-react'
import { useInstallmentOptions } from '@/hooks/useInstallmentOptions'
import { useEnhancedStudentCreation } from '@/hooks/useEnhancedStudentCreation'
import { useAuth } from '@/hooks/useAuth'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Switch } from '@/components/ui/switch'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { BulkStudentUpload } from './BulkStudentUpload'

interface EnhancedStudentCreationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onStudentCreated: () => void
}

type EnrollmentType = 'course' | 'pathway'

interface Course {
  id: string
  title: string
  price: number | null
  currency: string | null
}

interface Pathway {
  id: string
  name: string
  price: number | null
  currency: string | null
}

interface Batch {
  id: string
  name: string
  start_date: string
  course_id: string | null
  pathway_id: string | null
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
    enrollment_type: 'pathway' as EnrollmentType,
    course_id: '',
    pathway_id: '',
    batch_id: '',
    discount_type: 'none' as 'none' | 'fixed' | 'percentage',
    discount_amount: 0,
    discount_percentage: 0,
    // Access control overrides
    drip_override: false,
    drip_enabled: false,
    sequential_override: false,
    sequential_enabled: false
  })
  
  const [accessSettingsOpen, setAccessSettingsOpen] = useState(false)
  const [uploadMode, setUploadMode] = useState<'single' | 'bulk'>('single')

  // Fetch company settings for currency
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

  // Fetch courses
  const { data: courses = [] } = useQuery({
    queryKey: ['courses-for-enrollment'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('id, title, price, currency')
        .eq('is_active', true)
        .order('sequence_order')
      if (error) throw error
      return data as Course[]
    }
  })

  // Fetch pathways
  const { data: pathways = [] } = useQuery({
    queryKey: ['pathways-for-enrollment'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('learning_pathways')
        .select('id, name, price, currency')
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      return data as Pathway[]
    }
  })

  // Fetch batches (most recent first)
  const { data: batches = [] } = useQuery({
    queryKey: ['batches-for-enrollment'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('batches')
        .select('id, name, start_date, course_id, pathway_id')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Batch[]
    }
  })

  // Track if user has explicitly set batch preference
  const [batchUserSelected, setBatchUserSelected] = React.useState(false)
  
  // Set default batch to most recent when batches load (only if user hasn't selected yet)
  React.useEffect(() => {
    if (batches.length > 0 && !batchUserSelected && formData.batch_id === '') {
      setFormData(prev => ({ ...prev, batch_id: batches[0].id }))
    }
  }, [batches, batchUserSelected])

  const currency = companySettings?.currency || 'PKR'

  // Get selected item's price
  const selectedPrice = useMemo(() => {
    if (formData.enrollment_type === 'course' && formData.course_id) {
      const course = courses.find(c => c.id === formData.course_id)
      return course?.price || 0
    } else if (formData.enrollment_type === 'pathway' && formData.pathway_id) {
      const pathway = pathways.find(p => p.id === formData.pathway_id)
      return pathway?.price || 0
    }
    return 0
  }, [formData.enrollment_type, formData.course_id, formData.pathway_id, courses, pathways])

  // Calculate final amount with discount
  const calculatedAmounts = useMemo(() => {
    let finalAmount = selectedPrice
    let discountApplied = 0

    if (formData.discount_type === 'percentage' && formData.discount_percentage > 0) {
      discountApplied = selectedPrice * (formData.discount_percentage / 100)
      finalAmount = selectedPrice - discountApplied
    } else if (formData.discount_type === 'fixed' && formData.discount_amount > 0) {
      discountApplied = formData.discount_amount
      finalAmount = selectedPrice - discountApplied
    }

    finalAmount = Math.max(0, finalAmount)
    const perInstallment = formData.installment_count > 0 ? finalAmount / formData.installment_count : 0

    return {
      originalFee: selectedPrice,
      discountApplied,
      finalAmount,
      perInstallment
    }
  }, [selectedPrice, formData.discount_type, formData.discount_amount, formData.discount_percentage, formData.installment_count])

  const handleEnrollmentTypeChange = (value: EnrollmentType) => {
    setFormData(prev => ({
      ...prev,
      enrollment_type: value,
      course_id: '',
      pathway_id: '',
      discount_amount: 0,
      discount_percentage: 0,
      discount_type: 'none'
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isSubmitting || isLoading) return
    setIsSubmitting(true)
    setCurrentStep('Validating information...')
    
    try {
      if (!formData.email || !formData.full_name || !formData.phone || formData.installment_count < 1) {
        return
      }

      // Validate course/pathway selection
      if (formData.enrollment_type === 'course' && !formData.course_id) {
        return
      }
      if (formData.enrollment_type === 'pathway' && !formData.pathway_id) {
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
        course_id: formData.enrollment_type === 'course' ? formData.course_id : undefined,
        pathway_id: formData.enrollment_type === 'pathway' ? formData.pathway_id : undefined,
        batch_id: formData.batch_id || undefined,
        total_fee_amount: selectedPrice,
        discount_amount: formData.discount_type === 'fixed' ? formData.discount_amount : 0,
        discount_percentage: formData.discount_type === 'percentage' ? formData.discount_percentage : 0,
        // Access control overrides
        drip_override: formData.drip_override,
        drip_enabled: formData.drip_override ? formData.drip_enabled : undefined,
        sequential_override: formData.sequential_override,
        sequential_enabled: formData.sequential_override ? formData.sequential_enabled : undefined
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
            enrollment_type: 'course',
            course_id: '',
            pathway_id: '',
            batch_id: batches.length > 0 ? batches[0].id : '',
            discount_type: 'none',
            discount_amount: 0,
            discount_percentage: 0,
            drip_override: false,
            drip_enabled: false,
            sequential_override: false,
            sequential_enabled: false
          })
          setAccessSettingsOpen(false)
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

  const isFormValid = formData.email && formData.full_name && formData.phone && 
    ((formData.enrollment_type === 'course' && formData.course_id) || 
     (formData.enrollment_type === 'pathway' && formData.pathway_id))

  return (
    <Dialog open={open} onOpenChange={(open) => !isSubmitting && onOpenChange(open)}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-hidden p-0 gap-0">
        {/* Decorative header */}
        <div className="relative border-b bg-gradient-to-br from-primary/5 via-background to-background px-6 pt-6 pb-5">
          <DialogHeader className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                {showSuccess ? <CheckCircle2 className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold tracking-tight">
                  {showSuccess ? 'Student Created Successfully' : 'Add New Student'}
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {showSuccess
                    ? 'Credentials have been delivered to their inbox.'
                    : 'Enroll a new student and configure their plan in one go.'}
                </p>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="overflow-y-auto px-6 py-5 max-h-[calc(92vh-7rem)] scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
        
        {showSuccess ? (
          <div className="space-y-6 py-8">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-4 ring-emerald-50 dark:ring-emerald-500/5">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <p className="text-base font-medium text-foreground">
                  {createdStudentInfo?.full_name} is all set
                </p>
                <p className="text-sm text-muted-foreground">
                  Credentials sent to <span className="font-medium text-foreground">{createdStudentInfo?.email}</span>
                </p>
              </div>
            </div>
            <div className="mx-auto max-w-xs rounded-lg border bg-muted/30 px-4 py-3 text-center">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Student ID</p>
              <p className="text-sm font-mono font-semibold text-foreground mt-0.5">{createdStudentInfo?.student_id}</p>
            </div>
          </div>
        ) : (
          <Tabs value={uploadMode} onValueChange={(v) => setUploadMode(v as 'single' | 'bulk')} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-5 h-11 p-1 bg-muted/60">
              <TabsTrigger value="single" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <UserPlus className="h-4 w-4" />
                Single Student
              </TabsTrigger>
              <TabsTrigger value="bulk" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Upload className="h-4 w-4" />
                Bulk Upload
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="single" className="mt-0">
          <form onSubmit={handleSubmit} className="space-y-5">
          {/* Personal Info Section */}
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <div className="flex items-center gap-2 pb-1">
              <User className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Personal Information</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="full_name" className="text-xs font-medium text-muted-foreground">Student Name *</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => handleInputChange('full_name', e.target.value)}
                  placeholder="John Doe"
                  className="h-10"
                  required
                />
              </div>
              
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium text-muted-foreground">Email Address *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 pointer-events-none" />
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="student@example.com"
                    className="h-10 pl-9"
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-xs font-medium text-muted-foreground">Phone Number *</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 pointer-events-none" />
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => {
                      let value = e.target.value.trim()
                      value = value.replace(/[^\d+]/g, '')
                      if (value.indexOf('+') > 0) {
                        value = value.replace(/\+/g, '')
                      }
                      if (value.startsWith('92') && !value.startsWith('+')) {
                        value = '+' + value
                      }
                      handleInputChange('phone', value)
                    }}
                    placeholder="+923001234567"
                    pattern="^\+?[1-9]\d{1,14}$"
                    title="Enter phone in E.164 format (e.g., +923001234567)"
                    className="h-10 pl-9"
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-1.5">
                <Label htmlFor="installments" className="text-xs font-medium text-muted-foreground">Number of Installments *</Label>
                <Select 
                  value={formData.installment_count.toString()} 
                  onValueChange={(value) => handleInputChange('installment_count', parseInt(value))}
                  disabled={installmentLoading}
                >
                  <SelectTrigger className="h-10">
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
          </div>


          {/* Course/Pathway Selection */}
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <div className="flex items-center gap-2 pb-1">
              <GraduationCap className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Enrollment <span className="text-destructive">*</span></h3>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Enrollment Type</Label>
              <RadioGroup
                value={formData.enrollment_type}
                onValueChange={(value) => handleEnrollmentTypeChange(value as EnrollmentType)}
                className="grid grid-cols-2 gap-3"
              >
                <label
                  htmlFor="enroll-course"
                  className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all ${
                    formData.enrollment_type === 'course'
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                      : 'border-border hover:border-primary/40 hover:bg-muted/40'
                  }`}
                >
                  <RadioGroupItem value="course" id="enroll-course" />
                  <BookOpen className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Course</span>
                </label>
                <label
                  htmlFor="enroll-pathway"
                  className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all ${
                    formData.enrollment_type === 'pathway'
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                      : 'border-border hover:border-primary/40 hover:bg-muted/40'
                  }`}
                >
                  <RadioGroupItem value="pathway" id="enroll-pathway" />
                  <Route className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Pathway</span>
                </label>
              </RadioGroup>
            </div>

            {formData.enrollment_type === 'course' ? (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Select Course *</Label>
                <Select
                  value={formData.course_id}
                  onValueChange={(value) => {
                    setFormData(prev => ({
                      ...prev,
                      course_id: value,
                      discount_amount: 0,
                      discount_percentage: 0,
                      discount_type: 'none'
                    }))
                  }}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Select a course" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border z-50">
                    {courses.map((course) => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.title} — {currency} {(course.price || 0).toLocaleString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Select Pathway *</Label>
                <Select
                  value={formData.pathway_id}
                  onValueChange={(value) => {
                    setFormData(prev => ({
                      ...prev,
                      pathway_id: value,
                      discount_amount: 0,
                      discount_percentage: 0,
                      discount_type: 'none'
                    }))
                  }}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Select a pathway" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border z-50">
                    {pathways.map((pathway) => (
                      <SelectItem key={pathway.id} value={pathway.id}>
                        {pathway.name} — {currency} {(pathway.price || 0).toLocaleString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Show price info */}
            {selectedPrice > 0 && (
              <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">Total Fee</span>
                <span className="text-base font-semibold text-foreground">{currency} {selectedPrice.toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* Batch Selection (Optional) */}
          {batches.length > 0 && (
            <div className="rounded-xl border bg-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Batch Assignment</h3>
                </div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded">Optional</span>
              </div>
              <Select
                value={formData.batch_id || "none"}
                onValueChange={(value) => {
                  setBatchUserSelected(true)
                  setFormData(prev => ({ ...prev, batch_id: value === "none" ? "" : value }))
                }}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select a batch" />
                </SelectTrigger>
                <SelectContent className="bg-background border z-50">
                  <SelectItem value="none">No Batch (Use LMS Access Date)</SelectItem>
                  {batches.map((batch) => (
                    <SelectItem key={batch.id} value={batch.id}>
                      {batch.name} (Start: {new Date(batch.start_date).toLocaleDateString()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground leading-relaxed">
                If assigned to a batch, content drip is calculated from the batch start date instead of the LMS access date.
              </p>
            </div>
          )}



          {/* Access Settings Section (Drip/Sequential Override) */}
          {canApplyDiscount && (formData.course_id || formData.pathway_id) && (
            <Collapsible open={accessSettingsOpen} onOpenChange={setAccessSettingsOpen}>
              <div className="rounded-xl border bg-card overflow-hidden">
                <CollapsibleTrigger asChild>
                  <button type="button" className="w-full flex items-center justify-between p-5 hover:bg-muted/40 transition-colors text-left">
                    <div className="flex items-center gap-2">
                      <Settings2 className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-semibold text-foreground">Access Settings</h3>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded">Admin</span>
                    </div>
                    {accessSettingsOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-5 pb-5 space-y-4 border-t bg-muted/20">
                    <p className="text-xs text-muted-foreground pt-4">
                      Override company/course defaults for this specific student.
                    </p>

                    {/* Content Dripping Override */}
                    <div className="space-y-3 p-4 rounded-lg border bg-background">
                      <div className="flex items-center justify-between gap-4">
                        <Label htmlFor="drip-override" className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium">Override Content Dripping</span>
                          <span className="font-normal text-xs text-muted-foreground">
                            Control when recordings become available
                          </span>
                        </Label>
                        <Switch
                          id="drip-override"
                          checked={formData.drip_override}
                          onCheckedChange={(checked) => handleInputChange('drip_override', checked ? 1 : 0)}
                        />
                      </div>

                      {formData.drip_override && (
                        <RadioGroup
                          value={formData.drip_enabled ? 'enabled' : 'disabled'}
                          onValueChange={(value) => handleInputChange('drip_enabled', value === 'enabled' ? 1 : 0)}
                          className="pl-1 pt-2 space-y-2 border-t pt-3"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="disabled" id="drip-disabled" />
                            <Label htmlFor="drip-disabled" className="font-normal text-sm cursor-pointer">
                              Disable dripping (all content available immediately)
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="enabled" id="drip-enabled" />
                            <Label htmlFor="drip-enabled" className="font-normal text-sm cursor-pointer">
                              Enable dripping (content unlocks over time)
                            </Label>
                          </div>
                        </RadioGroup>
                      )}
                    </div>

                    {/* Sequential Unlock Override */}
                    <div className="space-y-3 p-4 rounded-lg border bg-background">
                      <div className="flex items-center justify-between gap-4">
                        <Label htmlFor="sequential-override" className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium">Override Sequential Unlock</span>
                          <span className="font-normal text-xs text-muted-foreground">
                            Control whether recordings must be watched in order
                          </span>
                        </Label>
                        <Switch
                          id="sequential-override"
                          checked={formData.sequential_override}
                          onCheckedChange={(checked) => handleInputChange('sequential_override', checked ? 1 : 0)}
                        />
                      </div>

                      {formData.sequential_override && (
                        <RadioGroup
                          value={formData.sequential_enabled ? 'enabled' : 'disabled'}
                          onValueChange={(value) => handleInputChange('sequential_enabled', value === 'enabled' ? 1 : 0)}
                          className="pl-1 pt-2 space-y-2 border-t pt-3"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="disabled" id="sequential-disabled" />
                            <Label htmlFor="sequential-disabled" className="font-normal text-sm cursor-pointer">
                              Disable sequential unlock (watch any recording)
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="enabled" id="sequential-enabled" />
                            <Label htmlFor="sequential-enabled" className="font-normal text-sm cursor-pointer">
                              Enable sequential unlock (must watch in order)
                            </Label>
                          </div>
                        </RadioGroup>
                      )}
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          )}

          {/* Admin-Only Discount Section */}
          {canApplyDiscount && selectedPrice > 0 && (
            <div className="rounded-xl border bg-card p-5 space-y-4">
              <div className="flex items-center gap-2">
                <BadgePercent className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Discount</h3>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded">Admin</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Discount Type</Label>
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
                    <SelectTrigger className="h-10">
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
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Discount Amount ({currency})</Label>
                    <Input
                      type="number"
                      min="0"
                      max={selectedPrice}
                      step="0.01"
                      value={formData.discount_amount}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0
                        handleInputChange('discount_amount', Math.min(selectedPrice, Math.max(0, value)))
                      }}
                      placeholder="0.00"
                      className="h-10"
                    />
                  </div>
                )}

                {formData.discount_type === 'percentage' && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Discount Percentage (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={formData.discount_percentage}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0
                        handleInputChange('discount_percentage', Math.min(100, Math.max(0, value)))
                      }}
                      placeholder="0.00"
                      className="h-10"
                    />
                  </div>
                )}
              </div>

              {formData.discount_type !== 'none' && (
                <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Original Fee</span>
                    <span className="font-medium">{currency} {calculatedAmounts.originalFee.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm text-emerald-600 dark:text-emerald-400">
                    <span>Discount Applied</span>
                    <span className="font-medium">− {currency} {calculatedAmounts.discountApplied.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-base font-semibold border-t pt-2">
                    <span>Final Fee</span>
                    <span className="text-primary">{currency} {calculatedAmounts.finalAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Per Installment</span>
                    <span>{currency} {calculatedAmounts.perInstallment.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>
          )}

            {/* Submission status */}
            {(isLoading || isSubmitting) && currentStep && (
              <div className="rounded-lg border bg-primary/5 px-4 py-3 flex items-center gap-3">
                <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{currentStep}</p>
                  <p className="text-xs text-muted-foreground">
                    {currentStep.includes('account') && 'Step 1 of 3'}
                    {currentStep.includes('profile') && 'Step 2 of 3'}
                    {currentStep.includes('email') && 'Step 3 of 3 — Almost done!'}
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2 sticky bottom-0 -mx-6 -mb-5 px-6 py-4 bg-background/95 backdrop-blur border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading || isSubmitting}
                className="sm:flex-none"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading || isSubmitting || !isFormValid || installmentLoading}
                className="sm:flex-1 gap-2"
              >
                {(isLoading || isSubmitting) ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Create Student
              </Button>
            </div>
          </form>
            </TabsContent>

            
            <TabsContent value="bulk">
              <BulkStudentUpload
                sharedSettings={{
                  installment_count: formData.installment_count,
                  enrollment_type: formData.enrollment_type,
                  course_id: formData.course_id,
                  pathway_id: formData.pathway_id,
                  batch_id: formData.batch_id,
                  total_fee_amount: selectedPrice,
                  discount_type: formData.discount_type,
                  discount_amount: formData.discount_amount,
                  discount_percentage: formData.discount_percentage,
                  drip_override: formData.drip_override,
                  drip_enabled: formData.drip_enabled,
                  sequential_override: formData.sequential_override,
                  sequential_enabled: formData.sequential_enabled
                }}
                onComplete={() => onStudentCreated()}
                onClose={() => onOpenChange(false)}
              />
            </TabsContent>
          </Tabs>
        )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
