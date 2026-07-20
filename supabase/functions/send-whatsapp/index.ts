import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendWhatsAppMessage(
  phoneNumber: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

  if (!accessToken || !phoneNumberId) {
    return { success: false, error: "WhatsApp API not configured" };
  }

  let formattedPhone = phoneNumber.replace(/[\s\-\(\)]/g, "");
  if (formattedPhone.startsWith("+")) formattedPhone = formattedPhone.substring(1);
  if (/^\d{10}$/.test(formattedPhone)) formattedPhone = "91" + formattedPhone;

  if (!/^\d{10,15}$/.test(formattedPhone)) {
    return { success: false, error: "Invalid phone number" };
  }

  try {
    const sendViaGraph = async (payload: Record<string, unknown>) =>
      fetch(`https://graph.facebook.com/v25.0/${phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

    const textResponse = await sendViaGraph({
      messaging_product: "whatsapp",
      to: formattedPhone,
      type: "text",
      text: { body: message },
    });

    const textData = await textResponse.json().catch(() => ({} as any));
    if (textResponse.ok) {
      return { success: true, messageId: textData?.messages?.[0]?.id };
    }

    const templateResponse = await sendViaGraph({
      messaging_product: "whatsapp",
      to: formattedPhone,
      type: "template",
      template: {
        name: "hello_world",
        language: { code: "en_US" },
      },
    });
    const templateData = await templateResponse.json().catch(() => ({} as any));

    if (templateResponse.ok) {
      return { success: true, messageId: templateData?.messages?.[0]?.id };
    }

    return {
      success: false,
      error: `${textData?.error?.message || "WhatsApp text send failed"} | fallback: ${templateData?.error?.message || "WhatsApp template send failed"}`,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'principal', 'teacher'])
      .maybeSingle();
    if (!roleData) {
      return new Response(
        JSON.stringify({ success: false, error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { phoneNumber, studentId, studentName, message, status } = await req.json();

    let recipientPhone = phoneNumber;

    if (!recipientPhone && studentId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("parent_phone, phone, metadata")
        .eq("user_id", studentId)
        .maybeSingle();

      const metadata = (profile as any)?.metadata || {};
      recipientPhone = profile?.parent_phone || metadata?.parent_phone || profile?.phone || null;

      if (!recipientPhone) {
        const { data: attendance } = await supabase
          .from("attendance_records")
          .select("device_info")
          .eq("user_id", studentId)
          .order("timestamp", { ascending: false })
          .limit(1)
          .maybeSingle();

        const deviceInfo = (attendance?.device_info as any) || {};
        recipientPhone = deviceInfo?.metadata?.parent_phone || null;
      }
    }

    if (!recipientPhone) {
      return new Response(
        JSON.stringify({ success: false, error: "No phone number found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const finalMessage = message || buildAutoMessage(studentName || "Student", status || "present");

    const result = await sendWhatsAppMessage(recipientPhone, finalMessage);

    await supabase.from("notification_log").insert({
      recipient_phone: recipientPhone,
      recipient_id: studentId || null,
      message_content: finalMessage,
      notification_type: "whatsapp",
      language: "en",
      status: result.success ? "sent" : "failed",
      gateway_response: result as any,
    });

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildAutoMessage(studentName: string, status: string): string {
  const time = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  const date = new Date().toLocaleDateString("en-IN");

  switch (status) {
    case "present":
      return `✅ Dear Parent, ${studentName} has arrived at school at ${time}. Have a great day! - Presence`;
    case "late":
      return `⏰ Notice: ${studentName} arrived late at school at ${time} today. Please ensure timely arrival. - Presence`;
    case "absent":
      return `❌ Alert: ${studentName} has been marked absent today (${date}). If unexpected, please contact the school. - Presence`;
    default:
      return `📚 Attendance update for ${studentName}: ${status} | Time: ${time} | Date: ${date} - Presence`;
  }
}
