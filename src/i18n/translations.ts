export interface Translation {
  // Nav
  navHome: string; navChat: string; navExplore: string; navAlerts: string; navProfile: string;
  // Home
  greeting: string; howCanIHelp: string;
  recentlyActiveAgents: string; agentInsights: string; tapToView: string;
  onYourDesk: string; tapToViewAll: string; actionRequired: string;
  pendingLabel: string; autoHandled: string; needsYou: string; needYou: string;
  // Chat history
  yourConversation: string; searchPlaceholder: string;
  noConversations: string; startChatting: string; today: string; yesterday: string;
  // Alerts
  alerts: string; markAllRead: string; allCaughtUp: string;
  unreadCount: (n: number) => string;
  filterAll: string; filterUnread: string; noNotifications: string;
  reviewNow: string; dismiss: string;
  // Alert titles / descriptions
  alertActionTitle: string; alertAction1Title: string; alertAction1Desc: string;
  alertSucc1Title: string; alertSucc1Desc: string;
  alertWarn1Title: string; alertWarn1Desc: string;
  alertSucc2Title: string; alertSucc2Desc: string;
  alertInfo1Title: string; alertInfo1Desc: string;
  alertAction2Title: string; alertAction2Desc: string;
  alertSucc3Title: string; alertSucc3Desc: string;
  alertWarn2Title: string; alertWarn2Desc: string;
  // Explore
  explore: string; loadingAgents: string;
  agentsAvailable: (n: number) => string;
  fetchingAgents: string; noAgentsFound: string; ready: string;
  // Profile
  sectionPreferences: string; sectionAbout: string;
  notifications: string; appearance: string; language: string;
  notifOn: string; dark: string; light: string;
  privacyPolicy: string; termsOfService: string; appVersion: string;
  uipathAccount: string; signOut: string;
  selectLanguage: string;
  // ChatView
  askAnything: string; listening: string; failedToConnect: string;
  close: string;
}

export interface Language {
  code: string; name: string; nativeName: string; rtl: boolean;
}

export const LANGUAGES: Language[] = [
  { code: 'en', name: 'English',    nativeName: 'English',    rtl: false },
  { code: 'zh', name: 'Chinese',    nativeName: '中文',        rtl: false },
  { code: 'hi', name: 'Hindi',      nativeName: 'हिन्दी',      rtl: false },
  { code: 'es', name: 'Spanish',    nativeName: 'Español',    rtl: false },
  { code: 'fr', name: 'French',     nativeName: 'Français',   rtl: false },
  { code: 'ar', name: 'Arabic',     nativeName: 'العربية',    rtl: true  },
  { code: 'sw', name: 'Swahili',    nativeName: 'Kiswahili',  rtl: false },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português',  rtl: false },
  { code: 'ru', name: 'Russian',    nativeName: 'Русский',    rtl: false },
  { code: 'ja', name: 'Japanese',   nativeName: '日本語',      rtl: false },
];

const en: Translation = {
  navHome: 'Home', navChat: 'Chat', navExplore: 'Explore', navAlerts: 'Alerts', navProfile: 'Profile',
  greeting: 'Hello', howCanIHelp: 'How can I help you today?',
  recentlyActiveAgents: 'Recently Active Agents', agentInsights: 'Agent Insights', tapToView: 'Tap to view',
  onYourDesk: 'On Your Desk', tapToViewAll: 'Tap to View All', actionRequired: 'Action Required',
  pendingLabel: 'pending', autoHandled: 'auto-handled', needsYou: 'needs you', needYou: 'need you',
  yourConversation: 'Your conversation', searchPlaceholder: 'Search...',
  noConversations: 'No conversations yet', startChatting: 'Start chatting from Home or Explore',
  today: 'TODAY', yesterday: 'YESTERDAY',
  alerts: 'Alerts', markAllRead: 'Mark all read', allCaughtUp: 'All caught up',
  unreadCount: (n) => `${n} unread notification${n > 1 ? 's' : ''}`,
  filterAll: 'All', filterUnread: 'Unread', noNotifications: 'No notifications',
  reviewNow: 'Review Now', dismiss: 'Dismiss',
  alertActionTitle: 'Action Required',
  alertAction1Title: 'Action Required', alertAction1Desc: 'Claim #TXA-8812 needs manual review — damage estimate exceeds auto-approval threshold.',
  alertSucc1Title: 'Reconciliation Complete', alertSucc1Desc: 'March vendor invoices reconciled. 3 mismatches flagged for your review.',
  alertWarn1Title: 'Interview Conflict Detected', alertWarn1Desc: '2 candidates scheduled at the same time slot on Mar 25. Reschedule needed.',
  alertSucc2Title: 'Batch Processing Done', alertSucc2Desc: 'Storm event FL-03 — 47 claims processed, 12 escalated for human review.',
  alertInfo1Title: 'Anomaly Flagged', alertInfo1Desc: 'Unusual transaction pattern detected on account #8871. Review recommended.',
  alertAction2Title: 'Duplicate Payment Detected', alertAction2Desc: 'Supplier #44 may have been paid twice this month. Confirm or dismiss.',
  alertSucc3Title: 'Shortlist Ready', alertSucc3Desc: '5 candidates shortlisted for Senior Dev role. Ready for your review.',
  alertWarn2Title: 'Low Stock Alert', alertWarn2Desc: 'Warehouse Zone B — 3 SKUs below reorder threshold. Auto-reorder paused.',
  explore: 'Explore', loadingAgents: 'Loading agents…',
  agentsAvailable: (n) => `${n} AI agent${n !== 1 ? 's' : ''} available`,
  fetchingAgents: 'Fetching agents from MEA…', noAgentsFound: 'No agents found in this tenant.', ready: 'Ready',
  sectionPreferences: 'PREFERENCES', sectionAbout: 'ABOUT',
  notifications: 'Notifications', appearance: 'Appearance', language: 'Language',
  notifOn: 'On', dark: 'Dark', light: 'Light',
  privacyPolicy: 'Privacy Policy', termsOfService: 'Terms of Service', appVersion: 'App Version',
  uipathAccount: 'UiPath Account', signOut: 'Sign Out', selectLanguage: 'Select Language',
  askAnything: 'Ask me anything...', listening: 'Listening...', failedToConnect: 'Failed to connect. Please go back and try again.',
  close: 'Close',
};

const fr: Translation = {
  navHome: 'Accueil', navChat: 'Discussion', navExplore: 'Explorer', navAlerts: 'Alertes', navProfile: 'Profil',
  greeting: 'Bonjour', howCanIHelp: 'Comment puis-je vous aider ?',
  recentlyActiveAgents: 'Agents récemment actifs', agentInsights: 'Aperçu des agents', tapToView: 'Appuyer pour voir',
  onYourDesk: 'À votre charge', tapToViewAll: 'Tout voir', actionRequired: 'Action requise',
  pendingLabel: 'en attente', autoHandled: 'traité automatiquement', needsYou: 'vous concerne', needYou: 'vous concernent',
  yourConversation: 'Vos conversations', searchPlaceholder: 'Rechercher...',
  noConversations: 'Aucune conversation', startChatting: "Commencez depuis Accueil ou Explorer",
  today: "AUJOURD'HUI", yesterday: 'HIER',
  alerts: 'Alertes', markAllRead: 'Tout marquer comme lu', allCaughtUp: 'Tout est à jour',
  unreadCount: (n) => `${n} notification${n > 1 ? 's' : ''} non lue${n > 1 ? 's' : ''}`,
  filterAll: 'Tout', filterUnread: 'Non lu', noNotifications: 'Aucune notification',
  reviewNow: 'Examiner maintenant', dismiss: 'Ignorer',
  alertActionTitle: 'Action requise',
  alertAction1Title: 'Action requise', alertAction1Desc: 'Le dossier #TXA-8812 nécessite une révision manuelle.',
  alertSucc1Title: 'Réconciliation terminée', alertSucc1Desc: 'Factures de mars réconciliées. 3 anomalies signalées.',
  alertWarn1Title: 'Conflit d\'entretien détecté', alertWarn1Desc: '2 candidats planifiés au même créneau le 25 mars.',
  alertSucc2Title: 'Traitement par lot terminé', alertSucc2Desc: '47 dossiers traités, 12 escaladés pour révision humaine.',
  alertInfo1Title: 'Anomalie signalée', alertInfo1Desc: 'Schéma de transaction inhabituel détecté sur le compte #8871.',
  alertAction2Title: 'Paiement en double détecté', alertAction2Desc: 'Le fournisseur #44 a peut-être été payé deux fois ce mois-ci.',
  alertSucc3Title: 'Sélection prête', alertSucc3Desc: '5 candidats sélectionnés pour le poste de Développeur Senior.',
  alertWarn2Title: 'Alerte stock faible', alertWarn2Desc: 'Zone B — 3 SKUs sous le seuil de réapprovisionnement.',
  explore: 'Explorer', loadingAgents: 'Chargement des agents…',
  agentsAvailable: (n) => `${n} agent${n !== 1 ? 's' : ''} IA disponible${n !== 1 ? 's' : ''}`,
  fetchingAgents: 'Récupération des agents…', noAgentsFound: 'Aucun agent trouvé.', ready: 'Prêt',
  sectionPreferences: 'PRÉFÉRENCES', sectionAbout: 'À PROPOS',
  notifications: 'Notifications', appearance: 'Apparence', language: 'Langue',
  notifOn: 'Activé', dark: 'Sombre', light: 'Clair',
  privacyPolicy: 'Politique de confidentialité', termsOfService: "Conditions d'utilisation", appVersion: "Version de l'app",
  uipathAccount: 'Compte UiPath', signOut: 'Se déconnecter', selectLanguage: 'Choisir la langue',
  askAnything: 'Posez-moi n\'importe quelle question...', listening: 'J\'écoute...', failedToConnect: 'Connexion échouée. Veuillez réessayer.',
  close: 'Fermer',
};

const ar: Translation = {
  navHome: 'الرئيسية', navChat: 'المحادثات', navExplore: 'استكشاف', navAlerts: 'التنبيهات', navProfile: 'الملف',
  greeting: 'مرحباً', howCanIHelp: 'كيف يمكنني مساعدتك؟',
  recentlyActiveAgents: 'الوكلاء النشطون مؤخراً', agentInsights: 'رؤى الوكلاء', tapToView: 'اضغط للعرض',
  onYourDesk: 'على مكتبك', tapToViewAll: 'عرض الكل', actionRequired: 'إجراء مطلوب',
  pendingLabel: 'في الانتظار', autoHandled: 'تمت معالجته تلقائياً', needsYou: 'يتطلب اهتمامك', needYou: 'تتطلب اهتمامك',
  yourConversation: 'محادثاتك', searchPlaceholder: 'بحث...',
  noConversations: 'لا توجد محادثات', startChatting: 'ابدأ من الرئيسية أو الاستكشاف',
  today: 'اليوم', yesterday: 'أمس',
  alerts: 'التنبيهات', markAllRead: 'تحديد الكل كمقروء', allCaughtUp: 'لا يوجد شيء جديد',
  unreadCount: (n) => `${n} إشعار${n > 1 ? 'ات' : ''} غير مقروء`,
  filterAll: 'الكل', filterUnread: 'غير مقروء', noNotifications: 'لا توجد إشعارات',
  reviewNow: 'مراجعة الآن', dismiss: 'رفض',
  alertActionTitle: 'إجراء مطلوب',
  alertAction1Title: 'إجراء مطلوب', alertAction1Desc: 'المطالبة #TXA-8812 تحتاج مراجعة يدوية.',
  alertSucc1Title: 'اكتمل التسوية', alertSucc1Desc: 'تمت مطابقة فواتير مارس. 3 تناقضات مُعلَّمة.',
  alertWarn1Title: 'تعارض في المقابلات', alertWarn1Desc: 'مرشحان في نفس الموعد في 25 مارس.',
  alertSucc2Title: 'اكتمت المعالجة الجماعية', alertSucc2Desc: '47 مطالبة تمت معالجتها، 12 تم تصعيدها.',
  alertInfo1Title: 'شذوذ مُعلَّم', alertInfo1Desc: 'نمط معاملة غير عادي على الحساب #8871.',
  alertAction2Title: 'دفع مكرر محتمل', alertAction2Desc: 'قد يكون المورد #44 قد دُفع مرتين هذا الشهر.',
  alertSucc3Title: 'القائمة المختصرة جاهزة', alertSucc3Desc: '5 مرشحين مختارون لدور المطور الأول.',
  alertWarn2Title: 'تنبيه انخفاض المخزون', alertWarn2Desc: 'المنطقة B — 3 منتجات أسفل عتبة إعادة الطلب.',
  explore: 'استكشاف', loadingAgents: 'جارٍ تحميل الوكلاء...',
  agentsAvailable: (n) => `${n} وكيل ذكاء اصطناعي متاح`,
  fetchingAgents: 'جارٍ جلب الوكلاء...', noAgentsFound: 'لم يتم العثور على وكلاء.', ready: 'جاهز',
  sectionPreferences: 'التفضيلات', sectionAbout: 'حول',
  notifications: 'الإشعارات', appearance: 'المظهر', language: 'اللغة',
  notifOn: 'مفعّل', dark: 'داكن', light: 'فاتح',
  privacyPolicy: 'سياسة الخصوصية', termsOfService: 'شروط الخدمة', appVersion: 'إصدار التطبيق',
  uipathAccount: 'حساب UiPath', signOut: 'تسجيل الخروج', selectLanguage: 'اختر اللغة',
  askAnything: 'اسألني أي شيء...', listening: 'أستمع إليك...', failedToConnect: 'فشل الاتصال. يرجى المحاولة مجدداً.',
  close: 'إغلاق',
};

const es: Translation = {
  navHome: 'Inicio', navChat: 'Chat', navExplore: 'Explorar', navAlerts: 'Alertas', navProfile: 'Perfil',
  greeting: 'Hola', howCanIHelp: '¿En qué puedo ayudarte hoy?',
  recentlyActiveAgents: 'Agentes activos recientemente', agentInsights: 'Perspectivas del agente', tapToView: 'Toca para ver',
  onYourDesk: 'En tu mesa', tapToViewAll: 'Ver todo', actionRequired: 'Acción requerida',
  pendingLabel: 'pendiente', autoHandled: 'auto-resueltas', needsYou: 'te necesita', needYou: 'te necesitan',
  yourConversation: 'Tus conversaciones', searchPlaceholder: 'Buscar...',
  noConversations: 'Sin conversaciones aún', startChatting: 'Empieza desde Inicio o Explorar',
  today: 'HOY', yesterday: 'AYER',
  alerts: 'Alertas', markAllRead: 'Marcar todo como leído', allCaughtUp: 'Todo al día',
  unreadCount: (n) => `${n} notificación${n > 1 ? 'es' : ''} sin leer`,
  filterAll: 'Todo', filterUnread: 'No leído', noNotifications: 'Sin notificaciones',
  reviewNow: 'Revisar ahora', dismiss: 'Descartar',
  alertActionTitle: 'Acción requerida',
  alertAction1Title: 'Acción requerida', alertAction1Desc: 'El siniestro #TXA-8812 necesita revisión manual.',
  alertSucc1Title: 'Conciliación completada', alertSucc1Desc: 'Facturas de marzo conciliadas. 3 discrepancias marcadas.',
  alertWarn1Title: 'Conflicto de entrevista detectado', alertWarn1Desc: '2 candidatos programados a la misma hora el 25 de marzo.',
  alertSucc2Title: 'Procesamiento en lote completado', alertSucc2Desc: '47 siniestros procesados, 12 escalados para revisión.',
  alertInfo1Title: 'Anomalía marcada', alertInfo1Desc: 'Patrón de transacción inusual en la cuenta #8871.',
  alertAction2Title: 'Pago duplicado detectado', alertAction2Desc: 'El proveedor #44 puede haber sido pagado dos veces este mes.',
  alertSucc3Title: 'Preselección lista', alertSucc3Desc: '5 candidatos preseleccionados para el puesto de Dev Senior.',
  alertWarn2Title: 'Alerta de bajo inventario', alertWarn2Desc: 'Zona B — 3 SKUs bajo el umbral de reposición.',
  explore: 'Explorar', loadingAgents: 'Cargando agentes…',
  agentsAvailable: (n) => `${n} agente${n !== 1 ? 's' : ''} IA disponible${n !== 1 ? 's' : ''}`,
  fetchingAgents: 'Obteniendo agentes…', noAgentsFound: 'No se encontraron agentes.', ready: 'Listo',
  sectionPreferences: 'PREFERENCIAS', sectionAbout: 'ACERCA DE',
  notifications: 'Notificaciones', appearance: 'Apariencia', language: 'Idioma',
  notifOn: 'Activado', dark: 'Oscuro', light: 'Claro',
  privacyPolicy: 'Política de privacidad', termsOfService: 'Términos de servicio', appVersion: 'Versión de la app',
  uipathAccount: 'Cuenta UiPath', signOut: 'Cerrar sesión', selectLanguage: 'Seleccionar idioma',
  askAnything: 'Pregúntame lo que quieras...', listening: 'Escuchando...', failedToConnect: 'Error de conexión. Vuelve e inténtalo de nuevo.',
  close: 'Cerrar',
};

const zh: Translation = {
  navHome: '首页', navChat: '聊天', navExplore: '探索', navAlerts: '提醒', navProfile: '我的',
  greeting: '你好', howCanIHelp: '今天我能帮你什么？',
  recentlyActiveAgents: '最近活跃的代理', agentInsights: '代理洞察', tapToView: '点击查看',
  onYourDesk: '您的待办', tapToViewAll: '查看全部', actionRequired: '需要处理',
  pendingLabel: '待处理', autoHandled: '自动处理', needsYou: '需要您', needYou: '需要您',
  yourConversation: '我的对话', searchPlaceholder: '搜索...',
  noConversations: '暂无对话', startChatting: '从首页或探索开始聊天',
  today: '今天', yesterday: '昨天',
  alerts: '提醒', markAllRead: '全部标为已读', allCaughtUp: '一切都已跟上',
  unreadCount: (n) => `${n} 条未读通知`,
  filterAll: '全部', filterUnread: '未读', noNotifications: '暂无通知',
  reviewNow: '立即查看', dismiss: '忽略',
  alertActionTitle: '需要处理',
  alertAction1Title: '需要处理', alertAction1Desc: '理赔 #TXA-8812 需要人工审核。',
  alertSucc1Title: '对账完成', alertSucc1Desc: '三月份供应商发票已对账，3处差异已标记。',
  alertWarn1Title: '面试冲突', alertWarn1Desc: '3月25日有2名候选人安排在同一时间段。',
  alertSucc2Title: '批量处理完成', alertSucc2Desc: '47份理赔已处理，12份已上报人工审核。',
  alertInfo1Title: '异常标记', alertInfo1Desc: '账户#8871检测到异常交易模式。',
  alertAction2Title: '疑似重复付款', alertAction2Desc: '供应商#44本月可能被付款两次。',
  alertSucc3Title: '候选人名单已就绪', alertSucc3Desc: '5名候选人入选高级开发岗位短名单。',
  alertWarn2Title: '库存不足警告', alertWarn2Desc: 'B区仓库3个SKU低于补货阈值。',
  explore: '探索', loadingAgents: '加载代理中...',
  agentsAvailable: (n) => `共 ${n} 个 AI 代理`,
  fetchingAgents: '正在获取代理...', noAgentsFound: '未找到代理。', ready: '就绪',
  sectionPreferences: '偏好设置', sectionAbout: '关于',
  notifications: '通知', appearance: '外观', language: '语言',
  notifOn: '开', dark: '深色', light: '浅色',
  privacyPolicy: '隐私政策', termsOfService: '服务条款', appVersion: '应用版本',
  uipathAccount: 'UiPath 账户', signOut: '退出登录', selectLanguage: '选择语言',
  askAnything: '问我任何问题...', listening: '正在听...', failedToConnect: '连接失败，请返回重试。',
  close: '关闭',
};

const hi: Translation = {
  navHome: 'होम', navChat: 'चैट', navExplore: 'खोजें', navAlerts: 'अलर्ट', navProfile: 'प्रोफ़ाइल',
  greeting: 'नमस्ते', howCanIHelp: 'आज मैं आपकी कैसे मदद कर सकता हूँ?',
  recentlyActiveAgents: 'हाल में सक्रिय एजेंट', agentInsights: 'एजेंट अंतर्दृष्टि', tapToView: 'देखने के लिए टैप करें',
  onYourDesk: 'आपकी मेज पर', tapToViewAll: 'सभी देखें', actionRequired: 'कार्रवाई आवश्यक',
  pendingLabel: 'लंबित', autoHandled: 'स्वतः-नियंत्रित', needsYou: 'आपकी आवश्यकता', needYou: 'आपकी आवश्यकता',
  yourConversation: 'आपकी बातचीत', searchPlaceholder: 'खोजें...',
  noConversations: 'कोई बातचीत नहीं', startChatting: 'होम या खोजें से बात शुरू करें',
  today: 'आज', yesterday: 'कल',
  alerts: 'अलर्ट', markAllRead: 'सभी पढ़ा हुआ चिह्नित करें', allCaughtUp: 'सब देख लिया',
  unreadCount: (n) => `${n} अपठित सूचना`,
  filterAll: 'सभी', filterUnread: 'अपठित', noNotifications: 'कोई सूचना नहीं',
  reviewNow: 'अभी देखें', dismiss: 'खारिज करें',
  alertActionTitle: 'कार्रवाई आवश्यक',
  alertAction1Title: 'कार्रवाई आवश्यक', alertAction1Desc: 'दावा #TXA-8812 को मैन्युअल समीक्षा की आवश्यकता है।',
  alertSucc1Title: 'मिलान पूर्ण', alertSucc1Desc: 'मार्च की वेंडर फ़ाइलें मिलान की गईं। 3 विसंगतियाँ चिह्नित।',
  alertWarn1Title: 'साक्षात्कार विरोध', alertWarn1Desc: '25 मार्च को 2 उम्मीदवार एक ही समय पर निर्धारित हैं।',
  alertSucc2Title: 'बैच प्रसंस्करण पूर्ण', alertSucc2Desc: '47 दावे संसाधित, 12 समीक्षा के लिए भेजे गए।',
  alertInfo1Title: 'अनियमितता चिह्नित', alertInfo1Desc: 'खाता #8871 पर असामान्य लेनदेन पैटर्न।',
  alertAction2Title: 'डुप्लीकेट भुगतान', alertAction2Desc: 'सप्लायर #44 को इस महीने दो बार भुगतान हो सकता है।',
  alertSucc3Title: 'शॉर्टलिस्ट तैयार', alertSucc3Desc: 'वरिष्ठ डेव भूमिका के लिए 5 उम्मीदवार चुने गए।',
  alertWarn2Title: 'कम स्टॉक अलर्ट', alertWarn2Desc: 'वेयरहाउस B — 3 SKU पुनर्क्रम सीमा से नीचे।',
  explore: 'खोजें', loadingAgents: 'एजेंट लोड हो रहे हैं...',
  agentsAvailable: (n) => `${n} AI एजेंट उपलब्ध`,
  fetchingAgents: 'एजेंट प्राप्त किए जा रहे हैं...', noAgentsFound: 'कोई एजेंट नहीं मिला।', ready: 'तैयार',
  sectionPreferences: 'प्राथमिकताएं', sectionAbout: 'के बारे में',
  notifications: 'सूचनाएं', appearance: 'स्वरूप', language: 'भाषा',
  notifOn: 'चालू', dark: 'गहरा', light: 'हल्का',
  privacyPolicy: 'गोपनीयता नीति', termsOfService: 'सेवा की शर्तें', appVersion: 'ऐप संस्करण',
  uipathAccount: 'UiPath खाता', signOut: 'साइन आउट', selectLanguage: 'भाषा चुनें',
  askAnything: 'मुझसे कुछ भी पूछें...', listening: 'सुन रहा हूं...', failedToConnect: 'कनेक्ट नहीं हो पाया। कृपया पुनः प्रयास करें।',
  close: 'बंद करें',
};

const pt: Translation = {
  navHome: 'Início', navChat: 'Chat', navExplore: 'Explorar', navAlerts: 'Alertas', navProfile: 'Perfil',
  greeting: 'Olá', howCanIHelp: 'Como posso ajudá-lo hoje?',
  recentlyActiveAgents: 'Agentes ativos recentemente', agentInsights: 'Insights dos agentes', tapToView: 'Toque para ver',
  onYourDesk: 'Na sua mesa', tapToViewAll: 'Ver tudo', actionRequired: 'Ação necessária',
  pendingLabel: 'pendente', autoHandled: 'auto-resolvido', needsYou: 'precisa de você', needYou: 'precisam de você',
  yourConversation: 'Suas conversas', searchPlaceholder: 'Pesquisar...',
  noConversations: 'Nenhuma conversa ainda', startChatting: 'Comece pelo Início ou Explorar',
  today: 'HOJE', yesterday: 'ONTEM',
  alerts: 'Alertas', markAllRead: 'Marcar tudo como lido', allCaughtUp: 'Tudo em dia',
  unreadCount: (n) => `${n} notificação${n > 1 ? 'ões' : ''} não lida${n > 1 ? 's' : ''}`,
  filterAll: 'Tudo', filterUnread: 'Não lido', noNotifications: 'Sem notificações',
  reviewNow: 'Revisar agora', dismiss: 'Dispensar',
  alertActionTitle: 'Ação necessária',
  alertAction1Title: 'Ação necessária', alertAction1Desc: 'Sinistro #TXA-8812 precisa de revisão manual.',
  alertSucc1Title: 'Conciliação concluída', alertSucc1Desc: 'Faturas de março conciliadas. 3 divergências marcadas.',
  alertWarn1Title: 'Conflito de entrevista', alertWarn1Desc: '2 candidatos no mesmo horário em 25 de março.',
  alertSucc2Title: 'Processamento em lote concluído', alertSucc2Desc: '47 sinistros processados, 12 escalados.',
  alertInfo1Title: 'Anomalia marcada', alertInfo1Desc: 'Padrão de transação incomum na conta #8871.',
  alertAction2Title: 'Pagamento duplicado detectado', alertAction2Desc: 'Fornecedor #44 pode ter sido pago duas vezes.',
  alertSucc3Title: 'Lista pronta', alertSucc3Desc: '5 candidatos selecionados para Dev Sênior.',
  alertWarn2Title: 'Alerta de estoque baixo', alertWarn2Desc: 'Zona B — 3 SKUs abaixo do limite de reabastecimento.',
  explore: 'Explorar', loadingAgents: 'Carregando agentes…',
  agentsAvailable: (n) => `${n} agente${n !== 1 ? 's' : ''} IA disponíve${n !== 1 ? 'is' : 'l'}`,
  fetchingAgents: 'Buscando agentes…', noAgentsFound: 'Nenhum agente encontrado.', ready: 'Pronto',
  sectionPreferences: 'PREFERÊNCIAS', sectionAbout: 'SOBRE',
  notifications: 'Notificações', appearance: 'Aparência', language: 'Idioma',
  notifOn: 'Ativado', dark: 'Escuro', light: 'Claro',
  privacyPolicy: 'Política de privacidade', termsOfService: 'Termos de serviço', appVersion: 'Versão do app',
  uipathAccount: 'Conta UiPath', signOut: 'Sair', selectLanguage: 'Selecionar idioma',
  askAnything: 'Pergunte-me qualquer coisa...', listening: 'Ouvindo...', failedToConnect: 'Falha na conexão. Volte e tente novamente.',
  close: 'Fechar',
};

const ru: Translation = {
  navHome: 'Главная', navChat: 'Чат', navExplore: 'Обзор', navAlerts: 'Уведомления', navProfile: 'Профиль',
  greeting: 'Здравствуйте', howCanIHelp: 'Чем могу помочь сегодня?',
  recentlyActiveAgents: 'Недавно активные агенты', agentInsights: 'Аналитика агентов', tapToView: 'Нажмите для просмотра',
  onYourDesk: 'На вашем столе', tapToViewAll: 'Показать все', actionRequired: 'Требуется действие',
  pendingLabel: 'в ожидании', autoHandled: 'автоматически', needsYou: 'требует вас', needYou: 'требуют вас',
  yourConversation: 'Ваши беседы', searchPlaceholder: 'Поиск...',
  noConversations: 'Нет разговоров', startChatting: 'Начните с главной или обзора',
  today: 'СЕГОДНЯ', yesterday: 'ВЧЕРА',
  alerts: 'Уведомления', markAllRead: 'Отметить все прочитанными', allCaughtUp: 'Всё прочитано',
  unreadCount: (n) => `${n} непрочитанных уведомления`,
  filterAll: 'Все', filterUnread: 'Непрочитанные', noNotifications: 'Нет уведомлений',
  reviewNow: 'Просмотреть сейчас', dismiss: 'Отклонить',
  alertActionTitle: 'Требуется действие',
  alertAction1Title: 'Требуется действие', alertAction1Desc: 'Заявка #TXA-8812 требует ручной проверки.',
  alertSucc1Title: 'Сверка завершена', alertSucc1Desc: 'Мартовские счета сверены. 3 расхождения отмечены.',
  alertWarn1Title: 'Конфликт собеседований', alertWarn1Desc: '2 кандидата назначены на одно время 25 марта.',
  alertSucc2Title: 'Пакетная обработка завершена', alertSucc2Desc: '47 заявок обработано, 12 эскалировано.',
  alertInfo1Title: 'Аномалия обнаружена', alertInfo1Desc: 'Необычная транзакция на счёте #8871.',
  alertAction2Title: 'Дублирующий платёж', alertAction2Desc: 'Поставщик #44 мог быть оплачен дважды.',
  alertSucc3Title: 'Список готов', alertSucc3Desc: '5 кандидатов отобрано на роль Senior Dev.',
  alertWarn2Title: 'Низкий уровень запасов', alertWarn2Desc: 'Зона B — 3 SKU ниже порога пополнения.',
  explore: 'Обзор', loadingAgents: 'Загрузка агентов…',
  agentsAvailable: (n) => `Доступно агентов ИИ: ${n}`,
  fetchingAgents: 'Получение агентов…', noAgentsFound: 'Агенты не найдены.', ready: 'Готово',
  sectionPreferences: 'НАСТРОЙКИ', sectionAbout: 'О ПРИЛОЖЕНИИ',
  notifications: 'Уведомления', appearance: 'Оформление', language: 'Язык',
  notifOn: 'Вкл', dark: 'Тёмный', light: 'Светлый',
  privacyPolicy: 'Политика конфиденциальности', termsOfService: 'Условия обслуживания', appVersion: 'Версия приложения',
  uipathAccount: 'Аккаунт UiPath', signOut: 'Выйти', selectLanguage: 'Выбрать язык',
  askAnything: 'Спросите меня о чём угодно...', listening: 'Слушаю...', failedToConnect: 'Не удалось подключиться. Вернитесь и попробуйте снова.',
  close: 'Закрыть',
};

const bn: Translation = {
  navHome: 'হোম', navChat: 'চ্যাট', navExplore: 'অন্বেষণ', navAlerts: 'সতর্কতা', navProfile: 'প্রোফাইল',
  greeting: 'হ্যালো', howCanIHelp: 'আজ আমি কীভাবে সাহায্য করতে পারি?',
  recentlyActiveAgents: 'সম্প্রতি সক্রিয় এজেন্ট', agentInsights: 'এজেন্ট অন্তর্দৃষ্টি', tapToView: 'দেখতে ট্যাপ করুন',
  onYourDesk: 'আপনার ডেস্কে', tapToViewAll: 'সবগুলো দেখুন', actionRequired: 'পদক্ষেপ প্রয়োজন',
  pendingLabel: 'মুলতুবি', autoHandled: 'স্বয়ংক্রিয়', needsYou: 'আপনার প্রয়োজন', needYou: 'আপনার প্রয়োজন',
  yourConversation: 'আপনার কথোপকথন', searchPlaceholder: 'খুঁজুন...',
  noConversations: 'কোনো কথোপকথন নেই', startChatting: 'হোম বা অন্বেষণ থেকে শুরু করুন',
  today: 'আজ', yesterday: 'গতকাল',
  alerts: 'সতর্কতা', markAllRead: 'সবগুলো পঠিত চিহ্নিত করুন', allCaughtUp: 'সব দেখা হয়ে গেছে',
  unreadCount: (n) => `${n}টি অপঠিত বিজ্ঞপ্তি`,
  filterAll: 'সব', filterUnread: 'অপঠিত', noNotifications: 'কোনো বিজ্ঞপ্তি নেই',
  reviewNow: 'এখন পর্যালোচনা করুন', dismiss: 'বাতিল করুন',
  alertActionTitle: 'পদক্ষেপ প্রয়োজন',
  alertAction1Title: 'পদক্ষেপ প্রয়োজন', alertAction1Desc: 'দাবি #TXA-8812 ম্যানুয়াল পর্যালোচনা প্রয়োজন।',
  alertSucc1Title: 'মিলান সম্পন্ন', alertSucc1Desc: 'মার্চের চালান মিলানো হয়েছে। ৩টি অসংগতি চিহ্নিত।',
  alertWarn1Title: 'সাক্ষাৎকার দ্বন্দ্ব', alertWarn1Desc: '২৫ মার্চে ২ জন প্রার্থী একই সময়ে নির্ধারিত।',
  alertSucc2Title: 'ব্যাচ প্রক্রিয়াকরণ সম্পন্ন', alertSucc2Desc: '৪৭টি দাবি প্রক্রিয়া হয়েছে, ১২টি পর্যালোচনায় পাঠানো হয়েছে।',
  alertInfo1Title: 'অনিয়ম চিহ্নিত', alertInfo1Desc: 'অ্যাকাউন্ট #8871-এ অস্বাভাবিক লেনদেন।',
  alertAction2Title: 'সম্ভাব্য দ্বৈত পেমেন্ট', alertAction2Desc: 'সরবরাহকারী #44 এই মাসে দুবার পেমেন্ট পেয়েছে।',
  alertSucc3Title: 'শর্টলিস্ট প্রস্তুত', alertSucc3Desc: 'সিনিয়র ডেভ পদের জন্য ৫ প্রার্থী বাছাই করা হয়েছে।',
  alertWarn2Title: 'কম স্টক সতর্কতা', alertWarn2Desc: 'গুদাম B — ৩টি SKU পুনর্মজুদ সীমার নিচে।',
  explore: 'অন্বেষণ', loadingAgents: 'এজেন্ট লোড হচ্ছে...',
  agentsAvailable: (n) => `${n}টি AI এজেন্ট উপলব্ধ`,
  fetchingAgents: 'এজেন্ট আনা হচ্ছে...', noAgentsFound: 'কোনো এজেন্ট পাওয়া যায়নি।', ready: 'প্রস্তুত',
  sectionPreferences: 'পছন্দ', sectionAbout: 'সম্পর্কে',
  notifications: 'বিজ্ঞপ্তি', appearance: 'উপস্থিতি', language: 'ভাষা',
  notifOn: 'চালু', dark: 'অন্ধকার', light: 'আলো',
  privacyPolicy: 'গোপনীয়তা নীতি', termsOfService: 'সেবার শর্তাবলী', appVersion: 'অ্যাপ সংস্করণ',
  uipathAccount: 'UiPath অ্যাকাউন্ট', signOut: 'সাইন আউট', selectLanguage: 'ভাষা নির্বাচন করুন',
  askAnything: 'আমাকে যেকোনো কিছু জিজ্ঞাসা করুন...', listening: 'শুনছি...', failedToConnect: 'সংযোগ ব্যর্থ। ফিরে যান এবং আবার চেষ্টা করুন।',
  close: 'বন্ধ করুন',
};

const ja: Translation = {
  navHome: 'ホーム', navChat: 'チャット', navExplore: '探索', navAlerts: '通知', navProfile: 'プロフィール',
  greeting: 'こんにちは', howCanIHelp: '今日はどのようなご用件でしょうか？',
  recentlyActiveAgents: '最近アクティブなエージェント', agentInsights: 'エージェントの洞察', tapToView: 'タップして表示',
  onYourDesk: '対応待ち', tapToViewAll: 'すべて表示', actionRequired: '対応が必要',
  pendingLabel: '保留', autoHandled: '自動処理済み', needsYou: '対応が必要', needYou: '対応が必要',
  yourConversation: '会話履歴', searchPlaceholder: '検索...',
  noConversations: '会話がありません', startChatting: 'ホームまたは探索から始めてください',
  today: '今日', yesterday: '昨日',
  alerts: '通知', markAllRead: 'すべて既読にする', allCaughtUp: 'すべて確認済み',
  unreadCount: (n) => `未読通知が ${n} 件あります`,
  filterAll: 'すべて', filterUnread: '未読', noNotifications: '通知はありません',
  reviewNow: '今すぐ確認', dismiss: '閉じる',
  alertActionTitle: '対応が必要',
  alertAction1Title: '対応が必要', alertAction1Desc: '申請 #TXA-8812 は手動レビューが必要です。',
  alertSucc1Title: '照合完了', alertSucc1Desc: '3月の請求書が照合されました。3件の不一致を検出。',
  alertWarn1Title: '面接の競合', alertWarn1Desc: '3月25日に2名の候補者が同じ時間帯に予定されています。',
  alertSucc2Title: 'バッチ処理完了', alertSucc2Desc: '47件処理済み、12件が人的レビューにエスカレート。',
  alertInfo1Title: '異常を検出', alertInfo1Desc: 'アカウント#8871で異常な取引パターンを検出。',
  alertAction2Title: '重複支払いを検出', alertAction2Desc: 'サプライヤー#44が今月2回支払われた可能性があります。',
  alertSucc3Title: '候補者リスト完成', alertSucc3Desc: 'シニアデブ職に5名がショートリスト入り。',
  alertWarn2Title: '在庫不足アラート', alertWarn2Desc: 'B倉庫 — 3つのSKUが発注基準を下回っています。',
  explore: '探索', loadingAgents: 'エージェントを読み込み中...',
  agentsAvailable: (n) => `AIエージェント ${n} 件`,
  fetchingAgents: 'エージェントを取得中...', noAgentsFound: 'エージェントが見つかりません。', ready: '準備完了',
  sectionPreferences: '環境設定', sectionAbout: 'アプリについて',
  notifications: '通知', appearance: '外観', language: '言語',
  notifOn: 'オン', dark: 'ダーク', light: 'ライト',
  privacyPolicy: 'プライバシーポリシー', termsOfService: '利用規約', appVersion: 'アプリバージョン',
  uipathAccount: 'UiPathアカウント', signOut: 'サインアウト', selectLanguage: '言語を選択',
  askAnything: '何でも聞いてください...', listening: '聞いています...', failedToConnect: '接続に失敗しました。戻って再試行してください。',
  close: '閉じる',
};

const sw: Translation = {
  navHome: 'Nyumbani', navChat: 'Gumzo', navExplore: 'Chunguza', navAlerts: 'Arifa', navProfile: 'Wasifu',
  greeting: 'Habari', howCanIHelp: 'Nikusaidie vipi leo?',
  recentlyActiveAgents: 'Mawakala Hai Hivi Karibuni', agentInsights: 'Maarifa ya Wakala', tapToView: 'Gusa kuona',
  onYourDesk: 'Kwenye Dawati Lako', tapToViewAll: 'Gusa Kuona Zote', actionRequired: 'Hatua Inahitajika',
  pendingLabel: 'inasubiri', autoHandled: 'imeshughulikiwa kiotomatiki', needsYou: 'inakuhitaji', needYou: 'wanakuhitaji',
  yourConversation: 'Mazungumzo yako', searchPlaceholder: 'Tafuta...',
  noConversations: 'Hakuna mazungumzo bado', startChatting: 'Anza kuzungumza kutoka Nyumbani au Chunguza',
  today: 'LEO', yesterday: 'JANA',
  alerts: 'Arifa', markAllRead: 'Weka zote zimesomwa', allCaughtUp: 'Umemaliza zote',
  unreadCount: (n) => `arifa ${n} ambazo hazijasomwa`,
  filterAll: 'Zote', filterUnread: 'Hazijasomwa', noNotifications: 'Hakuna arifa',
  reviewNow: 'Kagua Sasa', dismiss: 'Ondoa',
  alertActionTitle: 'Hatua Inahitajika',
  alertAction1Title: 'Hatua Inahitajika', alertAction1Desc: 'Dai #TXA-8812 linahitaji ukaguzi wa mikono — makadirio ya uharibifu yanazidi kiwango cha idhini otomatiki.',
  alertSucc1Title: 'Upatanishi Umekamilika', alertSucc1Desc: 'Ankara za wauzaji za Machi zimepatanishwa. Tofauti 3 zimewekwa alama kwa ukaguzi wako.',
  alertWarn1Title: 'Mgongano wa Mahojiano Umegunduliwa', alertWarn1Desc: 'Wagombea 2 wamepangwa kwa muda mmoja tarehe 25 Machi. Inahitaji kupangwa upya.',
  alertSucc2Title: 'Uchakataji wa Kundi Umekamilika', alertSucc2Desc: 'Tukio la dhoruba FL-03 — madai 47 yamechakatwa, 12 yamepandishwa kwa ukaguzi wa binadamu.',
  alertInfo1Title: 'Hitilafu Imewekwa Alama', alertInfo1Desc: 'Mfumo usio wa kawaida wa muamala umegunduliwa kwenye akaunti #8871. Ukaguzi unapendekezwa.',
  alertAction2Title: 'Malipo Marudufu Yamegunduliwa', alertAction2Desc: 'Msambazaji #44 huenda amelipwa mara mbili mwezi huu. Thibitisha au ondoa.',
  alertSucc3Title: 'Orodha Fupi Iko Tayari', alertSucc3Desc: 'Wagombea 5 wamechaguliwa kwa nafasi ya Senior Dev. Tayari kwa ukaguzi wako.',
  alertWarn2Title: 'Arifa ya Hisa Ndogo', alertWarn2Desc: 'Eneo B la Ghala — bidhaa 3 ziko chini ya kiwango cha kuagiza upya. Uagizaji otomatiki umesimamishwa.',
  explore: 'Chunguza', loadingAgents: 'Inapakia mawakala…',
  agentsAvailable: (n) => `mawakala ${n} wa AI wanapatikana`,
  fetchingAgents: 'Inaleta mawakala kutoka MEA…', noAgentsFound: 'Hakuna mawakala waliopatikana katika tenant hii.', ready: 'Tayari',
  sectionPreferences: 'MAPENDELEO', sectionAbout: 'KUHUSU',
  notifications: 'Arifa', appearance: 'Mwonekano', language: 'Lugha',
  notifOn: 'Imewashwa', dark: 'Giza', light: 'Mwanga',
  privacyPolicy: 'Sera ya Faragha', termsOfService: 'Masharti ya Huduma', appVersion: 'Toleo la Programu',
  uipathAccount: 'Akaunti ya UiPath', signOut: 'Toka', selectLanguage: 'Chagua Lugha',
  askAnything: 'Niulize chochote...', listening: 'Inasikiliza...', failedToConnect: 'Imeshindwa kuunganisha. Tafadhali rudi nyuma na ujaribu tena.',
  close: 'Funga',
};

export const TRANSLATIONS: Record<string, Translation> = { en, fr, ar, es, zh, hi, pt, ru, bn, ja, sw };

// ── Chip label translations ──────────────────────────────────────────────────
// Order within each array must stay in sync with icon sequences in ChatView.tsx
// invoice: list,alert,chart,search,money,alert
// claim:   list,alert,chart,search,doc,alert
// hr:      list,person,doc,chart,search,list
// supply:  alert,box,search,chart,alert,list
// kcb:     list,alert,chat,money,search,person
// customer:list,alert,chart,search,doc,chat
// default: chat,list,doc,search,chart,alert

export type ChipCategory = 'default' | 'invoice' | 'claim' | 'hr' | 'supply' | 'kcb' | 'customer';
export type ChipLabels = Record<ChipCategory, string[]>;

export const CHIP_TRANSLATIONS: Record<string, ChipLabels> = {
  en: {
    default:  ['What can you help with?', 'Show recent activity', 'Generate a summary', 'Search records', 'Run a report', 'Flag an issue'],
    invoice:  ['Show pending invoices', 'Overdue invoices summary', 'Top suppliers by spend', 'Invoices missing PO number', 'Reconcile this month', 'Flag duplicate payments'],
    claim:    ['Review pending claims', 'Flagged claims this week', 'Claims by category', 'High-value claims > $10k', 'Approve batch of claims', 'Missing documents report'],
    hr:       ['Open job positions', 'Shortlist top candidates', 'Pending onboarding tasks', 'Headcount by department', 'Interview schedule today', 'New hire checklist'],
    supply:   ['Low stock alerts', 'Reorder recommendations', 'Supplier delivery status', 'Inventory by warehouse', 'Delayed shipments', 'Top selling SKUs this month'],
    kcb:      ['Pending loan approvals', 'Flagged transactions', 'Customer queries today', 'Account balance summary', 'Transaction anomalies', 'New account requests'],
    customer: ['Open support tickets', 'Escalated issues today', 'Customer sentiment summary', 'Unresolved complaints', 'Response time report', 'Top complaint categories'],
  },
  fr: {
    default:  ['En quoi puis-je vous aider ?', "Afficher l'activité récente", 'Générer un résumé', 'Rechercher des enregistrements', 'Lancer un rapport', 'Signaler un problème'],
    invoice:  ['Factures en attente', 'Résumé des factures en retard', 'Principaux fournisseurs', 'Factures sans numéro de bon', 'Réconcilier ce mois', 'Paiements en double'],
    claim:    ['Dossiers en attente', 'Dossiers signalés cette semaine', 'Dossiers par catégorie', 'Dossiers > 10 000 $', 'Approuver un lot', 'Documents manquants'],
    hr:       ['Postes ouverts', 'Présélectionner candidats', "Tâches d'intégration", 'Effectif par département', "Programme d'entretiens", 'Checklist nouveaux embauchés'],
    supply:   ['Alerte stock faible', 'Réapprovisionner', 'Livraisons fournisseurs', 'Inventaire par entrepôt', 'Expéditions retardées', 'Meilleures ventes du mois'],
    kcb:      ['Approbations de prêts', 'Transactions signalées', 'Requêtes clients', 'Solde du compte', 'Anomalies transactions', 'Nouvelles demandes compte'],
    customer: ['Tickets ouverts', 'Problèmes escaladés', 'Sentiment client', 'Plaintes non résolues', 'Délais de réponse', 'Catégories de plaintes'],
  },
  ar: {
    default:  ['بماذا يمكنني مساعدتك؟', 'عرض النشاط الأخير', 'إنشاء ملخص', 'البحث في السجلات', 'تشغيل تقرير', 'الإبلاغ عن مشكلة'],
    invoice:  ['الفواتير المعلقة', 'ملخص الفواتير المتأخرة', 'أفضل الموردين', 'فواتير بدون رقم أمر شراء', 'تسوية هذا الشهر', 'مدفوعات مكررة'],
    claim:    ['مراجعة المطالبات', 'المطالبات المُعلَّمة', 'المطالبات حسب الفئة', 'مطالبات تزيد عن 10,000 $', 'الموافقة على دفعة', 'وثائق مفقودة'],
    hr:       ['الوظائف المفتوحة', 'قائمة المرشحين', 'مهام التأهيل', 'التوظيف حسب القسم', 'جدول المقابلات اليوم', 'قائمة الموظفين الجدد'],
    supply:   ['تنبيهات المخزون', 'توصيات إعادة الطلب', 'حالة التسليم', 'المخزون حسب المستودع', 'الشحنات المتأخرة', 'أكثر SKU مبيعاً'],
    kcb:      ['طلبات القروض', 'المعاملات المُعلَّمة', 'استفسارات العملاء', 'ملخص الرصيد', 'شذوذات المعاملات', 'طلبات الحسابات الجديدة'],
    customer: ['تذاكر الدعم', 'المشكلات المُصعَّدة', 'شعور العملاء', 'الشكاوى غير المحلولة', 'وقت الاستجابة', 'فئات الشكاوى'],
  },
  es: {
    default:  ['¿En qué puedo ayudarte?', 'Mostrar actividad reciente', 'Generar un resumen', 'Buscar registros', 'Ejecutar un informe', 'Marcar un problema'],
    invoice:  ['Ver facturas pendientes', 'Facturas vencidas', 'Principales proveedores', 'Facturas sin orden', 'Reconciliar este mes', 'Pagos duplicados'],
    claim:    ['Reclamaciones pendientes', 'Reclamaciones marcadas', 'Reclamaciones por categoría', 'Reclamaciones > $10k', 'Aprobar lote', 'Documentos faltantes'],
    hr:       ['Puestos vacantes', 'Preseleccionar candidatos', 'Tareas de incorporación', 'Plantilla por departamento', 'Entrevistas hoy', 'Lista nuevos empleados'],
    supply:   ['Bajo inventario', 'Reabastecimiento', 'Estado de entregas', 'Inventario por almacén', 'Envíos retrasados', 'SKUs más vendidos'],
    kcb:      ['Préstamos pendientes', 'Transacciones marcadas', 'Consultas hoy', 'Resumen de saldo', 'Anomalías de transacciones', 'Nuevas cuentas'],
    customer: ['Tickets abiertos', 'Problemas escalados', 'Sentimiento del cliente', 'Reclamaciones sin resolver', 'Tiempo de respuesta', 'Categorías de quejas'],
  },
  zh: {
    default:  ['你能帮我做什么？', '显示最近活动', '生成摘要', '搜索记录', '运行报告', '标记问题'],
    invoice:  ['待处理发票', '逾期发票摘要', '主要供应商', '缺少采购单号的发票', '本月对账', '重复付款'],
    claim:    ['待审理赔', '本周标记理赔', '按类别理赔', '超万元理赔', '批量审批', '缺少文件'],
    hr:       ['开放职位', '候选人短名单', '待处理入职', '部门人数', '今日面试', '新员工清单'],
    supply:   ['低库存警报', '补货建议', '供应商交货', '仓库库存', '延迟发货', '热销SKU'],
    kcb:      ['待审批贷款', '标记交易', '今日客户查询', '账户余额', '交易异常', '新开户申请'],
    customer: ['未解决工单', '今日升级问题', '客户情感分析', '未解决投诉', '响应时间', '投诉类别'],
  },
  hi: {
    default:  ['आप किसमें मदद कर सकते हैं?', 'हालिया गतिविधि', 'सारांश बनाएं', 'रिकॉर्ड खोजें', 'रिपोर्ट चलाएं', 'समस्या दर्ज करें'],
    invoice:  ['लंबित चालान', 'अतिदेय चालान', 'शीर्ष आपूर्तिकर्ता', 'PO बिना चालान', 'इस महीने मिलान', 'डुप्लीकेट भुगतान'],
    claim:    ['लंबित दावे', 'चिह्नित दावे', 'श्रेणी अनुसार दावे', '₹10k+ दावे', 'बैच अनुमोदन', 'गुम दस्तावेज़'],
    hr:       ['खुले पद', 'शॉर्टलिस्ट उम्मीदवार', 'ऑनबोर्डिंग कार्य', 'विभाग अनुसार कर्मचारी', 'आज साक्षात्कार', 'नए कर्मचारी सूची'],
    supply:   ['कम स्टॉक', 'पुनःऑर्डर सुझाव', 'आपूर्तिकर्ता डिलीवरी', 'गोदाम इन्वेंटरी', 'विलंबित शिपमेंट', 'शीर्ष SKU'],
    kcb:      ['लंबित ऋण', 'चिह्नित लेनदेन', 'ग्राहक पूछताछ', 'खाता शेष', 'लेनदेन असामान्यताएं', 'नए खाता अनुरोध'],
    customer: ['सहायता टिकट', 'एस्केलेटेड मुद्दे', 'ग्राहक भावना', 'अनसुलझी शिकायतें', 'प्रतिक्रिया समय', 'शिकायत श्रेणियां'],
  },
  pt: {
    default:  ['Como posso ajudar?', 'Mostrar atividade recente', 'Gerar um resumo', 'Pesquisar registros', 'Executar relatório', 'Sinalizar problema'],
    invoice:  ['Faturas pendentes', 'Faturas vencidas', 'Principais fornecedores', 'Faturas sem pedido', 'Reconciliar este mês', 'Pagamentos duplicados'],
    claim:    ['Sinistros pendentes', 'Sinistros sinalizados', 'Sinistros por categoria', 'Sinistros > R$10k', 'Aprovar lote', 'Documentos ausentes'],
    hr:       ['Vagas abertas', 'Pré-selecionar candidatos', 'Tarefas de integração', 'Headcount por departamento', 'Entrevistas hoje', 'Checklist novos contratados'],
    supply:   ['Estoque baixo', 'Reabastecimento', 'Entregas de fornecedores', 'Estoque por armazém', 'Remessas atrasadas', 'SKUs mais vendidos'],
    kcb:      ['Empréstimos pendentes', 'Transações sinalizadas', 'Consultas hoje', 'Saldo da conta', 'Anomalias de transações', 'Novas contas'],
    customer: ['Tickets abertos', 'Problemas escalados', 'Sentimento do cliente', 'Reclamações não resolvidas', 'Tempo de resposta', 'Categorias de reclamações'],
  },
  ru: {
    default:  ['Чем я могу помочь?', 'Последние действия', 'Создать резюме', 'Поиск записей', 'Запустить отчёт', 'Отметить проблему'],
    invoice:  ['Ожидающие счета', 'Просроченные счета', 'Топ поставщиков', 'Счета без номера заказа', 'Сверка за месяц', 'Дублирующие платежи'],
    claim:    ['Ожидающие заявки', 'Отмеченные заявки', 'Заявки по категориям', 'Заявки > 10 000 $', 'Одобрить пакет', 'Недостающие документы'],
    hr:       ['Открытые вакансии', 'Предварительный отбор', 'Задачи адаптации', 'Численность по отделам', 'Собеседования сегодня', 'Чек-лист новых сотрудников'],
    supply:   ['Низкий запас', 'Рекомендации пополнения', 'Доставки поставщиков', 'Инвентарь по складам', 'Задержанные отправления', 'Топ SKU за месяц'],
    kcb:      ['Ожидающие кредиты', 'Отмеченные транзакции', 'Запросы клиентов', 'Баланс счёта', 'Аномалии транзакций', 'Новые заявки счёта'],
    customer: ['Открытые тикеты', 'Эскалированные проблемы', 'Настроения клиентов', 'Неразрешённые жалобы', 'Время ответа', 'Категории жалоб'],
  },
  bn: {
    default:  ['আমি কীভাবে সাহায্য করতে পারি?', 'সাম্প্রতিক কার্যকলাপ', 'সারসংক্ষেপ তৈরি', 'রেকর্ড অনুসন্ধান', 'রিপোর্ট চালান', 'সমস্যা চিহ্নিত করুন'],
    invoice:  ['মুলতুবি চালান', 'অতিমেয়াদী চালান', 'শীর্ষ সরবরাহকারী', 'PO ছাড়া চালান', 'এই মাসে মিলান', 'ডুপ্লিকেট পেমেন্ট'],
    claim:    ['মুলতুবি দাবি', 'চিহ্নিত দাবি', 'বিভাগ অনুযায়ী দাবি', '$10k-এর বেশি দাবি', 'ব্যাচ অনুমোদন', 'অনুপস্থিত নথি'],
    hr:       ['খোলা পদ', 'শর্টলিস্ট প্রার্থী', 'অনবোর্ডিং কাজ', 'বিভাগ অনুযায়ী কর্মী', 'আজকের সাক্ষাৎকার', 'নতুন কর্মী চেকলিস্ট'],
    supply:   ['কম স্টক সতর্কতা', 'পুনর্মজুদ সুপারিশ', 'সরবরাহকারী ডেলিভারি', 'গুদাম ইনভেন্টরি', 'বিলম্বিত চালান', 'শীর্ষ SKU'],
    kcb:      ['মুলতুবি ঋণ', 'চিহ্নিত লেনদেন', 'গ্রাহক জিজ্ঞাসা', 'অ্যাকাউন্ট ব্যালেন্স', 'লেনদেন অস্বাভাবিকতা', 'নতুন অ্যাকাউন্ট'],
    customer: ['সাপোর্ট টিকিট', 'এস্কেলেটেড সমস্যা', 'গ্রাহক মনোভাব', 'অমীমাংসিত অভিযোগ', 'প্রতিক্রিয়া সময়', 'অভিযোগ বিভাগ'],
  },
  ja: {
    default:  ['何を手伝えますか？', '最近のアクティビティ', 'サマリーを生成', 'レコードを検索', 'レポートを実行', '問題を報告'],
    invoice:  ['未払い請求書', '延滞請求書', '主要サプライヤー', '発注番号のない請求書', '今月の照合', '重複支払いを報告'],
    claim:    ['保留中の申請', 'フラグされた申請', 'カテゴリ別申請', '高額申請', 'バッチ承認', '書類不備'],
    hr:       ['募集中ポジション', '候補者ショートリスト', 'オンボーディングタスク', '部門別人員', '本日の面接', '新入社員チェックリスト'],
    supply:   ['在庫不足アラート', '補充推奨', '納期ステータス', '倉庫別在庫', '出荷遅延', '売れ筋SKU'],
    kcb:      ['保留中ローン承認', 'フラグされた取引', '本日の顧客問い合わせ', '口座残高', '取引の異常', '新規口座申請'],
    customer: ['サポートチケット', 'エスカレーション', '顧客センチメント', '未解決苦情', '対応時間', '苦情カテゴリ'],
  },
  sw: {
    default:  ['Unaweza kusaidia na nini?', 'Onyesha shughuli za hivi karibuni', 'Tengeneza muhtasari', 'Tafuta rekodi', 'Endesha ripoti', 'Weka alama tatizo'],
    invoice:  ['Onyesha ankara zinazosubiri', 'Muhtasari wa ankara zilizochelewa', 'Wauzaji wakuu kwa matumizi', 'Ankara zisizo na nambari ya PO', 'Patanisha mwezi huu', 'Weka alama malipo marudufu'],
    claim:    ['Kagua madai yanayosubiri', 'Madai yaliyowekwa alama wiki hii', 'Madai kwa kategoria', 'Madai ya thamani kubwa > $10k', 'Idhinisha kundi la madai', 'Ripoti ya hati zinazokosekana'],
    hr:       ['Nafasi za kazi zilizo wazi', 'Orodhesha wagombea bora', 'Kazi za kuingiza zinazosubiri', 'Idadi ya wafanyakazi kwa idara', 'Ratiba ya mahojiano leo', 'Orodha ya mwajiriwa mpya'],
    supply:   ['Arifa za hisa ndogo', 'Mapendekezo ya kuagiza upya', 'Hali ya uwasilishaji wa wauzaji', 'Bidhaa kwa ghala', 'Usafirishaji uliochelewa', 'Bidhaa zinazouzwa zaidi mwezi huu'],
    kcb:      ['Idhini za mikopo zinazosubiri', 'Miamala iliyowekwa alama', 'Maswali ya wateja leo', 'Muhtasari wa salio la akaunti', 'Hitilafu za miamala', 'Maombi ya akaunti mpya'],
    customer: ['Tiketi za usaidizi zilizo wazi', 'Masuala yaliyopandishwa leo', 'Muhtasari wa hisia za wateja', 'Malalamiko yasiyotatuliwa', 'Ripoti ya muda wa kujibu', 'Kategoria kuu za malalamiko'],
  },
};
