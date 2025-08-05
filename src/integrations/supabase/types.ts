export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      admin_logs: {
        Row: {
          action: string
          created_at: string | null
          data: Json | null
          description: string | null
          entity_id: string | null
          entity_type: string
          id: string
          performed_by: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          data?: Json | null
          description?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          performed_by?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          data?: Json | null
          description?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          performed_by?: string | null
        }
        Relationships: []
      }
      assignments: {
        Row: {
          created_at: string | null
          description: string | null
          due_days: number | null
          id: string
          instructions: string | null
          mentor_id: string | null
          name: string
          recording_id: string | null
          submission_type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          due_days?: number | null
          id?: string
          instructions?: string | null
          mentor_id?: string | null
          name: string
          recording_id?: string | null
          submission_type?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          due_days?: number | null
          id?: string
          instructions?: string | null
          mentor_id?: string | null
          name?: string
          recording_id?: string | null
          submission_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignments_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "available_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      available_lessons: {
        Row: {
          assignment_id: string | null
          batch_id: string | null
          duration_min: number | null
          id: string
          last_assignment_completed: string | null
          module: string | null
          notes: string | null
          recording_title: string | null
          recording_url: string | null
          sequence_order: number | null
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          assignment_id?: string | null
          batch_id?: string | null
          duration_min?: number | null
          id?: string
          last_assignment_completed?: string | null
          module?: string | null
          notes?: string | null
          recording_title?: string | null
          recording_url?: string | null
          sequence_order?: number | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          assignment_id?: string | null
          batch_id?: string | null
          duration_min?: number | null
          id?: string
          last_assignment_completed?: string | null
          module?: string | null
          notes?: string | null
          recording_title?: string | null
          recording_url?: string | null
          sequence_order?: number | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_recordings_module_fkey"
            columns: ["module"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      badges: {
        Row: {
          description: string | null
          id: string
          image_url: string | null
          name: string
        }
        Insert: {
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
        }
        Update: {
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
        }
        Relationships: []
      }
      batches: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          address: string
          branding: Json | null
          company_email: string | null
          company_logo: string | null
          company_name: string
          contact_email: string
          created_at: string | null
          currency: string
          enable_student_signin: boolean | null
          id: number
          installment_plans: string[] | null
          invoice_notes: string | null
          invoice_overdue_days: number
          invoice_send_gap_days: number
          maximum_installment_count: number
          original_fee_amount: number
          payment_methods: Json | null
          primary_phone: string
          questionnaire: Json | null
          secondary_phone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string
          branding?: Json | null
          company_email?: string | null
          company_logo?: string | null
          company_name?: string
          contact_email?: string
          created_at?: string | null
          currency?: string
          enable_student_signin?: boolean | null
          id?: number
          installment_plans?: string[] | null
          invoice_notes?: string | null
          invoice_overdue_days?: number
          invoice_send_gap_days?: number
          maximum_installment_count?: number
          original_fee_amount?: number
          payment_methods?: Json | null
          primary_phone?: string
          questionnaire?: Json | null
          secondary_phone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string
          branding?: Json | null
          company_email?: string | null
          company_logo?: string | null
          company_name?: string
          contact_email?: string
          created_at?: string | null
          currency?: string
          enable_student_signin?: boolean | null
          id?: number
          installment_plans?: string[] | null
          invoice_notes?: string | null
          invoice_overdue_days?: number
          invoice_send_gap_days?: number
          maximum_installment_count?: number
          original_fee_amount?: number
          payment_methods?: Json | null
          primary_phone?: string
          questionnaire?: Json | null
          secondary_phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      course_tracks: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      email_queue: {
        Row: {
          created_at: string | null
          credentials: Json
          email_type: string
          error_message: string | null
          id: string
          recipient_email: string
          recipient_name: string
          retry_count: number | null
          sent_at: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          credentials: Json
          email_type: string
          error_message?: string | null
          id?: string
          recipient_email: string
          recipient_name: string
          retry_count?: number | null
          sent_at?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          credentials?: Json
          email_type?: string
          error_message?: string | null
          id?: string
          recipient_email?: string
          recipient_name?: string
          retry_count?: number | null
          sent_at?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_queue_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      installment_plans: {
        Row: {
          created_at: string | null
          id: string
          interval_days: number
          is_active: boolean | null
          name: string
          num_installments: number
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          interval_days: number
          is_active?: boolean | null
          name: string
          num_installments: number
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          interval_days?: number
          is_active?: boolean | null
          name?: string
          num_installments?: number
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount: number
          created_at: string | null
          due_date: string
          first_reminder_sent: boolean | null
          first_reminder_sent_at: string | null
          id: string
          installment_number: number
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          second_reminder_sent: boolean | null
          second_reminder_sent_at: string | null
          status: string | null
          student_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          due_date: string
          first_reminder_sent?: boolean | null
          first_reminder_sent_at?: string | null
          id?: string
          installment_number: number
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          second_reminder_sent?: boolean | null
          second_reminder_sent_at?: string | null
          status?: string | null
          student_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          due_date?: string
          first_reminder_sent?: boolean | null
          first_reminder_sent_at?: string | null
          id?: string
          installment_number?: number
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          second_reminder_sent?: boolean | null
          second_reminder_sent_at?: string | null
          status?: string | null
          student_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          description: string | null
          id: string
          order: number | null
          quiz_questions: Json | null
          tenant_id: string | null
          title: string
        }
        Insert: {
          description?: string | null
          id?: string
          order?: number | null
          quiz_questions?: Json | null
          tenant_id?: string | null
          title: string
        }
        Update: {
          description?: string | null
          id?: string
          order?: number | null
          quiz_questions?: Json | null
          tenant_id?: string | null
          title?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          channel: string
          created_at: string
          id: string
          payload: Json
          sent_at: string
          status: string
          type: string
          user_id: string
        }
        Insert: {
          channel?: string
          created_at?: string
          id?: string
          payload?: Json
          sent_at?: string
          status?: string
          type: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          payload?: Json
          sent_at?: string
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      pods: {
        Row: {
          created_at: string | null
          id: string
          mentor_id: string | null
          name: string
          notes: string | null
          tenant_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          mentor_id?: string | null
          name: string
          notes?: string | null
          tenant_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          mentor_id?: string | null
          name?: string
          notes?: string | null
          tenant_id?: string | null
        }
        Relationships: []
      }
      quiz_questions: {
        Row: {
          correct_option: string | null
          explanation: string | null
          id: string
          module_id: string
          options: Json
          question_text: string
        }
        Insert: {
          correct_option?: string | null
          explanation?: string | null
          id?: string
          module_id: string
          options: Json
          question_text: string
        }
        Update: {
          correct_option?: string | null
          explanation?: string | null
          id?: string
          module_id?: string
          options?: Json
          question_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      recording_views: {
        Row: {
          created_at: string
          id: string
          recording_id: string
          updated_at: string
          user_id: string
          watched: boolean
          watched_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          recording_id: string
          updated_at?: string
          user_id: string
          watched?: boolean
          watched_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          recording_id?: string
          updated_at?: string
          user_id?: string
          watched?: boolean
          watched_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recording_views_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "available_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          created_at: string | null
          enrollment_date: string | null
          id: string
          installment_count: number | null
          installment_plan_id: string | null
          lms_username: string
          onboarding_completed: boolean | null
          student_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          enrollment_date?: string | null
          id?: string
          installment_count?: number | null
          installment_plan_id?: string | null
          lms_username: string
          onboarding_completed?: boolean | null
          student_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          enrollment_date?: string | null
          id?: string
          installment_count?: number | null
          installment_plan_id?: string | null
          lms_username?: string
          onboarding_completed?: boolean | null
          student_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_installment_plan_id_fkey"
            columns: ["installment_plan_id"]
            isOneToOne: false
            referencedRelation: "installment_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          assignment_id: string
          content: string | null
          created_at: string
          file_url: string | null
          id: string
          notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          student_id: string
          submitted_at: string
          updated_at: string
        }
        Insert: {
          assignment_id: string
          content?: string | null
          created_at?: string
          file_url?: string | null
          id?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          student_id: string
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          content?: string | null
          created_at?: string
          file_url?: string | null
          id?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          student_id?: string
          submitted_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      success_sessions: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          end_time: string | null
          host_login_email: string | null
          host_login_pwd: string | null
          id: string
          link: string
          mentor_id: string | null
          mentor_name: string | null
          schedule_date: string | null
          start_time: string
          status: string | null
          title: string
          zoom_meeting_id: string | null
          zoom_passcode: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_time?: string | null
          host_login_email?: string | null
          host_login_pwd?: string | null
          id?: string
          link: string
          mentor_id?: string | null
          mentor_name?: string | null
          schedule_date?: string | null
          start_time: string
          status?: string | null
          title: string
          zoom_meeting_id?: string | null
          zoom_passcode?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_time?: string | null
          host_login_email?: string | null
          host_login_pwd?: string | null
          id?: string
          link?: string
          mentor_id?: string | null
          mentor_name?: string | null
          schedule_date?: string | null
          start_time?: string
          status?: string | null
          title?: string
          zoom_meeting_id?: string | null
          zoom_passcode?: string | null
        }
        Relationships: []
      }
      support_ticket_replies: {
        Row: {
          created_at: string
          id: string
          is_internal: boolean
          message: string
          ticket_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_internal?: boolean
          message: string
          ticket_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_internal?: boolean
          message?: string
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_replies_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          category: string | null
          created_at: string
          description: string
          id: string
          priority: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string | null
          created_at?: string
          description: string
          id?: string
          priority?: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          category?: string | null
          created_at?: string
          description?: string
          id?: string
          priority?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tenants: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      user_activity_logs: {
        Row: {
          activity_type: string
          created_at: string
          id: string
          metadata: Json | null
          occurred_at: string
          reference_id: string | null
          user_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          id?: string
          metadata?: Json | null
          occurred_at?: string
          reference_id?: string | null
          user_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          occurred_at?: string
          reference_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          badge_id: string
          created_at: string
          earned_at: string
          id: string
          user_id: string
        }
        Insert: {
          badge_id: string
          created_at?: string
          earned_at?: string
          id?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          created_at?: string
          earned_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_unlocks: {
        Row: {
          created_at: string
          id: string
          is_unlocked: boolean
          recording_id: string
          unlocked_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_unlocked?: boolean
          recording_id: string
          unlocked_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_unlocked?: boolean
          recording_id?: string
          unlocked_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_unlocks_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "available_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          created_by: string | null
          dream_goal_summary: string | null
          email: string
          full_name: string
          id: string
          is_temp_password: boolean | null
          last_active_at: string | null
          last_login_at: string | null
          lms_status: string | null
          lms_user_id: string | null
          meta_ads_credentials: string | null
          password_display: string
          password_hash: string
          phone: string | null
          role: string
          shopify_credentials: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          dream_goal_summary?: string | null
          email: string
          full_name: string
          id?: string
          is_temp_password?: boolean | null
          last_active_at?: string | null
          last_login_at?: string | null
          lms_status?: string | null
          lms_user_id?: string | null
          meta_ads_credentials?: string | null
          password_display: string
          password_hash: string
          phone?: string | null
          role: string
          shopify_credentials?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          dream_goal_summary?: string | null
          email?: string
          full_name?: string
          id?: string
          is_temp_password?: boolean | null
          last_active_at?: string | null
          last_login_at?: string | null
          lms_status?: string | null
          lms_user_id?: string | null
          meta_ads_credentials?: string | null
          password_display?: string
          password_hash?: string
          phone?: string | null
          role?: string
          shopify_credentials?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      segmented_weekly_success_sessions: {
        Row: {
          created_at: string | null
          description: string | null
          end_time: string | null
          id: string | null
          mentor_id: string | null
          mentor_name: string | null
          segment: string | null
          start_time: string | null
          status: string | null
          title: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          end_time?: string | null
          id?: string | null
          mentor_id?: string | null
          mentor_name?: string | null
          segment?: never
          start_time?: string | null
          status?: string | null
          title?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          end_time?: string | null
          id?: string | null
          mentor_id?: string | null
          mentor_name?: string | null
          segment?: never
          start_time?: string | null
          status?: string | null
          title?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      create_notification: {
        Args: {
          p_user_id: string
          p_type: string
          p_title: string
          p_message: string
          p_metadata?: Json
        }
        Returns: string
      }
      create_user_with_role: {
        Args: {
          target_email: string
          target_password: string
          target_role: string
          target_full_name?: string
          target_metadata?: Json
        }
        Returns: Json
      }
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_student_unlock_sequence: {
        Args: { p_user_id: string }
        Returns: {
          recording_id: string
          sequence_order: number
          is_unlocked: boolean
          unlock_reason: string
        }[]
      }
      get_user_lms_status: {
        Args: { user_id: string }
        Returns: string
      }
      get_user_unlock_status: {
        Args: { _user_id: string }
        Returns: {
          module_id: string
          recording_id: string
          is_module_unlocked: boolean
          is_recording_unlocked: boolean
        }[]
      }
      is_module_completed: {
        Args: { _user_id: string; _module_id: string }
        Returns: boolean
      }
      is_recording_watched: {
        Args: { _user_id: string; _recording_id: string }
        Returns: boolean
      }
      notify_all_students: {
        Args: {
          p_type: string
          p_title: string
          p_message: string
          p_metadata?: Json
        }
        Returns: number
      }
      notify_mentor_students: {
        Args: {
          p_mentor_id: string
          p_type: string
          p_title: string
          p_message: string
          p_metadata?: Json
        }
        Returns: number
      }
      unlock_next_recording: {
        Args: { p_student_id: string; p_current_recording_id: string }
        Returns: undefined
      }
      update_company_branding: {
        Args: { branding_data: Json }
        Returns: Json
      }
      validate_questionnaire_structure: {
        Args: { questionnaire_data: Json }
        Returns: boolean
      }
    }
    Enums: {
      assignment_submission_status:
        | "submitted"
        | "under_review"
        | "accepted"
        | "rejected"
        | "resubmit"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      assignment_submission_status: [
        "submitted",
        "under_review",
        "accepted",
        "rejected",
        "resubmit",
      ],
    },
  },
} as const
