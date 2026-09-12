import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const organizationRole = pgEnum("organization_role", [
  "owner",
  "admin",
  "ops_manager",
  "inventory_manager",
  "finance",
  "viewer",
]);

export const commerceChannel = pgEnum("commerce_channel", [
  "shopify",
  "amazon",
  "flipkart",
  "meesho",
  "blinkit",
  "zepto",
  "swiggy_instamart",
  "woocommerce",
  "unicommerce",
  "easyecom",
  "other",
]);

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    createdBy: uuid("created_by").notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    website: text("website"),
    country: text("country").notNull(),
    timezone: text("timezone").notNull(),
    currency: text("currency").notNull().default("INR"),
    monthlyOrderVolume: integer("monthly_order_volume"),
    skuCount: integer("sku_count"),
    onboardingCompletedAt: timestamp("onboarding_completed_at", {
      withTimezone: true,
      mode: "date",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("organizations_slug_key").on(table.slug),
    index("organizations_created_by_idx").on(table.createdBy),
  ],
);

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  fullName: text("full_name"),
  email: text("email").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const organizationMembers = pgTable(
  "organization_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    role: organizationRole("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("organization_members_org_user_key").on(
      table.organizationId,
      table.userId,
    ),
    index("organization_members_user_id_idx").on(table.userId),
    index("organization_members_organization_id_idx").on(table.organizationId),
  ],
);

export const organizationChannels = pgTable(
  "organization_channels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    channel: commerceChannel("channel").notNull(),
    customName: text("custom_name"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("organization_channels_org_channel_key").on(
      table.organizationId,
      table.channel,
    ),
    index("organization_channels_organization_id_idx").on(table.organizationId),
  ],
);

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(organizationMembers),
  channels: many(organizationChannels),
}));

export const organizationMembersRelations = relations(
  organizationMembers,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationMembers.organizationId],
      references: [organizations.id],
    }),
  }),
);

export const organizationChannelsRelations = relations(
  organizationChannels,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationChannels.organizationId],
      references: [organizations.id],
    }),
  }),
);

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type Profile = typeof profiles.$inferSelect;
export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type OrganizationChannel = typeof organizationChannels.$inferSelect;
