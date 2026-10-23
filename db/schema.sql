-- GhostWatch schema. Idempotent: safe to run on every start.
-- Amounts are integer satoshis. Times are unix seconds from block headers.

-- Blocks the detector has processed. A block leaves the main chain when a
-- reorganization replaces it; its row stays, marked 'orphaned'.
create table if not exists blocks (
  hash          text primary key,
  height        integer not null,
  parent_hash   text not null,
  time          bigint not null,
  status        text not null default 'main' check (status in ('main', 'orphaned')),
  processed_at  timestamptz not null default now()
);
create index if not exists blocks_height_main on blocks (height) where status = 'main';

-- Cache of header times for old heights (used to date spent outputs).
create table if not exists block_times (
  height  integer primary key,
  hash    text not null,
  time    bigint not null
);

-- One event per spending transaction that spends at least one dormant output.
-- id is derived from the txid so the permalink survives a reorg and re-mine.
create table if not exists ghost_events (
  id                    text primary key,
  txid                  text not null unique,
  block_hash            text not null,
  block_height          integer not null,
  block_time            bigint not null,
  dormant_sats          bigint not null,
  dormant_input_count   integer not null,
  total_input_count     integer not null,
  output_count          integer not null,
  oldest_created_height integer not null,
  oldest_created_time   bigint not null,
  max_age_seconds       bigint not null,
  cohort                smallint not null check (cohort in (5, 10, 15)),
  origin                text not null check (origin in ('live', 'archive')),
  status                text not null default 'confirmed' check (status in ('confirmed', 'reversed')),
  detected_at           timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists ghost_events_recent on ghost_events (block_height desc, dormant_sats desc);

-- Every input of the spending transaction. qualifies=false rows are kept so the
-- event page can show which inputs were too new to count.
create table if not exists ghost_inputs (
  event_id        text not null references ghost_events(id) on delete cascade,
  input_index     integer not null,
  prev_txid       text not null,
  prev_vout       integer not null,
  created_height  integer not null,
  created_time    bigint not null,
  value_sats      bigint not null,
  script_type     text,
  qualifies       boolean not null,
  primary key (event_id, input_index)
);

-- Append-only history of status changes (confirmed, reversed, re-confirmed).
create table if not exists event_history (
  id          bigserial primary key,
  event_id    text not null references ghost_events(id) on delete cascade,
  from_status text,
  to_status   text not null,
  block_hash  text not null,
  note        text,
  at          timestamptz not null default now()
);

-- Progress per worker. heartbeat_at moves on every successful poll, even when
-- no new block arrived, so the UI can tell "quiet" from "stopped".
create table if not exists worker_checkpoints (
  worker_name     text primary key,
  last_height     integer,
  last_hash       text,
  observed_tip    integer,
  heartbeat_at    timestamptz,
  last_error      text,
  last_error_at   timestamptz,
  updated_at      timestamptz not null default now()
);

-- Outbound notifications. kind='correction' is sent when a published event is reversed.
-- 'sending' is set before the API call; a row left in 'sending' after a crash is
-- never retried automatically (delivery unknown), so a restart can't double-post.
create table if not exists notifications (
  event_id            text not null references ghost_events(id) on delete cascade,
  channel             text not null,
  kind                text not null check (kind in ('new', 'correction')),
  status              text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'cancelled')),
  attempts            integer not null default 0,
  external_message_id text,
  last_error          text,
  updated_at          timestamptz not null default now(),
  primary key (event_id, channel, kind)
);

-- Last good copies of slow third-party data (for example the node snapshot), so a
-- restart or an outage at the source shows the last known state instead of nothing.
-- Aggregates only: the node snapshot stored here has no addresses or providers.
create table if not exists app_cache (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);
