// Student lockdown client. Handles UI + all browser-level lockdown behaviors.
// NOTE: Browser-level enforcement is a best-effort deterrent. True lockdown
// requires the Electron desktop wrapper (see electron/main.js).

// Feature flags. Webcam is now MANDATORY for all assessments — students
// cannot enter without granting camera access. Identity matching uses the
// teacher's Anthropic API key (the same one used for AI essay grading).
const FEATURES = {
  webcam: true,
  vmDetection: false,
};
// How often to ping the identity-check endpoint during an exam (ms). Each
// call uses ~$0.001-0.005 of the teacher's API credit. 15s gives fast
// detection of "moved away from camera" while keeping per-exam cost
// reasonable (~$0.10-0.30 for a 30-min test).
const IDENTITY_CHECK_INTERVAL_MS = 15000;
let identityIntervalId = null;
let baselineDataUrl = null; // captured at exam start, used for identity matching

// Local browser-side face presence check (FaceDetector API). Runs every
// 4 seconds and counts consecutive "no face" results. Three in a row →
// student is genuinely away from the camera → instant auto-submit. Free
// (no API cost) and works without an internet roundtrip on Chrome / Edge.
// Safari and Firefox don't support FaceDetector — those browsers fall
// back to the 15s Claude check above.
const LOCAL_FACE_INTERVAL_MS = 4000;
const LOCAL_FACE_NOFACE_THRESHOLD = 3; // 3 × 4s = ~12s of absence
let localFaceIntervalId = null;
let localFaceConsecutiveAbsences = 0;

const els = {
  listView: document.getElementById('list-view'),
  consentView: document.getElementById('consent-view'),
  assessmentView: document.getElementById('assessment-view'),
  doneView: document.getElementById('done-view'),
  assessments: document.getElementById('assessments'),
  who: document.getElementById('who'),
  logout: document.getElementById('logout'),

  consentTitle: document.getElementById('consent-title'),
  consentDesc: document.getElementById('consent-desc'),
  consentDuration: document.getElementById('consent-duration'),
  consentBack: document.getElementById('consent-back'),
  consentStart: document.getElementById('consent-start'),
  envCheck: document.getElementById('env-check'),

  assessTitle: document.getElementById('assess-title'),
  timer: document.getElementById('timer'),
  questions: document.getElementById('questions'),
  submitBtn: document.getElementById('submit-btn'),
  violationBanner: document.getElementById('violation-banner'),

  webcamWrap: document.getElementById('webcam-wrap'),
  webcam: document.getElementById('webcam'),
  webcamCanvas: document.getElementById('webcam-canvas'),
  webcamStatus: document.getElementById('webcam-status'),

  doneMsg: document.getElementById('done-msg'),
  doneBack: document.getElementById('done-back'),
  doneReview: document.getElementById('done-review'),

  pastResults: document.getElementById('past-results'),
  reviewView: document.getElementById('review-view'),
  reviewTitle: document.getElementById('review-title'),
  reviewSummary: document.getElementById('review-summary'),
  reviewBody: document.getElementById('review-body'),
  reviewBack: document.getElementById('review-back'),

  passagePanel: document.getElementById('passage-panel'),
  passageText: document.getElementById('passage-text'),

  consentRules: document.getElementById('consent-rules'),
  cameraGate: document.getElementById('camera-gate'),
  cameraGrantBtn: document.getElementById('camera-grant-btn'),
  cameraGateStatus: document.getElementById('camera-gate-status'),

  preflightGate: document.getElementById('preflight-gate'),
  preflightList: document.getElementById('preflight-list'),
};

// ----- Pre-flight checklist -----
// Bilingual checklist of things students must confirm before entering an
// assessment. Each line is shown in English plus the same regional language
// used for the consent rules popup.
const PREFLIGHT_EN = [
  'I have closed Google Meet, Zoom, Microsoft Teams, and all video-call apps.',
  'I have closed all screen-recording or screen-capture software (OBS, QuickTime Recording, Snagit, etc.).',
  'I am not sharing my screen with anyone — no app or browser tab is mirroring this device.',
  'I am alone in the room. No other person can see this screen or hear the questions.',
  'I have closed messaging apps and notifications that could distract me or share content (WhatsApp, iMessage, etc.).',
];
const PREFLIGHT_I18N = {
  ar: [
    'لقد أغلقت Google Meet و Zoom و Microsoft Teams وجميع تطبيقات مكالمات الفيديو.',
    'لقد أغلقت جميع برامج تسجيل الشاشة أو التقاط الشاشة (OBS، QuickTime Recording، Snagit، إلخ).',
    'أنا لا أشارك شاشتي مع أي شخص — لا يوجد تطبيق أو علامة تبويب متصفح يقوم بعكس هذا الجهاز.',
    'أنا وحدي في الغرفة. لا يمكن لأي شخص آخر رؤية هذه الشاشة أو سماع الأسئلة.',
    'لقد أغلقت تطبيقات المراسلة والإشعارات التي يمكن أن تشتت انتباهي أو تشارك المحتوى (WhatsApp، iMessage، إلخ).',
  ],
  hi: [
    'मैंने Google Meet, Zoom, Microsoft Teams और सभी वीडियो-कॉल ऐप बंद कर दिए हैं।',
    'मैंने सभी स्क्रीन-रिकॉर्डिंग या स्क्रीन-कैप्चर सॉफ़्टवेयर (OBS, QuickTime Recording, Snagit, आदि) बंद कर दिए हैं।',
    'मैं किसी के साथ अपनी स्क्रीन साझा नहीं कर रहा/रही हूँ — कोई ऐप या ब्राउज़र टैब इस डिवाइस को मिरर नहीं कर रहा है।',
    'मैं कमरे में अकेला/अकेली हूँ। कोई अन्य व्यक्ति इस स्क्रीन को नहीं देख सकता या प्रश्नों को सुन नहीं सकता।',
    'मैंने मैसेजिंग ऐप और नोटिफिकेशन बंद कर दिए हैं जो मुझे विचलित कर सकते हैं या सामग्री साझा कर सकते हैं (WhatsApp, iMessage, आदि)।',
  ],
  zh: [
    '我已关闭 Google Meet、Zoom、Microsoft Teams 和所有视频通话应用程序。',
    '我已关闭所有屏幕录制或屏幕捕获软件（OBS、QuickTime 录制、Snagit 等）。',
    '我没有与任何人共享我的屏幕——没有应用程序或浏览器标签页正在镜像此设备。',
    '我独自一人在房间里。没有其他人可以看到这个屏幕或听到问题。',
    '我已关闭可能分散我注意力或共享内容的消息应用程序和通知（WhatsApp、iMessage 等）。',
  ],
  es: [
    'He cerrado Google Meet, Zoom, Microsoft Teams y todas las aplicaciones de videollamadas.',
    'He cerrado todo el software de grabación o captura de pantalla (OBS, QuickTime Recording, Snagit, etc.).',
    'No estoy compartiendo mi pantalla con nadie — ninguna aplicación o pestaña del navegador está duplicando este dispositivo.',
    'Estoy solo/a en la habitación. Ninguna otra persona puede ver esta pantalla ni escuchar las preguntas.',
    'He cerrado las aplicaciones de mensajería y notificaciones que podrían distraerme o compartir contenido (WhatsApp, iMessage, etc.).',
  ],
  fr: [
    'J’ai fermé Google Meet, Zoom, Microsoft Teams et toutes les applications de visioconférence.',
    'J’ai fermé tous les logiciels d’enregistrement ou de capture d’écran (OBS, QuickTime Recording, Snagit, etc.).',
    'Je ne partage mon écran avec personne — aucune application ni onglet de navigateur ne reproduit cet appareil.',
    'Je suis seul·e dans la pièce. Aucune autre personne ne peut voir cet écran ni entendre les questions.',
    'J’ai fermé les applications de messagerie et les notifications qui pourraient me distraire ou partager du contenu (WhatsApp, iMessage, etc.).',
  ],
  th: [
    'ฉันได้ปิด Google Meet, Zoom, Microsoft Teams และแอปวิดีโอคอลทั้งหมดแล้ว',
    'ฉันได้ปิดซอฟต์แวร์บันทึกหน้าจอหรือจับภาพหน้าจอทั้งหมด (OBS, QuickTime Recording, Snagit ฯลฯ) แล้ว',
    'ฉันไม่ได้แชร์หน้าจอกับใคร — ไม่มีแอปหรือแท็บเบราว์เซอร์ใดที่กำลังสะท้อนอุปกรณ์นี้',
    'ฉันอยู่คนเดียวในห้อง ไม่มีบุคคลอื่นสามารถเห็นหน้าจอนี้หรือได้ยินคำถาม',
    'ฉันได้ปิดแอปข้อความและการแจ้งเตือนที่อาจรบกวนหรือแชร์เนื้อหา (WhatsApp, iMessage ฯลฯ) แล้ว',
  ],
  de: [
    'Ich habe Google Meet, Zoom, Microsoft Teams und alle Videoanruf-Apps geschlossen.',
    'Ich habe alle Bildschirmaufzeichnungs- oder Bildschirmaufnahme-Software (OBS, QuickTime-Aufnahme, Snagit usw.) geschlossen.',
    'Ich teile meinen Bildschirm mit niemandem — keine App oder Browser-Tab spiegelt dieses Gerät.',
    'Ich bin allein im Raum. Keine andere Person kann diesen Bildschirm sehen oder die Fragen hören.',
    'Ich habe Messaging-Apps und Benachrichtigungen geschlossen, die mich ablenken oder Inhalte teilen könnten (WhatsApp, iMessage usw.).',
  ],
  ja: [
    'Google Meet、Zoom、Microsoft Teams、およびすべてのビデオ通話アプリを閉じました。',
    'すべての画面録画または画面キャプチャソフトウェア（OBS、QuickTime 録画、Snagit など）を閉じました。',
    '画面を誰とも共有していません。このデバイスをミラーリングしているアプリやブラウザタブはありません。',
    '部屋に一人でいます。他の人はこの画面を見たり、質問を聞いたりすることはできません。',
    '気を散らしたりコンテンツを共有したりする可能性のあるメッセージアプリや通知を閉じました（WhatsApp、iMessage など）。',
  ],
};

function renderPreflight(assessment) {
  if (!els.preflightList) return;
  const langKey = detectConsentLang(assessment);
  const tr = langKey ? PREFLIGHT_I18N[langKey] : null;
  const trLabel = (langKey && CONSENT_RULES_I18N[langKey]) ? CONSENT_RULES_I18N[langKey].label : '';
  const isRtl = langKey && CONSENT_RULES_I18N[langKey] && CONSENT_RULES_I18N[langKey].rtl;

  els.preflightList.innerHTML = PREFLIGHT_EN.map((en, i) => `
    <label style="display: flex; align-items: flex-start; gap: 10px; padding: 8px 4px; cursor: pointer; border-bottom: 1px dashed rgba(124, 45, 18, 0.2);">
      <input type="checkbox" data-pf="${i}" style="margin-top: 4px; flex-shrink: 0; width: 18px; height: 18px;" />
      <div style="flex: 1;">
        <div>${escapeHtml(en)}</div>
        ${tr ? `<div style="margin-top: 4px; font-size: 13px; opacity: 0.85; ${isRtl ? 'direction: rtl; text-align: right;' : ''}">${escapeHtml(tr[i] || '')}</div>` : ''}
      </div>
    </label>
  `).join('');

  els.preflightList.querySelectorAll('input[data-pf]').forEach((cb) => {
    cb.addEventListener('change', updatePreflightState);
  });
  updatePreflightState();
}
function preflightAllChecked() {
  if (!els.preflightList) return false;
  const boxes = els.preflightList.querySelectorAll('input[data-pf]');
  if (!boxes.length) return false;
  return Array.from(boxes).every((b) => b.checked);
}
function updatePreflightState() {
  const ready = preflightAllChecked();
  if (els.cameraGrantBtn) {
    // Don't override the "✓ Enabled" disabled state once camera is granted.
    if (els.cameraGrantBtn.textContent.indexOf('Enabled') === -1) {
      els.cameraGrantBtn.disabled = !ready;
      els.cameraGrantBtn.style.opacity = ready ? '1' : '0.5';
      els.cameraGrantBtn.style.cursor = ready ? 'pointer' : 'not-allowed';
    }
  }
  if (els.preflightGate) {
    if (ready) {
      els.preflightGate.style.background = '#dcfce7';
      els.preflightGate.style.borderColor = '#16a34a';
      els.preflightGate.style.color = '#166534';
    } else {
      els.preflightGate.style.background = '#fff7ed';
      els.preflightGate.style.borderColor = '#ea580c';
      els.preflightGate.style.color = '#7c2d12';
    }
  }
}
function resetPreflight() {
  if (!els.preflightList) return;
  els.preflightList.querySelectorAll('input[data-pf]').forEach((b) => { b.checked = false; });
  updatePreflightState();
}

// ----- Bilingual consent translations -----
// The pre-assessment "Before you start" warning. Shown in English plus the
// student's regional language. Detection priority:
//   1) The teacher's chosen assessmentLanguage on the assessment (if we have
//      a translation for it).
//   2) The browser locale country code (e.g. ar-AE -> Arabic, en-IN -> Hindi).
//   3) English-only fallback.
const CONSENT_RULES_EN = {
  heading: 'Before you start',
  warning: 'Read every rule. The 🚨 rules end your test on the FIRST occurrence — no second chance. The ⚠️ rules give you 3 chances before auto-submission.',
  rules: [
    '🚨 INSTANT auto-submit if you turn off, cover, or unplug your camera during the test.',
    '🚨 INSTANT auto-submit if you move out of the camera view or look away from the screen.',
    '🚨 INSTANT auto-submit if a different person is detected in the camera.',
    '👥 If another person (a friend, sibling, parent) is sitting beside or behind you and appears in the camera, it is logged as a violation.',
    '🎤 Your microphone is also recorded. Talking, reading aloud, or letting someone in the room talk to you is logged as a violation.',
    '📱 Using a phone or second camera to photograph the screen is logged as a violation (the webcam can see it).',
    '📷 Your camera must be ON for the entire assessment. You cannot start until you grant camera access and remain clearly visible.',
    '🖥 Screen sharing is forbidden. Do not share your screen on Google Meet, Zoom, Microsoft Teams, or any other app while taking this assessment. For the strongest protection, install the ClassCurio desktop app on a Mac or Windows laptop — it physically blocks screen sharing and screenshots.',
    '⚠️ 3-strike rule: leaving this window, switching tabs, opening another app, exiting fullscreen, taking screenshots (Cmd+Shift+3/4/5, PrintScreen, Win+Shift+S), or pressing blocked shortcuts each count as one violation. After 3, the test auto-submits.',
    '⚠️ Copy, paste, cut, right-click, and common keyboard shortcuts are disabled. Trying them counts as a violation.',
    'The screen blurs heavily the moment focus leaves the window — anyone screen-sharing or watching sees a blurred page, not the questions.',
    'Every screen has your name and email watermarked diagonally across it. Any screenshot you take is traceable back to you.',
    'Once started, you cannot leave and come back — the assessment is one attempt only.',
  ],
};

// Translations of the rules. Each language has the same shape as CONSENT_RULES_EN.
const CONSENT_RULES_I18N = {
  ar: {
    label: 'العربية',
    rtl: true,
    heading: 'قبل أن تبدأ',
    warning: 'اقرأ كل قاعدة. القواعد التي تحمل علامة 🚨 تنهي اختبارك من المرة الأولى — لا فرصة ثانية. القواعد التي تحمل علامة ⚠️ تمنحك 3 فرص قبل الإرسال التلقائي.',
    rules: [
      '🚨 إرسال تلقائي فوري إذا قمت بإيقاف تشغيل الكاميرا أو تغطيتها أو فصلها أثناء الاختبار.',
      '🚨 إرسال تلقائي فوري إذا خرجت من نطاق رؤية الكاميرا أو نظرت بعيدًا عن الشاشة.',
      '🚨 إرسال تلقائي فوري إذا تم اكتشاف شخص آخر في الكاميرا.',
      '📷 يجب أن تكون الكاميرا قيد التشغيل طوال فترة التقييم. لا يمكنك البدء حتى تمنح الإذن للكاميرا وتظل مرئيًا بوضوح.',
      '🖥 مشاركة الشاشة ممنوعة. لا تشارك شاشتك على Google Meet أو Zoom أو Microsoft Teams أو أي تطبيق آخر أثناء أداء هذا التقييم. للحصول على أقوى حماية، قم بتثبيت تطبيق ClassCurio لسطح المكتب على جهاز Mac أو Windows — فهو يحظر مشاركة الشاشة ولقطات الشاشة فعليًا.',
      '⚠️ قاعدة المخالفات الثلاث: مغادرة هذه النافذة، أو تبديل علامات التبويب، أو فتح تطبيق آخر، أو الخروج من وضع ملء الشاشة، أو أخذ لقطات شاشة (Cmd+Shift+3/4/5، PrintScreen، Win+Shift+S)، أو الضغط على اختصارات محظورة، كل منها يُحسب كمخالفة. بعد 3 مخالفات، يتم إرسال الاختبار تلقائيًا.',
      '⚠️ النسخ واللصق والقص والنقر بزر الماوس الأيمن واختصارات لوحة المفاتيح الشائعة معطّلة. محاولة استخدامها تُعد مخالفة.',
      'تصبح الشاشة ضبابية بشدة بمجرد فقدان التركيز — أي شخص يشارك الشاشة أو يشاهد سيرى صفحة ضبابية، وليس الأسئلة.',
      'تحتوي كل شاشة على اسمك وبريدك الإلكتروني كعلامة مائية قطرية. أي لقطة شاشة تأخذها قابلة للتتبع إليك.',
      'بمجرد البدء، لا يمكنك المغادرة والعودة — التقييم محاولة واحدة فقط.',
    ],
  },
  hi: {
    label: 'हिन्दी',
    rtl: false,
    heading: 'शुरू करने से पहले',
    warning: 'हर नियम पढ़ें। 🚨 वाले नियम पहली बार में ही आपकी परीक्षा समाप्त कर देते हैं — दूसरा मौका नहीं। ⚠️ वाले नियम स्वचालित जमा करने से पहले आपको 3 मौके देते हैं।',
    rules: [
      '🚨 परीक्षा के दौरान कैमरा बंद करने, ढकने या कनेक्शन हटाने पर तुरंत स्वचालित जमा।',
      '🚨 कैमरे की दृष्टि से बाहर जाने या स्क्रीन से नज़रें हटाने पर तुरंत स्वचालित जमा।',
      '🚨 कैमरे में कोई दूसरा व्यक्ति दिखाई देने पर तुरंत स्वचालित जमा।',
      '📷 पूरी परीक्षा के दौरान आपका कैमरा चालू रहना अनिवार्य है। कैमरे की अनुमति दिए बिना और स्पष्ट रूप से दिखाई दिए बिना आप शुरू नहीं कर सकते।',
      '🖥 स्क्रीन साझा करना वर्जित है। इस मूल्यांकन को देते समय Google Meet, Zoom, Microsoft Teams या किसी अन्य ऐप पर अपनी स्क्रीन साझा न करें। सबसे मजबूत सुरक्षा के लिए, Mac या Windows लैपटॉप पर ClassCurio डेस्कटॉप ऐप इंस्टॉल करें — यह स्क्रीन साझा करने और स्क्रीनशॉट को भौतिक रूप से रोकता है।',
      '⚠️ 3-स्ट्राइक नियम: इस विंडो से बाहर जाना, टैब बदलना, कोई दूसरा ऐप खोलना, फुलस्क्रीन से बाहर निकलना, स्क्रीनशॉट लेना (Cmd+Shift+3/4/5, PrintScreen, Win+Shift+S), या ब्लॉक किए गए शॉर्टकट दबाना — हर एक एक उल्लंघन के रूप में गिना जाता है। 3 के बाद, परीक्षा स्वचालित रूप से जमा हो जाती है।',
      '⚠️ कॉपी, पेस्ट, कट, राइट-क्लिक और सामान्य कीबोर्ड शॉर्टकट अक्षम हैं। इन्हें आज़माना उल्लंघन माना जाता है।',
      'जब विंडो से फ़ोकस छूटता है, स्क्रीन तुरंत बहुत धुंधली हो जाती है — स्क्रीन साझा करने वाला या देखने वाला कोई भी व्यक्ति प्रश्नों के बजाय एक धुंधला पृष्ठ देखता है।',
      'हर स्क्रीन पर आपका नाम और ईमेल तिरछा वॉटरमार्क के रूप में दिखाई देता है। आपके द्वारा लिया गया कोई भी स्क्रीनशॉट आप तक पहुँचाया जा सकता है।',
      'एक बार शुरू करने के बाद, आप बाहर जाकर वापस नहीं आ सकते — मूल्यांकन का केवल एक प्रयास है।',
    ],
  },
  zh: {
    label: '中文',
    rtl: false,
    heading: '开始之前',
    warning: '请仔细阅读这些规则。违反规则将产生实际后果。',
    rules: [
      '🚨 考试期间关闭、遮挡或拔掉摄像头将立即自动提交考试。',
      '🚨 如果您离开摄像头视野或将视线从屏幕上移开，将立即自动提交。',
      '🚨 如果在摄像头中检测到其他人，将立即自动提交。',
      '📷 整个考试期间您的摄像头必须开启。您必须先授权摄像头并保持清晰可见才能开始。',
      '🖥 禁止屏幕共享。考试期间不得在 Google Meet、Zoom、Microsoft Teams 或任何其他应用程序上共享您的屏幕。为获得最强保护，请在 Mac 或 Windows 笔记本电脑上安装 ClassCurio 桌面应用程序——它能从物理上阻止屏幕共享和截图。',
      '⚠️ 三振规则：离开此窗口、切换标签页、打开其他应用程序、退出全屏、截图（Cmd+Shift+3/4/5、PrintScreen、Win+Shift+S）或按下被屏蔽的快捷键——每一项都计为一次违规。三次违规后，考试自动提交。',
      '⚠️ 复制、粘贴、剪切、右键单击以及常见的键盘快捷键已被禁用。尝试使用它们将被视为违规。',
      '当窗口失去焦点时，屏幕会立即严重模糊——任何屏幕共享或观看者只会看到模糊页面，看不到题目。',
      '每个屏幕都有您的姓名和电子邮件斜向水印。您拍摄的任何截图都可以追溯到您。',
      '一旦开始，您无法离开后再回来——评估仅有一次机会。',
    ],
  },
  es: {
    label: 'Español',
    rtl: false,
    heading: 'Antes de empezar',
    warning: 'Por favor, lee estas reglas con atención. Romperlas tiene consecuencias reales.',
    rules: [
      '🚨 Envío automático INMEDIATO si apagas, cubres o desconectas tu cámara durante el examen.',
      '🚨 Envío automático INMEDIATO si sales del encuadre de la cámara o apartas la mirada de la pantalla.',
      '🚨 Envío automático INMEDIATO si se detecta a otra persona en la cámara.',
      '📷 Tu cámara debe estar ENCENDIDA durante toda la evaluación. No puedes comenzar hasta que otorgues acceso a la cámara y permanezcas claramente visible.',
      '🖥 Compartir pantalla está prohibido. No compartas tu pantalla en Google Meet, Zoom, Microsoft Teams ni ninguna otra aplicación durante esta evaluación. Para la máxima protección, instala la aplicación de escritorio ClassCurio en una laptop Mac o Windows — bloquea físicamente la compartición de pantalla y las capturas.',
      '⚠️ Regla de 3 infracciones: salir de esta ventana, cambiar de pestaña, abrir otra aplicación, salir de pantalla completa, hacer capturas (Cmd+Shift+3/4/5, PrintScreen, Win+Shift+S), o pulsar atajos bloqueados — cada uno cuenta como una infracción. Tras 3, el examen se envía automáticamente.',
      '⚠️ Copiar, pegar, cortar, clic derecho y los atajos de teclado comunes están deshabilitados. Intentarlos cuenta como una infracción.',
      'La pantalla se vuelve fuertemente borrosa en el momento en que la ventana pierde el foco — cualquier persona compartiendo pantalla o mirando ve una página borrosa, no las preguntas.',
      'Cada pantalla tiene tu nombre y correo electrónico como marca de agua diagonal. Cualquier captura que tomes es rastreable hasta ti.',
      'Una vez que empieces, no podrás salir y volver — la evaluación es de un solo intento.',
    ],
  },
  fr: {
    label: 'Français',
    rtl: false,
    heading: 'Avant de commencer',
    warning: 'Veuillez lire attentivement ces règles. Les enfreindre a de réelles conséquences.',
    rules: [
      '🚨 Soumission automatique IMMÉDIATE si vous éteignez, couvrez ou débranchez votre caméra pendant le test.',
      '🚨 Soumission automatique IMMÉDIATE si vous sortez du champ de la caméra ou détournez le regard de l’écran.',
      '🚨 Soumission automatique IMMÉDIATE si une autre personne est détectée dans la caméra.',
      '📷 Votre caméra doit être ALLUMÉE pendant toute l’évaluation. Vous ne pouvez pas commencer tant que vous n’avez pas autorisé l’accès à la caméra et que vous n’êtes pas clairement visible.',
      '🖥 Le partage d’écran est interdit. Ne partagez pas votre écran sur Google Meet, Zoom, Microsoft Teams ou toute autre application pendant cette évaluation. Pour la protection la plus forte, installez l’application de bureau ClassCurio sur un ordinateur Mac ou Windows — elle bloque physiquement le partage d’écran et les captures.',
      '⚠️ Règle des 3 infractions : quitter cette fenêtre, changer d’onglet, ouvrir une autre application, sortir du plein écran, faire des captures (Cmd+Shift+3/4/5, PrintScreen, Win+Shift+S), ou appuyer sur des raccourcis bloqués — chaque action compte comme une infraction. Après 3, le test est soumis automatiquement.',
      '⚠️ Copier, coller, couper, clic droit et les raccourcis clavier courants sont désactivés. Tenter de les utiliser compte comme une infraction.',
      'L’écran devient fortement flou dès que la fenêtre perd le focus — quiconque partage l’écran ou regarde voit une page floue, pas les questions.',
      'Chaque écran porte votre nom et votre e-mail en filigrane diagonal. Toute capture d’écran que vous prenez est traçable jusqu’à vous.',
      'Une fois commencée, vous ne pouvez pas quitter et revenir — l’évaluation est en une seule tentative.',
    ],
  },
  th: {
    label: 'ไทย',
    rtl: false,
    heading: 'ก่อนเริ่มทำ',
    warning: 'โปรดอ่านกฎเหล่านี้อย่างละเอียด การฝ่าฝืนมีผลที่ตามมาจริง',
    rules: [
      '🚨 ส่งอัตโนมัติทันทีหากคุณปิด บัง หรือถอดกล้องระหว่างการสอบ',
      '🚨 ส่งอัตโนมัติทันทีหากคุณออกจากมุมมองกล้องหรือมองออกไปจากหน้าจอ',
      '🚨 ส่งอัตโนมัติทันทีหากตรวจพบบุคคลอื่นในกล้อง',
      '📷 กล้องของคุณต้องเปิดอยู่ตลอดระยะเวลาการสอบ คุณไม่สามารถเริ่มสอบได้จนกว่าจะอนุญาตการเข้าถึงกล้องและอยู่ในมุมมองที่ชัดเจน',
      '🖥 ห้ามแชร์หน้าจอ อย่าแชร์หน้าจอบน Google Meet, Zoom, Microsoft Teams หรือแอปอื่นใดในระหว่างการสอบนี้ เพื่อการป้องกันที่แข็งแกร่งที่สุด ให้ติดตั้งแอป ClassCurio บนเดสก์ท็อปบนแล็ปท็อป Mac หรือ Windows — มันจะบล็อกการแชร์หน้าจอและการจับภาพหน้าจอทางกายภาพ',
      '⚠️ กฎ 3 ครั้ง: การออกจากหน้าต่างนี้ การเปลี่ยนแท็บ การเปิดแอปอื่น การออกจากโหมดเต็มหน้าจอ การจับภาพหน้าจอ (Cmd+Shift+3/4/5, PrintScreen, Win+Shift+S) หรือการกดทางลัดที่ถูกบล็อก — แต่ละครั้งนับเป็นการฝ่าฝืนหนึ่งครั้ง หลังจาก 3 ครั้ง การสอบจะส่งอัตโนมัติ',
      '⚠️ การคัดลอก วาง ตัด คลิกขวา และทางลัดแป้นพิมพ์ทั่วไปถูกปิดใช้งาน การพยายามใช้นับเป็นการฝ่าฝืน',
      'หน้าจอจะเบลออย่างหนักทันทีที่หน้าต่างสูญเสียโฟกัส — ใครก็ตามที่แชร์หน้าจอหรือดูจะเห็นหน้าเว็บที่เบลอ ไม่ใช่คำถาม',
      'ทุกหน้าจอมีลายน้ำชื่อและอีเมลของคุณในแนวทแยง ภาพหน้าจอใดๆ ที่คุณถ่ายสามารถสืบย้อนกลับไปยังคุณได้',
      'เมื่อเริ่มแล้ว คุณไม่สามารถออกและกลับมาได้ — การสอบมีเพียงครั้งเดียว',
    ],
  },
  de: {
    label: 'Deutsch',
    rtl: false,
    heading: 'Bevor du beginnst',
    warning: 'Bitte lies diese Regeln sorgfältig. Verstöße haben echte Konsequenzen.',
    rules: [
      '🚨 Sofortige automatische Abgabe, wenn du deine Kamera während der Prüfung ausschaltest, abdeckst oder ausstöpselst.',
      '🚨 Sofortige automatische Abgabe, wenn du den Sichtbereich der Kamera verlässt oder vom Bildschirm wegschaust.',
      '🚨 Sofortige automatische Abgabe, wenn eine andere Person in der Kamera erkannt wird.',
      '📷 Deine Kamera muss während der gesamten Prüfung EINGESCHALTET sein. Du kannst nicht starten, bevor du den Kamerazugriff erlaubst und klar sichtbar bleibst.',
      '🖥 Bildschirmfreigabe ist verboten. Teile deinen Bildschirm während dieser Prüfung nicht über Google Meet, Zoom, Microsoft Teams oder eine andere App. Für den stärksten Schutz installiere die ClassCurio-Desktop-App auf einem Mac- oder Windows-Laptop — sie blockiert Bildschirmfreigabe und Screenshots physisch.',
      '⚠️ 3-Verstöße-Regel: Verlassen dieses Fensters, Wechseln von Tabs, Öffnen einer anderen App, Verlassen des Vollbilds, Screenshots (Cmd+Shift+3/4/5, PrintScreen, Win+Shift+S) oder Drücken blockierter Tastenkürzel — jede Aktion zählt als ein Verstoß. Nach 3 wird die Prüfung automatisch abgegeben.',
      '⚠️ Kopieren, Einfügen, Ausschneiden, Rechtsklick und gängige Tastenkürzel sind deaktiviert. Der Versuch zählt als Verstoß.',
      'Der Bildschirm wird stark unscharf, sobald das Fenster den Fokus verliert — wer den Bildschirm teilt oder zuschaut, sieht eine unscharfe Seite, nicht die Fragen.',
      'Jeder Bildschirm trägt diagonal dein Name und deine E-Mail als Wasserzeichen. Jeder Screenshot, den du machst, ist auf dich rückverfolgbar.',
      'Nach dem Start kannst du die Prüfung nicht verlassen und wiederkommen — nur ein Versuch ist möglich.',
    ],
  },
  ja: {
    label: '日本語',
    rtl: false,
    heading: '開始する前に',
    warning: 'これらのルールをよく読んでください。違反には実際の結果があります。',
    rules: [
      '🚨 テスト中にカメラをオフにしたり、覆ったり、取り外したりすると、即座に自動提出されます。',
      '🚨 カメラの視野から外れたり、画面から目をそらしたりすると、即座に自動提出されます。',
      '🚨 カメラに別の人物が検出されると、即座に自動提出されます。',
      '📷 テストの全期間中、カメラはオンのままにしてください。カメラへのアクセスを許可し、はっきりと映っていなければ開始できません。',
      '🖥 画面共有は禁止されています。このテスト中に Google Meet、Zoom、Microsoft Teams、またはその他のアプリで画面を共有しないでください。最も強力な保護のために、Mac または Windows ノートパソコンに ClassCurio デスクトップアプリをインストールしてください — 画面共有とスクリーンショットを物理的にブロックします。',
      '⚠️ 3回違反ルール：このウィンドウを離れる、タブを切り替える、別のアプリを開く、フルスクリーンを終了する、スクリーンショットを撮る (Cmd+Shift+3/4/5、PrintScreen、Win+Shift+S)、またはブロックされたショートカットを押す — それぞれが1回の違反として数えられます。3回違反するとテストは自動的に提出されます。',
      '⚠️ コピー、貼り付け、切り取り、右クリック、および一般的なキーボードショートカットは無効になっています。試みると違反として数えられます。',
      'ウィンドウがフォーカスを失った瞬間に画面が大きくぼやけます — 画面を共有している人や見ている人は、質問ではなく、ぼやけたページを見ることになります。',
      'すべての画面には、あなたの名前とメールアドレスが斜めに透かしとして表示されます。撮影したスクリーンショットはすべてあなたまで追跡可能です。',
      '一度開始すると、離れて戻ることはできません — テストは一度きりです。',
    ],
  },
};

// Map browser locale country codes (and a few language codes) to a translation key.
// Used as a fallback when assessmentLanguage isn't a translated language.
const COUNTRY_TO_LANG = {
  // UAE, Saudi, Egypt, Jordan, etc. — Arabic
  AE: 'ar', SA: 'ar', EG: 'ar', JO: 'ar', KW: 'ar', QA: 'ar', BH: 'ar',
  OM: 'ar', LB: 'ar', SY: 'ar', YE: 'ar', IQ: 'ar', LY: 'ar', MA: 'ar',
  TN: 'ar', DZ: 'ar', SD: 'ar',
  // South Asia — Hindi (default for India). NOTE: India has many languages but
  // Hindi is the most widely-recognized fallback.
  IN: 'hi', NP: 'hi',
  // Greater China — Mandarin
  CN: 'zh', TW: 'zh', HK: 'zh', SG: 'zh',
  // Japanese, Korean, Thai
  JP: 'ja', KR: 'ja' /* fallback for KR is japanese here, override below */,
  TH: 'th',
  // German-speaking
  DE: 'de', AT: 'de', CH: 'de',
  // French-speaking
  FR: 'fr', BE: 'fr', CA: 'fr', CI: 'fr', SN: 'fr', CM: 'fr',
  // Spanish-speaking
  ES: 'es', MX: 'es', AR: 'es', CO: 'es', CL: 'es', PE: 'es', VE: 'es',
};

// Map the teacher's assessmentLanguage value (free-text) to a translation key.
const LANG_NAME_TO_KEY = {
  Arabic: 'ar',
  Hindi: 'hi',
  Thai: 'th',
  'Mandarin Chinese': 'zh',
  Spanish: 'es',
  French: 'fr',
  German: 'de',
  Japanese: 'ja',
};

// Map IANA timezones to a regional language. This is the most reliable
// "where is the student physically located" signal we have in a browser
// without asking for permission. A student in Dubai on a Mac with default
// 'en-US' locale STILL has Asia/Dubai as their timezone — so we'll
// correctly show English + Arabic to them.
const TIMEZONE_TO_LANG = {
  // ----- Arabic-speaking regions -----
  'Asia/Dubai': 'ar', 'Asia/Riyadh': 'ar', 'Asia/Qatar': 'ar', 'Asia/Bahrain': 'ar',
  'Asia/Kuwait': 'ar', 'Asia/Muscat': 'ar', 'Asia/Beirut': 'ar', 'Asia/Damascus': 'ar',
  'Asia/Baghdad': 'ar', 'Asia/Amman': 'ar', 'Asia/Aden': 'ar',
  'Africa/Cairo': 'ar', 'Africa/Tripoli': 'ar', 'Africa/Tunis': 'ar', 'Africa/Algiers': 'ar',
  'Africa/Casablanca': 'ar', 'Africa/Khartoum': 'ar', 'Africa/El_Aaiun': 'ar',
  // ----- Hindi (India + Nepal) -----
  'Asia/Kolkata': 'hi', 'Asia/Calcutta': 'hi', 'Asia/Kathmandu': 'hi',
  // ----- Greater China + Singapore: Mandarin -----
  'Asia/Shanghai': 'zh', 'Asia/Hong_Kong': 'zh', 'Asia/Taipei': 'zh',
  'Asia/Singapore': 'zh', 'Asia/Macau': 'zh', 'Asia/Urumqi': 'zh',
  // ----- Thai -----
  'Asia/Bangkok': 'th',
  // ----- Japanese -----
  'Asia/Tokyo': 'ja',
  // Korean — using ja as fallback since we don't have a 'ko' translation set.
  'Asia/Seoul': 'ja',
  // ----- German -----
  'Europe/Berlin': 'de', 'Europe/Vienna': 'de', 'Europe/Zurich': 'de',
  'Europe/Luxembourg': 'de',
  // ----- French -----
  'Europe/Paris': 'fr', 'Europe/Brussels': 'fr', 'Europe/Monaco': 'fr',
  'America/Montreal': 'fr', 'Africa/Abidjan': 'fr', 'Africa/Dakar': 'fr',
  'Africa/Douala': 'fr', 'Indian/Reunion': 'fr',
  // ----- Spanish -----
  'Europe/Madrid': 'es', 'America/Mexico_City': 'es', 'America/Argentina/Buenos_Aires': 'es',
  'America/Lima': 'es', 'America/Santiago': 'es', 'America/Bogota': 'es',
  'America/Caracas': 'es', 'America/La_Paz': 'es', 'America/Asuncion': 'es',
  'America/Montevideo': 'es', 'America/Guatemala': 'es', 'America/Costa_Rica': 'es',
  'America/Panama': 'es',
};

function detectByTimezone() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz && TIMEZONE_TO_LANG[tz] ? TIMEZONE_TO_LANG[tz] : null;
  } catch {
    return null;
  }
}

function detectConsentLang(assessment) {
  // 1) Teacher's explicit choice on this assessment ALWAYS wins. A school
  //    teaching Arabic curriculum to students physically in India should
  //    still see English + Arabic.
  if (assessment && assessment.assessmentLanguage) {
    const k = LANG_NAME_TO_KEY[assessment.assessmentLanguage];
    if (k && CONSENT_RULES_I18N[k]) return k;
  }
  // 2) GEOGRAPHIC: timezone is the most accurate "where is this student
  //    physically located" signal available in a browser without asking
  //    for permission. Student in UAE → Asia/Dubai → Arabic, regardless
  //    of what their browser locale says.
  const tzLang = detectByTimezone();
  if (tzLang && CONSENT_RULES_I18N[tzLang]) return tzLang;
  // 3) Browser locale country code (e.g. 'ar-AE', 'en-IN'). This is a
  //    secondary geographic signal — useful when a student picked a
  //    locale that includes a country.
  const loc = (navigator.language || navigator.userLanguage || '').trim();
  const parts = loc.split(/[-_]/);
  const country = (parts[1] || '').toUpperCase();
  if (country && COUNTRY_TO_LANG[country]) return COUNTRY_TO_LANG[country];
  // 4) Browser language code (e.g. user manually chose 'ar' as language).
  const langCode = (parts[0] || '').toLowerCase();
  if (CONSENT_RULES_I18N[langCode]) return langCode;
  // 5) Dashboard's UI-language preference. Lower priority than geography
  //    because students don't usually set this — only teachers do, and a
  //    teacher's UI preference shouldn't dictate the student popup language.
  try {
    const uiLang = localStorage.getItem('classcurio.uiLang');
    if (uiLang && CONSENT_RULES_I18N[uiLang]) return uiLang;
  } catch {}
  // 6) Final fallback — Arabic, since unknown-region international-school
  //    students are statistically more likely to be in Gulf/MENA than
  //    elsewhere. Either way, ALWAYS show two languages, never just English.
  return 'ar';
}

function renderConsentRules(assessment) {
  if (!els.consentRules) return;
  const langKey = detectConsentLang(assessment);
  const en = CONSENT_RULES_EN;
  const tr = langKey ? CONSENT_RULES_I18N[langKey] : null;

  // On-site mode: drop the camera-related rules and the screen-sharing
  // rule (lines 1-4 in the rules array). The remaining rules cover
  // tab-switching, shortcuts, blur, watermarks, one-attempt — all still
  // relevant in a supervised classroom exam.
  const isOnsite = assessment && assessment.deliveryMode === 'onsite';
  const filterRules = (rules) => {
    if (!isOnsite) return rules;
    return rules.filter((r) => {
      const t = String(r);
      return !t.startsWith('🚨')   // INSTANT camera-related rules
          && !t.startsWith('📷')   // camera-on requirement
          && !t.startsWith('🖥');  // screen-sharing rule
    });
  };

  const enBlock = `
    <div style="padding: 16px 18px;">
      <h2 style="margin: 0 0 6px; color:#fff;">⚠️ ${en.heading}</h2>
      <p style="color:#ffd9d9; margin: 0 0 10px;">${isOnsite ? 'You are taking this assessment in school under teacher supervision. Read every rule.' : en.warning}</p>
      <ul style="margin: 0; padding-left: 22px; color:#fff;">
        ${filterRules(en.rules).map((r) => `<li style="margin-bottom: 4px;">${escapeHtml(r)}</li>`).join('')}
      </ul>
    </div>
  `;

  const trBlock = tr ? `
    <div style="padding: 16px 18px; border-top: 1px solid rgba(255,255,255,0.2); ${tr.rtl ? 'direction: rtl; text-align: right;' : ''}">
      <h2 style="margin: 0 0 6px; color:#fff;">⚠️ ${tr.heading} <span style="font-size: 13px; opacity: 0.7;">(${tr.label})</span></h2>
      <p style="color:#ffd9d9; margin: 0 0 10px;">${tr.warning}</p>
      <ul style="margin: 0; padding-${tr.rtl ? 'right' : 'left'}: 22px; color:#fff;">
        ${filterRules(tr.rules).map((r) => `<li style="margin-bottom: 4px;">${escapeHtml(r)}</li>`).join('')}
      </ul>
    </div>
  ` : '';

  els.consentRules.innerHTML = `
    <div style="margin: 16px 0; border-radius: 12px; overflow: hidden; background: linear-gradient(135deg, ${isOnsite ? '#1e3a8a, #1e40af' : '#991b1b, #7c2d12'}); border: 2px solid ${isOnsite ? '#60a5fa' : '#f87171'}; box-shadow: 0 4px 14px ${isOnsite ? 'rgba(37,99,235,0.25)' : 'rgba(220,38,38,0.25)'};">
      ${enBlock}
      ${trBlock}
    </div>
  `;
}

let lastResultId = null;

let currentAssessment = null;
let answers = {};           // questionId -> value
let violations = [];        // array of strings (reasons)
let multiFaceFlagged = false; // latch so multi-face only fires on rising edge
const MAX_VIOLATIONS = 3;
let startedAt = null;
let endAt = null;           // absolute epoch ms deadline
let timerInterval = null;
let submitted = false;
let lockdownActive = false;

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// Cached current user so the watermark can stamp identity onto every page.
let currentUser = null;

// ---------- Forced password change (pre-registered students, first login) -----
function showForcePwView() {
  // Hide every other view; show only the password-change panel.
  ['listView','consentView','assessmentView','doneView','reviewView'].forEach((k) => {
    if (els[k]) els[k].style.display = 'none';
  });
  const fp = document.getElementById('force-pw-view');
  if (fp) fp.style.display = 'block';

  const cur = document.getElementById('fp-current');
  const nu  = document.getElementById('fp-new');
  const cf  = document.getElementById('fp-confirm');
  const status = document.getElementById('fp-status');
  const btn = document.getElementById('fp-submit');
  if (!btn) return;
  btn.onclick = async () => {
    const currentPassword = (cur.value || '').trim();
    const newPassword = (nu.value || '').trim();
    const confirmPassword = (cf.value || '').trim();
    if (!currentPassword) { status.textContent = '⚠ Enter your temporary password.'; return; }
    if (newPassword.length < 6) { status.textContent = '⚠ New password must be at least 6 characters.'; return; }
    if (newPassword !== confirmPassword) { status.textContent = '⚠ The two new passwords don\'t match.'; return; }
    status.textContent = 'Saving…';
    btn.disabled = true;
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || 'Could not change password');
      // Done — hide the panel and reload the dashboard.
      const fp2 = document.getElementById('force-pw-view');
      if (fp2) fp2.style.display = 'none';
      // Reload `me` to refresh mustChangePassword=false in the session view.
      location.reload();
    } catch (e) {
      status.textContent = '❌ ' + e.message;
      btn.disabled = false;
    }
  };
}

// ---------- Init ----------
(async () => {
  const { user } = await api('/api/me');
  if (!user || user.role !== 'student') {
    location.href = '/';
    return;
  }
  currentUser = user;
  els.who.textContent = `${user.name} (${user.email})`;

  // Pre-registered students must change their temporary password before
  // they can do anything else. Show the force-password-change view and
  // hide everything else until they complete it.
  if (user.mustChangePassword) {
    showForcePwView();
    return;
  }

  await loadAssessments();
  await loadPastResults();

  // Deep link: if the URL hash is #take=<id>, jump straight to the consent screen.
  const m = /^#take=(.+)$/.exec(location.hash || '');
  if (m) {
    const id = decodeURIComponent(m[1]);
    history.replaceState(null, '', '/student.html'); // clean up the URL
    openConsent(id);
  }
})();

els.logout.onclick = async () => {
  if (lockdownActive) {
    alert('You cannot sign out during an active assessment.');
    return;
  }
  // Defensive: clear any leftover kiosk/fullscreen state before navigating
  // to the sign-in page.
  try { window.lockdown && window.lockdown.forceUnlock && window.lockdown.forceUnlock(); } catch {}
  try { await document.exitFullscreen?.(); } catch {}
  await api('/api/logout', { method: 'POST' });
  location.href = '/';
};

async function loadAssessments() {
  // Students no longer browse a list of available assessments. The "Available
  // assessments" header is replaced with one of two things:
  //   - If the student has past submissions: a context banner reminding them
  //     that new assessments arrive via teacher-shared links.
  //   - If they have nothing yet: a big friendly placeholder explaining the
  //     link-only flow.
  // The actual history list is rendered separately by loadPastResults().
  const list = await api('/api/assessments'); // server returns only submitted
  if (!list.length) {
    els.assessments.innerHTML = `
      <div class="panel" style="background: linear-gradient(135deg, #1a1e33, #312e81); color:#fff; border-color:#2b3152; text-align: center; padding: 40px 24px;">
        <div style="font-size: 64px; margin-bottom: 12px;">📬</div>
        <h2 style="margin: 0 0 8px; color:#fff;">You haven't taken any assessments yet</h2>
        <p style="color:#9ba0bd; max-width: 480px; margin: 0 auto;">
          Your teacher will send you a link when an assessment is ready.
          Click the link they share with you to begin.
        </p>
      </div>
    `;
    return;
  }
  // Has past submissions — show a small reminder banner. The detailed list is
  // rendered by loadPastResults() below this section.
  els.assessments.innerHTML = `
    <div class="panel" style="background:#1a1e33; color:#9ba0bd; border-color:#2b3152;">
      <div style="font-size: 13px;">
        📋 Your completed assessments are below. To take a new assessment, click the link your teacher sent you — it will open here automatically.
      </div>
    </div>
  `;
}

// ---------- Consent ----------
let envBlocked = false;
let envReport = null;

async function openConsent(id) {
  try {
    const { assessment } = await api(`/api/assessments/${id}/take`);
    currentAssessment = assessment;
  } catch (e) {
    alert(e.message);
    return;
  }
  els.listView.style.display = 'none';
  els.consentView.style.display = 'block';
  els.consentTitle.textContent = currentAssessment.title;
  els.consentDesc.textContent = currentAssessment.description || '';
  els.consentDuration.textContent = `${currentAssessment.durationMinutes} minutes · ${currentAssessment.questions.length} questions`;

  // Render the bilingual violation rules popup.
  renderConsentRules(currentAssessment);

  // On-site mode: the teacher is physically supervising the room, so we
  // skip the camera permission gate AND the "close other apps" pre-flight
  // checklist. The screen-share / app-switch deterrents make less sense
  // when the teacher is standing next to the student.
  const isOnsite = currentAssessment.deliveryMode === 'onsite';
  if (els.preflightGate) els.preflightGate.style.display = isOnsite ? 'none' : '';
  if (els.cameraGate)    els.cameraGate.style.display    = isOnsite ? 'none' : '';

  if (!isOnsite) {
    renderPreflight(currentAssessment);
    resetPreflight();
    resetCameraGate();
  } else if (els.consentStart) {
    // On-site flow: skip both gates and unlock the start button immediately.
    els.consentStart.disabled = false;
    els.consentStart.style.opacity = '1';
    els.consentStart.style.cursor = 'pointer';
  }

  await runEnvironmentCheck();
}

// VM / environment gate. Disabled in v1 MVP (FEATURES.vmDetection).
// Kept in place so it can be re-enabled later by flipping the flag.
async function runEnvironmentCheck() {
  envBlocked = false;
  envReport = null;

  if (!FEATURES.vmDetection) {
    // v1 MVP: show a simple ready-state message and skip the VM check.
    els.envCheck.innerHTML = `
      <div class="env-ok">
        Ready to start. The screen will go fullscreen and disable tab-switching,
        copy/paste, right-click, and common keyboard shortcuts during the assessment.
      </div>`;
    els.consentStart.disabled = false;
    return;
  }

  els.envCheck.innerHTML = '<em>Running environment check…</em>';

  if (!window.lockdown || !window.lockdown.isElectron) {
    els.envCheck.innerHTML = `
      <div class="env-warn">
        <strong>Heads up:</strong> you are taking this in a regular browser, so we cannot
        check for virtual machines. Your teacher will see this in the results.
      </div>`;
    return;
  }

  try {
    const report = await window.lockdown.detectVm();
    envReport = report;
    // Send an early report to the server so the teacher has it even if
    // the student never submits.
    try {
      await api('/api/proctor/environment', {
        method: 'POST',
        body: { assessmentId: currentAssessment.id, report },
      });
    } catch {}
    if (report.isVm || report.confidence >= 0.5) {
      envBlocked = true;
      els.envCheck.innerHTML = `
        <div class="env-block">
          <strong>Blocked:</strong> this device appears to be a virtual machine
          (confidence ${Math.round(report.confidence * 100)}%).
          Please take this assessment on a physical device.
          <div style="margin-top:6px; font-size:12px; opacity:0.85;">${report.reasons.map(escapeHtml).join('<br/>')}</div>
        </div>`;
      els.consentStart.disabled = true;
      els.consentStart.textContent = 'Cannot start (VM detected)';
    } else {
      els.envCheck.innerHTML = `<div class="env-ok">Environment check passed (physical device).</div>`;
      els.consentStart.disabled = false;
    }
  } catch (e) {
    els.envCheck.innerHTML = `<div class="env-warn">Environment check failed: ${escapeHtml(e.message)}. Proceeding with caution.</div>`;
  }
}

els.consentBack.onclick = () => {
  // If they granted camera access but bailed on the assessment, free it.
  stopWebcam();
  els.consentView.style.display = 'none';
  els.listView.style.display = 'block';
  currentAssessment = null;
  resetCameraGate();
};

// Camera permission gate. Disable the start button until the camera is
// actually granted and producing video. If the student denies, show the
// browser-permission instructions.
function resetCameraGate() {
  if (els.consentStart) {
    els.consentStart.disabled = true;
    els.consentStart.style.opacity = '0.5';
    els.consentStart.style.cursor = 'not-allowed';
  }
  if (els.cameraGate) {
    els.cameraGate.style.background = '#fef3c7';
    els.cameraGate.style.borderColor = '#f59e0b';
    els.cameraGate.style.color = '#92400e';
  }
  if (els.cameraGateStatus) els.cameraGateStatus.textContent = '';
  if (els.cameraGrantBtn) {
    els.cameraGrantBtn.textContent = 'Enable camera';
    // The preflight checklist controls disabled state — only enable if all
    // boxes are ticked.
    const ready = preflightAllChecked();
    els.cameraGrantBtn.disabled = !ready;
    els.cameraGrantBtn.style.opacity = ready ? '1' : '0.5';
    els.cameraGrantBtn.style.cursor = ready ? 'pointer' : 'not-allowed';
  }
}
function unlockStartButton() {
  if (els.consentStart) {
    els.consentStart.disabled = false;
    els.consentStart.style.opacity = '1';
    els.consentStart.style.cursor = 'pointer';
  }
  if (els.cameraGate) {
    els.cameraGate.style.background = '#dcfce7';
    els.cameraGate.style.borderColor = '#16a34a';
    els.cameraGate.style.color = '#166534';
  }
  if (els.cameraGateStatus) els.cameraGateStatus.textContent = '✓ Camera ready';
  if (els.cameraGrantBtn) {
    els.cameraGrantBtn.disabled = true;
    els.cameraGrantBtn.textContent = '✓ Enabled';
  }
}
if (els.cameraGrantBtn) {
  els.cameraGrantBtn.onclick = async () => {
    els.cameraGateStatus.textContent = 'Requesting…';
    try {
      await startWebcam();
      unlockStartButton();
    } catch (e) {
      els.cameraGateStatus.textContent = '✗ ' + (e.message || 'Camera blocked');
      alert(
        'Camera access is required for this assessment.\n\n' +
        (e.message || '') +
        '\n\nIf you blocked the camera, click the lock/camera icon in your browser address bar to allow it, then click "Enable camera" again.'
      );
    }
  };
}

els.consentStart.onclick = async () => {
  if (envBlocked) return;
  // Camera is mandatory for ONLINE assessments only. On-site exams (teacher
  // supervising in the classroom) skip the webcam requirement entirely.
  const isOnsite = currentAssessment && currentAssessment.deliveryMode === 'onsite';
  if (FEATURES.webcam && !isOnsite && !webcamStream) {
    alert('Please click "Enable camera" first to grant camera access.');
    return;
  }
  try {
    await enterFullscreen();
  } catch (e) {
    alert('Fullscreen is required to start. ' + e.message);
    return;
  }
  startAssessment();
};

// ---------- Assessment ----------
function startAssessment() {
  els.consentView.style.display = 'none';
  els.assessmentView.style.display = 'block';
  els.assessTitle.textContent = currentAssessment.title;
  startedAt = new Date().toISOString();
  // Re-entry: resume the original count-down instead of a fresh duration.
  if (currentAssessment && currentAssessment.reentryActive && Number.isFinite(currentAssessment.remainingMs) && currentAssessment.remainingMs > 0) {
    endAt = Date.now() + currentAssessment.remainingMs;
  } else {
    endAt = Date.now() + currentAssessment.durationMinutes * 60 * 1000;
  }
  answers = {};
  violations = [];
  // Re-entry: if the server returned previousAnswers (teacher granted a
  // re-entry after a lockout), pre-load them so the form starts populated.
  if (currentAssessment && currentAssessment.reentryActive && currentAssessment.previousAnswers) {
    Object.assign(answers, currentAssessment.previousAnswers);
  }
  submitted = false;

  // Show the reading passage above the questions if the teacher attached one.
  if (els.passagePanel && els.passageText) {
    if (currentAssessment.passage && currentAssessment.passage.trim()) {
      els.passageText.textContent = currentAssessment.passage;
      els.passagePanel.style.display = 'block';
    } else {
      els.passagePanel.style.display = 'none';
    }
  }

  renderQuestions();
  // Re-entry: pre-fill the rendered inputs with the previous answers and
  // show a clear banner so the student knows what's happening.
  if (currentAssessment && currentAssessment.reentryActive && currentAssessment.previousAnswers) {
    for (const q of currentAssessment.questions) {
      const prev = currentAssessment.previousAnswers[q.id];
      if (prev === undefined || prev === null || prev === '') continue;
      if (q.type === 'mc') {
        const radios = document.getElementsByName(`q-${q.id}`);
        radios.forEach((r) => { if (Number(r.value) === Number(prev)) r.checked = true; });
      } else if (q.type === 'tf' || q.type === 'tfng') {
        const radios = document.getElementsByName(`q-${q.id}`);
        radios.forEach((r) => { if (r.value === String(prev)) r.checked = true; });
      } else {
        const input = document.querySelector(`[data-q="${q.id}"]`);
        if (input) input.value = String(prev);
      }
    }
    const banner = document.createElement('div');
    banner.style.cssText = 'background:#dbeafe; color:#1e3a8a; border:1px solid #93c5fd; border-radius:10px; padding:14px 18px; margin: 0 0 18px; font-size:17px; line-height:1.5;';
    const mins = Math.max(0, Math.round(((currentAssessment.remainingMs || 0) / 1000) / 60));
    const timeNote = mins > 0 ? ` You have <strong>${mins} minute${mins === 1 ? '' : 's'}</strong> remaining on the original timer.` : '';
    banner.innerHTML = '<strong>Continuing from where you left off.</strong> Your teacher granted you a re-entry — your previous answers have been restored.' + timeNote + ' Review, change, or complete the remaining questions, then click Submit.';
    if (els.questions && els.questions.parentNode) {
      els.questions.parentNode.insertBefore(banner, els.questions);
    }
  }
  installLockdown();
  startTimer();
  // On-site mode: skip ALL webcam infrastructure. Lockdown still installs
  // (fullscreen + tab-switch detection + watermarks + shortcut blocking)
  // because students may still try to misbehave even with a teacher in the
  // room — those don't depend on a camera.
  const isOnsite = currentAssessment && currentAssessment.deliveryMode === 'onsite';
  if (isOnsite && els.webcamWrap) {
    els.webcamWrap.style.display = 'none';
  }
  if (FEATURES.webcam && !isOnsite) {
    startProctorInterval();
    captureAndUpload('start');
    // Capture a baseline snapshot ~1.5 second after the camera warms up so
    // the identity-check API has something to compare against later. Then
    // fire the FIRST identity check ~5 seconds later (well before the regular
    // 30s interval kicks in) so a student who walks away the moment the exam
    // starts is caught quickly.
    setTimeout(() => { captureBaseline(); }, 1500);
    setTimeout(() => { runIdentityCheck().catch(() => {}); }, 6500);
    startIdentityCheckInterval();
    // Fast browser-side face presence check (Chrome / Edge). Catches "moved
    // away from camera" within ~12s without using API credits. Safari /
    // Firefox silently skip and rely on the 15s Claude check.
    startLocalFaceCheck();
  } else if (els.webcamWrap) {
    // Hide the webcam panel entirely since we're not capturing.
    els.webcamWrap.style.display = 'none';
  }
}

function renderQuestions() {
  // Show subject + language banner at the top of the question list when set.
  const a = currentAssessment;
  let banner = '';
  if (a.subject || a.assessmentLanguage) {
    const subj = a.subject ? `📚 <strong>${escapeHtml(a.subject)}</strong>` : '';
    const lang = a.assessmentLanguage
      ? `🌐 <strong>Please write your answers in: ${escapeHtml(a.assessmentLanguage)}</strong>`
      : '';
    banner = `
      <div class="panel" style="background: linear-gradient(135deg, #312e81, #5b21b6); color: #fff; border-color: #4338ca;">
        ${subj ? `<div style="margin-bottom: ${lang ? '6px' : '0'};">${subj}</div>` : ''}
        ${lang ? `<div>${lang}</div>` : ''}
      </div>
    `;
  }

  // Build per-question HTML in a helper so we can call it from inside the
  // section-grouping loop below.
  function questionBody(q) {
    if (q.type === 'mc') {
      return q.options.map((opt, oi) => `
        <label style="display:block; padding:12px 14px; border:1px solid #cbd5e1; border-radius:8px; margin-bottom:8px; cursor:pointer; background:#f8fafc; color:#1a1e33; font-size:17px; line-height:1.55;">
          <input type="radio" name="q-${q.id}" value="${oi}" /> ${escapeHtml(opt)}
        </label>
      `).join('');
    } else if (q.type === 'tf') {
      return `
        <label style="display:block; padding:12px 14px; border:1px solid #cbd5e1; border-radius:8px; margin-bottom:8px; background:#f8fafc; color:#1a1e33; font-size:17px;"><input type="radio" name="q-${q.id}" value="true" /> True</label>
        <label style="display:block; padding:12px 14px; border:1px solid #cbd5e1; border-radius:8px; margin-bottom:8px; background:#f8fafc; color:#1a1e33; font-size:17px;"><input type="radio" name="q-${q.id}" value="false" /> False</label>
      `;
    } else if (q.type === 'tfng') {
      return `
        <label style="display:block; padding:12px 14px; border:1px solid #cbd5e1; border-radius:8px; margin-bottom:8px; background:#f8fafc; color:#1a1e33; font-size:17px;"><input type="radio" name="q-${q.id}" value="true" /> True</label>
        <label style="display:block; padding:12px 14px; border:1px solid #cbd5e1; border-radius:8px; margin-bottom:8px; background:#f8fafc; color:#1a1e33; font-size:17px;"><input type="radio" name="q-${q.id}" value="false" /> False</label>
        <label style="display:block; padding:12px 14px; border:1px solid #cbd5e1; border-radius:8px; margin-bottom:8px; background:#f8fafc; color:#1a1e33; font-size:17px;"><input type="radio" name="q-${q.id}" value="ng" /> Not Given</label>
      `;
    } else if (q.type === 'short') {
      return `<input type="text" data-q="${q.id}" placeholder="Your answer" />`;
    } else if (q.type === 'long') {
      return `<textarea data-q="${q.id}" rows="10" placeholder="Write your full answer here. Use complete sentences and explain your reasoning."></textarea>`;
    } else if (q.type === 'essay' || q.type === 'writing') {
      const rows = q.type === 'writing' ? 14 : 6;
      return `<textarea data-q="${q.id}" rows="${rows}" placeholder="Write your answer here. Take your time, plan your structure, and proofread before submitting."></textarea>`;
    }
    return '';
  }
  function questionCard(q, globalIdx) {
    const imageBlock = q.imageUrl
      ? `<img src="${q.imageUrl}" alt="Question image" style="max-width: 100%; max-height: 360px; display: block; margin: 0 0 10px; border-radius: 8px; background: #f1f5f9;" />`
      : '';
    return `
      <div class="panel">
        <div style="margin-bottom: 6px; color: #475569; font-size: 14px;">Question ${globalIdx + 1} of ${currentAssessment.questions.length} · ${q.points} point${q.points === 1 ? '' : 's'}</div>
        ${imageBlock}
        <div style="font-size: 18px; line-height: 1.6; margin-bottom: 14px; color:#1a1e33;">${escapeHtml(q.prompt)}</div>
        ${questionBody(q)}
      </div>
    `;
  }

  // Group questions by section. Sections come from the server in display
  // order. Any question whose sectionId doesn't match a known section goes
  // into a synthetic "default" group at the end (shouldn't normally happen).
  const allSections = Array.isArray(currentAssessment.sections) ? currentAssessment.sections : [];
  const sectionsById = new Map(allSections.map((s) => [s.id, s]));
  let globalIdx = 0;
  let sectionsHtml = '';

  if (allSections.length) {
    for (const sec of allSections) {
      const sectionQs = currentAssessment.questions.filter((q) => q.sectionId === sec.id);
      if (!sectionQs.length && !sec.title && !sec.instructions && !sec.passage) continue;

      // Section header — title + instructions + passage, then questions.
      const passageBlock = sec.passage && sec.passage.trim()
        ? `<div class="exam-passage-body" style="background:#fef7e6; color:#1a1e33; border:1px solid #f59e0b; border-radius: 10px; padding: 16px 18px; margin: 0 0 14px; white-space: pre-wrap; line-height: 1.7; font-size:17px;">${escapeHtml(sec.passage)}</div>`
        : '';
      const instructionsBlock = sec.instructions && sec.instructions.trim()
        ? `<div style="font-style: italic; color:#475569; margin: 0 0 14px; font-size:16px;">${escapeHtml(sec.instructions)}</div>`
        : '';
      const titleBlock = sec.title && sec.title.trim()
        ? `<h2 style="color:#1a1e33; margin: 20px 0 10px; font-size: 24px;">${escapeHtml(sec.title)}</h2>`
        : '';

      // When the section has a passage, render in a two-column split:
      // passage sticky on the left, questions scrolling on the right.
      // When there's no passage, fall back to the single-column layout.
      const hasPassage = sec.passage && sec.passage.trim();
      if (hasPassage) {
        sectionsHtml += `<div class="exam-section split">`;
        sectionsHtml += `<aside class="exam-passage">${titleBlock}${instructionsBlock}${passageBlock}</aside>`;
        sectionsHtml += `<div class="exam-q-col">`;
        for (const q of sectionQs) {
          sectionsHtml += questionCard(q, globalIdx++);
        }
        sectionsHtml += `</div></div>`;
      } else {
        sectionsHtml += `<div class="exam-section">${titleBlock}${instructionsBlock}`;
        for (const q of sectionQs) {
          sectionsHtml += questionCard(q, globalIdx++);
        }
        sectionsHtml += `</div>`;
      }
    }
    // Catch any orphan questions (no matching section).
    const orphans = currentAssessment.questions.filter((q) => !sectionsById.has(q.sectionId));
    for (const q of orphans) sectionsHtml += questionCard(q, globalIdx++);
  } else {
    // No sections at all — render flat list (back-compat for legacy assessments).
    for (const q of currentAssessment.questions) sectionsHtml += questionCard(q, globalIdx++);
  }

  els.questions.innerHTML = banner + sectionsHtml;

  // Wire up answer capture
  currentAssessment.questions.forEach((q) => {
    if (q.type === 'mc' || q.type === 'tf' || q.type === 'tfng') {
      document.getElementsByName(`q-${q.id}`).forEach((r) => {
        r.addEventListener('change', (e) => {
          if (q.type === 'mc') answers[q.id] = Number(e.target.value);
          else if (q.type === 'tf') answers[q.id] = e.target.value === 'true';
          else answers[q.id] = e.target.value; // tfng: 'true' | 'false' | 'ng'
        });
      });
    } else if (q.type === 'short' || q.type === 'long' || q.type === 'essay' || q.type === 'writing') {
      const input = document.querySelector(`[data-q="${q.id}"]`);
      input.addEventListener('input', (e) => { answers[q.id] = e.target.value; });
    }
  });
}

els.submitBtn.onclick = () => {
  if (confirm('Submit your assessment? You cannot change answers afterward.')) {
    submit('manual');
  }
};

// ---------- Timer ----------
function startTimer() {
  updateTimer();
  timerInterval = setInterval(updateTimer, 500);
}
function updateTimer() {
  const remaining = Math.max(0, endAt - Date.now());
  const m = Math.floor(remaining / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  els.timer.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  els.timer.classList.toggle('warn', remaining < 5 * 60000 && remaining >= 60000);
  els.timer.classList.toggle('danger', remaining < 60000);
  if (remaining <= 0) submit('time');
}

// ---------- Submission ----------
async function submit(reason) {
  if (submitted) return;
  submitted = true;
  clearInterval(timerInterval);
  if (FEATURES.webcam) {
    stopProctorInterval();
    stopIdentityCheckInterval();
    stopLocalFaceCheck();
    await captureAndUpload(`submit-${reason}`).catch(() => {});
    stopWebcam();
  }
  uninstallLockdown();
  try { await document.exitFullscreen?.(); } catch {}

  try {
    const { result } = await api(`/api/assessments/${currentAssessment.id}/submit`, {
      method: 'POST',
      body: { answers, violations, startedAt, submitReason: reason, remainingMs: Math.max(0, (endAt || 0) - Date.now()) },
    });
    lastResultId = result.id;
    els.assessmentView.style.display = 'none';
    els.doneView.style.display = 'block';
    els.doneMsg.innerHTML = `
      Your assessment has been submitted (reason: ${reason}).<br/>
      Auto-graded score (multiple choice / true-false / short answer with expected value):
      <strong>${result.autoScore} / ${result.autoMax}</strong>.<br/>
      Essay and long-answer questions will be scored by your teacher.
      ${violations.length ? `<br/><br/><span style="color:#ff6b6b;">${violations.length} lockdown violation(s) were recorded.</span>` : ''}
    `;
  } catch (e) {
    alert('Submission error: ' + e.message);
  }
}

// ---------- Past results + feedback view ----------
async function loadPastResults() {
  try {
    const { results } = await api('/api/results/mine');
    if (!results.length) {
      els.pastResults.innerHTML = '';
      return;
    }
    els.pastResults.innerHTML = `
      <h2 style="color:#fff;">Your past assessments</h2>
      <div>${results.map((r) => `
        <div class="card" style="background:#1a1e33; color:#fff; border-color:#2b3152;">
          <div class="row">
            <div>
              <div class="card-title">${escapeHtml(r.assessmentTitle)}</div>
              <div class="muted" style="color:#9ba0bd;">
                Submitted ${new Date(r.submittedAt).toLocaleString()} ·
                Auto-graded: ${r.autoScore} / ${r.autoMax}
              </div>
            </div>
            <div class="spacer"></div>
            <button class="btn primary" data-review="${r.id}">View feedback</button>
          </div>
        </div>
      `).join('')}</div>
    `;
    els.pastResults.querySelectorAll('button[data-review]').forEach((b) => {
      b.onclick = () => openReview(b.dataset.review);
    });
  } catch {
    els.pastResults.innerHTML = '';
  }
}

if (els.doneReview) {
  els.doneReview.onclick = () => {
    if (lastResultId) openReview(lastResultId);
  };
}
if (els.reviewBack) {
  els.reviewBack.onclick = () => {
    els.reviewView.style.display = 'none';
    els.listView.style.display = 'block';
    loadPastResults();
  };
}

async function openReview(resultId) {
  try {
    const data = await api(`/api/results/student/${resultId}`);
    els.doneView.style.display = 'none';
    els.listView.style.display = 'none';
    els.reviewView.style.display = 'block';
    els.reviewTitle.textContent = data.assessmentTitle;
    renderReportCard({
      mountSummary: els.reviewSummary,
      mountBody: els.reviewBody,
      data,
      isTeacher: false,
    });
  } catch (e) {
    alert('Could not load feedback: ' + e.message);
  }
}

// Render the polished report card. Used by both student and teacher
// (teacher gets a few extras — editable comment field, ability to print
// for parent meetings, full feedback even on awaiting-review questions).
function renderReportCard({ mountSummary, mountBody, data, isTeacher }) {
  const pct = data.totalMax > 0 ? Math.round((data.totalScore / data.totalMax) * 100) : 0;
  const durationMins = data.startedAt && data.submittedAt
    ? Math.max(0, Math.round((new Date(data.submittedAt) - new Date(data.startedAt)) / 60000))
    : null;

  const meta = [
    data.term ? `Term ${data.term}` : null,
    data.academicYear || null,
    data.teacherName ? `Teacher: ${data.teacherName}` : null,
  ].filter(Boolean).join(' · ');

  const studentLine = isTeacher
    ? `<div><strong>Student:</strong> ${escapeHtml(data.studentName)} (${escapeHtml(data.studentEmail)})</div>`
    : '';

  mountSummary.innerHTML = `
    <div class="report-card">
      <div class="report-header">
        <div class="report-school">ClassCurio · Assessment Report</div>
        <h1 style="margin: 4px 0 8px; color: #1a1c2b;">${escapeHtml(data.assessmentTitle)}</h1>
        <div class="report-meta">
          ${studentLine}
          <div><strong>Submitted:</strong> ${new Date(data.submittedAt).toLocaleString()}${durationMins != null ? ` · took ${durationMins} min` : ''}</div>
          ${meta ? `<div>${escapeHtml(meta)}</div>` : ''}
        </div>
      </div>

      <div class="report-score-block">
        <div class="report-score-big">
          <span class="score-num">${data.totalScore}</span><span class="score-sep"> / </span><span class="score-max">${data.totalMax}</span>
        </div>
        <div class="report-score-bar"><div class="report-score-bar-fill" style="width: ${pct}%"></div></div>
        <div class="report-score-pct">${pct}%</div>
      </div>

      <table class="report-breakdown">
        <tr><th>Section</th><th>Score</th></tr>
        <tr><td>Auto-graded (multiple choice / true-false / short answer)</td>
            <td>${data.autoScore} / ${data.autoMax}</td></tr>
        <tr><td>Teacher-graded (essay / writing)</td>
            <td>${data.manualScore} / ${data.manualMax}</td></tr>
        <tr class="report-total"><td><strong>Total</strong></td>
            <td><strong>${data.totalScore} / ${data.totalMax}</strong></td></tr>
      </table>

      ${data.awaitingReview ? `
        <div class="env-warn" style="margin: 16px 0;">
          Some essay / writing questions are still awaiting teacher review.
          Their scores will appear here once graded.
        </div>` : ''}

      <div class="report-comment-block">
        <h2>Teacher's Comments</h2>
        ${isTeacher ? `
          <textarea id="teacher-narrative" rows="4" placeholder="Write a personalised comment for this student. This shows on their report card and on any printed/PDF version.">${escapeHtml(data.teacherComment || '')}</textarea>
          <div class="row" style="margin-top: 8px;">
            <div class="spacer"></div>
            <button id="save-narrative" class="btn primary">Save comment</button>
            <span id="narrative-status" class="muted"></span>
          </div>
        ` : `
          <div class="report-comment-text">${data.teacherComment ? escapeHtml(data.teacherComment) : '<em>No comment yet.</em>'}</div>
        `}
      </div>
    </div>
  `;

  mountBody.innerHTML = `
    <div class="report-card">
      <h2>Question by Question</h2>
      ${data.review.map((q, i) => renderReviewQuestion(q, i)).join('')}
      <div class="report-actions no-print">
        <button class="btn primary" onclick="window.print()">🖨 Print / Save as PDF</button>
      </div>
    </div>
  `;

  if (isTeacher) {
    const ta = document.getElementById('teacher-narrative');
    const btn = document.getElementById('save-narrative');
    const status = document.getElementById('narrative-status');
    if (btn) {
      btn.onclick = async () => {
        status.textContent = 'Saving…';
        try {
          await api(`/api/results/${data.__resultId}/comment`, {
            method: 'POST',
            body: { comment: ta.value },
          });
          status.textContent = 'Saved.';
          setTimeout(() => { status.textContent = ''; }, 2000);
        } catch (e) {
          status.textContent = 'Error: ' + e.message;
        }
      };
    }
  }
}

function renderReviewQuestion(q, i) {
  const statusBadge =
    q.correct === true ? '<span class="badge green">Correct</span>' :
    q.correct === false ? '<span class="badge red">Incorrect</span>' :
    q.manualGrade ? `<span class="badge green">Graded: ${q.manualGrade.score}/${q.manualGrade.maxScore}</span>` :
    '<span class="badge">Awaiting teacher review</span>';

  const tfngLabel = (v) => v === 'true' ? 'True' : v === 'false' ? 'False' : v === 'ng' ? 'Not Given' : String(v);

  let givenDisplay = '<em>(no answer)</em>';
  if (q.given !== null && q.given !== undefined) {
    if (q.type === 'mc') givenDisplay = escapeHtml(String(q.options[q.given] ?? q.given));
    else if (q.type === 'tf') givenDisplay = q.given ? 'True' : 'False';
    else if (q.type === 'tfng') givenDisplay = tfngLabel(q.given);
    else givenDisplay = escapeHtml(String(q.given));
  }

  let correctDisplay = '';
  if (q.correct === false && q.correctAnswer !== null) {
    let text = '';
    if (q.type === 'mc') text = String(q.options[q.correctAnswer] ?? q.correctAnswer);
    else if (q.type === 'tf') text = q.correctAnswer ? 'True' : 'False';
    else if (q.type === 'tfng') text = tfngLabel(q.correctAnswer);
    else text = String(q.correctAnswer);
    correctDisplay = `<div class="success" style="margin-top: 6px;">
      <strong>Correct answer:</strong> ${escapeHtml(text)}
    </div>`;
  }

  const feedback = q.manualGrade && q.manualGrade.feedback
    ? `<div style="margin-top: 6px; padding: 8px; background: #f1f5ff; border-radius: 6px;">
         <strong>Teacher feedback:</strong> ${escapeHtml(q.manualGrade.feedback)}
       </div>`
    : '';

  const explanation = q.explanation
    ? `<div class="muted" style="margin-top: 6px;"><em>${escapeHtml(q.explanation)}</em></div>`
    : '';

  return `
    <div class="panel">
      <div style="margin-bottom: 6px; color: #475569; font-size: 14px;">Question ${i + 1} · ${q.points} point${q.points === 1 ? '' : 's'} ${statusBadge}</div>
      <div style="font-size: 16px; margin-bottom: 10px;">${escapeHtml(q.prompt)}</div>
      <div><strong>Your answer:</strong> ${givenDisplay}</div>
      ${correctDisplay}
      ${feedback}
      ${explanation}
    </div>
  `;
}

els.doneBack.onclick = () => location.reload();

// ========== LOCKDOWN LAYER ==========
// All of these are deterrents at the browser level. The Electron wrapper
// applies a stronger layer (kiosk mode, content protection, global shortcuts).

function addViolation(reason) {
  if (!lockdownActive || submitted) return;
  violations.push(`${new Date().toLocaleTimeString()} - ${reason}`);
  els.violationBanner.style.display = 'block';
  els.violationBanner.textContent =
    `Lockdown violation detected: ${reason}. Violation ${violations.length} of ${MAX_VIOLATIONS}.` +
    (violations.length >= MAX_VIOLATIONS ? ' Auto-submitting now.' : '');
  if (violations.length >= MAX_VIOLATIONS) {
    submit('violations-exceeded');
  }
}

// --- Fullscreen ---
async function enterFullscreen() {
  const el = document.documentElement;
  if (el.requestFullscreen) await el.requestFullscreen();
  else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
  else throw new Error('Fullscreen API not supported');
}
function isFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

// --- Event handlers (installed/uninstalled as a group) ---
const handlers = {
  visibilitychange: () => {
    if (document.hidden) addViolation('Switched tab or minimized window');
  },
  blur: () => addViolation('Window lost focus'),
  focus: () => {
    // Allow re-focus but keep banner visible
  },
  fullscreenchange: () => {
    if (!isFullscreen()) {
      addViolation('Exited fullscreen');
      // Try to force fullscreen back
      enterFullscreen().catch(() => {});
    }
  },
  keydown: (e) => {
    const key = (e.key || '').toLowerCase();
    const ctrl = e.ctrlKey || e.metaKey;

    // ----- Screenshot keys → INSTANT auto-submit (no 3-strike grace) -----
    // Browsers cannot physically block OS-level screenshot shortcuts, but the
    // ones that DO reach the page are caught here. The student's test ends
    // immediately on the first attempt. The desktop app provides true
    // physical blocking via setContentProtection — recommend for high-stakes.
    const isScreenshot =
      e.key === 'PrintScreen' ||
      (e.altKey && e.key === 'PrintScreen') ||
      // Mac: Cmd+Shift+3 (full), Cmd+Shift+4 (region), Cmd+Shift+5 (UI),
      // Cmd+Shift+6 (Touch Bar capture)
      (e.metaKey && e.shiftKey && ['3', '4', '5', '6'].includes(e.key)) ||
      // Windows: Win+Shift+S (Snipping Tool), Win+PrintScreen
      (e.metaKey && e.shiftKey && key === 's') ||
      (e.metaKey && e.key === 'PrintScreen') ||
      // Cmd/Ctrl+P (Print to file ⇒ effectively a screenshot)
      (ctrl && key === 'p');
    if (isScreenshot) {
      e.preventDefault();
      e.stopPropagation();
      addViolation('Screenshot attempted — auto-submitting');
      submit('screenshot').catch(() => {});
      return false;
    }

    // ----- Other blocked shortcuts → 3-strike violation -----
    const block =
      // DevTools
      (e.key === 'F12') ||
      (ctrl && e.shiftKey && ['i', 'j', 'c'].includes(key)) ||
      // View source
      (ctrl && key === 'u') ||
      // Save, Find
      (ctrl && ['s', 'f', 'g'].includes(key)) ||
      // Clipboard
      (ctrl && ['c', 'v', 'x'].includes(key)) ||
      // New tab / window / close
      (ctrl && ['t', 'n', 'w'].includes(key)) ||
      // Reload
      (ctrl && ['r'].includes(key)) || e.key === 'F5' ||
      // Alt+Tab (Windows/Linux) — many browsers can't actually block this
      (e.altKey && e.key === 'Tab');
    if (block) {
      e.preventDefault();
      e.stopPropagation();
      addViolation(`Blocked shortcut: ${describeShortcut(e)}`);
      return false;
    }
  },
  copy: (e) => { e.preventDefault(); addViolation('Copy attempted'); },
  cut:  (e) => { e.preventDefault(); addViolation('Cut attempted'); },
  paste: (e) => {
    // Allow paste in answer fields (students may legitimately type). Block otherwise.
    const t = e.target;
    if (!(t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement)) {
      e.preventDefault();
      addViolation('Paste outside answer field');
    }
  },
  contextmenu: (e) => { e.preventDefault(); },
  dragstart: (e) => { e.preventDefault(); },
  selectstart: (e) => {
    // Allow selection in answer fields, block everywhere else
    const t = e.target;
    if (!(t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement)) {
      e.preventDefault();
    }
  },
  beforeunload: (e) => {
    if (!submitted && lockdownActive) {
      e.preventDefault();
      e.returnValue = 'Leaving will forfeit your assessment.';
      return e.returnValue;
    }
  },
};

function describeShortcut(e) {
  const parts = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.metaKey) parts.push('Cmd');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  parts.push(e.key);
  return parts.join('+');
}

// ----- Identity watermark -----
// Browsers cannot prevent OS-level screenshots in a web/PWA context. The next
// best deterrent is to stamp every screenshot with the student's identity so
// any leak is traceable. This overlays a fixed, low-opacity diagonal pattern
// of "name · email · timestamp" repeating across the entire viewport. It's
// hard to remove via DOM manipulation because it's a fixed-position div with
// pointer-events:none and an inline style that cannot be easily targeted.

let watermarkEl = null;
let watermarkClockId = null;

function installWatermark() {
  if (watermarkEl) return;
  if (!currentUser) return;

  watermarkEl = document.createElement('div');
  watermarkEl.id = '_cc_watermark';
  watermarkEl.setAttribute('aria-hidden', 'true');
  // Inline style — high z-index, fixed, pointer-events:none, transparent bg.
  watermarkEl.style.cssText = [
    'position: fixed',
    'inset: 0',
    'z-index: 2147483646', // nearly the maximum int — sits above everything
    'pointer-events: none',
    'overflow: hidden',
    'user-select: none',
    'mix-blend-mode: difference', // visible on both dark and light backgrounds
  ].join(';');

  // Inner container that holds the repeating text. Rotated -25 degrees so
  // the watermark runs diagonally across the screen.
  const inner = document.createElement('div');
  inner.style.cssText = [
    'position: absolute',
    'top: -25%',
    'left: -25%',
    'right: -25%',
    'bottom: -25%',
    'display: grid',
    // Sparser layout — wide columns + big row gap so the watermark doesn't
    // crowd the questions. Still tiled enough that any photo of the screen
    // catches at least one full repeat of the email + timestamp.
    'grid-template-columns: repeat(auto-fill, minmax(560px, 1fr))',
    'gap: 140px 80px',
    'transform: rotate(-25deg)',
    // Very low opacity — visible on a photo but barely noticeable while reading.
    'opacity: 0.07',
    'color: #ffffff',
    'font: 400 11px/1.2 -apple-system, system-ui, sans-serif',
    'white-space: nowrap',
  ].join(';');

  // Build a grid of text labels — many copies stamp the screen densely.
  // We refresh the timestamp every minute (replaceChildren) so the watermark
  // captures *when* the screenshot was taken, not just who took it.
  const refresh = () => {
    if (!watermarkEl || !currentUser) return;
    const stamp = `${currentUser.name} · ${currentUser.email} · ${new Date().toLocaleString()}`;
    const cells = [];
    for (let i = 0; i < 18; i++) {
      const span = document.createElement('span');
      span.textContent = stamp;
      cells.push(span);
    }
    inner.replaceChildren(...cells);
  };
  refresh();
  // Update timestamp once a minute.
  watermarkClockId = setInterval(refresh, 60000);

  watermarkEl.appendChild(inner);
  document.body.appendChild(watermarkEl);
}

function uninstallWatermark() {
  try {
    if (watermarkClockId) { clearInterval(watermarkClockId); watermarkClockId = null; }
    if (watermarkEl && watermarkEl.parentNode) {
      watermarkEl.parentNode.removeChild(watermarkEl);
    }
  } catch {}
  watermarkEl = null;
}

// ----- Aggressive blur on focus loss -----
// The moment focus leaves the window/tab, blur the entire page heavily so any
// screen-share viewer sees a useless blurred capture instead of the questions.
let lockdownBlurEl = null;

function installFocusBlur() {
  // Inject a CSS rule that blurs everything when our root container loses focus.
  // We use a style tag so the rule itself can be removed cleanly when the
  // assessment ends.
  if (lockdownBlurEl) return;
  lockdownBlurEl = document.createElement('style');
  lockdownBlurEl.id = '_cc_focus_blur';
  lockdownBlurEl.textContent = `
    body[data-cc-blurred="1"] #assessment-view,
    body[data-cc-blurred="1"] #passage-panel {
      filter: blur(30px) saturate(0) !important;
      transition: filter 80ms ease-out !important;
    }
    body[data-cc-blurred="1"] #assessment-view::after {
      content: "Window not focused — return to ClassCurio to continue";
      position: fixed; inset: 0;
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-size: 22px; font-weight: 700;
      background: rgba(20, 20, 35, 0.85);
      z-index: 2147483645;
    }
  `;
  document.head.appendChild(lockdownBlurEl);
}

function uninstallFocusBlur() {
  try {
    if (lockdownBlurEl && lockdownBlurEl.parentNode) {
      lockdownBlurEl.parentNode.removeChild(lockdownBlurEl);
    }
  } catch {}
  lockdownBlurEl = null;
  document.body.removeAttribute('data-cc-blurred');
}

function installLockdown() {
  lockdownActive = true;
  document.addEventListener('visibilitychange', handlers.visibilitychange);
  window.addEventListener('blur', handlers.blur);
  window.addEventListener('focus', handlers.focus);
  document.addEventListener('fullscreenchange', handlers.fullscreenchange);
  document.addEventListener('webkitfullscreenchange', handlers.fullscreenchange);
  window.addEventListener('keydown', handlers.keydown, true);
  document.addEventListener('copy', handlers.copy);
  document.addEventListener('cut', handlers.cut);
  document.addEventListener('paste', handlers.paste);
  document.addEventListener('contextmenu', handlers.contextmenu);
  document.addEventListener('dragstart', handlers.dragstart);
  document.addEventListener('selectstart', handlers.selectstart);
  window.addEventListener('beforeunload', handlers.beforeunload);

  // Heavy blur the moment focus / visibility leaves the page. Set a body
  // attribute that the injected stylesheet rule keys on. This makes any live
  // screen-share or screenshot capture show a heavily-blurred image instead
  // of the questions.
  installFocusBlur();
  const setBlurred = (on) => {
    if (on) document.body.setAttribute('data-cc-blurred', '1');
    else document.body.removeAttribute('data-cc-blurred');
  };
  window.addEventListener('blur', () => setBlurred(true));
  window.addEventListener('focus', () => setBlurred(false));
  document.addEventListener('visibilitychange', () => setBlurred(document.hidden));
  // Legacy class kept for compatibility with existing CSS that uses it.
  window.addEventListener('blur', () => document.body.classList.add('lockdown-blur'));
  window.addEventListener('focus', () => document.body.classList.remove('lockdown-blur'));

  // Identity watermark across the whole page — makes any screenshot
  // traceable back to the student who took it.
  installWatermark();

  // If running in Electron, lock the OS-level window down for the duration
  // of the exam (this is what *physically* blocks screenshots/screen-share).
  if (window.lockdown && typeof window.lockdown.enterKiosk === 'function') {
    try { window.lockdown.enterKiosk(); } catch {}
  }
}

// ========== WEBCAM PROCTORING ==========
let webcamStream = null;
let proctorIntervalId = null;
const PROCTOR_INTERVAL_MS = 15000; // snapshot every 15s
let cameraOffViolationFired = false;

async function startWebcam() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('Your browser does not support getUserMedia.');
  }
  webcamStream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  });
  els.webcam.srcObject = webcamStream;
  await els.webcam.play().catch(() => {});
  // Detect if user stops the stream externally (e.g. OS-level permission revoke,
  // closing camera tab, unplugging webcam). Camera off mid-exam = immediate
  // auto-submit, per the proctoring policy shown in the consent popup.
  webcamStream.getVideoTracks().forEach((t) => {
    t.onended = () => {
      if (!submitted) {
        els.webcamStatus.textContent = 'OFF';
        els.webcamStatus.classList.add('off');
        addViolation('Webcam turned off — auto-submitting');
        // Force immediate submit instead of waiting for 3-strike threshold.
        submit('camera-off').catch(() => {});
      }
    };
    t.onmute = () => {
      if (!submitted) {
        els.webcamStatus.textContent = 'MUTED';
        els.webcamStatus.classList.add('off');
        addViolation('Webcam muted — auto-submitting');
        submit('camera-muted').catch(() => {});
      }
    };
  });
  // Mic was permitted with the camera; start ambient-audio monitoring.
  // (Failures are silent — talking detection is a nice-to-have, not a hard
  // gate, and we never want a flaky AudioContext to lock out a student.)
  try { startAudioMonitoring(); } catch (e) { console.warn('audio monitor off:', e.message); }
}

// ----- Microphone / talking detection -----
// Web Audio AnalyserNode samples the mic ~10 Hz. We compute the RMS volume
// of each window; sustained noise above the THRESHOLD for TALK_WINDOW_MS
// counts as one violation. The latch (audioTalkFlagged) means each
// continuous burst is logged once, not on every sample.
let audioCtx = null;
let audioAnalyser = null;
let audioRafTimer = null;
let audioTalkStartedAt = 0;
let audioTalkFlagged = false;
let audioCalibrationEndsAt = 0;
let audioBaselineRms = 0;

const AUDIO_TALK_THRESHOLD = 0.045;   // RMS in 0..1 range; raised above baseline
const AUDIO_TALK_WINDOW_MS = 3000;    // must stay loud for 3s to trip
const AUDIO_CALIBRATION_MS = 4000;    // first 4s after exam start = ambient baseline

function startAudioMonitoring() {
  if (!webcamStream) return;
  const audioTracks = webcamStream.getAudioTracks();
  if (!audioTracks.length) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  audioCtx = new Ctx();
  const src = audioCtx.createMediaStreamSource(webcamStream);
  audioAnalyser = audioCtx.createAnalyser();
  audioAnalyser.fftSize = 512;
  audioAnalyser.smoothingTimeConstant = 0.4;
  src.connect(audioAnalyser);
  audioCalibrationEndsAt = Date.now() + AUDIO_CALIBRATION_MS;
  audioBaselineRms = 0;
  const buf = new Uint8Array(audioAnalyser.fftSize);
  function tick() {
    if (submitted) return;
    if (audioAnalyser) {
      audioAnalyser.getByteTimeDomainData(buf);
      // Convert 0..255 byte stream to centered -1..+1 and compute RMS.
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / buf.length);

      const now = Date.now();
      if (now < audioCalibrationEndsAt) {
        // Calibrate: take the loudest ambient sample over the first 4s as
        // the baseline, so a noisy room raises the threshold automatically.
        if (rms > audioBaselineRms) audioBaselineRms = rms;
      } else {
        const threshold = Math.max(AUDIO_TALK_THRESHOLD, audioBaselineRms * 1.6);
        if (rms > threshold) {
          if (!audioTalkStartedAt) audioTalkStartedAt = now;
          if (!audioTalkFlagged && (now - audioTalkStartedAt) >= AUDIO_TALK_WINDOW_MS) {
            audioTalkFlagged = true;
            addViolation('Talking / loud sound detected via microphone');
          }
        } else {
          audioTalkStartedAt = 0;
          audioTalkFlagged = false; // re-arm once it goes quiet
        }
      }
    }
    audioRafTimer = setTimeout(tick, 100); // 10 Hz
  }
  tick();
}
function stopAudioMonitoring() {
  if (audioRafTimer) { clearTimeout(audioRafTimer); audioRafTimer = null; }
  try { if (audioCtx) audioCtx.close(); } catch {}
  audioCtx = null;
  audioAnalyser = null;
  audioTalkStartedAt = 0;
  audioTalkFlagged = false;
}

function stopWebcam() {
  try { stopAudioMonitoring(); } catch {}
  try {
    if (webcamStream) {
      webcamStream.getTracks().forEach((t) => t.stop());
    }
  } catch {}
  webcamStream = null;
  els.webcam.srcObject = null;
  els.webcamStatus.textContent = 'OFF';
  els.webcamStatus.classList.add('off');
}

function startProctorInterval() {
  if (proctorIntervalId) clearInterval(proctorIntervalId);
  proctorIntervalId = setInterval(() => captureAndUpload('periodic').catch(() => {}), PROCTOR_INTERVAL_MS);
}
function stopProctorInterval() {
  if (proctorIntervalId) clearInterval(proctorIntervalId);
  proctorIntervalId = null;
}

// ----- Identity check polling (Claude Vision via /api/proctor/identity-check) -----
// Captures a small JPEG of the current webcam frame and POSTs it alongside the
// baseline snapshot taken at exam start. The server uses Claude Vision to
// answer two questions: (1) is a face visible? (2) is it the same person?
// Each negative answer adds a violation; 3 violations triggers auto-submit
// (the existing MAX_VIOLATIONS rule).

function captureBaseline() {
  // Captures the first usable frame as the identity-baseline. Small JPEG.
  if (!webcamStream || !currentAssessment) return;
  try {
    const video = els.webcam;
    const canvas = els.webcamCanvas;
    const vw = video.videoWidth || 320;
    const vh = video.videoHeight || 240;
    if (vw === 0 || vh === 0) return; // not ready yet
    const targetW = 320;
    const targetH = Math.round((vh / vw) * targetW);
    canvas.width = targetW;
    canvas.height = targetH;
    canvas.getContext('2d').drawImage(video, 0, 0, targetW, targetH);
    baselineDataUrl = canvas.toDataURL('image/jpeg', 0.6);
  } catch (e) {
    console.error('captureBaseline failed', e);
  }
}

function startIdentityCheckInterval() {
  if (identityIntervalId) clearInterval(identityIntervalId);
  identityIntervalId = setInterval(() => runIdentityCheck().catch(() => {}), IDENTITY_CHECK_INTERVAL_MS);
}
function stopIdentityCheckInterval() {
  if (identityIntervalId) clearInterval(identityIntervalId);
  identityIntervalId = null;
}

// ----- Local browser-side face detection (FaceDetector API) -----
// Catches "moved away from camera" within ~12 seconds, free of API cost.
// Falls through silently if the browser doesn't support FaceDetector
// (Safari, Firefox) — the 15s Claude check then handles those cases.
let _faceDetector = null;
function getFaceDetector() {
  if (_faceDetector !== null) return _faceDetector;
  try {
    if ('FaceDetector' in window) {
      _faceDetector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 3 });
      return _faceDetector;
    }
  } catch {}
  _faceDetector = false;
  return false;
}

async function runLocalFaceCheck() {
  if (!webcamStream || submitted || !currentAssessment) return;
  const fd = getFaceDetector();
  if (!fd) return; // browser doesn't support — Claude polling will catch it
  const video = els.webcam;
  if (!video || !video.videoWidth) return;
  let faces = [];
  try {
    faces = await fd.detect(video);
  } catch {
    // Detector failed (e.g. video frame not ready). Treat as a non-result.
    return;
  }
  if (Array.isArray(faces) && faces.length > 0) {
    // Face seen — reset counter.
    localFaceConsecutiveAbsences = 0;
    if (els.webcamStatus && els.webcamStatus.textContent === 'NO FACE') {
      els.webcamStatus.textContent = 'REC';
      els.webcamStatus.classList.remove('warn');
    }
    // MULTI-FACE: if FaceDetector reports more than one face on the same
    // frame, log a violation. We don't fire on every tick — only when the
    // count rises from 1 to 2+, otherwise we'd spam the violation list.
    if (faces.length >= 2 && !multiFaceFlagged) {
      multiFaceFlagged = true;
      addViolation(`${faces.length} faces detected in the webcam frame`);
    } else if (faces.length === 1) {
      multiFaceFlagged = false; // re-arm
    }
    return;
  }
  // No face detected this tick. If this happens 3 times in a row (~12s),
  // auto-submit immediately.
  localFaceConsecutiveAbsences++;
  if (els.webcamStatus) {
    els.webcamStatus.textContent = 'NO FACE';
    els.webcamStatus.classList.add('warn');
  }
  if (localFaceConsecutiveAbsences >= LOCAL_FACE_NOFACE_THRESHOLD) {
    addViolation('Face not visible — auto-submitting');
    submit('face-not-visible-local').catch(() => {});
  }
}

function startLocalFaceCheck() {
  if (localFaceIntervalId) clearInterval(localFaceIntervalId);
  localFaceConsecutiveAbsences = 0;
  // Don't start if browser lacks FaceDetector; the Claude check covers it.
  if (!getFaceDetector()) return;
  localFaceIntervalId = setInterval(() => runLocalFaceCheck().catch(() => {}), LOCAL_FACE_INTERVAL_MS);
}
function stopLocalFaceCheck() {
  if (localFaceIntervalId) clearInterval(localFaceIntervalId);
  localFaceIntervalId = null;
}

async function runIdentityCheck() {
  if (!webcamStream || submitted || !currentAssessment) return;
  // If we never managed to capture a baseline (e.g. camera was slow), skip.
  if (!baselineDataUrl) {
    captureBaseline();
    return;
  }
  // Capture the current frame.
  const video = els.webcam;
  const canvas = els.webcamCanvas;
  const vw = video.videoWidth || 320;
  const vh = video.videoHeight || 240;
  const targetW = 320;
  const targetH = Math.round((vh / vw) * targetW);
  canvas.width = targetW;
  canvas.height = targetH;
  canvas.getContext('2d').drawImage(video, 0, 0, targetW, targetH);
  const currentDataUrl = canvas.toDataURL('image/jpeg', 0.6);

  try {
    const res = await fetch('/api/proctor/identity-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baselineDataUrl, currentDataUrl }),
    });
    const data = await res.json().catch(() => ({}));
    // Soft-fail: if the server reports a non-OK or missing key, skip silently.
    if (!data || data.ok === false) return;
    // POLICY: any face-related fault from the camera is an INSTANT auto-submit
    // (not a 3-strike violation). Moving away, covering the camera, or having
    // someone else sit down in your place all skip the 3-strike grace and
    // submit the assessment immediately. Other violations (tab-switch,
    // shortcut, paste-outside-field, etc.) keep the 3-strike grace.
    if (data.faceVisible === false) {
      addViolation('Face not visible in webcam — auto-submitting');
      submit('face-not-visible').catch(() => {});
      return;
    }
    if (data.samePerson === false && data.confidence !== 'low') {
      addViolation('Different person detected — auto-submitting');
      submit('different-person').catch(() => {});
      return;
    }
    // ANOTHER PERSON in the frame (someone sitting beside or behind the student,
    // leaning in to read the screen, etc.) — instant violation. We rely on the
    // server's Claude prompt to be conservative here so reflections / posters
    // do not trip a false positive.
    if (data.otherPersonVisible === true && data.confidence !== 'low') {
      addViolation('Another person detected in the webcam frame');
      // Do NOT instant-submit on first sighting — the camera may catch a
      // teacher walking past. The 3-strike threshold handles repeated cases.
    }
    // PHONE pointed at the screen — strong cheating signal (photographing
    // the test). Confidence must be at least medium to avoid false positives
    // on phones lying flat on the desk in the background.
    if (data.phoneVisible === true && data.confidence !== 'low') {
      addViolation('Phone / camera pointed at the screen');
    }
  } catch (e) {
    // Network blip; don't penalize the student.
    console.error('identity check error', e);
  }
}

async function captureAndUpload(note) {
  if (!webcamStream || submitted || !currentAssessment) return;
  const video = els.webcam;
  const canvas = els.webcamCanvas;
  const vw = video.videoWidth || 320;
  const vh = video.videoHeight || 240;
  // Downscale to 320px wide to keep uploads small.
  const targetW = 320;
  const targetH = Math.round((vh / vw) * targetW);
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, targetW, targetH);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.55);

  // Basic "is the frame mostly black" check — flag if camera is covered.
  const sample = ctx.getImageData(0, 0, targetW, targetH).data;
  let lumaSum = 0;
  const stride = 32;
  for (let i = 0; i < sample.length; i += 4 * stride) {
    lumaSum += 0.299 * sample[i] + 0.587 * sample[i + 1] + 0.114 * sample[i + 2];
  }
  const avgLuma = lumaSum / (sample.length / (4 * stride));
  if (avgLuma < 10 && !cameraOffViolationFired) {
    // POLICY (matches face-not-visible): a covered/obstructed camera is an
    // instant auto-submit — same severity as moving out of frame.
    cameraOffViolationFired = true;
    els.webcamStatus.textContent = 'DARK';
    els.webcamStatus.classList.add('off');
    addViolation('Webcam covered or obstructed — auto-submitting');
    submit('camera-covered').catch(() => {});
    return;
  }

  try {
    await api('/api/proctor/snapshot', {
      method: 'POST',
      body: { assessmentId: currentAssessment.id, dataUrl, note },
    });
  } catch {
    // Non-fatal — the snapshot is a best-effort record.
  }
}

function uninstallLockdown() {
  lockdownActive = false;
  document.removeEventListener('visibilitychange', handlers.visibilitychange);
  window.removeEventListener('blur', handlers.blur);
  window.removeEventListener('focus', handlers.focus);
  document.removeEventListener('fullscreenchange', handlers.fullscreenchange);
  document.removeEventListener('webkitfullscreenchange', handlers.fullscreenchange);
  window.removeEventListener('keydown', handlers.keydown, true);
  document.removeEventListener('copy', handlers.copy);
  document.removeEventListener('cut', handlers.cut);
  document.removeEventListener('paste', handlers.paste);
  document.removeEventListener('contextmenu', handlers.contextmenu);
  document.removeEventListener('dragstart', handlers.dragstart);
  document.removeEventListener('selectstart', handlers.selectstart);
  window.removeEventListener('beforeunload', handlers.beforeunload);
  document.body.classList.remove('lockdown-blur');
  // Tear down the watermark and focus-blur stylesheet.
  uninstallWatermark();
  uninstallFocusBlur();
  // Restore the OS-level window so the student can close the app normally.
  if (window.lockdown && typeof window.lockdown.exitKiosk === 'function') {
    try { window.lockdown.exitKiosk(); } catch {}
  }
}
