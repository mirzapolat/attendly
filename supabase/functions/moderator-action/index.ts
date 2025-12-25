import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ModeratorActionRequest = {
  eventId: string;
  token: string;
  action: "update_status" | "delete_record" | "add_attendee";
  recordId?: string;
  newStatus?: "verified" | "suspicious" | "cleared";
  attendeeName?: string;
  attendeeEmail?: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as ModeratorActionRequest;
    const { eventId, token, action, recordId, newStatus, attendeeName, attendeeEmail } = body;

    console.log("moderator-action request:", { eventId, action, recordId, newStatus });

    if (!eventId || !token || !action) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
      console.log("Invalid or inactive moderation link");
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify moderation is enabled for the event
    const { data: event, error: eventError } = await admin
      .from("events")
      .select("id, moderation_enabled")
      .eq("id", eventId)
      .maybeSingle();

    if (eventError || !event || !event.moderation_enabled) {
      console.log("Moderation not enabled for event");
      return new Response(
        JSON.stringify({ success: false, error: "Moderation not enabled" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Perform the action
    if (action === "update_status" && recordId && newStatus) {
      const { error } = await admin
        .from("attendance_records")
        .update({ 
          status: newStatus, 
          suspicious_reason: newStatus === "cleared" ? null : undefined 
        })
        .eq("id", recordId)
        .eq("event_id", eventId);

      if (error) {
        console.error("update_status error:", error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Status updated successfully");
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete_record" && recordId) {
      const { error } = await admin
        .from("attendance_records")
        .delete()
        .eq("id", recordId)
        .eq("event_id", eventId);

      if (error) {
        console.error("delete_record error:", error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Record deleted successfully");
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "add_attendee" && attendeeName && attendeeEmail) {
      const { error } = await admin
        .from("attendance_records")
        .insert({
          event_id: eventId,
          attendee_name: attendeeName.trim(),
          attendee_email: attendeeEmail.trim().toLowerCase(),
          device_fingerprint: `moderator-${crypto.randomUUID()}`,
          status: "verified",
          location_provided: false,
        });

      if (error) {
        console.error("add_attendee error:", error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Attendee added successfully");
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Invalid action or missing parameters" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("moderator-action error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
