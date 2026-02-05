import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ExcuseSubmitRequest = {
  eventId?: string;
  token?: string;
  attendeeName?: string;
  attendeeEmail?: string;
};

const isLinkExpired = (expiresAt: string | null, now: number): boolean => {
  if (!expiresAt) return false;
  const expiresMs = Date.parse(expiresAt);
  if (Number.isNaN(expiresMs)) return true;
  return now >= expiresMs;
};

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
    const body = (await req.json().catch(() => ({}))) as ExcuseSubmitRequest;
    const { eventId, token, attendeeName, attendeeEmail } = body;

    if (!eventId || !token || !attendeeName || !attendeeEmail) {
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

    const { data: link, error: linkError } = await admin
      .from("excuse_links")
      .select("id, is_active, event_id, expires_at")
      .eq("event_id", eventId)
      .eq("token", token)
      .maybeSingle();

    const now = Date.now();
    if (linkError) {
      console.error("excuse-submit link error", linkError);
      return new Response(
        JSON.stringify({
          success: false,
          reason: isSchemaError(linkError) ? "missing_migrations" : "link_error",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!link) {
      return new Response(
        JSON.stringify({ success: false, reason: "link_not_found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!link.is_active) {
      return new Response(
        JSON.stringify({ success: false, reason: "link_inactive" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (isLinkExpired(link.expires_at, now)) {
      return new Response(
        JSON.stringify({ success: false, reason: "link_expired" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: event, error: eventError } = await admin
      .from("events")
      .select("id")
      .eq("id", eventId)
      .maybeSingle();

    if (eventError) {
      console.error("excuse-submit event error", eventError);
      return new Response(
        JSON.stringify({
          success: false,
          reason: isSchemaError(eventError) ? "missing_migrations" : "event_error",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!event) {
      return new Response(
        JSON.stringify({ success: false, reason: "event_missing" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const trimmedName = attendeeName.trim();
    const trimmedEmail = attendeeEmail.trim().toLowerCase();

    if (!trimmedName || !trimmedEmail) {
      return new Response(
        JSON.stringify({ success: false, reason: "invalid_request" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { error: insertError } = await admin.from("attendance_records").insert({
      event_id: eventId,
      attendee_name: trimmedName,
      attendee_email: trimmedEmail,
      client_id: `excuse-${link.id}-${crypto.randomUUID()}`,
      location_provided: false,
      status: "excused",
    });

    if (insertError) {
      console.error("excuse-submit insert error", insertError);
      return new Response(
        JSON.stringify({ success: false, reason: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("excuse-submit error", error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, reason: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
