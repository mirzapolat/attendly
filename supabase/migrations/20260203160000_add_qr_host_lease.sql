ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS qr_host_device_id TEXT,
  ADD COLUMN IF NOT EXISTS qr_host_lease_expires_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.events.qr_host_device_id IS 'Device identifier currently hosting rotating QR codes.';
COMMENT ON COLUMN public.events.qr_host_lease_expires_at IS 'Lease expiry for current QR host device.';
