const knex = require('knex');
const bcrypt = require('bcryptjs');

// Railway injects DATABASE_URL automatically when PostgreSQL is added
const db = knex({
  client: 'pg',
  connection: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
  pool: { min: 0, max: 10 }
});

async function init() {
  // Users
  if (!await db.schema.hasTable('users')) {
    await db.schema.createTable('users', t => {
      t.increments('id');
      t.string('username').unique().notNullable();
      t.string('password_hash').notNullable();
      t.timestamp('created_at').defaultTo(db.fn.now());
    });
    console.log('Created users table');
  }

  // Settings
  if (!await db.schema.hasTable('settings')) {
    await db.schema.createTable('settings', t => {
      t.increments('id');
      t.integer('user_id').notNullable();
      t.string('key').notNullable();
      t.text('value');
      t.unique(['user_id', 'key']);
    });
  }

  // Generic JSON store for all data
  const tables = [
    'watches', 'accessories', 'estimates', 'customers', 'jobs',
    'notebook_items', 'want_list', 'purchases', 'outgoing_invoices',
    'expenses', 'appraisals', 'dealers'
  ];

  for (const tbl of tables) {
    if (!await db.schema.hasTable(tbl)) {
      await db.schema.createTable(tbl, t => {
        t.string('id').primary();
        t.integer('user_id').notNullable();
        t.text('data').defaultTo('{}');
        t.timestamp('created_at').defaultTo(db.fn.now());
      });
    }
  }

  // Invoice counter
  if (!await db.schema.hasTable('invoice_counter')) {
    await db.schema.createTable('invoice_counter', t => {
      t.integer('user_id').primary();
      t.integer('next_number').defaultTo(1101);
    });
  }

  console.log('Database ready');
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
