import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ModeratorStateRequest = {
  eventId?: string;
  token?: string;
  includeAttendance?: boolean;
};

const ROTATION_INTERVAL_MS = 3000;

const generateToken = () => `${crypto.randomUUID()}_${Date.now()}`;

const shouldRotateToken = (token: string | null, now: number): boolean => {
  if (!token) return true;
  const parts = token.split("_");
  const timestamp = Number.parseInt(parts[parts.length - 1] ?? "", 10);
  if (Number.isNaN(timestamp)) return true;
  return now - timestamp >= ROTATION_INTERVAL_MS;
};

const isLinkExpired = (expiresAt: string | null, now: number): boolean => {
  if (!expiresAt) return false;
  const expiresMs = Date.parse(expiresAt);
  if (Number.isNaN(expiresMs)) return true;
  return now >= expiresMs;
};

const sanitizeAttendance = (
  rows: {
    id: string;
    attendee_name: string;
    attendee_email: string | null;
    status: string | null;
    suspicious_reason: string | null;
    location_provided: boolean | null;
    location_lat: number | null;
    location_lng: number | null;
    recorded_at: string | null;
  }[],
  options: { showFullName: boolean; showEmail: boolean },
) => {
  return rows.map((row) => {
    const next = { ...row };
    if (!options.showFullName) {
      const firstName = row.attendee_name.split(" ")[0] || row.attendee_name;
      next.attendee_name = firstName;
    }
    if (!options.showEmail) {
      next.attendee_email = null;
    }
    return next;
  });
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { eventId, token, includeAttendance = true } =
      (await req.json().catch(() => ({}))) as ModeratorStateRequest;

    if (!eventId || !token) {
      return new Response(
        JSON.stringify({ authorized: false, error: "Missing eventId or token" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!url || !serviceKey) {
      throw new Error("Backend credentials are not configured");
    }

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false },
    });

    // Validate moderation link
    const { data: link, error: linkError } = await admin
      .from("moderation_links")
      .select("id, is_active, event_id, expires_at")
      .eq("event_id", eventId)
      .eq("token", token)
      .maybeSingle();

    const now = Date.now();
    if (linkError || !link?.is_active || isLinkExpired(link.expires_at, now)) {
      return new Response(
        JSON.stringify({ authorized: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Load event + verify moderation is enabled
    const { data: event, error: eventError } = await admin
      .from("events")
      .select(
        [
          "id",
          "name",
          "description",
          "event_date",
          "location_name",
          "location_lat",
          "location_lng",
          "location_radius_meters",
          "is_active",
          "current_qr_token",
          "qr_token_expires_at",
          "rotating_qr_enabled",
          "moderation_enabled",
          "moderator_show_full_name",
          "moderator_show_email",
        ].join(","),
      )
      .eq("id", eventId)
      .maybeSingle();

    if (eventError || !event || !event.moderation_enabled) {
      return new Response(
        JSON.stringify({ authorized: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let nextEvent = event;
    if (event.is_active && event.rotating_qr_enabled && shouldRotateToken(event.current_qr_token, now)) {
      const { data: rotatedEvent, error: rotateError } = await admin
        .from("events")
        .update({
          current_qr_token: generateToken(),
          qr_token_expires_at: new Date(now + TOKEN_VALIDITY_MS).toISOString(),
        })
        .eq("id", eventId)
        .select("*")
        .maybeSingle();

      if (rotateError) {
        console.error("moderator-state rotation error", rotateError);
      } else if (rotatedEvent) {
        nextEvent = rotatedEvent;
      }
    }

    let attendance: unknown[] | undefined = undefined;

    if (includeAttendance) {
      const { data: attendanceData, error: attendanceError } = await admin
        .from("attendance_records")
        .select(
          [
            "id",
            "attendee_name",
            "attendee_email",
            "status",
            "suspicious_reason",
            "location_provided",
            "location_lat",
            "location_lng",
            "recorded_at",
          ].join(","),
        )
        .eq("event_id", eventId)
        .order("recorded_at", { ascending: false })
        .range(0, 2000);

      if (attendanceError) {
        console.error("attendanceError", attendanceError);
        attendance = [];
      } else {
        const sanitized = sanitizeAttendance(attendanceData ?? [], {
          showFullName: !!nextEvent.moderator_show_full_name,
          showEmail: !!nextEvent.moderator_show_email,
        });
        attendance = sanitized;
      }
    }

    return new Response(
      JSON.stringify({ authorized: true, event: nextEvent, attendance }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("moderator-state error", error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ authorized: false, error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
