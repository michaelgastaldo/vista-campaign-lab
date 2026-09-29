-- Reattach the missing handle_new_user trigger. The function exists (security
-- definer, owned by postgres) but its trigger on auth.users was dropped, which
-- left new signups without a profile, organization, or seeded sample data.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();