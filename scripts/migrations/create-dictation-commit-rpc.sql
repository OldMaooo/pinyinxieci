-- Zero-loss dictation commit pipeline
-- 1) Add commit audit/idempotency table
-- 2) Add transactional RPC that updates mastery_records with deterministic rules

create table if not exists dictation_commits (
  commit_id uuid primary key,
  status text not null check (status in ('pending', 'applied', 'failed')),
  payload_hash text not null,
  payload jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  error_message text
);

alter table dictation_commits enable row level security;

drop policy if exists "Allow all access to dictation commits" on dictation_commits;
create policy "Allow all access to dictation commits"
on dictation_commits
for all
using (true)
with check (true);

create or replace function commit_dictation_results(
  p_commit_id uuid,
  p_today date,
  p_items jsonb,
  p_context jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_commit dictation_commits%rowtype;
  v_item jsonb;
  v_id text;
  v_mark_practice text;
  v_mark_self text;
  v_mark_final text;
  v_step int;
  v_current_result text;
  v_history jsonb;
  v_last_update date;
  v_consecutive int;
  v_last_practice date;
  v_updated_count int := 0;
  v_applied_ids text[] := array[]::text[];
  v_existing_ids text[] := array[]::text[];
  v_history_len int;
begin
  if p_commit_id is null then
    return jsonb_build_object('ok', false, 'duplicate', false, 'error', 'missing commit_id', 'updated_count', 0, 'applied_ids', '[]'::jsonb);
  end if;

  if p_today is null then
    return jsonb_build_object('ok', false, 'duplicate', false, 'error', 'missing p_today', 'updated_count', 0, 'applied_ids', '[]'::jsonb);
  end if;

  select * into v_commit from dictation_commits where commit_id = p_commit_id for update;

  if found and v_commit.status = 'applied' then
    select coalesce(array_agg(x.id), array[]::text[]) into v_existing_ids
    from (
      select (item->>'id') as id
      from jsonb_array_elements(coalesce(v_commit.payload, '[]'::jsonb)) as item
      where coalesce(item->>'id', '') <> ''
    ) as x;

    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'updated_count', coalesce(array_length(v_existing_ids, 1), 0),
      'applied_ids', to_jsonb(v_existing_ids)
    );
  end if;

  if not found then
    insert into dictation_commits(commit_id, status, payload_hash, payload)
    values (p_commit_id, 'pending', md5(coalesce(p_items::text, '[]')), coalesce(p_items, '[]'::jsonb));
  else
    update dictation_commits
    set status = 'pending',
        payload_hash = md5(coalesce(p_items::text, '[]')),
        payload = coalesce(p_items, '[]'::jsonb),
        error_message = null
    where commit_id = p_commit_id;
  end if;

  for v_item in
    select value
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_id := trim(coalesce(v_item->>'id', ''));
    if v_id = '' then
      continue;
    end if;

    v_mark_practice := coalesce(v_item->>'mark_practice', 'white');
    v_mark_self := coalesce(v_item->>'mark_self', 'white');
    v_mark_final := coalesce(v_item->>'mark_final', 'white');
    v_step := coalesce((v_item->>'step')::int, 0);

    if v_step = 2 then
      v_current_result := v_mark_final;
    else
      v_current_result := v_mark_self;
    end if;

    if v_current_result <> 'red' then
      v_current_result := 'green';
    end if;

    select history, last_history_update_date, consecutive_green, last_practice_date
    into v_history, v_last_update, v_consecutive, v_last_practice
    from mastery_records
    where id = v_id
    for update;

    v_history := coalesce(v_history, '[]'::jsonb);
    v_consecutive := coalesce(v_consecutive, 0);
    if v_last_practice is distinct from p_today then
      v_history := v_history || to_jsonb(v_current_result);
      v_history_len := jsonb_array_length(v_history);
      if v_history_len > 10 then
        select coalesce(jsonb_agg(elem order by ord), '[]'::jsonb)
        into v_history
        from (
          select elem, ord
          from jsonb_array_elements(v_history) with ordinality as t(elem, ord)
          where ord > v_history_len - 10
        ) as sliced;
      end if;

      v_last_update := p_today;
      v_last_practice := p_today;

      if v_current_result = 'green' then
        v_consecutive := v_consecutive + 1;
      else
        v_consecutive := 0;
      end if;
    else
      v_history_len := jsonb_array_length(v_history);
      if v_current_result = 'red' and v_history_len > 0 then
        v_history := jsonb_set(v_history, array[(v_history_len - 1)::text], to_jsonb('red'::text), false);
        v_consecutive := 0;
      end if;
    end if;

    insert into mastery_records (
      id,
      history,
      temp_state,
      last_history_update_date,
      consecutive_green,
      last_practice_date,
      last_status,
      updated_at
    ) values (
      v_id,
      v_history,
      jsonb_build_object('practice', v_mark_practice, 'self', v_mark_self, 'final', v_mark_final),
      v_last_update,
      v_consecutive,
      v_last_practice,
      v_current_result,
      now()
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

    v_updated_count := v_updated_count + 1;
    v_applied_ids := array_append(v_applied_ids, v_id);
  end loop;

  update dictation_commits
  set status = 'applied',
      payload_hash = md5(coalesce(p_items::text, '[]')),
      payload = coalesce(p_items, '[]'::jsonb),
      applied_at = now(),
      error_message = null
  where commit_id = p_commit_id;

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'updated_count', v_updated_count,
    'applied_ids', to_jsonb(v_applied_ids)
  );
exception
  when others then
    update dictation_commits
    set status = 'failed',
        payload_hash = md5(coalesce(p_items::text, '[]')),
        payload = coalesce(p_items, '[]'::jsonb),
        error_message = sqlerrm
    where commit_id = p_commit_id;

    return jsonb_build_object(
      'ok', false,
      'duplicate', false,
      'error', sqlerrm,
      'updated_count', v_updated_count,
      'applied_ids', to_jsonb(v_applied_ids)
    );
end;
$$;

grant execute on function commit_dictation_results(uuid, date, jsonb, jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
