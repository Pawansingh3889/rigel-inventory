import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

// Helper function to hash token
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Helper function to hash password
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Password validation function
function validatePassword(password: string): boolean {
  // At least 8 characters, includes uppercase, lowercase, number, symbol
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return regex.test(password);
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
    const { token, newPassword }: ResetPasswordRequest = await req.json();

    if (!token || !newPassword) {
      return new Response(
        JSON.stringify({ error: "Token and new password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate password strength
    if (!validatePassword(newPassword)) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 8 characters with uppercase, lowercase, number, and special character." }),
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

    // Find the reset token record
    const { data: resetRecord, error: findError } = await supabase
      .from("password_resets")
      .select(`
        id,
        user_id,
        expires_at,
        used_at,
        company_users!inner (
          id,
          username,
          email
        )
      `)
      .eq("token_hash", tokenHash)
      .is("used_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (findError || !resetRecord) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired reset token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if token has expired
    const now = new Date();
    const expiresAt = new Date(resetRecord.expires_at);
    
    if (now > expiresAt) {
      return new Response(
        JSON.stringify({ error: "Reset token has expired. Please request a new password reset." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Hash the new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update the user's password
    const { error: updateError } = await supabase
      .from("company_users")
      .update({ 
        password_hash: newPasswordHash,
        updated_at: now.toISOString()
      })
      .eq("id", resetRecord.user_id);

    if (updateError) {
      console.error("Password update error:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update password" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark reset token as used
    const { error: markUsedError } = await supabase
      .from("password_resets")
      .update({ used_at: now.toISOString() })
      .eq("id", resetRecord.id);

    if (markUsedError) {
      console.error("Token marking error:", markUsedError);
      // Continue with success as password was updated
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Password has been reset successfully. You can now sign in with your new password."
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Reset password error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});