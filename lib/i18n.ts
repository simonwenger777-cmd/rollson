export const LOCALES = [
  { code: "en", short: "EN", name: "English", flag: "🇬🇧" },
  { code: "fr", short: "FR", name: "Français", flag: "🇫🇷" },
  { code: "es", short: "ES", name: "Español", flag: "🇪🇸" },
  { code: "ru", short: "RU", name: "Русский", flag: "🇷🇺" },
  { code: "ar", short: "AR", name: "العربية", flag: "🇲🇦" },
] as const;

export type Locale = (typeof LOCALES)[number]["code"];

const en = {
  "nav.inbox": "Inbox",
  "common.rights": "All Rights Reserved to",
  "main.badge": "Secure inbox lookup",
  "main.title": "ROLLSON — mail, codes",
  "main.intro": "Enter your CD key to open the linked inbox and copy recent verification codes.",
  "main.checking": "Checking...",
  "main.openInbox": "Open Inbox",
  "main.queryFailed": "Query failed.",
  "main.networkError": "Network error. Please try again later.",
  "main.copyFailed": "Copy failed. Please copy manually.",
  "main.ready": "Ready",
  "main.readyText": "Enter a valid CD key to check its authorized inbox.",
  "main.noRecentMail": "No recent mail",
  "main.noRecentMailText": "No inbox messages were found inside the active query window.",
  "main.autoRefreshOn": "Auto-check every 10s ({done}/{max})",
  "main.autoRefreshing": "Checking for new mail…",
  "main.autoRefreshDone": "Auto-check finished. Press Refresh for a new code.",
  "main.lastChecked": "last check {time}",
  "main.refreshNow": "Refresh",
  "main.autoWaitHint": "Stay on this page — codes are checked automatically for 5 minutes.",
  "main.mailbox": "Mailbox",
  "main.window": "Window",
  "main.messages": "Messages",
  "main.keyExpires": "Key Expires",
  "main.daysLeft": "Days Left",
  "main.verificationCode": "Verification Code",
  "main.copy": "Copy",
  "main.copied": "Copied",
  "main.noBodyPreview": "No body preview available.",
  "main.viewFullEmail": "View full email",
  "main.hideFullEmail": "Hide full email",
  "main.originalEmailHint": "Original email view. Links open in a new tab.",
  "main.noFullEmail": "No full email content available.",
};

const ru: typeof en = {
  ...en,
  "nav.inbox": "Почта",
  "common.rights": "Все права принадлежат",
  "main.badge": "Безопасный доступ к почте",
  "main.title": "ROLLSON — почта, коды",
  "main.intro": "Введите CD-ключ, чтобы открыть связанный ящик и скопировать коды подтверждения.",
  "main.checking": "Проверка...",
  "main.openInbox": "Открыть почту",
  "main.queryFailed": "Запрос не удался.",
  "main.networkError": "Ошибка сети. Повторите попытку позже.",
  "main.copyFailed": "Не удалось скопировать. Скопируйте вручную.",
  "main.ready": "Готово",
  "main.readyText": "Введите действительный CD-ключ для доступа к почтовому ящику.",
  "main.noRecentMail": "Нет свежей почты",
  "main.noRecentMailText": "В активном окне запроса писем в ящике не найдено.",
  "main.autoRefreshOn": "Автопроверка каждые 10 с ({done}/{max})",
  "main.autoRefreshing": "Проверяем новые письма…",
  "main.autoRefreshDone": "Автопроверка закончилась. Нажмите Обновить для нового кода.",
  "main.lastChecked": "проверка {time}",
  "main.refreshNow": "Обновить",
  "main.autoWaitHint": "Оставайтесь на странице — коды проверяются автоматически 5 минут.",
  "main.mailbox": "Ящик",
  "main.window": "Окно",
  "main.messages": "Письма",
  "main.keyExpires": "Ключ до",
  "main.daysLeft": "Осталось дней",
  "main.verificationCode": "Код подтверждения",
  "main.copy": "Копировать",
  "main.copied": "Скопировано",
  "main.noBodyPreview": "Превью недоступно.",
  "main.viewFullEmail": "Показать письмо",
  "main.hideFullEmail": "Скрыть письмо",
  "main.originalEmailHint": "Оригинальный вид письма. Ссылки открываются в новой вкладке.",
  "main.noFullEmail": "Полный текст письма недоступен.",
};

const fr: typeof en = {
  ...en,
  "nav.inbox": "Boîte",
  "common.rights": "Tous droits réservés à",
  "main.badge": "Consultation sécurisée",
  "main.intro": "Saisissez votre clé CD pour ouvrir la boîte liée et copier les codes récents.",
  "main.checking": "Vérification...",
  "main.openInbox": "Ouvrir la boîte",
  "main.ready": "Prêt",
  "main.readyText": "Saisissez une clé CD valide pour consulter la boîte autorisée.",
  "main.noRecentMail": "Aucun mail récent",
  "main.noRecentMailText": "Aucun message n'a été trouvé dans la fenêtre de requête active.",
  "main.verificationCode": "Code de vérification",
  "main.copy": "Copier",
  "main.copied": "Copié",
};

const es: typeof en = {
  ...en,
  "nav.inbox": "Bandeja",
  "common.rights": "Todos los derechos reservados a",
  "main.badge": "Consulta segura",
  "main.intro": "Introduce tu clave CD para abrir el buzón vinculado y copiar códigos recientes.",
  "main.checking": "Comprobando...",
  "main.openInbox": "Abrir bandeja",
  "main.ready": "Listo",
  "main.readyText": "Introduce una clave CD válida para consultar su bandeja autorizada.",
  "main.noRecentMail": "Sin correo reciente",
  "main.noRecentMailText": "No se encontraron mensajes en la ventana de consulta activa.",
  "main.verificationCode": "Código de verificación",
  "main.copy": "Copiar",
  "main.copied": "Copiado",
};

const ar: typeof en = {
  ...en,
  "nav.inbox": "البريد",
  "common.rights": "جميع الحقوق محفوظة لـ",
  "main.badge": "استعلام آمن عن البريد",
  "main.intro": "أدخل مفتاح CD لفتح صندوق البريد المرتبط ونسخ رموز التحقق.",
  "main.checking": "جارٍ التحقق...",
  "main.openInbox": "فتح البريد",
  "main.ready": "جاهز",
  "main.readyText": "أدخل مفتاح CD صالحًا للوصول إلى صندوق البريد المصرح به.",
  "main.noRecentMail": "لا بريد حديث",
  "main.noRecentMailText": "لم يتم العثور على رسائل داخل نافذة الاستعلام النشطة.",
  "main.verificationCode": "رمز التحقق",
  "main.copy": "نسخ",
  "main.copied": "تم النسخ",
};

const dictionaries: Record<Locale, Record<string, string>> = { en, fr, es, ru, ar };

export function isLocale(value: string | null | undefined): value is Locale {
  return !!value && LOCALES.some((item) => item.code === value);
}

export function translate(locale: Locale, key: string, vars?: Record<string, string | number>) {
  const text = dictionaries[locale]?.[key] ?? dictionaries.en[key] ?? key;
  if (!vars) return text;
  return Object.entries(vars).reduce(
    (acc, [name, value]) => acc.replaceAll(`{${name}}`, String(value)),
    text
  );
}
