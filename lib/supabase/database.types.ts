export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type OrganizationRole =
  | "owner"
  | "admin"
  | "ops_manager"
  | "inventory_manager"
  | "finance"
  | "viewer";

export type CommerceChannel =
  | "shopify"
  | "amazon"
  | "flipkart"
  | "meesho"
  | "blinkit"
  | "zepto"
  | "swiggy_instamart"
  | "woocommerce"
  | "unicommerce"
  | "easyecom"
  | "other";

type OrganizationRow = {
  id: string;
  created_by: string;
  name: string;
  slug: string;
  website: string | null;
  country: string;
  timezone: string;
  currency: string;
  monthly_order_volume: number | null;
  sku_count: number | null;
  onboarding_completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string;
  created_at: string;
  updated_at: string;
};

type OrganizationMemberRow = {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrganizationRole;
  created_at: string;
};

type OrganizationChannelRow = {
  id: string;
  organization_id: string;
  channel: CommerceChannel;
  custom_name: string | null;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: OrganizationRow;
        Insert: {
          id?: string;
          created_by: string;
          name: string;
          slug: string;
          website?: string | null;
          country: string;
          timezone: string;
          currency?: string;
          monthly_order_volume?: number | null;
          sku_count?: number | null;
          onboarding_completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<OrganizationRow>;
        Relationships: [];
      };
      profiles: {
        Row: ProfileRow;
        Insert: {
          id: string;
          full_name?: string | null;
          email: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      organization_members: {
        Row: OrganizationMemberRow;
        Insert: Omit<OrganizationMemberRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<OrganizationMemberRow>;
        Relationships: [];
      };
      organization_channels: {
        Row: OrganizationChannelRow;
        Insert: Omit<OrganizationChannelRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<OrganizationChannelRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      organization_role: OrganizationRole;
      commerce_channel: CommerceChannel;
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Organization = OrganizationRow;
export type Profile = ProfileRow;
export type OrganizationMember = OrganizationMemberRow;
export type OrganizationChannel = OrganizationChannelRow;
