CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`currency` text NOT NULL,
	`initial_balance_minor` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	CONSTRAINT "accounts_type_check" CHECK("accounts"."type" IN ('cash', 'bank', 'savings', 'credit_card', 'other')),
	CONSTRAINT "accounts_currency_check" CHECK("accounts"."currency" GLOB '[A-Z][A-Z][A-Z]'),
	CONSTRAINT "accounts_initial_balance_minor_check" CHECK(typeof("accounts"."initial_balance_minor") = 'integer' AND abs("accounts"."initial_balance_minor") <= 9007199254740991),
	CONSTRAINT "accounts_timestamps_check" CHECK("accounts"."created_at" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z' AND "accounts"."updated_at" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z' AND ("accounts"."deleted_at" IS NULL OR "accounts"."deleted_at" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z'))
);
--> statement-breakpoint
CREATE TABLE `cards` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`alias` text NOT NULL,
	`last4` text NOT NULL,
	`network` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "cards_last4_check" CHECK("cards"."last4" GLOB '[0-9][0-9][0-9][0-9]'),
	CONSTRAINT "cards_network_check" CHECK("cards"."network" IS NULL OR "cards"."network" IN ('visa', 'mastercard', 'amex', 'other')),
	CONSTRAINT "cards_timestamps_check" CHECK("cards"."created_at" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z' AND "cards"."updated_at" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z' AND ("cards"."deleted_at" IS NULL OR "cards"."deleted_at" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z'))
);
--> statement-breakpoint
CREATE INDEX `cards_account_id_idx` ON `cards` (`account_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `cards_id_account_id_unique` ON `cards` (`id`,`account_id`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`account_id` text NOT NULL,
	`to_account_id` text,
	`category_id` text,
	`card_id` text,
	`occurred_at` text NOT NULL,
	`local_date` text NOT NULL,
	`description` text,
	`payee` text,
	`note` text,
	`source` text NOT NULL,
	`status` text NOT NULL,
	`external_ref` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`to_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`card_id`,`account_id`) REFERENCES `cards`(`id`,`account_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "transactions_amount_minor_check" CHECK(typeof("transactions"."amount_minor") = 'integer' AND abs("transactions"."amount_minor") <= 9007199254740991 AND "transactions"."amount_minor" > 0),
	CONSTRAINT "transactions_type_check" CHECK("transactions"."type" IN ('income', 'expense', 'transfer')),
	CONSTRAINT "transactions_source_check" CHECK("transactions"."source" IN ('manual', 'import', 'notification', 'api')),
	CONSTRAINT "transactions_status_check" CHECK("transactions"."status" IN ('confirmed', 'pending')),
	CONSTRAINT "transactions_currency_check" CHECK("transactions"."currency" GLOB '[A-Z][A-Z][A-Z]'),
	CONSTRAINT "transactions_transfer_check" CHECK(("transactions"."type" = 'transfer' AND "transactions"."to_account_id" IS NOT NULL AND "transactions"."to_account_id" <> "transactions"."account_id" AND "transactions"."category_id" IS NULL AND "transactions"."card_id" IS NULL) OR ("transactions"."type" <> 'transfer' AND "transactions"."to_account_id" IS NULL)),
	CONSTRAINT "transactions_dates_check" CHECK("transactions"."occurred_at" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z' AND "transactions"."local_date" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "transactions_timestamps_check" CHECK("transactions"."created_at" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z' AND "transactions"."updated_at" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z' AND ("transactions"."deleted_at" IS NULL OR "transactions"."deleted_at" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z'))
);
--> statement-breakpoint
CREATE INDEX `transactions_local_date_idx` ON `transactions` (`local_date`,`occurred_at`) WHERE "transactions"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX `transactions_account_id_local_date_idx` ON `transactions` (`account_id`,`local_date`) WHERE "transactions"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX `transactions_to_account_id_idx` ON `transactions` (`to_account_id`) WHERE "transactions"."to_account_id" IS NOT NULL AND "transactions"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX `transactions_category_id_local_date_idx` ON `transactions` (`category_id`,`local_date`) WHERE "transactions"."category_id" IS NOT NULL AND "transactions"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX `transactions_card_id_idx` ON `transactions` (`card_id`) WHERE "transactions"."card_id" IS NOT NULL AND "transactions"."deleted_at" IS NULL;