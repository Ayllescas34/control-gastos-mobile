CREATE TABLE `savings_goals` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`name` text NOT NULL,
	`target_amount_minor` integer NOT NULL,
	`target_date` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "savings_goals_name_check" CHECK(length(trim("savings_goals"."name")) > 0),
	CONSTRAINT "savings_goals_target_amount_minor_check" CHECK(typeof("savings_goals"."target_amount_minor") = 'integer' AND abs("savings_goals"."target_amount_minor") <= 9007199254740991 AND "savings_goals"."target_amount_minor" > 0),
	CONSTRAINT "savings_goals_target_date_check" CHECK("savings_goals"."target_date" IS NULL OR "savings_goals"."target_date" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "savings_goals_timestamps_check" CHECK("savings_goals"."created_at" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z' AND "savings_goals"."updated_at" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z' AND ("savings_goals"."deleted_at" IS NULL OR "savings_goals"."deleted_at" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `savings_goals_account_unique` ON `savings_goals` (`account_id`) WHERE "savings_goals"."deleted_at" IS NULL;