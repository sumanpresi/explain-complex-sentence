import {ImapFlow} from 'imapflow';
import {simpleParser} from 'mailparser';

const driveOwner = 'sumanpresi86geology@gmail.com';
const mailboxOwner = 'suman1.das@gsi.gov.in';
const previewBytes = 256 * 1024;
const pageSize = 25;
const appOrigin = 'https://explain-complex-sentence.vercel.app';

function reply(data, status = 200) {
  return Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
}

function messageInfo(message, folder) {
  const envelope = message.envelope || {};
  const addresses = folder === 'sent' ? envelope.to : envelope.from;
  return {
    uid:message.uid,
    subject:(envelope.subject || '(No subject)').slice(0,500),
    correspondent:(addresses || []).slice(0,8).map(row => row.name || row.address).filter(Boolean).join(', ').slice(0,500),
    date:message.internalDate || envelope.date || null
  };
}

async function handleMail(request) {
  if (request.method !== 'POST') return reply({error:'Use POST.'},405);
  if (request.headers.get('origin') !== appOrigin || new URL(request.url).origin !== appOrigin) {
    return reply({error:'Open Mail in the production Sentence Lens app.'},403);
  }

  let input;
  try {
    if (Number(request.headers.get('content-length')) > 4096) return reply({error:'Request too large.'},413);
    const body = await request.text();
    if (body.length > 4096) return reply({error:'Request too large.'},413);
    input = JSON.parse(body);
  } catch {
    return reply({error:'Invalid request.'},400);
  }
  const {driveToken,password,folder,uid,validity,offset = 0} = input || {};
  if (typeof driveToken !== 'string' || !/^[!-~]{1,2048}$/.test(driveToken)) return reply({error:'Connect your Google Drive account first.'},401);
  if (typeof password !== 'string' || !/^[a-zA-Z0-9]{12}$/.test(password)) return reply({error:'Enter your 12-character NIC app password.'},400);
  if (folder !== 'inbox' && folder !== 'sent') return reply({error:'Choose Inbox or Sent.'},400);
  if (uid !== undefined && (!Number.isInteger(uid) || uid < 1 || uid > 4294967295 || typeof validity !== 'string')) return reply({error:'Refresh the folder and try again.'},400);
  if (!Number.isSafeInteger(offset) || offset < 0) return reply({error:'Invalid page.'},400);

  try {
    const result = await fetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)',{
      headers:{Authorization:'Bearer ' + driveToken},signal:AbortSignal.timeout(5000)
    });
    if (!result.ok || (await result.json()).user?.emailAddress?.toLowerCase() !== driveOwner) {
      return reply({error:'Reconnect your Google Drive account and try again.'},403);
    }
  } catch {
    return reply({error:'Could not verify your Google Drive session. Try again.'},502);
  }

  const client = new ImapFlow({
    host:'imap.mgovcloud.in', port:993, secure:true,
    auth:{user:mailboxOwner,pass:password},
    logger:false, disableAutoIdle:true,
    connectionTimeout:7000, greetingTimeout:5000, socketTimeout:8000
  });
  // Handle socket errors without logging credentials, mailbox names or message content.
  client.on('error', () => {});
  const deadline = setTimeout(() => client.close(),18000);
  try {
    await client.connect();
    let path = 'INBOX';
    if (folder === 'sent') {
      const rows = await client.list();
      const sent = rows.find(row => row.specialUse === '\\Sent') ||
        rows.find(row => /^(sent|sent items|sent mail|sent messages)$/i.test(row.name) && !row.flags?.has('\\Noselect'));
      if (!sent) return reply({error:'NIC did not expose a Sent folder for this account.'},404);
      path = sent.path;
    }

    const mailbox = await client.mailboxOpen(path,{readOnly:true});
    const currentValidity = String(mailbox.uidValidity);
    if (uid !== undefined) {
      if (currentValidity !== validity) return reply({error:'The mailbox changed. Refresh the folder and try again.'},409);
      const message = await client.fetchOne(String(uid),{
        envelope:true, internalDate:true, size:true, source:{start:0,maxLength:previewBytes}
      },{uid:true});
      if (!message?.source) return reply({error:'This message is no longer in the folder.'},404);
      const mail = await simpleParser(message.source.subarray(0,previewBytes),{
        skipTextToHtml:true,skipImageLinks:true,maxHtmlLengthToParse:previewBytes
      });
      const body = mail.text?.trim() || '';
      return reply({message:{...messageInfo(message,folder), body:body.slice(0,50000),
        partial:message.size > message.source.length || message.size > previewBytes || body.length > 50000}});
    }

    const end = mailbox.exists - offset;
    const messages = [];
    if (end > 0) {
      const start = Math.max(1,end - pageSize + 1);
      for await (const message of client.fetch(start + ':' + end,{uid:true,envelope:true,internalDate:true})) {
        messages.push(messageInfo(message,folder));
      }
      messages.sort((a,b) => b.uid - a.uid);
    }
    return reply({messages,validity:currentValidity,nextOffset:end > pageSize ? offset + pageSize : null});
  } catch (error) {
    if (error.authenticationFailed || error.serverResponseCode === 'AUTHENTICATIONFAILED') {
      return reply({error:'NIC rejected the sign-in. Check the app password and whether IMAP access is enabled.'},401);
    }
    return reply({error:'Could not read this folder through NIC IMAP. Try again or open NIC Workplace.'},502);
  } finally {
    clearTimeout(deadline);
    client.close();
  }
}

export default {fetch:handleMail};
