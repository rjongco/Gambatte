import {
  pgTable,
  text,
  integer,
  date,
  timestamp,
  jsonb,
  uuid,
  index,
} from "drizzle-orm/pg-core";

/** Trello card cache + denormalized total time worked. */
export const cards = pgTable("cards", {
  id: text("id").primaryKey(), // Trello card id
  name: text("name").notNull(),
  shortUrl: text("short_url"),
  idList: text("id_list"),
  idMembers: jsonb("id_members").$type<string[]>().default([]).notNull(),
  totalMinutesWorked: integer("total_minutes_worked").default(0).notNull(),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }).defaultNow().notNull(),
});

/** One bar = one segment of work for a card on a single day. */
export const placements = pgTable(
  "placements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cardId: text("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    day: date("day").notNull(), // YYYY-MM-DD calendar date
    startMinute: integer("start_minute").notNull(), // 0..1440 from local midnight
    endMinute: integer("end_minute").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("placements_day_idx").on(t.day)],
);

/** Per-day "Out" time. Absent row / null outMinute => defaults to app_settings.dayEndMinute. */
export const daySettings = pgTable("day_settings", {
  day: date("day").primaryKey(),
  outMinute: integer("out_minute"),
});

/** Singleton global settings (id = 1). */
export const appSettings = pgTable("app_settings", {
  id: integer("id").primaryKey().default(1),
  dayStartMinute: integer("day_start_minute").default(480).notNull(), // 08:00
  dayEndMinute: integer("day_end_minute").default(1440).notNull(), // 24:00
});
