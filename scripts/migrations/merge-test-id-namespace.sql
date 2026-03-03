-- Merge legacy "-test" mastery IDs back to production IDs.
-- Strategy: latest `updated_at` wins when both prod/test rows exist.
-- Safety: this script never deletes source `-test` rows.

create table if not exists mastery_records_test_merge_backup (
  batch_id text not null,
  source_id text not null,
  target_id text not null,
  source_row jsonb not null,
  target_row jsonb,
  captured_at timestamptz not null default now(),
  keep_until timestamptz not null default (now() + interval '30 days'),
  primary key (batch_id, source_id)
);

create index if not exists idx_mastery_test_merge_backup_keep_until
  on mastery_records_test_merge_backup(keep_until);

create table if not exists mastery_records_test_merge_audit (
  batch_id text primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  keep_until timestamptz not null default (now() + interval '30 days'),
  total_test_rows integer not null default 0,
  mapped_rows integer not null default 0,
  conflict_rows integer not null default 0,
  inserted_rows integer not null default 0,
  updated_rows integer not null default 0,
  skipped_rows integer not null default 0,
  note text
);

DO $$
DECLARE
  v_batch_id text := to_char(clock_timestamp(), 'YYYYMMDD-HH24MISS-MS');
  v_src mastery_records%ROWTYPE;
  v_target mastery_records%ROWTYPE;
  v_target_id text;
  v_total integer := 0;
  v_mapped integer := 0;
  v_conflict integer := 0;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_skipped integer := 0;
  v_src_updated timestamptz;
  v_target_updated timestamptz;
  v_has_target boolean;
BEGIN
  insert into mastery_records_test_merge_audit(batch_id, note)
  values (v_batch_id, 'merge -test namespace into canonical IDs, latest updated_at wins');

  FOR v_src IN
    select *
    from mastery_records
    where id like '%-test'
    order by coalesce(updated_at, '1970-01-01'::timestamptz) asc, id asc
  LOOP
    v_total := v_total + 1;
    v_target_id := regexp_replace(v_src.id, '-test$', '');

    if v_target_id = '' or v_target_id = v_src.id then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    v_mapped := v_mapped + 1;

    select * into v_target from mastery_records where id = v_target_id;
    v_has_target := found;

    insert into mastery_records_test_merge_backup(
      batch_id,
      source_id,
      target_id,
      source_row,
      target_row
    ) values (
      v_batch_id,
      v_src.id,
      v_target_id,
      to_jsonb(v_src),
      case when v_has_target then to_jsonb(v_target) else null end
    );

    if not v_has_target then
      insert into mastery_records(
        id,
        history,
        temp_state,
        last_history_update_date,
        consecutive_green,
        last_practice_date,
        last_status,
        updated_at
      ) values (
        v_target_id,
        coalesce(v_src.history, '[]'::jsonb),
        coalesce(v_src.temp_state, '{}'::jsonb),
        v_src.last_history_update_date,
        coalesce(v_src.consecutive_green, 0),
        v_src.last_practice_date,
        v_src.last_status,
        coalesce(v_src.updated_at, now())
      )
      on conflict (id)
      do update set
        history = excluded.history,
        temp_state = excluded.temp_state,
        last_history_update_date = excluded.last_history_update_date,
        consecutive_green = excluded.consecutive_green,
        last_practice_date = excluded.last_practice_date,
        last_status = excluded.last_status,
        updated_at = excluded.updated_at;

      v_inserted := v_inserted + 1;
    else
      v_conflict := v_conflict + 1;
      v_src_updated := coalesce(v_src.updated_at, '1970-01-01'::timestamptz);
      v_target_updated := coalesce(v_target.updated_at, '1970-01-01'::timestamptz);

      if v_src_updated > v_target_updated then
        update mastery_records
        set
          history = coalesce(v_src.history, '[]'::jsonb),
          temp_state = coalesce(v_src.temp_state, '{}'::jsonb),
          last_history_update_date = v_src.last_history_update_date,
          consecutive_green = coalesce(v_src.consecutive_green, 0),
          last_practice_date = v_src.last_practice_date,
          last_status = v_src.last_status,
          updated_at = coalesce(v_src.updated_at, now())
        where id = v_target_id;

        v_updated := v_updated + 1;
      else
        v_skipped := v_skipped + 1;
      end if;
    end if;
  END LOOP;

  update mastery_records_test_merge_audit
  set
    finished_at = now(),
    total_test_rows = v_total,
    mapped_rows = v_mapped,
    conflict_rows = v_conflict,
    inserted_rows = v_inserted,
    updated_rows = v_updated,
    skipped_rows = v_skipped
  where batch_id = v_batch_id;

  raise notice 'merge-test-id done: batch=% total=% mapped=% conflict=% inserted=% updated=% skipped=%',
    v_batch_id, v_total, v_mapped, v_conflict, v_inserted, v_updated, v_skipped;
END $$;
