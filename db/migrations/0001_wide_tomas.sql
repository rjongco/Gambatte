ALTER TABLE "cards" ADD COLUMN "parent_card_id" text;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "check_state" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "check_pos" real;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_parent_card_id_cards_id_fk" FOREIGN KEY ("parent_card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;