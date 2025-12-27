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
const TOKEN_VALIDITY_MS = 15000;

const generateToken = () => `${crypto.randomUUID()}_${Date.now()}`;

const shouldRotateToken = (token: string | null, now: number): boolean => {
  if (!token) return true;
  const parts = token.split("_");
  const timestamp = Number.parseInt(parts[parts.length - 1] ?? "", 10);
  if (Number.isNaN(timestamp)) return true;
  return now - timestamp >= ROTATION_INTERVAL_MS;
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
      .select("id, is_active, event_id")
      .eq("event_id", eventId)
      .eq("token", token)
      .maybeSingle();

    if (linkError || !link?.is_active) {
      return new Response(
        JSON.stringify({ authorized: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Load event + verify moderation is enabled
    const { data: event, error: eventError } = await admin
      .from("events")
      .select("*")
      .eq("id", eventId)
      .maybeSingle();

    if (eventError || !event || !event.moderation_enabled) {
      return new Response(
        JSON.stringify({ authorized: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let nextEvent = event;
    const now = Date.now();
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
        .select("*")
        .eq("event_id", eventId)
        .order("recorded_at", { ascending: false })
        .range(0, 2000);

      if (attendanceError) {
        console.error("attendanceError", attendanceError);
        attendance = [];
      } else {
        attendance = attendanceData ?? [];
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
