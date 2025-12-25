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
      JSON.stringify({ authorized: true, event, attendance }),
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
