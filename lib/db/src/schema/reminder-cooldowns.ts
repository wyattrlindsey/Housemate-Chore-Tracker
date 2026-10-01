import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

// No household or chore data is persisted here, only the app-wide send limit.
export const reminderCooldownsTable = pgTable("reminder_cooldowns", {
  scope: text("scope").primaryKey(),
  nextAllowedAt: timestamp("next_allowed_at", { withTimezone: true }).notNull(),
});

export const insertReminderCooldownSchema = createInsertSchema(reminderCooldownsTable);
export type ReminderCooldown = typeof reminderCooldownsTable.$inferSelect;