// 設定は Script Properties に保存して利用します。
// 必要キー: CALENDAR_ID, DISCORD_WEBHOOK_URL, LAST_CHECKED_AT

const PROP_KEYS = {
  lastCheckedAt: 'LAST_CHECKED_AT',
  calendarId: 'CALENDAR_ID',
  webhookUrl: 'DISCORD_WEBHOOK_URL',
};

/**
 * 直近の更新差分を取得して Discord に通知
 * Advanced Google Services の Calendar v3 が有効であることが前提
 */
function pollCalendarAndNotify() {
  const props = PropertiesService.getScriptProperties();
  const calendarId = props.getProperty(PROP_KEYS.calendarId);
  const webhookUrl = props.getProperty(PROP_KEYS.webhookUrl);

  if (!calendarId || !webhookUrl) {
    console.warn('Script Properties に CALENDAR_ID / DISCORD_WEBHOOK_URL が未設定です。');
    return;
  }

  const nowIso = new Date().toISOString();
  // 少し巻き戻して取りこぼし防止
  const lastCheckedRaw = props.getProperty(PROP_KEYS.lastCheckedAt) || new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const lastChecked = new Date(new Date(lastCheckedRaw).getTime() - 60 * 1000).toISOString();

  let pageToken = null;
  const updates = [];

  do {
    const res = Calendar.Events.list(calendarId, {
      updatedMin: lastChecked,
      showDeleted: true,
      singleEvents: false,
      maxResults: 2500,
      orderBy: 'updated',
      pageToken,
    });
    if (res && res.items && res.items.length) {
      for (const ev of res.items) {
        const kind = classifyChange(ev, lastChecked);
        if (!kind) continue;
        updates.push({ kind, ev });
      }
    }
    pageToken = res.nextPageToken || null;
  } while (pageToken);

  Logger.log(`Calendar diff: ${updates.length} updates since ${lastChecked} -> ${nowIso}`);
  if (updates.length) {
    const tz = Session.getScriptTimeZone() || 'Asia/Tokyo';
    const messages = updates.map(({ kind, ev }) => buildDiscordMessage(kind, ev, tz));
    postToDiscordInChunks(webhookUrl, messages);
  }

  // 次回用に時刻更新
  props.setProperty(PROP_KEYS.lastCheckedAt, nowIso);
}

/**
 * 変更種別の判定
 */
function classifyChange(ev, lastCheckedIso) {
  const lastCheckedMs = new Date(lastCheckedIso).getTime();
  const createdMs = ev.created ? new Date(ev.created).getTime() : 0;
  const updatedMs = ev.updated ? new Date(ev.updated).getTime() : 0;
  if (ev.status === 'cancelled') return 'キャンセル';
  if (createdMs > lastCheckedMs) return '新規';
  if (updatedMs > lastCheckedMs) return '更新';
  return null;
}

/**
 * Discord メッセージを分割送信
 */
function postToDiscordInChunks(webhookUrl, messages) {
  const maxLen = 1800; // 余裕を持って分割
  let buffer = '';
  for (const msg of messages) {
    if ((buffer + '\n\n' + msg).length > maxLen) {
      if (buffer) postToDiscord(webhookUrl, buffer);
      buffer = msg;
    } else {
      buffer = buffer ? buffer + '\n\n' + msg : msg;
    }
  }
  if (buffer) postToDiscord(webhookUrl, buffer);
}

/**
 * Discord Webhook へ送信
 */
function postToDiscord(webhookUrl, content) {
  const payload = { content };
  const params = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };
  const res = UrlFetchApp.fetch(webhookUrl, params);
  const code = res.getResponseCode();
  if (code < 200 || code >= 300) {
    console.error('Discord 送信エラー:', code, res.getContentText());
  }
}

/**
 * 5分毎の時間主導トリガーを作成
 */
function installTrigger() {
  const fn = 'pollCalendarAndNotify';
  const triggers = ScriptApp.getProjectTriggers();
  const exists = triggers.some((t) => t.getHandlerFunction() === fn);
  if (!exists) {
    ScriptApp.newTrigger(fn).timeBased().everyMinutes(5).create();
  }
}

/**
 * トリガーを全削除
 */
function uninstallAllTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  for (const t of triggers) ScriptApp.deleteTrigger(t);
}
 
// 設定�E Script Properties に保存して利用します、E// 忁E��キー: CALENDAR_ID, DISCORD_WEBHOOK_URL, LAST_CHECKED_AT
 
const PROP_KEYS = {
  lastCheckedAt: 'LAST_CHECKED_AT',
  calendarId: 'CALENDAR_ID',
