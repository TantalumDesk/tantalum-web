const knex = require('knex');
const bcrypt = require('bcryptjs');

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL is not set');
  process.exit(1);
}

const isInternal = process.env.DATABASE_URL.includes('railway.internal');
console.log('DB host type:', isInternal ? 'internal' : 'external');

const db = knex({
  client: 'pg',
  connection: {
    connectionString: process.env.DATABASE_URL,
    ssl: isInternal ? false : { rejectUnauthorized: false }
  },
  pool: { min: 0, max: 5 }
});

async function createIfMissing(tableName, builder) {
  const exists = await db.schema.hasTable(tableName);
  if (!exists) {
    await db.schema.createTable(tableName, builder);
    console.log('Created table:', tableName);
  }
}

async function init() {
  await db.raw('SELECT 1');
  console.log('Database connected');

  await createIfMissing('users', t => {
    t.increments('id');
    t.string('username').unique().notNullable();
    t.string('password_hash').notNullable();
    t.timestamp('created_at').defaultTo(db.fn.now());
  });

  await createIfMissing('settings', t => {
    t.increments('id');
    t.integer('user_id').notNullable();
    t.string('key').notNullable();
    t.text('value');
    t.unique(['user_id', 'key']);
  });

  for (const tbl of ['watches','accessories','estimates','customers','jobs','notebook_items','want_list','purchases','outgoing_invoices','expenses','appraisals','dealers']) {
    await createIfMissing(tbl, t => {
      t.string('id').primary();
      t.integer('user_id').notNullable();
      t.text('data').defaultTo('{}');
      t.timestamp('created_at').defaultTo(db.fn.now());
    });
  }

  await createIfMissing('invoice_counter', t => {
    t.integer('user_id').primary();
    t.integer('next_number').defaultTo(1101);
  });

  console.log('All tables ready');
}

async function ensureAdminUser(username, password) {
  const existing = await db('users').where({ username }).first();
  if (!existing) {
    const hash = bcrypt.hashSync(password, 10);
    await db('users').insert({ username, password_hash: hash });
    console.log('Created user:', username);
  }
}

module.exports = { db, init, ensureAdminUser };
