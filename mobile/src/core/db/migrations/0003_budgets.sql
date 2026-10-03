CREATE TABLE `budgets` (
	`id` text PRIMARY KEY NOT NULL,
	`category_id` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "budgets_amount_minor_check" CHECK(typeof("budgets"."amount_minor") = 'integer' AND abs("budgets"."amount_minor") <= 9007199254740991 AND "budgets"."amount_minor" > 0),
	CONSTRAINT "budgets_currency_check" CHECK("budgets"."currency" GLOB '[A-Z][A-Z][A-Z]'),
	CONSTRAINT "budgets_timestamps_check" CHECK("budgets"."created_at" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z' AND "budgets"."updated_at" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z' AND ("budgets"."deleted_at" IS NULL OR "budgets"."deleted_at" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `budgets_category_currency_unique` ON `budgets` (`category_id`,`currency`) WHERE "budgets"."deleted_at" IS NULL;