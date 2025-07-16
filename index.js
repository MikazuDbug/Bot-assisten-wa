
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pendaftaran = require('./fitur/pendaftaran');
const menu = require('./fitur/menu');
const reminder = require('./fitur/reminder');
const premium = require('./fitur/premium');
const { getGeminiResponse } = require('./ai/gemini');
const config = require('./config');
const schedule = require('node-schedule');
const fs = require('fs');

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('session');
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({ auth: state, version });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text;

    await pendaftaran.handleUser(msg, sock);

    if (text?.startsWith('tanya:')) {
      const pertanyaan = text.split('tanya:')[1].trim();
      const jawab = await getGeminiResponse(pertanyaan);
      await sock.sendMessage(from, { text: jawab });
    } else if (text === 'menu') {
      await menu.kirimMenuUtama(sock, from);
    } else if (text === 'premium') {
      await premium.cekStatus(sock, from);
    } else if (text === 'reminder') {
      await reminder.kirimReminderHarian(sock, from);
    }
  });

  schedule.scheduleJob('0 7 * * *', async () => {
    const users = JSON.parse(fs.readFileSync('./database/users.json'));
    for (const user of users) {
      if (user.premium) {
        await reminder.kirimReminderHarian(sock, user.jid);
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);
}

startBot();
