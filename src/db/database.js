import { createClient } from '@libsql/client/web'

// ─── Client ────────────────────────────────────────────────────────────────
const TURSO_URL   = import.meta.env.VITE_TURSO_DATABASE_URL
const TURSO_TOKEN = import.meta.env.VITE_TURSO_AUTH_TOKEN

if (!TURSO_URL || !TURSO_TOKEN) {
  throw new Error(
    'Missing Turso credentials.\n' +
    'Set VITE_TURSO_DATABASE_URL and VITE_TURSO_AUTH_TOKEN in your .env file (local) ' +
    'or in the Vercel dashboard (production).'
  )
}

export const client = createClient({
  url:       TURSO_URL,
  authToken: TURSO_TOKEN,
})

// ─── Reactive event bus (replaces Dexie's live-query reactivity) ────────────
const _listeners = new Set()

export function notifyChange() {
  _listeners.forEach(fn => fn())
}

export function onDBChange(fn) {
  _listeners.add(fn)
  return () => _listeners.delete(fn)
}

// ─── Password hashing (Web Crypto API) ───────────────────────────────────────
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('')
  const encoder = new TextEncoder()
  const data = encoder.encode(saltHex + password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
  return `${saltHex}:${hashHex}`
}

async function verifyPassword(password, storedHash) {
  const [saltHex, expectedHash] = storedHash.split(':')
  const encoder = new TextEncoder()
  const data = encoder.encode(saltHex + password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
  return hashHex === expectedHash
}

// ─── Schema init ─────────────────────────────────────────────────────────────
// Pass DDL as plain strings — stmtToHrana handles strings without touching .args
export async function initDB() {
  await client.batch([
    `CREATE TABLE IF NOT EXISTS users (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        email      TEXT    NOT NULL UNIQUE,
        name       TEXT    NOT NULL,
        password   TEXT    NOT NULL,
        created_at INTEGER NOT NULL
      )`,
    `CREATE TABLE IF NOT EXISTS projects (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT    NOT NULL,
        description TEXT,
        created_at  INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL
      )`,
    `CREATE TABLE IF NOT EXISTS domains (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id  INTEGER NOT NULL,
        name        TEXT    NOT NULL,
        description TEXT,
        attributes  TEXT    NOT NULL DEFAULT '[]',
        created_at  INTEGER NOT NULL
      )`,
    `CREATE TABLE IF NOT EXISTS requirements (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id   INTEGER NOT NULL,
        title        TEXT    NOT NULL,
        description  TEXT,
        gherkin      TEXT    NOT NULL DEFAULT '{"given":[],"when":[],"then":[]}',
        data_bag_ids TEXT    NOT NULL DEFAULT '[]',
        status       TEXT    NOT NULL DEFAULT 'draft',
        created_at   INTEGER NOT NULL,
        updated_at   INTEGER NOT NULL
      )`,
    `CREATE TABLE IF NOT EXISTS test_cases (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id      INTEGER NOT NULL,
        requirement_id  INTEGER,
        name            TEXT    NOT NULL,
        description     TEXT,
        steps           TEXT    NOT NULL DEFAULT '[]',
        status          TEXT    NOT NULL DEFAULT 'pending',
        preconditions   TEXT,
        expected_result TEXT,
        data_bag_id     INTEGER,
        created_at      INTEGER NOT NULL
      )`,
    `CREATE TABLE IF NOT EXISTS data_bags (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id  INTEGER NOT NULL,
        name        TEXT    NOT NULL,
        description TEXT,
        records     TEXT    NOT NULL DEFAULT '[]',
        schema_def  TEXT    NOT NULL DEFAULT '[]',
        created_at  INTEGER NOT NULL
      )`,
    `CREATE TABLE IF NOT EXISTS generated_specs (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id  INTEGER NOT NULL,
        content     TEXT    NOT NULL,
        model       TEXT,
        spec_type   TEXT,
        prompt      TEXT,
        created_at  INTEGER NOT NULL
      )`,
  ], 'write')
}

// ─── Row mappers ─────────────────────────────────────────────────────────────
const mapProject = (r) => ({
  id:          Number(r.id),
  name:        r.name,
  description: r.description || '',
  createdAt:   Number(r.created_at),
  updatedAt:   Number(r.updated_at),
})

const mapDomain = (r) => ({
  id:          Number(r.id),
  projectId:   Number(r.project_id),
  name:        r.name,
  description: r.description || '',
  attributes:  JSON.parse(r.attributes  || '[]'),
  createdAt:   Number(r.created_at),
})

const mapRequirement = (r) => ({
  id:          Number(r.id),
  projectId:   Number(r.project_id),
  title:       r.title,
  description: r.description || '',
  gherkin:     JSON.parse(r.gherkin      || '{"given":[],"when":[],"then":[]}'),
  dataBagIds:  JSON.parse(r.data_bag_ids || '[]'),
  status:      r.status || 'draft',
  createdAt:   Number(r.created_at),
  updatedAt:   Number(r.updated_at),
})

const mapTestCase = (r) => ({
  id:             Number(r.id),
  projectId:      Number(r.project_id),
  requirementId:  r.requirement_id ? Number(r.requirement_id) : null,
  dataBagId:      r.data_bag_id    ? Number(r.data_bag_id)    : null,
  name:           r.name,
  description:    r.description    || '',
  steps:          JSON.parse(r.steps || '[]'),
  status:         r.status         || 'pending',
  preconditions:  r.preconditions  || '',
  expectedResult: r.expected_result || '',
  createdAt:      Number(r.created_at),
})

const mapDataBag = (r) => ({
  id:          Number(r.id),
  projectId:   Number(r.project_id),
  name:        r.name,
  description: r.description || '',
  records:     JSON.parse(r.records    || '[]'),
  schema:      JSON.parse(r.schema_def || '[]'),
  createdAt:   Number(r.created_at),
})

const mapGeneratedSpec = (r) => ({
  id:        Number(r.id),
  projectId: Number(r.project_id),
  content:   r.content,
  model:     r.model     || '',
  specType:  r.spec_type || '',
  prompt:    r.prompt    || '',
  createdAt: Number(r.created_at),
})

// ─── Projects ────────────────────────────────────────────────────────────────
export async function createProject({ name, description = '' }) {
  const now = Date.now()
  const res = await client.execute({
    sql:  'INSERT INTO projects (name, description, created_at, updated_at) VALUES (?,?,?,?)',
    args: [name, description, now, now],
  })
  notifyChange()
  return Number(res.lastInsertRowid)
}

export async function getProjects() {
  const res = await client.execute('SELECT * FROM projects ORDER BY created_at DESC')
  return res.rows.map(mapProject)
}

export async function getProject(id) {
  const res = await client.execute({ sql: 'SELECT * FROM projects WHERE id = ?', args: [id] })
  return res.rows[0] ? mapProject(res.rows[0]) : null
}

export async function updateProject(id, { name, description }) {
  await client.execute({
    sql:  'UPDATE projects SET name=?, description=?, updated_at=? WHERE id=?',
    args: [name, description, Date.now(), id],
  })
  notifyChange()
}

export async function deleteProject(id) {
  await client.batch([
    { sql: 'DELETE FROM generated_specs WHERE project_id=?', args: [id] },
    { sql: 'DELETE FROM data_bags       WHERE project_id=?', args: [id] },
    { sql: 'DELETE FROM test_cases      WHERE project_id=?', args: [id] },
    { sql: 'DELETE FROM requirements    WHERE project_id=?', args: [id] },
    { sql: 'DELETE FROM domains         WHERE project_id=?', args: [id] },
    { sql: 'DELETE FROM projects        WHERE id=?',         args: [id] },
  ], 'write')
  notifyChange()
}

// ─── Domains ─────────────────────────────────────────────────────────────────
export async function createDomain({ projectId, name, description = '', attributes = [] }) {
  const res = await client.execute({
    sql:  'INSERT INTO domains (project_id, name, description, attributes, created_at) VALUES (?,?,?,?,?)',
    args: [projectId, name, description, JSON.stringify(attributes), Date.now()],
  })
  notifyChange()
  return Number(res.lastInsertRowid)
}

export async function getDomains(projectId) {
  const res = await client.execute({ sql: 'SELECT * FROM domains WHERE project_id=? ORDER BY created_at ASC', args: [projectId] })
  return res.rows.map(mapDomain)
}

export async function updateDomain(id, { name, description, attributes }) {
  await client.execute({
    sql:  'UPDATE domains SET name=?, description=?, attributes=? WHERE id=?',
    args: [name, description, JSON.stringify(attributes), id],
  })
  notifyChange()
}

export async function deleteDomain(id) {
  await client.execute({ sql: 'DELETE FROM domains WHERE id=?', args: [id] })
  notifyChange()
}

// ─── Requirements ─────────────────────────────────────────────────────────────
export async function createRequirement({ projectId, title, description = '', gherkin = {}, dataBagIds = [], status = 'draft' }) {
  const now = Date.now()
  const res = await client.execute({
    sql:  'INSERT INTO requirements (project_id, title, description, gherkin, data_bag_ids, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)',
    args: [projectId, title, description, JSON.stringify(gherkin), JSON.stringify(dataBagIds), status, now, now],
  })
  notifyChange()
  return Number(res.lastInsertRowid)
}

export async function getRequirements(projectId) {
  const res = await client.execute({ sql: 'SELECT * FROM requirements WHERE project_id=? ORDER BY created_at ASC', args: [projectId] })
  return res.rows.map(mapRequirement)
}

export async function updateRequirement(id, { title, description, gherkin, dataBagIds, status }) {
  await client.execute({
    sql:  'UPDATE requirements SET title=?, description=?, gherkin=?, data_bag_ids=?, status=?, updated_at=? WHERE id=?',
    args: [title, description, JSON.stringify(gherkin), JSON.stringify(dataBagIds), status, Date.now(), id],
  })
  notifyChange()
}

export async function deleteRequirement(id) {
  await client.batch([
    { sql: 'DELETE FROM test_cases   WHERE requirement_id=?', args: [id] },
    { sql: 'DELETE FROM requirements WHERE id=?',             args: [id] },
  ], 'write')
  notifyChange()
}

// ─── Test Cases ───────────────────────────────────────────────────────────────
export async function createTestCase({ projectId, requirementId = null, dataBagId = null, name, description = '', steps = [], status = 'pending', preconditions = '', expectedResult = '' }) {
  const res = await client.execute({
    sql:  'INSERT INTO test_cases (project_id, requirement_id, name, description, steps, status, preconditions, expected_result, data_bag_id, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
    args: [projectId, requirementId, name, description, JSON.stringify(steps), status, preconditions, expectedResult, dataBagId, Date.now()],
  })
  notifyChange()
  return Number(res.lastInsertRowid)
}

export async function getTestCases(projectId) {
  const res = await client.execute({ sql: 'SELECT * FROM test_cases WHERE project_id=? ORDER BY created_at ASC', args: [projectId] })
  return res.rows.map(mapTestCase)
}

export async function updateTestCase(id, { name, description, requirementId, dataBagId, steps, status, preconditions, expectedResult }) {
  await client.execute({
    sql:  'UPDATE test_cases SET name=?, description=?, requirement_id=?, data_bag_id=?, steps=?, status=?, preconditions=?, expected_result=? WHERE id=?',
    args: [name, description, requirementId, dataBagId, JSON.stringify(steps), status, preconditions, expectedResult, id],
  })
  notifyChange()
}

export async function deleteTestCase(id) {
  await client.execute({ sql: 'DELETE FROM test_cases WHERE id=?', args: [id] })
  notifyChange()
}

// ─── Data Bags ────────────────────────────────────────────────────────────────
export async function createDataBag({ projectId, name, description = '', records = [], schema = [] }) {
  const res = await client.execute({
    sql:  'INSERT INTO data_bags (project_id, name, description, records, schema_def, created_at) VALUES (?,?,?,?,?,?)',
    args: [projectId, name, description, JSON.stringify(records), JSON.stringify(schema), Date.now()],
  })
  notifyChange()
  return Number(res.lastInsertRowid)
}

export async function getDataBags(projectId) {
  const res = await client.execute({ sql: 'SELECT * FROM data_bags WHERE project_id=? ORDER BY created_at ASC', args: [projectId] })
  return res.rows.map(mapDataBag)
}

export async function updateDataBag(id, data) {
  await client.execute({
    sql:  'UPDATE data_bags SET name=?, description=?, records=?, schema_def=? WHERE id=?',
    args: [data.name, data.description, JSON.stringify(data.records), JSON.stringify(data.schema), id],
  })
  notifyChange()
}

export async function deleteDataBag(id) {
  await client.execute({ sql: 'DELETE FROM data_bags WHERE id=?', args: [id] })
  notifyChange()
}

// ─── Generated Specs ──────────────────────────────────────────────────────────
export async function saveGeneratedSpec({ projectId, content, model = '', specType = '', prompt = '' }) {
  const res = await client.execute({
    sql:  'INSERT INTO generated_specs (project_id, content, model, spec_type, prompt, created_at) VALUES (?,?,?,?,?,?)',
    args: [projectId, content, model, specType, prompt, Date.now()],
  })
  notifyChange()
  return Number(res.lastInsertRowid)
}

export async function getGeneratedSpecs(projectId) {
  const res = await client.execute({ sql: 'SELECT * FROM generated_specs WHERE project_id=? ORDER BY created_at DESC', args: [projectId] })
  return res.rows.map(mapGeneratedSpec)
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export async function createUser({ email, name, password }) {
  const existing = await findUserByEmail(email)
  if (existing) throw new Error('An account with this email already exists.')
  const hashed = await hashPassword(password)
  const res = await client.execute({
    sql:  'INSERT INTO users (email, name, password, created_at) VALUES (?,?,?,?)',
    args: [email.toLowerCase().trim(), name.trim(), hashed, Date.now()],
  })
  return { id: Number(res.lastInsertRowid), email: email.toLowerCase().trim(), name: name.trim() }
}

export async function findUserByEmail(email) {
  const res = await client.execute({
    sql:  'SELECT * FROM users WHERE email = ?',
    args: [email.toLowerCase().trim()],
  })
  return res.rows[0] || null
}

export async function loginUser({ email, password }) {
  const user = await findUserByEmail(email)
  if (!user) throw new Error('Invalid email or password.')
  const valid = await verifyPassword(password, user.password)
  if (!valid) throw new Error('Invalid email or password.')
  return { id: Number(user.id), email: user.email, name: user.name }
}

export async function seedDemoUser() {
  const existing = await findUserByEmail('demo@demo.com')
  if (!existing) {
    await createUser({ email: 'demo@demo.com', name: 'Demo User', password: 'Abc!123' })
  }
}

// ─── Aggregate helpers ────────────────────────────────────────────────────────
export async function getRequirementCounts() {
  const res = await client.execute('SELECT project_id, COUNT(*) as cnt FROM requirements GROUP BY project_id')
  return res.rows.reduce((acc, r) => { acc[Number(r.project_id)] = Number(r.cnt); return acc }, {})
}
