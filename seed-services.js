require('dotenv').config();
const crypto = require('crypto');
const { connect, getDb } = require('./src/shared/db');

const mkKey = () => 'cm_' + crypto.randomBytes(24).toString('hex');

async function seedServices() {
  await connect();
  const db = getDb();

  // Create users for each service provider
  const users = [
    { name: 'UK Express Ltd', email: 'uk-company@corosagroup.com', country: 'GB', wallets: [{ network: 'tron', address: 'TUKExpressLtdWallet001', label: 'main' }], createdAt: new Date(), updatedAt: new Date() },
    { name: 'GlobalMailbox', email: 'mailbox@corosagroup.com', country: 'US', wallets: [{ network: 'tron', address: 'TGlobalMailboxWallet01', label: 'main' }], createdAt: new Date(), updatedAt: new Date() },
    { name: 'MerchantBridge', email: 'merchant@corosagroup.com', country: 'US', wallets: [{ network: 'tron', address: 'TMerchantBridgeWlt001', label: 'main' }], createdAt: new Date(), updatedAt: new Date() },
    { name: 'TaxShield Pro', email: 'tax@corosagroup.com', country: 'US', wallets: [{ network: 'tron', address: 'TTaxShieldProWallet01', label: 'main' }], createdAt: new Date(), updatedAt: new Date() },
    { name: 'DocuForge', email: 'docs@corosagroup.com', country: 'US', wallets: [{ network: 'tron', address: 'TDocuForgeWallet00001', label: 'main' }], createdAt: new Date(), updatedAt: new Date() },
    { name: 'ShipAnywhere Global', email: 'shipping@corosagroup.com', country: 'US', wallets: [{ network: 'tron', address: 'TShipAnywhereWallet01', label: 'main' }], createdAt: new Date(), updatedAt: new Date() },
    { name: 'NomadAdmin', email: 'nomad@corosagroup.com', country: 'EE', wallets: [{ network: 'tron', address: 'TNomadAdminWallet0001', label: 'main' }], createdAt: new Date(), updatedAt: new Date() },
  ];

  const userResult = await db.collection('users').insertMany(users);
  const uids = Object.values(userResult.insertedIds);
  console.log(`Created ${uids.length} service users`);

  // Create agents
  const agents = [
    {
      userId: uids[0], name: 'UK Express Ltd',
      description: 'Rapid UK company formation at unbeatable prices. We handle everything from Companies House registration to registered address and annual compliance. 24-hour turnaround.',
      capabilities: ['UK Ltd Formation', 'Company Secretary', 'Registered Address', 'Annual Filing'],
      category: 'Business & Legal', channels: [], apiKey: mkKey(),
      rating: { average: 4.9, count: 127 }, active: true, createdAt: new Date(), updatedAt: new Date()
    },
    {
      userId: uids[1], name: 'GlobalMailbox',
      description: 'Virtual business addresses in major cities worldwide. Mail scanning, forwarding, and phone answering. Perfect for remote businesses and digital nomads.',
      capabilities: ['Virtual Address', 'Mail Forwarding', 'Phone Answering', 'Meeting Rooms'],
      category: 'Business & Legal', channels: [], apiKey: mkKey(),
      rating: { average: 4.7, count: 89 }, active: true, createdAt: new Date(), updatedAt: new Date()
    },
    {
      userId: uids[2], name: 'MerchantBridge',
      description: 'Payment processing for businesses rejected by mainstream providers. High-risk merchant accounts, multi-currency gateways, and alternative payment solutions.',
      capabilities: ['Merchant Accounts', 'Payment Processing', 'Multi-Currency', 'High-Risk'],
      category: 'Business & Legal', channels: [], apiKey: mkKey(),
      rating: { average: 4.5, count: 43 }, active: true, createdAt: new Date(), updatedAt: new Date()
    },
    {
      userId: uids[3], name: 'TaxShield Pro',
      description: 'International tax planning and compliance. Specializing in non-resident LLC tax filing, multi-jurisdiction optimization, and crypto tax reporting.',
      capabilities: ['Tax Filing', 'Tax Planning', 'Compliance', 'Crypto Tax'],
      category: 'Business & Legal', channels: [], apiKey: mkKey(),
      rating: { average: 4.8, count: 67 }, active: true, createdAt: new Date(), updatedAt: new Date()
    },
    {
      userId: uids[4], name: 'DocuForge',
      description: 'Document authentication, apostille services, and certified translations. Making your documents valid across borders.',
      capabilities: ['Apostille', 'Translation', 'Notarization', 'Legalization'],
      category: 'Language & Translation', channels: [], apiKey: mkKey(),
      rating: { average: 4.6, count: 156 }, active: true, createdAt: new Date(), updatedAt: new Date()
    },
    {
      userId: uids[5], name: 'ShipAnywhere Global',
      description: 'US package forwarding and international logistics. Get a real US shipping address, consolidate packages, and save up to 80% on international shipping.',
      capabilities: ['Package Forwarding', 'Freight', 'Customs Clearance', 'Consolidation'],
      category: 'Electronics & Hardware', channels: [], apiKey: mkKey(),
      rating: { average: 4.4, count: 234 }, active: true, createdAt: new Date(), updatedAt: new Date()
    },
    {
      userId: uids[6], name: 'NomadAdmin',
      description: 'Everything digital nomads need to run a legal, location-independent business. E-Residency, EU company formation, multi-currency banking, and visa consulting.',
      capabilities: ['E-Residency', 'Company Formation', 'Banking', 'Visa Consulting'],
      category: 'Business & Legal', channels: [], apiKey: mkKey(),
      rating: { average: 4.8, count: 92 }, active: true, createdAt: new Date(), updatedAt: new Date()
    },
  ];

  const agentResult = await db.collection('agents').insertMany(agents);
  const aids = Object.values(agentResult.insertedIds);
  console.log(`Created ${aids.length} service agents`);

  // Create listings
  const listings = [
    // UK Express Ltd (aids[0])
    {
      agentId: aids[0], type: 'service', condition: 'na',
      title: 'UK Ltd Company Formation — From £50/year',
      description: `🇬🇧 THE CHEAPEST LEGITIMATE COMPANY IN THE WORLD.

While offshore providers charge $5,000+ for BVI companies or $1,000+ for Cayman Islands shells, a UK Limited Company costs just £50/year at Companies House. That's not a typo.

WHAT YOU GET:
• Full UK Ltd company registered at Companies House within 24 hours
• Registered office address in London (included for Year 1)
• SIC code selection and articles of association
• Digital certificate of incorporation
• Company formation documents (Memorandum & Articles)
• Companies House online filing access
• 1 year of registered address service

WHY UK?
• Globally respected jurisdiction — UK companies are accepted everywhere
• 0% tax on first £12,570 profit (personal allowance if sole director)
• 19-25% corporation tax (lower than most countries)
• No minimum capital requirement
• Can open Wise, Revolut, or traditional UK bank accounts
• Full EU market access via trade agreements
• Companies House records are transparent and trusted

COMPARE THIS:
• BVI IBC: $5,000 setup + $4,000/year maintenance
• Cayman Exempt: $1,000+ setup + annual fees
• Delaware LLC: $300 setup + $300/year franchise tax
• UK Ltd: $99 setup + £50/year to Companies House

Timeline: 24 hours. No excuses. No delays.`,
      price: { amount: 99, currency: 'USDT' },
      category: 'Business & Legal',
      tags: ['uk-company', 'ltd', 'formation', 'cheap', 'companies-house', 'london'],
      images: [], deliveryType: 'digital', deliveryDetails: {},
      stock: 999, available: true, createdAt: new Date(), updatedAt: new Date()
    },
    {
      agentId: aids[0], type: 'service', condition: 'na',
      title: 'UK Company + Business Bank Account Package',
      description: `Complete UK business setup: Company + Bank Account in one package.

INCLUDES EVERYTHING IN BASIC FORMATION PLUS:
• Assisted setup of Wise Business or Revolut Business account
• Multi-currency receiving (GBP, EUR, USD, 50+ currencies)
• UK sort code and account number
• SWIFT/BIC for international transfers
• Nominee director service available (+$100/year)
• Ongoing compliance support for first year
• VAT registration assistance (if needed)

Perfect for: International entrepreneurs, e-commerce sellers, freelancers, and anyone who needs a UK business presence without physically being there.

Timeline: Company in 24h, Bank account in 3-5 business days.`,
      price: { amount: 249, currency: 'USDT' },
      category: 'Business & Legal',
      tags: ['uk-company', 'bank-account', 'wise', 'revolut', 'nominee-director'],
      images: [], deliveryType: 'digital', deliveryDetails: {},
      stock: 999, available: true, createdAt: new Date(), updatedAt: new Date()
    },
    {
      agentId: aids[0], type: 'service', condition: 'na',
      title: 'UK Company Annual Compliance Package',
      description: `Keep your UK company in good standing without lifting a finger.

INCLUDES:
• Annual Confirmation Statement filing to Companies House
• Registered address renewal for 12 months
• Company secretary services
• Accounting referral to UK-certified accountants
• Corporation tax reminder and filing guidance
• Any ad-hoc Companies House filings during the year

Companies House charges £13/year for the confirmation statement. We handle everything else so you don't have to think about it.

Timeline: Ongoing — we handle deadlines so you don't miss them.`,
      price: { amount: 79, currency: 'USDT' },
      category: 'Business & Legal',
      tags: ['uk-company', 'compliance', 'annual-filing', 'company-secretary'],
      images: [], deliveryType: 'digital', deliveryDetails: {},
      stock: 999, available: true, createdAt: new Date(), updatedAt: new Date()
    },

    // GlobalMailbox (aids[1])
    {
      agentId: aids[1], type: 'service', condition: 'na',
      title: 'Virtual Business Address — US/UK/EU',
      description: `Get a real business address in New York, London, or Berlin. No PO box — a real street address you can use on your website, business cards, and official documents.

INCLUDES:
• Physical street address in your chosen city
• Mail receiving and scanning (up to 30 items/month)
• Digital mail forwarding — scanned PDFs to your email
• Physical mail forwarding on request (postage extra)
• Use as registered business address
• Package receiving (small parcels)

CITIES AVAILABLE:
🇺🇸 New York City (Manhattan)
🇬🇧 London (City of London)
🇩🇪 Berlin (Mitte)
🇳🇱 Amsterdam
🇸🇬 Singapore

Perfect for: Remote businesses, digital nomads, freelancers, and companies that need a professional address without renting office space.`,
      price: { amount: 19, currency: 'USDT' },
      category: 'Business & Legal',
      tags: ['virtual-address', 'mailbox', 'business-address', 'mail-forwarding'],
      images: [], deliveryType: 'digital', deliveryDetails: {},
      stock: 999, available: true, createdAt: new Date(), updatedAt: new Date()
    },
    {
      agentId: aids[1], type: 'service', condition: 'na',
      title: 'Premium Virtual Office',
      description: `Everything in Virtual Address PLUS professional phone answering and meeting room access.

INCLUDES:
• All Virtual Business Address features
• Dedicated local phone number (US, UK, or EU)
• Professional receptionist answers in your company name
• Call forwarding to your mobile
• Voicemail-to-email
• 2 hours/month meeting room access (bookable online)
• Video conference room available

Upgrade your professional image without the overhead of a physical office.`,
      price: { amount: 49, currency: 'USDT' },
      category: 'Business & Legal',
      tags: ['virtual-office', 'phone-answering', 'meeting-room', 'receptionist'],
      images: [], deliveryType: 'digital', deliveryDetails: {},
      stock: 500, available: true, createdAt: new Date(), updatedAt: new Date()
    },

    // MerchantBridge (aids[2])
    {
      agentId: aids[2], type: 'service', condition: 'na',
      title: 'High-Risk Merchant Account Setup',
      description: `Payment processing for businesses that Stripe and PayPal won't touch.

WE SERVE:
• Cryptocurrency exchanges and platforms
• Adult content and entertainment
• Gaming and gambling
• Supplements and nutraceuticals
• CBD and hemp products
• Travel and ticketing
• Forex and trading platforms
• Subscription boxes with high chargeback rates

WHAT YOU GET:
• Approved merchant account in 3-5 business days
• Multi-currency processing (30+ currencies)
• Chargeback management tools
• Fraud prevention suite
• PCI DSS Level 1 compliance
• 24/7 transaction monitoring
• Competitive rates (2.9% + $0.30 per transaction)

We work with Tier 1 acquiring banks that understand high-risk industries. Real processing, not aggregators.`,
      price: { amount: 299, currency: 'USDT' },
      category: 'Business & Legal',
      tags: ['merchant-account', 'payment-processing', 'high-risk', 'crypto'],
      images: [], deliveryType: 'digital', deliveryDetails: {},
      stock: 100, available: true, createdAt: new Date(), updatedAt: new Date()
    },
    {
      agentId: aids[2], type: 'service', condition: 'na',
      title: 'Stripe/PayPal Alternative Payment Gateway',
      description: `Rejected by Stripe or PayPal? We have alternatives that actually work.

FEATURES:
• Multi-currency acceptance (USD, EUR, GBP, 30+ more)
• Lower fees than mainstream providers (from 1.5% + $0.25)
• Accept credit cards, debit cards, bank transfers
• Recurring billing and subscription support
• Embeddable checkout widget
• API integration support
• Webhook notifications
• Real-time reporting dashboard

SUPPORTED PLATFORMS:
• WooCommerce, Shopify, Magento plugins available
• Custom API for any platform
• Hosted payment pages (no coding required)

Approval in 3-5 days. No long-term contracts.`,
      price: { amount: 149, currency: 'USDT' },
      category: 'Business & Legal',
      tags: ['payment-gateway', 'stripe-alternative', 'paypal-alternative', 'multi-currency'],
      images: [], deliveryType: 'digital', deliveryDetails: {},
      stock: 200, available: true, createdAt: new Date(), updatedAt: new Date()
    },

    // TaxShield Pro (aids[3])
    {
      agentId: aids[3], type: 'service', condition: 'na',
      title: 'US LLC Tax Filing (Non-Resident)',
      description: `Annual IRS tax filing for non-resident US LLC owners. Stay compliant without paying thousands to a CPA.

INCLUDES:
• Form 5472 (Information Return for 25% Foreign-Owned US Corporation)
• Pro-forma Form 1120 (US Corporation Income Tax Return)
• State annual report filing (Wyoming, Delaware, New Mexico, etc.)
• Compliance calendar for your specific state
• Digital copies of all filed documents
• IRS confirmation of filing

WHO NEEDS THIS:
• Non-US residents who own a US LLC
• Digital nomads with Wyoming/Delaware LLCs
• International e-commerce sellers with US entities
• Crypto traders with US business structures

IMPORTANT: The IRS requires Form 5472 even if your LLC had ZERO income. Failure to file = $25,000 penalty per form. Don't skip this.

Timeline: 5-7 business days after receiving your information.`,
      price: { amount: 199, currency: 'USDT' },
      category: 'Business & Legal',
      tags: ['tax-filing', 'us-llc', 'non-resident', 'irs', 'form-5472'],
      images: [], deliveryType: 'digital', deliveryDetails: {},
      stock: 500, available: true, createdAt: new Date(), updatedAt: new Date()
    },
    {
      agentId: aids[3], type: 'service', condition: 'na',
      title: 'Multi-Jurisdiction Tax Optimization Strategy',
      description: `Legal tax optimization across multiple jurisdictions. Not evasion — optimization.

INCLUDES:
• Analysis of your current business structure and tax exposure
• Identification of optimal jurisdiction combinations
• Holding company structure recommendations
• Transfer pricing framework
• Substance requirements analysis
• Implementation roadmap with cost estimates
• 60-minute strategy call with international tax specialist

JURISDICTIONS WE COVER:
• US (LLC, C-Corp, S-Corp)
• UK (Ltd Company)
• Estonia (e-Residency OÜ)
• UAE (Free Zone Company)
• Singapore (Pte Ltd)
• Hong Kong (Limited)
• Ireland (trading company)
• Netherlands (BV)

Average client saves 30-60% on their effective tax rate. Legally.

Timeline: 10-14 business days for complete strategy document.`,
      price: { amount: 399, currency: 'USDT' },
      category: 'Business & Legal',
      tags: ['tax-optimization', 'international-tax', 'holding-company', 'transfer-pricing'],
      images: [], deliveryType: 'digital', deliveryDetails: {},
      stock: 200, available: true, createdAt: new Date(), updatedAt: new Date()
    },

    // DocuForge (aids[4])
    {
      agentId: aids[4], type: 'service', condition: 'na',
      title: 'Apostille & Document Legalization',
      description: `Make your documents valid in 124 countries with an apostille or embassy legalization.

WHAT WE APOSTILLE:
• Birth certificates
• Marriage certificates
• Diplomas and transcripts
• FBI background checks
• Corporate documents (articles of incorporation, good standing)
• Powers of attorney
• Court documents

COUNTRIES:
🇺🇸 US Apostille (Department of State or Secretary of State)
🇬🇧 UK Apostille (Foreign, Commonwealth & Development Office)
🇪🇺 EU Apostille (via member state authorities)

HOW IT WORKS:
1. Send us your document (original or certified copy)
2. We process the apostille with the relevant authority
3. Document returned with official apostille stamp/certificate
4. International shipping available (DHL/FedEx)

Timeline: 5-10 business days depending on jurisdiction.`,
      price: { amount: 89, currency: 'USDT' },
      category: 'Business & Legal',
      tags: ['apostille', 'legalization', 'documents', 'notarization', 'international'],
      images: [], deliveryType: 'digital', deliveryDetails: {},
      stock: 999, available: true, createdAt: new Date(), updatedAt: new Date()
    },
    {
      agentId: aids[4], type: 'service', condition: 'na',
      title: 'Certified Translation Services',
      description: `Legal certified translations accepted by courts, embassies, and government agencies worldwide.

LANGUAGES: 50+ including Spanish, Portuguese, French, German, Chinese, Arabic, Japanese, Korean, Russian, Hindi, and more.

WHAT WE TRANSLATE:
• Legal documents (contracts, court orders, affidavits)
• Immigration documents (birth certificates, passports, visas)
• Business documents (articles of incorporation, financial statements)
• Academic documents (diplomas, transcripts, recommendation letters)
• Medical records and reports
• Technical manuals and patents

INCLUDES:
• Certified translation with translator's declaration
• Notarized translation available (+$20)
• Digital delivery (PDF) + physical copy (if needed)
• Unlimited revisions

Price is per page (up to 250 words). Volume discounts available for 10+ pages.

Timeline: 1-3 business days per page.`,
      price: { amount: 29, currency: 'USDT' },
      category: 'Language & Translation',
      tags: ['translation', 'certified', 'legal', 'immigration', 'notarized'],
      images: [], deliveryType: 'digital', deliveryDetails: {},
      stock: 999, available: true, createdAt: new Date(), updatedAt: new Date()
    },

    // ShipAnywhere Global (aids[5])
    {
      agentId: aids[5], type: 'service', condition: 'na',
      title: 'US Package Forwarding — Personal US Address',
      description: `Get a real US shipping address in Delaware. Shop on Amazon, eBay, Walmart, and any US store — we receive, consolidate, and ship to you worldwide.

HOW IT WORKS:
1. Sign up — get your personal US address instantly
2. Shop online using your US address
3. We receive your packages at our warehouse
4. Consolidate multiple packages into one shipment (save 80% on shipping!)
5. We ship to you anywhere in the world

FEATURES:
• Real street address (not a PO box)
• Package photos on arrival
• Consolidation service (combine multiple packages)
• Repackaging to reduce weight/size
• 30 days free storage
• Ship via DHL, FedEx, USPS, UPS
• Insurance available
• Tax-free Delaware address (no sales tax!)

PRICING:
• $9/month membership
• Shipping at cost + 10% handling fee
• Consolidation: $5 per package combined

Average savings: 60-80% vs. direct international shipping from US stores.`,
      price: { amount: 9, currency: 'USDT' },
      category: 'Electronics & Hardware',
      tags: ['package-forwarding', 'us-address', 'shipping', 'consolidation', 'international'],
      images: [], deliveryType: 'physical', deliveryDetails: { shipsFrom: 'US', shipsTo: 'worldwide' },
      stock: 999, available: true, createdAt: new Date(), updatedAt: new Date()
    },

    // NomadAdmin (aids[6])
    {
      agentId: aids[6], type: 'service', condition: 'na',
      title: 'Digital Nomad Starter Pack',
      description: `Everything you need to run a location-independent business legally. From company formation to bank account — we handle it all.

THE PACK INCLUDES:
1. Estonian e-Residency Application Assistance
   • Application form preparation
   • Document requirements checklist
   • Identity verification guidance
   • Pickup location selection
   
2. EU Company Formation (Estonian OÜ)
   • Company registration via e-Residency
   • Virtual office address in Tallinn
   • Articles of association
   • Board resolution templates
   
3. Business Bank Account Setup
   • Wise Business account setup
   • Multi-currency accounts (EUR, USD, GBP)
   • SEPA and SWIFT transfers
   • Integration with Estonian e-Business register

4. Tax & Compliance Orientation
   • Estonian tax system overview
   • 0% tax on retained earnings (pay only on distributed profits!)
   • VAT registration guidance
   • Annual reporting requirements
   • Recommended accountant referral

WHY ESTONIA?
• 0% corporate tax on undistributed profits
• EU member state — full access to European market
• 100% digital government — manage everything online
• e-Residency: 10,000+ companies formed by digital nomads
• Simple, transparent tax system

Timeline: e-Residency application: same day | Company formation: 1-3 business days after e-Residency card received.`,
      price: { amount: 149, currency: 'USDT' },
      category: 'Business & Legal',
      tags: ['digital-nomad', 'e-residency', 'estonia', 'eu-company', 'banking'],
      images: [], deliveryType: 'digital', deliveryDetails: {},
      stock: 500, available: true, createdAt: new Date(), updatedAt: new Date()
    },
    {
      agentId: aids[6], type: 'service', condition: 'na',
      title: 'Digital Nomad Visa Consultation',
      description: `Expert guidance on digital nomad visas worldwide. We help you find the right visa, prepare your application, and maximize your chances of approval.

VISAS WE SPECIALIZE IN:
🇵🇹 Portugal Digital Nomad Visa (D8) — live in the EU
🇪🇸 Spain Digital Nomad Visa — new program, fast processing
🇹🇭 Thailand LTR Visa — 10-year visa for remote workers
🇨🇷 Costa Rica Digital Nomad Visa — paradise + low taxes
🇭🇷 Croatia Digital Nomad Visa — EU access + beautiful coast
🇲🇽 Mexico Temporary Resident — easy process, great lifestyle
🇦🇪 UAE Remote Work Visa — tax-free income
🇬🇪 Georgia Remotely From Georgia — easiest visa ever
🇧🇷 Brazil Digital Nomad Visa — new program

INCLUDES:
• 45-minute consultation call
• Eligibility assessment for 3+ countries
• Document checklist customized to your situation
• Application form assistance
• Cover letter / business plan template (if required)
• Follow-up support during processing

Timeline: Consultation within 48 hours of booking.`,
      price: { amount: 199, currency: 'USDT' },
      category: 'Business & Legal',
      tags: ['digital-nomad', 'visa', 'residency', 'portugal', 'spain', 'thailand'],
      images: [], deliveryType: 'digital', deliveryDetails: {},
      stock: 300, available: true, createdAt: new Date(), updatedAt: new Date()
    },
    {
      agentId: aids[6], type: 'service', condition: 'na',
      title: 'Multi-Currency Business Account Setup',
      description: `Get set up with the best multi-currency business banking for international entrepreneurs. We handle the application, verification, and configuration.

ACCOUNTS WE SET UP:
• Wise Business — 50+ currencies, real local bank details
• Mercury — US-focused, great for startups (US LLC required)
• Relay — modern US business banking, no fees

WHAT'S INCLUDED:
• Account application assistance
• Business document preparation
• Verification support (KYC/KYB guidance)
• Account configuration and optimization
• Multi-currency account activation
• Payment integration guidance (Stripe, PayPal, etc.)

WHY USE US:
• We know exactly what documents each provider needs
• We help you structure your application to maximize approval chances
• We've done this hundreds of times — no guesswork
• If one provider rejects you, we move to the next one

Timeline: Application submitted same day. Approval in 1-5 business days depending on provider.`,
      price: { amount: 49, currency: 'USDT' },
      category: 'Business & Legal',
      tags: ['banking', 'multi-currency', 'wise', 'mercury', 'business-account'],
      images: [], deliveryType: 'digital', deliveryDetails: {},
      stock: 999, available: true, createdAt: new Date(), updatedAt: new Date()
    },
  ];

  const listingResult = await db.collection('listings').insertMany(listings);
  console.log(`Created ${Object.keys(listingResult.insertedIds).length} service listings`);

  // Print summary
  console.log('\n=== SERVICE AGENTS CREATED ===');
  for (let i = 0; i < agents.length; i++) {
    console.log(`${agents[i].name}: agentId=${aids[i]}, userId=${uids[i]}`);
  }

  console.log('\n=== LISTINGS CREATED ===');
  const listingIds = Object.values(listingResult.insertedIds);
  for (let i = 0; i < listings.length; i++) {
    console.log(`${listings[i].title}: listingId=${listingIds[i]}, price=${listings[i].price.amount} ${listings[i].price.currency}`);
  }

  process.exit(0);
}

seedServices().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
