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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      baits: {
        Row: {
          category: string
          created_at: string
          label: string
          slug: string
        }
        Insert: {
          category: string
          created_at?: string
          label: string
          slug: string
        }
        Update: {
          category?: string
          created_at?: string
          label?: string
          slug?: string
        }
        Relationships: []
      }
      catch_comments: {
        Row: {
          body: string
          catch_id: string
          created_at: string
          deleted_at: string | null
          id: string
          parent_comment_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          catch_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          parent_comment_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          catch_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          parent_comment_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "catch_comments_catch_id_fkey"
            columns: ["catch_id"]
            isOneToOne: false
            referencedRelation: "catches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catch_comments_catch_id_fkey"
            columns: ["catch_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_scores_detailed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catch_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "catch_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catch_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      catch_reactions: {
        Row: {
          catch_id: string
          created_at: string
          reaction: Database["public"]["Enums"]["reaction_type"]
          user_id: string
        }
        Insert: {
          catch_id: string
          created_at?: string
          reaction: Database["public"]["Enums"]["reaction_type"]
          user_id: string
        }
        Update: {
          catch_id?: string
          created_at?: string
          reaction?: Database["public"]["Enums"]["reaction_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "catch_reactions_catch_id_fkey"
            columns: ["catch_id"]
            isOneToOne: false
            referencedRelation: "catches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catch_reactions_catch_id_fkey"
            columns: ["catch_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_scores_detailed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catch_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      catches: {
        Row: {
          allow_ratings: boolean
          bait_used: string | null
          caught_at: string | null
          conditions: Json | null
          created_at: string
          custom_species: string | null
          deleted_at: string | null
          description: string | null
          equipment_used: string | null
          gallery_photos: string[] | null
          hide_exact_spot: boolean
          id: string
          image_url: string
          length: number | null
          length_unit: string | null
          location: string | null
          location_label: string | null
          method: string | null
          method_tag: string | null
          peg_or_swim: string | null
          session_id: string | null
          species: string | null
          species_slug: string | null
          tags: string[] | null
          time_of_day: string | null
          title: string
          updated_at: string
          user_id: string
          video_url: string | null
          visibility: string
          water_type: string | null
          water_type_code: string | null
          weight: number | null
          weight_unit: string | null
        }
        Insert: {
          allow_ratings?: boolean
          bait_used?: string | null
          caught_at?: string | null
          conditions?: Json | null
          created_at?: string
          custom_species?: string | null
          deleted_at?: string | null
          description?: string | null
          equipment_used?: string | null
          gallery_photos?: string[] | null
          hide_exact_spot?: boolean
          id?: string
          image_url: string
          length?: number | null
          length_unit?: string | null
          location?: string | null
          location_label?: string | null
          method?: string | null
          method_tag?: string | null
          peg_or_swim?: string | null
          session_id?: string | null
          species?: string | null
          species_slug?: string | null
          tags?: string[] | null
          time_of_day?: string | null
          title: string
          updated_at?: string
          user_id: string
          video_url?: string | null
          visibility?: string
          water_type?: string | null
          water_type_code?: string | null
          weight?: number | null
          weight_unit?: string | null
        }
        Update: {
          allow_ratings?: boolean
          bait_used?: string | null
          caught_at?: string | null
          conditions?: Json | null
          created_at?: string
          custom_species?: string | null
          deleted_at?: string | null
          description?: string | null
          equipment_used?: string | null
          gallery_photos?: string[] | null
          hide_exact_spot?: boolean
          id?: string
          image_url?: string
          length?: number | null
          length_unit?: string | null
          location?: string | null
          location_label?: string | null
          method?: string | null
          method_tag?: string | null
          peg_or_swim?: string | null
          session_id?: string | null
          species?: string | null
          species_slug?: string | null
          tags?: string[] | null
          time_of_day?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          video_url?: string | null
          visibility?: string
          water_type?: string | null
          water_type_code?: string | null
          weight?: number | null
          weight_unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catches_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_log: {
        Row: {
          action: Database["public"]["Enums"]["mod_action"]
          admin_id: string | null
          catch_id: string | null
          comment_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["mod_action"]
          admin_id?: string | null
          catch_id?: string | null
          comment_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["mod_action"]
          admin_id?: string | null
          catch_id?: string | null
          comment_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "moderation_log_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_log_catch_id_fkey"
            columns: ["catch_id"]
            isOneToOne: false
            referencedRelation: "catches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_log_catch_id_fkey"
            columns: ["catch_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_scores_detailed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_log_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "catch_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          catch_id: string | null
          comment_id: string | null
          created_at: string
          deleted_at: string | null
          extra_data: Json | null
          id: string
          is_read: boolean
          message: string
          read_at: string | null
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          catch_id?: string | null
          comment_id?: string | null
          created_at?: string
          deleted_at?: string | null
          extra_data?: Json | null
          id?: string
          is_read?: boolean
          message: string
          read_at?: string | null
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          actor_id?: string | null
          catch_id?: string | null
          comment_id?: string | null
          created_at?: string
          deleted_at?: string | null
          extra_data?: Json | null
          id?: string
          is_read?: boolean
          message?: string
          read_at?: string | null
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_catch_id_fkey"
            columns: ["catch_id"]
            isOneToOne: false
            referencedRelation: "catches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_catch_id_fkey"
            columns: ["catch_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_scores_detailed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "catch_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          full_name: string | null
          id: string
          location: string | null
          moderation_status: string
          status: string | null
          suspension_until: string | null
          updated_at: string
          username: string
          warn_count: number
          website: string | null
        }
        Insert: {
          avatar_path?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          location?: string | null
          moderation_status?: string
          status?: string | null
          suspension_until?: string | null
          updated_at?: string
          username: string
          warn_count?: number
          website?: string | null
        }
        Update: {
          avatar_path?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          location?: string | null
          moderation_status?: string
          status?: string | null
          suspension_until?: string | null
          updated_at?: string
          username?: string
          warn_count?: number
          website?: string | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          action: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_limits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ratings: {
        Row: {
          catch_id: string
          created_at: string
          id: string
          rating: number
          user_id: string
        }
        Insert: {
          catch_id: string
          created_at?: string
          id?: string
          rating: number
          user_id: string
        }
        Update: {
          catch_id?: string
          created_at?: string
          id?: string
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ratings_catch_id_fkey"
            columns: ["catch_id"]
            isOneToOne: false
            referencedRelation: "catches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_catch_id_fkey"
            columns: ["catch_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_scores_detailed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          reason: string
          reporter_id: string
          resolution_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: Database["public"]["Enums"]["report_target_type"]
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reporter_id: string
          resolution_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: Database["public"]["Enums"]["report_target_type"]
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          resolution_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_id?: string
          target_type?: Database["public"]["Enums"]["report_target_type"]
        }
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          created_at: string
          date: string
          deleted_at: string | null
          id: string
          notes: string | null
          title: string
          updated_at: string
          user_id: string
          venue: string | null
          venue_name_manual: string | null
        }
        Insert: {
          created_at?: string
          date: string
          deleted_at?: string | null
          id: string
          notes?: string | null
          title: string
          updated_at?: string
          user_id: string
          venue?: string | null
          venue_name_manual?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          deleted_at?: string | null
          id?: string
          notes?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          venue?: string | null
          venue_name_manual?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          category: string
          created_at: string
          label: string
          method_group: string | null
          slug: string
        }
        Insert: {
          category: string
          created_at?: string
          label: string
          method_group?: string | null
          slug: string
        }
        Update: {
          category?: string
          created_at?: string
          label?: string
          method_group?: string | null
          slug?: string
        }
        Relationships: []
      }
      user_warnings: {
        Row: {
          created_at: string
          details: string | null
          duration_hours: number | null
          id: string
          issued_by: string | null
          reason: string
          severity: Database["public"]["Enums"]["warning_severity"]
          user_id: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          duration_hours?: number | null
          id?: string
          issued_by?: string | null
          reason: string
          severity?: Database["public"]["Enums"]["warning_severity"]
          user_id: string
        }
        Update: {
          created_at?: string
          details?: string | null
          duration_hours?: number | null
          id?: string
          issued_by?: string | null
          reason?: string
          severity?: Database["public"]["Enums"]["warning_severity"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_warnings_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_warnings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      water_types: {
        Row: {
          code: string
          created_at: string
          group_name: string
          label: string
        }
        Insert: {
          code: string
          created_at?: string
          group_name: string
          label: string
        }
        Update: {
          code?: string
          created_at?: string
          group_name?: string
          label?: string
        }
        Relationships: []
      }
    }
    Views: {
      leaderboard_scores_detailed: {
        Row: {
          avg_rating: number | null
          caught_at: string | null
          conditions: Json | null
          created_at: string | null
          description: string | null
          gallery_photos: string[] | null
          id: string | null
          image_url: string | null
          length: number | null
          length_unit: string | null
          location: string | null
          location_label: string | null
          method: string | null
          method_tag: string | null
          owner_username: string | null
          rating_count: number | null
          species: string | null
          species_slug: string | null
          tags: string[] | null
          title: string | null
          total_score: number | null
          user_id: string | null
          video_url: string | null
          water_type_code: string | null
          weight: number | null
          weight_unit: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_delete_catch: {
        Args: { p_catch_id: string; p_reason: string }
        Returns: undefined
      }
      admin_delete_comment: {
        Args: { p_comment_id: string; p_reason: string }
        Returns: undefined
      }
      admin_restore_catch: {
        Args: { p_catch_id: string; p_reason: string }
        Returns: undefined
      }
      admin_restore_comment: {
        Args: { p_comment_id: string; p_reason: string }
        Returns: undefined
      }
      admin_warn_user: {
        Args: {
          p_duration_hours?: number
          p_reason: string
          p_severity?: Database["public"]["Enums"]["warning_severity"]
          p_user_id: string
        }
        Returns: undefined
      }
      check_email_exists: { Args: { p_email: string }; Returns: boolean }
      check_rate_limit: {
        Args: {
          p_action: string
          p_max_attempts: number
          p_user_id: string
          p_window_minutes: number
        }
        Returns: boolean
      }
      cleanup_rate_limits: { Args: never; Returns: number }
      create_comment_with_rate_limit: {
        Args: { p_body: string; p_catch_id: string }
        Returns: string
      }
      create_notification: {
        Args: {
          p_actor_id?: string
          p_catch_id?: string
          p_comment_id?: string
          p_extra_data?: Json
          p_message: string
          p_type: Database["public"]["Enums"]["notification_type"]
          p_user_id: string
        }
        Returns: string
      }
      create_report_with_rate_limit: {
        Args: {
          p_details?: string
          p_reason: string
          p_target_id: string
          p_target_type: Database["public"]["Enums"]["report_target_type"]
        }
        Returns: {
          created_at: string
          details: string | null
          id: string
          reason: string
          reporter_id: string
          resolution_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: Database["public"]["Enums"]["report_target_type"]
        }
        SetofOptions: {
          from: "*"
          to: "reports"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      follow_profile_with_rate_limit: {
        Args: { p_following_id: string }
        Returns: string
      }
      get_rate_limit_status: {
        Args: {
          p_action: string
          p_max_attempts: number
          p_user_id: string
          p_window_minutes: number
        }
        Returns: {
          allowed: number
          remaining: number
          reset_at: string
          used: number
        }[]
      }
      notify_admins:
        | {
            Args: { p_message: string; p_report_id: string }
            Returns: undefined
          }
        | {
            Args: { p_message: string; p_report_id?: string }
            Returns: undefined
          }
      rate_catch_with_rate_limit: {
        Args: { p_catch_id: string; p_rating: number }
        Returns: string
      }
      react_to_catch_with_rate_limit: {
        Args: { p_catch_id: string; p_reaction?: string }
        Returns: boolean
      }
      refresh_leaderboard: { Args: never; Returns: undefined }
      user_rate_limits: {
        Args: never
        Returns: {
          action: string
          count: number
          oldest_attempt: string
        }[]
      }
    }
    Enums: {
      length_unit: "cm" | "in"
      mod_action:
        | "delete_catch"
        | "delete_comment"
        | "restore_catch"
        | "restore_comment"
        | "warn_user"
        | "suspend_user"
      moderation_status: "active" | "warned" | "suspended" | "banned"
      notification_type:
        | "new_follower"
        | "new_comment"
        | "new_rating"
        | "new_reaction"
        | "mention"
        | "admin_report"
        | "admin_warning"
        | "admin_moderation"
      reaction_type: "like" | "love" | "fire"
      report_status: "open" | "resolved" | "dismissed"
      report_target_type: "catch" | "comment" | "profile"
      time_of_day: "morning" | "afternoon" | "evening" | "night"
      visibility_type: "public" | "followers" | "private"
      warning_severity: "warning" | "temporary_suspension" | "permanent_ban"
      weight_unit: "lb_oz" | "kg" | "g"
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
      length_unit: ["cm", "in"],
      mod_action: [
        "delete_catch",
        "delete_comment",
        "restore_catch",
        "restore_comment",
        "warn_user",
        "suspend_user",
      ],
      moderation_status: ["active", "warned", "suspended", "banned"],
      notification_type: [
        "new_follower",
        "new_comment",
        "new_rating",
        "new_reaction",
        "mention",
        "admin_report",
        "admin_warning",
        "admin_moderation",
      ],
      reaction_type: ["like", "love", "fire"],
      report_status: ["open", "resolved", "dismissed"],
      report_target_type: ["catch", "comment", "profile"],
      time_of_day: ["morning", "afternoon", "evening", "night"],
      visibility_type: ["public", "followers", "private"],
      warning_severity: ["warning", "temporary_suspension", "permanent_ban"],
      weight_unit: ["lb_oz", "kg", "g"],
    },
  },
} as const
