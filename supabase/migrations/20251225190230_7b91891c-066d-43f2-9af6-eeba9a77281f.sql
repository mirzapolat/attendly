-- Fix 1: Add DELETE policy for attendance_records
CREATE POLICY "Admins can delete attendance for their events" 
ON public.attendance_records
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.events 
    WHERE events.id = attendance_records.event_id 
      AND events.admin_id = auth.uid()
  )
);

-- Fix 2: Add database constraints for input validation
ALTER TABLE public.attendance_records
ADD CONSTRAINT valid_email CHECK (attendee_email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
ADD CONSTRAINT valid_name_length CHECK (LENGTH(attendee_name) >= 2 AND LENGTH(attendee_name) <= 100),
ADD CONSTRAINT valid_latitude CHECK (location_lat IS NULL OR (location_lat >= -90 AND location_lat <= 90)),
ADD CONSTRAINT valid_longitude CHECK (location_lng IS NULL OR (location_lng >= -180 AND location_lng <= 180));

-- Fix 3: Improve handle_new_user function with explicit checks
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate this is actually a new user creation
  IF NEW.id IS NULL OR NEW.email IS NULL THEN
    RAISE EXCEPTION 'Invalid user data';
  END IF;
  
  -- Prevent duplicate profile creation
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;
  
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Admin')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;