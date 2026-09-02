import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface ForgotPasswordRequest {
  businessRefNo: string;
  email: string;
  username: string;
}

// Helper function to generate secure token
function generateResetToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
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
    const { businessRefNo, email, username }: ForgotPasswordRequest = await req.json();

    if (!businessRefNo || !email || !username) {
      return new Response(
        JSON.stringify({ error: "Business ID, email, and username are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client with service role key
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Find the user with matching credentials
    const { data: userData, error: userError } = await supabase
      .from("company_users")
      .select(`
        id,
        username,
        email,
        companies!inner (
          business_ref_no,
          name
        )
      `)
      .eq("username", username)
      .eq("email", email)
      .eq("companies.business_ref_no", businessRefNo)
      .eq("status", "ACTIVE")
      .single();

    if (userError || !userData) {
      // Don't reveal whether the user exists or not for security
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "If the provided information is correct, a password reset link has been sent to your email." 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check rate limiting - max 3 password reset requests per hour per user
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentResets, error: rateLimitError } = await supabase
      .from("password_resets")
      .select("id")
      .eq("user_id", userData.id)
      .gte("created_at", oneHourAgo);

    if (rateLimitError) {
      console.error("Rate limit check error:", rateLimitError);
      return new Response(
        JSON.stringify({ error: "Failed to process request" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (recentResets && recentResets.length >= 3) {
      return new Response(
        JSON.stringify({ error: "Too many password reset requests. Please try again in an hour." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate reset token
    const resetToken = generateResetToken();
    const tokenHash = await hashToken(resetToken);

    // Store reset token (expires in 15 minutes)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const { error: insertError } = await supabase
      .from("password_resets")
      .insert({
        user_id: userData.id,
        token_hash: tokenHash,
        expires_at: expiresAt
      });

    if (insertError) {
      console.error("Token storage error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to process password reset request" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send reset email
    const resetUrl = `${req.headers.get("origin") || "http://localhost:3000"}/reset-password?token=${resetToken}`;
    
    try {
      const emailResult = await resend.emails.send({
        from: "Business Portal <noreply@yourdomain.com>",
        to: [email],
        subject: "Password Reset Request",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Password Reset Request</h2>
            <p>Hello ${username},</p>
            <p>We received a request to reset the password for your account at <strong>${userData.companies.name}</strong>.</p>
            <p>Click the link below to reset your password:</p>
            <div style="margin: 30px 0;">
              <a href="${resetUrl}" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Reset Password
              </a>
            </div>
            <p><strong>This link will expire in 15 minutes.</strong></p>
            <p>If you didn't request this password reset, please ignore this email. Your password will remain unchanged.</p>
            <p>For security reasons, do not share this link with anyone.</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 12px;">
              Business ID: ${businessRefNo}<br>
              Username: ${username}
            </p>
          </div>
        `,
      });

      console.log("Password reset email sent successfully:", emailResult);
    } catch (emailError) {
      console.error("Email sending error:", emailError);
      // Continue with success response as token is stored
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Password reset link has been sent to your email address."
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Forgot password error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});