import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AttendanceSubmitRequest = {
  sessionId?: string;
  attendeeName?: string;
  attendeeEmail?: string;
  deviceFingerprint?: string;
  deviceFingerprintRaw?: string;
  location?: { lat: number; lng: number } | null;
  locationDenied?: boolean;
};

const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as AttendanceSubmitRequest;
    const { sessionId, attendeeName, attendeeEmail, deviceFingerprint, deviceFingerprintRaw, location, locationDenied } = body;

    if (!sessionId || !attendeeName || !attendeeEmail) {
      return new Response(
        JSON.stringify({ success: false, reason: "invalid_request" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
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

    const { data: session, error: sessionError } = await admin
      .from("attendance_sessions")
      .select("id, event_id, expires_at, used_at")
      .eq("id", sessionId)
      .maybeSingle();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ success: false, reason: "session_invalid" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const now = Date.now();
    const expiresAtMs = Date.parse(session.expires_at);
    if (session.used_at) {
      return new Response(
        JSON.stringify({ success: false, reason: "session_used" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (Number.isNaN(expiresAtMs) || now > expiresAtMs) {
      return new Response(
        JSON.stringify({ success: false, reason: "session_expired" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: event, error: eventError } = await admin
      .from("events")
      .select(
        [
          "id",
          "is_active",
          "device_fingerprint_enabled",
          "fingerprint_collision_strict",
          "location_check_enabled",
          "location_lat",
          "location_lng",
          "location_radius_meters",
        ].join(","),
      )
      .eq("id", session.event_id)
      .maybeSingle();

    if (eventError || !event) {
      return new Response(
        JSON.stringify({ success: false, reason: "event_missing" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!event.is_active) {
      return new Response(
        JSON.stringify({ success: false, reason: "inactive" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const trimmedName = attendeeName.trim();
    const trimmedEmail = attendeeEmail.trim().toLowerCase();
    const normalizedFingerprint = deviceFingerprint?.trim() ?? "";
    const normalizedRaw = deviceFingerprintRaw?.trim() ?? "";
    let fingerprintToStore = normalizedFingerprint || normalizedRaw;
    const fingerprintRaw = normalizedRaw || (normalizedFingerprint ? normalizedFingerprint : null);

    if (event.device_fingerprint_enabled && !fingerprintToStore) {
      return new Response(
        JSON.stringify({ success: false, reason: "missing_fingerprint" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!event.device_fingerprint_enabled) {
      fingerprintToStore = `no-fp-${crypto.randomUUID()}`;
    }

    let status: "verified" | "suspicious" = "verified";
    let suspiciousReason: string | null = null;

    const fingerprintStrict = event.fingerprint_collision_strict !== false;
    let fingerprintCollision = false;

    if (event.device_fingerprint_enabled) {
      if (normalizedFingerprint) {
        const { data: existingExact } = await admin
          .from("attendance_records")
          .select("id")
          .eq("event_id", event.id)
          .eq("device_fingerprint", normalizedFingerprint)
          .maybeSingle();

        if (existingExact) {
          return new Response(
            JSON.stringify({ success: false, reason: "already_submitted" }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }

      if (normalizedRaw) {
        const { data: existingRaw } = await admin
          .from("attendance_records")
          .select("id")
          .eq("event_id", event.id)
          .eq("device_fingerprint_raw", normalizedRaw)
          .maybeSingle();

        if (existingRaw) {
          fingerprintCollision = true;
        } else {
          const { data: existingLegacy } = await admin
            .from("attendance_records")
            .select("id")
            .eq("event_id", event.id)
            .eq("device_fingerprint", normalizedRaw)
            .maybeSingle();

          if (existingLegacy) {
            fingerprintCollision = true;
          }
        }
      }

      if (fingerprintCollision) {
        if (fingerprintStrict) {
          return new Response(
            JSON.stringify({ success: false, reason: "already_submitted" }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        status = "suspicious";
        suspiciousReason = "Fingerprint matched another submission";
      }
    }

    if (event.location_check_enabled) {
      if (locationDenied || !location) {
        status = "suspicious";
        suspiciousReason = "Location access denied";
      } else {
        const distance = calculateDistance(
          location.lat,
          location.lng,
          event.location_lat,
          event.location_lng,
        );
        const radius = event.location_radius_meters ?? 0;
        if (distance > radius) {
          status = "suspicious";
          suspiciousReason = `Location ${Math.round(distance)}m away from event (allowed: ${radius}m)`;
        }
      }
    }

    const { error: insertError } = await admin.from("attendance_records").insert({
      event_id: event.id,
      attendee_name: trimmedName,
      attendee_email: trimmedEmail,
      device_fingerprint: fingerprintToStore,
      device_fingerprint_raw: fingerprintRaw,
      location_lat: event.location_check_enabled ? location?.lat ?? null : null,
      location_lng: event.location_check_enabled ? location?.lng ?? null : null,
      location_provided: event.location_check_enabled ? !!location : false,
      status,
      suspicious_reason: suspiciousReason,
    });

    if (insertError) {
      if (insertError.code === "23505") {
        return new Response(
          JSON.stringify({ success: false, reason: "already_submitted" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ success: false, reason: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await admin
      .from("attendance_sessions")
      .update({ used_at: new Date(now).toISOString() })
      .eq("id", sessionId);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("attendance-submit error", error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, reason: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
