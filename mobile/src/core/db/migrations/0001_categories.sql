CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`icon` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	CONSTRAINT "categories_kind_check" CHECK("categories"."kind" IN ('expense', 'income')),
	CONSTRAINT "categories_name_check" CHECK(length(trim("categories"."name")) > 0),
	CONSTRAINT "categories_timestamps_check" CHECK("categories"."created_at" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z' AND "categories"."updated_at" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z' AND ("categories"."deleted_at" IS NULL OR "categories"."deleted_at" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_kind_name_unique` ON `categories` (`kind`,lower("name")) WHERE "categories"."deleted_at" IS NULL;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_transactions` (
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
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`card_id`,`account_id`) REFERENCES `cards`(`id`,`account_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "transactions_amount_minor_check" CHECK(typeof("__new_transactions"."amount_minor") = 'integer' AND abs("__new_transactions"."amount_minor") <= 9007199254740991 AND "__new_transactions"."amount_minor" > 0),
	CONSTRAINT "transactions_type_check" CHECK("__new_transactions"."type" IN ('income', 'expense', 'transfer')),
	CONSTRAINT "transactions_source_check" CHECK("__new_transactions"."source" IN ('manual', 'import', 'notification', 'api')),
	CONSTRAINT "transactions_status_check" CHECK("__new_transactions"."status" IN ('confirmed', 'pending')),
	CONSTRAINT "transactions_currency_check" CHECK("__new_transactions"."currency" GLOB '[A-Z][A-Z][A-Z]'),
	CONSTRAINT "transactions_transfer_check" CHECK(("__new_transactions"."type" = 'transfer' AND "__new_transactions"."to_account_id" IS NOT NULL AND "__new_transactions"."to_account_id" <> "__new_transactions"."account_id" AND "__new_transactions"."category_id" IS NULL AND "__new_transactions"."card_id" IS NULL) OR ("__new_transactions"."type" <> 'transfer' AND "__new_transactions"."to_account_id" IS NULL)),
	CONSTRAINT "transactions_dates_check" CHECK("__new_transactions"."occurred_at" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z' AND "__new_transactions"."local_date" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "transactions_timestamps_check" CHECK("__new_transactions"."created_at" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z' AND "__new_transactions"."updated_at" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z' AND ("__new_transactions"."deleted_at" IS NULL OR "__new_transactions"."deleted_at" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z'))
);
--> statement-breakpoint
INSERT INTO `__new_transactions`("id", "type", "amount_minor", "currency", "account_id", "to_account_id", "category_id", "card_id", "occurred_at", "local_date", "description", "payee", "note", "source", "status", "external_ref", "created_at", "updated_at", "deleted_at") SELECT "id", "type", "amount_minor", "currency", "account_id", "to_account_id", "category_id", "card_id", "occurred_at", "local_date", "description", "payee", "note", "source", "status", "external_ref", "created_at", "updated_at", "deleted_at" FROM `transactions`;--> statement-breakpoint
DROP TABLE `transactions`;--> statement-breakpoint
ALTER TABLE `__new_transactions` RENAME TO `transactions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `transactions_local_date_idx` ON `transactions` (`local_date`,`occurred_at`) WHERE "transactions"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX `transactions_account_id_local_date_idx` ON `transactions` (`account_id`,`local_date`) WHERE "transactions"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX `transactions_to_account_id_idx` ON `transactions` (`to_account_id`) WHERE "transactions"."to_account_id" IS NOT NULL AND "transactions"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX `transactions_category_id_local_date_idx` ON `transactions` (`category_id`,`local_date`) WHERE "transactions"."category_id" IS NOT NULL AND "transactions"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX `transactions_card_id_idx` ON `transactions` (`card_id`) WHERE "transactions"."card_id" IS NOT NULL AND "transactions"."deleted_at" IS NULL;