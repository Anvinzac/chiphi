-- Quick Admin device allowlist. Open recording until end of 18 Aug 2026 (Vietnam).
CREATE TABLE public.admin_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL UNIQUE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  enrolled_via text NOT NULL,
  user_agent text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_devices_user_id_idx ON public.admin_devices (user_id);
ALTER TABLE public.admin_devices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_devices FROM PUBLIC;
REVOKE ALL ON public.admin_devices FROM anon;
REVOKE ALL ON public.admin_devices FROM authenticated;
GRANT ALL ON public.admin_devices TO service_role;
CREATE OR REPLACE FUNCTION public.is_enrolled_admin_device(p_device_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_devices
    WHERE device_id = upper(trim(p_device_id))
  );
$$;
CREATE OR REPLACE FUNCTION public.touch_admin_device(
  p_device_id text,
  p_enrolled_via text,
  p_user_agent text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  open_until timestamptz := timestamptz '2026-08-19 00:00:00+07';
  token text := upper(trim(p_device_id));
  via text := coalesce(nullif(trim(p_enrolled_via), ''), 'visit');
  is_admin boolean;
  is_admin_login boolean;
BEGIN
  IF token IS NULL OR length(token) < 8 THEN
    RETURN false;
  END IF;
  is_admin := public.has_role(auth.uid(), 'admin');
  is_admin_login := EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
      AND email = 'admin@mise.local'
  );
  IF now() < open_until OR is_admin OR is_admin_login THEN
    INSERT INTO public.admin_devices (device_id, user_id, enrolled_via, user_agent)
    VALUES (token, auth.uid(), via, p_user_agent)
    ON CONFLICT (device_id) DO UPDATE SET
      last_seen_at = now(),
      user_id = COALESCE(EXCLUDED.user_id, public.admin_devices.user_id),
      user_agent = COALESCE(EXCLUDED.user_agent, public.admin_devices.user_agent);
    RETURN true;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.admin_devices WHERE device_id = token
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.is_enrolled_admin_device(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.touch_admin_device(text, text, text) TO anon, authenticated;