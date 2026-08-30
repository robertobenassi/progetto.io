#!/usr/bin/env node
/*
 * Recupero dell'accesso amministratore.
 *
 * Si esegue sul server, dove chi ha accesso SSH ha gia' il controllo della
 * macchina: non aggiunge alcuna superficie esposta sulla rete. E' la via da
 * usare quando l'unico amministratore ha perso la password e la posta
 * elettronica non e' configurata.
 *
 *   docker exec -it progetto_backend node reset-admin.js --list
 *   docker exec -it progetto_backend node reset-admin.js mario@esempio.it
 *   docker exec -it progetto_backend node reset-admin.js mario@esempio.it --promote
 */

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const args = process.argv.slice(2);
const email = args.find(a => !a.startsWith('--'));
const promote = args.includes('--promote');
const list = args.includes('--list');

// Password leggibile ad alta voce ma non indovinabile: va comunque cambiata
// al primo accesso.
const generaPassword = () => {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  return Array.from(crypto.randomBytes(14))
    .map(b => alfabeto[b % alfabeto.length])
    .join('');
};

(async () => {
  try {
    if (list || !email) {
      const r = await pool.query(
        'SELECT id, email, name, role, active FROM users ORDER BY role, email');
      console.log('\nUtenti registrati:\n');
      r.rows.forEach(u => {
        console.log(`  ${String(u.id).padStart(3)}  ${u.email.padEnd(32)} ${u.role.padEnd(7)} ${u.active ? '' : '(disattivato)'}`);
      });
      if (!email) {
        console.log('\nPer reimpostare una password:');
        console.log('  node reset-admin.js <email>');
        console.log('  node reset-admin.js <email> --promote   (rende la persona amministratore)\n');
      }
      if (!email) return pool.end();
    }

    const u = (await pool.query('SELECT id, email, name, role FROM users WHERE email = $1', [email])).rows[0];
    if (!u) {
      console.error(`\nNessun utente con indirizzo ${email}.`);
      console.error('Usa --list per vedere gli indirizzi registrati.\n');
      process.exitCode = 1;
      return pool.end();
    }

    const nuova = generaPassword();
    await pool.query('UPDATE users SET password = $1, active = true WHERE id = $2',
      [await bcrypt.hash(nuova, 10), u.id]);

    if (promote && u.role !== 'admin') {
      await pool.query('UPDATE users SET role = $1 WHERE id = $2', ['admin', u.id]);
      // Le aree valgono solo per gli editor: da amministratore non servono piu'
      await pool.query('DELETE FROM user_countries WHERE user_id = $1', [u.id]);
    }

    // Registrato anche nel registro modifiche: un intervento dal server
    // non deve restare invisibile a chi consulta lo storico.
    await pool.query(
      `INSERT INTO audit_log (user_name, user_email, action, entity_type, entity_id, entity_label, details)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      ['(riga di comando)', 'cli', 'update', 'user', u.id,
       `${u.name || ''} (${u.email})`,
       JSON.stringify({ password_reimpostata: true, promosso_admin: promote })]
    );

    console.log('\n  Password reimpostata\n');
    console.log(`  Utente:   ${u.email}`);
    console.log(`  Ruolo:    ${promote ? 'admin' : u.role}`);
    console.log(`  Password: ${nuova}\n`);
    console.log('  Cambiala dopo il primo accesso.\n');

    await pool.end();
  } catch (err) {
    console.error('\nErrore:', err.message, '\n');
    process.exitCode = 1;
    await pool.end();
  }
})();
