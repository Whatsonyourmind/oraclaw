import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/checkout?tier=pay_per_call|starter|growth|scale
 *
 * Redirects to the OraClaw API's billing/checkout endpoint
 * (/api/v1/billing/checkout), which creates a Stripe Checkout Session and
 * redirects to checkout.stripe.com.
 *
 * This is a thin proxy so the web app can initiate checkout without
 * exposing Stripe keys on the client side.
 */
export async function GET(request: NextRequest) {
  const tier = request.nextUrl.searchParams.get("tier");

  if (!tier || !["pay_per_call", "starter", "growth", "scale"].includes(tier)) {
    return NextResponse.json(
      { error: "Invalid tier. Must be one of: pay_per_call, starter, growth, scale" },
      { status: 400 }
    );
  }

  const API_URL =
    process.env.NEXT_PUBLIC_API_URL || "https://oraclaw-api.onrender.com";

  const origin = request.nextUrl.origin;
  const successUrl = `${origin}/dashboard?checkout=success&tier=${tier}`;
  const cancelUrl = `${origin}/pricing?checkout=canceled`;

  // Redirect to the API's billing checkout endpoint (corrected /api/v1/ path)
  const checkoutUrl = `${API_URL}/api/v1/billing/checkout?tier=${tier}&success_url=${encodeURIComponent(successUrl)}&cancel_url=${encodeURIComponent(cancelUrl)}`;

  return NextResponse.redirect(checkoutUrl);
}
