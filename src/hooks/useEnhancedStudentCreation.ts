import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'

export interface EnhancedStudentData {
  email: string
  full_name: string
  phone: string
  installment_count: number
  discount_amount?: number
  discount_percentage?: number
}

export interface EnhancedStudentResponse {
  success: boolean
  data?: {
    id: string
    email: string
    full_name: string
    role: string
    student_id: string
    lms_credentials: {
      lms_user_id: string
      lms_password: string
    }
    generated_password: string
    created_at: string
  }
  message?: string
  error?: string
  error_code?: string
}

export const useEnhancedStudentCreation = () => {
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const createStudent = async (studentData: EnhancedStudentData): Promise<EnhancedStudentResponse> => {
    setIsLoading(true)
    
    try {
      const { data, error } = await supabase.functions.invoke('create-enhanced-student', {
        body: studentData,
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        }
      })

      if (error) {
        console.error('Edge function error:', error)
        toast({
          title: "Error",
          description: "Failed to create student. Please try again.",
          variant: "destructive",
        })
        return {
          success: false,
          error: 'Edge function error',
          error_code: 'FUNCTION_ERROR'
        }
      }

      if (data?.success) {
        toast({
          title: "Success",
          description: `Student ${data.data.full_name} created successfully! Welcome email sent with LMS credentials.`,
        })
        return data
      } else {
        const rawError = data?.error || 'Unknown error occurred'
        const isEmailExists = /already exists/i.test(rawError)
        const isPhoneInvalid = data?.error_code === 'INVALID_PHONE_FORMAT' || /phone.*format|E\.164/i.test(rawError)
        
        let friendlyMessage = rawError
        if (isEmailExists) {
          friendlyMessage = 'A user with this email already exists.'
        } else if (isPhoneInvalid) {
          friendlyMessage = 'Invalid phone format. Please use international format (e.g., +923001234567)'
        }
        
        toast({
          title: "Error",
          description: friendlyMessage,
          variant: "destructive",
        })
        return { 
          success: false, 
          error: friendlyMessage, 
          error_code: isEmailExists ? 'EMAIL_EXISTS' : (isPhoneInvalid ? 'INVALID_PHONE' : data?.error_code)
        }
      }
    } catch (err) {
      console.error('Unexpected error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Unexpected error occurred'
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
      return {
        success: false,
        error: errorMessage,
        error_code: 'UNEXPECTED_ERROR'
      }
    } finally {
      setIsLoading(false)
    }
  }

  return {
    createStudent,
    isLoading
  }
}