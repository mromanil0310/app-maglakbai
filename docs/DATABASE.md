# SkillForge — Database Schema (Supabase / PostgreSQL)

**Status:** Live — project `wovceouygyobczkkeyxy.supabase.co` (implemented sprint 39, ARCH-001).

All tables use Supabase with Row Level Security (RLS). Auth is handled by `supabase.auth`.

> **RLS note:** The initial schema had `profiles`, `outputs`, and `milestones` as publicly readable.
> These were tightened to owner-only after pilot launch to protect user privacy.
> Feed tables (`feed_posts`, `reactions`, `comments`) remain public-read — ready for Phase 2 social feed.
> See the corrected policies below.

---

## Generate Types

After running migrations, regenerate TypeScript types:

```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > lib/database.types.ts
```

---

## Tables

### `profiles`
Extends Supabase auth.users. Created automatically via trigger on signup.

```sql
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      text unique not null,
  display_name  text not null,
  avatar_url    text,
  bio           text,
  career_path   text not null,           -- 'data-architect' | 'ai-engineer'
  current_level int not null default 1,
  total_xp      int not null default 0,
  streak_days   int not null default 0,
  streak_last_logged_at timestamptz,
  followers_count int not null default 0,
  following_count int not null default 0,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name, career_path)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)),
    coalesce(new.raw_user_meta_data->>'display_name', 'New User'),
    coalesce(new.raw_user_meta_data->>'career_path', 'data-architect')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

**RLS:**
```sql
alter table public.profiles enable row level security;

-- Owner-only read (tightened post-launch for user privacy)
create policy "Users can read own profile" on public.profiles
  for select using (auth.uid() = id);

-- Users can only update their own profile
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);
```

---

### `skill_progress`
Tracks a user's progress on each skill node in their career path.

```sql
create table public.skill_progress (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  skill_id    text not null,             -- e.g. 'sql-foundations'
  career_path text not null,             -- e.g. 'data-architect'
  status      text not null default 'locked',  -- 'locked' | 'in_progress' | 'completed'
  outputs_count int not null default 0,  -- how many outputs logged for this skill
  xp_earned   int not null default 0,
  started_at  timestamptz,
  completed_at timestamptz,
  created_at  timestamptz default now(),
  unique(user_id, skill_id)
);
```

**RLS:**
```sql
alter table public.skill_progress enable row level security;

create policy "Users can read own skill progress" on public.skill_progress
  for select using (auth.uid() = user_id);

create policy "Users can insert own skill progress" on public.skill_progress
  for insert with check (auth.uid() = user_id);

create policy "Users can update own skill progress" on public.skill_progress
  for update using (auth.uid() = user_id);
```

---

### `outputs`
The core table. Every logged proof-of-work item.

```sql
create table public.outputs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  skill_id    text not null,
  career_path text not null,
  type        text not null,    -- 'project' | 'book' | 'certification' | 'script' | 'design' | 'github'
  title       text not null,
  description text,
  link        text,
  xp_earned   int not null default 0,
  created_at  timestamptz default now()
);

create index outputs_user_id_idx on public.outputs(user_id);
create index outputs_skill_id_idx on public.outputs(skill_id);
create index outputs_created_at_idx on public.outputs(created_at desc);
```

**RLS:**
```sql
alter table public.outputs enable row level security;

-- Owner-only read (tightened post-launch for user privacy)
create policy "Users can read own outputs" on public.outputs
  for select using (auth.uid() = user_id);

create policy "Users can insert own outputs" on public.outputs
  for insert with check (auth.uid() = user_id);

create policy "Users can delete own outputs" on public.outputs
  for delete using (auth.uid() = user_id);
```

---

### `milestones`
Earned milestone records. One row per unlocked achievement.

```sql
create table public.milestones (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  skill_id    text not null,
  career_path text not null,
  title       text not null,
  description text,
  rarity      text not null default 'common',  -- 'common' | 'uncommon' | 'rare' | 'legendary'
  xp_earned   int not null default 0,
  icon        text,
  shared_at   timestamptz,          -- null = not yet shared to feed
  created_at  timestamptz default now(),
  unique(user_id, skill_id)
);

create index milestones_user_id_idx on public.milestones(user_id);
```

**RLS:**
```sql
alter table public.milestones enable row level security;

-- Owner-only read (tightened post-launch for user privacy)
create policy "Users can read own milestones" on public.milestones
  for select using (auth.uid() = user_id);

create policy "Users can insert own milestones" on public.milestones
  for insert with check (auth.uid() = user_id);

create policy "Users can update own milestones" on public.milestones
  for update using (auth.uid() = user_id);
```

---

### `feed_posts`
Social feed entries. Created when a user shares a milestone.

```sql
create table public.feed_posts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  milestone_id    uuid references public.milestones(id) on delete set null,
  content         text not null,        -- the post body (AI-generated or edited)
  reactions_count int not null default 0,
  comments_count  int not null default 0,
  reposts_count   int not null default 0,
  created_at      timestamptz default now()
);

create index feed_posts_created_at_idx on public.feed_posts(created_at desc);
create index feed_posts_user_id_idx on public.feed_posts(user_id);
```

**RLS:**
```sql
alter table public.feed_posts enable row level security;

create policy "Feed posts are public" on public.feed_posts
  for select using (true);

create policy "Users can insert own posts" on public.feed_posts
  for insert with check (auth.uid() = user_id);

create policy "Users can delete own posts" on public.feed_posts
  for delete using (auth.uid() = user_id);
```

---

### `reactions`
Tracks ⚡ reactions on feed posts. One row per user per post.

```sql
create table public.reactions (
  id       uuid primary key default gen_random_uuid(),
  post_id  uuid not null references public.feed_posts(id) on delete cascade,
  user_id  uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(post_id, user_id)
);

create index reactions_post_id_idx on public.reactions(post_id);
```

**RLS:**
```sql
alter table public.reactions enable row level security;

create policy "Reactions are public" on public.reactions
  for select using (true);

create policy "Users can insert own reactions" on public.reactions
  for insert with check (auth.uid() = user_id);

create policy "Users can delete own reactions" on public.reactions
  for delete using (auth.uid() = user_id);
```

---

### `comments`
Comments on feed posts.

```sql
create table public.comments (
  id       uuid primary key default gen_random_uuid(),
  post_id  uuid not null references public.feed_posts(id) on delete cascade,
  user_id  uuid not null references public.profiles(id) on delete cascade,
  content  text not null,
  created_at timestamptz default now()
);

create index comments_post_id_idx on public.comments(post_id);
```

**RLS:**
```sql
alter table public.comments enable row level security;

create policy "Comments are public" on public.comments
  for select using (true);

create policy "Users can insert own comments" on public.comments
  for insert with check (auth.uid() = user_id);

create policy "Users can delete own comments" on public.comments
  for delete using (auth.uid() = user_id);
```

---

### `follows`
Follow relationships between users.

```sql
create table public.follows (
  follower_id  uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create index follows_follower_idx on public.follows(follower_id);
create index follows_following_idx on public.follows(following_id);
```

**RLS:**
```sql
alter table public.follows enable row level security;

create policy "Follows are public" on public.follows
  for select using (true);

create policy "Users can follow others" on public.follows
  for insert with check (auth.uid() = follower_id);

create policy "Users can unfollow" on public.follows
  for delete using (auth.uid() = follower_id);
```

---

## Database Functions

### `log_output_and_update_xp`
Atomic function: inserts output, updates XP, checks for milestone unlock.

```sql
create or replace function public.log_output_and_update_xp(
  p_user_id     uuid,
  p_skill_id    text,
  p_career_path text,
  p_type        text,
  p_title       text,
  p_description text,
  p_link        text,
  p_xp          int
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_output_id    uuid;
  v_total_xp     int;
  v_outputs_count int;
  v_milestone_unlocked boolean := false;
begin
  -- Insert the output
  insert into public.outputs (user_id, skill_id, career_path, type, title, description, link, xp_earned)
  values (p_user_id, p_skill_id, p_career_path, p_type, p_title, p_description, p_link, p_xp)
  returning id into v_output_id;

  -- Update total XP on profile
  update public.profiles
  set total_xp = total_xp + p_xp, updated_at = now()
  where id = p_user_id
  returning total_xp into v_total_xp;

  -- Upsert skill_progress
  insert into public.skill_progress (user_id, skill_id, career_path, status, outputs_count, xp_earned, started_at)
  values (p_user_id, p_skill_id, p_career_path, 'in_progress', 1, p_xp, now())
  on conflict (user_id, skill_id) do update
  set outputs_count = skill_progress.outputs_count + 1,
      xp_earned     = skill_progress.xp_earned + p_xp,
      status        = case when skill_progress.status = 'locked' then 'in_progress' else skill_progress.status end,
      started_at    = coalesce(skill_progress.started_at, now());

  -- Return result for client to check milestone logic
  select outputs_count into v_outputs_count
  from public.skill_progress
  where user_id = p_user_id and skill_id = p_skill_id;

  return jsonb_build_object(
    'output_id',      v_output_id,
    'total_xp',       v_total_xp,
    'xp_earned',      p_xp,
    'outputs_count',  v_outputs_count,
    'skill_id',       p_skill_id
  );
end;
$$;
```

---

## Key Indexes Summary

```sql
-- Performance indexes
create index outputs_user_skill_idx on public.outputs(user_id, skill_id);
create index feed_posts_feed_idx on public.feed_posts(created_at desc, user_id);
create index milestones_shared_idx on public.milestones(shared_at desc) where shared_at is not null;
```

---

## Realtime

Enable Realtime on the `feed_posts` and `reactions` tables in the Supabase dashboard so the feed updates live without polling.
