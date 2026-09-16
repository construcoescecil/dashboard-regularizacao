const SHEET_ID = '1LbNTFt_jfQEufrEsrD4q4lI_fpDfJY_VFcMHKSp4_fg';
const LOGIN_GID = '2077703042';
const { createHmac } = require('node:crypto');

function signSession(user) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET não configurado.');
  const payload = Buffer.from(JSON.stringify({ user, exp: Date.now() + 8 * 60 * 60 * 1000 })).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += char;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  const headers = (rows.shift() || []).map(value => value.trim());
  return rows.map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}

exports.handler = async event => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: { Allow: 'POST' }, body: '' };
  try {
    const { username = '', password = '' } = JSON.parse(event.body || '{}');
    if (!String(username).trim() || !String(password)) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, message: 'Informe login e senha.' }) };
    }
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?gid=${LOGIN_GID}&headers=1&tqx=out:csv`;
    const response = await fetch(url, { headers: { 'user-agent': 'dashboard-regularizacao-auth/1.0' } });
    if (!response.ok) throw new Error('Falha ao consultar o cadastro de acesso.');
    const users = parseCsv(await response.text());
    const normalized = String(username).trim().toLowerCase();
    const match = users.some(user => String(user.LOGIN || '').trim().toLowerCase() === normalized
      && String(user.SENHA ?? '') === String(password));
    if (!match) return { statusCode: 401, body: JSON.stringify({ ok: false, message: 'Login ou senha incorretos.' }) };
    const user = String(username).trim();
    return { statusCode: 200, body: JSON.stringify({ ok: true, user, token: signSession(user) }) };
  } catch (error) {
    console.error('Falha na autenticação:', error.message);
    return { statusCode: 503, body: JSON.stringify({ ok: false, message: 'Não foi possível validar o acesso agora. Tente novamente.' }) };
  }
};
