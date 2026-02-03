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

type ModeratorStateRequest = {
  eventId?: string;
  token?: string;
  includeAttendance?: boolean;
};

const TOKEN_GRACE_MS = 7 * 1000;
const ROTATION_MIN_SECONDS = 2;
const ROTATION_MAX_SECONDS = 60;

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

const tokenPreview = (token?: string | null): string | null => {
  if (!token) return null;
  return token.length <= 8 ? token : token.slice(-8);
};

const generateToken = () => `${crypto.randomUUID()}_${Date.now()}`;

const shouldRotateToken = (token: string | null, now: number, intervalMs: number): boolean => {
  if (!token) return true;
  const parts = token.split("_");
  const timestamp = Number.parseInt(parts[parts.length - 1] ?? "", 10);
  if (Number.isNaN(timestamp)) return true;
  return now - timestamp >= intervalMs;
};

const isHostLeaseActive = (
  deviceId: string | null,
  leaseExpiresAt: string | null,
  now: number,
): boolean => {
  if (!deviceId || !leaseExpiresAt) return false;
  const expiresMs = Date.parse(leaseExpiresAt);
  if (Number.isNaN(expiresMs)) return false;
  return now < expiresMs;
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

    console.log("moderator-state request", {
      eventId,
      tokenSuffix: tokenPreview(token),
      includeAttendance,
    });

    if (!eventId || !token) {
      return respond(
        { authorized: false, reason: "missing_params", error: "Missing eventId or token" },
        400,
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

    // Validate moderation link
    const { data: link, error: linkError } = await admin
      .from("moderation_links")
      .select("id, is_active, event_id, expires_at")
      .eq("event_id", eventId)
      .eq("token", token)
      .maybeSingle();

    const now = Date.now();
    if (linkError) {
      console.error("moderator-state link error", linkError);
      return respond({
        authorized: false,
        reason: isSchemaError(linkError) ? "missing_migrations" : "link_error",
      });
    }

    if (!link) {
      return respond({ authorized: false, reason: "link_not_found" });
    }

    if (!link.is_active) {
      return respond({ authorized: false, reason: "link_inactive" });
    }

    if (isLinkExpired(link.expires_at, now)) {
      return respond({ authorized: false, reason: "link_expired" });
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
          "location_check_enabled",
          "workspace_id",
          "is_active",
          "current_qr_token",
          "qr_token_expires_at",
          "rotating_qr_enabled",
          "rotating_qr_interval_seconds",
          "qr_host_device_id",
          "qr_host_lease_expires_at",
          "moderation_enabled",
          "moderator_show_full_name",
          "moderator_show_email",
        ].join(","),
      )
      .eq("id", eventId)
      .maybeSingle();

    if (eventError) {
      console.error("moderator-state event error", eventError);
      return respond({
        authorized: false,
        reason: isSchemaError(eventError) ? "missing_migrations" : "event_error",
      });
    }

    if (!event) {
      return respond({ authorized: false, reason: "event_missing" });
    }

    if (!event.moderation_enabled) {
      return respond({ authorized: false, reason: "moderation_disabled" });
    }

    const rotationSeconds = Math.min(
      ROTATION_MAX_SECONDS,
      Math.max(ROTATION_MIN_SECONDS, Number(event.rotating_qr_interval_seconds ?? 3)),
    );
    const rotationIntervalMs = rotationSeconds * 1000;
    const tokenValidityMs = rotationIntervalMs + TOKEN_GRACE_MS;
    const hasActiveHost = isHostLeaseActive(
      event.qr_host_device_id ?? null,
      event.qr_host_lease_expires_at ?? null,
      now,
    );

    let nextEvent = event;
    if (
      event.is_active &&
      event.rotating_qr_enabled &&
      !hasActiveHost &&
      shouldRotateToken(event.current_qr_token, now, rotationIntervalMs)
    ) {
      const { data: rotatedEvent, error: rotateError } = await admin
        .from("events")
        .update({
          current_qr_token: generateToken(),
          qr_token_expires_at: new Date(now + tokenValidityMs).toISOString(),
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

    const { data: workspace } = await admin
      .from("workspaces")
      .select("brand_logo_url, brand_color")
      .eq("id", nextEvent.workspace_id)
      .maybeSingle();

    return respond({
      authorized: true,
      event: {
        ...nextEvent,
        brand_logo_url: workspace?.brand_logo_url ?? null,
        theme_color: workspace?.brand_color ?? "default",
      },
      attendance,
    });
  } catch (error) {
    console.error("moderator-state error", error);
    const message = error instanceof Error ? error.message : String(error);
    return respond({ authorized: false, reason: "server_error", error: message }, 500);
  }
});
