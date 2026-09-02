import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface SendEmailRequest {
  email: string;
  purpose: string;
}

// Helper function to generate secure token
function generateToken(): string {
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
    const { email, purpose }: SendEmailRequest = await req.json();

    if (!email || !purpose) {
      return new Response(
        JSON.stringify({ error: "Email and purpose are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client with service role key
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Check rate limiting - max 3 requests per hour per email
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentRequests, error: countError } = await supabase
      .from("email_confirmations")
      .select("id")
      .eq("email", email)
      .gte("created_at", oneHourAgo);

    if (countError) {
      console.error("Rate limit check error:", countError);
      return new Response(
        JSON.stringify({ error: "Failed to check rate limits" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (recentRequests && recentRequests.length >= 3) {
      return new Response(
        JSON.stringify({ error: "Too many confirmation requests. Please try again in an hour." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate token and hash it
    const token = generateToken();
    const tokenHash = await hashToken(token);

    // Store token in database (expires in 24 hours)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { error: insertError } = await supabase
      .from("email_confirmations")
      .insert({
        email,
        token_hash: tokenHash,
        purpose,
        expires_at: expiresAt
      });

    if (insertError) {
      console.error("Token storage error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to generate confirmation link" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create confirmation URL
    const baseUrl = Deno.env.get("SUPABASE_URL") || "http://localhost:3000";
    const confirmationUrl = `${baseUrl.replace('supabase.co', 'lovable.app')}/confirm-email?token=${token}&email=${encodeURIComponent(email)}`;

    // Send confirmation email
    try {
      const emailResult = await resend.emails.send({
        from: "Email Verification <onboarding@resend.dev>",
        to: [email],
        subject: "Confirm your email address",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Email Confirmation Required</h2>
            <p>Please confirm your email address to complete your business registration:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${confirmationUrl}" style="background: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                Confirm Email Address
              </a>
            </div>
            <p><strong>This link will expire in 24 hours.</strong></p>
            <p>If you didn't request this confirmation, please ignore this email.</p>
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 3px;">
              ${confirmationUrl}
            </p>
          </div>
        `,
      });

      console.log("Email sent successfully:", emailResult);
    } catch (emailError) {
      console.error("Email sending error:", emailError);
      // Still return success as token is stored, user can try again
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Confirmation email sent successfully. Please check your inbox.",
        expiresIn: 86400 // 24 hours in seconds
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Send confirmation email error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});