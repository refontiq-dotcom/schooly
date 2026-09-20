export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      academic_decisions: {
        Row: {
          academic_year_id: string
          average: number | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision: string
          deleted_at: string | null
          enrollment_id: string
          id: string
          input_fingerprint: string | null
          observations: string | null
          school_id: string
          snapshot: Json | null
          updated_at: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          academic_year_id: string
          average?: number | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision: string
          deleted_at?: string | null
          enrollment_id: string
          id?: string
          input_fingerprint?: string | null
          observations?: string | null
          school_id: string
          snapshot?: Json | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          academic_year_id?: string
          average?: number | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision?: string
          deleted_at?: string | null
          enrollment_id?: string
          id?: string
          input_fingerprint?: string | null
          observations?: string | null
          school_id?: string
          snapshot?: Json | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academic_decisions_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_decisions_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_decisions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_decisions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_balances"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "academic_decisions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_decisions_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      academic_years: {
        Row: {
          created_at: string
          deleted_at: string | null
          end_date: string
          id: string
          label: string
          school_id: string
          start_date: string
          status: Database["public"]["Enums"]["academic_year_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          end_date: string
          id?: string
          label: string
          school_id: string
          start_date: string
          status?: Database["public"]["Enums"]["academic_year_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          end_date?: string
          id?: string
          label?: string
          school_id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["academic_year_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_years_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_exports: {
        Row: {
          academic_year_id: string
          created_at: string
          deleted_at: string | null
          export_type: string
          file_url: string | null
          generated_at: string
          generated_by: string | null
          id: string
          period_end: string
          period_start: string
          school_id: string
          updated_at: string
        }
        Insert: {
          academic_year_id: string
          created_at?: string
          deleted_at?: string | null
          export_type: string
          file_url?: string | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          period_end: string
          period_start: string
          school_id: string
          updated_at?: string
        }
        Update: {
          academic_year_id?: string
          created_at?: string
          deleted_at?: string | null
          export_type?: string
          file_url?: string | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          period_end?: string
          period_start?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_exports_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_exports_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_exports_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      admission_assignment_batches: {
        Row: {
          academic_year_id: string
          algorithm: string
          created_at: string
          created_by: string | null
          grade_level_id: string
          id: string
          school_id: string
          source_batch_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          academic_year_id: string
          algorithm?: string
          created_at?: string
          created_by?: string | null
          grade_level_id: string
          id?: string
          school_id: string
          source_batch_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          academic_year_id?: string
          algorithm?: string
          created_at?: string
          created_by?: string | null
          grade_level_id?: string
          id?: string
          school_id?: string
          source_batch_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admission_assignment_batches_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admission_assignment_batches_grade_level_id_fkey"
            columns: ["grade_level_id"]
            isOneToOne: false
            referencedRelation: "grade_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admission_assignment_batches_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admission_assignment_batches_source_batch_id_fkey"
            columns: ["source_batch_id"]
            isOneToOne: false
            referencedRelation: "admission_import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      admission_assignment_rows: {
        Row: {
          assignment_batch_id: string
          class_id: string | null
          constraint_reason: string | null
          created_at: string
          hard_valid: boolean
          id: string
          import_row_id: string
          position: number
          score: number
          soft_score: number
        }
        Insert: {
          assignment_batch_id: string
          class_id?: string | null
          constraint_reason?: string | null
          created_at?: string
          hard_valid?: boolean
          id?: string
          import_row_id: string
          position: number
          score?: number
          soft_score?: number
        }
        Update: {
          assignment_batch_id?: string
          class_id?: string | null
          constraint_reason?: string | null
          created_at?: string
          hard_valid?: boolean
          id?: string
          import_row_id?: string
          position?: number
          score?: number
          soft_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "admission_assignment_rows_assignment_batch_id_fkey"
            columns: ["assignment_batch_id"]
            isOneToOne: false
            referencedRelation: "admission_assignment_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admission_assignment_rows_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admission_assignment_rows_import_row_id_fkey"
            columns: ["import_row_id"]
            isOneToOne: false
            referencedRelation: "admission_import_rows"
            referencedColumns: ["id"]
          },
        ]
      }
      admission_import_batches: {
        Row: {
          academic_year_id: string
          created_at: string
          created_by: string | null
          error_rows: number
          filename: string
          id: string
          school_id: string
          source: string
          status: string
          total_rows: number
          updated_at: string
          valid_rows: number
        }
        Insert: {
          academic_year_id: string
          created_at?: string
          created_by?: string | null
          error_rows?: number
          filename: string
          id?: string
          school_id: string
          source?: string
          status?: string
          total_rows?: number
          updated_at?: string
          valid_rows?: number
        }
        Update: {
          academic_year_id?: string
          created_at?: string
          created_by?: string | null
          error_rows?: number
          filename?: string
          id?: string
          school_id?: string
          source?: string
          status?: string
          total_rows?: number
          updated_at?: string
          valid_rows?: number
        }
        Relationships: [
          {
            foreignKeyName: "admission_import_batches_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admission_import_batches_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      admission_import_rows: {
        Row: {
          academic_score: number | null
          batch_id: string
          created_at: string
          date_of_birth: string | null
          error_message: string | null
          external_id: string | null
          first_name: string
          gender: string | null
          grade_level_id: string | null
          grade_name: string | null
          id: string
          last_name: string
          matricule: string | null
          orientation_number: string | null
          raw_data: Json
          required_options: Json
          row_number: number
          status: string
        }
        Insert: {
          academic_score?: number | null
          batch_id: string
          created_at?: string
          date_of_birth?: string | null
          error_message?: string | null
          external_id?: string | null
          first_name: string
          gender?: string | null
          grade_level_id?: string | null
          grade_name?: string | null
          id?: string
          last_name: string
          matricule?: string | null
          orientation_number?: string | null
          raw_data?: Json
          required_options?: Json
          row_number: number
          status?: string
        }
        Update: {
          academic_score?: number | null
          batch_id?: string
          created_at?: string
          date_of_birth?: string | null
          error_message?: string | null
          external_id?: string | null
          first_name?: string
          gender?: string | null
          grade_level_id?: string | null
          grade_name?: string | null
          id?: string
          last_name?: string
          matricule?: string | null
          orientation_number?: string | null
          raw_data?: Json
          required_options?: Json
          row_number?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "admission_import_rows_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "admission_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admission_import_rows_grade_level_id_fkey"
            columns: ["grade_level_id"]
            isOneToOne: false
            referencedRelation: "grade_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          course_session_id: string
          created_at: string
          deleted_at: string | null
          enrollment_id: string
          id: string
          recorded_at: string
          recorded_by: string
          remark: string | null
          school_id: string
          status: string
          updated_at: string
        }
        Insert: {
          course_session_id: string
          created_at?: string
          deleted_at?: string | null
          enrollment_id: string
          id?: string
          recorded_at?: string
          recorded_by: string
          remark?: string | null
          school_id: string
          status: string
          updated_at?: string
        }
        Update: {
          course_session_id?: string
          created_at?: string
          deleted_at?: string | null
          enrollment_id?: string
          id?: string
          recorded_at?: string
          recorded_by?: string
          remark?: string | null
          school_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_course_session_id_fkey"
            columns: ["course_session_id"]
            isOneToOne: false
            referencedRelation: "course_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_balances"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_records_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_configs: {
        Row: {
          created_at: string
          currency: string
          event_amount: number | null
          event_types: Json | null
          id: string
          is_active: boolean
          mode: string
          name: string
          product_id: string
          telegram_admin_url: string | null
          telegram_bot_token: string | null
          telegram_chat_id: string | null
          tiers: Json | null
          updated_at: string
          wave_merchant_id: string | null
          wave_webhook_secret: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          event_amount?: number | null
          event_types?: Json | null
          id?: string
          is_active?: boolean
          mode: string
          name: string
          product_id: string
          telegram_admin_url?: string | null
          telegram_bot_token?: string | null
          telegram_chat_id?: string | null
          tiers?: Json | null
          updated_at?: string
          wave_merchant_id?: string | null
          wave_webhook_secret?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          event_amount?: number | null
          event_types?: Json | null
          id?: string
          is_active?: boolean
          mode?: string
          name?: string
          product_id?: string
          telegram_admin_url?: string | null
          telegram_bot_token?: string | null
          telegram_chat_id?: string | null
          tiers?: Json | null
          updated_at?: string
          wave_merchant_id?: string | null
          wave_webhook_secret?: string | null
        }
        Relationships: []
      }
      boarding_subscriptions: {
        Row: {
          academic_year_id: string
          amount_cfa: number
          created_at: string
          end_date: string | null
          enrollment_id: string
          id: string
          room_id: string | null
          school_id: string
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          academic_year_id: string
          amount_cfa?: number
          created_at?: string
          end_date?: string | null
          enrollment_id: string
          id?: string
          room_id?: string | null
          school_id: string
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          academic_year_id?: string
          amount_cfa?: number
          created_at?: string
          end_date?: string | null
          enrollment_id?: string
          id?: string
          room_id?: string | null
          school_id?: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "boarding_subscriptions_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boarding_subscriptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boarding_subscriptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_balances"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "boarding_subscriptions_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "dorm_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boarding_subscriptions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      bus_routes: {
        Row: {
          capacity: number | null
          created_at: string
          driver_name: string | null
          driver_phone: string | null
          id: string
          is_active: boolean
          monthly_fee_cfa: number
          name: string
          school_id: string
          updated_at: string
          vehicle_plate: string | null
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          driver_name?: string | null
          driver_phone?: string | null
          id?: string
          is_active?: boolean
          monthly_fee_cfa?: number
          name: string
          school_id: string
          updated_at?: string
          vehicle_plate?: string | null
        }
        Update: {
          capacity?: number | null
          created_at?: string
          driver_name?: string | null
          driver_phone?: string | null
          id?: string
          is_active?: boolean
          monthly_fee_cfa?: number
          name?: string
          school_id?: string
          updated_at?: string
          vehicle_plate?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bus_routes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      bus_stops: {
        Row: {
          created_at: string
          dropoff_time: string | null
          id: string
          name: string
          pickup_time: string | null
          route_id: string
          school_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dropoff_time?: string | null
          id?: string
          name: string
          pickup_time?: string | null
          route_id: string
          school_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dropoff_time?: string | null
          id?: string
          name?: string
          pickup_time?: string | null
          route_id?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bus_stops_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "bus_routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bus_stops_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      canteen_attendance: {
        Row: {
          created_at: string
          date: string
          id: string
          meal_type: string
          scanned_at: string
          scanned_by: string | null
          school_id: string
          status: string
          subscription_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          meal_type?: string
          scanned_at?: string
          scanned_by?: string | null
          school_id: string
          status?: string
          subscription_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          meal_type?: string
          scanned_at?: string
          scanned_by?: string | null
          school_id?: string
          status?: string
          subscription_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "canteen_attendance_scanned_by_fkey"
            columns: ["scanned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canteen_attendance_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canteen_attendance_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "canteen_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      canteen_menus: {
        Row: {
          created_at: string
          date: string
          description: string
          id: string
          meal_type: string
          school_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          description: string
          id?: string
          meal_type?: string
          school_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          description?: string
          id?: string
          meal_type?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "canteen_menus_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      canteen_subscriptions: {
        Row: {
          academic_year_id: string
          amount_cfa: number
          created_at: string
          end_date: string | null
          enrollment_id: string
          id: string
          plan_type: string
          school_id: string
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          academic_year_id: string
          amount_cfa?: number
          created_at?: string
          end_date?: string | null
          enrollment_id: string
          id?: string
          plan_type: string
          school_id: string
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          academic_year_id?: string
          amount_cfa?: number
          created_at?: string
          end_date?: string | null
          enrollment_id?: string
          id?: string
          plan_type?: string
          school_id?: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "canteen_subscriptions_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canteen_subscriptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canteen_subscriptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_balances"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "canteen_subscriptions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_sessions: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          closing_amount: number | null
          created_at: string
          deleted_at: string | null
          difference: number | null
          expected_amount: number | null
          id: string
          notes: string | null
          opened_at: string
          opened_by: string
          opening_amount: number
          school_id: string
          status: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          closing_amount?: number | null
          created_at?: string
          deleted_at?: string | null
          difference?: number | null
          expected_amount?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by: string
          opening_amount?: number
          school_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          closing_amount?: number | null
          created_at?: string
          deleted_at?: string | null
          difference?: number | null
          expected_amount?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string
          opening_amount?: number
          school_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_sessions_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sessions_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      class_subject_assignments: {
        Row: {
          class_id: string
          coefficient: number
          created_at: string
          deleted_at: string | null
          id: string
          school_id: string
          subject_id: string
          teacher_id: string | null
          updated_at: string
        }
        Insert: {
          class_id: string
          coefficient?: number
          created_at?: string
          deleted_at?: string | null
          id?: string
          school_id: string
          subject_id: string
          teacher_id?: string | null
          updated_at?: string
        }
        Update: {
          class_id?: string
          coefficient?: number
          created_at?: string
          deleted_at?: string | null
          id?: string
          school_id?: string
          subject_id?: string
          teacher_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_subject_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_subject_assignments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_subject_assignments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_subject_assignments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          capacity: number | null
          created_at: string
          deleted_at: string | null
          grade_level_id: string
          head_teacher_id: string | null
          id: string
          name: string
          required_options: Json
          school_id: string
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          deleted_at?: string | null
          grade_level_id: string
          head_teacher_id?: string | null
          id?: string
          name: string
          required_options?: Json
          school_id: string
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          deleted_at?: string | null
          grade_level_id?: string
          head_teacher_id?: string | null
          id?: string
          name?: string
          required_options?: Json
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_grade_level_id_fkey"
            columns: ["grade_level_id"]
            isOneToOne: false
            referencedRelation: "grade_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_head_teacher_id_fkey"
            columns: ["head_teacher_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      course_sessions: {
        Row: {
          academic_year_id: string
          class_id: string
          created_at: string
          deleted_at: string | null
          ends_at: string
          id: string
          notes: string | null
          room: string | null
          school_id: string
          starts_at: string
          subject_id: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          academic_year_id: string
          class_id: string
          created_at?: string
          deleted_at?: string | null
          ends_at: string
          id?: string
          notes?: string | null
          room?: string | null
          school_id: string
          starts_at: string
          subject_id: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          academic_year_id?: string
          class_id?: string
          created_at?: string
          deleted_at?: string | null
          ends_at?: string
          id?: string
          notes?: string | null
          room?: string | null
          school_id?: string
          starts_at?: string
          subject_id?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_sessions_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_sessions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_sessions_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      detentions: {
        Row: {
          assigned_by: string | null
          created_at: string
          deleted_at: string | null
          duration_minutes: number
          enrollment_id: string
          id: string
          notes: string | null
          reason: string
          scheduled_date: string
          scheduled_time: string
          school_id: string
          served: boolean
          served_at: string | null
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          deleted_at?: string | null
          duration_minutes?: number
          enrollment_id: string
          id?: string
          notes?: string | null
          reason: string
          scheduled_date: string
          scheduled_time: string
          school_id: string
          served?: boolean
          served_at?: string | null
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          deleted_at?: string | null
          duration_minutes?: number
          enrollment_id?: string
          id?: string
          notes?: string | null
          reason?: string
          scheduled_date?: string
          scheduled_time?: string
          school_id?: string
          served?: boolean
          served_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "detentions_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "detentions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "detentions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_balances"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "detentions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      door_entries: {
        Row: {
          created_at: string
          deleted_at: string | null
          enrollment_id: string
          event_type: string
          id: string
          location: string | null
          notes: string | null
          qr_code_id: string
          scanned_at: string
          scanned_by: string | null
          school_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          enrollment_id: string
          event_type: string
          id?: string
          location?: string | null
          notes?: string | null
          qr_code_id: string
          scanned_at?: string
          scanned_by?: string | null
          school_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          enrollment_id?: string
          event_type?: string
          id?: string
          location?: string | null
          notes?: string | null
          qr_code_id?: string
          scanned_at?: string
          scanned_by?: string | null
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "door_entries_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "door_entries_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_balances"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "door_entries_qr_code_id_fkey"
            columns: ["qr_code_id"]
            isOneToOne: false
            referencedRelation: "student_qr_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "door_entries_scanned_by_fkey"
            columns: ["scanned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "door_entries_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      dorm_rooms: {
        Row: {
          capacity: number
          created_at: string
          dormitory_id: string
          id: string
          room_number: string
          school_id: string
          updated_at: string
        }
        Insert: {
          capacity: number
          created_at?: string
          dormitory_id: string
          id?: string
          room_number: string
          school_id: string
          updated_at?: string
        }
        Update: {
          capacity?: number
          created_at?: string
          dormitory_id?: string
          id?: string
          room_number?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dorm_rooms_dormitory_id_fkey"
            columns: ["dormitory_id"]
            isOneToOne: false
            referencedRelation: "dormitories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dorm_rooms_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      dormitories: {
        Row: {
          capacity: number
          created_at: string
          gender_restriction: string
          id: string
          is_active: boolean
          name: string
          school_id: string
          supervisor_name: string | null
          updated_at: string
        }
        Insert: {
          capacity: number
          created_at?: string
          gender_restriction: string
          id?: string
          is_active?: boolean
          name: string
          school_id: string
          supervisor_name?: string | null
          updated_at?: string
        }
        Update: {
          capacity?: number
          created_at?: string
          gender_restriction?: string
          id?: string
          is_active?: boolean
          name?: string
          school_id?: string
          supervisor_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dormitories_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      dropout_alerts: {
        Row: {
          alert_type: string
          course_session_id: string | null
          created_at: string
          deleted_at: string | null
          detected_at: string
          door_entry_id: string | null
          enrollment_id: string
          id: string
          investigated_at: string | null
          investigated_by: string | null
          resolution_notes: string | null
          school_id: string
          status: string
          updated_at: string
        }
        Insert: {
          alert_type: string
          course_session_id?: string | null
          created_at?: string
          deleted_at?: string | null
          detected_at?: string
          door_entry_id?: string | null
          enrollment_id: string
          id?: string
          investigated_at?: string | null
          investigated_by?: string | null
          resolution_notes?: string | null
          school_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          alert_type?: string
          course_session_id?: string | null
          created_at?: string
          deleted_at?: string | null
          detected_at?: string
          door_entry_id?: string | null
          enrollment_id?: string
          id?: string
          investigated_at?: string | null
          investigated_by?: string | null
          resolution_notes?: string | null
          school_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dropout_alerts_course_session_id_fkey"
            columns: ["course_session_id"]
            isOneToOne: false
            referencedRelation: "course_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dropout_alerts_door_entry_id_fkey"
            columns: ["door_entry_id"]
            isOneToOne: false
            referencedRelation: "door_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dropout_alerts_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dropout_alerts_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_balances"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "dropout_alerts_investigated_by_fkey"
            columns: ["investigated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dropout_alerts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollment_checklist_items: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          montant_cash: number | null
          nom: string
          obligatoire: boolean
          ordre_affichage: number
          school_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          montant_cash?: number | null
          nom: string
          obligatoire?: boolean
          ordre_affichage?: number
          school_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          montant_cash?: number | null
          nom?: string
          obligatoire?: boolean
          ordre_affichage?: number
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_checklist_items_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          academic_year_id: string
          class_id: string | null
          created_at: string
          deleted_at: string | null
          enrollment_date: string
          enrollment_type: string | null
          fee_balance: number
          fee_expected: number
          fee_paid: number
          fee_status: string
          financial_profile_id: string | null
          grade_level_id: string
          guardian_id: string
          id: string
          matricule: string | null
          orientation_number: string | null
          school_id: string
          state_orientation: string | null
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          academic_year_id: string
          class_id?: string | null
          created_at?: string
          deleted_at?: string | null
          enrollment_date?: string
          enrollment_type?: string | null
          fee_balance?: number
          fee_expected?: number
          fee_paid?: number
          fee_status?: string
          financial_profile_id?: string | null
          grade_level_id: string
          guardian_id: string
          id?: string
          matricule?: string | null
          orientation_number?: string | null
          school_id: string
          state_orientation?: string | null
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          academic_year_id?: string
          class_id?: string | null
          created_at?: string
          deleted_at?: string | null
          enrollment_date?: string
          enrollment_type?: string | null
          fee_balance?: number
          fee_expected?: number
          fee_paid?: number
          fee_status?: string
          financial_profile_id?: string | null
          grade_level_id?: string
          guardian_id?: string
          id?: string
          matricule?: string | null
          orientation_number?: string | null
          school_id?: string
          state_orientation?: string | null
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_financial_profile_id_fkey"
            columns: ["financial_profile_id"]
            isOneToOne: false
            referencedRelation: "financial_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_grade_level_id_fkey"
            columns: ["grade_level_id"]
            isOneToOne: false
            referencedRelation: "grade_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_assessments: {
        Row: {
          class_id: string
          created_at: string
          created_by: string
          grade_type: string
          id: string
          label: string
          max_value: number
          period_id: string
          school_id: string
          subject_id: string
          weight: number
        }
        Insert: {
          class_id: string
          created_at?: string
          created_by: string
          grade_type: string
          id?: string
          label: string
          max_value: number
          period_id: string
          school_id: string
          subject_id: string
          weight?: number
        }
        Update: {
          class_id?: string
          created_at?: string
          created_by?: string
          grade_type?: string
          id?: string
          label?: string
          max_value?: number
          period_id?: string
          school_id?: string
          subject_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_assessments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_assessments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_assessments_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "evaluation_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_assessments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_assessments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_periods: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          is_passage: boolean
          label: string
          locked_at: string | null
          position: number
          rule_id: string
          school_id: string
          starts_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          is_passage?: boolean
          label: string
          locked_at?: string | null
          position: number
          rule_id: string
          school_id: string
          starts_at: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          is_passage?: boolean
          label?: string
          locked_at?: string | null
          position?: number
          rule_id?: string
          school_id?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_periods_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "evaluation_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_periods_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_rules: {
        Row: {
          academic_year_id: string
          composition_percent: number | null
          created_at: string
          cycle: string
          devoir_percent: number | null
          id: string
          interrogation_percent: number | null
          mode: string
          rescue_margin: number
          scale: number
          school_id: string
          threshold: number
        }
        Insert: {
          academic_year_id: string
          composition_percent?: number | null
          created_at?: string
          cycle?: string
          devoir_percent?: number | null
          id?: string
          interrogation_percent?: number | null
          mode: string
          rescue_margin?: number
          scale: number
          school_id: string
          threshold: number
        }
        Update: {
          academic_year_id?: string
          composition_percent?: number | null
          created_at?: string
          cycle?: string
          devoir_percent?: number | null
          id?: string
          interrogation_percent?: number | null
          mode?: string
          rescue_margin?: number
          scale?: number
          school_id?: string
          threshold?: number
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_rules_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_rules_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      family_reliability_scores: {
        Row: {
          approved_moratoriums: number
          created_at: string
          deleted_at: string | null
          guardian_id: string
          id: string
          last_updated: string
          late_payments: number
          on_time_payments: number
          rejected_moratoriums: number
          school_id: string
          score: number
          total_moratoriums: number
          updated_at: string
        }
        Insert: {
          approved_moratoriums?: number
          created_at?: string
          deleted_at?: string | null
          guardian_id: string
          id?: string
          last_updated?: string
          late_payments?: number
          on_time_payments?: number
          rejected_moratoriums?: number
          school_id: string
          score?: number
          total_moratoriums?: number
          updated_at?: string
        }
        Update: {
          approved_moratoriums?: number
          created_at?: string
          deleted_at?: string | null
          guardian_id?: string
          id?: string
          last_updated?: string
          late_payments?: number
          on_time_payments?: number
          rejected_moratoriums?: number
          school_id?: string
          score?: number
          total_moratoriums?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_reliability_scores_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_reliability_scores_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_discounts: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          enrollment_id: string
          id: string
          kind: string
          label: string
          reason: string | null
          school_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          enrollment_id: string
          id?: string
          kind: string
          label: string
          reason?: string | null
          school_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          enrollment_id?: string
          id?: string
          kind?: string
          label?: string
          reason?: string | null
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_discounts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_discounts_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_discounts_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_balances"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "fee_discounts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_schedules: {
        Row: {
          academic_year_id: string
          amount: number
          created_at: string
          deleted_at: string | null
          financial_profile_id: string | null
          grade_level_id: string | null
          id: string
          label: string | null
          school_id: string
          updated_at: string
        }
        Insert: {
          academic_year_id: string
          amount: number
          created_at?: string
          deleted_at?: string | null
          financial_profile_id?: string | null
          grade_level_id?: string | null
          id?: string
          label?: string | null
          school_id: string
          updated_at?: string
        }
        Update: {
          academic_year_id?: string
          amount?: number
          created_at?: string
          deleted_at?: string | null
          financial_profile_id?: string | null
          grade_level_id?: string | null
          id?: string
          label?: string | null
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_schedules_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_schedules_financial_profile_id_fkey"
            columns: ["financial_profile_id"]
            isOneToOne: false
            referencedRelation: "financial_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_schedules_grade_level_id_fkey"
            columns: ["grade_level_id"]
            isOneToOne: false
            referencedRelation: "grade_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_schedules_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_profiles: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          school_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          school_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      grade_corrections: {
        Row: {
          corrected_at: string
          corrected_by: string
          grade_id: string
          id: string
          new_comment: string | null
          new_status: string
          new_value: number | null
          old_comment: string | null
          old_status: string
          old_value: number | null
          reason: string
          revision: number
          school_id: string
        }
        Insert: {
          corrected_at?: string
          corrected_by: string
          grade_id: string
          id?: string
          new_comment?: string | null
          new_status: string
          new_value?: number | null
          old_comment?: string | null
          old_status: string
          old_value?: number | null
          reason: string
          revision: number
          school_id: string
        }
        Update: {
          corrected_at?: string
          corrected_by?: string
          grade_id?: string
          id?: string
          new_comment?: string | null
          new_status?: string
          new_value?: number | null
          old_comment?: string | null
          old_status?: string
          old_value?: number | null
          reason?: string
          revision?: number
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grade_corrections_corrected_by_fkey"
            columns: ["corrected_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_corrections_grade_id_fkey"
            columns: ["grade_id"]
            isOneToOne: false
            referencedRelation: "grade_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_corrections_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      grade_entries: {
        Row: {
          absence_status: string
          academic_year_id: string
          assessment_id: string | null
          comment: string | null
          created_at: string
          created_by: string
          deleted_at: string | null
          enrollment_id: string
          grade_type: string
          id: string
          label: string
          max_value: number
          period_id: string | null
          revision: number
          school_id: string
          session_id: string | null
          subject_id: string
          updated_at: string
          value: number | null
          weight: number
        }
        Insert: {
          absence_status?: string
          academic_year_id: string
          assessment_id?: string | null
          comment?: string | null
          created_at?: string
          created_by: string
          deleted_at?: string | null
          enrollment_id: string
          grade_type: string
          id?: string
          label: string
          max_value?: number
          period_id?: string | null
          revision?: number
          school_id: string
          session_id?: string | null
          subject_id: string
          updated_at?: string
          value?: number | null
          weight?: number
        }
        Update: {
          absence_status?: string
          academic_year_id?: string
          assessment_id?: string | null
          comment?: string | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          enrollment_id?: string
          grade_type?: string
          id?: string
          label?: string
          max_value?: number
          period_id?: string | null
          revision?: number
          school_id?: string
          session_id?: string | null
          subject_id?: string
          updated_at?: string
          value?: number | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "grade_entries_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_entries_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "evaluation_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_entries_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_entries_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_balances"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "grade_entries_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "evaluation_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_entries_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_entries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "course_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_entries_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      grade_levels: {
        Row: {
          created_at: string
          cycle: string
          deleted_at: string | null
          id: string
          level: number
          name: string
          school_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cycle: string
          deleted_at?: string | null
          id?: string
          level: number
          name: string
          school_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cycle?: string
          deleted_at?: string | null
          id?: string
          level?: number
          name?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grade_levels_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      guardians: {
        Row: {
          address: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          full_name: string
          id: string
          occupation: string | null
          phone: string
          phone_norm: string | null
          relation: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name: string
          id?: string
          occupation?: string | null
          phone: string
          phone_norm?: string | null
          relation?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name?: string
          id?: string
          occupation?: string | null
          phone?: string
          phone_norm?: string | null
          relation?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      homeworks: {
        Row: {
          class_id: string
          created_at: string
          deleted_at: string | null
          description: string | null
          due_date: string
          id: string
          is_published: boolean
          school_id: string
          subject_id: string
          supports: Json
          teacher_id: string
          title: string
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          due_date: string
          id?: string
          is_published?: boolean
          school_id: string
          subject_id: string
          supports?: Json
          teacher_id: string
          title: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          due_date?: string
          id?: string
          is_published?: boolean
          school_id?: string
          subject_id?: string
          supports?: Json
          teacher_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "homeworks_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homeworks_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homeworks_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homeworks_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      moratorium_installments: {
        Row: {
          amount: number
          created_at: string
          due_date: string
          id: string
          installment_no: number
          moratorium_id: string
          paid_amount: number
          paid_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          due_date: string
          id?: string
          installment_no: number
          moratorium_id: string
          paid_amount?: number
          paid_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string
          id?: string
          installment_no?: number
          moratorium_id?: string
          paid_amount?: number
          paid_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "moratorium_installments_moratorium_id_fkey"
            columns: ["moratorium_id"]
            isOneToOne: false
            referencedRelation: "moratoriums"
            referencedColumns: ["id"]
          },
        ]
      }
      moratoriums: {
        Row: {
          approved_amount: number | null
          created_at: string
          deleted_at: string | null
          due_date: string
          enrollment_id: string
          guardian_id: string
          id: string
          notes: string | null
          reason: string
          requested_amount: number
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          school_id: string
          status: string
          updated_at: string
        }
        Insert: {
          approved_amount?: number | null
          created_at?: string
          deleted_at?: string | null
          due_date: string
          enrollment_id: string
          guardian_id: string
          id?: string
          notes?: string | null
          reason: string
          requested_amount: number
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          approved_amount?: number | null
          created_at?: string
          deleted_at?: string | null
          due_date?: string
          enrollment_id?: string
          guardian_id?: string
          id?: string
          notes?: string | null
          reason?: string
          requested_amount?: number
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "moratoriums_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moratoriums_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_balances"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "moratoriums_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moratoriums_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moratoriums_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_outbox: {
        Row: {
          attempts: number
          channel: string
          created_at: string
          deleted_at: string | null
          error_message: string | null
          id: string
          max_attempts: number
          payload: Json
          recipient_phone: string
          scheduled_at: string
          school_id: string
          sent_at: string | null
          status: string
          template_key: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          channel: string
          created_at?: string
          deleted_at?: string | null
          error_message?: string | null
          id?: string
          max_attempts?: number
          payload?: Json
          recipient_phone: string
          scheduled_at?: string
          school_id: string
          sent_at?: string | null
          status?: string
          template_key: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          channel?: string
          created_at?: string
          deleted_at?: string | null
          error_message?: string | null
          id?: string
          max_attempts?: number
          payload?: Json
          recipient_phone?: string
          scheduled_at?: string
          school_id?: string
          sent_at?: string | null
          status?: string
          template_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_outbox_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_reminders: {
        Row: {
          channel: string
          created_at: string
          deleted_at: string | null
          enrollment_id: string
          id: string
          notes: string | null
          reminder_type: string
          school_id: string
          sent_at: string
          sent_by: string | null
          updated_at: string
        }
        Insert: {
          channel: string
          created_at?: string
          deleted_at?: string | null
          enrollment_id: string
          id?: string
          notes?: string | null
          reminder_type: string
          school_id: string
          sent_at?: string
          sent_by?: string | null
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          deleted_at?: string | null
          enrollment_id?: string
          id?: string
          notes?: string | null
          reminder_type?: string
          school_id?: string
          sent_at?: string
          sent_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_reminders_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reminders_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_balances"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "payment_reminders_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reminders_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          cancel_reason: string | null
          cash_session_id: string | null
          created_at: string
          deleted_at: string | null
          enrollment_id: string
          id: string
          payment_method: string
          received_at: string
          received_by: string | null
          reference: string | null
          school_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          cancel_reason?: string | null
          cash_session_id?: string | null
          created_at?: string
          deleted_at?: string | null
          enrollment_id: string
          id?: string
          payment_method: string
          received_at?: string
          received_by?: string | null
          reference?: string | null
          school_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          cancel_reason?: string | null
          cash_session_id?: string | null
          created_at?: string
          deleted_at?: string | null
          enrollment_id?: string
          id?: string
          payment_method?: string
          received_at?: string
          received_by?: string | null
          reference?: string | null
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_cash_session_id_fkey"
            columns: ["cash_session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_balances"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "payments_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_fee_ledger: {
        Row: {
          academic_year_id: string | null
          amount: number
          created_at: string
          event_id: string
          event_type: string | null
          id: string
          period_end: string | null
          period_label: string | null
          period_start: string | null
          product_id: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          academic_year_id?: string | null
          amount?: number
          created_at?: string
          event_id: string
          event_type?: string | null
          id?: string
          period_end?: string | null
          period_label?: string | null
          period_start?: string | null
          product_id?: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          academic_year_id?: string | null
          amount?: number
          created_at?: string
          event_id?: string
          event_type?: string | null
          id?: string
          period_end?: string | null
          period_label?: string | null
          period_start?: string | null
          product_id?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_fee_ledger_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_fee_ledger_enrollment_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_fee_ledger_enrollment_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_student_balances"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "platform_fee_ledger_school_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_invoices: {
        Row: {
          academic_year_id: string | null
          created_at: string
          id: string
          paid_amount: number | null
          paid_at: string | null
          period_end: string
          period_label: string
          period_start: string
          product_id: string
          status: string
          tenant_id: string
          total_due: number
          total_events: number | null
          total_students: number
          updated_at: string
        }
        Insert: {
          academic_year_id?: string | null
          created_at?: string
          id?: string
          paid_amount?: number | null
          paid_at?: string | null
          period_end: string
          period_label: string
          period_start: string
          product_id?: string
          status?: string
          tenant_id: string
          total_due?: number
          total_events?: number | null
          total_students?: number
          updated_at?: string
        }
        Update: {
          academic_year_id?: string | null
          created_at?: string
          id?: string
          paid_amount?: number | null
          paid_at?: string | null
          period_end?: string
          period_label?: string
          period_start?: string
          product_id?: string
          status?: string
          tenant_id?: string
          total_due?: number
          total_events?: number | null
          total_students?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_invoices_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_invoices_school_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      pre_enrollments: {
        Row: {
          accepted_checklist: Json
          birth_certificate_number: string | null
          code: string
          created_at: string
          date_of_birth: string
          deleted_at: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          enrollment_type: string | null
          expires_at: string
          first_name: string
          grade_level_id: string | null
          guardian_name: string | null
          guardian_phone: string
          guardian_relation: string | null
          id: string
          import_row_id: string | null
          last_name: string
          orientation_number: string | null
          payment_method: string | null
          payment_reference: string | null
          previous_class: string | null
          previous_matricule: string | null
          previous_school: string | null
          provided_documents: Json
          school_id: string
          source: string
          state_orientation: string | null
          status: string
          suggested_class_id: string | null
          updated_at: string
          validated_at: string | null
        }
        Insert: {
          accepted_checklist?: Json
          birth_certificate_number?: string | null
          code: string
          created_at?: string
          date_of_birth: string
          deleted_at?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          enrollment_type?: string | null
          expires_at: string
          first_name: string
          grade_level_id?: string | null
          guardian_name?: string | null
          guardian_phone: string
          guardian_relation?: string | null
          id?: string
          import_row_id?: string | null
          last_name: string
          orientation_number?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          previous_class?: string | null
          previous_matricule?: string | null
          previous_school?: string | null
          provided_documents?: Json
          school_id: string
          source?: string
          state_orientation?: string | null
          status?: string
          suggested_class_id?: string | null
          updated_at?: string
          validated_at?: string | null
        }
        Update: {
          accepted_checklist?: Json
          birth_certificate_number?: string | null
          code?: string
          created_at?: string
          date_of_birth?: string
          deleted_at?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          enrollment_type?: string | null
          expires_at?: string
          first_name?: string
          grade_level_id?: string | null
          guardian_name?: string | null
          guardian_phone?: string
          guardian_relation?: string | null
          id?: string
          import_row_id?: string | null
          last_name?: string
          orientation_number?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          previous_class?: string | null
          previous_matricule?: string | null
          previous_school?: string | null
          provided_documents?: Json
          school_id?: string
          source?: string
          state_orientation?: string | null
          status?: string
          suggested_class_id?: string | null
          updated_at?: string
          validated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pre_enrollments_grade_level_id_fkey"
            columns: ["grade_level_id"]
            isOneToOne: false
            referencedRelation: "grade_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pre_enrollments_import_row_id_fkey"
            columns: ["import_row_id"]
            isOneToOne: false
            referencedRelation: "admission_import_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pre_enrollments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pre_enrollments_suggested_class_id_fkey"
            columns: ["suggested_class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          issued_at: string
          issued_by: string | null
          payment_id: string
          qr_code_data: string
          receipt_number: string
          school_id: string
          updated_at: string
          verification_code: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          issued_at?: string
          issued_by?: string | null
          payment_id: string
          qr_code_data: string
          receipt_number: string
          school_id: string
          updated_at?: string
          verification_code: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          issued_at?: string
          issued_by?: string | null
          payment_id?: string
          qr_code_data?: string
          receipt_number?: string
          school_id?: string
          updated_at?: string
          verification_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipts_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      report_cards: {
        Row: {
          academic_year_id: string
          content: Json | null
          created_at: string
          deleted_at: string | null
          enrollment_id: string
          generated_at: string | null
          generated_by: string | null
          id: string
          pdf_url: string | null
          school_id: string
          sent_at: string | null
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          academic_year_id: string
          content?: Json | null
          created_at?: string
          deleted_at?: string | null
          enrollment_id: string
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          pdf_url?: string | null
          school_id: string
          sent_at?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          academic_year_id?: string
          content?: Json | null
          created_at?: string
          deleted_at?: string | null
          enrollment_id?: string
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          pdf_url?: string | null
          school_id?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "report_cards_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_cards_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_cards_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_balances"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "report_cards_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_cards_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      required_documents: {
        Row: {
          applicable_to_level_id: string | null
          created_at: string
          deleted_at: string | null
          id: string
          nom: string
          obligatoire: boolean
          school_id: string
          updated_at: string
        }
        Insert: {
          applicable_to_level_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          nom: string
          obligatoire?: boolean
          school_id: string
          updated_at?: string
        }
        Update: {
          applicable_to_level_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          nom?: string
          obligatoire?: boolean
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "required_documents_applicable_to_level_id_fkey"
            columns: ["applicable_to_level_id"]
            isOneToOne: false
            referencedRelation: "grade_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "required_documents_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          code: string
          label: string
        }
        Insert: {
          code: string
          label: string
        }
        Update: {
          code?: string
          label?: string
        }
        Relationships: []
      }
      school_features: {
        Row: {
          enabled: boolean
          feature: string
          school_id: string
        }
        Insert: {
          enabled?: boolean
          feature: string
          school_id: string
        }
        Update: {
          enabled?: boolean
          feature?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_features_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_payment_methods: {
        Row: {
          actif: boolean
          cheque_details: string | null
          created_at: string
          deleted_at: string | null
          iban: string | null
          id: string
          mobile_money_prefix: string | null
          mobile_money_type: string | null
          school_id: string
          type: string
          updated_at: string
        }
        Insert: {
          actif?: boolean
          cheque_details?: string | null
          created_at?: string
          deleted_at?: string | null
          iban?: string | null
          id?: string
          mobile_money_prefix?: string | null
          mobile_money_type?: string | null
          school_id: string
          type: string
          updated_at?: string
        }
        Update: {
          actif?: boolean
          cheque_details?: string | null
          created_at?: string
          deleted_at?: string | null
          iban?: string | null
          id?: string
          mobile_money_prefix?: string | null
          mobile_money_type?: string | null
          school_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_payment_methods_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_supplies: {
        Row: {
          academic_year_id: string | null
          class_name: string
          configurations: Json
          created_at: string
          deleted_at: string | null
          grade_level_id: string | null
          id: string
          published_at: string | null
          school_id: string
          status: string
          updated_at: string
        }
        Insert: {
          academic_year_id?: string | null
          class_name: string
          configurations?: Json
          created_at?: string
          deleted_at?: string | null
          grade_level_id?: string | null
          id?: string
          published_at?: string | null
          school_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          academic_year_id?: string | null
          class_name?: string
          configurations?: Json
          created_at?: string
          deleted_at?: string | null
          grade_level_id?: string | null
          id?: string
          published_at?: string | null
          school_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_supplies_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_supplies_grade_level_id_fkey"
            columns: ["grade_level_id"]
            isOneToOne: false
            referencedRelation: "grade_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_supplies_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          admission_notes: string | null
          city: string | null
          cover_photo_url: string | null
          created_at: string
          cycles_offered: Json
          deleted_at: string | null
          description_publique: string | null
          fees_structure: Json
          gallery_photos: Json
          grille_tarifaire_publique: Json | null
          id: string
          is_setup_complete: boolean
          itineraire: string | null
          latitude: number | null
          longitude: number | null
          name: string
          optional_services: Json
          photos_360: Json | null
          public_address: string | null
          public_email: string | null
          public_highlights: Json
          public_phone: string | null
          public_website_url: string | null
          published_to_trouvetou: boolean
          school_type: Database["public"]["Enums"]["school_type"] | null
          updated_at: string
          video_url: string | null
        }
        Insert: {
          admission_notes?: string | null
          city?: string | null
          cover_photo_url?: string | null
          created_at?: string
          cycles_offered?: Json
          deleted_at?: string | null
          description_publique?: string | null
          fees_structure?: Json
          gallery_photos?: Json
          grille_tarifaire_publique?: Json | null
          id?: string
          is_setup_complete?: boolean
          itineraire?: string | null
          latitude?: number | null
          longitude?: number | null
          name: string
          optional_services?: Json
          photos_360?: Json | null
          public_address?: string | null
          public_email?: string | null
          public_highlights?: Json
          public_phone?: string | null
          public_website_url?: string | null
          published_to_trouvetou?: boolean
          school_type?: Database["public"]["Enums"]["school_type"] | null
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          admission_notes?: string | null
          city?: string | null
          cover_photo_url?: string | null
          created_at?: string
          cycles_offered?: Json
          deleted_at?: string | null
          description_publique?: string | null
          fees_structure?: Json
          gallery_photos?: Json
          grille_tarifaire_publique?: Json | null
          id?: string
          is_setup_complete?: boolean
          itineraire?: string | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          optional_services?: Json
          photos_360?: Json | null
          public_address?: string | null
          public_email?: string | null
          public_highlights?: Json
          public_phone?: string | null
          public_website_url?: string | null
          published_to_trouvetou?: boolean
          school_type?: Database["public"]["Enums"]["school_type"] | null
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
      }
      student_fee_items: {
        Row: {
          academic_year_id: string
          amount: number
          created_at: string
          deleted_at: string | null
          due_date: string | null
          enrollment_id: string
          id: string
          label: string
          position: number
          school_id: string
          source: string
          updated_at: string
        }
        Insert: {
          academic_year_id: string
          amount: number
          created_at?: string
          deleted_at?: string | null
          due_date?: string | null
          enrollment_id: string
          id?: string
          label?: string
          position?: number
          school_id: string
          source?: string
          updated_at?: string
        }
        Update: {
          academic_year_id?: string
          amount?: number
          created_at?: string
          deleted_at?: string | null
          due_date?: string | null
          enrollment_id?: string
          id?: string
          label?: string
          position?: number
          school_id?: string
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_fee_items_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_fee_items_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_fee_items_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_balances"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "student_fee_items_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      student_movement_activation_audit: {
        Row: {
          actor_id: string
          event: string
          id: string
          occurred_at: string
          request_id: string
          school_id: string
        }
        Insert: {
          actor_id: string
          event: string
          id?: string
          occurred_at: string
          request_id: string
          school_id: string
        }
        Update: {
          actor_id?: string
          event?: string
          id?: string
          occurred_at?: string
          request_id?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_movement_activation_audit_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_movement_activation_audit_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "student_movement_activations"
            referencedColumns: ["request_id"]
          },
          {
            foreignKeyName: "student_movement_activation_audit_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      student_movement_activations: {
        Row: {
          activated_at: string
          activated_by: string
          expires_at: string
          request_id: string
          school_id: string
        }
        Insert: {
          activated_at: string
          activated_by: string
          expires_at: string
          request_id: string
          school_id: string
        }
        Update: {
          activated_at?: string
          activated_by?: string
          expires_at?: string
          request_id?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_movement_activations_activated_by_fkey"
            columns: ["activated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_movement_activations_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "student_movement_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_movement_activations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      student_movement_destinations: {
        Row: {
          authorization_reason: string
          authorized_at: string
          authorized_by: string
          request_id: string
          school_from: string
          school_to: string
        }
        Insert: {
          authorization_reason: string
          authorized_at?: string
          authorized_by: string
          request_id: string
          school_from: string
          school_to: string
        }
        Update: {
          authorization_reason?: string
          authorized_at?: string
          authorized_by?: string
          request_id?: string
          school_from?: string
          school_to?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_movement_destinations_authorized_by_fkey"
            columns: ["authorized_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_movement_destinations_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "student_movement_activations"
            referencedColumns: ["request_id"]
          },
          {
            foreignKeyName: "student_movement_destinations_school_from_fkey"
            columns: ["school_from"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_movement_destinations_school_to_fkey"
            columns: ["school_to"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      student_movement_imports: {
        Row: {
          enrollment_from: string
          enrollment_to: string
          imported_at: string
          imported_by: string
          request_id: string
          school_from: string
          school_to: string
        }
        Insert: {
          enrollment_from: string
          enrollment_to: string
          imported_at?: string
          imported_by: string
          request_id: string
          school_from: string
          school_to: string
        }
        Update: {
          enrollment_from?: string
          enrollment_to?: string
          imported_at?: string
          imported_by?: string
          request_id?: string
          school_from?: string
          school_to?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_movement_imports_enrollment_from_fkey"
            columns: ["enrollment_from"]
            isOneToOne: true
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_movement_imports_enrollment_from_fkey"
            columns: ["enrollment_from"]
            isOneToOne: true
            referencedRelation: "v_student_balances"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "student_movement_imports_enrollment_to_fkey"
            columns: ["enrollment_to"]
            isOneToOne: true
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_movement_imports_enrollment_to_fkey"
            columns: ["enrollment_to"]
            isOneToOne: true
            referencedRelation: "v_student_balances"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "student_movement_imports_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_movement_imports_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "student_movement_destinations"
            referencedColumns: ["request_id"]
          },
          {
            foreignKeyName: "student_movement_imports_school_from_fkey"
            columns: ["school_from"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_movement_imports_school_to_fkey"
            columns: ["school_to"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      student_movement_requests: {
        Row: {
          created_at: string
          created_by: string
          decision_reference: string | null
          enrollment_id: string
          id: string
          issuing_authority: string | null
          kind: string
          national_matricule: string | null
          reason: string
          scholarship_status: string | null
          school_id: string
          status: string
          student_id: string
          tracking_code: string
        }
        Insert: {
          created_at?: string
          created_by: string
          decision_reference?: string | null
          enrollment_id: string
          id?: string
          issuing_authority?: string | null
          kind: string
          national_matricule?: string | null
          reason: string
          scholarship_status?: string | null
          school_id: string
          status?: string
          student_id: string
          tracking_code: string
        }
        Update: {
          created_at?: string
          created_by?: string
          decision_reference?: string | null
          enrollment_id?: string
          id?: string
          issuing_authority?: string | null
          kind?: string
          national_matricule?: string | null
          reason?: string
          scholarship_status?: string | null
          school_id?: string
          status?: string
          student_id?: string
          tracking_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_movement_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_movement_requests_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: true
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_movement_requests_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: true
            referencedRelation: "v_student_balances"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "student_movement_requests_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_movement_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_qr_codes: {
        Row: {
          created_at: string
          deactivated_at: string | null
          deleted_at: string | null
          enrollment_id: string
          generated_at: string
          id: string
          is_active: boolean
          qr_code: string
          school_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deactivated_at?: string | null
          deleted_at?: string | null
          enrollment_id: string
          generated_at?: string
          id?: string
          is_active?: boolean
          qr_code: string
          school_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deactivated_at?: string | null
          deleted_at?: string | null
          enrollment_id?: string
          generated_at?: string
          id?: string
          is_active?: boolean
          qr_code?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_qr_codes_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_qr_codes_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_balances"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "student_qr_codes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          address: string | null
          birth_certificate_number: string | null
          created_at: string
          date_of_birth: string
          deleted_at: string | null
          first_name: string
          gender: string | null
          id: string
          last_name: string
          photo_url: string | null
          previous_class: string | null
          previous_school: string | null
          school_id: string
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          birth_certificate_number?: string | null
          created_at?: string
          date_of_birth: string
          deleted_at?: string | null
          first_name: string
          gender?: string | null
          id?: string
          last_name: string
          photo_url?: string | null
          previous_class?: string | null
          previous_school?: string | null
          school_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          birth_certificate_number?: string | null
          created_at?: string
          date_of_birth?: string
          deleted_at?: string | null
          first_name?: string
          gender?: string | null
          id?: string
          last_name?: string
          photo_url?: string | null
          previous_class?: string | null
          previous_school?: string | null
          school_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          code: string | null
          coefficient: number
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          school_id: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          coefficient?: number
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          school_id: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          coefficient?: number
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_payment_requests: {
        Row: {
          amount: number
          created_at: string
          id: string
          notes: string | null
          payment_provider: string | null
          product_id: string
          reference: string | null
          requested_by: string | null
          sender_phone: string | null
          status: string
          subscription_id: string | null
          tenant_id: string
          tier_id: string | null
          updated_at: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          notes?: string | null
          payment_provider?: string | null
          product_id: string
          reference?: string | null
          requested_by?: string | null
          sender_phone?: string | null
          status?: string
          subscription_id?: string | null
          tenant_id: string
          tier_id?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          payment_provider?: string | null
          product_id?: string
          reference?: string | null
          requested_by?: string | null
          sender_phone?: string | null
          status?: string
          subscription_id?: string | null
          tenant_id?: string
          tier_id?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: []
      }
      syscohada_export_log: {
        Row: {
          entries_count: number
          file_url: string | null
          format: string
          generated_at: string
          generated_by: string | null
          id: string
          period_end: string
          period_start: string
          school_id: string
          total_credit: number
          total_debit: number
        }
        Insert: {
          entries_count?: number
          file_url?: string | null
          format?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          period_end: string
          period_start: string
          school_id: string
          total_credit?: number
          total_debit?: number
        }
        Update: {
          entries_count?: number
          file_url?: string | null
          format?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          period_end?: string
          period_start?: string
          school_id?: string
          total_credit?: number
          total_debit?: number
        }
        Relationships: [
          {
            foreignKeyName: "syscohada_export_log_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "syscohada_export_log_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      syscohada_plan: {
        Row: {
          account: string
          account_type: string
          analytic: boolean
          label: string
        }
        Insert: {
          account: string
          account_type: string
          analytic?: boolean
          label: string
        }
        Update: {
          account?: string
          account_type?: string
          analytic?: boolean
          label?: string
        }
        Relationships: []
      }
      syscohada_settings: {
        Row: {
          created_at: string
          fiscal_year_date: string
          fiscal_year_months: number
          id: string
          school_id: string
        }
        Insert: {
          created_at?: string
          fiscal_year_date?: string
          fiscal_year_months?: number
          id?: string
          school_id: string
        }
        Update: {
          created_at?: string
          fiscal_year_date?: string
          fiscal_year_months?: number
          id?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "syscohada_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_subscriptions: {
        Row: {
          academic_year_id: string
          created_at: string
          end_date: string | null
          enrollment_id: string
          id: string
          route_id: string
          school_id: string
          start_date: string
          status: string
          stop_id: string | null
          updated_at: string
        }
        Insert: {
          academic_year_id: string
          created_at?: string
          end_date?: string | null
          enrollment_id: string
          id?: string
          route_id: string
          school_id: string
          start_date: string
          status?: string
          stop_id?: string | null
          updated_at?: string
        }
        Update: {
          academic_year_id?: string
          created_at?: string
          end_date?: string | null
          enrollment_id?: string
          id?: string
          route_id?: string
          school_id?: string
          start_date?: string
          status?: string
          stop_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_subscriptions_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_subscriptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_subscriptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_balances"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "transport_subscriptions_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "bus_routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_subscriptions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_subscriptions_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "bus_stops"
            referencedColumns: ["id"]
          },
        ]
      }
      trouvetou_ads: {
        Row: {
          created_at: string
          end_date: string
          id: string
          image_url: string | null
          is_active: boolean
          message: string
          school_id: string
          start_date: string
          target_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          message: string
          school_id: string
          start_date: string
          target_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          message?: string
          school_id?: string
          start_date?: string
          target_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trouvetou_ads_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      trouvetou_reservations: {
        Row: {
          amount_paid: number | null
          created_at: string
          expires_at: string | null
          grade_level_id: string
          id: string
          parent_email: string | null
          parent_full_name: string
          parent_phone: string
          payment_reference: string | null
          qr_code_token: string | null
          school_id: string
          status: string
          student_birthdate: string | null
          student_full_name: string
          updated_at: string
        }
        Insert: {
          amount_paid?: number | null
          created_at?: string
          expires_at?: string | null
          grade_level_id: string
          id?: string
          parent_email?: string | null
          parent_full_name: string
          parent_phone: string
          payment_reference?: string | null
          qr_code_token?: string | null
          school_id: string
          status?: string
          student_birthdate?: string | null
          student_full_name: string
          updated_at?: string
        }
        Update: {
          amount_paid?: number | null
          created_at?: string
          expires_at?: string | null
          grade_level_id?: string
          id?: string
          parent_email?: string | null
          parent_full_name?: string
          parent_phone?: string
          payment_reference?: string | null
          qr_code_token?: string | null
          school_id?: string
          status?: string
          student_birthdate?: string | null
          student_full_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trouvetou_reservations_grade_level_id_fkey"
            columns: ["grade_level_id"]
            isOneToOne: false
            referencedRelation: "grade_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trouvetou_reservations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      user_school_roles: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          role_code: string
          school_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          role_code: string
          school_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          role_code?: string
          school_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_school_roles_role_code_fkey"
            columns: ["role_code"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "user_school_roles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_school_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          activated_at: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          full_name: string
          id: string
          is_activated: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          full_name: string
          id: string
          is_activated?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_activated?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      year_rollover_logs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          initiated_at: string
          initiated_by: string
          new_year_id: string
          old_year_id: string
          school_id: string
          status: string
          students_excluded: number
          students_pending: number
          students_promoted: number
          students_repeated: number
          students_without_class: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          initiated_at?: string
          initiated_by: string
          new_year_id: string
          old_year_id: string
          school_id: string
          status?: string
          students_excluded?: number
          students_pending?: number
          students_promoted?: number
          students_repeated?: number
          students_without_class?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          initiated_at?: string
          initiated_by?: string
          new_year_id?: string
          old_year_id?: string
          school_id?: string
          status?: string
          students_excluded?: number
          students_pending?: number
          students_promoted?: number
          students_repeated?: number
          students_without_class?: number
        }
        Relationships: [
          {
            foreignKeyName: "year_rollover_logs_initiated_by_fkey"
            columns: ["initiated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "year_rollover_logs_new_year_id_fkey"
            columns: ["new_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "year_rollover_logs_old_year_id_fkey"
            columns: ["old_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "year_rollover_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_student_balances: {
        Row: {
          academic_year_id: string | null
          academic_year_label: string | null
          balance: number | null
          class_name: string | null
          enrollment_id: string | null
          enrollment_status: string | null
          expected_total: number | null
          first_name: string | null
          grade_level_name: string | null
          guardian_name: string | null
          guardian_phone: string | null
          has_fee_items: boolean | null
          last_name: string | null
          last_payment_at: string | null
          matricule: string | null
          next_due_amount: number | null
          next_due_date: string | null
          paid_total: number | null
          school_id: string | null
          student_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      v_student_fee_items_state: {
        Row: {
          academic_year_id: string | null
          amount: number | null
          created_at: string | null
          cum_expected: number | null
          due_date: string | null
          enrollment_id: string | null
          id: string | null
          label: string | null
          paid_on_item: number | null
          paid_total: number | null
          position: number | null
          remaining_on_item: number | null
          school_id: string | null
          source: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_fee_items_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_fee_items_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_fee_items_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_balances"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "student_fee_items_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      v_syscohada_control: {
        Row: {
          account: string | null
          account_type: string | null
          balance: number | null
          credit: number | null
          debit: number | null
          label: string | null
          school_id: string | null
          signed_balance: number | null
        }
        Relationships: [
          {
            foreignKeyName: "syscohada_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      v_syscohada_ledger: {
        Row: {
          credit_account: string | null
          credit_amount: number | null
          debit_account: string | null
          debit_amount: number | null
          enrollment_id: string | null
          ref_id: string | null
          ref_label: string | null
          school_id: string | null
          source_type: string | null
          transaction_date: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      activate_academic_year: { Args: { p_year_id: string }; Returns: string }
      activate_student_movement: {
        Args: { p_request_id: string; p_school_id: string }
        Returns: {
          expires_at: string
          status: string
          tracking_code: string
        }[]
      }
      annual_input_fingerprint: {
        Args: { p_enrollment_id: string }
        Returns: string
      }
      authorize_student_movement_destination: {
        Args: {
          p_reason: string
          p_request_id: string
          p_school_from: string
          p_school_to: string
        }
        Returns: undefined
      }
      billing_rpc_allowed: { Args: never; Returns: boolean }
      can_access_evaluation_assessment: {
        Args: { class: string; school: string; subject: string }
        Returns: boolean
      }
      can_access_evaluation_grade: {
        Args: { enrollment: string; school: string; subject: string }
        Returns: boolean
      }
      commit_admission_assignment: {
        Args: { p_assignment_batch_id: string }
        Returns: Json
      }
      consume_student_movement: {
        Args: {
          p_academic_year_id: string
          p_class_id: string
          p_school_to: string
          p_tracking_code: string
        }
        Returns: string
      }
      correct_evaluation_grade: {
        Args: {
          p_comment: string
          p_grade_id: string
          p_reason: string
          p_revision: number
          p_school_id: string
          p_status: string
          p_value: number
        }
        Returns: number
      }
      current_guardian_id: { Args: never; Returns: string }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      finalize_reservation: {
        Args: { p_reservation_id: string }
        Returns: boolean
      }
      generate_class_report_cards: {
        Args: { p_academic_year_id: string; p_class_id: string }
        Returns: number
      }
      generate_platform_invoices: {
        Args: {
          p_period_end: string
          p_period_label: string
          p_period_start: string
          p_product_id: string
        }
        Returns: {
          academic_year_id: string | null
          created_at: string
          id: string
          paid_amount: number | null
          paid_at: string | null
          period_end: string
          period_label: string
          period_start: string
          product_id: string
          status: string
          tenant_id: string
          total_due: number
          total_events: number | null
          total_students: number
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "platform_invoices"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_public_school_supplies_for_class: {
        Args: {
          p_academic_year_id?: string
          p_class_name: string
          p_school_id: string
        }
        Returns: {
          class_name: string
          configuration: Json
          grade_level_id: string
          published_at: string
          status: string
        }[]
      }
      has_school_role: {
        Args: { p_roles: string[]; p_school: string }
        Returns: boolean
      }
      is_school_member: { Args: { p_school: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      list_public_school_supply_classes: {
        Args: { p_academic_year_id?: string; p_school_id: string }
        Returns: {
          class_name: string
          grade_level_id: string
          status: string
          updated_at: string
        }[]
      }
      mark_fees_collected: {
        Args: {
          p_paid_amount: number
          p_period_label: string
          p_product_id: string
          p_tenant_id: string
        }
        Returns: number
      }
      movement_code_checksum: { Args: { body: string }; Returns: string }
      normalize_phone: { Args: { p_raw: string }; Returns: string }
      parent_can_read_enrollment: {
        Args: { p_enrollment: string }
        Returns: boolean
      }
      parent_can_write_enrollment: {
        Args: { p_enrollment: string }
        Returns: boolean
      }
      parent_owns_academic_year: { Args: { p_year: string }; Returns: boolean }
      parent_owns_enrollment: {
        Args: { p_enrollment: string }
        Returns: boolean
      }
      parent_owns_payment: { Args: { p_payment: string }; Returns: boolean }
      parent_owns_student: { Args: { p_student: string }; Returns: boolean }
      publish_class_report_cards: {
        Args: { p_academic_year_id: string; p_class_id: string }
        Returns: number
      }
      record_billable_event: {
        Args: {
          p_academic_year_id?: string
          p_amount?: number
          p_event_id: string
          p_event_type: string
          p_period_end?: string
          p_period_label?: string
          p_period_start?: string
          p_product_id: string
          p_tenant_id: string
        }
        Returns: {
          amount: number
          created_at: string
          event_id: string
          event_type: string
          id: string
          period_label: string
          product_id: string
          status: string
          tenant_id: string
        }[]
      }
      reject_subscription_payment: {
        Args: { p_request_id: string; p_validator_id?: string }
        Returns: {
          amount: number
          id: string
          product_id: string
          status: string
          tenant_id: string
          validated_at: string
          validated_by: string
        }[]
      }
      reserve_seat: {
        Args: {
          p_amount: number
          p_payment_ref: string
          p_reservation_id: string
        }
        Returns: boolean
      }
      validate_annual_decision: {
        Args: {
          p_average: number
          p_decision: string
          p_enrollment_id: string
          p_fingerprint: string
          p_observations?: string
        }
        Returns: string
      }
      validate_subscription_payment: {
        Args: { p_request_id: string; p_validator_id?: string }
        Returns: {
          amount: number
          id: string
          product_id: string
          status: string
          tenant_id: string
          validated_at: string
          validated_by: string
        }[]
      }
    }
    Enums: {
      academic_year_status: "planifiee" | "en_cours" | "cloturee"
      school_type:
        | "primaire"
        | "college"
        | "lycee"
        | "professionnel"
        | "islamique"
        | "superieur"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      academic_year_status: ["planifiee", "en_cours", "cloturee"],
      school_type: [
        "primaire",
        "college",
        "lycee",
        "professionnel",
        "islamique",
        "superieur",
      ],
    },
  },
} as const

