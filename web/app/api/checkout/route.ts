import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/checkout?tier=starter|growth|scale
 *
 * Redirects to the OraClaw API's billing/checkout endpoint,
 * which creates a Stripe Checkout Session and redirects to checkout.stripe.com.
 *
 * This is a thin proxy so the web app can initiate checkout without
 * exposing Stripe keys on the client side.
 */
export async function GET(request: NextRequest) {
  const tier = request.nextUrl.searchParams.get("tier");

  if (!tier || !["starter", "growth", "scale", "enterprise"].includes(tier)) {
    return NextResponse.json(
      { error: "Invalid tier. Must be one of: starter, growth, scale, enterprise" },
      { status: 400 }
    );
  }

  const API_URL =
    process.env.NEXT_PUBLIC_API_URL || "https://oraclaw-api.onrender.com";

  const origin = request.nextUrl.origin;
  const successUrl = `${origin}/dashboard?checkout=success&tier=${tier}`;
  const cancelUrl = `${origin}/pricing?checkout=canceled`;

  // Redirect to the API's billing checkout endpoint
  const checkoutUrl = `${API_URL}/api/billing/checkout?tier=${tier}&success_url=${encodeURIComponent(successUrl)}&cancel_url=${encodeURIComponent(cancelUrl)}`;

  return NextResponse.redirect(checkoutUrl);
}
