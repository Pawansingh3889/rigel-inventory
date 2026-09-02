import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface SendOtpRequest {
  email: string;
  purpose: string;
}

// Helper function to generate 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Helper function to hash OTP
async function hashOTP(otp: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(otp);
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
    const { email, purpose }: SendOtpRequest = await req.json();

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

    // Check rate limiting - max 3 OTPs per hour per email
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentOtps, error: countError } = await supabase
      .from("email_otps")
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

    if (recentOtps && recentOtps.length >= 3) {
      return new Response(
        JSON.stringify({ error: "Too many OTP requests. Please try again in an hour." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate OTP and hash it
    const otp = generateOTP();
    const otpHash = await hashOTP(otp);

    // Store OTP in database (expires in 3 minutes)
    const expiresAt = new Date(Date.now() + 3 * 60 * 1000).toISOString();
    const { error: insertError } = await supabase
      .from("email_otps")
      .insert({
        email,
        otp_hash: otpHash,
        expires_at: expiresAt,
        attempt_count: 0
      });

    if (insertError) {
      console.error("OTP storage error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to generate OTP" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send OTP via email
    try {
      const emailResult = await resend.emails.send({
        from: "Verification <onboarding@resend.dev>",
        to: [email],
        subject: "Your verification code (expires in 3 minutes)",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Business Registration OTP</h2>
            <p>Your One-Time Password (OTP) for business registration is:</p>
            <div style="background: #f5f5f5; padding: 20px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 3px; margin: 20px 0;">
              ${otp}
            </div>
            <p><strong>This OTP will expire in 3 minutes.</strong></p>
            <p>If you didn't request this OTP, please ignore this email.</p>
            <p>For security reasons, do not share this OTP with anyone.</p>
          </div>
        `,
      });

      console.log("Email sent successfully:", emailResult);
    } catch (emailError) {
      console.error("Email sending error:", emailError);
      // Still return success as OTP is stored, user can try again
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "OTP sent successfully. Please check your email.",
        expiresIn: 180 // 3 minutes in seconds
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Send OTP error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});