import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AttendanceSubmitRequest = {
  sessionId?: string;
  token?: string;
  clientId?: string;
  attendeeName?: string;
  attendeeEmail?: string;
  location?: { lat: number; lng: number } | null;
  locationDenied?: boolean;
};

const hashValue = async (value: string): Promise<string> => {
  const data = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
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
    const { sessionId, token, clientId, attendeeName, attendeeEmail, location, locationDenied } = body;

    if (!sessionId || !token || !clientId || !attendeeName || !attendeeEmail) {
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
      .select("id, event_id, expires_at, used_at, token, token_hash, client_id_hash")
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

    const normalizedToken = token.trim();
    if (!normalizedToken) {
      return new Response(
        JSON.stringify({ success: false, reason: "invalid_request" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (session.token_hash) {
      const tokenHash = await hashValue(normalizedToken);
      if (tokenHash !== session.token_hash) {
        return new Response(
          JSON.stringify({ success: false, reason: "session_invalid" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    } else if (session.token && normalizedToken !== session.token) {
      return new Response(
        JSON.stringify({ success: false, reason: "session_invalid" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const normalizedClientId = clientId.trim();
    if (!normalizedClientId) {
      return new Response(
        JSON.stringify({ success: false, reason: "invalid_request" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (session.client_id_hash) {
      const clientIdHash = await hashValue(normalizedClientId);
      if (clientIdHash !== session.client_id_hash) {
        return new Response(
          JSON.stringify({ success: false, reason: "session_invalid" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const { data: event, error: eventError } = await admin
      .from("events")
      .select(
        [
          "id",
          "is_active",
          "client_id_check_enabled",
          "client_id_collision_strict",
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
    const clientIdForRecord = normalizedClientId;
    let clientIdToStore = clientIdForRecord;
    let clientIdRaw: string | null = null;

    let status: "verified" | "suspicious" = "verified";
    let suspiciousReason: string | null = null;

    const clientIdCheckEnabled = event.client_id_check_enabled !== false;
    if (clientIdCheckEnabled) {
      const clientIdStrict = event.client_id_collision_strict !== false;
      const { data: existingClient } = await admin
        .from("attendance_records")
        .select("id")
        .eq("event_id", event.id)
        .eq("client_id", clientIdForRecord)
        .maybeSingle();

      if (existingClient) {
        if (clientIdStrict) {
          return new Response(
            JSON.stringify({ success: false, reason: "already_submitted" }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        status = "suspicious";
        suspiciousReason = "Client ID matched another submission";
        clientIdRaw = clientIdForRecord;
        clientIdToStore = `collision-${crypto.randomUUID()}`;
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

    const baseRecord = {
      event_id: event.id,
      attendee_name: trimmedName,
      attendee_email: trimmedEmail,
      location_lat: event.location_check_enabled ? location?.lat ?? null : null,
      location_lng: event.location_check_enabled ? location?.lng ?? null : null,
      location_provided: event.location_check_enabled ? !!location : false,
      status,
      suspicious_reason: suspiciousReason,
    };

    const initialPayload = {
      ...baseRecord,
      client_id: clientIdToStore,
      client_id_raw: clientIdRaw,
    };

    let { error: insertError } = await admin.from("attendance_records").insert(initialPayload);
    if (insertError?.code === "23505" && !clientIdCheckEnabled) {
      const fallbackPayload = {
        ...baseRecord,
        client_id: `collision-${crypto.randomUUID()}`,
        client_id_raw: clientIdForRecord,
      };
      const { error: retryError } = await admin.from("attendance_records").insert(fallbackPayload);
      insertError = retryError;
    }

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
