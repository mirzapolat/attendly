import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FORM_TIME_LIMIT_MS = 2 * 60 * 1000;
const TOKEN_VALIDITY_MS = 15000;

type AttendanceStartRequest = {
  eventId?: string;
  token?: string | null;
};

const isTokenExpired = (token: string, now: number): boolean => {
  const parts = token.split("_");
  const timestamp = Number.parseInt(parts[parts.length - 1] ?? "", 10);
  if (Number.isNaN(timestamp)) return true;
  return now - timestamp > TOKEN_VALIDITY_MS;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { eventId, token } =
      (await req.json().catch(() => ({}))) as AttendanceStartRequest;

    if (!eventId) {
      return new Response(
        JSON.stringify({ authorized: false, reason: "invalid_request" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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

    const { data: event, error: eventError } = await admin
      .from("events")
      .select(
        [
          "id",
          "admin_id",
          "name",
          "event_date",
          "location_name",
          "location_lat",
          "location_lng",
          "location_radius_meters",
          "is_active",
          "rotating_qr_enabled",
          "device_fingerprint_enabled",
          "location_check_enabled",
          "current_qr_token",
          "qr_token_expires_at",
        ].join(","),
      )
      .eq("id", eventId)
      .maybeSingle();

    if (eventError || !event) {
      return new Response(
        JSON.stringify({ authorized: false, reason: "not_found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!event.is_active) {
      return new Response(
        JSON.stringify({ authorized: false, reason: "inactive" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const now = Date.now();
    const providedToken = token ?? null;

    if (event.rotating_qr_enabled) {
      if (!providedToken || providedToken !== event.current_qr_token) {
        return new Response(
          JSON.stringify({ authorized: false, reason: "expired" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (event.qr_token_expires_at) {
        const expiresAt = Date.parse(event.qr_token_expires_at);
        if (Number.isNaN(expiresAt) || now > expiresAt) {
          return new Response(
            JSON.stringify({ authorized: false, reason: "expired" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      } else if (isTokenExpired(providedToken, now)) {
        return new Response(
          JSON.stringify({ authorized: false, reason: "expired" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    } else {
      if (providedToken !== "static") {
        return new Response(
          JSON.stringify({ authorized: false, reason: "expired" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const expiresAt = new Date(now + FORM_TIME_LIMIT_MS).toISOString();
    const { data: session, error: sessionError } = await admin
      .from("attendance_sessions")
      .insert({
        event_id: event.id,
        token: providedToken ?? "static",
        expires_at: expiresAt,
      })
      .select("id, expires_at")
      .maybeSingle();

    if (sessionError || !session) {
      console.error("attendance-start session error", sessionError);
      return new Response(
        JSON.stringify({ authorized: false, reason: "server_error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("theme_color")
      .eq("id", event.admin_id)
      .maybeSingle();

    return new Response(
      JSON.stringify({
        authorized: true,
        sessionId: session.id,
        sessionExpiresAt: session.expires_at,
        event: {
          id: event.id,
          admin_id: event.admin_id,
          name: event.name,
          event_date: event.event_date,
          location_name: event.location_name,
          location_lat: event.location_lat,
          location_lng: event.location_lng,
          location_radius_meters: event.location_radius_meters,
          is_active: event.is_active,
          rotating_qr_enabled: event.rotating_qr_enabled,
          device_fingerprint_enabled: event.device_fingerprint_enabled,
          location_check_enabled: event.location_check_enabled,
          theme_color: profile?.theme_color ?? "default",
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("attendance-start error", error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ authorized: false, reason: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
