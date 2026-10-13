import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('real PostgreSQL: schema constraints, duplicate handling, permissions and quotas', async t => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      grant usage on schema public to anon, authenticated, service_role;
      alter default privileges grant all on tables to anon, authenticated, service_role;
      alter default privileges grant execute on functions to anon, authenticated, service_role;`);
    await db.exec(await readFile('supabase/migrations/20261012172205_create_waitlist.sql', 'utf8'));
    await db.exec(await readFile('supabase/verify_permissions.sql', 'utf8'));
    const rpc = async (email, hash = 'a'.repeat(64), extras = {}) => {
      await db.exec('set role service_role');
      try {
        const result = await db.query('select public.register_waitlist($1,$2,$3,$4,$5) as result', [extras.name ?? 'Aïcha Bello', email, extras.country ?? 'ng', extras.level ?? 'B1', hash]);
        return result.rows[0].result;
      } finally { await db.exec('reset role'); }
    };
    await t.test('new and normalised duplicate produce identical results; original data stays intact', async () => {
      assert.equal(await rpc(' AICHA@Example.COM '), 'accepted');
      assert.equal(await rpc('aicha@example.com', 'a'.repeat(64), { name: 'Someone Else' }), 'accepted');
      const { rows } = await db.query('select * from parlonsmoi_private.waitlist');
      assert.equal(rows.length, 1); assert.equal(rows[0].full_name, 'Aïcha Bello');
      assert.equal(rows[0].email, 'aicha@example.com'); assert.equal(rows[0].country, 'NG');
      assert.match(rows[0].id, /^[0-9a-f-]{36}$/); assert.ok(rows[0].created_at);
    });
    await t.test('database rejects malformed data and enforces uniqueness independently', async () => {
      await assert.rejects(db.query(`insert into parlonsmoi_private.waitlist(full_name,email,country,french_level) values ('Another User',' AICHA@EXAMPLE.COM ','NG','A1')`), /duplicate key/);
      for (const [email, extras] of [['bad-email',{}],['valid@example.com',{country:'ZZ'}],['valid@example.com',{level:'expert'}],['valid@example.com',{name:'A'}]]) await assert.rejects(rpc(email, 'b'.repeat(64), extras), /check constraint/);
    });
    await t.test('anon and authenticated cannot read, write or invoke signup', async () => {
      for (const role of ['anon','authenticated']) {
        await db.exec(`set role ${role}`);
        try {
          await assert.rejects(db.query('select email from parlonsmoi_private.waitlist'), /permission denied/);
          await assert.rejects(db.query(`insert into parlonsmoi_private.waitlist(full_name,email,country,french_level) values ('Bad Actor','bad@example.com','NG','A1')`), /permission denied/);
          await assert.rejects(db.query(`select public.register_waitlist('Bad Actor','bad@example.com','NG','A1','${'c'.repeat(64)}')`), /permission denied/);
        } finally { await db.exec('reset role'); }
      }
    });
    await t.test('RLS remains a barrier even if a read grant is accidentally reintroduced', async () => {
      await db.exec('begin; grant usage on schema parlonsmoi_private to anon; grant select on parlonsmoi_private.waitlist to anon; set role anon;');
      assert.equal((await db.query('select * from parlonsmoi_private.waitlist')).rows.length, 0);
      await db.exec('reset role; rollback;');
    });
    await t.test('server role cannot read full registrations or change generated fields', async () => {
      await db.exec('set role service_role');
      try {
        await assert.rejects(db.query('select * from parlonsmoi_private.waitlist'), /permission denied/);
        await assert.rejects(db.query("update parlonsmoi_private.waitlist set full_name='Changed'"), /permission denied/);
        await assert.rejects(db.query("delete from parlonsmoi_private.waitlist"), /permission denied/);
      } finally { await db.exec('reset role'); }
    });
    await t.test('limits count attempts, not whether an address exists', async () => {
      assert.equal(await rpc('aicha@example.com'), 'accepted');
      assert.equal(await rpc('aicha@example.com'), 'rate_limited');
      assert.equal((await db.query('select count(*)::int as n from parlonsmoi_private.waitlist')).rows[0].n, 1);
      await db.exec("update parlonsmoi_private.waitlist_limits set attempts=100 where bucket_key='global'");
      assert.equal(await rpc('fresh@example.com', 'd'.repeat(64)), 'rate_limited');
      assert.equal((await db.query('select count(*)::int as n from parlonsmoi_private.waitlist')).rows[0].n, 1);
    });
  } finally { await db.close(); }
});
