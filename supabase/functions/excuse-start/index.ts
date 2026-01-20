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

type ExcuseStartRequest = {
  eventId?: string;
  token?: string;
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

const isLinkExpired = (expiresAt: string | null, now: number): boolean => {
  if (!expiresAt) return false;
  const expiresMs = Date.parse(expiresAt);
  if (Number.isNaN(expiresMs)) return true;
  return now >= expiresMs;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { eventId, token } =
      (await req.json().catch(() => ({}))) as ExcuseStartRequest;

    if (!eventId || !token) {
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

    const { data: link, error: linkError } = await admin
      .from("excuse_links")
      .select("id, is_active, event_id, expires_at, label")
      .eq("event_id", eventId)
      .eq("token", token)
      .maybeSingle();

    const now = Date.now();
    if (linkError) {
      console.error("excuse-start link error", linkError);
      return respond(
        {
          authorized: false,
          reason: isSchemaError(linkError) ? "missing_migrations" : "link_error",
        },
        500,
      );
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

    const { data: event, error: eventError } = await admin
      .from("events")
      .select("id, name, event_date, workspace_id")
      .eq("id", eventId)
      .maybeSingle();

    if (eventError) {
      console.error("excuse-start event error", eventError);
      return respond(
        {
          authorized: false,
          reason: isSchemaError(eventError) ? "missing_migrations" : "event_error",
        },
        500,
      );
    }

    if (!event) {
      return respond({ authorized: false, reason: "event_missing" });
    }

    const { data: workspace } = await admin
      .from("workspaces")
      .select("brand_color, brand_logo_url")
      .eq("id", event.workspace_id)
      .maybeSingle();

    return respond({
      authorized: true,
      event: {
        id: event.id,
        name: event.name,
        event_date: event.event_date,
        theme_color: workspace?.brand_color ?? "default",
        brand_logo_url: workspace?.brand_logo_url ?? null,
        link_label: link?.label ?? null,
      },
    });
  } catch (error) {
    console.error("excuse-start error", error);
    const message = error instanceof Error ? error.message : String(error);
    return respond({ authorized: false, reason: "server_error", error: message }, 500);
  }
});
