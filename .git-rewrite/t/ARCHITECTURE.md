# MPT Phone - Embeddable Widget Architecture

## Overview
MPT Phone is a browser-based VoIP softphone system built on Twilio with a pluggable architecture for embedding into CRM systems (MPT-CRM, AMS-APP-CRM) and standalone deployment.

## Architecture Decision: Web Components vs iFrames

### Chosen Approach: **Hybrid Architecture**

We'll implement **both** approaches to maximize flexibility:

1. **Primary: Web Components** - For native CRM integration
2. **Secondary: iframe** - For standalone embedding and legacy compatibility

### Web Component Architecture (Primary)

**Benefits:**
- ✅ Native DOM integration with parent applications
- ✅ Shared styling context (can inherit CRM themes)
- ✅ Direct data exchange with parent application
- ✅ Better UX (no iframe scrolling/sizing issues)
- ✅ Access to parent application's auth context
- ✅ Superior mobile responsiveness

**Implementation:**
```javascript
// Custom element registration
class MPTPhone extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }
  
  connectedCallback() {
    this.render();
    this.initializeTwilio();
  }
}

customElements.define('mpt-phone', MPTPhone);
```

**Usage in CRMs:**
```html
<mpt-phone 
  api-key="xxx"
  contact-id="123"
  auth-token="yyy"
  theme="mpt-crm">
</mpt-phone>
```

### iframe Architecture (Secondary)

**Benefits:**
- ✅ Complete isolation and security
- ✅ Works with any parent application
- ✅ Easier deployment (just a URL)
- ✅ Independent styling and updates

**Usage:**
```html
<iframe 
  src="https://phone.metropointtech.com/widget?token=xxx&contact=123"
  width="320" 
  height="480">
</iframe>
```

## Core Architecture Components

### 1. **Core Phone Engine** (`/src/core/`)
- **TwilioManager** - Handles all Twilio Voice SDK operations
- **CallManager** - Call state management, logging
- **ContactManager** - Contact lookup and integration
- **AuthManager** - Authentication and session management

### 2. **UI Framework** (`/src/ui/`)
- **Dialer Component** - Number pad and dialing interface
- **CallDisplay** - Active call controls and status
- **ContactSearch** - CRM contact integration
- **Settings Panel** - User preferences and configuration

### 3. **Integration Layer** (`/src/integrations/`)
- **CRMConnector** - Generic CRM integration interface
- **MPTCRMIntegration** - MPT-CRM specific implementation
- **AMSIntegration** - AMS-APP-CRM specific implementation
- **StripeIntegration** - Subscription and billing

### 4. **API Layer** (`/src/api/`)
- **REST endpoints** for CRM integration
- **WebSocket** for real-time updates
- **Webhook handlers** for Twilio events

## Plugin Architecture

### Widget Configuration
```javascript
{
  "mode": "embedded", // "embedded" | "standalone" | "popup"
  "integration": {
    "type": "mpt-crm", // "mpt-crm" | "ams-crm" | "generic"
    "apiEndpoint": "https://api.example.com",
    "authMethod": "sso" // "sso" | "token" | "oauth"
  },
  "features": {
    "dialPad": true,
    "contactSearch": true,
    "callLogging": true,
    "voicemail": true
  },
  "theme": {
    "primary": "#007bff",
    "secondary": "#6c757d",
    "layout": "compact" // "compact" | "full" | "minimal"
  }
}
```

### Communication Patterns

**Parent → Widget:**
```javascript
// Web Component approach
document.querySelector('mpt-phone').dial('+12394267058');

// iframe approach (postMessage)
iframe.contentWindow.postMessage({
  action: 'dial',
  number: '+12394267058'
}, '*');
```

**Widget → Parent:**
```javascript
// Custom events for web component
this.dispatchEvent(new CustomEvent('call-started', {
  detail: { callId, contactId, number }
}));

// postMessage for iframe
parent.postMessage({
  event: 'call-started',
  data: { callId, contactId, number }
}, '*');
```

## Deployment Strategy

### 1. **Standalone App** (phone.metropointtech.com)
- Full-featured VoIP interface
- User account management
- Billing integration
- Settings dashboard

### 2. **Widget Distribution**
- **NPM Package**: `@mpt/phone-widget` for web component
- **CDN**: `https://cdn.metropointtech.com/phone/v1/widget.js`
- **iframe URL**: `https://phone.metropointtech.com/widget`

### 3. **CRM Integration**
- Direct embedding in MPT-CRM and AMS-APP-CRM
- SSO authentication passthrough
- Shared contact database

## Security Considerations

### Authentication
- JWT tokens for API access
- SSO integration with parent CRM systems
- Twilio capability tokens for secure calling

### Data Isolation
- Separate Twilio subaccounts per customer
- Encrypted call logs
- PCI compliance for payment processing

### Cross-Origin Security
- CORS policies for API endpoints
- Content Security Policy headers
- Secure iframe communication patterns

## Next Steps

1. ✅ **Item #001 Complete** - Architecture designed
2. Build core phone engine with Twilio Voice SDK
3. Implement web component wrapper
4. Create standalone application shell
5. Develop CRM integration APIs

This architecture provides maximum flexibility while maintaining security and performance standards.