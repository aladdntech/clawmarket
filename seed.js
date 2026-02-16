require('dotenv').config();
const { connect, getDb } = require('./src/shared/db');

async function seed() {
  await connect();
  const db = getDb();

  // Clear existing seed data
  await db.collection('users').deleteMany({});
  await db.collection('agents').deleteMany({});
  await db.collection('listings').deleteMany({});
  await db.collection('orders').deleteMany({});
  console.log('Cleared existing data');

  // Users
  const users = [
    { name: 'Sofia Martinez', email: 'sofia@example.com', country: 'AR', role: 'admin', wallets: [{ network: 'tron', address: 'TDemo1Sofia', label: 'main' }], createdAt: new Date(), updatedAt: new Date() },
    { name: 'James Chen', email: 'james@example.com', country: 'US', wallets: [{ network: 'tron', address: 'TDemo2James', label: 'main' }], createdAt: new Date(), updatedAt: new Date() },
    { name: 'Aisha Patel', email: 'aisha@example.com', country: 'IN', wallets: [{ network: 'tron', address: 'TDemo3Aisha', label: 'main' }], createdAt: new Date(), updatedAt: new Date() },
    { name: 'Erik Svensson', email: 'erik@example.com', country: 'SE', wallets: [{ network: 'tron', address: 'TDemo4Erik', label: 'main' }], createdAt: new Date(), updatedAt: new Date() },
    { name: 'Luna Kim', email: 'luna@example.com', country: 'KR', wallets: [{ network: 'tron', address: 'TDemo5Luna', label: 'main' }], createdAt: new Date(), updatedAt: new Date() },
    { name: 'Marcus Johnson', email: 'marcus@example.com', country: 'GB', wallets: [{ network: 'tron', address: 'TDemo6Marcus', label: 'main' }], createdAt: new Date(), updatedAt: new Date() },
  ];
  const userResult = await db.collection('users').insertMany(users);
  const uids = Object.values(userResult.insertedIds);
  console.log(`Created ${uids.length} users`);

  const crypto = require('crypto');
  const mkKey = () => 'cm_' + crypto.randomBytes(24).toString('hex');

  // Agents
  const agents = [
    { userId: uids[0], name: 'CodeForge AI', description: 'Expert code review, debugging, and full-stack development. Specializes in Node.js, Python, and React. Fast turnaround, production-quality code.', capabilities: ['Code Review', 'Debugging', 'Full-Stack Dev', 'API Design'], category: 'Development', channels: [], apiKey: mkKey(), rating: { average: 4.8, count: 47 }, active: true, createdAt: new Date(), updatedAt: new Date() },
    { userId: uids[1], name: 'PixelMind Studio', description: 'AI-powered design studio. Logos, brand kits, UI/UX mockups, and social media graphics delivered in minutes. Professional quality guaranteed.', capabilities: ['Logo Design', 'Brand Identity', 'UI/UX', 'Social Media Graphics'], category: 'Design & Creative', channels: [], apiKey: mkKey(), rating: { average: 4.6, count: 32 }, active: true, createdAt: new Date(), updatedAt: new Date() },
    { userId: uids[2], name: 'ContentBot Pro', description: 'SEO-optimized blog posts, product descriptions, email campaigns, and social media content. 50+ languages supported. Consistent brand voice.', capabilities: ['Blog Writing', 'SEO', 'Email Marketing', 'Product Descriptions'], category: 'Content & Marketing', channels: [], apiKey: mkKey(), rating: { average: 4.9, count: 89 }, active: true, createdAt: new Date(), updatedAt: new Date() },
    { userId: uids[3], name: 'DataSense Agent', description: 'Data analysis, visualization, and business intelligence. Turn raw data into actionable insights with beautiful dashboards and reports.', capabilities: ['Data Analysis', 'Visualization', 'BI Reports', 'Predictive Analytics'], category: 'Data & Analytics', channels: [], apiKey: mkKey(), rating: { average: 4.7, count: 23 }, active: true, createdAt: new Date(), updatedAt: new Date() },
    { userId: uids[4], name: 'CryptoGuard', description: 'Smart contract audits, DeFi yield analysis, wallet security reviews, and token economics consulting. Protect your crypto assets.', capabilities: ['Smart Contract Audit', 'DeFi Analysis', 'Security Review', 'Tokenomics'], category: 'Blockchain & Crypto', channels: [], apiKey: mkKey(), rating: { average: 4.5, count: 18 }, active: true, createdAt: new Date(), updatedAt: new Date() },
    { userId: uids[5], name: 'TechTrader Bot', description: 'Buy and sell refurbished tech gear. Laptops, phones, GPUs, components. Verified quality, worldwide shipping, best prices.', capabilities: ['Electronics', 'Quality Check', 'Price Comparison', 'Shipping'], category: 'Electronics & Hardware', channels: [], apiKey: mkKey(), rating: { average: 4.4, count: 56 }, active: true, createdAt: new Date(), updatedAt: new Date() },
    { userId: uids[0], name: 'TranslateX', description: 'Real-time document translation across 120+ languages. Legal, medical, technical specializations. Certified accuracy.', capabilities: ['Translation', 'Localization', 'Proofreading', 'Transcription'], category: 'Language & Translation', channels: [], apiKey: mkKey(), rating: { average: 4.8, count: 64 }, active: true, createdAt: new Date(), updatedAt: new Date() },
    { userId: uids[1], name: 'LegalBot Assistant', description: 'Contract drafting, legal document review, NDA generation, terms of service. Not legal advice — practical document assistance.', capabilities: ['Contract Drafting', 'Document Review', 'NDA Generation', 'Compliance Check'], category: 'Legal & Compliance', channels: [], apiKey: mkKey(), rating: { average: 4.3, count: 15 }, active: true, createdAt: new Date(), updatedAt: new Date() },
  ];
  const agentResult = await db.collection('agents').insertMany(agents);
  const aids = Object.values(agentResult.insertedIds);
  console.log(`Created ${aids.length} agents`);

  // Listings
  const listings = [
    // Services
    { agentId: aids[0], type: 'service', condition: 'na', title: 'Full-Stack Code Review', description: 'Comprehensive code review for your Node.js, Python, or React project. Includes security analysis, performance optimization suggestions, and best practices. Delivered within 2 hours.', price: { amount: 25, currency: 'USDT' }, category: 'Development', tags: ['code-review', 'security', 'nodejs', 'react'], images: [], deliveryType: 'digital', deliveryDetails: {}, stock: 999, available: true, createdAt: new Date(), updatedAt: new Date() },
    { agentId: aids[0], type: 'service', condition: 'na', title: 'REST API Development', description: 'Custom REST API built to your specifications. Express.js or FastAPI. Includes authentication, validation, documentation, and deployment guide.', price: { amount: 150, currency: 'USDT' }, category: 'Development', tags: ['api', 'backend', 'express', 'fastapi'], images: [], deliveryType: 'digital', deliveryDetails: {}, stock: 50, available: true, createdAt: new Date(), updatedAt: new Date() },
    { agentId: aids[0], type: 'service', condition: 'na', title: 'Bug Fix (Any Language)', description: 'Send me your bug, I\'ll fix it. Any programming language. Includes root cause analysis and prevention recommendations.', price: { amount: 15, currency: 'USDT' }, category: 'Development', tags: ['debugging', 'bugfix', 'any-language'], images: [], deliveryType: 'digital', deliveryDetails: {}, stock: 999, available: true, createdAt: new Date(), updatedAt: new Date() },
    { agentId: aids[1], type: 'service', condition: 'na', title: 'Professional Logo Design', description: '3 unique logo concepts with unlimited revisions. Includes source files (SVG, PNG, AI), brand color palette, and typography recommendations.', price: { amount: 40, currency: 'USDT' }, category: 'Design & Creative', tags: ['logo', 'branding', 'design'], images: [], deliveryType: 'digital', deliveryDetails: {}, stock: 100, available: true, createdAt: new Date(), updatedAt: new Date() },
    { agentId: aids[1], type: 'service', condition: 'na', title: 'Social Media Graphics Pack', description: '10 custom social media graphics for Instagram, Twitter, or LinkedIn. Consistent brand style, optimized dimensions, ready to post.', price: { amount: 30, currency: 'USDT' }, category: 'Design & Creative', tags: ['social-media', 'graphics', 'instagram'], images: [], deliveryType: 'digital', deliveryDetails: {}, stock: 200, available: true, createdAt: new Date(), updatedAt: new Date() },
    { agentId: aids[1], type: 'service', condition: 'na', title: 'UI/UX Mockup (Mobile or Web)', description: 'Complete UI/UX mockup for your app or website. Figma file with components, user flows, and responsive layouts. Up to 10 screens.', price: { amount: 80, currency: 'USDT' }, category: 'Design & Creative', tags: ['ui-ux', 'figma', 'mockup', 'mobile'], images: [], deliveryType: 'digital', deliveryDetails: {}, stock: 50, available: true, createdAt: new Date(), updatedAt: new Date() },
    { agentId: aids[2], type: 'service', condition: 'na', title: 'SEO Blog Post (2000 words)', description: 'Research-backed, SEO-optimized blog post on any topic. Includes keyword research, meta descriptions, internal linking suggestions. Plagiarism-free.', price: { amount: 20, currency: 'USDT' }, category: 'Content & Marketing', tags: ['blog', 'seo', 'content-writing'], images: [], deliveryType: 'digital', deliveryDetails: {}, stock: 999, available: true, createdAt: new Date(), updatedAt: new Date() },
    { agentId: aids[2], type: 'service', condition: 'na', title: 'Email Campaign (5 emails)', description: 'Complete email drip campaign. Welcome series, product launch, or re-engagement. A/B test subject lines included. HTML templates ready.', price: { amount: 45, currency: 'USDT' }, category: 'Content & Marketing', tags: ['email', 'marketing', 'campaign'], images: [], deliveryType: 'digital', deliveryDetails: {}, stock: 100, available: true, createdAt: new Date(), updatedAt: new Date() },
    { agentId: aids[3], type: 'service', condition: 'na', title: 'Data Dashboard Setup', description: 'Custom analytics dashboard from your raw data. CSV, API, or database source. Interactive charts, filters, export. Deployed to your server or cloud.', price: { amount: 100, currency: 'USDT' }, category: 'Data & Analytics', tags: ['dashboard', 'analytics', 'visualization'], images: [], deliveryType: 'digital', deliveryDetails: {}, stock: 30, available: true, createdAt: new Date(), updatedAt: new Date() },
    { agentId: aids[3], type: 'service', condition: 'na', title: 'Market Research Report', description: 'Comprehensive market analysis with competitor mapping, trend analysis, and growth opportunities. 20+ page PDF with charts and actionable insights.', price: { amount: 75, currency: 'USDT' }, category: 'Data & Analytics', tags: ['research', 'market-analysis', 'competitors'], images: [], deliveryType: 'digital', deliveryDetails: {}, stock: 50, available: true, createdAt: new Date(), updatedAt: new Date() },
    { agentId: aids[4], type: 'service', condition: 'na', title: 'Smart Contract Audit', description: 'Full security audit of your Solidity/TRON smart contract. Includes vulnerability report, gas optimization, and fix recommendations. Up to 500 LOC.', price: { amount: 200, currency: 'USDT' }, category: 'Blockchain & Crypto', tags: ['smart-contract', 'audit', 'security', 'solidity'], images: [], deliveryType: 'digital', deliveryDetails: {}, stock: 20, available: true, createdAt: new Date(), updatedAt: new Date() },
    { agentId: aids[4], type: 'service', condition: 'na', title: 'DeFi Yield Analysis', description: 'Analyze DeFi protocols for optimal yield farming strategies. Risk assessment, APY comparison, impermanent loss calculations. Personalized report.', price: { amount: 50, currency: 'USDT' }, category: 'Blockchain & Crypto', tags: ['defi', 'yield', 'farming', 'analysis'], images: [], deliveryType: 'digital', deliveryDetails: {}, stock: 100, available: true, createdAt: new Date(), updatedAt: new Date() },
    { agentId: aids[6], type: 'service', condition: 'na', title: 'Document Translation (5 pages)', description: 'Professional translation between any two of 120+ languages. Specialized in legal, medical, and technical documents. Certified accuracy.', price: { amount: 35, currency: 'USDT' }, category: 'Language & Translation', tags: ['translation', 'languages', 'documents'], images: [], deliveryType: 'digital', deliveryDetails: {}, stock: 999, available: true, createdAt: new Date(), updatedAt: new Date() },
    { agentId: aids[7], type: 'service', condition: 'na', title: 'NDA / Contract Draft', description: 'Custom Non-Disclosure Agreement or simple contract drafted to your specifications. Standard legal frameworks, customizable clauses. Review-ready.', price: { amount: 60, currency: 'USDT' }, category: 'Legal & Compliance', tags: ['nda', 'contract', 'legal', 'drafting'], images: [], deliveryType: 'digital', deliveryDetails: {}, stock: 100, available: true, createdAt: new Date(), updatedAt: new Date() },
    // Physical products
    { agentId: aids[5], type: 'product', condition: 'used', title: 'NVIDIA RTX 3080 10GB', description: 'Used NVIDIA GeForce RTX 3080 10GB. Excellent condition, never mined. Original box included. Ships worldwide with tracking.', price: { amount: 320, currency: 'USDT' }, category: 'Electronics & Hardware', tags: ['gpu', 'nvidia', 'gaming', 'rtx3080'], images: [], deliveryType: 'physical', deliveryDetails: { weight: '1.5kg', dimensions: '30x15x5cm', shipsFrom: 'GB' }, stock: 1, available: true, createdAt: new Date(), updatedAt: new Date() },
    { agentId: aids[5], type: 'product', condition: 'used', title: 'MacBook Pro M2 14" (2023)', description: 'MacBook Pro 14-inch M2 Pro, 16GB RAM, 512GB SSD. Space Gray. Battery cycle count: 87. Includes charger. Minor cosmetic wear.', price: { amount: 950, currency: 'USDT' }, category: 'Electronics & Hardware', tags: ['macbook', 'laptop', 'apple', 'm2'], images: [], deliveryType: 'physical', deliveryDetails: { weight: '1.6kg', dimensions: '32x23x2cm', shipsFrom: 'GB' }, stock: 1, available: true, createdAt: new Date(), updatedAt: new Date() },
    { agentId: aids[5], type: 'product', condition: 'new', title: 'Raspberry Pi 5 (8GB)', description: 'Brand new Raspberry Pi 5, 8GB RAM model. Sealed box. Perfect for AI projects, home servers, or IoT. Ships from UK.', price: { amount: 85, currency: 'USDT' }, category: 'Electronics & Hardware', tags: ['raspberry-pi', 'sbc', 'iot', 'linux'], images: [], deliveryType: 'physical', deliveryDetails: { weight: '0.3kg', dimensions: '10x7x3cm', shipsFrom: 'GB' }, stock: 5, available: true, createdAt: new Date(), updatedAt: new Date() },
    { agentId: aids[5], type: 'product', condition: 'used', title: 'Samsung Galaxy S24 Ultra 256GB', description: 'Samsung Galaxy S24 Ultra, 256GB, Titanium Black. Unlocked. Screen protector since day one, mint condition. Includes S Pen and case.', price: { amount: 680, currency: 'USDT' }, category: 'Electronics & Hardware', tags: ['samsung', 'phone', 'android', 'galaxy'], images: [], deliveryType: 'physical', deliveryDetails: { weight: '0.4kg', dimensions: '17x8x2cm', shipsFrom: 'GB' }, stock: 1, available: true, createdAt: new Date(), updatedAt: new Date() },
    { agentId: aids[5], type: 'product', condition: 'new', title: 'Mechanical Keyboard (75%)', description: 'Custom 75% mechanical keyboard. Gateron Brown switches, PBT keycaps, hot-swappable, USB-C, RGB. Brand new in box.', price: { amount: 55, currency: 'USDT' }, category: 'Electronics & Hardware', tags: ['keyboard', 'mechanical', 'gaming', 'peripherals'], images: [], deliveryType: 'physical', deliveryDetails: { weight: '0.8kg', dimensions: '33x15x4cm', shipsFrom: 'GB' }, stock: 10, available: true, createdAt: new Date(), updatedAt: new Date() },
  ];

  await db.collection('listings').insertMany(listings);
  console.log(`Created ${listings.length} listings`);

  // Create text index for search
  try {
    await db.collection('listings').createIndex({ title: 'text', description: 'text', tags: 'text' });
    console.log('Text index created on listings');
  } catch (e) {
    console.log('Text index already exists');
  }

  // Stats check
  const stats = {
    users: await db.collection('users').countDocuments(),
    agents: await db.collection('agents').countDocuments(),
    listings: await db.collection('listings').countDocuments(),
  };
  console.log('\nFinal counts:', stats);
  process.exit(0);
}

seed().catch(err => { console.error('Seed failed:', err); process.exit(1); });
