CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Drafts already have a share_token; allow seller preview before "Link & QR".
-- PIN check hashes the same way the client does: SHA-256("mise-order-pin:" || pin).

CREATE OR REPLACE FUNCTION public.get_shared_order(p_token TEXT)
RETURNS TABLE (id UUID, title TEXT, status TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.title, o.status, o.created_at, o.updated_at
  FROM public.orders o
  WHERE o.share_token = p_token
    AND o.status IN ('draft', 'shared', 'closed')
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.verify_order_pin(p_token TEXT, p_pin TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.share_token = p_token
      AND o.status IN ('draft', 'shared', 'closed')
      AND o.supplier_pin_hash = encode(digest('mise-order-pin:' || btrim(p_pin), 'sha256'), 'hex')
  );
$$;

CREATE OR REPLACE FUNCTION public.get_shared_order_items(p_token TEXT)
RETURNS SETOF public.order_items
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.*
  FROM public.order_items i
  INNER JOIN public.orders o ON o.id = i.order_id
  WHERE o.share_token = p_token
    AND o.status IN ('draft', 'shared', 'closed')
  ORDER BY i.sort_order ASC, i.created_at ASC;
$$;

CREATE OR REPLACE FUNCTION public.update_shared_order_item(
  p_token TEXT,
  p_item_id UUID,
  p_retail_price NUMERIC,
  p_fulfilled_qty NUMERIC,
  p_status TEXT,
  p_notice TEXT
)
RETURNS public.order_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated public.order_items;
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('pending', 'partial', 'done') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;

  UPDATE public.order_items i
  SET retail_price = p_retail_price,
      fulfilled_qty = p_fulfilled_qty,
      status = p_status,
      notice = p_notice,
      updated_at = now()
  FROM public.orders o
  WHERE i.id = p_item_id
    AND i.order_id = o.id
    AND o.share_token = p_token
    AND o.status IN ('draft', 'shared')
  RETURNING i.* INTO updated;

  IF updated.id IS NULL THEN
    RAISE EXCEPTION 'order item not found or not editable';
  END IF;

  RETURN updated;
END;
$$;
