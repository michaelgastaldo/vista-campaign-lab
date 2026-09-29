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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      ai_usage_log: {
        Row: {
          called_at: string
          fn: string
          id: string
          user_id: string
        }
        Insert: {
          called_at?: string
          fn: string
          id?: string
          user_id: string
        }
        Update: {
          called_at?: string
          fn?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      asset_pin_comments: {
        Row: {
          asset_id: string
          author_id: string
          body: string
          created_at: string
          id: string
          org_id: string
          resolved: boolean
          workspace_id: string
          x: number
          y: number
        }
        Insert: {
          asset_id: string
          author_id: string
          body: string
          created_at?: string
          id?: string
          org_id: string
          resolved?: boolean
          workspace_id: string
          x: number
          y: number
        }
        Update: {
          asset_id?: string
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          org_id?: string
          resolved?: boolean
          workspace_id?: string
          x?: number
          y?: number
        }
        Relationships: []
      }
      asset_reviewer_assignments: {
        Row: {
          asset_id: string
          assigned_by: string
          created_at: string
          id: string
          org_id: string
          required: boolean
          reviewer_id: string
          workspace_id: string
        }
        Insert: {
          asset_id: string
          assigned_by: string
          created_at?: string
          id?: string
          org_id: string
          required?: boolean
          reviewer_id: string
          workspace_id: string
        }
        Update: {
          asset_id?: string
          assigned_by?: string
          created_at?: string
          id?: string
          org_id?: string
          required?: boolean
          reviewer_id?: string
          workspace_id?: string
        }
        Relationships: []
      }
      asset_reviews: {
        Row: {
          asset_id: string
          asset_version: number
          comment: string | null
          created_at: string
          id: string
          org_id: string
          reviewer_id: string
          status: Database["public"]["Enums"]["asset_review_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          asset_id: string
          asset_version?: number
          comment?: string | null
          created_at?: string
          id?: string
          org_id: string
          reviewer_id: string
          status?: Database["public"]["Enums"]["asset_review_status"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          asset_id?: string
          asset_version?: number
          comment?: string | null
          created_at?: string
          id?: string
          org_id?: string
          reviewer_id?: string
          status?: Database["public"]["Enums"]["asset_review_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_reviews_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "workspace_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      audience_query_logs: {
        Row: {
          created_at: string
          criteria: Json
          crm_provider: string | null
          id: string
          org_id: string
          prompt: string
          result_count: number
          user_email: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          criteria?: Json
          crm_provider?: string | null
          id?: string
          org_id: string
          prompt: string
          result_count?: number
          user_email: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          criteria?: Json
          crm_provider?: string | null
          id?: string
          org_id?: string
          prompt?: string
          result_count?: number
          user_email?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      audience_saved_searches: {
        Row: {
          created_at: string
          created_by: string
          criteria: Json
          id: string
          name: string
          org_id: string
          prompt: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          criteria?: Json
          id?: string
          name: string
          org_id: string
          prompt?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          criteria?: Json
          id?: string
          name?: string
          org_id?: string
          prompt?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      audiences: {
        Row: {
          created_at: string
          created_by: string
          estimated_count: number
          id: string
          name: string
          org_id: string
          parsed_criteria: Json
          prompt: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          estimated_count?: number
          id?: string
          name: string
          org_id: string
          parsed_criteria: Json
          prompt: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          estimated_count?: number
          id?: string
          name?: string
          org_id?: string
          parsed_criteria?: Json
          prompt?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audiences_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audiences_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_requests: {
        Row: {
          brief: string
          created_at: string
          desired_due_date: string | null
          id: string
          org_id: string
          requestor_email: string
          requestor_name: string | null
          status: Database["public"]["Enums"]["campaign_request_status"]
          status_token: string
          status_token_expires_at: string
          template_id: string | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          brief: string
          created_at?: string
          desired_due_date?: string | null
          id?: string
          org_id: string
          requestor_email: string
          requestor_name?: string | null
          status?: Database["public"]["Enums"]["campaign_request_status"]
          status_token?: string
          status_token_expires_at?: string
          template_id?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          brief?: string
          created_at?: string
          desired_due_date?: string | null
          id?: string
          org_id?: string
          requestor_email?: string
          requestor_name?: string | null
          status?: Database["public"]["Enums"]["campaign_request_status"]
          status_token?: string
          status_token_expires_at?: string
          template_id?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      campaign_stages: {
        Row: {
          color: string
          created_at: string
          id: string
          is_system: boolean
          key: string
          label: string
          org_id: string
          position: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_system?: boolean
          key: string
          label: string
          org_id: string
          position?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_system?: boolean
          key?: string
          label?: string
          org_id?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_stages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_variants: {
        Row: {
          ai_summary: string | null
          channel: string
          copy: string | null
          created_at: string
          created_by: string
          creative_asset_id: string | null
          id: string
          is_winner: boolean
          label: string
          org_id: string
          position: number
          results: Json
          subject: string | null
          updated_at: string
          utm_tail: string | null
          workspace_id: string
        }
        Insert: {
          ai_summary?: string | null
          channel?: string
          copy?: string | null
          created_at?: string
          created_by: string
          creative_asset_id?: string | null
          id?: string
          is_winner?: boolean
          label: string
          org_id: string
          position?: number
          results?: Json
          subject?: string | null
          updated_at?: string
          utm_tail?: string | null
          workspace_id: string
        }
        Update: {
          ai_summary?: string | null
          channel?: string
          copy?: string | null
          created_at?: string
          created_by?: string
          creative_asset_id?: string | null
          id?: string
          is_winner?: boolean
          label?: string
          org_id?: string
          position?: number
          results?: Json
          subject?: string | null
          updated_at?: string
          utm_tail?: string | null
          workspace_id?: string
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          notes: string | null
          org_id: string
          taxonomy_snapshot: Json
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          notes?: string | null
          org_id: string
          taxonomy_snapshot: Json
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          notes?: string | null
          org_id?: string
          taxonomy_snapshot?: Json
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          blocked_reason: string | null
          created_at: string
          created_by: string
          depends_on: string[]
          done: boolean
          due_at: string | null
          id: string
          org_id: string
          owner_id: string | null
          position: number
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          blocked_reason?: string | null
          created_at?: string
          created_by: string
          depends_on?: string[]
          done?: boolean
          due_at?: string | null
          id?: string
          org_id: string
          owner_id?: string | null
          position?: number
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          blocked_reason?: string | null
          created_at?: string
          created_by?: string
          depends_on?: string[]
          done?: boolean
          due_at?: string | null
          id?: string
          org_id?: string
          owner_id?: string | null
          position?: number
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          channel: string | null
          company: string | null
          created_at: string
          created_by: string
          email: string | null
          full_name: string
          id: string
          is_sample: boolean
          last_activity_on: string
          notes: string | null
          org_id: string
          source: string | null
          stage: string
          title: string | null
          updated_at: string
        }
        Insert: {
          channel?: string | null
          company?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          full_name: string
          id?: string
          is_sample?: boolean
          last_activity_on?: string
          notes?: string | null
          org_id: string
          source?: string | null
          stage?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          channel?: string | null
          company?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          full_name?: string
          id?: string
          is_sample?: boolean
          last_activity_on?: string
          notes?: string | null
          org_id?: string
          source?: string | null
          stage?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      funnel_events: {
        Row: {
          channel: string | null
          created_at: string
          created_by: string
          id: string
          is_sample: boolean
          notes: string | null
          occurred_on: string
          org_id: string
          source: string | null
          stage: string
          unqualified_reason: string | null
          value_count: number
          workspace_id: string | null
        }
        Insert: {
          channel?: string | null
          created_at?: string
          created_by: string
          id?: string
          is_sample?: boolean
          notes?: string | null
          occurred_on?: string
          org_id: string
          source?: string | null
          stage: string
          unqualified_reason?: string | null
          value_count?: number
          workspace_id?: string | null
        }
        Update: {
          channel?: string | null
          created_at?: string
          created_by?: string
          id?: string
          is_sample?: boolean
          notes?: string | null
          occurred_on?: string
          org_id?: string
          source?: string | null
          stage?: string
          unqualified_reason?: string | null
          value_count?: number
          workspace_id?: string | null
        }
        Relationships: []
      }
      funnel_targets: {
        Row: {
          created_at: string
          created_by: string
          id: string
          mql_target: number
          org_id: string
          sqo_target: number
          updated_at: string
          workspace_id: string | null
          year_month: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          mql_target?: number
          org_id: string
          sqo_target?: number
          updated_at?: string
          workspace_id?: string | null
          year_month: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          mql_target?: number
          org_id?: string
          sqo_target?: number
          updated_at?: string
          workspace_id?: string | null
          year_month?: string
        }
        Relationships: []
      }
      gmail_connections: {
        Row: {
          access_token: string
          created_at: string
          email: string
          expires_at: string
          id: string
          org_id: string | null
          refresh_token: string
          scope: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
          org_id?: string | null
          refresh_token: string
          scope?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          org_id?: string | null
          refresh_token?: string
          scope?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gmail_connections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      imported_contacts: {
        Row: {
          company: string | null
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          list_id: string
          org_id: string
          raw: Json | null
          source_attribution: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          list_id: string
          org_id: string
          raw?: Json | null
          source_attribution?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          list_id?: string
          org_id?: string
          raw?: Json | null
          source_attribution?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "imported_contacts_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "imported_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imported_contacts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      imported_lists: {
        Row: {
          created_at: string
          created_by: string
          event_date: string | null
          id: string
          org_id: string
          original_filename: string | null
          row_count: number
          source_label: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          event_date?: string | null
          id?: string
          org_id: string
          original_filename?: string | null
          row_count?: number
          source_label: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          event_date?: string | null
          id?: string
          org_id?: string
          original_filename?: string | null
          row_count?: number
          source_label?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "imported_lists_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imported_lists_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_referrals: {
        Row: {
          assigned_to: string | null
          company: string | null
          created_at: string
          email: string
          follow_up_at: string | null
          id: string
          message: string | null
          name: string
          notes: string | null
          org_id: string | null
          phone: string | null
          referral_link_id: string | null
          status: Database["public"]["Enums"]["lead_status"]
        }
        Insert: {
          assigned_to?: string | null
          company?: string | null
          created_at?: string
          email: string
          follow_up_at?: string | null
          id?: string
          message?: string | null
          name: string
          notes?: string | null
          org_id?: string | null
          phone?: string | null
          referral_link_id?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
        }
        Update: {
          assigned_to?: string | null
          company?: string | null
          created_at?: string
          email?: string
          follow_up_at?: string | null
          id?: string
          message?: string | null
          name?: string
          notes?: string | null
          org_id?: string | null
          phone?: string | null
          referral_link_id?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
        }
        Relationships: [
          {
            foreignKeyName: "lead_referrals_referral_link_id_fkey"
            columns: ["referral_link_id"]
            isOneToOne: false
            referencedRelation: "referral_links"
            referencedColumns: ["id"]
          },
        ]
      }
      link_clicks: {
        Row: {
          country: string | null
          id: string
          ip_hash: string | null
          occurred_at: string
          org_id: string
          referrer: string | null
          short_link_id: string
          user_agent: string | null
        }
        Insert: {
          country?: string | null
          id?: string
          ip_hash?: string | null
          occurred_at?: string
          org_id: string
          referrer?: string | null
          short_link_id: string
          user_agent?: string | null
        }
        Update: {
          country?: string | null
          id?: string
          ip_hash?: string | null
          occurred_at?: string
          org_id?: string
          referrer?: string | null
          short_link_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "link_clicks_short_link_id_fkey"
            columns: ["short_link_id"]
            isOneToOne: false
            referencedRelation: "short_links"
            referencedColumns: ["id"]
          },
        ]
      }
      list_import_logs: {
        Row: {
          attendees_count: number
          created_at: string
          crm_provider: string | null
          errors: Json | null
          event_name: string | null
          external_campaign_id: string | null
          external_event_id: string | null
          failed_contacts: number
          file_name: string | null
          id: string
          no_shows_count: number
          org_id: string
          status: string
          successful_contacts: number
          total_contacts: number
          user_email: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          attendees_count?: number
          created_at?: string
          crm_provider?: string | null
          errors?: Json | null
          event_name?: string | null
          external_campaign_id?: string | null
          external_event_id?: string | null
          failed_contacts?: number
          file_name?: string | null
          id?: string
          no_shows_count?: number
          org_id: string
          status?: string
          successful_contacts?: number
          total_contacts?: number
          user_email: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          attendees_count?: number
          created_at?: string
          crm_provider?: string | null
          errors?: Json | null
          event_name?: string | null
          external_campaign_id?: string | null
          external_event_id?: string | null
          failed_contacts?: number
          file_name?: string | null
          id?: string
          no_shows_count?: number
          org_id?: string
          status?: string
          successful_contacts?: number
          total_contacts?: number
          user_email?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      org_campaign_types: {
        Row: {
          archived: boolean
          category: string
          created_at: string
          id: string
          label: string
          org_id: string
          position: number
          updated_at: string
          value: string
        }
        Insert: {
          archived?: boolean
          category: string
          created_at?: string
          id?: string
          label: string
          org_id: string
          position?: number
          updated_at?: string
          value: string
        }
        Update: {
          archived?: boolean
          category?: string
          created_at?: string
          id?: string
          label?: string
          org_id?: string
          position?: number
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      org_digests: {
        Row: {
          created_at: string
          for_date: string
          id: string
          org_id: string
          summary: Json
        }
        Insert: {
          created_at?: string
          for_date: string
          id?: string
          org_id: string
          summary?: Json
        }
        Update: {
          created_at?: string
          for_date?: string
          id?: string
          org_id?: string
          summary?: Json
        }
        Relationships: []
      }
      org_integration_status: {
        Row: {
          id: string
          integration_id: string
          marked_by: string | null
          notes: string | null
          org_id: string
          status: string
          updated_at: string
        }
        Insert: {
          id?: string
          integration_id: string
          marked_by?: string | null
          notes?: string | null
          org_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          id?: string
          integration_id?: string
          marked_by?: string | null
          notes?: string | null
          org_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      org_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          org_id: string
          role: Database["public"]["Enums"]["org_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          org_id: string
          role?: Database["public"]["Enums"]["org_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          org_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_invites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          industry: string | null
          name: string
          public_url: string | null
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          industry?: string | null
          name: string
          public_url?: string | null
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          industry?: string | null
          name?: string
          public_url?: string | null
          slug?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          default_org_id: string | null
          full_name: string | null
          id: string
          onboarded_at: string | null
        }
        Insert: {
          created_at?: string
          default_org_id?: string | null
          full_name?: string | null
          id: string
          onboarded_at?: string | null
        }
        Update: {
          created_at?: string
          default_org_id?: string | null
          full_name?: string | null
          id?: string
          onboarded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_org_id_fkey"
            columns: ["default_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_links: {
        Row: {
          company: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          org_id: string
          slug: string
          updated_at: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          org_id: string
          slug: string
          updated_at?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          org_id?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_links_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      responder_logs: {
        Row: {
          actor_id: string
          classification: string
          created_at: string
          draft_preview: string
          gmail_draft_id: string | null
          id: string
          org_id: string
          outcome: string
          recipient: string
          subject: string
          thread_id: string | null
        }
        Insert: {
          actor_id: string
          classification: string
          created_at?: string
          draft_preview?: string
          gmail_draft_id?: string | null
          id?: string
          org_id: string
          outcome?: string
          recipient?: string
          subject?: string
          thread_id?: string | null
        }
        Update: {
          actor_id?: string
          classification?: string
          created_at?: string
          draft_preview?: string
          gmail_draft_id?: string | null
          id?: string
          org_id?: string
          outcome?: string
          recipient?: string
          subject?: string
          thread_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "responder_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      responder_rules: {
        Row: {
          classification: string
          created_at: string
          created_by: string
          enabled: boolean
          field: string
          id: string
          name: string
          op: string
          org_id: string
          position: number
          updated_at: string
          value: string
        }
        Insert: {
          classification: string
          created_at?: string
          created_by: string
          enabled?: boolean
          field: string
          id?: string
          name: string
          op: string
          org_id: string
          position?: number
          updated_at?: string
          value?: string
        }
        Update: {
          classification?: string
          created_at?: string
          created_by?: string
          enabled?: boolean
          field?: string
          id?: string
          name?: string
          op?: string
          org_id?: string
          position?: number
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "responder_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      responder_settings: {
        Row: {
          auto_approve: Json
          org_id: string
          updated_at: string
        }
        Insert: {
          auto_approve?: Json
          org_id: string
          updated_at?: string
        }
        Update: {
          auto_approve?: Json
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "responder_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      short_links: {
        Row: {
          click_count: number
          created_at: string
          created_by: string
          id: string
          label: string | null
          org_id: string
          slug: string
          target_url: string
          utm_link_id: string | null
          workspace_id: string | null
        }
        Insert: {
          click_count?: number
          created_at?: string
          created_by: string
          id?: string
          label?: string | null
          org_id: string
          slug: string
          target_url: string
          utm_link_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          click_count?: number
          created_at?: string
          created_by?: string
          id?: string
          label?: string | null
          org_id?: string
          slug?: string
          target_url?: string
          utm_link_id?: string | null
          workspace_id?: string | null
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
      taxonomy_settings: {
        Row: {
          audiences: Json
          channels: Json
          id: string
          objectives: Json
          org_id: string
          quarters: Json
          regions: Json
          separator: string
          template: string
          updated_at: string
        }
        Insert: {
          audiences?: Json
          channels?: Json
          id?: string
          objectives?: Json
          org_id: string
          quarters?: Json
          regions?: Json
          separator?: string
          template?: string
          updated_at?: string
        }
        Update: {
          audiences?: Json
          channels?: Json
          id?: string
          objectives?: Json
          org_id?: string
          quarters?: Json
          regions?: Json
          separator?: string
          template?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "taxonomy_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          key: string
          updated_at: string
          user_id: string
          values: Json
        }
        Insert: {
          key: string
          updated_at?: string
          user_id: string
          values?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          user_id?: string
          values?: Json
        }
        Relationships: []
      }
      utm_generation_logs: {
        Row: {
          base_url: string
          created_at: string
          generated_url: string
          id: string
          org_id: string
          user_email: string
          user_id: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          workspace_id: string | null
        }
        Insert: {
          base_url: string
          created_at?: string
          generated_url: string
          id?: string
          org_id: string
          user_email: string
          user_id: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          workspace_id?: string | null
        }
        Update: {
          base_url?: string
          created_at?: string
          generated_url?: string
          id?: string
          org_id?: string
          user_email?: string
          user_id?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          workspace_id?: string | null
        }
        Relationships: []
      }
      utm_links: {
        Row: {
          base_url: string
          created_at: string
          created_by: string
          final_url: string
          id: string
          label: string
          org_id: string
          utm_campaign: string
          utm_content: string | null
          utm_medium: string
          utm_source: string
          utm_term: string | null
          workspace_id: string | null
        }
        Insert: {
          base_url: string
          created_at?: string
          created_by: string
          final_url: string
          id?: string
          label: string
          org_id: string
          utm_campaign: string
          utm_content?: string | null
          utm_medium: string
          utm_source: string
          utm_term?: string | null
          workspace_id?: string | null
        }
        Update: {
          base_url?: string
          created_at?: string
          created_by?: string
          final_url?: string
          id?: string
          label?: string
          org_id?: string
          utm_campaign?: string
          utm_content?: string | null
          utm_medium?: string
          utm_source?: string
          utm_term?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "utm_links_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utm_links_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      utm_settings: {
        Row: {
          campaigns: Json
          default_base_url: string | null
          id: string
          mediums: Json
          org_id: string
          sources: Json
          updated_at: string
        }
        Insert: {
          campaigns?: Json
          default_base_url?: string | null
          id?: string
          mediums?: Json
          org_id: string
          sources?: Json
          updated_at?: string
        }
        Update: {
          campaigns?: Json
          default_base_url?: string | null
          id?: string
          mediums?: Json
          org_id?: string
          sources?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "utm_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      utm_templates: {
        Row: {
          base_url: string | null
          created_at: string
          created_by: string
          id: string
          is_default: boolean
          name: string
          org_id: string
          updated_at: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          base_url?: string | null
          created_at?: string
          created_by: string
          id?: string
          is_default?: boolean
          name: string
          org_id: string
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          base_url?: string | null
          created_at?: string
          created_by?: string
          id?: string
          is_default?: boolean
          name?: string
          org_id?: string
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "utm_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_subscriptions: {
        Row: {
          active: boolean
          created_at: string
          created_by: string
          events: string[]
          id: string
          org_id: string
          secret: string
          updated_at: string
          url: string
          workspace_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by: string
          events?: string[]
          id?: string
          org_id: string
          secret: string
          updated_at?: string
          url: string
          workspace_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string
          events?: string[]
          id?: string
          org_id?: string
          secret?: string
          updated_at?: string
          url?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      workspace_activity: {
        Row: {
          actor_id: string
          created_at: string
          id: string
          kind: string
          org_id: string
          payload: Json
          workspace_id: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          id?: string
          kind: string
          org_id: string
          payload?: Json
          workspace_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          id?: string
          kind?: string
          org_id?: string
          payload?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_activity_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_assets: {
        Row: {
          created_at: string
          id: string
          kind: string
          label: string
          mime_type: string | null
          org_id: string
          size_bytes: number | null
          storage_path: string | null
          uploaded_by: string
          url: string
          version: number
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          label: string
          mime_type?: string | null
          org_id: string
          size_bytes?: number | null
          storage_path?: string | null
          uploaded_by: string
          url: string
          version?: number
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          label?: string
          mime_type?: string | null
          org_id?: string
          size_bytes?: number | null
          storage_path?: string | null
          uploaded_by?: string
          url?: string
          version?: number
          workspace_id?: string
        }
        Relationships: []
      }
      workspace_budget_lines: {
        Row: {
          actual_cents: number
          channel: string | null
          created_at: string
          created_by: string
          id: string
          label: string
          org_id: string
          planned_cents: number
          position: number
          updated_at: string
          vendor: string | null
          workspace_id: string
        }
        Insert: {
          actual_cents?: number
          channel?: string | null
          created_at?: string
          created_by: string
          id?: string
          label: string
          org_id: string
          planned_cents?: number
          position?: number
          updated_at?: string
          vendor?: string | null
          workspace_id: string
        }
        Update: {
          actual_cents?: number
          channel?: string | null
          created_at?: string
          created_by?: string
          id?: string
          label?: string
          org_id?: string
          planned_cents?: number
          position?: number
          updated_at?: string
          vendor?: string | null
          workspace_id?: string
        }
        Relationships: []
      }
      workspace_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          mentions: string[]
          org_id: string
          parent_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          mentions?: string[]
          org_id: string
          parent_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          mentions?: string[]
          org_id?: string
          parent_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      workspace_kpis: {
        Row: {
          channel: string
          clicks: number
          conversions: number
          created_at: string
          created_by: string
          id: string
          notes: string | null
          opens: number
          org_id: string
          revenue_cents: number
          sent: number
          spend_cents: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          channel: string
          clicks?: number
          conversions?: number
          created_at?: string
          created_by: string
          id?: string
          notes?: string | null
          opens?: number
          org_id: string
          revenue_cents?: number
          sent?: number
          spend_cents?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          channel?: string
          clicks?: number
          conversions?: number
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          opens?: number
          org_id?: string
          revenue_cents?: number
          sent?: number
          spend_cents?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      workspace_retros: {
        Row: {
          campaign_type: Database["public"]["Enums"]["campaign_type"]
          created_at: string
          created_by: string
          id: string
          next_time: string | null
          org_id: string
          what_didnt: string | null
          what_worked: string | null
          workspace_id: string
        }
        Insert: {
          campaign_type?: Database["public"]["Enums"]["campaign_type"]
          created_at?: string
          created_by: string
          id?: string
          next_time?: string | null
          org_id: string
          what_didnt?: string | null
          what_worked?: string | null
          workspace_id: string
        }
        Update: {
          campaign_type?: Database["public"]["Enums"]["campaign_type"]
          created_at?: string
          created_by?: string
          id?: string
          next_time?: string | null
          org_id?: string
          what_didnt?: string | null
          what_worked?: string | null
          workspace_id?: string
        }
        Relationships: []
      }
      workspace_share_links: {
        Row: {
          click_count: number
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          label: string | null
          org_id: string
          scope: string
          token: string
          workspace_id: string
        }
        Insert: {
          click_count?: number
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          label?: string | null
          org_id: string
          scope?: string
          token: string
          workspace_id: string
        }
        Update: {
          click_count?: number
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          label?: string | null
          org_id?: string
          scope?: string
          token?: string
          workspace_id?: string
        }
        Relationships: []
      }
      workspace_templates: {
        Row: {
          campaign_type: Database["public"]["Enums"]["campaign_type"]
          created_at: string
          created_by: string | null
          default_checklist: Json
          description: string | null
          id: string
          is_seed: boolean
          name: string
          org_id: string | null
          suggested_channels: Json
          suggested_kpi_label: string | null
          updated_at: string
        }
        Insert: {
          campaign_type?: Database["public"]["Enums"]["campaign_type"]
          created_at?: string
          created_by?: string | null
          default_checklist?: Json
          description?: string | null
          id?: string
          is_seed?: boolean
          name: string
          org_id?: string | null
          suggested_channels?: Json
          suggested_kpi_label?: string | null
          updated_at?: string
        }
        Update: {
          campaign_type?: Database["public"]["Enums"]["campaign_type"]
          created_at?: string
          created_by?: string | null
          default_checklist?: Json
          description?: string | null
          id?: string
          is_seed?: boolean
          name?: string
          org_id?: string | null
          suggested_channels?: Json
          suggested_kpi_label?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      workspaces: {
        Row: {
          budget_cents: number
          campaign_type: Database["public"]["Enums"]["campaign_type"]
          channel: string | null
          created_at: string
          currency: string
          end_date: string | null
          goal: string | null
          id: string
          is_sample: boolean
          kpi_actual: number | null
          kpi_label: string | null
          kpi_target: number | null
          name: string
          org_id: string
          owner_id: string
          revenue_cents: number
          spend_cents: number
          start_date: string | null
          status: string
          taxonomy_snapshot: Json | null
          updated_at: string
          workspace_flow: Json
        }
        Insert: {
          budget_cents?: number
          campaign_type?: Database["public"]["Enums"]["campaign_type"]
          channel?: string | null
          created_at?: string
          currency?: string
          end_date?: string | null
          goal?: string | null
          id?: string
          is_sample?: boolean
          kpi_actual?: number | null
          kpi_label?: string | null
          kpi_target?: number | null
          name: string
          org_id: string
          owner_id: string
          revenue_cents?: number
          spend_cents?: number
          start_date?: string | null
          status?: string
          taxonomy_snapshot?: Json | null
          updated_at?: string
          workspace_flow?: Json
        }
        Update: {
          budget_cents?: number
          campaign_type?: Database["public"]["Enums"]["campaign_type"]
          channel?: string | null
          created_at?: string
          currency?: string
          end_date?: string | null
          goal?: string | null
          id?: string
          is_sample?: boolean
          kpi_actual?: number | null
          kpi_label?: string | null
          kpi_target?: number | null
          name?: string
          org_id?: string
          owner_id?: string
          revenue_cents?: number
          spend_cents?: number
          start_date?: string | null
          status?: string
          taxonomy_snapshot?: Json | null
          updated_at?: string
          workspace_flow?: Json
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_org_invite: { Args: { _token: string }; Returns: string }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      dispatch_hmac: {
        Args: { _body: string; _subscription_id: string }
        Returns: string
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_cron_secret: { Args: never; Returns: string }
      get_org_invite_token: { Args: { _invite_id: string }; Returns: string }
      has_org_role: {
        Args: {
          _org_id: string
          _role: Database["public"]["Enums"]["org_role"]
        }
        Returns: boolean
      }
      has_org_role_any: {
        Args: {
          _org_id: string
          _roles: Database["public"]["Enums"]["org_role"][]
        }
        Returns: boolean
      }
      is_org_member: { Args: { _org_id: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      org_default_creator: { Args: { _org_id: string }; Returns: string }
      org_id_from_slug: { Args: { _slug: string }; Returns: string }
      public_invite_by_token: {
        Args: { _token: string }
        Returns: {
          accepted_at: string
          email: string
          expires_at: string
          id: string
          org_id: string
          org_name: string
          role: Database["public"]["Enums"]["org_role"]
        }[]
      }
      public_request_status: {
        Args: { _token: string }
        Returns: {
          brief: string
          created_at: string
          id: string
          status: Database["public"]["Enums"]["campaign_request_status"]
          workspace_id: string
        }[]
      }
      public_seed_templates: {
        Args: never
        Returns: {
          campaign_type: Database["public"]["Enums"]["campaign_type"]
          description: string
          id: string
          name: string
        }[]
      }
      public_workspace_by_token: {
        Args: { _token: string }
        Returns: {
          channel: string
          end_date: string
          goal: string
          id: string
          kpi_actual: number
          kpi_label: string
          kpi_target: number
          name: string
          org_id: string
          start_date: string
          status: string
        }[]
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      record_ai_call: {
        Args: { _fn: string; _limit?: number }
        Returns: number
      }
      record_link_click: {
        Args: {
          _org_id: string
          _ref: string
          _short_link_id: string
          _ua: string
        }
        Returns: undefined
      }
      record_share_view: { Args: { _token: string }; Returns: undefined }
      resolve_referral_slug: {
        Args: { _slug: string }
        Returns: {
          org_id: string
          referral_link_id: string
          referrer_name: string
        }[]
      }
      resolve_short_link: {
        Args: { _slug: string }
        Returns: {
          id: string
          org_id: string
          target_url: string
        }[]
      }
      seed_contacts_sample: {
        Args: { _org_id: string; _user_id: string }
        Returns: undefined
      }
      seed_funnel_sample: {
        Args: { _org_id: string; _user_id: string }
        Returns: undefined
      }
      shares_org_with: { Args: { _other: string }; Returns: boolean }
    }
    Enums: {
      asset_review_status: "pending" | "approved" | "changes_requested"
      campaign_request_status: "new" | "accepted" | "declined" | "converted"
      campaign_type:
        | "product_launch"
        | "webinar"
        | "newsletter"
        | "paid_acquisition"
        | "event"
        | "content"
        | "other"
      lead_status: "new" | "contacted" | "qualified" | "closed"
      org_role: "owner" | "admin" | "member"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      asset_review_status: ["pending", "approved", "changes_requested"],
      campaign_request_status: ["new", "accepted", "declined", "converted"],
      campaign_type: [
        "product_launch",
        "webinar",
        "newsletter",
        "paid_acquisition",
        "event",
        "content",
        "other",
      ],
      lead_status: ["new", "contacted", "qualified", "closed"],
      org_role: ["owner", "admin", "member"],
    },
  },
} as const
