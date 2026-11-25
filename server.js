// Ding Chat server: Express + Socket.IO + PostgreSQL
const express = require('express');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { Pool, types } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');

types.setTypeParser(20, v => parseInt(v, 10)); // BIGINT -> number

const PORT = process.env.PORT || 3000;
const PROD = process.env.NODE_ENV === 'production';
// The owner account: username YoOrange (usernames are stored in lowercase). Can be changed with OWNER_USERNAME.
const OWNER_USERNAME = String(process.env.OWNER_USERNAME || 'yoorange').trim().toLowerCase();
const OWNER_EMAIL = String(process.env.OWNER_EMAIL || '').trim().toLowerCase(); // optional extra owner by email
let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  JWT_SECRET = crypto.randomBytes(32).toString('hex');
  console.warn('JWT_SECRET is not set: using a random one, so everyone is logged out when the server restarts.');
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Point it at a PostgreSQL database (see README.md).');
  process.exit(1);
}
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
  max: 10,
});
const q = (text, params) => pool.query(text, params);
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 11);

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users(
  id SERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL, username TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
  password_hash TEXT NOT NULL, color TEXT NOT NULL DEFAULT '#2f5bff', photo TEXT, token_version INT NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS images(
  id TEXT PRIMARY KEY, owner_id INT REFERENCES users(id) ON DELETE CASCADE, mime TEXT NOT NULL, data BYTEA NOT NULL,
  created_at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS friend_requests(
  from_id INT REFERENCES users(id) ON DELETE CASCADE, to_id INT REFERENCES users(id) ON DELETE CASCADE,
  created_at BIGINT NOT NULL, PRIMARY KEY(from_id, to_id));
CREATE TABLE IF NOT EXISTS friends(
  user_id INT REFERENCES users(id) ON DELETE CASCADE, friend_id INT REFERENCES users(id) ON DELETE CASCADE,
  created_at BIGINT NOT NULL, PRIMARY KEY(user_id, friend_id));
CREATE TABLE IF NOT EXISTS chats(
  id SERIAL PRIMARY KEY, type TEXT NOT NULL, name TEXT, leader_id INT REFERENCES users(id) ON DELETE SET NULL,
  dm_key TEXT UNIQUE, created_at BIGINT NOT NULL, last_at BIGINT NOT NULL DEFAULT 0, last_text TEXT NOT NULL DEFAULT '',
  last_from INT);
CREATE TABLE IF NOT EXISTS chat_members(
  chat_id INT REFERENCES chats(id) ON DELETE CASCADE, user_id INT REFERENCES users(id) ON DELETE CASCADE,
  last_read BIGINT NOT NULL DEFAULT 0, joined_at BIGINT NOT NULL DEFAULT 0, PRIMARY KEY(chat_id, user_id));
CREATE TABLE IF NOT EXISTS messages(
  id SERIAL PRIMARY KEY, chat_id INT REFERENCES chats(id) ON DELETE CASCADE, user_id INT REFERENCES users(id) ON DELETE SET NULL,
  text TEXT NOT NULL DEFAULT '', image_id TEXT, image_w INT, image_h INT, reply_to INT, sys BOOLEAN NOT NULL DEFAULT FALSE,
  edited BOOLEAN NOT NULL DEFAULT FALSE, deleted BOOLEAN NOT NULL DEFAULT FALSE, created_at BIGINT NOT NULL);
CREATE INDEX IF NOT EXISTS messages_chat_idx ON messages(chat_id, id DESC);
CREATE INDEX IF NOT EXISTS chat_members_user_idx ON chat_members(user_id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_until BIGINT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_by INT;
CREATE TABLE IF NOT EXISTS warnings(
  id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id) ON DELETE CASCADE, mod_id INT REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL, seen BOOLEAN NOT NULL DEFAULT FALSE, created_at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS reports(
  id SERIAL PRIMARY KEY, reporter_id INT REFERENCES users(id) ON DELETE CASCADE, target_id INT REFERENCES users(id) ON DELETE CASCADE,
  message_id INT, message_text TEXT, message_img TEXT, reason TEXT NOT NULL, details TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open', handled_by INT, handled_at BIGINT, created_at BIGINT NOT NULL);
CREATE INDEX IF NOT EXISTS reports_status_idx ON reports(status, id DESC);
CREATE TABLE IF NOT EXISTS report_items(
  report_id INT REFERENCES reports(id) ON DELETE CASCADE, message_id INT NOT NULL, chat_id INT, text TEXT NOT NULL DEFAULT '',
  image_id TEXT, sent_at BIGINT, PRIMARY KEY(report_id, message_id));
ALTER TABLE messages ADD COLUMN IF NOT EXISTS orig_text TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS orig_image TEXT;
`;

// ---------- helpers ----------
class HttpErr extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const fail = (status, msg) => { throw new HttpErr(status, msg); };
const h = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const now = () => Date.now();
const isOwner = u => u.username === OWNER_USERNAME || (!!OWNER_EMAIL && u.email === OWNER_EMAIL);
const roleOf = u => isOwner(u) ? 'owner' : (['senior', 'mod'].includes(u.role) ? u.role : 'user');
const RANK = { user: 0, mod: 1, senior: 2, owner: 3 };
const rankOf = u => RANK[roleOf(u)];
const PERMA = 8.64e15; // "forever"
const banInfo = u => (u.banned_until && u.banned_until > Date.now()) ? { until: u.banned_until, permanent: u.banned_until >= PERMA, reason: u.ban_reason || '' } : null;
const pub = u => ({ id: u.id, username: u.username, name: u.name, color: u.color, photo: u.photo,
  owner: isOwner(u), verified: isOwner(u) || !!u.verified, role: roleOf(u) });
const COLOR_RE = /^#[0-9a-f]{6}$/i;
const int = v => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : null; };

function parseCookies(header) {
  const out = {};
  (header || '').split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
async function userFromToken(token) {
  if (!token) return null;
  try {
    const { uid, tv } = jwt.verify(token, JWT_SECRET);
    const r = await q('SELECT * FROM users WHERE id=$1', [uid]);
    const u = r.rows[0];
    if (!u || u.token_version !== tv) return null;
    return u;
  } catch { return null; }
}
function setSession(res, u) {
  const token = jwt.sign({ uid: u.id, tv: u.token_version }, JWT_SECRET, { expiresIn: '30d' });
  res.cookie('ding_token', token, { httpOnly: true, sameSite: 'lax', secure: PROD, maxAge: 30 * 864e5, path: '/' });
}
const auth = h(async (req, res, next) => {
  const u = await userFromToken(parseCookies(req.headers.cookie).ding_token);
  if (!u) fail(401, 'Please log in.');
  const ban = banInfo(u);
  if (ban) return res.status(403).json({ error: 'You are banned.', banned: ban });
  req.user = u; req.uid = u.id; next();
});

async function areFriends(a, b) {
  return (await q('SELECT 1 FROM friends WHERE user_id=$1 AND friend_id=$2', [a, b])).rowCount > 0;
}
async function chatFor(uid, chatId) {
  const r = await q('SELECT c.* FROM chats c JOIN chat_members m ON m.chat_id=c.id WHERE c.id=$1 AND m.user_id=$2', [chatId, uid]);
  if (!r.rows[0]) fail(404, 'Chat not found.');
  return r.rows[0];
}
async function memberIds(chatId) {
  return (await q('SELECT user_id FROM chat_members WHERE chat_id=$1', [chatId])).rows.map(r => r.user_id);
}
async function nameOf(uid) {
  return (await q('SELECT name FROM users WHERE id=$1', [uid])).rows[0]?.name || 'Someone';
}

// ---------- app ----------
const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);
const io = new Server(server);
const notify = (ids, ev = 'state', payload = {}) => ids.forEach(id => io.to('u:' + id).emit(ev, payload));

app.use(express.json({ limit: '100kb' }));
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'same-origin');
  res.set('X-Frame-Options', 'DENY');
  next();
});
app.get('/healthz', (req, res) => res.send('ok'));
app.use(express.static(path.join(__dirname, 'public')));

const authLimiter = rateLimit({ windowMs: 15 * 60e3, limit: 30, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many attempts. Wait a few minutes and try again.' } });

// ----- accounts -----
app.post('/api/signup', authLimiter, h(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const username = String(req.body.username || '').trim().toLowerCase();
  const name = String(req.body.name || '').trim().slice(0, 30);
  const password = String(req.body.password || '');
  const color = COLOR_RE.test(req.body.color || '') ? req.body.color : '#2f5bff';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) fail(400, 'Enter a valid email address.');
  if (!/^[a-z0-9_]{3,20}$/.test(username)) fail(400, 'Usernames are 3–20 letters, numbers or underscores.');
  if (!name) fail(400, 'Add a display name.');
  if (password.length < 8 || password.length > 200) fail(400, 'Passwords need at least 8 characters.');
  const hash = await bcrypt.hash(password, 11);
  try {
    const r = await q('INSERT INTO users(email,username,name,password_hash,color,created_at) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
      [email, username, name, hash, color, now()]);
    setSession(res, r.rows[0]);
    res.json({ ok: true });
  } catch (e) {
    if (e.code === '23505') fail(409, e.constraint && e.constraint.includes('email') ? 'An account with that email already exists. Try logging in.' : 'That username is taken. Try another.');
    throw e;
  }
}));

app.post('/api/login', authLimiter, h(async (req, res) => {
  const login = String(req.body.login || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const r = await q('SELECT * FROM users WHERE email=$1 OR username=$1', [login]);
  const u = r.rows[0];
  const ok = await bcrypt.compare(password, u ? u.password_hash : DUMMY_HASH); // same work either way
  if (!u || !ok) fail(401, 'Wrong email/username or password.');
  const ban = banInfo(u);
  if (ban) return res.status(403).json({ error: 'You are banned.', banned: ban });
  setSession(res, u);
  res.json({ ok: true });
}));

app.post('/api/logout', (req, res) => {
  res.clearCookie('ding_token', { path: '/' });
  res.json({ ok: true });
});

app.patch('/api/me', auth, h(async (req, res) => {
  const name = req.body.name !== undefined ? String(req.body.name).trim().slice(0, 30) : req.user.name;
  const color = req.body.color !== undefined ? (COLOR_RE.test(req.body.color) ? req.body.color : req.user.color) : req.user.color;
  let photo = req.user.photo;
  if (req.body.photo !== undefined) {
    if (req.body.photo === null) photo = null;
    else {
      const img = await q('SELECT 1 FROM images WHERE id=$1 AND owner_id=$2', [String(req.body.photo), req.uid]);
      if (!img.rowCount) fail(400, 'That photo was not found.');
      photo = String(req.body.photo);
    }
  }
  if (!name) fail(400, 'Add a display name.');
  await q('UPDATE users SET name=$1,color=$2,photo=$3 WHERE id=$4', [name, color, photo, req.uid]);
  // anyone who can see this person should refresh
  const others = (await q(`SELECT friend_id AS id FROM friends WHERE user_id=$1
    UNION SELECT m2.user_id FROM chat_members m1 JOIN chat_members m2 ON m1.chat_id=m2.chat_id WHERE m1.user_id=$1
    UNION SELECT to_id FROM friend_requests WHERE from_id=$1 UNION SELECT from_id FROM friend_requests WHERE to_id=$1`, [req.uid])).rows.map(r => r.id);
  notify([...new Set([req.uid, ...others])]);
  res.json({ ok: true });
}));

app.post('/api/me/password', auth, h(async (req, res) => {
  const cur = String(req.body.current || ''), next = String(req.body.next || '');
  if (!(await bcrypt.compare(cur, req.user.password_hash))) fail(400, 'Your current password is wrong.');
  if (next.length < 8 || next.length > 200) fail(400, 'New passwords need at least 8 characters.');
  const hash = await bcrypt.hash(next, 11);
  const r = await q('UPDATE users SET password_hash=$1, token_version=token_version+1 WHERE id=$2 RETURNING *', [hash, req.uid]);
  setSession(res, r.rows[0]); // this device stays logged in; others are logged out
  res.json({ ok: true });
}));

// ----- verified badges (owner only) -----
app.post('/api/admin/verify', auth, h(async (req, res) => {
  if (!isOwner(req.user)) fail(403, 'Only the owner can give out verified badges.');
  const id = int(req.body.userId), on = !!req.body.verified;
  const r = await q('UPDATE users SET verified=$1 WHERE id=$2 RETURNING *', [on, id]);
  if (!r.rows[0]) fail(404, 'User not found.');
  if (isOwner(r.rows[0]) && !on) fail(400, 'The owner is always verified.');
  io.emit('state');
  if (on && id !== req.uid) notify([id], 'verified', {});
  res.json({ ok: true, user: pub(r.rows[0]) });
}));
app.get('/api/users/:id([0-9]+)', auth, h(async (req, res) => {
  const r = await q('SELECT * FROM users WHERE id=$1', [int(req.params.id)]);
  if (!r.rows[0]) fail(404, 'User not found.');
  res.json({ user: pub(r.rows[0]) });
}));

// ----- moderation -----
const modOnly = (req) => { if (rankOf(req.user) < 1) fail(403, 'Only moderators can do that.'); };
async function targetBelow(req, id) {
  const t = (await q('SELECT * FROM users WHERE id=$1', [int(id)])).rows[0];
  if (!t) fail(404, 'User not found.');
  if (t.id === req.uid) fail(400, 'You can’t do that to yourself.');
  if (rankOf(t) >= rankOf(req.user)) fail(403, 'You can only do that to people ranked below you.');
  return t;
}
const modsRoom = () => io.to('mods');
// messages the reporter can attach: things the reported person sent in chats they share
app.get('/api/reports/messages', auth, h(async (req, res) => {
  const target = int(req.query.userId);
  const r = await q(`SELECT m.id, m.chat_id, m.text, m.image_id, m.image_w, m.image_h, m.created_at, c.type, c.name
    FROM messages m JOIN chats c ON c.id=m.chat_id JOIN chat_members cm ON cm.chat_id=m.chat_id AND cm.user_id=$1
    WHERE m.user_id=$2 AND m.sys=FALSE AND m.deleted=FALSE ORDER BY m.id DESC LIMIT 80`, [req.uid, target]);
  res.json({ messages: r.rows.map(m => ({ id: m.id, chatId: m.chat_id, chatName: m.type === 'group' ? m.name : 'Direct messages',
    text: m.text, img: m.image_id ? { id: m.image_id, w: m.image_w, h: m.image_h } : null, at: m.created_at })) });
}));
app.post('/api/reports', auth, h(async (req, res) => {
  const target = int(req.body.userId);
  if (!target || target === req.uid) fail(400, 'Pick someone else to report.');
  if (!(await q('SELECT id FROM users WHERE id=$1', [target])).rowCount) fail(404, 'User not found.');
  const reason = String(req.body.reason || '').trim().slice(0, 60);
  const details = String(req.body.details || '').trim().slice(0, 1000);
  if (!reason) fail(400, 'Pick a reason.');
  let ids = Array.isArray(req.body.messageIds) ? req.body.messageIds : (req.body.messageId ? [req.body.messageId] : []);
  ids = [...new Set(ids.map(int).filter(Boolean))];
  if (ids.length > 10) fail(400, 'You can attach up to 10 messages.');
  // only messages the reported person sent, in chats the reporter is in
  const items = ids.length ? (await q(`SELECT m.* FROM messages m JOIN chat_members cm ON cm.chat_id=m.chat_id AND cm.user_id=$1
    WHERE m.id = ANY($2) AND m.user_id=$3 AND m.sys=FALSE`, [req.uid, ids, target])).rows : [];
  if (!items.length) {
    const dup = await q("SELECT 1 FROM reports r WHERE reporter_id=$1 AND target_id=$2 AND status='open' AND NOT EXISTS (SELECT 1 FROM report_items i WHERE i.report_id=r.id)", [req.uid, target]);
    if (dup.rowCount) return res.json({ ok: true });
  }
  const rep = (await q('INSERT INTO reports(reporter_id,target_id,reason,details,created_at) VALUES($1,$2,$3,$4,$5) RETURNING id',
    [req.uid, target, reason, details, now()])).rows[0];
  for (const m of items) {
    await q('INSERT INTO report_items(report_id,message_id,chat_id,text,image_id,sent_at) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING',
      [rep.id, m.id, m.chat_id, m.deleted ? (m.orig_text || '') : m.text, m.deleted ? m.orig_image : m.image_id, m.created_at]);
  }
  modsRoom().emit('reports');
  res.json({ ok: true, attached: items.length });
}));
app.get('/api/mod/reports', auth, h(async (req, res) => {
  modOnly(req);
  const status = req.query.status === 'closed' ? 'closed' : 'open';
  const r = await q(`SELECT r.*, a.username AS a_username, a.name AS a_name, a.color AS a_color, a.photo AS a_photo, a.email AS a_email, a.role AS a_role, a.verified AS a_verified,
      t.username AS t_username, t.name AS t_name, t.color AS t_color, t.photo AS t_photo, t.email AS t_email, t.role AS t_role, t.verified AS t_verified, t.banned_until AS t_banned_until,
      hb.name AS hb_name
    FROM reports r JOIN users a ON a.id=r.reporter_id JOIN users t ON t.id=r.target_id LEFT JOIN users hb ON hb.id=r.handled_by
    WHERE ${status === 'open' ? "r.status='open'" : "r.status<>'open'"} ORDER BY r.id DESC LIMIT 100`);
  const users = {};
  const mk = (row, p) => pub({ id: row[p === 'a' ? 'reporter_id' : 'target_id'], username: row[p + '_username'], name: row[p + '_name'], color: row[p + '_color'], photo: row[p + '_photo'], email: row[p + '_email'], role: row[p + '_role'], verified: row[p + '_verified'] });
  const reports = r.rows.map(x => {
    users[x.reporter_id] = mk(x, 'a'); users[x.target_id] = mk(x, 't');
    return { id: x.id, reporter: x.reporter_id, target: x.target_id, reason: x.reason, details: x.details, at: x.created_at,
      messageText: x.message_text, messageImg: x.message_img, status: x.status, handledBy: x.hb_name, handledAt: x.handled_at,
      targetBanned: !!(x.t_banned_until && x.t_banned_until > now()) };
  });
  const rids = reports.map(x => x.id);
  const items = rids.length ? (await q(`SELECT i.*, c.type, c.name FROM report_items i LEFT JOIN chats c ON c.id=i.chat_id
    WHERE i.report_id = ANY($1) ORDER BY i.sent_at`, [rids])).rows : [];
  const byRep = {};
  items.forEach(i => (byRep[i.report_id] = byRep[i.report_id] || []).push({ messageId: i.message_id, chatId: i.chat_id,
    chatName: i.type ? (i.type === 'group' ? i.name : 'Direct messages') : 'Deleted chat', chatGone: !i.type,
    text: i.text, img: i.image_id, at: i.sent_at }));
  reports.forEach(x => { x.items = byRep[x.id] || []; });
  res.json({ reports, users });
}));
// a mod can open a chat only if it is attached to a report
app.get('/api/mod/reports/:rid([0-9]+)/chat/:cid([0-9]+)', auth, h(async (req, res) => {
  modOnly(req);
  const rid = int(req.params.rid), cid = int(req.params.cid);
  const ok = await q('SELECT 1 FROM report_items i JOIN reports r ON r.id=i.report_id WHERE i.report_id=$1 AND i.chat_id=$2', [rid, cid]);
  if (!ok.rowCount) fail(403, 'You can only open chats that are part of a report.');
  const c = (await q('SELECT * FROM chats WHERE id=$1', [cid])).rows[0];
  if (!c) fail(404, 'That chat has been deleted.');
  const around = int(req.query.around) || 2147483647;
  const before = (await q('SELECT * FROM messages WHERE chat_id=$1 AND id<=$2 ORDER BY id DESC LIMIT 40', [cid, around])).rows.reverse();
  const after = (await q('SELECT * FROM messages WHERE chat_id=$1 AND id>$2 ORDER BY id LIMIT 40', [cid, around])).rows;
  const rows = [...before, ...after];
  const uids = [...new Set([...rows.map(m => m.user_id), ...(await memberIds(cid))].filter(Boolean))];
  const users = {};
  (await q('SELECT * FROM users WHERE id = ANY($1)', [uids])).rows.forEach(u => { users[u.id] = pub(u); });
  const members = await memberIds(cid);
  const name = c.type === 'group' ? c.name : 'Direct messages: ' + members.map(id => users[id]?.name || 'Someone').join(' & ');
  res.json({ chat: { id: c.id, type: c.type, name, members }, users,
    moreBefore: before.length === 40, moreAfter: after.length === 40,
    messages: rows.map(m => ({ id: m.id, from: m.user_id, at: m.created_at, sys: m.sys, edited: m.edited, deleted: m.deleted,
      text: m.deleted ? (m.orig_text || '') : m.text, img: (m.deleted ? m.orig_image : m.image_id) || null })) });
}));
app.post('/api/mod/reports/:id', auth, h(async (req, res) => {
  modOnly(req);
  const status = req.body.status === 'dismissed' ? 'dismissed' : 'resolved';
  await q("UPDATE reports SET status=$1, handled_by=$2, handled_at=$3 WHERE id=$4", [status, req.uid, now(), int(req.params.id)]);
  modsRoom().emit('reports');
  res.json({ ok: true });
}));
app.get('/api/mod/users/:id([0-9]+)', auth, h(async (req, res) => {
  modOnly(req);
  const t = (await q('SELECT * FROM users WHERE id=$1', [int(req.params.id)])).rows[0];
  if (!t) fail(404, 'User not found.');
  const warnings = (await q('SELECT w.*, u.name AS mod_name FROM warnings w LEFT JOIN users u ON u.id=w.mod_id WHERE w.user_id=$1 ORDER BY w.id DESC LIMIT 20', [t.id])).rows
    .map(w => ({ id: w.id, reason: w.reason, at: w.created_at, by: w.mod_name || 'A moderator' }));
  const reports = (await q('SELECT count(*)::int AS n FROM reports WHERE target_id=$1', [t.id])).rows[0].n;
  const bannedBy = t.banned_by ? await nameOf(t.banned_by) : null;
  res.json({ user: pub(t), ban: banInfo(t), bannedBy, warnings, reports,
    canAct: t.id !== req.uid && rankOf(t) < rankOf(req.user) });
}));
app.post('/api/mod/warn', auth, h(async (req, res) => {
  modOnly(req);
  const t = await targetBelow(req, req.body.userId);
  const reason = String(req.body.reason || '').trim().slice(0, 500);
  if (!reason) fail(400, 'Say why you are warning them.');
  const w = (await q('INSERT INTO warnings(user_id,mod_id,reason,created_at) VALUES($1,$2,$3,$4) RETURNING *', [t.id, req.uid, reason, now()])).rows[0];
  notify([t.id], 'warned', { id: w.id, reason, at: w.created_at });
  res.json({ ok: true });
}));
app.post('/api/mod/ban', auth, h(async (req, res) => {
  modOnly(req);
  const t = await targetBelow(req, req.body.userId);
  const reason = String(req.body.reason || '').trim().slice(0, 500);
  if (!reason) fail(400, 'Say why you are banning them.');
  let until;
  if (req.body.permanent) until = PERMA;
  else {
    const minutes = Number(req.body.minutes);
    if (!(minutes >= 1) || minutes > 60 * 24 * 365 * 10) fail(400, 'Pick a ban length between 1 minute and 10 years.');
    until = now() + Math.round(minutes * 60e3);
  }
  await q('UPDATE users SET banned_until=$1, ban_reason=$2, banned_by=$3 WHERE id=$4', [until, reason, req.uid, t.id]);
  const ban = { until, permanent: until >= PERMA, reason };
  notify([t.id], 'banned', ban);
  setTimeout(() => io.in('u:' + t.id).disconnectSockets(true), 300);
  res.json({ ok: true, ban });
}));
app.post('/api/mod/unban', auth, h(async (req, res) => {
  modOnly(req);
  const t = await targetBelow(req, req.body.userId);
  await q('UPDATE users SET banned_until=NULL, ban_reason=NULL, banned_by=NULL WHERE id=$1', [t.id]);
  res.json({ ok: true });
}));
app.get('/api/mod/bans', auth, h(async (req, res) => {
  modOnly(req);
  const r = await q('SELECT u.*, b.name AS by_name FROM users u LEFT JOIN users b ON b.id=u.banned_by WHERE u.banned_until > $1 ORDER BY u.banned_until', [now()]);
  res.json({ bans: r.rows.map(u => ({ user: pub(u), ban: banInfo(u), by: u.by_name || 'A moderator', canAct: rankOf(u) < rankOf(req.user) })) });
}));
app.post('/api/mod/role', auth, h(async (req, res) => {
  const role = String(req.body.role || '');
  if (!['user', 'mod', 'senior'].includes(role)) fail(400, 'Unknown role.');
  const myRank = rankOf(req.user);
  if (myRank < 2) fail(403, 'Only senior mods and the owner can change roles.');
  const t = await targetBelow(req, req.body.userId);
  if (myRank === 2 && role === 'senior') fail(403, 'Only the owner can make senior mods.');
  if (roleOf(t) === role) return res.json({ ok: true, user: pub(t) });
  const r = await q('UPDATE users SET role=$1 WHERE id=$2 RETURNING *', [role, t.id]);
  if (role === 'user') io.in('u:' + t.id).socketsLeave('mods'); else io.in('u:' + t.id).socketsJoin('mods');
  notify([t.id], 'role', { role });
  io.emit('state');
  res.json({ ok: true, user: pub(r.rows[0]) });
}));
app.post('/api/me/warnings/seen', auth, h(async (req, res) => {
  await q('UPDATE warnings SET seen=TRUE WHERE user_id=$1', [req.uid]);
  res.json({ ok: true });
}));

// ----- state -----
app.get('/api/state', auth, h(async (req, res) => {
  const uid = req.uid, users = {};
  const add = u => { users[u.id] = pub(u); return u.id; };
  add(req.user);
  const friends = (await q('SELECT u.* FROM friends f JOIN users u ON u.id=f.friend_id WHERE f.user_id=$1 ORDER BY lower(u.name)', [uid])).rows.map(add);
  const incoming = (await q('SELECT u.* FROM friend_requests r JOIN users u ON u.id=r.from_id WHERE r.to_id=$1 ORDER BY r.created_at DESC', [uid])).rows.map(add);
  const outgoing = (await q('SELECT u.* FROM friend_requests r JOIN users u ON u.id=r.to_id WHERE r.from_id=$1 ORDER BY r.created_at DESC', [uid])).rows.map(add);
  const chatRows = (await q('SELECT c.*, m.last_read FROM chats c JOIN chat_members m ON m.chat_id=c.id AND m.user_id=$1 ORDER BY c.last_at DESC', [uid])).rows;
  const ids = chatRows.map(c => c.id);
  const mem = ids.length ? (await q('SELECT cm.chat_id, u.* FROM chat_members cm JOIN users u ON u.id=cm.user_id WHERE cm.chat_id = ANY($1) ORDER BY cm.joined_at, u.id', [ids])).rows : [];
  const members = {};
  mem.forEach(r => { add(r); (members[r.chat_id] = members[r.chat_id] || []).push(r.id); });
  const chats = chatRows.map(c => ({ id: c.id, type: c.type, name: c.name, leader: c.leader_id, members: members[c.id] || [],
    lastAt: c.last_at, lastText: c.last_text, lastFrom: c.last_from, lastRead: c.last_read }));
  const warnings = (await q('SELECT id, reason, created_at FROM warnings WHERE user_id=$1 AND seen=FALSE ORDER BY id', [uid])).rows
    .map(w => ({ id: w.id, reason: w.reason, at: w.created_at }));
  const openReports = rankOf(req.user) >= 1 ? (await q("SELECT count(*)::int AS n FROM reports WHERE status='open'")).rows[0].n : 0;
  res.json({ me: { ...pub(req.user), email: req.user.email }, users, friends, incoming, outgoing, chats, warnings, openReports });
}));

app.get('/api/users/search', auth, h(async (req, res) => {
  const s = String(req.query.q || '').trim().toLowerCase().slice(0, 40);
  if (!s) return res.json({ users: [] });
  const like = '%' + s.replace(/[\\%_]/g, c => '\\' + c) + '%';
  const r = await q(`SELECT * FROM users WHERE id<>$1 AND (username LIKE $2 OR lower(name) LIKE $2)
    ORDER BY (username=$3) DESC, username LIMIT 20`, [req.uid, like, s]);
  res.json({ users: r.rows.map(pub) });
}));

// ----- friends -----
async function makeFriends(a, b) {
  await q('DELETE FROM friend_requests WHERE (from_id=$1 AND to_id=$2) OR (from_id=$2 AND to_id=$1)', [a, b]);
  await q('INSERT INTO friends(user_id,friend_id,created_at) VALUES($1,$2,$3),($2,$1,$3) ON CONFLICT DO NOTHING', [a, b, now()]);
}
app.post('/api/friends/request', auth, h(async (req, res) => {
  const to = int(req.body.userId), uid = req.uid;
  if (!to || to === uid) fail(400, 'Pick someone else.');
  if (!(await q('SELECT 1 FROM users WHERE id=$1', [to])).rowCount) fail(404, 'User not found.');
  if (await areFriends(uid, to)) return res.json({ ok: true, status: 'friends' });
  const reverse = await q('SELECT 1 FROM friend_requests WHERE from_id=$1 AND to_id=$2', [to, uid]);
  if (reverse.rowCount) { await makeFriends(uid, to); notify([uid, to]); return res.json({ ok: true, status: 'friends' }); }
  await q('INSERT INTO friend_requests(from_id,to_id,created_at) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [uid, to, now()]);
  notify([uid]); notify([to], 'friendRequest', { from: uid });
  res.json({ ok: true, status: 'sent' });
}));
app.post('/api/friends/accept', auth, h(async (req, res) => {
  const from = int(req.body.userId);
  const r = await q('SELECT 1 FROM friend_requests WHERE from_id=$1 AND to_id=$2', [from, req.uid]);
  if (!r.rowCount) fail(404, 'That request is gone.');
  await makeFriends(req.uid, from); notify([req.uid, from]);
  res.json({ ok: true });
}));
app.post('/api/friends/decline', auth, h(async (req, res) => {
  const from = int(req.body.userId);
  await q('DELETE FROM friend_requests WHERE from_id=$1 AND to_id=$2', [from, req.uid]); notify([req.uid, from]);
  res.json({ ok: true });
}));
app.post('/api/friends/cancel', auth, h(async (req, res) => {
  const to = int(req.body.userId);
  await q('DELETE FROM friend_requests WHERE from_id=$1 AND to_id=$2', [req.uid, to]); notify([req.uid, to]);
  res.json({ ok: true });
}));
app.delete('/api/friends/:id', auth, h(async (req, res) => {
  const f = int(req.params.id);
  await q('DELETE FROM friends WHERE (user_id=$1 AND friend_id=$2) OR (user_id=$2 AND friend_id=$1)', [req.uid, f]); notify([req.uid, f]);
  res.json({ ok: true });
}));

// ----- chats -----
async function addSys(chatId, uid, text) {
  const t = now();
  const r = await q('INSERT INTO messages(chat_id,user_id,text,sys,created_at) VALUES($1,$2,$3,TRUE,$4) RETURNING *', [chatId, uid, text, t]);
  await q('UPDATE chats SET last_at=$1,last_text=$2,last_from=$3 WHERE id=$4', [t, text.slice(0, 120), uid, chatId]);
  await q('UPDATE chat_members SET last_read=$1 WHERE chat_id=$2 AND user_id=$3', [t, chatId, uid]);
  return r.rows[0];
}
async function broadcastMsg(chatId, row, isNew, extraIds = []) {
  const ids = [...new Set([...(await memberIds(chatId)), ...extraIds])];
  const msg = await serializeOne(row);
  notify(ids, 'msg', { chatId, msg, isNew });
}
app.post('/api/dm', auth, h(async (req, res) => {
  const o = int(req.body.userId), uid = req.uid;
  if (!o || !(await areFriends(uid, o))) fail(403, 'You can only message friends.');
  const key = [uid, o].sort((a, b) => a - b).join(':');
  const r = await q(`INSERT INTO chats(type,dm_key,created_at) VALUES('dm',$1,$2)
    ON CONFLICT (dm_key) DO UPDATE SET dm_key=EXCLUDED.dm_key RETURNING id`, [key, now()]);
  const id = r.rows[0].id;
  await q('INSERT INTO chat_members(chat_id,user_id,joined_at) VALUES($1,$2,$4),($1,$3,$4) ON CONFLICT DO NOTHING', [id, uid, o, now()]);
  notify([uid]);
  res.json({ id });
}));
app.post('/api/groups', auth, h(async (req, res) => {
  const uid = req.uid, name = String(req.body.name || '').trim().slice(0, 40);
  const ids = [...new Set((Array.isArray(req.body.memberIds) ? req.body.memberIds : []).map(int).filter(x => x && x !== uid))].slice(0, 100);
  if (!name) fail(400, 'Give the group a name.');
  if (!ids.length) fail(400, 'Pick at least one friend.');
  const fr = (await q('SELECT friend_id FROM friends WHERE user_id=$1 AND friend_id = ANY($2)', [uid, ids])).rows.length;
  if (fr !== ids.length) fail(403, 'You can only add friends to a group.');
  const t = now();
  const c = (await q(`INSERT INTO chats(type,name,leader_id,created_at,last_at) VALUES('group',$1,$2,$3,$3) RETURNING id`, [name, uid, t])).rows[0];
  const all = [uid, ...ids];
  for (let i = 0; i < all.length; i++) await q('INSERT INTO chat_members(chat_id,user_id,joined_at) VALUES($1,$2,$3)', [c.id, all[i], t + i]);
  await addSys(c.id, uid, `${req.user.name} created “${name}”`);
  notify(all);
  res.json({ id: c.id });
}));
app.patch('/api/chats/:id', auth, h(async (req, res) => {
  const c = await chatFor(req.uid, int(req.params.id));
  if (c.type !== 'group') fail(400, 'Only groups have names.');
  const name = String(req.body.name || '').trim().slice(0, 40);
  if (!name) fail(400, 'Give the group a name.');
  if (name === c.name) return res.json({ ok: true });
  await q('UPDATE chats SET name=$1 WHERE id=$2', [name, c.id]);
  const m = await addSys(c.id, req.uid, `${req.user.name} renamed the group to “${name}”`);
  await broadcastMsg(c.id, m, true); notify(await memberIds(c.id));
  res.json({ ok: true });
}));
app.post('/api/chats/:id/members', auth, h(async (req, res) => {
  const c = await chatFor(req.uid, int(req.params.id)), add = int(req.body.userId);
  if (c.type !== 'group') fail(400, 'Not a group.');
  if (c.leader_id !== req.uid) fail(403, 'Only the group leader can add members.');
  if (!add || !(await areFriends(req.uid, add))) fail(403, 'You can only add your friends.');
  const r = await q('INSERT INTO chat_members(chat_id,user_id,joined_at) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [c.id, add, now()]);
  if (r.rowCount) {
    const m = await addSys(c.id, req.uid, `${req.user.name} added ${await nameOf(add)}`);
    await broadcastMsg(c.id, m, true); notify(await memberIds(c.id));
  }
  res.json({ ok: true });
}));
app.delete('/api/chats/:id/members/:uid', auth, h(async (req, res) => {
  const c = await chatFor(req.uid, int(req.params.id)), target = int(req.params.uid);
  if (c.type !== 'group') fail(400, 'Not a group.');
  const before = await memberIds(c.id);
  if (!before.includes(target)) fail(404, 'They are not in this group.');
  if (target === req.uid) { // leave
    const rest = before.filter(x => x !== req.uid);
    if (!rest.length) { await q('DELETE FROM chats WHERE id=$1', [c.id]); notify([req.uid]); return res.json({ ok: true }); }
    let text = `${req.user.name} left the group`;
    if (c.leader_id === req.uid) {
      await q('UPDATE chats SET leader_id=$1 WHERE id=$2', [rest[0], c.id]);
      text += ` · ${await nameOf(rest[0])} is now the leader`;
    }
    const m = await addSys(c.id, req.uid, text);
    await q('DELETE FROM chat_members WHERE chat_id=$1 AND user_id=$2', [c.id, req.uid]);
    await broadcastMsg(c.id, m, true); notify(before);
    return res.json({ ok: true });
  }
  if (c.leader_id !== req.uid) fail(403, 'Only the group leader can kick members.');
  const m = await addSys(c.id, req.uid, `${req.user.name} removed ${await nameOf(target)} from the group`);
  await q('DELETE FROM chat_members WHERE chat_id=$1 AND user_id=$2', [c.id, target]);
  await broadcastMsg(c.id, m, true);
  notify([target], 'kicked', { chatId: c.id, name: c.name });
  notify(before);
  res.json({ ok: true });
}));
app.post('/api/chats/:id/read', auth, h(async (req, res) => {
  const id = int(req.params.id), at = Number(req.body.at) || now();
  await q('UPDATE chat_members SET last_read=GREATEST(last_read,$1) WHERE chat_id=$2 AND user_id=$3', [Math.min(at, now()), id, req.uid]);
  res.json({ ok: true });
}));

// ----- messages -----
const MSG_SELECT = `SELECT m.*, r.user_id AS r_from, r.text AS r_text, r.image_id AS r_img, r.deleted AS r_del
  FROM messages m LEFT JOIN messages r ON r.id=m.reply_to`;
function serialize(m) {
  return {
    id: m.id, chatId: m.chat_id, from: m.user_id, at: m.created_at, sys: m.sys, edited: m.edited, deleted: m.deleted,
    text: m.deleted ? '' : m.text,
    img: !m.deleted && m.image_id ? { id: m.image_id, w: m.image_w, h: m.image_h } : null,
    replyTo: !m.deleted && m.reply_to ? { id: m.reply_to, from: m.r_from, text: m.r_del ? 'Message deleted' : (m.r_text || '').slice(0, 140), img: !m.r_del && !!m.r_img } : null,
  };
}
async function serializeOne(row) {
  const r = await q(MSG_SELECT + ' WHERE m.id=$1', [row.id]);
  return serialize(r.rows[0]);
}
app.get('/api/chats/:id/messages', auth, h(async (req, res) => {
  const c = await chatFor(req.uid, int(req.params.id));
  const before = int(req.query.before);
  const r = await q(MSG_SELECT + ' WHERE m.chat_id=$1 AND ($2::int IS NULL OR m.id<$2) ORDER BY m.id DESC LIMIT 60', [c.id, before]);
  res.json({ messages: r.rows.reverse().map(serialize), more: r.rows.length === 60 });
}));
async function checkImage(uid, imageId) {
  if (!imageId) return null;
  const r = await q('SELECT id FROM images WHERE id=$1 AND owner_id=$2', [String(imageId), uid]);
  if (!r.rowCount) fail(400, 'That photo was not found. Try sending it again.');
  return r.rows[0].id;
}
const dim = v => { const n = Math.round(Number(v)); return n > 0 && n < 20000 ? n : null; };
app.post('/api/chats/:id/messages', auth, h(async (req, res) => {
  const c = await chatFor(req.uid, int(req.params.id));
  if (c.type === 'dm') {
    const other = (await memberIds(c.id)).find(x => x !== req.uid);
    if (!other || !(await areFriends(req.uid, other))) fail(403, 'You need to be friends to message each other.');
  }
  const text = String(req.body.text || '').slice(0, 4000);
  const imageId = await checkImage(req.uid, req.body.imageId);
  if (!text.trim() && !imageId) fail(400, 'Type a message first.');
  let replyTo = int(req.body.replyTo);
  if (replyTo && !(await q('SELECT 1 FROM messages WHERE id=$1 AND chat_id=$2', [replyTo, c.id])).rowCount) replyTo = null;
  const t = now();
  const r = await q(`INSERT INTO messages(chat_id,user_id,text,image_id,image_w,image_h,reply_to,created_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [c.id, req.uid, text, imageId, dim(req.body.w), dim(req.body.h), replyTo, t]);
  const preview = imageId ? (text.trim() ? 'Photo · ' + text : 'Photo') : text;
  await q('UPDATE chats SET last_at=$1,last_text=$2,last_from=$3 WHERE id=$4', [t, preview.slice(0, 120), req.uid, c.id]);
  await q('UPDATE chat_members SET last_read=$1 WHERE chat_id=$2 AND user_id=$3', [t, c.id, req.uid]);
  await broadcastMsg(c.id, r.rows[0], true);
  res.json({ id: r.rows[0].id });
}));
app.patch('/api/messages/:id', auth, h(async (req, res) => {
  const r = await q('SELECT * FROM messages WHERE id=$1', [int(req.params.id)]);
  const m = r.rows[0];
  if (!m || m.user_id !== req.uid || m.sys || m.deleted) fail(403, 'You can only edit your own messages.');
  await chatFor(req.uid, m.chat_id);
  if (req.body.imageId !== undefined) {
    const imageId = await checkImage(req.uid, req.body.imageId);
    await q('UPDATE messages SET image_id=$1,image_w=$2,image_h=$3,edited=TRUE WHERE id=$4', [imageId, dim(req.body.w), dim(req.body.h), m.id]);
  } else {
    const text = String(req.body.text || '').slice(0, 4000);
    if (!text.trim() && !m.image_id) fail(400, 'A message can’t be empty.');
    await q('UPDATE messages SET text=$1,edited=TRUE WHERE id=$2', [text, m.id]);
  }
  await broadcastMsg(m.chat_id, m, false);
  res.json({ ok: true });
}));
app.delete('/api/messages/:id', auth, h(async (req, res) => {
  const r = await q('SELECT * FROM messages WHERE id=$1', [int(req.params.id)]);
  const m = r.rows[0];
  if (!m || m.user_id !== req.uid || m.sys) fail(403, 'You can only delete your own messages.');
  await q(`UPDATE messages SET orig_text=COALESCE(orig_text,text), orig_image=COALESCE(orig_image,image_id), deleted=TRUE, text='', image_id=NULL WHERE id=$1 AND deleted=FALSE`, [m.id]);
  await broadcastMsg(m.chat_id, m, false);
  res.json({ ok: true });
}));

// ----- images (stored in Postgres so they survive restarts) -----
const IMG_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
app.post('/api/images', auth, express.raw({ type: IMG_TYPES, limit: '6mb' }), h(async (req, res) => {
  const mime = (req.headers['content-type'] || '').split(';')[0].trim();
  if (!IMG_TYPES.includes(mime) || !Buffer.isBuffer(req.body) || !req.body.length) fail(400, 'Send a JPEG, PNG, WebP or GIF image.');
  const id = crypto.randomUUID();
  await q('INSERT INTO images(id,owner_id,mime,data,created_at) VALUES($1,$2,$3,$4,$5)', [id, req.uid, mime, req.body, now()]);
  res.json({ id });
}));
app.get('/api/images/:id', auth, h(async (req, res) => {
  const r = await q('SELECT mime,data FROM images WHERE id=$1', [String(req.params.id)]);
  if (!r.rows[0]) fail(404, 'Not found');
  res.set('Content-Type', r.rows[0].mime);
  res.set('Cache-Control', 'private, max-age=31536000, immutable');
  res.send(r.rows[0].data);
}));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => {
  if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'That file is too big.' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

// ----- sockets -----
io.use(async (socket, next) => {
  const u = await userFromToken(parseCookies(socket.handshake.headers.cookie).ding_token);
  if (!u) return next(new Error('unauthorized'));
  if (banInfo(u)) return next(new Error('banned'));
  socket.data.uid = u.id; socket.data.mod = rankOf(u) >= 1; next();
});
io.on('connection', socket => { socket.join('u:' + socket.data.uid); if (socket.data.mod) socket.join('mods'); });

(async () => {
  await q(SCHEMA);
  server.listen(PORT, () => console.log(`Ding Chat running on http://localhost:${PORT}`));
})().catch(e => { console.error('Could not start:', e); process.exit(1); });
