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
        Relationships: [
          {
            foreignKeyName: "admin_logs_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment: {
        Row: {
          assignment_description: string | null
          assignment_id: string
          assignment_title: string | null
          created_at: string
          due_date: string | null
          sequence_order: number
          Status: string | null
        }
        Insert: {
          assignment_description?: string | null
          assignment_id?: string
          assignment_title?: string | null
          created_at: string
          due_date?: string | null
          sequence_order: number
          Status?: string | null
        }
        Update: {
          assignment_description?: string | null
          assignment_id?: string
          assignment_title?: string | null
          created_at?: string
          due_date?: string | null
          sequence_order?: number
          Status?: string | null
        }
        Relationships: []
      }
      assignment_submissions: {
        Row: {
          assignment_id: string | null
          external_link: string | null
          feedback: string | null
          file_url: string | null
          id: string
          mentor: string | null
          result: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          score: number | null
          status: string
          submission_type: string
          submitted_at: string | null
          text_response: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          assignment_id?: string | null
          external_link?: string | null
          feedback?: string | null
          file_url?: string | null
          id?: string
          mentor?: string | null
          result?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          score?: number | null
          status?: string
          submission_type: string
          submitted_at?: string | null
          text_response?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          assignment_id?: string | null
          external_link?: string | null
          feedback?: string | null
          file_url?: string | null
          id?: string
          mentor?: string | null
          result?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          score?: number | null
          status?: string
          submission_type?: string
          submitted_at?: string | null
          text_response?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignment"
            referencedColumns: ["assignment_id"]
          },
          {
            foreignKeyName: "assignment_submissions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_assignment_submissions_assignment_id"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignment"
            referencedColumns: ["assignment_id"]
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
            foreignKeyName: "session_recordings_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_recordings_Last Assignment Completed?_fkey"
            columns: ["last_assignment_completed"]
            isOneToOne: false
            referencedRelation: "assignment_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_recordings_module_fkey"
            columns: ["module"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_recordings_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
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
          end_date: string | null
          id: string
          name: number
          start_date: string | null
          tenant_id: string | null
        }
        Insert: {
          created_at?: string | null
          end_date?: string | null
          id?: string
          name: number
          start_date?: string | null
          tenant_id?: string | null
        }
        Update: {
          created_at?: string | null
          end_date?: string | null
          id?: string
          name?: number
          start_date?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batches_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      certificates: {
        Row: {
          certificate_url: string
          downloaded: boolean | null
          id: string
          issued_at: string | null
          tenant_id: string | null
          track: string
          user_id: string
        }
        Insert: {
          certificate_url: string
          downloaded?: boolean | null
          id?: string
          issued_at?: string | null
          tenant_id?: string | null
          track: string
          user_id: string
        }
        Update: {
          certificate_url?: string
          downloaded?: boolean | null
          id?: string
          issued_at?: string | null
          tenant_id?: string | null
          track?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
      feedback: {
        Row: {
          ai_score: number | null
          id: string
          module_id: string | null
          reflection: string | null
          submitted_at: string | null
          user_id: string | null
        }
        Insert: {
          ai_score?: number | null
          id?: string
          module_id?: string | null
          reflection?: string | null
          submitted_at?: string | null
          user_id?: string | null
        }
        Update: {
          ai_score?: number | null
          id?: string
          module_id?: string | null
          reflection?: string | null
          submitted_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard: {
        Row: {
          id: string
          points: number | null
          rank: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          points?: number | null
          rank?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          points?: number | null
          rank?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      mentorship_notes: {
        Row: {
          added_at: string | null
          id: string
          mentor_id: string | null
          note: string | null
          student_id: string | null
        }
        Insert: {
          added_at?: string | null
          id?: string
          mentor_id?: string | null
          note?: string | null
          student_id?: string | null
        }
        Update: {
          added_at?: string | null
          id?: string
          mentor_id?: string | null
          note?: string | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mentorship_notes_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentorship_notes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          context: Json | null
          id: string
          response_id: string | null
          sent_at: string | null
          status: string | null
          template_name: string | null
          user_id: string | null
        }
        Insert: {
          context?: Json | null
          id?: string
          response_id?: string | null
          sent_at?: string | null
          status?: string | null
          template_name?: string | null
          user_id?: string | null
        }
        Update: {
          context?: Json | null
          id?: string
          response_id?: string | null
          sent_at?: string | null
          status?: string | null
          template_name?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
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
        Relationships: [
          {
            foreignKeyName: "modules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          channel: string | null
          error_message: string | null
          id: string
          payload: Json | null
          sent_at: string | null
          status: string | null
          type: string | null
          user_id: string | null
        }
        Insert: {
          channel?: string | null
          error_message?: string | null
          id?: string
          payload?: Json | null
          sent_at?: string | null
          status?: string | null
          type?: string | null
          user_id?: string | null
        }
        Update: {
          channel?: string | null
          error_message?: string | null
          id?: string
          payload?: Json | null
          sent_at?: string | null
          status?: string | null
          type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_responses: {
        Row: {
          answer_data: Json | null
          answer_value: string | null
          created_at: string
          id: string
          question_text: string
          question_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          answer_data?: Json | null
          answer_value?: string | null
          created_at?: string
          id?: string
          question_text: string
          question_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          answer_data?: Json | null
          answer_value?: string | null
          created_at?: string
          id?: string
          question_text?: string
          question_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_responses_user_id_fkey1"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_record: {
        Row: {
          id: number
          times_recovered: number | null
          user_id: string | null
        }
        Insert: {
          id?: number
          times_recovered?: number | null
          user_id?: string | null
        }
        Update: {
          id?: number
          times_recovered?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "Performance Record_user_ID_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "fk_mentor"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pods_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      progress: {
        Row: {
          completed_at: string | null
          id: string
          module_id: string | null
          score: number | null
          started_at: string | null
          status: string | null
          time_spent_min: number | null
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          id?: string
          module_id?: string | null
          score?: number | null
          started_at?: string | null
          status?: string | null
          time_spent_min?: number | null
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          id?: string
          module_id?: string | null
          score?: number | null
          started_at?: string | null
          status?: string | null
          time_spent_min?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "progress_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempts: {
        Row: {
          attempt_number: number | null
          attempted_at: string | null
          id: string
          is_correct: boolean | null
          module_id: string
          question_id: string
          selected_option: string | null
          user_id: string
        }
        Insert: {
          attempt_number?: number | null
          attempted_at?: string | null
          id?: string
          is_correct?: boolean | null
          module_id: string
          question_id: string
          selected_option?: string | null
          user_id: string
        }
        Update: {
          attempt_number?: number | null
          attempted_at?: string | null
          id?: string
          is_correct?: boolean | null
          module_id?: string
          question_id?: string
          selected_option?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
          id: string
          recording_id: string
          user_id: string
          watched: boolean | null
          watched_at: string | null
        }
        Insert: {
          id?: string
          recording_id: string
          user_id: string
          watched?: boolean | null
          watched_at?: string | null
        }
        Update: {
          id?: string
          recording_id?: string
          user_id?: string
          watched?: boolean | null
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
          {
            foreignKeyName: "recording_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      session_attendance: {
        Row: {
          id: string
          joined_at: string | null
          left_at: string | null
          live_session_id: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          joined_at?: string | null
          left_at?: string | null
          live_session_id?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          joined_at?: string | null
          left_at?: string | null
          live_session_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_attendance_live_session_id_fkey"
            columns: ["live_session_id"]
            isOneToOne: false
            referencedRelation: "success_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_attendance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
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
          id: string
          link: string
          mentor_name: string | null
          schedule_date: string | null
          start_time: string
          status: string | null
          title: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_time?: string | null
          id?: string
          link: string
          mentor_name?: string | null
          schedule_date?: string | null
          start_time: string
          status?: string | null
          title: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_time?: string | null
          id?: string
          link?: string
          mentor_name?: string | null
          schedule_date?: string | null
          start_time?: string
          status?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
          id: string
          metadata: Json | null
          occurred_at: string | null
          reference_id: string | null
          user_id: string
        }
        Insert: {
          activity_type: string
          id?: string
          metadata?: Json | null
          occurred_at?: string | null
          reference_id?: string | null
          user_id: string
        }
        Update: {
          activity_type?: string
          id?: string
          metadata?: Json | null
          occurred_at?: string | null
          reference_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          badge_id: string | null
          earned_at: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          badge_id?: string | null
          earned_at?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          badge_id?: string | null
          earned_at?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_module_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          is_completed: boolean
          module_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean
          module_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean
          module_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_segments: {
        Row: {
          confidence_score: number | null
          created_at: string | null
          id: string
          reason: Json | null
          segment: string | null
          set_by: string | null
          user_id: string | null
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          reason?: Json | null
          segment?: string | null
          set_by?: string | null
          user_id?: string | null
        }
        Update: {
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          reason?: Json | null
          segment?: string | null
          set_by?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_segments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_unlocks: {
        Row: {
          is_unlocked: boolean | null
          recording_id: string
          unlocked_at: string | null
          user_id: string
        }
        Insert: {
          is_unlocked?: boolean | null
          recording_id: string
          unlocked_at?: string | null
          user_id: string
        }
        Update: {
          is_unlocked?: boolean | null
          recording_id?: string
          unlocked_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          avatar_url: string | null
          batch_id: string | null
          biggest_blocker: string | null
          course_track_id: string | null
          created_at: string | null
          email: string
          final_goal: string | null
          full_name: string
          id: string
          income_goal_3_months: string | null
          income_reason: string | null
          knows_facebook_ads: string | null
          last_active_at: string | null
          lms_password: string | null
          lms_user_id: string | null
          mentor_id: string | null
          meta_ads_credentials: string | null
          onboarding_data: Json | null
          onboarding_done: boolean | null
          path: string | null
          phone: string | null
          pod_id: string | null
          role: string
          shopify_credentials: string | null
          shopify_experience: string | null
          short_term_goal: string | null
          status: string | null
          status_after_3_months: string | null
          success_meaning: string | null
          tenant_id: string | null
          tried_ecommerce_before: string | null
          weekly_time_commitment: string | null
        }
        Insert: {
          avatar_url?: string | null
          batch_id?: string | null
          biggest_blocker?: string | null
          course_track_id?: string | null
          created_at?: string | null
          email: string
          final_goal?: string | null
          full_name: string
          id?: string
          income_goal_3_months?: string | null
          income_reason?: string | null
          knows_facebook_ads?: string | null
          last_active_at?: string | null
          lms_password?: string | null
          lms_user_id?: string | null
          mentor_id?: string | null
          meta_ads_credentials?: string | null
          onboarding_data?: Json | null
          onboarding_done?: boolean | null
          path?: string | null
          phone?: string | null
          pod_id?: string | null
          role?: string
          shopify_credentials?: string | null
          shopify_experience?: string | null
          short_term_goal?: string | null
          status?: string | null
          status_after_3_months?: string | null
          success_meaning?: string | null
          tenant_id?: string | null
          tried_ecommerce_before?: string | null
          weekly_time_commitment?: string | null
        }
        Update: {
          avatar_url?: string | null
          batch_id?: string | null
          biggest_blocker?: string | null
          course_track_id?: string | null
          created_at?: string | null
          email?: string
          final_goal?: string | null
          full_name?: string
          id?: string
          income_goal_3_months?: string | null
          income_reason?: string | null
          knows_facebook_ads?: string | null
          last_active_at?: string | null
          lms_password?: string | null
          lms_user_id?: string | null
          mentor_id?: string | null
          meta_ads_credentials?: string | null
          onboarding_data?: Json | null
          onboarding_done?: boolean | null
          path?: string | null
          phone?: string | null
          pod_id?: string | null
          role?: string
          shopify_credentials?: string | null
          shopify_experience?: string | null
          short_term_goal?: string | null
          status?: string | null
          status_after_3_months?: string | null
          success_meaning?: string | null
          tenant_id?: string | null
          tried_ecommerce_before?: string | null
          weekly_time_commitment?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_course_track_id_fkey"
            columns: ["course_track_id"]
            isOneToOne: false
            referencedRelation: "course_tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_pod_id_fkey"
            columns: ["pod_id"]
            isOneToOne: false
            referencedRelation: "pods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_unlock_status: {
        Args: { _user_id: string }
        Returns: {
          module_id: string
          recording_id: string
          is_module_unlocked: boolean
          is_recording_unlocked: boolean
        }[]
      }
      is_assignment_passed: {
        Args: { _user_id: string; _assignment_id: string }
        Returns: boolean
      }
      is_module_completed: {
        Args: { _user_id: string; _module_id: string }
        Returns: boolean
      }
      is_recording_watched: {
        Args: { _user_id: string; _recording_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
