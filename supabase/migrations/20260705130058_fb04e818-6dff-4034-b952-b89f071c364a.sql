ALTER TABLE public.sticker_transactions DROP CONSTRAINT IF EXISTS sticker_transactions_buyer_id_fkey;
ALTER TABLE public.sticker_transactions ALTER COLUMN buyer_id TYPE text USING buyer_id::text;
ALTER TABLE public.sticker_buyers ALTER COLUMN id TYPE text USING id::text;