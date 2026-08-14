/**
 * types/crm.ts
 *
 * Hand-written mirror of supabase/schema.sql, structured the same way the
 * Supabase CLI's `supabase gen types typescript` output is structured
 * (Database -> public -> Tables/Enums), plus composed application-level
 * types (rows with joined relations) used throughout the UI layer.
 *
 * If the schema changes, regenerate with:
 *   supabase gen types typescript --project-id <id> > types/database.ts
 * and re-sync the hand-authored sections below (composed types, helpers).
 */

// =====================================================================================
// 1. ENUMS — must stay byte-for-byte in sync with the `create type` statements in schema.sql
// =====================================================================================

export type OrgRole = "admin" | "sales_manager" | "sales_rep";
export type MemberStatus = "invited" | "active" | "suspended";

export type LifecycleStage =
  | "subscriber"
  | "lead"
  | "marketing_qualified_lead"
  | "sales_qualified_lead"
  | "opportunity"
  | "customer"
  | "evangelist"
  | "other";

export type LeadStatus =
  | "new"
  | "open"
  | "in_progress"
  | "connected"
  | "attempted_to_contact"
  | "unqualified"
  | "bad_timing";

export type CompanySize =
  | "1-10"
  | "11-50"
  | "51-200"
  | "201-500"
  | "501-1000"
  | "1001-5000"
  | "5000+";

export type DealStatus = "open" | "won" | "lost";
export type BillingFrequency = "one_time" | "monthly" | "quarterly" | "yearly";

export type ActivityType = "note" | "call" | "email" | "meeting" | "task";
export type ActivityStatus = "planned" | "completed" | "canceled";
export type CallOutcome =
  | "connected"
  | "left_voicemail"
  | "no_answer"
  | "busy"
  | "wrong_number";
export type TaskPriority = "low" | "medium" | "high";

export type CustomFieldEntity = "contact" | "company" | "deal";
export type CustomFieldType =
  | "text"
  | "number"
  | "date"
  | "boolean"
  | "select"
  | "multiselect"
  | "url"
  | "email";

export type AuditAction = "insert" | "update" | "delete";

// =====================================================================================
// 2. DATABASE TYPE — Supabase-style Row / Insert / Update per table
// =====================================================================================

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          owner_id: string;
          logo_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          owner_id: string;
          logo_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["organizations"]["Insert"]>;
      };

      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          phone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["profiles"]["Insert"], "id">>;
      };

      organization_members: {
        Row: {
          id: string;
          org_id: string;
          user_id: string;
          role: OrgRole;
          status: MemberStatus;
          invited_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          user_id: string;
          role?: OrgRole;
          status?: MemberStatus;
          invited_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["organization_members"]["Insert"]>;
      };

      companies: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          domain: string | null;
          industry: string | null;
          phone: string | null;
          website: string | null;
          size: CompanySize | null;
          annual_revenue: number | null;
          address_line1: string | null;
          address_line2: string | null;
          city: string | null;
          state: string | null;
          postal_code: string | null;
          country: string | null;
          description: string | null;
          owner_id: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          domain?: string | null;
          industry?: string | null;
          phone?: string | null;
          website?: string | null;
          size?: CompanySize | null;
          annual_revenue?: number | null;
          address_line1?: string | null;
          address_line2?: string | null;
          city?: string | null;
          state?: string | null;
          postal_code?: string | null;
          country?: string | null;
          description?: string | null;
          owner_id?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["companies"]["Insert"], "org_id" | "created_by">>;
      };

      contacts: {
        Row: {
          id: string;
          org_id: string;
          first_name: string;
          last_name: string | null;
          email: string | null;
          phone: string | null;
          job_title: string | null;
          company_id: string | null;
          lifecycle_stage: LifecycleStage;
          lead_status: LeadStatus;
          source: string | null;
          linkedin_url: string | null;
          owner_id: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          first_name: string;
          last_name?: string | null;
          email?: string | null;
          phone?: string | null;
          job_title?: string | null;
          company_id?: string | null;
          lifecycle_stage?: LifecycleStage;
          lead_status?: LeadStatus;
          source?: string | null;
          linkedin_url?: string | null;
          owner_id?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["contacts"]["Insert"], "org_id" | "created_by">>;
      };

      contact_company_associations: {
        Row: {
          id: string;
          org_id: string;
          contact_id: string;
          company_id: string;
          role: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          contact_id: string;
          company_id: string;
          role?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["contact_company_associations"]["Insert"]>;
      };

      pipelines: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          is_default: boolean;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          is_default?: boolean;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["pipelines"]["Insert"]>;
      };

      pipeline_stages: {
        Row: {
          id: string;
          org_id: string;
          pipeline_id: string;
          name: string;
          position: number;
          probability: number;
          is_won_stage: boolean;
          is_lost_stage: boolean;
          color: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          pipeline_id: string;
          name: string;
          position?: number;
          probability?: number;
          is_won_stage?: boolean;
          is_lost_stage?: boolean;
          color?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["pipeline_stages"]["Insert"]>;
      };

      deals: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          pipeline_id: string;
          stage_id: string;
          company_id: string | null;
          primary_contact_id: string | null;
          amount: number;
          currency: string;
          status: DealStatus;
          is_recurring: boolean;
          recurring_amount: number | null;
          billing_frequency: BillingFrequency;
          expected_close_date: string | null;
          actual_close_date: string | null;
          lost_reason: string | null;
          owner_id: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          pipeline_id: string;
          stage_id: string;
          company_id?: string | null;
          primary_contact_id?: string | null;
          amount?: number;
          currency?: string;
          status?: DealStatus;
          is_recurring?: boolean;
          recurring_amount?: number | null;
          billing_frequency?: BillingFrequency;
          expected_close_date?: string | null;
          actual_close_date?: string | null;
          lost_reason?: string | null;
          owner_id?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["deals"]["Insert"], "org_id" | "created_by">>;
      };

      deal_contacts: {
        Row: {
          id: string;
          org_id: string;
          deal_id: string;
          contact_id: string;
          role: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          deal_id: string;
          contact_id: string;
          role?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["deal_contacts"]["Insert"]>;
      };

      activities: {
        Row: {
          id: string;
          org_id: string;
          type: ActivityType;
          subject: string;
          body: string | null;
          status: ActivityStatus;
          contact_id: string | null;
          company_id: string | null;
          deal_id: string | null;
          due_at: string | null;
          priority: TaskPriority;
          call_outcome: CallOutcome | null;
          duration_seconds: number | null;
          starts_at: string | null;
          ends_at: string | null;
          location: string | null;
          completed_at: string | null;
          owner_id: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          type: ActivityType;
          subject: string;
          body?: string | null;
          status?: ActivityStatus;
          contact_id?: string | null;
          company_id?: string | null;
          deal_id?: string | null;
          due_at?: string | null;
          priority?: TaskPriority;
          call_outcome?: CallOutcome | null;
          duration_seconds?: number | null;
          starts_at?: string | null;
          ends_at?: string | null;
          location?: string | null;
          completed_at?: string | null;
          owner_id?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["activities"]["Insert"], "org_id" | "created_by">>;
      };

      custom_field_definitions: {
        Row: {
          id: string;
          org_id: string;
          entity_type: CustomFieldEntity;
          field_key: string;
          label: string;
          field_type: CustomFieldType;
          options: { choices: string[] } | null;
          is_required: boolean;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          entity_type: CustomFieldEntity;
          field_key: string;
          label: string;
          field_type: CustomFieldType;
          options?: { choices: string[] } | null;
          is_required?: boolean;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["custom_field_definitions"]["Insert"]>;
      };

      custom_field_values: {
        Row: {
          id: string;
          org_id: string;
          field_id: string;
          entity_type: CustomFieldEntity;
          entity_id: string;
          value: unknown | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          field_id: string;
          entity_type: CustomFieldEntity;
          entity_id: string;
          value?: unknown | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["custom_field_values"]["Insert"]>;
      };

      audit_logs: {
        Row: {
          id: string;
          org_id: string;
          actor_id: string | null;
          action: AuditAction;
          entity_type: string;
          entity_id: string;
          old_values: Record<string, unknown> | null;
          new_values: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: never; // written only by the DB trigger — never insert from the client
        Update: never;
      };
    };
    Enums: {
      org_role: OrgRole;
      member_status: MemberStatus;
      lifecycle_stage: LifecycleStage;
      lead_status: LeadStatus;
      company_size: CompanySize;
      deal_status: DealStatus;
      billing_frequency: BillingFrequency;
      activity_type: ActivityType;
      activity_status: ActivityStatus;
      call_outcome: CallOutcome;
      task_priority: TaskPriority;
      custom_field_entity: CustomFieldEntity;
      custom_field_type: CustomFieldType;
      audit_action: AuditAction;
    };
  };
}

// =====================================================================================
// 3. ROW / INSERT / UPDATE SHORTHANDS
// =====================================================================================

type Tables = Database["public"]["Tables"];

export type Organization = Tables["organizations"]["Row"];
export type OrganizationInsert = Tables["organizations"]["Insert"];
export type OrganizationUpdate = Tables["organizations"]["Update"];

export type Profile = Tables["profiles"]["Row"];

export type OrganizationMember = Tables["organization_members"]["Row"];
export type OrganizationMemberInsert = Tables["organization_members"]["Insert"];

export type Company = Tables["companies"]["Row"];
export type CompanyInsert = Tables["companies"]["Insert"];
export type CompanyUpdate = Tables["companies"]["Update"];

export type Contact = Tables["contacts"]["Row"];
export type ContactInsert = Tables["contacts"]["Insert"];
export type ContactUpdate = Tables["contacts"]["Update"];

export type ContactCompanyAssociation = Tables["contact_company_associations"]["Row"];

export type Pipeline = Tables["pipelines"]["Row"];
export type PipelineStage = Tables["pipeline_stages"]["Row"];
export type PipelineStageInsert = Tables["pipeline_stages"]["Insert"];

export type Deal = Tables["deals"]["Row"];
export type DealInsert = Tables["deals"]["Insert"];
export type DealUpdate = Tables["deals"]["Update"];

export type DealContact = Tables["deal_contacts"]["Row"];

export type Activity = Tables["activities"]["Row"];
export type ActivityInsert = Tables["activities"]["Insert"];
export type ActivityUpdate = Tables["activities"]["Update"];

export type CustomFieldDefinition = Tables["custom_field_definitions"]["Row"];
export type CustomFieldValue = Tables["custom_field_values"]["Row"];

export type AuditLog = Tables["audit_logs"]["Row"];

// =====================================================================================
// 4. COMPOSED / APPLICATION-LEVEL TYPES (joins used by the UI layer)
// =====================================================================================

/** Minimal user info embedded wherever an owner/creator is displayed. */
export interface UserSummary {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
}

export interface CompanyWithOwner extends Company {
  owner: UserSummary | null;
  contact_count: number;
  open_deal_count: number;
  open_deal_value: number;
}

export interface ContactWithRelations extends Contact {
  company: Pick<Company, "id" | "name" | "domain"> | null;
  owner: UserSummary | null;
}

export interface DealWithRelations extends Deal {
  stage: PipelineStage;
  company: Pick<Company, "id" | "name"> | null;
  primary_contact: Pick<Contact, "id" | "first_name" | "last_name"> | null;
  owner: UserSummary | null;
}

/** A pipeline stage plus the deals currently sitting in it — the unit the Kanban board renders. */
export interface KanbanColumn {
  stage: PipelineStage;
  deals: DealWithRelations[];
  totalValue: number;
  dealCount: number;
}

export interface PipelineBoard {
  pipeline: Pipeline;
  columns: KanbanColumn[];
  totalPipelineValue: number;
}

export interface ActivityWithRelations extends Activity {
  owner: UserSummary | null;
  created_by_user: UserSummary | null;
  contact: Pick<Contact, "id" | "first_name" | "last_name"> | null;
  company: Pick<Company, "id" | "name"> | null;
  deal: Pick<Deal, "id" | "name"> | null;
}

/** One entry in a unified 360-degree timeline (contact, company, or deal page). */
export interface TimelineEntry {
  id: string;
  type: ActivityType;
  subject: string;
  body: string | null;
  status: ActivityStatus;
  occurredAt: string; // completed_at ?? starts_at ?? due_at ?? created_at, resolved server-side
  actor: UserSummary | null;
  raw: ActivityWithRelations;
}

export interface OrganizationMemberWithProfile extends OrganizationMember {
  profile: UserSummary;
}

// =====================================================================================
// 5. DASHBOARD / ANALYTICS TYPES
// =====================================================================================

export interface DashboardMetrics {
  totalPipelineValue: number;
  openDealCount: number;
  winRate: number; // 0-100, won / (won + lost) over the selected period
  wonCount: number;
  lostCount: number;
  averageDealVelocityDays: number; // avg days from created_at to actual_close_date for won deals
  monthlyRecurringRevenue: number; // sum of normalized recurring_amount across open + won recurring deals
  averageDealSize: number;
  periodStart: string;
  periodEnd: string;
}

export interface StageFunnelPoint {
  stageId: string;
  stageName: string;
  dealCount: number;
  totalValue: number;
  probability: number;
}

export interface ForecastPoint {
  month: string; // ISO yyyy-mm
  committedValue: number; // weighted by stage probability, open deals only
  closedWonValue: number;
  closedLostValue: number;
}

export interface RepPerformance {
  userId: string;
  fullName: string | null;
  openDealValue: number;
  wonDealValue: number;
  wonCount: number;
  lostCount: number;
  winRate: number;
  activityCount: number;
}

// =====================================================================================
// 6. FILTER / QUERY PARAM TYPES (shared between server actions and client hooks)
// =====================================================================================

export interface PaginationParams {
  page: number; // 1-indexed
  pageSize: number;
}

export interface PaginatedResult<T> {
  data: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface ContactFilters {
  search?: string;
  companyId?: string;
  ownerId?: string;
  lifecycleStage?: LifecycleStage[];
  leadStatus?: LeadStatus[];
  createdAfter?: string;
  createdBefore?: string;
}

export interface CompanyFilters {
  search?: string;
  ownerId?: string;
  industry?: string;
  size?: CompanySize[];
}

export interface DealFilters {
  search?: string;
  pipelineId?: string;
  stageId?: string[];
  ownerId?: string;
  status?: DealStatus[];
  companyId?: string;
  minAmount?: number;
  maxAmount?: number;
  expectedCloseAfter?: string;
  expectedCloseBefore?: string;
}

export type SortDirection = "asc" | "desc";

export interface SortParams<TField extends string = string> {
  field: TField;
  direction: SortDirection;
}

// =====================================================================================
// 7. ROLE / PERMISSION HELPERS (client-side mirrors of the RLS rules — UI gating only;
// the database RLS policies in schema.sql remain the actual source of truth/enforcement)
// =====================================================================================

export const ORG_ROLES: OrgRole[] = ["admin", "sales_manager", "sales_rep"];

export const ROLE_LABELS: Record<OrgRole, string> = {
  admin: "Admin",
  sales_manager: "Sales Manager",
  sales_rep: "Sales Rep",
};

export function isManagerRole(role: OrgRole | null | undefined): boolean {
  return role === "admin" || role === "sales_manager";
}

export function canDeleteRecords(role: OrgRole | null | undefined): boolean {
  return isManagerRole(role);
}

export function canEditRecord(
  role: OrgRole | null | undefined,
  userId: string,
  record: { owner_id?: string | null; created_by?: string | null }
): boolean {
  if (isManagerRole(role)) return true;
  return record.owner_id === userId || record.created_by === userId;
}
