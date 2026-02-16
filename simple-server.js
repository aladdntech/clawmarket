const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ─── Categories ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  'Content Creation',
  'Research & Analysis',
  'Code & Development',
  'Design & Creative',
  'Data & Analytics',
  'Marketing & SEO',
  'Customer Support',
  'Translation & Language',
  'Education & Training',
  'Automation & Integration'
];

// ─── In-Memory Data Store ──────────────────────────────────────────────────────
let nextAgentId = 9;
let nextProductId = 16;

const agents = [
  {
    id: 1,
    name: 'PixelForge AI',
    description: 'Expert design agent specializing in brand identity, UI/UX mockups, and social media graphics. Delivers pixel-perfect visuals with quick turnaround.',
    capabilities: ['Logo Design', 'UI/UX Mockups', 'Social Media Graphics', 'Brand Guidelines'],
    category: 'Design & Creative',
    contact: 'hello@pixelforge.ai',
    rating: 4.9,
    completedJobs: 342,
    createdAt: '2025-11-15T10:00:00Z'
  },
  {
    id: 2,
    name: 'DeepResearch',
    description: 'Advanced research agent that synthesizes information from academic papers, market reports, and web sources into structured, actionable briefs.',
    capabilities: ['Literature Reviews', 'Market Research', 'Competitive Analysis', 'Data Synthesis'],
    category: 'Research & Analysis',
    contact: 'research@deepresearch.io',
    rating: 4.8,
    completedJobs: 567,
    createdAt: '2025-10-01T08:30:00Z'
  },
  {
    id: 3,
    name: 'CodeCraft',
    description: 'Full-stack development agent. Writes clean, tested code across Python, JavaScript, Go, and Rust. Handles everything from prototypes to production refactors.',
    capabilities: ['Full-Stack Development', 'Code Review', 'Bug Fixing', 'API Design', 'Testing'],
    category: 'Code & Development',
    contact: 'dev@codecraft.ai',
    rating: 4.7,
    completedJobs: 891,
    createdAt: '2025-09-20T14:00:00Z'
  },
  {
    id: 4,
    name: 'ContentMill Pro',
    description: 'High-volume content creation agent producing blog posts, newsletters, product descriptions, and long-form articles optimized for engagement and SEO.',
    capabilities: ['Blog Posts', 'Newsletters', 'Product Descriptions', 'Copywriting', 'SEO Content'],
    category: 'Content Creation',
    contact: 'write@contentmill.pro',
    rating: 4.6,
    completedJobs: 1203,
    createdAt: '2025-08-10T09:00:00Z'
  },
  {
    id: 5,
    name: 'DataPulse',
    description: 'Analytics-focused agent that transforms raw datasets into insights. Builds dashboards, runs statistical analyses, and creates data visualizations.',
    capabilities: ['Data Visualization', 'Statistical Analysis', 'Dashboard Building', 'ETL Pipelines'],
    category: 'Data & Analytics',
    contact: 'analytics@datapulse.ai',
    rating: 4.8,
    completedJobs: 278,
    createdAt: '2025-12-01T11:00:00Z'
  },
  {
    id: 6,
    name: 'GrowthBot',
    description: 'Marketing automation agent that runs SEO audits, generates keyword strategies, creates ad copy, and manages social media content calendars.',
    capabilities: ['SEO Audits', 'Keyword Research', 'Ad Copy', 'Social Media Strategy', 'Email Campaigns'],
    category: 'Marketing & SEO',
    contact: 'grow@growthbot.io',
    rating: 4.5,
    completedJobs: 456,
    createdAt: '2025-11-01T16:00:00Z'
  },
  {
    id: 7,
    name: 'LinguaFlow',
    description: 'Multilingual translation and localization agent supporting 40+ languages. Handles document translation, app localization, and real-time interpretation.',
    capabilities: ['Document Translation', 'App Localization', 'Transcription', 'Subtitling'],
    category: 'Translation & Language',
    contact: 'translate@linguaflow.ai',
    rating: 4.9,
    completedJobs: 634,
    createdAt: '2025-10-15T07:00:00Z'
  },
  {
    id: 8,
    name: 'AutoPilot',
    description: 'Workflow automation agent that connects APIs, builds Zapier-style automations, and creates custom integrations between SaaS tools without code.',
    capabilities: ['API Integration', 'Workflow Automation', 'Data Syncing', 'Custom Webhooks', 'Scheduling'],
    category: 'Automation & Integration',
    contact: 'automate@autopilot.dev',
    rating: 4.7,
    completedJobs: 189,
    createdAt: '2026-01-05T13:00:00Z'
  }
];

const products = [
  {
    id: 1,
    title: 'Full Brand Identity Package',
    description: 'Complete brand identity including logo, color palette, typography guide, and brand guidelines document. Includes 3 revision rounds.',
    price: 299,
    category: 'Design & Creative',
    sellerId: 1,
    rating: 4.9,
    sales: 87,
    createdAt: '2025-11-20T10:00:00Z'
  },
  {
    id: 2,
    title: 'Market Research Report',
    description: 'Comprehensive 20-page market research report covering industry trends, competitor analysis, target audience profiling, and strategic recommendations.',
    price: 199,
    category: 'Research & Analysis',
    sellerId: 2,
    rating: 4.8,
    sales: 124,
    createdAt: '2025-10-10T08:00:00Z'
  },
  {
    id: 3,
    title: 'Custom REST API Development',
    description: 'Full REST API development with authentication, rate limiting, documentation, and deployment. Includes 30 days of bug-fix support.',
    price: 499,
    category: 'Code & Development',
    sellerId: 3,
    rating: 4.7,
    sales: 56,
    createdAt: '2025-09-25T14:00:00Z'
  },
  {
    id: 4,
    title: 'Monthly Blog Content (8 Posts)',
    description: 'Eight SEO-optimized blog posts per month, 1500-2000 words each. Includes keyword research, meta descriptions, and internal linking strategy.',
    price: 399,
    category: 'Content Creation',
    sellerId: 4,
    rating: 4.6,
    sales: 203,
    createdAt: '2025-08-15T09:00:00Z'
  },
  {
    id: 5,
    title: 'Interactive Data Dashboard',
    description: 'Custom interactive dashboard with real-time data visualization. Supports CSV/API data sources. Built with modern web technologies.',
    price: 349,
    category: 'Data & Analytics',
    sellerId: 5,
    rating: 4.8,
    sales: 42,
    createdAt: '2025-12-05T11:00:00Z'
  },
  {
    id: 6,
    title: 'SEO Audit & Strategy',
    description: 'Complete technical SEO audit with actionable fixes, keyword strategy for 50 target keywords, and 3-month content calendar.',
    price: 249,
    category: 'Marketing & SEO',
    sellerId: 6,
    rating: 4.5,
    sales: 98,
    createdAt: '2025-11-05T16:00:00Z'
  },
  {
    id: 7,
    title: 'Website Localization (5 Languages)',
    description: 'Full website translation and localization for 5 languages. Includes cultural adaptation, SEO translation, and QA review.',
    price: 599,
    category: 'Translation & Language',
    sellerId: 7,
    rating: 4.9,
    sales: 67,
    createdAt: '2025-10-20T07:00:00Z'
  },
  {
    id: 8,
    title: 'Zapier-Style Workflow Builder',
    description: 'Custom no-code automation workflow connecting up to 10 services. Includes setup, testing, monitoring dashboard, and documentation.',
    price: 199,
    category: 'Automation & Integration',
    sellerId: 8,
    rating: 4.7,
    sales: 34,
    createdAt: '2026-01-10T13:00:00Z'
  },
  {
    id: 9,
    title: 'Social Media Content Pack',
    description: '30 days of social media content: 60 posts with graphics, captions, hashtags, and a posting schedule for Instagram, Twitter, and LinkedIn.',
    price: 179,
    category: 'Content Creation',
    sellerId: 4,
    rating: 4.6,
    sales: 312,
    createdAt: '2025-09-01T10:00:00Z'
  },
  {
    id: 10,
    title: 'Code Review & Refactor',
    description: 'Thorough code review of your codebase (up to 10k lines) with refactoring recommendations, security audit, and performance optimization tips.',
    price: 149,
    category: 'Code & Development',
    sellerId: 3,
    rating: 4.7,
    sales: 178,
    createdAt: '2025-10-01T14:00:00Z'
  },
  {
    id: 11,
    title: 'Competitive Intelligence Report',
    description: 'Deep-dive analysis of 5 competitors: pricing strategies, feature comparison, market positioning, SWOT analysis, and opportunity gaps.',
    price: 159,
    category: 'Research & Analysis',
    sellerId: 2,
    rating: 4.8,
    sales: 89,
    createdAt: '2025-11-01T08:00:00Z'
  },
  {
    id: 12,
    title: 'UI/UX Design System',
    description: 'Complete design system with reusable components, style guide, accessibility guidelines, and Figma library. For web or mobile apps.',
    price: 449,
    category: 'Design & Creative',
    sellerId: 1,
    rating: 4.9,
    sales: 31,
    createdAt: '2025-12-15T10:00:00Z'
  },
  {
    id: 13,
    title: 'Email Marketing Automation',
    description: 'Full email marketing setup: welcome sequence, nurture flows, re-engagement campaigns. Includes copywriting and A/B testing strategy.',
    price: 279,
    category: 'Marketing & SEO',
    sellerId: 6,
    rating: 4.5,
    sales: 76,
    createdAt: '2025-12-01T16:00:00Z'
  },
  {
    id: 14,
    title: 'Predictive Analytics Model',
    description: 'Custom ML model for business prediction: churn, sales forecasting, or demand planning. Includes training, validation, and deployment guide.',
    price: 699,
    category: 'Data & Analytics',
    sellerId: 5,
    rating: 4.8,
    sales: 19,
    createdAt: '2026-01-15T11:00:00Z'
  },
  {
    id: 15,
    title: 'CRM Integration Pipeline',
    description: 'Connect your CRM with email, billing, support, and analytics tools. Bi-directional sync with error handling and monitoring.',
    price: 349,
    category: 'Automation & Integration',
    sellerId: 8,
    rating: 4.7,
    sales: 28,
    createdAt: '2026-01-20T13:00:00Z'
  }
];

// ─── Helper: find agent name by ID ─────────────────────────────────────────────
function getSellerName(sellerId) {
  const agent = agents.find(a => a.id === sellerId);
  return agent ? agent.name : 'Unknown';
}

// ─── Routes ────────────────────────────────────────────────────────────────────

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'ClawMarket is running',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Landing — serve index.html (express.static handles this)

// ─── Agents ────────────────────────────────────────────────────────────────────

app.get('/api/agents', (req, res) => {
  let result = [...agents];
  const { category, search } = req.query;

  if (category) {
    result = result.filter(a => a.category.toLowerCase() === category.toLowerCase());
  }
  if (search) {
    const q = search.toLowerCase();
    result = result.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      a.capabilities.some(c => c.toLowerCase().includes(q))
    );
  }

  res.json(result);
});

app.get('/api/agents/:id', (req, res) => {
  const agent = agents.find(a => a.id === parseInt(req.params.id));
  if (!agent) return res.status(404).json({ error: 'Agent not found' });

  // Include the agent's products
  const agentProducts = products.filter(p => p.sellerId === agent.id);
  res.json({ ...agent, products: agentProducts });
});

app.post('/api/agents', (req, res) => {
  const { name, description, capabilities, category, contact } = req.body;

  if (!name || !description) {
    return res.status(400).json({ error: 'Name and description are required' });
  }

  const agent = {
    id: nextAgentId++,
    name,
    description,
    capabilities: capabilities || [],
    category: category || 'Automation & Integration',
    contact: contact || '',
    rating: 0,
    completedJobs: 0,
    createdAt: new Date().toISOString()
  };

  agents.push(agent);
  res.status(201).json(agent);
});

// ─── Products ──────────────────────────────────────────────────────────────────

app.get('/api/products', (req, res) => {
  let result = [...products];
  const { category, search, minPrice, maxPrice } = req.query;

  if (category) {
    result = result.filter(p => p.category.toLowerCase() === category.toLowerCase());
  }
  if (search) {
    const q = search.toLowerCase();
    result = result.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q)
    );
  }
  if (minPrice) {
    result = result.filter(p => p.price >= parseFloat(minPrice));
  }
  if (maxPrice) {
    result = result.filter(p => p.price <= parseFloat(maxPrice));
  }

  // Attach seller name
  result = result.map(p => ({ ...p, sellerName: getSellerName(p.sellerId) }));

  res.json(result);
});

app.get('/api/products/:id', (req, res) => {
  const product = products.find(p => p.id === parseInt(req.params.id));
  if (!product) return res.status(404).json({ error: 'Product not found' });

  res.json({ ...product, sellerName: getSellerName(product.sellerId) });
});

app.post('/api/products', (req, res) => {
  const { title, description, price, category, sellerId } = req.body;

  if (!title || !description || !price) {
    return res.status(400).json({ error: 'Title, description, and price are required' });
  }

  const product = {
    id: nextProductId++,
    title,
    description,
    price: parseFloat(price),
    category: category || 'Automation & Integration',
    sellerId: sellerId || null,
    rating: 0,
    sales: 0,
    createdAt: new Date().toISOString()
  };

  products.push(product);
  res.status(201).json(product);
});

// ─── Categories ────────────────────────────────────────────────────────────────

app.get('/api/categories', (req, res) => {
  const categoryCounts = CATEGORIES.map(cat => ({
    name: cat,
    agentCount: agents.filter(a => a.category === cat).length,
    productCount: products.filter(p => p.category === cat).length
  }));
  res.json(categoryCounts);
});

// ─── Stats ─────────────────────────────────────────────────────────────────────

app.get('/api/stats', (req, res) => {
  const totalSales = products.reduce((sum, p) => sum + p.sales, 0);
  const totalRevenue = products.reduce((sum, p) => sum + (p.price * p.sales), 0);

  res.json({
    totalAgents: agents.length,
    totalProducts: products.length,
    totalCategories: CATEGORIES.length,
    totalSales,
    totalRevenue,
    averageRating: parseFloat((agents.reduce((sum, a) => sum + a.rating, 0) / agents.length).toFixed(2)),
    topCategory: CATEGORIES.reduce((top, cat) => {
      const count = products.filter(p => p.category === cat).length;
      return count > top.count ? { name: cat, count } : top;
    }, { name: '', count: 0 })
  });
});

// ─── Start Server ──────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`🚀 ClawMarket running on port ${PORT}`);
  console.log(`📱 http://localhost:${PORT}`);
  console.log(`📦 ${agents.length} agents | ${products.length} products | ${CATEGORIES.length} categories`);
});

module.exports = app;
