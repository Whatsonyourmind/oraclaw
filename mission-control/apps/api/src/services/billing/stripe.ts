/**
 * stripe.ts
 * Story sub-2 - Stripe integration for payments
 *
 * Features:
 * - Stripe customer creation
 * - Subscription creation/update/cancel
 * - Webhook handling for events
 * - Invoice generation
 * - Payment method management
 */

import Stripe from 'stripe';
import type {
  Subscription,
  SubscriptionPlan,
  Invoice,
  PaymentMethod,
  BillingCycle,
  SubscriptionStatus,
  CreateSubscriptionRequest,
  UpdateSubscriptionRequest,
  CancelSubscriptionRequest,
  SubscriptionCheckout,
  UpgradePreview,
} from '@mission-control/shared-types';

// Initialize Stripe with secret key from environment
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2023-10-16',
});

// Webhook secret for signature verification
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

// Map Stripe status to our status
function mapStripeStatus(stripeStatus: string): SubscriptionStatus {
  const statusMap: Record<string, SubscriptionStatus> = {
    trialing: 'trialing',
    active: 'active',
    past_due: 'past_due',
    canceled: 'canceled',
    unpaid: 'unpaid',
    paused: 'paused',
    incomplete: 'incomplete',
    incomplete_expired: 'canceled',
  };
  return statusMap[stripeStatus] || 'incomplete';
}

export class StripeService {
  // ==========================================
  // CUSTOMER MANAGEMENT
  // ==========================================

  /**
   * Create a new Stripe customer
   */
  async createCustomer(params: {
    userId: string;
    email: string;
    name?: string;
    metadata?: Record<string, string>;
  }): Promise<Stripe.Customer> {
    const customer = await stripe.customers.create({
      email: params.email,
      name: params.name,
      metadata: {
        user_id: params.userId,
        ...params.metadata,
      },
    });

    return customer;
  }

  /**
   * Get or create a Stripe customer for a user
   */
  async getOrCreateCustomer(params: {
    userId: string;
    email: string;
    name?: string;
    existingCustomerId?: string;
  }): Promise<Stripe.Customer> {
    // If we have an existing customer ID, retrieve it
    if (params.existingCustomerId) {
      try {
        const customer = await stripe.customers.retrieve(params.existingCustomerId);
        if (!customer.deleted) {
          return customer as Stripe.Customer;
        }
      } catch (error) {
        // Customer not found, create new one
      }
    }

    // Check if customer exists by email
    const existingCustomers = await stripe.customers.list({
      email: params.email,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      return existingCustomers.data[0];
    }

    // Create new customer
    return this.createCustomer({
      userId: params.userId,
      email: params.email,
      name: params.name,
    });
  }

  /**
   * Update customer information
   */
  async updateCustomer(
    customerId: string,
    params: {
      email?: string;
      name?: string;
      metadata?: Record<string, string>;
    }
  ): Promise<Stripe.Customer> {
    const customer = await stripe.customers.update(customerId, {
      email: params.email,
      name: params.name,
      metadata: params.metadata,
    });

    return customer as Stripe.Customer;
  }

  // ==========================================
  // SUBSCRIPTION MANAGEMENT
  // ==========================================

  /**
   * Create a checkout session for new subscription
   */
  async createCheckoutSession(params: {
    customerId: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    trialPeriodDays?: number;
    couponCode?: string;
    metadata?: Record<string, string>;
  }): Promise<SubscriptionCheckout> {
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: params.customerId,
      mode: 'subscription',
      line_items: [
        {
          price: params.priceId,
          quantity: 1,
        },
      ],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      subscription_data: {
        metadata: params.metadata,
      },
      metadata: params.metadata,
    };

    if (params.trialPeriodDays) {
      sessionParams.subscription_data!.trial_period_days = params.trialPeriodDays;
    }

    if (params.couponCode) {
      sessionParams.discounts = [{ coupon: params.couponCode }];
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return {
      checkout_url: session.url!,
      session_id: session.id,
      expires_at: new Date(session.expires_at * 1000).toISOString(),
    };
  }

  /**
   * Create a subscription directly (requires payment method)
   */
  async createSubscription(params: {
    customerId: string;
    priceId: string;
    paymentMethodId?: string;
    trialPeriodDays?: number;
    couponCode?: string;
    metadata?: Record<string, string>;
  }): Promise<Stripe.Subscription> {
    const subscriptionParams: Stripe.SubscriptionCreateParams = {
      customer: params.customerId,
      items: [{ price: params.priceId }],
      metadata: params.metadata,
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
    };

    if (params.paymentMethodId) {
      subscriptionParams.default_payment_method = params.paymentMethodId;
    }

    if (params.trialPeriodDays) {
      subscriptionParams.trial_period_days = params.trialPeriodDays;
    }

    if (params.couponCode) {
      subscriptionParams.coupon = params.couponCode;
    }

    const subscription = await stripe.subscriptions.create(subscriptionParams);
    return subscription;
  }

  /**
   * Get subscription details
   */
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['latest_invoice', 'default_payment_method'],
    });
    return subscription;
  }

  /**
   * Update subscription (change plan, billing cycle)
   */
  async updateSubscription(
    subscriptionId: string,
    params: {
      priceId?: string;
      cancelAtPeriodEnd?: boolean;
      paymentMethodId?: string;
      metadata?: Record<string, string>;
    }
  ): Promise<Stripe.Subscription> {
    const updateParams: Stripe.SubscriptionUpdateParams = {
      metadata: params.metadata,
    };

    if (params.priceId) {
      // Get current subscription to find the item ID
      const currentSub = await stripe.subscriptions.retrieve(subscriptionId);
      updateParams.items = [
        {
          id: currentSub.items.data[0].id,
          price: params.priceId,
        },
      ];
      updateParams.proration_behavior = 'create_prorations';
    }

    if (params.cancelAtPeriodEnd !== undefined) {
      updateParams.cancel_at_period_end = params.cancelAtPeriodEnd;
    }

    if (params.paymentMethodId) {
      updateParams.default_payment_method = params.paymentMethodId;
    }

    const subscription = await stripe.subscriptions.update(subscriptionId, updateParams);
    return subscription;
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(
    subscriptionId: string,
    params: {
      cancelImmediately?: boolean;
      reason?: string;
      feedback?: string;
    }
  ): Promise<Stripe.Subscription> {
    if (params.cancelImmediately) {
      return stripe.subscriptions.cancel(subscriptionId, {
        cancellation_details: {
          comment: params.feedback,
          feedback: this.mapCancellationReason(params.reason),
        },
      });
    }

    // Cancel at period end
    return stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
      cancellation_details: {
        comment: params.feedback,
        feedback: this.mapCancellationReason(params.reason),
      },
    });
  }

  /**
   * Resume a canceled subscription (if cancel_at_period_end was true)
   */
  async resumeSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });
  }

  /**
   * Preview upgrade/downgrade
   */
  async previewSubscriptionChange(params: {
    subscriptionId: string;
    newPriceId: string;
  }): Promise<{ prorated_amount: number; amount_due: number; billing_date: string }> {
    const subscription = await stripe.subscriptions.retrieve(params.subscriptionId);

    const invoice = await stripe.invoices.retrieveUpcoming({
      customer: subscription.customer as string,
      subscription: params.subscriptionId,
      subscription_items: [
        {
          id: subscription.items.data[0].id,
          price: params.newPriceId,
        },
      ],
    });

    return {
      prorated_amount: invoice.subtotal / 100,
      amount_due: invoice.amount_due / 100,
      billing_date: new Date(subscription.current_period_end * 1000).toISOString(),
    };
  }

  // ==========================================
  // PAYMENT METHODS
  // ==========================================

  /**
   * Attach payment method to customer
   */
  async attachPaymentMethod(
    paymentMethodId: string,
    customerId: string
  ): Promise<Stripe.PaymentMethod> {
    const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });
    return paymentMethod;
  }

  /**
   * Set default payment method for customer
   */
  async setDefaultPaymentMethod(
    customerId: string,
    paymentMethodId: string
  ): Promise<Stripe.Customer> {
    const customer = await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });
    return customer as Stripe.Customer;
  }

  /**
   * List customer's payment methods
   */
  async listPaymentMethods(customerId: string): Promise<Stripe.PaymentMethod[]> {
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });
    return paymentMethods.data;
  }

  /**
   * Detach payment method from customer
   */
  async detachPaymentMethod(paymentMethodId: string): Promise<Stripe.PaymentMethod> {
    const paymentMethod = await stripe.paymentMethods.detach(paymentMethodId);
    return paymentMethod;
  }

  /**
   * Create Setup Intent for adding new payment method
   */
  async createSetupIntent(customerId: string): Promise<Stripe.SetupIntent> {
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
    });
    return setupIntent;
  }

  // ==========================================
  // INVOICES
  // ==========================================

  /**
   * List invoices for a customer
   */
  async listInvoices(params: {
    customerId: string;
    limit?: number;
    startingAfter?: string;
  }): Promise<{ invoices: Stripe.Invoice[]; has_more: boolean }> {
    const invoices = await stripe.invoices.list({
      customer: params.customerId,
      limit: params.limit || 10,
      starting_after: params.startingAfter,
    });

    return {
      invoices: invoices.data,
      has_more: invoices.has_more,
    };
  }

  /**
   * Get invoice by ID
   */
  async getInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    return stripe.invoices.retrieve(invoiceId);
  }

  /**
   * Pay an invoice manually
   */
  async payInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    return stripe.invoices.pay(invoiceId);
  }

  /**
   * Get upcoming invoice
   */
  async getUpcomingInvoice(customerId: string): Promise<Stripe.UpcomingInvoice> {
    return stripe.invoices.retrieveUpcoming({
      customer: customerId,
    });
  }

  // ==========================================
  // WEBHOOKS
  // ==========================================

  /**
   * Construct webhook event from raw body and signature
   */
  constructWebhookEvent(
    rawBody: string | Buffer,
    signature: string
  ): Stripe.Event {
    return stripe.webhooks.constructEvent(rawBody, signature, WEBHOOK_SECRET);
  }

  /**
   * Handle webhook event and return appropriate action
   */
  async handleWebhookEvent(event: Stripe.Event): Promise<{
    action: string;
    data: Record<string, any>;
  }> {
    switch (event.type) {
      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription;
        return {
          action: 'subscription_created',
          data: {
            stripe_subscription_id: subscription.id,
            stripe_customer_id: subscription.customer,
            status: mapStripeStatus(subscription.status),
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            trial_end: subscription.trial_end
              ? new Date(subscription.trial_end * 1000).toISOString()
              : null,
          },
        };
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        return {
          action: 'subscription_updated',
          data: {
            stripe_subscription_id: subscription.id,
            status: mapStripeStatus(subscription.status),
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
            canceled_at: subscription.canceled_at
              ? new Date(subscription.canceled_at * 1000).toISOString()
              : null,
          },
        };
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        return {
          action: 'subscription_canceled',
          data: {
            stripe_subscription_id: subscription.id,
            status: 'canceled',
            canceled_at: new Date().toISOString(),
          },
        };
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        return {
          action: 'invoice_paid',
          data: {
            stripe_invoice_id: invoice.id,
            stripe_subscription_id: invoice.subscription,
            amount_paid: invoice.amount_paid / 100,
            paid_at: new Date().toISOString(),
            pdf_url: invoice.invoice_pdf,
            hosted_invoice_url: invoice.hosted_invoice_url,
          },
        };
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        return {
          action: 'payment_failed',
          data: {
            stripe_invoice_id: invoice.id,
            stripe_subscription_id: invoice.subscription,
            amount_due: invoice.amount_due / 100,
            attempt_count: invoice.attempt_count,
            next_payment_attempt: invoice.next_payment_attempt
              ? new Date(invoice.next_payment_attempt * 1000).toISOString()
              : null,
          },
        };
      }

      case 'customer.subscription.trial_will_end': {
        const subscription = event.data.object as Stripe.Subscription;
        return {
          action: 'trial_ending',
          data: {
            stripe_subscription_id: subscription.id,
            trial_end: subscription.trial_end
              ? new Date(subscription.trial_end * 1000).toISOString()
              : null,
            days_remaining: subscription.trial_end
              ? Math.ceil((subscription.trial_end * 1000 - Date.now()) / (1000 * 60 * 60 * 24))
              : 0,
          },
        };
      }

      case 'payment_method.attached': {
        const paymentMethod = event.data.object as Stripe.PaymentMethod;
        return {
          action: 'payment_method_added',
          data: {
            stripe_payment_method_id: paymentMethod.id,
            stripe_customer_id: paymentMethod.customer,
            type: paymentMethod.type,
            card: paymentMethod.card
              ? {
                  brand: paymentMethod.card.brand,
                  last_four: paymentMethod.card.last4,
                  exp_month: paymentMethod.card.exp_month,
                  exp_year: paymentMethod.card.exp_year,
                }
              : null,
          },
        };
      }

      case 'payment_method.detached': {
        const paymentMethod = event.data.object as Stripe.PaymentMethod;
        return {
          action: 'payment_method_removed',
          data: {
            stripe_payment_method_id: paymentMethod.id,
          },
        };
      }

      default:
        return {
          action: 'unhandled',
          data: { event_type: event.type },
        };
    }
  }

  // ==========================================
  // COUPONS & PROMOTIONS
  // ==========================================

  /**
   * Validate a coupon code
   */
  async validateCoupon(couponCode: string): Promise<{
    valid: boolean;
    coupon?: Stripe.Coupon;
    error?: string;
  }> {
    try {
      const coupon = await stripe.coupons.retrieve(couponCode);

      if (!coupon.valid) {
        return { valid: false, error: 'Coupon has expired' };
      }

      return { valid: true, coupon };
    } catch (error) {
      return { valid: false, error: 'Invalid coupon code' };
    }
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  private mapCancellationReason(
    reason?: string
  ): Stripe.SubscriptionCancelParams.CancellationDetails.Feedback | undefined {
    if (!reason) return undefined;

    const reasonMap: Record<string, Stripe.SubscriptionCancelParams.CancellationDetails.Feedback> = {
      too_expensive: 'too_expensive',
      missing_features: 'missing_features',
      switched_service: 'switched_service',
      unused: 'unused',
      customer_service: 'customer_service',
      too_complex: 'too_complex',
      low_quality: 'low_quality',
    };

    return reasonMap[reason] || 'other';
  }

  /**
   * Get Stripe publishable key for client
   */
  getPublishableKey(): string {
    return process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder';
  }
}

// Export singleton instance
export const stripeService = new StripeService();
export { stripe };
