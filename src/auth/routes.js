const express = require('express');
const crypto = require('crypto');
const { ObjectId } = require('mongodb');
const { getCollection } = require('../shared/db');
const { logAudit } = require('../shared/audit');
const { sendOTP } = require('../shared/email');
const { 
  generateSessionToken, 
  generateOTP, 
  generateMagicToken,
  generateApiKey,
  generateRecoveryCodes
} = require('../shared/auth');

const router = express.Router();

const OTP_RATE_LIMIT = 5; // per destination per hour
async function isOTPRateLimited(destination) {
  if (!destination) return false;
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const count = await getCollection('otps').countDocuments({
    destination,
    createdAt: { $gte: since }
  });
  return count >= OTP_RATE_LIMIT;
}

// ─── Register ───────────────────────────────────────────────
// Simple registration: name + (email OR phone) — no password needed
router.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, phone, agentName, agentDescription, agentCategory } = req.body;

    if (!name || (!email && !phone)) {
      return res.status(400).json({ 
        error: 'Name and either email or phone number required',
        code: 'MISSING_FIELDS'
      });
    }

    // Normalize
    const normalizedEmail = email?.toLowerCase().trim();
    const normalizedPhone = phone?.replace(/\D/g, '');
    const destination = normalizedEmail || normalizedPhone;

    if (await isOTPRateLimited(destination)) {
      return res.status(429).json({
        error: 'Too many OTP requests. Please wait and try again later.',
        code: 'OTP_RATE_LIMIT'
      });
    }

    // Check for existing user
    const existing = await getCollection('users').findOne({
      $or: [
        ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
        ...(normalizedPhone ? [{ phone: normalizedPhone }] : [])
      ]
    });

    if (existing) {
      // Account exists — auto-initiate login flow (send OTP)
      const otp = generateOTP();
      await getCollection('otps').insertOne({
        userId: existing._id.toString(),
        code: crypto.createHash('sha256').update(otp).digest('hex'),
        type: 'login',
        channel: normalizedEmail ? 'email' : 'phone',
        destination,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        createdAt: new Date()
      });

      if (normalizedEmail) {
        await sendOTP(normalizedEmail, otp);
      } else {
        console.log('[OTP] Phone delivery not configured. Destination:', destination);
      }

      return res.status(200).json({ 
        success: true,
        message: 'Account found! We sent you a login code. Check your email/phone.',
        existingAccount: true,
        userId: existing._id.toString(),
        channel: normalizedEmail ? 'email' : 'phone',
        destination: normalizedEmail ? 
          normalizedEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3') : 
          normalizedPhone.replace(/(\d{3})(\d+)(\d{2})/, '$1****$3'),
        verificationOTP: process.env.NODE_ENV === 'development' ? otp : undefined,
        _devNote: process.env.NODE_ENV === 'development' ? 
          'OTP shown in dev mode. In production, this would be sent via email/SMS.' : undefined
      });
    }

    // Create user
    const recoveryCodes = generateRecoveryCodes();
    const user = {
      name: name.trim(),
      email: normalizedEmail || null,
      phone: normalizedPhone || null,
      verified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      recoveryCodes: recoveryCodes.map(c => ({ 
        code: crypto.createHash('sha256').update(c).digest('hex'), 
        used: false 
      })),
      twoFactorChannels: [], // ['email', 'whatsapp', 'telegram']
      lastLogin: null,
      notificationPrefs: { email: true, push: false }
    };

    const result = await getCollection('users').insertOne(user);
    user._id = result.insertedId;

    // Auto-create agent if agent info provided
    let agent = null;
    if (agentName) {
      const apiKey = generateApiKey();
      agent = {
        name: agentName.trim(),
        description: agentDescription || '',
        category: agentCategory || 'General',
        ownerId: result.insertedId.toString(),
        apiKey,
        capabilities: [],
        rating: { average: 0, count: 0 },
        active: true,
        createdAt: new Date()
      };
      const agentResult = await getCollection('agents').insertOne(agent);
      agent._id = agentResult.insertedId;
    }

    // Send verification OTP
    const otp = generateOTP();
    await getCollection('otps').insertOne({
      userId: result.insertedId.toString(),
      code: crypto.createHash('sha256').update(otp).digest('hex'),
      type: 'verification',
      channel: normalizedEmail ? 'email' : 'phone',
      destination,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 min
      createdAt: new Date()
    });

    if (normalizedEmail) {
      await sendOTP(normalizedEmail, otp);
    } else {
      console.log('[OTP] Phone delivery not configured. Destination:', destination);
    }

    // Create session immediately (unverified users can browse)
    const sessionToken = generateSessionToken();
    await getCollection('sessions').insertOne({
      userId: result.insertedId.toString(),
      token: sessionToken,
      verified: false,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      lastActivity: new Date()
    });

    await logAudit('user.register', 'system', null, 'user', result.insertedId.toString(), {
      name: user.name, channel: normalizedEmail ? 'email' : 'phone'
    });

    res.status(201).json({
      success: true,
      message: 'Account created! Check your email/phone for a verification code.',
      userId: result.insertedId.toString(),
      sessionToken,
      recoveryCodes, // Show ONCE — user must save them
      agent: agent ? {
        id: agent._id.toString(),
        name: agent.name,
        apiKey: agent.apiKey
      } : null,
      verificationOTP: process.env.NODE_ENV === 'development' ? otp : undefined, // Dev only
      _devNote: process.env.NODE_ENV === 'development' ? 
        'OTP shown in dev mode. In production, this would be sent via email/SMS.' : undefined
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed', code: 'SERVER_ERROR' });
  }
});

// ─── Login (Request OTP) ────────────────────────────────────
// No password — we send an OTP to their email or phone
router.post('/api/auth/login', async (req, res) => {
  try {
    const { email, phone } = req.body;

    if (!email && !phone) {
      return res.status(400).json({ error: 'Email or phone required', code: 'MISSING_FIELDS' });
    }

    const normalizedEmail = email?.toLowerCase().trim();
    const normalizedPhone = phone?.replace(/\D/g, '');
    const destination = normalizedEmail || normalizedPhone;

    if (await isOTPRateLimited(destination)) {
      return res.status(429).json({
        error: 'Too many OTP requests. Please wait and try again later.',
        code: 'OTP_RATE_LIMIT'
      });
    }

    const user = await getCollection('users').findOne({
      $or: [
        ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
        ...(normalizedPhone ? [{ phone: normalizedPhone }] : [])
      ]
    });

    // Always respond the same to prevent user enumeration
    const otp = generateOTP();
    
    if (user) {
      await getCollection('otps').insertOne({
        userId: user._id.toString(),
        code: crypto.createHash('sha256').update(otp).digest('hex'),
        type: 'login',
        channel: normalizedEmail ? 'email' : 'phone',
        destination,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min
        createdAt: new Date()
      });

      if (normalizedEmail) {
        await sendOTP(normalizedEmail, otp);
      } else {
        console.log('[OTP] Phone delivery not configured. Destination:', destination);
      }
    }

    res.json({
      success: true,
      message: 'If an account exists, a verification code has been sent.',
      channel: normalizedEmail ? 'email' : 'phone',
      destination: normalizedEmail ? 
        normalizedEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3') : 
        normalizedPhone.replace(/(\d{3})(\d+)(\d{2})/, '$1****$3'),
      verificationOTP: process.env.NODE_ENV === 'development' ? otp : undefined
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed', code: 'SERVER_ERROR' });
  }
});

// ─── Verify OTP ─────────────────────────────────────────────
router.post('/api/auth/verify', async (req, res) => {
  try {
    const { email, phone, code } = req.body;

    if (!code || (!email && !phone)) {
      return res.status(400).json({ error: 'Code and email/phone required', code: 'MISSING_FIELDS' });
    }

    const normalizedEmail = email?.toLowerCase().trim();
    const normalizedPhone = phone?.replace(/\D/g, '');
    const hashedCode = crypto.createHash('sha256').update(code).digest('hex');

    // Find valid OTP
    const otp = await getCollection('otps').findOne({
      code: hashedCode,
      destination: normalizedEmail || normalizedPhone,
      expiresAt: { $gt: new Date() }
    });

    if (!otp) {
      return res.status(401).json({ 
        error: 'Invalid or expired code. Please try again.',
        code: 'INVALID_OTP'
      });
    }

    // Delete used OTP
    await getCollection('otps').deleteOne({ _id: otp._id });

    // Mark user as verified
    await getCollection('users').updateOne(
      { _id: new ObjectId(otp.userId) },
      { 
        $set: { verified: true, lastLogin: new Date(), updatedAt: new Date() }
      }
    );

    // Create fresh session
    const sessionToken = generateSessionToken();
    await getCollection('sessions').insertOne({
      userId: otp.userId,
      token: sessionToken,
      verified: true,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      lastActivity: new Date()
    });

    // Load user data
    const user = await getCollection('users').findOne(
      { _id: new ObjectId(otp.userId) },
      { projection: { recoveryCodes: 0 } }
    );
    const agents = await getCollection('agents').find({ 
      ownerId: otp.userId 
    }).project({ apiKey: 0 }).toArray();

    await logAudit('user.login', 'system', null, 'user', otp.userId, { 
      type: otp.type, channel: otp.channel 
    });

    res.json({
      success: true,
      message: 'Logged in successfully!',
      sessionToken,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        verified: true
      },
      agents: agents.map(a => ({
        id: a._id.toString(),
        name: a.name,
        category: a.category,
        active: a.active
      }))
    });
  } catch (err) {
    console.error('Verify error:', err);
    res.status(500).json({ error: 'Verification failed', code: 'SERVER_ERROR' });
  }
});

// ─── Magic Link Login ───────────────────────────────────────
router.post('/api/auth/magic-link', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email required', code: 'MISSING_FIELDS' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await getCollection('users').findOne({ email: normalizedEmail });
    const token = generateMagicToken();

    if (user) {
      await getCollection('magic_links').insertOne({
        userId: user._id.toString(),
        token,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min
        createdAt: new Date()
      });
    }

    res.json({
      success: true,
      message: 'If an account exists, a magic login link has been sent to your email.',
      // In production, send email with link: https://clawmarket.ai/auth/magic?token=XXX
      magicLink: process.env.NODE_ENV === 'development' ? 
        `/#/auth/magic?token=${token}` : undefined
    });
  } catch (err) {
    console.error('Magic link error:', err);
    res.status(500).json({ error: 'Failed to send magic link', code: 'SERVER_ERROR' });
  }
});

// ─── Verify Magic Link ─────────────────────────────────────
router.get('/api/auth/magic', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ error: 'Token required', code: 'MISSING_FIELDS' });
    }

    const link = await getCollection('magic_links').findOne({
      token,
      expiresAt: { $gt: new Date() }
    });

    if (!link) {
      return res.status(401).json({ error: 'Invalid or expired link', code: 'INVALID_TOKEN' });
    }

    // Delete used link
    await getCollection('magic_links').deleteOne({ _id: link._id });

    // Create session
    const sessionToken = generateSessionToken();
    await getCollection('sessions').insertOne({
      userId: link.userId,
      token: sessionToken,
      verified: true,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      lastActivity: new Date()
    });

    await getCollection('users').updateOne(
      { _id: new ObjectId(link.userId) },
      { $set: { verified: true, lastLogin: new Date() } }
    );

    const user = await getCollection('users').findOne(
      { _id: new ObjectId(link.userId) },
      { projection: { recoveryCodes: 0 } }
    );

    res.json({
      success: true,
      sessionToken,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        verified: true
      }
    });
  } catch (err) {
    console.error('Magic link verify error:', err);
    res.status(500).json({ error: 'Verification failed', code: 'SERVER_ERROR' });
  }
});

// ─── Account Recovery ───────────────────────────────────────
router.post('/api/auth/recover', async (req, res) => {
  try {
    const { email, phone, recoveryCode } = req.body;

    if (!recoveryCode || (!email && !phone)) {
      return res.status(400).json({ 
        error: 'Recovery code and email/phone required',
        code: 'MISSING_FIELDS'
      });
    }

    const normalizedEmail = email?.toLowerCase().trim();
    const normalizedPhone = phone?.replace(/\D/g, '');
    const hashedCode = crypto.createHash('sha256').update(recoveryCode.toUpperCase()).digest('hex');

    const user = await getCollection('users').findOne({
      $or: [
        ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
        ...(normalizedPhone ? [{ phone: normalizedPhone }] : [])
      ],
      'recoveryCodes.code': hashedCode,
      'recoveryCodes.used': false
    });

    if (!user) {
      return res.status(401).json({ 
        error: 'Invalid recovery code or account not found',
        code: 'INVALID_RECOVERY'
      });
    }

    // Mark recovery code as used
    await getCollection('users').updateOne(
      { _id: user._id, 'recoveryCodes.code': hashedCode },
      { $set: { 'recoveryCodes.$.used': true, updatedAt: new Date() } }
    );

    // Count remaining recovery codes
    const remaining = user.recoveryCodes.filter(c => !c.used && c.code !== hashedCode).length;

    // Create session
    const sessionToken = generateSessionToken();
    await getCollection('sessions').insertOne({
      userId: user._id.toString(),
      token: sessionToken,
      verified: true,
      recoveredAt: new Date(),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      lastActivity: new Date()
    });

    await logAudit('user.recover', 'system', null, 'user', user._id.toString(), {
      remainingCodes: remaining
    });

    res.json({
      success: true,
      message: 'Account recovered! You are now logged in.',
      sessionToken,
      remainingRecoveryCodes: remaining,
      warning: remaining <= 2 ? 
        `⚠️ You only have ${remaining} recovery codes left. Generate new ones in settings.` : undefined,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email
      }
    });
  } catch (err) {
    console.error('Recovery error:', err);
    res.status(500).json({ error: 'Recovery failed', code: 'SERVER_ERROR' });
  }
});

// ─── Get Current Session ────────────────────────────────────
router.get('/api/auth/me', async (req, res) => {
  try {
    const token = req.headers['authorization']?.replace('Bearer ', '') || 
                  req.query.sessionToken;

    if (!token) {
      return res.json({ authenticated: false });
    }

    const session = await getCollection('sessions').findOne({
      token,
      expiresAt: { $gt: new Date() }
    });

    if (!session) {
      return res.json({ authenticated: false });
    }

    // Update last activity
    await getCollection('sessions').updateOne(
      { _id: session._id },
      { $set: { lastActivity: new Date() } }
    );

    const user = await getCollection('users').findOne(
      { _id: new ObjectId(session.userId) },
      { projection: { recoveryCodes: 0 } }
    );

    if (!user) {
      return res.json({ authenticated: false });
    }

    const agents = await getCollection('agents').find({ 
      ownerId: session.userId 
    }).project({ apiKey: 0 }).toArray();

    res.json({
      authenticated: true,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        verified: user.verified
      },
      agents: agents.map(a => ({
        id: a._id.toString(),
        name: a.name,
        category: a.category,
        active: a.active
      }))
    });
  } catch (err) {
    console.error('Auth check error:', err);
    res.json({ authenticated: false });
  }
});

// ─── Logout ─────────────────────────────────────────────────
router.post('/api/auth/logout', async (req, res) => {
  try {
    const token = req.headers['authorization']?.replace('Bearer ', '');
    if (token) {
      await getCollection('sessions').deleteOne({ token });
    }
    res.json({ success: true, message: 'Logged out' });
  } catch (err) {
    res.json({ success: true });
  }
});

// ─── Regenerate Recovery Codes ──────────────────────────────
router.post('/api/auth/recovery-codes', async (req, res) => {
  try {
    const token = req.headers['authorization']?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Not authenticated', code: 'AUTH_REQUIRED' });
    }

    const session = await getCollection('sessions').findOne({
      token,
      expiresAt: { $gt: new Date() }
    });

    if (!session) {
      return res.status(401).json({ error: 'Session expired', code: 'SESSION_EXPIRED' });
    }

    const newCodes = generateRecoveryCodes();
    await getCollection('users').updateOne(
      { _id: new ObjectId(session.userId) },
      { 
        $set: { 
          recoveryCodes: newCodes.map(c => ({
            code: crypto.createHash('sha256').update(c).digest('hex'),
            used: false
          })),
          updatedAt: new Date()
        }
      }
    );

    res.json({
      success: true,
      recoveryCodes: newCodes,
      message: '⚠️ Save these codes now — they won\'t be shown again!'
    });
  } catch (err) {
    console.error('Recovery codes error:', err);
    res.status(500).json({ error: 'Failed to regenerate codes', code: 'SERVER_ERROR' });
  }
});

module.exports = router;
