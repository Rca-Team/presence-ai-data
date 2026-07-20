export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      attendance_points: {
        Row: {
          awarded_at: string
          created_at: string
          id: string
          metadata: Json
          points: number
          reason: string | null
          student_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          awarded_at?: string
          created_at?: string
          id?: string
          metadata?: Json
          points?: number
          reason?: string | null
          student_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          awarded_at?: string
          created_at?: string
          id?: string
          metadata?: Json
          points?: number
          reason?: string | null
          student_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      attendance_predictions: {
        Row: {
          confidence: number | null
          created_at: string
          factors: Json | null
          id: string
          metadata: Json
          predicted_date: string | null
          predicted_status: string | null
          student_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          factors?: Json | null
          id?: string
          metadata?: Json
          predicted_date?: string | null
          predicted_status?: string | null
          student_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string
          factors?: Json | null
          id?: string
          metadata?: Json
          predicted_date?: string | null
          predicted_status?: string | null
          student_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      attendance_records: {
        Row: {
          capture_mode: string | null
          category: string | null
          class: string | null
          confidence_score: number | null
          created_at: string
          device_info: Json | null
          face_descriptor: Json | null
          id: string
          image_url: string | null
          metadata: Json
          roll_number: string | null
          section: string | null
          source: string | null
          status: string | null
          student_id: string | null
          student_name: string | null
          timestamp: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          capture_mode?: string | null
          category?: string | null
          class?: string | null
          confidence_score?: number | null
          created_at?: string
          device_info?: Json | null
          face_descriptor?: Json | null
          id?: string
          image_url?: string | null
          metadata?: Json
          roll_number?: string | null
          section?: string | null
          source?: string | null
          status?: string | null
          student_id?: string | null
          student_name?: string | null
          timestamp?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          capture_mode?: string | null
          category?: string | null
          class?: string | null
          confidence_score?: number | null
          created_at?: string
          device_info?: Json | null
          face_descriptor?: Json | null
          id?: string
          image_url?: string | null
          metadata?: Json
          roll_number?: string | null
          section?: string | null
          source?: string | null
          status?: string | null
          student_id?: string | null
          student_name?: string | null
          timestamp?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      attendance_session_events: {
        Row: {
          confidence_score: number | null
          created_at: string
          id: string
          idempotency_key: string
          metadata: Json
          recognized_at: string
          recorded_by: string | null
          session_id: string
          source: string
          status: Database["public"]["Enums"]["attendance_event_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          id?: string
          idempotency_key: string
          metadata?: Json
          recognized_at?: string
          recorded_by?: string | null
          session_id: string
          source?: string
          status?: Database["public"]["Enums"]["attendance_event_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          id?: string
          idempotency_key?: string
          metadata?: Json
          recognized_at?: string
          recorded_by?: string | null
          session_id?: string
          source?: string
          status?: Database["public"]["Enums"]["attendance_event_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_session_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      class_leaderboard: {
        Row: {
          class: string | null
          created_at: string
          id: string
          metadata: Json
          rank: number | null
          score: number
          section: string | null
          student_id: string | null
          student_name: string | null
          updated_at: string
        }
        Insert: {
          class?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          rank?: number | null
          score?: number
          section?: string | null
          student_id?: string | null
          student_name?: string | null
          updated_at?: string
        }
        Update: {
          class?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          rank?: number | null
          score?: number
          section?: string | null
          student_id?: string | null
          student_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      class_sessions: {
        Row: {
          class: string
          created_at: string
          ended_at: string | null
          id: string
          is_active: boolean
          metadata: Json
          school_day: string
          section: string
          started_at: string
          started_by: string | null
          subject: string | null
          updated_at: string
        }
        Insert: {
          class: string
          created_at?: string
          ended_at?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          school_day?: string
          section: string
          started_at?: string
          started_by?: string | null
          subject?: string | null
          updated_at?: string
        }
        Update: {
          class?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          school_day?: string
          section?: string
          started_at?: string
          started_by?: string | null
          subject?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      class_teachers: {
        Row: {
          class: string
          created_at: string
          id: string
          metadata: Json
          section: string
          teacher_id: string | null
          teacher_name: string | null
          updated_at: string
        }
        Insert: {
          class: string
          created_at?: string
          id?: string
          metadata?: Json
          section: string
          teacher_id?: string | null
          teacher_name?: string | null
          updated_at?: string
        }
        Update: {
          class?: string
          created_at?: string
          id?: string
          metadata?: Json
          section?: string
          teacher_id?: string | null
          teacher_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      emergency_events: {
        Row: {
          created_at: string
          description: string | null
          event_type: string
          id: string
          metadata: Json
          resolved_at: string | null
          resolved_by: string | null
          severity: string | null
          status: string | null
          title: string | null
          triggered_at: string
          triggered_by: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_type: string
          id?: string
          metadata?: Json
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string | null
          status?: string | null
          title?: string | null
          triggered_at?: string
          triggered_by?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          event_type?: string
          id?: string
          metadata?: Json
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string | null
          status?: string | null
          title?: string | null
          triggered_at?: string
          triggered_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      emotion_events: {
        Row: {
          arousal_score: number | null
          captured_at: string
          confidence_score: number | null
          created_at: string
          emotion_label: string
          id: string
          metadata: Json
          source: string
          student_id: string | null
          updated_at: string
          user_id: string | null
          valence_score: number | null
        }
        Insert: {
          arousal_score?: number | null
          captured_at?: string
          confidence_score?: number | null
          created_at?: string
          emotion_label: string
          id?: string
          metadata?: Json
          source?: string
          student_id?: string | null
          updated_at?: string
          user_id?: string | null
          valence_score?: number | null
        }
        Update: {
          arousal_score?: number | null
          captured_at?: string
          confidence_score?: number | null
          created_at?: string
          emotion_label?: string
          id?: string
          metadata?: Json
          source?: string
          student_id?: string | null
          updated_at?: string
          user_id?: string | null
          valence_score?: number | null
        }
        Relationships: []
      }
      face_descriptors: {
        Row: {
          class: string | null
          created_at: string
          descriptor: Json | null
          id: string
          image_url: string | null
          is_active: boolean
          label: string | null
          metadata: Json
          quality_score: number | null
          section: string | null
          student_id: string | null
          student_name: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          class?: string | null
          created_at?: string
          descriptor?: Json | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          label?: string | null
          metadata?: Json
          quality_score?: number | null
          section?: string | null
          student_id?: string | null
          student_name?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          class?: string | null
          created_at?: string
          descriptor?: Json | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          label?: string | null
          metadata?: Json
          quality_score?: number | null
          section?: string | null
          student_id?: string | null
          student_name?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      gate_entries: {
        Row: {
          class: string | null
          confidence_score: number | null
          created_at: string
          device_info: Json | null
          entry_time: string
          exit_time: string | null
          gate_name: string | null
          gate_session_id: string | null
          id: string
          is_recognized: boolean
          metadata: Json
          section: string | null
          snapshot_url: string | null
          student_id: string | null
          student_name: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          class?: string | null
          confidence_score?: number | null
          created_at?: string
          device_info?: Json | null
          entry_time?: string
          exit_time?: string | null
          gate_name?: string | null
          gate_session_id?: string | null
          id?: string
          is_recognized?: boolean
          metadata?: Json
          section?: string | null
          snapshot_url?: string | null
          student_id?: string | null
          student_name?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          class?: string | null
          confidence_score?: number | null
          created_at?: string
          device_info?: Json | null
          entry_time?: string
          exit_time?: string | null
          gate_name?: string | null
          gate_session_id?: string | null
          id?: string
          is_recognized?: boolean
          metadata?: Json
          section?: string | null
          snapshot_url?: string | null
          student_id?: string | null
          student_name?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      gate_sessions: {
        Row: {
          created_at: string
          device_info: Json | null
          ended_at: string | null
          gate_name: string
          id: string
          metadata: Json
          started_at: string
          started_by: string | null
          total_entries: number
          unknown_entries: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          device_info?: Json | null
          ended_at?: string | null
          gate_name: string
          id?: string
          metadata?: Json
          started_at?: string
          started_by?: string | null
          total_entries?: number
          unknown_entries?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          device_info?: Json | null
          ended_at?: string | null
          gate_name?: string
          id?: string
          metadata?: Json
          started_at?: string
          started_by?: string | null
          total_entries?: number
          unknown_entries?: number
          updated_at?: string
        }
        Relationships: []
      }
      late_entries: {
        Row: {
          approved_by: string | null
          class: string | null
          created_at: string
          entry_time: string
          id: string
          metadata: Json
          reason: string | null
          section: string | null
          student_id: string | null
          student_name: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          approved_by?: string | null
          class?: string | null
          created_at?: string
          entry_time?: string
          id?: string
          metadata?: Json
          reason?: string | null
          section?: string | null
          student_id?: string | null
          student_name?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          approved_by?: string | null
          class?: string | null
          created_at?: string
          entry_time?: string
          id?: string
          metadata?: Json
          reason?: string | null
          section?: string | null
          student_id?: string | null
          student_name?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      notification_log: {
        Row: {
          channel: string | null
          created_at: string
          event_type: string | null
          id: string
          metadata: Json
          payload: Json | null
          sent_at: string | null
          status: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          channel?: string | null
          created_at?: string
          event_type?: string | null
          id?: string
          metadata?: Json
          payload?: Json | null
          sent_at?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          channel?: string | null
          created_at?: string
          event_type?: string | null
          id?: string
          metadata?: Json
          payload?: Json | null
          sent_at?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string | null
          metadata: Json
          read_at: string | null
          title: string | null
          type: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          metadata?: Json
          read_at?: string | null
          title?: string | null
          type?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          metadata?: Json
          read_at?: string | null
          title?: string | null
          type?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      period_timings: {
        Row: {
          class: string | null
          created_at: string
          end_time: string
          id: string
          metadata: Json
          period_name: string
          section: string | null
          start_time: string
          updated_at: string
        }
        Insert: {
          class?: string | null
          created_at?: string
          end_time: string
          id?: string
          metadata?: Json
          period_name: string
          section?: string | null
          start_time: string
          updated_at?: string
        }
        Update: {
          class?: string | null
          created_at?: string
          end_time?: string
          id?: string
          metadata?: Json
          period_name?: string
          section?: string | null
          start_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          class: string | null
          created_at: string
          display_name: string | null
          email: string | null
          full_name: string | null
          id: string
          metadata: Json
          parent_email: string | null
          parent_name: string | null
          phone: string | null
          role: string | null
          section: string | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          class?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          metadata?: Json
          parent_email?: string | null
          parent_name?: string | null
          phone?: string | null
          role?: string | null
          section?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          class?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          metadata?: Json
          parent_email?: string | null
          parent_name?: string | null
          phone?: string | null
          role?: string | null
          section?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          keys_auth: string
          keys_p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          keys_auth: string
          keys_p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          keys_auth?: string
          keys_p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      school_gates: {
        Row: {
          created_at: string
          gate_type: string
          id: string
          is_active: boolean
          metadata: Json
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          gate_type?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          gate_type?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      student_badges: {
        Row: {
          awarded_at: string
          badge_name: string | null
          badge_type: string | null
          created_at: string
          id: string
          metadata: Json
          student_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          awarded_at?: string
          badge_name?: string | null
          badge_type?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          student_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          awarded_at?: string
          badge_name?: string | null
          badge_type?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          student_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      subjects: {
        Row: {
          class: string | null
          code: string | null
          created_at: string
          id: string
          metadata: Json
          name: string
          section: string | null
          teacher_id: string | null
          updated_at: string
        }
        Insert: {
          class?: string | null
          code?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          name: string
          section?: string | null
          teacher_id?: string | null
          updated_at?: string
        }
        Update: {
          class?: string | null
          code?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          name?: string
          section?: string | null
          teacher_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      substitutions: {
        Row: {
          class: string | null
          created_at: string
          date: string
          id: string
          metadata: Json
          notes: string | null
          original_teacher_id: string | null
          section: string | null
          status: string | null
          subject: string | null
          substitute_teacher_id: string | null
          updated_at: string
        }
        Insert: {
          class?: string | null
          created_at?: string
          date?: string
          id?: string
          metadata?: Json
          notes?: string | null
          original_teacher_id?: string | null
          section?: string | null
          status?: string | null
          subject?: string | null
          substitute_teacher_id?: string | null
          updated_at?: string
        }
        Update: {
          class?: string | null
          created_at?: string
          date?: string
          id?: string
          metadata?: Json
          notes?: string | null
          original_teacher_id?: string | null
          section?: string | null
          status?: string | null
          subject?: string | null
          substitute_teacher_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      teacher_permissions: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean
          metadata: Json
          permission_key: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          metadata?: Json
          permission_key: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          metadata?: Json
          permission_key?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wellness_scores: {
        Row: {
          created_at: string
          id: string
          measured_at: string
          metadata: Json
          mood: string | null
          score: number | null
          student_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          measured_at?: string
          metadata?: Json
          mood?: string | null
          score?: number | null
          student_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          measured_at?: string
          metadata?: Json
          mood?: string | null
          score?: number | null
          student_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      zone_entries: {
        Row: {
          action: string | null
          created_at: string
          id: string
          metadata: Json
          occurred_at: string
          student_id: string | null
          student_name: string | null
          updated_at: string
          user_id: string | null
          zone_name: string | null
        }
        Insert: {
          action?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          occurred_at?: string
          student_id?: string | null
          student_name?: string | null
          updated_at?: string
          user_id?: string | null
          zone_name?: string | null
        }
        Update: {
          action?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          occurred_at?: string
          student_id?: string | null
          student_name?: string | null
          updated_at?: string
          user_id?: string | null
          zone_name?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_all_auth_users: {
        Args: never
        Returns: {
          created_at: string
          email: string
          last_sign_in_at: string
          user_id: string
        }[]
      }
      list_public_tables: {
        Args: never
        Returns: {
          table_name: string
        }[]
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      upsert_class_attendance_event: {
        Args: {
          p_confidence_score?: number
          p_idempotency_key?: string
          p_metadata?: Json
          p_session_id: string
          p_source?: string
          p_status: Database["public"]["Enums"]["attendance_event_status"]
          p_student_id: string
        }
        Returns: {
          confidence_score: number | null
          created_at: string
          id: string
          idempotency_key: string
          metadata: Json
          recognized_at: string
          recorded_by: string | null
          session_id: string
          source: string
          status: Database["public"]["Enums"]["attendance_event_status"]
          student_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "attendance_session_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "admin" | "principal" | "teacher" | "user" | "parent"
      attendance_event_status:
        | "detected"
        | "verified"
        | "corrected"
        | "present"
        | "late"
        | "absent"
        | "excused"
        | "unauthorized"
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
      app_role: ["admin", "principal", "teacher", "user", "parent"],
      attendance_event_status: [
        "detected",
        "verified",
        "corrected",
        "present",
        "late",
        "absent",
        "excused",
        "unauthorized",
      ],
    },
  },
} as const
