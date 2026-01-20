import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
};

const FORM_TIME_LIMIT_MS = 2 * 60 * 1000;
const TOKEN_GRACE_MS = 10 * 1000;

type AttendanceStartRequest = {
  eventId?: string;
  token?: string | null;
  deviceFingerprint?: string;
};

const getTokenAgeMs = (token: string, now: number): number | null => {
  const parts = token.split("_");
  const timestamp = Number.parseInt(parts[parts.length - 1] ?? "", 10);
  if (Number.isNaN(timestamp)) return null;
  return now - timestamp;
};

const isTokenWithinGrace = (token: string, now: number): boolean => {
  const age = getTokenAgeMs(token, now);
  if (age === null || age < 0) return false;
  return age <= TOKEN_GRACE_MS;
};

const respond = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), { status, headers: jsonHeaders });

const isSchemaError = (error: { code?: string; message?: string } | null): boolean => {
  if (!error) return false;
  const message = error.message ?? "";
  return (
    error.code === "42P01" ||
    error.code === "42703" ||
    message.includes("column") ||
    message.includes("relation")
  );
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { eventId, token, deviceFingerprint } =
      (await req.json().catch(() => ({}))) as AttendanceStartRequest;

    if (!eventId) {
      return respond({ authorized: false, reason: "invalid_request" }, 400);
    }

    const url =
      Deno.env.get("SUPABASE_URL") ?? Deno.env.get("ATTENDLY_SUPABASE_URL");
    const serviceKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
      Deno.env.get("ATTENDLY_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) {
      throw new Error(
        "Backend credentials are not configured. Set ATTENDLY_SUPABASE_URL and ATTENDLY_SERVICE_ROLE_KEY.",
      );
    }

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false },
    });

    const { data: event, error: eventError } = await admin
      .from("events")
      .select(
        [
          "id",
          "workspace_id",
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

    if (eventError) {
      console.error("attendance-start event error", eventError);
      return respond(
        {
          authorized: false,
          reason: isSchemaError(eventError) ? "missing_migrations" : "not_found",
        },
        500,
      );
    }

    if (!event) {
      return respond({ authorized: false, reason: "not_found" });
    }

    if (!event.is_active) {
      return respond({ authorized: false, reason: "inactive" });
    }

    const normalizedFingerprint = deviceFingerprint?.trim() ?? "";
    if (event.device_fingerprint_enabled) {
      if (!normalizedFingerprint) {
        return respond({ authorized: false, reason: "missing_fingerprint" });
      }

      const { data: existing, error: existingError } = await admin
        .from("attendance_records")
        .select("id")
        .eq("event_id", event.id)
        .eq("device_fingerprint", normalizedFingerprint)
        .maybeSingle();

      if (existingError) {
        console.error("attendance-start fingerprint error", existingError);
        return respond(
          {
            authorized: false,
            reason: isSchemaError(existingError) ? "missing_migrations" : "server_error",
          },
          500,
        );
      }

      if (existing) {
        return respond({ authorized: false, reason: "already_submitted" });
      }
    }

    const now = Date.now();
    const providedToken = token ?? null;

    if (event.rotating_qr_enabled) {
      if (!providedToken || !isTokenWithinGrace(providedToken, now)) {
        return respond({ authorized: false, reason: "expired" });
      }
    } else {
      if (providedToken !== "static") {
        return respond({ authorized: false, reason: "expired" });
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
      return respond(
        {
          authorized: false,
          reason: isSchemaError(sessionError) ? "missing_migrations" : "server_error",
        },
        500,
      );
    }

    const { data: workspace } = await admin
      .from("workspaces")
      .select("brand_color")
      .eq("id", event.workspace_id)
      .maybeSingle();

    return respond({
      authorized: true,
      sessionId: session.id,
      sessionExpiresAt: session.expires_at,
      event: {
        id: event.id,
        workspace_id: event.workspace_id,
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
        theme_color: workspace?.brand_color ?? "default",
      },
    });
  } catch (error) {
    console.error("attendance-start error", error);
    const message = error instanceof Error ? error.message : String(error);
    return respond({ authorized: false, reason: "server_error", error: message }, 500);
  }
});
