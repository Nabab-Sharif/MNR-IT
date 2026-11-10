ALTER TABLE public.sticker_print_history ADD COLUMN IF NOT EXISTS po_no text;
COMMENT ON COLUMN public.sticker_print_history.po_no IS 'PO / Style number for the print run';