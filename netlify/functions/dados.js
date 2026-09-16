const { createHmac, timingSafeEqual } = require('node:crypto');
const { readFile } = require('node:fs/promises');
const { join } = require('node:path');

function validSession(token) {
  try {
    const secret = process.env.AUTH_SECRET;
    if (!secret || !token) return false;
    const [payload, signature] = token.split('.');
    const expected = createHmac('sha256', secret).update(payload).digest('base64url');
    const suppliedBuffer = Buffer.from(signature || '');
    const expectedBuffer = Buffer.from(expected);
    if (suppliedBuffer.length !== expectedBuffer.length || !timingSafeEqual(suppliedBuffer, expectedBuffer)) return false;
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return Boolean(session.user) && Number(session.exp) > Date.now();
  } catch { return false; }
}

exports.handler = async event => {
  const token = String(event.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!validSession(token)) {
    return { statusCode: 401, headers: { 'Cache-Control': 'no-store' }, body: JSON.stringify({ message: 'Sessão inválida ou expirada.' }) };
  }
  try {
    let snapshot;
    for (const path of [join(__dirname, 'dados.json'), join(__dirname, '..', '..', 'dados.json'), join(process.cwd(), 'dados.json')]) {
      try { snapshot = await readFile(path, 'utf8'); break; } catch {}
    }
    if (!snapshot) throw new Error('dados.json não foi incluído no pacote da função.');
    const data = JSON.parse(snapshot);
    const pageSize = 2500;
    const totalParts = Math.max(1, Math.ceil((data.rows || []).length / pageSize));
    const requestedPart = Math.max(0, Number.parseInt(event.queryStringParameters?.part || '0', 10) || 0);
    if (requestedPart >= totalParts) return { statusCode: 404, body: JSON.stringify({ message: 'Parte da base não encontrada.' }) };
    const body = JSON.stringify({
      updatedAt: data.updatedAt,
      totalParts,
      part: requestedPart,
      rows: (data.rows || []).slice(requestedPart * pageSize, (requestedPart + 1) * pageSize),
      dispatches: requestedPart === 0 ? (data.dispatches || []) : []
    });
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store' },
      body
    };
  } catch (error) {
    console.error('Falha ao carregar a cópia da base:', error.message);
    return { statusCode: 503, body: JSON.stringify({ message: 'A cópia da base está temporariamente indisponível.' }) };
  }
};
