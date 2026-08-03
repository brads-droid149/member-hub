ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'promo';
UPDATE public.banners SET kind = 'promo' WHERE kind IS NULL;
CREATE INDEX IF NOT EXISTS banners_kind_idx ON public.banners (kind);