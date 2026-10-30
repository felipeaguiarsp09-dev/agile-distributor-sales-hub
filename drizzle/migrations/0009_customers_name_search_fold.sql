CREATE OR REPLACE FUNCTION public.search_fold(t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
STRICT
AS $$
  SELECT translate(lower(t),
    'áàâãäåéèêëíìîïóòôõöúùûüçñýÿÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑÝ',
    'aaaaaaeeeeiiiiooooouuuucnyyAAAAAAEEEEIIIIOOOOOUUUUCNY');
$$;

ALTER TABLE public.customers
  ADD COLUMN name_search text
  GENERATED ALWAYS AS (public.search_fold(name)) STORED;

GRANT EXECUTE ON FUNCTION public.search_fold(text) TO anon, authenticated, service_role;
