CREATE TABLE `basket_items` (
	`id` text PRIMARY KEY NOT NULL,
	`basket_id` text NOT NULL,
	`candidate_id` text NOT NULL,
	`quantity` real NOT NULL,
	`line_price_pence` integer NOT NULL,
	FOREIGN KEY (`basket_id`) REFERENCES `baskets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`candidate_id`) REFERENCES `product_candidates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `basket_items_basket_idx` ON `basket_items` (`basket_id`);--> statement-breakpoint
CREATE TABLE `baskets` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`provider_basket_id` text NOT NULL,
	`total_pence` integer NOT NULL,
	`item_count` integer NOT NULL,
	`idempotency_key` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `baskets_run_idx` ON `baskets` (`run_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `baskets_idem_idx` ON `baskets` (`idempotency_key`);--> statement-breakpoint
CREATE TABLE `checkout_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`basket_id` text NOT NULL,
	`provider_session_id` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`consent_json` text NOT NULL,
	`approval_token_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`finalized_at` integer,
	FOREIGN KEY (`basket_id`) REFERENCES `baskets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `checkout_sessions_basket_idx` ON `checkout_sessions` (`basket_id`);--> statement-breakpoint
CREATE TABLE `images` (
	`id` text PRIMARY KEY NOT NULL,
	`sha256` text NOT NULL,
	`mime` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`storage_path` text NOT NULL,
	`uploaded_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `images_sha256_idx` ON `images` (`sha256`);--> statement-breakpoint
CREATE TABLE `policy_results` (
	`id` text PRIMARY KEY NOT NULL,
	`basket_id` text NOT NULL,
	`ok` integer NOT NULL,
	`requires_explicit_approval` integer DEFAULT false NOT NULL,
	`total_cost_pence` integer NOT NULL,
	`flags_json` text DEFAULT '[]' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`basket_id`) REFERENCES `baskets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `policy_results_basket_idx` ON `policy_results` (`basket_id`);--> statement-breakpoint
CREATE TABLE `product_candidates` (
	`id` text PRIMARY KEY NOT NULL,
	`intent_id` text NOT NULL,
	`provider_product_id` text NOT NULL,
	`name` text NOT NULL,
	`price_pence` integer NOT NULL,
	`unit` text NOT NULL,
	`thumbnail_url` text,
	`score` real NOT NULL,
	`is_selected` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`intent_id`) REFERENCES `product_intents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `product_candidates_intent_idx` ON `product_candidates` (`intent_id`);--> statement-breakpoint
CREATE TABLE `product_intents` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`original_text` text NOT NULL,
	`canonical_name` text NOT NULL,
	`quantity` real NOT NULL,
	`unit` text NOT NULL,
	`category` text NOT NULL,
	`confidence` real NOT NULL,
	`needs_clarification` integer DEFAULT false NOT NULL,
	`clarification_reason` text,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `product_intents_run_idx` ON `product_intents` (`run_id`);--> statement-breakpoint
CREATE TABLE `raw_extractions` (
	`id` text PRIMARY KEY NOT NULL,
	`image_id` text NOT NULL,
	`provider_name` text NOT NULL,
	`raw_text` text NOT NULL,
	`confidence` real NOT NULL,
	`raw_provider_response_json` text,
	`extracted_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`image_id`) REFERENCES `images`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`image_id` text NOT NULL,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`trigger_run_id` text,
	`approval_token_id` text,
	`correlation_id` text NOT NULL,
	`failure_step` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`image_id`) REFERENCES `images`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `runs_correlation_idx` ON `runs` (`correlation_id`);--> statement-breakpoint
CREATE INDEX `runs_status_idx` ON `runs` (`status`);--> statement-breakpoint
CREATE TABLE `user_consents` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`decided_by` text NOT NULL,
	`approved` integer NOT NULL,
	`reason` text,
	`decided_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `workflow_events` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`step` text NOT NULL,
	`status` text NOT NULL,
	`attempt` integer DEFAULT 1 NOT NULL,
	`correlation_id` text NOT NULL,
	`payload_json` text,
	`error_json` text,
	`timestamp` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `workflow_events_run_idx` ON `workflow_events` (`run_id`);--> statement-breakpoint
CREATE INDEX `workflow_events_run_ts_idx` ON `workflow_events` (`run_id`,`timestamp`);