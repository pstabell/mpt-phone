#!/usr/bin/env node

/**
 * MPT Phone - Auto-Provisioning System
 * Handles: Stripe payment → Twilio subaccount → phone number → ready
 */

import Stripe from 'stripe';
import { Twilio } from 'twilio';

// Initialize clients
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const twilio = new Twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/**
 * Auto-provisioning workflow
 * Triggered by Stripe webhook when subscription is created/activated
 */
export class AutoProvisioningService {
  
  /**
   * Main provisioning workflow
   * @param {Object} subscription - Stripe subscription object
   * @param {Object} customer - Stripe customer object
   */
  async provisionCustomer(subscription, customer) {
    console.log(`🚀 Starting auto-provisioning for ${customer.email}...`);
    
    try {
      // Step 1: Create Twilio subaccount
      const subaccount = await this.createTwilioSubaccount(customer);
      console.log(`✅ Twilio subaccount created: ${subaccount.sid}`);
      
      // Step 2: Purchase phone number
      const phoneNumber = await this.purchasePhoneNumber(subaccount.sid, customer);
      console.log(`✅ Phone number purchased: ${phoneNumber}`);
      
      // Step 3: Configure voice applications
      const appSid = await this.createVoiceApplication(subaccount.sid, customer);
      console.log(`✅ Voice application configured: ${appSid}`);
      
      // Step 4: Create database records
      await this.createCustomerRecord({
        customerId: customer.id,
        email: customer.email,
        subscriptionId: subscription.id,
        twilioSubaccountSid: subaccount.sid,
        phoneNumber: phoneNumber,
        voiceAppSid: appSid,
        status: 'active',
        createdAt: new Date().toISOString()
      });
      
      // Step 5: Send welcome email with credentials
      await this.sendWelcomeEmail(customer, {
        phoneNumber,
        loginUrl: `https://phone.metropointtech.com/login?customer=${customer.id}`,
        supportEmail: 'support@metropointtech.com'
      });
      
      console.log(`🎉 Auto-provisioning complete for ${customer.email}`);
      return {
        success: true,
        customerId: customer.id,
        phoneNumber,
        subaccountSid: subaccount.sid
      };
      
    } catch (error) {
      console.error(`❌ Auto-provisioning failed for ${customer.email}:`, error);
      
      // Send failure notification to admin
      await this.sendAdminAlert('Auto-provisioning failed', {
        customer: customer.email,
        subscriptionId: subscription.id,
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Create Twilio subaccount for customer isolation
   */
  async createTwilioSubaccount(customer) {
    const friendlyName = `MPT Phone - ${customer.email}`;
    
    const subaccount = await twilio.api.accounts.create({
      friendlyName: friendlyName
    });
    
    // Create API key for subaccount
    const apiKey = await twilio.newKeys.create({
      friendlyName: `${friendlyName} - API Key`
    }, subaccount.sid);
    
    return {
      sid: subaccount.sid,
      apiKey: apiKey.sid,
      apiSecret: apiKey.secret,
      friendlyName: friendlyName
    };
  }
  
  /**
   * Purchase phone number for customer
   */
  async purchasePhoneNumber(subaccountSid, customer) {
    // Search for available numbers in customer's area code (if provided)
    const areaCode = this.extractAreaCodeFromCustomer(customer);
    
    const availableNumbers = await twilio.availablePhoneNumbers('US')
      .local
      .list({
        areaCode: areaCode || '239', // Default to Naples, FL
        limit: 5
      });
      
    if (availableNumbers.length === 0) {
      throw new Error('No available phone numbers found');
    }
    
    // Purchase the first available number
    const selectedNumber = availableNumbers[0].phoneNumber;
    
    const purchasedNumber = await twilio.incomingPhoneNumbers.create({
      phoneNumber: selectedNumber,
      friendlyName: `MPT Phone - ${customer.email}`
    }, subaccountSid);
    
    return purchasedNumber.phoneNumber;
  }
  
  /**
   * Create Twilio Voice application for call handling
   */
  async createVoiceApplication(subaccountSid, customer) {
    const app = await twilio.applications.create({
      friendlyName: `MPT Phone Voice App - ${customer.email}`,
      voiceUrl: `https://phone.metropointtech.com/api/voice-webhook/${customer.id}`,
      voiceMethod: 'POST',
      statusCallback: `https://phone.metropointtech.com/api/call-status/${customer.id}`,
      statusCallbackMethod: 'POST'
    }, subaccountSid);
    
    return app.sid;
  }
  
  /**
   * Extract area code from customer data (ZIP, address, etc.)
   */
  extractAreaCodeFromCustomer(customer) {
    // This could be enhanced with ZIP code → area code mapping
    // For now, use metadata if available
    return customer.metadata?.area_code || customer.metadata?.zip_area_code;
  }
  
  /**
   * Create customer record in our database
   */
  async createCustomerRecord(customerData) {
    // This would integrate with your customer database
    // For now, just log the structure
    console.log('📝 Customer record to create:', customerData);
    
    // TODO: Integrate with Supabase or your preferred database
    // const { data, error } = await supabase
    //   .from('mpt_phone_customers')
    //   .insert(customerData);
  }
  
  /**
   * Send welcome email with login credentials
   */
  async sendWelcomeEmail(customer, credentials) {
    console.log('📧 Welcome email to send:', {
      to: customer.email,
      subject: 'Welcome to MPT Phone - Your VoIP System is Ready!',
      credentials: credentials
    });
    
    // TODO: Integrate with your email service (SendGrid, etc.)
    // Template should include:
    // - Phone number assigned
    // - Login URL  
    // - Quick start guide
    // - Support contact info
  }
  
  /**
   * Send admin alert for provisioning failures
   */
  async sendAdminAlert(subject, details) {
    console.log('🚨 Admin alert:', { subject, details });
    
    // TODO: Send to admin email or Slack webhook
    // This ensures manual intervention for failed provisions
  }
  
  /**
   * Stripe webhook handler
   * Call this from your webhook endpoint
   */
  async handleStripeWebhook(event) {
    console.log(`📨 Stripe webhook received: ${event.type}`);
    
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        const subscription = event.data.object;
        if (subscription.status === 'active') {
          const customer = await stripe.customers.retrieve(subscription.customer);
          return await this.provisionCustomer(subscription, customer);
        }
        break;
        
      case 'customer.subscription.deleted':
        // Handle account suspension/deletion
        return await this.deprovisionCustomer(event.data.object);
        
      case 'invoice.payment_failed':
        // Handle payment failures
        return await this.handlePaymentFailure(event.data.object);
        
      default:
        console.log(`ℹ️  Unhandled webhook type: ${event.type}`);
    }
  }
  
  /**
   * Handle customer account deprovisioning
   */
  async deprovisionCustomer(subscription) {
    console.log(`🔥 Deprovisioning customer: ${subscription.customer}`);
    
    // TODO: Implement graceful shutdown
    // 1. Suspend Twilio services
    // 2. Export customer data
    // 3. Send final billing notice
    // 4. Archive account (don't delete immediately)
  }
  
  /**
   * Handle payment failure grace period
   */
  async handlePaymentFailure(invoice) {
    console.log(`💳 Payment failed for: ${invoice.customer}`);
    
    // TODO: Implement grace period logic
    // 1. Send payment retry notice
    // 2. Suspend service after X days
    // 3. Offer payment plan options
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const service = new AutoProvisioningService();
  
  // Test provisioning with mock data
  const mockCustomer = {
    id: 'cus_test_123',
    email: 'test@example.com',
    metadata: { area_code: '239' }
  };
  
  const mockSubscription = {
    id: 'sub_test_123',
    customer: 'cus_test_123',
    status: 'active'
  };
  
  console.log('🧪 Testing auto-provisioning workflow...');
  await service.provisionCustomer(mockSubscription, mockCustomer);
}