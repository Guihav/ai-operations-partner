
revoke execute on function public.check_and_record_rate_limit(text, int, int) from public;
revoke execute on function public.check_and_record_rate_limit(text, int, int) from anon;
grant execute on function public.check_and_record_rate_limit(text, int, int) to authenticated;
