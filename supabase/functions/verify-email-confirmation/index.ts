import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyEmailRequest {
  email: string;
  token: string;
}

// Helper function to hash token
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const { email, token }: VerifyEmailRequest = await req.json();

    if (!email || !token) {
      return new Response(
        JSON.stringify({ error: "Email and token are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client with service role key
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Hash the provided token
    const tokenHash = await hashToken(token);

    // Find the confirmation record
    const { data: confirmationRecord, error: findError } = await supabase
      .from("email_confirmations")
      .select("*")
      .eq("email", email)
      .eq("token_hash", tokenHash)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (findError || !confirmationRecord) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired confirmation link" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if token has expired
    const now = new Date();
    const expiresAt = new Date(confirmationRecord.expires_at);
    
    if (now > expiresAt) {
      return new Response(
        JSON.stringify({ error: "Confirmation link has expired. Please request a new one." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark token as consumed
    const { error: updateError } = await supabase
      .from("email_confirmations")
      .update({ consumed_at: now.toISOString() })
      .eq("id", confirmationRecord.id);

    if (updateError) {
      console.error("Token consumption error:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to verify email" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Email confirmed successfully",
        verified: true
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Verify email confirmation error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});