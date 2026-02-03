ALTER TABLE public.events
  ADD COLUMN qr_host_device_id TEXT;

COMMENT ON COLUMN public.events.qr_host_device_id IS 'Device identifier currently hosting rotating QR codes.';
