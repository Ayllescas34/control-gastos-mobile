CREATE TABLE `wallet_captures` (
	`id` text PRIMARY KEY NOT NULL,
	`external_ref` text NOT NULL,
	`source_app` text NOT NULL,
	`raw_title` text,
	`raw_text` text,
	`merchant` text,
	`amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`card_last4` text,
	`posted_at` text NOT NULL,
	`status` text NOT NULL,
	`transaction_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "wallet_captures_amount_minor_check" CHECK(typeof("wallet_captures"."amount_minor") = 'integer' AND abs("wallet_captures"."amount_minor") <= 9007199254740991 AND "wallet_captures"."amount_minor" > 0),
	CONSTRAINT "wallet_captures_currency_check" CHECK("wallet_captures"."currency" GLOB '[A-Z][A-Z][A-Z]'),
	CONSTRAINT "wallet_captures_card_last4_check" CHECK("wallet_captures"."card_last4" IS NULL OR "wallet_captures"."card_last4" GLOB '[0-9][0-9][0-9][0-9]'),
	CONSTRAINT "wallet_captures_status_check" CHECK("wallet_captures"."status" IN ('new', 'registered', 'dismissed')),
	CONSTRAINT "wallet_captures_registered_check" CHECK(("wallet_captures"."status" = 'registered') = ("wallet_captures"."transaction_id" IS NOT NULL)),
	CONSTRAINT "wallet_captures_posted_at_check" CHECK("wallet_captures"."posted_at" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z'),
	CONSTRAINT "wallet_captures_timestamps_check" CHECK("wallet_captures"."created_at" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z' AND "wallet_captures"."updated_at" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z' AND ("wallet_captures"."deleted_at" IS NULL OR "wallet_captures"."deleted_at" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wallet_captures_external_ref_unique` ON `wallet_captures` (`external_ref`);--> statement-breakpoint
CREATE INDEX `wallet_captures_status_posted_at_idx` ON `wallet_captures` (`status`,`posted_at`) WHERE "wallet_captures"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_source_external_ref_unique` ON `transactions` (`source`,`external_ref`) WHERE "transactions"."external_ref" IS NOT NULL;