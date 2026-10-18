
ALTER TABLE public.access_users
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS unit_office text,
  ADD COLUMN IF NOT EXISTS phone text;
