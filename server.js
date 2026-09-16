const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3030;
const DB_FILE = path.join(__dirname, 'data', 'db.json');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/img', express.static(path.join(__dirname, 'img')));

// Helper: Read DB
function readDB() {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const data = JSON.parse(raw);
    if (data && Array.isArray(data.gifts)) {
      data.gifts = data.gifts.map(normalizeGift);
    }
    return data;
  } catch (err) {
    console.error('Error reading db.json:', err);
    return {
      settings: {},
      metrics: { views: 0, uniqueVisitors: 0, clicks: {}, history: [] },
      rsvps: [],
      gifts: []
    };
  }
}

// Helper: Normalize gift structure for multiple quantities & reservations
function normalizeGift(gift) {
  if (!gift) return gift;
  const qty = parseInt(gift.quantity, 10);
  gift.quantity = (!isNaN(qty) && qty >= 1) ? qty : 1;

  if (!Array.isArray(gift.reservations)) {
    if (gift.reserved && gift.reservedBy) {
      gift.reservations = [{
        id: 'res_legacy_' + (gift.id || Date.now()),
        name: gift.reservedBy.name || 'Convidado',
        phone: gift.reservedBy.phone || '',
        reservedAt: gift.reservedBy.reservedAt || new Date().toISOString()
      }];
    } else {
      gift.reservations = [];
    }
  }

  // Synchronize flags
  gift.reserved = gift.reservations.length >= gift.quantity;
  gift.reservedBy = gift.reservations.length > 0 ? gift.reservations[0] : null;
  return gift;
}

// Helper: Write DB safely
function writeDB(data) {
  try {
    if (data && Array.isArray(data.gifts)) {
      data.gifts = data.gifts.map(normalizeGift);
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing db.json:', err);
    return false;
  }
}

// Admin Auth Middleware
function checkAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const pin = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
  const db = readDB();
  const validPin = (db.settings && db.settings.adminPin) || 'Noah2026Admin';

  if (!pin || pin !== validPin) {
    return res.status(401).json({ error: 'Não autorizado. Senha/PIN incorreto.' });
  }
  next();
}

// ========================
// PUBLIC ROUTES & APIS
// ========================

// GET Public Info
app.get('/api/info', (req, res) => {
  const db = readDB();
  const { adminPin, ...safeSettings } = db.settings;
  const totalRsvps = (db.rsvps || []).reduce((acc, curr) => acc + (parseInt(curr.guestsCount, 10) || 1), 0);
  res.json({
    ...safeSettings,
    totalConfirmedCount: totalRsvps
  });
});

// POST Track (Page views, unique visitors, button clicks)
app.post('/api/track', (req, res) => {
  const { event, button, visitorId } = req.body;
  const db = readDB();

  if (!db.metrics) {
    db.metrics = { views: 0, uniqueVisitors: 0, clicks: {}, history: [] };
  }
  if (!db.metrics.clicks) {
    db.metrics.clicks = {};
  }
  if (!db.metrics.history) {
    db.metrics.history = [];
  }

  if (event === 'page_view') {
    db.metrics.views = (db.metrics.views || 0) + 1;
    // Check if visitorId is already in recent history
    const isReturning = visitorId && db.metrics.history.some(h => h.visitorId === visitorId);
    if (!isReturning) {
      db.metrics.uniqueVisitors = (db.metrics.uniqueVisitors || 0) + 1;
    }
    // Keep max 200 items in history
    db.metrics.history.unshift({
      event: 'page_view',
      visitorId: visitorId || 'anonymous',
      timestamp: new Date().toISOString()
    });
    if (db.metrics.history.length > 200) db.metrics.history.pop();
  } else if (event === 'click' && button) {
    db.metrics.clicks[button] = (db.metrics.clicks[button] || 0) + 1;
    db.metrics.history.unshift({
      event: 'click',
      button,
      visitorId: visitorId || 'anonymous',
      timestamp: new Date().toISOString()
    });
    if (db.metrics.history.length > 200) db.metrics.history.pop();
  }

  writeDB(db);
  res.json({ success: true });
});

// POST RSVP (Guest confirmation)
app.post('/api/rsvp', (req, res) => {
  const { name, phone, guestsCount, message } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Por favor, informe seu nome.' });
  }
  if (!phone || !phone.trim()) {
    return res.status(400).json({ error: 'Por favor, informe seu WhatsApp/telefone.' });
  }

  const db = readDB();
  const count = parseInt(guestsCount, 10) || 1;

  const newRsvp = {
    id: 'rsvp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    name: name.trim(),
    phone: phone.trim(),
    guestsCount: Math.max(1, count),
    message: (message || '').trim(),
    createdAt: new Date().toISOString()
  };

  db.rsvps.unshift(newRsvp);

  // Track the successful confirmation click as well
  if (!db.metrics.clicks) db.metrics.clicks = {};
  db.metrics.clicks['btn_confirmar_submit'] = (db.metrics.clicks['btn_confirmar_submit'] || 0) + 1;

  writeDB(db);

  res.json({
    success: true,
    message: 'Presença confirmada com sucesso! Muito obrigado pelo carinho.',
    rsvp: newRsvp,
    momPhone: (db.settings && db.settings.momPhone) || ''
  });
});

// GET Gifts
app.get('/api/gifts', (req, res) => {
  const db = readDB();
  res.json(db.gifts || []);
});

// POST Reserve Gift
app.post('/api/gifts/reserve', (req, res) => {
  const { giftId, guestName, guestPhone } = req.body;
  if (!giftId || !guestName || !guestName.trim()) {
    return res.status(400).json({ error: 'Por favor, informe seu nome para registrar o presente.' });
  }

  const db = readDB();
  const gift = (db.gifts || []).find(g => g.id === giftId);

  if (!gift) {
    return res.status(404).json({ error: 'Presente não encontrado.' });
  }

  normalizeGift(gift);

  if (gift.reservations.length >= gift.quantity) {
    return res.status(400).json({ error: 'Todas as unidades deste presente já foram reservadas. Muito obrigado pelo carinho!' });
  }

  const newReservation = {
    id: 'res_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    name: guestName.trim(),
    phone: guestPhone ? guestPhone.trim() : '',
    reservedAt: new Date().toISOString()
  };

  gift.reservations.push(newReservation);
  normalizeGift(gift);

  writeDB(db);

  const remaining = Math.max(0, gift.quantity - gift.reservations.length);
  res.json({
    success: true,
    message: `Presente "${gift.title}" reservado com sucesso!`,
    gift,
    remaining
  });
});

// ========================
// ADMIN APIS
// ========================

// Admin Login
app.post('/api/admin/login', (req, res) => {
  const { pin } = req.body;
  if (!pin || typeof pin !== 'string' || !pin.trim()) {
    return res.status(400).json({ error: 'Por favor, digite a senha.' });
  }

  const db = readDB();
  const validPin = (db.settings && db.settings.adminPin) || 'Noah2026Admin';

  if (pin.trim() === validPin) {
    return res.json({ success: true, token: validPin });
  }
  return res.status(401).json({ error: 'Senha incorreta. Tente novamente.' });
});

// Admin Dashboard Stats & Data
app.get('/api/admin/dashboard', checkAdminAuth, (req, res) => {
  const db = readDB();
  const totalGuests = (db.rsvps || []).reduce((acc, curr) => acc + (parseInt(curr.guestsCount, 10) || 1), 0);
  const totalResponses = (db.rsvps || []).length;
  const gifts = db.gifts || [];
  const reservedUnits = gifts.reduce((acc, g) => acc + ((g.reservations && g.reservations.length) || 0), 0);
  const totalUnits = gifts.reduce((acc, g) => acc + (g.quantity || 1), 0);

  res.json({
    metrics: db.metrics || { views: 0, uniqueVisitors: 0, clicks: {} },
    totalGuests,
    totalResponses,
    reservedGiftsCount: reservedUnits,
    totalGiftsCount: totalUnits,
    totalItemsCount: gifts.length,
    rsvps: db.rsvps || [],
    settings: db.settings || {},
    gifts: gifts
  });
});

// Admin Delete RSVP
app.delete('/api/admin/rsvp/:id', checkAdminAuth, (req, res) => {
  const { id } = req.params;
  const db = readDB();
  db.rsvps = (db.rsvps || []).filter(r => r.id !== id);
  writeDB(db);
  res.json({ success: true, message: 'Presença removida com sucesso.' });
});

// Admin Manual Add RSVP
app.post('/api/admin/rsvp/manual', checkAdminAuth, (req, res) => {
  const { name, phone, guestsCount, message } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome é obrigatório.' });

  const db = readDB();
  const newRsvp = {
    id: 'rsvp_manual_' + Date.now(),
    name: name.trim(),
    phone: (phone || '').trim(),
    guestsCount: parseInt(guestsCount, 10) || 1,
    message: (message || 'Adicionado manualmente pela mamãe').trim(),
    createdAt: new Date().toISOString()
  };
  db.rsvps.unshift(newRsvp);
  writeDB(db);
  res.json({ success: true, rsvp: newRsvp });
});

// Admin Update Settings
app.put('/api/admin/settings', checkAdminAuth, (req, res) => {
  const newSettings = req.body;
  const db = readDB();
  db.settings = {
    ...db.settings,
    ...newSettings
  };
  writeDB(db);
  res.json({ success: true, settings: db.settings });
});

// Admin Export CSV
app.get('/api/admin/export-csv', checkAdminAuth, (req, res) => {
  const db = readDB();
  const rsvps = db.rsvps || [];

  // UTF-8 BOM for Microsoft Excel compatibility
  let csv = '\uFEFF"Nome";"WhatsApp";"Qtd Pessoas";"Mensagem";"Data de Confirmação"\n';

  rsvps.forEach(r => {
    const dateFormatted = new Date(r.createdAt).toLocaleString('pt-BR');
    const safeName = (r.name || '').replace(/"/g, '""');
    const safePhone = (r.phone || '').replace(/"/g, '""');
    const safeMsg = (r.message || '').replace(/"/g, '""');
    csv += `"${safeName}";"${safePhone}";"${r.guestsCount}";"${safeMsg}";"${dateFormatted}"\n`;
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="convidados-cha-do-noah.csv"');
  res.send(csv);
});

// Admin Reset Metrics
app.post('/api/admin/metrics/reset', checkAdminAuth, (req, res) => {
  const db = readDB();
  db.metrics = {
    views: 0,
    uniqueVisitors: 0,
    clicks: {
      btn_local: 0,
      btn_presentes: 0,
      btn_rsvp: 0,
      btn_pix: 0,
      btn_waze: 0,
      btn_maps: 0,
      btn_confirmar_submit: 0
    },
    history: []
  };
  writeDB(db);
  res.json({ success: true, message: 'Métricas zeradas com sucesso.' });
});

// Admin Unreserve Gift (releases all or a specific reservation)
app.post('/api/admin/gift/unreserve', checkAdminAuth, (req, res) => {
  const { giftId, reservationId } = req.body;
  const db = readDB();
  const gift = (db.gifts || []).find(g => g.id === giftId);
  if (gift) {
    normalizeGift(gift);
    if (reservationId) {
      gift.reservations = (gift.reservations || []).filter(r => r.id !== reservationId);
    } else {
      gift.reservations = [];
    }
    normalizeGift(gift);
    writeDB(db);
  }
  res.json({ success: true, gift });
});

// Admin Add Gift
app.post('/api/admin/gifts', checkAdminAuth, (req, res) => {
  const { title, category, brand, quantity } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'O nome do presente é obrigatório.' });
  }

  const db = readDB();
  if (!db.gifts) db.gifts = [];

  const qty = parseInt(quantity, 10);

  const newGift = {
    id: 'g_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    title: title.trim(),
    category: (category || 'Enxoval').trim(),
    brand: (brand || '').trim(),
    quantity: (!isNaN(qty) && qty >= 1) ? qty : 1,
    reservations: [],
    reserved: false,
    reservedBy: null
  };

  db.gifts.push(newGift);
  writeDB(db);

  res.json({ success: true, message: 'Presente adicionado com sucesso!', gift: newGift });
});

// Admin Update Gift
app.put('/api/admin/gifts/:id', checkAdminAuth, (req, res) => {
  const { id } = req.params;
  const { title, category, brand, quantity, reserved } = req.body;

  const db = readDB();
  const giftIndex = (db.gifts || []).findIndex(g => g.id === id);

  if (giftIndex === -1) {
    return res.status(404).json({ error: 'Presente não encontrado.' });
  }

  const gift = db.gifts[giftIndex];
  if (title !== undefined && title.trim()) gift.title = title.trim();
  if (category !== undefined && category.trim()) gift.category = category.trim();
  if (brand !== undefined) gift.brand = brand.trim();
  if (quantity !== undefined) {
    const qty = parseInt(quantity, 10);
    if (!isNaN(qty) && qty >= 1) {
      gift.quantity = qty;
    }
  }

  if (reserved === false) {
    gift.reservations = [];
  }

  normalizeGift(gift);
  writeDB(db);
  res.json({ success: true, message: 'Presente atualizado com sucesso!', gift });
});

// Admin Delete Gift
app.delete('/api/admin/gifts/:id', checkAdminAuth, (req, res) => {
  const { id } = req.params;
  const db = readDB();

  const initialLength = (db.gifts || []).length;
  db.gifts = (db.gifts || []).filter(g => g.id !== id);

  if (db.gifts.length === initialLength) {
    return res.status(404).json({ error: 'Presente não encontrado.' });
  }

  writeDB(db);
  res.json({ success: true, message: 'Presente removido com sucesso.' });
});


// Direct Page Routes
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Versão 1 da tela inicial na rota /2
app.get(['/2', '/v1', '/versao1'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'versao2.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`✨ Chá de Bebê do Noah - Servidor Online!`);
  console.log(`🌐 Site Principal: http://localhost:${PORT}`);
  console.log(`👑 Painel da Mamãe: http://localhost:${PORT}/admin (Senha padrão: Noah2026Admin)`);
  console.log(`========================================\n`);
});
