

# Fix Infinite Recursion in RLS Policies

## Problem

The "Admins can read all profiles" policy on the `profiles` table contains a subquery that reads from `profiles` itself, causing PostgreSQL to enter infinite recursion when any query hits this table (including saving a trip, which triggers the admin check on `trips`).

## Solution

1. **Create a `user_roles` table** to store roles separately (security best practice -- avoids privilege escalation)
2. **Create a `has_role` security definer function** that bypasses RLS to check roles without recursion
3. **Drop and recreate the recursive policies** on both `profiles` and `trips` tables to use the new function
4. **Migrate existing admin users** from the `profiles.role` column into the new `user_roles` table
5. **Update application code** (`AuthContext.tsx`, `UserMenu.tsx`, etc.) to determine admin status via the `user_roles` table or the `has_role` function

## Technical Details

### Database Migration (SQL)

```sql
-- 1. Role enum and table
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 2. Security definer function (no recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

REVOKE EXECUTE ON FUNCTION public.has_role FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role TO authenticated;

-- 3. Migrate existing admins
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM public.profiles WHERE role = 'admin'
ON CONFLICT DO NOTHING;

-- 4. RLS on user_roles
CREATE POLICY "Users can read own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 5. Fix profiles policies
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- 6. Fix trips policies
DROP POLICY IF EXISTS "Admins can read all trips" ON public.trips;
CREATE POLICY "Admins can read all trips"
  ON public.trips FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
```

### Code Changes

**`src/contexts/AuthContext.tsx`**
- After fetching the profile, also query `user_roles` to check if the user has the `admin` role
- Replace `isAdmin: profile?.role === "admin"` with a check against the `user_roles` table result

**`src/hooks/useAuth.ts`**
- No changes needed (just re-exports context)

**`src/components/UserMenu.tsx`**
- No changes needed (already reads `isAdmin` from context)

**`src/pages/AdminDashboard.tsx`**
- May need minor updates if it references `profile.role` directly

