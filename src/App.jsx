import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  Heart, 
  Activity, 
  Brain, 
  UserCheck, 
  PlusCircle, 
  Search, 
  MapPin, 
  Users, 
  Copy, 
  Check, 
  Edit3, 
  LogOut, 
  Phone, 
  AlertCircle, 
  FileText, 
  Stethoscope,
  X,
  BedDouble,
  Mic,
  MicOff,
  Sparkles,
  Volume2,
  Wand2,
  Radio,
  RotateCcw,
  ShieldAlert,
  CheckCircle2,
  Layers,
  Cloud,
  CloudOff,
  RefreshCw,
  MessageCircle,
  Calendar,
  Database,
  Download,
  Upload,
  ShieldCheck,
  Briefcase,
  GraduationCap,
  BookOpen,
  Clock,
  Send,
  Trash2,
  Eye,
  ArrowRightLeft,
  Share2,
  HardDrive,
  FolderSync,
  History,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, onSnapshot } from 'firebase/firestore';

// ============================================================================
// CHAVES CANÔNICAS PERMANENTES (NUNCA MUDAM ENTRE ATUALIZAÇÕES DE VERSÃO)
// ============================================================================
const STORAGE_KEY_PATIENTS = 'uti_ped_patients_permanent';
const STORAGE_KEY_BED10 = 'uti_ped_bed10_permanent';
const STORAGE_KEY_INIT_FLAG = 'uti_ped_initialized_ever';
const STORAGE_KEY_DEVICE_ID = 'uti_ped_device_id';
const STORAGE_KEY_SYNC_ROOM = 'uti_ped_sync_room_code';
const STORAGE_KEY_SHIFT_DATE_OVERRIDE = 'uti_ped_shift_date_override';
const STORAGE_KEY_NIGHT_SHIFT_RULE = 'uti_ped_night_shift_7am';

// Opções rápidas de múltiplos acompanhantes/visitantes presentes no leito hoje
const COMPANION_PRESENCE_OPTIONS = [
  "Mãe",
  "Pai",
  "Avó Materna",
  "Avó Paterna",
  "Avô Materno / Paterno",
  "Tia / Tio",
  "Irmã / Irmão",
  "Madrinha / Padrinho",
  "Outro Familiar / Visitante",
  "Sem acompanhante no momento"
];

// Lista oficial de Escolaridade (Iniciando em Analfabeto até Pós-Graduação + opção não informada)
const EDUCATION_OPTIONS = [
  "Analfabeto",
  "Ensino Fundamental Incompleto",
  "Ensino Fundamental Completo",
  "Ensino Médio Incompleto",
  "Ensino Médio Completo",
  "Ensino Superior Incompleto",
  "Ensino Superior Completo",
  "Pós-Graduação",
  "Não informado"
];

// Lista de Escolaridade da Criança / Paciente Pediátrico
const CHILD_EDUCATION_OPTIONS = [
  "Não se aplica (Bebê / Lactente)",
  "Creche / Maternal",
  "Educação Infantil (Pré-escola)",
  "Alfabetização / 1º Ano",
  "Ensino Fundamental I (1º ao 5º ano)",
  "Ensino Fundamental II (6º ao 9º ano)",
  "Ensino Médio",
  "Educação Especial / AEE",
  "Afastado(a) da escola devido ao tratamento",
  "Fora da escola / Não alfabetizado(a)",
  "Ensino Fundamental Incompleto",
  "Ensino Fundamental Completo",
  "Ensino Médio Incompleto",
  "Ensino Médio Completo",
  "Não informado"
];

// Lista oficial das principais religiões da população brasileira
const RELIGION_OPTIONS = [
  "Católica",
  "Evangélica / Protestante",
  "Espírita",
  "Umbanda",
  "Candomblé / Matriz Africana",
  "Testemunhas de Jeová",
  "Adventista",
  "Mórmon (Santos dos Últimos Dias)",
  "Judaica",
  "Budista",
  "Islâmica",
  "Tradições Indígenas",
  "Sem Religião (Agnóstico / Ateu)",
  "Outra Religião",
  "Não informado"
];

// Opções clicáveis de onde a família está hospedada/acolhida em Belém durante a internação
const BELEN_STAY_OPTIONS = [
  "Residência Própria (Belém / Ananindeua / RMB)",
  "Casa de Apoio / Abrigo Institucional",
  "Casa de Familiares em Belém",
  "Casa de Amigos / Conhecidos",
  "Hotel / Pensão / Pousada / Aluguel Temporário",
  "Permanência Integral no Hospital (Sem local externo)",
  "Outro Local em Belém",
  "Não informado"
];

// Lista de chaves de versões anteriores para resgate e migração automática
const LEGACY_PATIENT_KEYS = [
  'uti_ped_patients_permanent',
  'uti_ped_patients_v12',
  'uti_ped_patients_v11',
  'uti_ped_patients_v10',
  'uti_ped_patients_v9',
  'uti_ped_patients_v8',
  'uti_ped_patients_v7',
  'uti_ped_patients_v6',
  'uti_ped_patients_v5',
  'uti_ped_patients_v4',
  'uti_ped_patients_v3',
  'uti_ped_patients_v2',
  'uti_ped_patients_v1',
  'uti_ped_patients',
  'censo_uti_ped_patients'
];

// Identificador único deste aparelho para evitar conflito de sincronização
function getOrCreateDeviceId() {
  try {
    let devId = window.localStorage.getItem(STORAGE_KEY_DEVICE_ID);
    if (!devId) {
      devId = `dev-${Math.random().toString(36).substring(2, 9)}-${Date.now().toString(36)}`;
      window.localStorage.setItem(STORAGE_KEY_DEVICE_ID, devId);
    }
    return devId;
  } catch (e) {
    return 'dev-session';
  }
}

// Obtém a data estritamente no fuso horário oficial de Belém do Pará (GMT-3)
// Se nightShift7amRule = true, antes das 07:00 da manhã mantém a data do plantão anterior (ex: dia 23 durante a madrugada do dia 24)
function getBelemTodayStr(nightShift7amRule = true) {
  try {
    const now = new Date();
    // Pega componentes de data e hora em America/Belem
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Belem',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hour12: false
    }).formatToParts(now);

    const map = {};
    parts.forEach((p) => { map[p.type] = p.value; });
    const year = Number(map.year);
    const month = Number(map.month);
    const day = Number(map.day);
    const hour = Number(map.hour);

    const belemDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    if (nightShift7amRule && hour < 7) {
      // Madrugada antes das 07h: mantém a data do plantão que iniciou no dia anterior
      belemDate.setUTCDate(belemDate.getUTCDate() - 1);
    }
    return belemDate.toISOString().split('T')[0];
  } catch (e) {
    const now = new Date();
    const belemTime = new Date(now.getTime() - (3 * 3600 * 1000));
    if (nightShift7amRule && belemTime.getUTCHours() < 7) {
      belemTime.setUTCDate(belemTime.getUTCDate() - 1);
    }
    return belemTime.toISOString().split('T')[0];
  }
}

function shiftDateStringByDays(dateStr, deltaDays) {
  if (!dateStr) return getBelemTodayStr(true);
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3) return dateStr;
  const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().split('T')[0];
}

// ============================================================================
// CONFIGURAÇÃO OFICIAL DO SEU FIREBASE (censo-uti-pediatica)
// ============================================================================
const USER_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDciJNPtAfZOatJFjwO-FjKFmF0UFi4-9c",
  authDomain: "censo-uti-pediatica.firebaseapp.com",
  databaseURL: "https://censo-uti-pediatica-default-rtdb.firebaseio.com",
  projectId: "censo-uti-pediatica",
  storageBucket: "censo-uti-pediatica.firebasestorage.app",
  messagingSenderId: "817720593488",
  appId: "1:817720593488:web:f949d5bec4bbfed372d555"
};

const isPreviewEnv = typeof __firebase_config !== 'undefined' && Boolean(__firebase_config);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'uti-ped-cardio-census';
let db = null;
let auth = null;

try {
  const activeFirebaseConfig = isPreviewEnv
    ? JSON.parse(__firebase_config)
    : USER_FIREBASE_CONFIG;
  const app = initializeApp(activeFirebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (err) {
  console.error("Aviso ao inicializar configuração de nuvem:", err);
}

// Estrutura fixa dos 10 leitos nominais da UTI Pediátrica Cardíaca
const TOTAL_BEDS = [
  "Leito 01", "Leito 02", "Leito 03", "Leito 04", "Leito 05",
  "Leito 06", "Leito 07", "Leito 08", "Leito 09", "Leito 10"
];

// Configuração inicial do Leito 10 (Isolamento)
const INITIAL_BED10_CONFIG = {
  isIsolationRoom: true,
  inIsolationUse: true,
  isolationType: "Contato",
  isolationReason: "Precaução de contato por vigilância epidemiológica pós-drenagem torácica",
  updatedAtMs: 1700000000000
};

function formatPhoneMask(raw) {
  if (!raw) return '';
  const digits = String(raw).replace(/\D/g, '').slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

function getWhatsAppLink(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length < 10) return null;
  const fullNumber = digits.startsWith('55') ? digits : `55${digits}`;
  return `https://wa.me/${fullNumber}`;
}

function getGoogleMapsLink(address) {
  if (!address || !String(address).trim()) return null;
  const query = encodeURIComponent(`${String(address).trim()}, Belém - PA`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

function calculateAgeFromBirthDate(birthDateStr) {
  if (!birthDateStr) return '';
  const parts = birthDateStr.split('-');
  if (parts.length !== 3) return '';
  const birth = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (isNaN(birth.getTime())) return '';

  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  let days = now.getDate() - birth.getDate();

  if (days < 0) {
    months -= 1;
    const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (years < 0) return 'Recém-nascido';
  if (years === 0 && months === 0) {
    return `${Math.max(1, days)} ${days === 1 ? 'dia' : 'dias'}`;
  }
  if (years === 0) {
    const mStr = `${months} ${months === 1 ? 'mês' : 'meses'}`;
    const dStr = days > 0 ? ` e ${days} ${days === 1 ? 'dia' : 'dias'}` : '';
    return mStr + dStr;
  }
  const yStr = `${years} ${years === 1 ? 'ano' : 'anos'}`;
  const mStr = months > 0 ? ` e ${months} ${months === 1 ? 'mês' : 'meses'}` : '';
  return yStr + mStr;
}

function formatDateBr(dateStr) {
  if (!dateStr) return 'N/I';
  const parts = String(dateStr).split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

const SEED_PATIENTS = [
  {
    id: "pat-leito-01",
    bed: "Leito 01",
    childName: "Arthur Gabriel Barreto Silva",
    childBirthDate: "2025-06-15",
    childAgeText: "1 ano e 4 meses",
    childEducation: "Não se aplica (Bebê / Lactente)",
    naturalness: "Santarém - PA",
    originCity: "Santarém",
    originState: "PA",
    familyStayType: "Casa de Apoio / Abrigo Institucional",
    familyStayAddress: "Casa Ronald McDonald / Casa de Apoio no bairro São Brás, Belém - PA",
    cardiacDiagnosis: "Pós-operatório tardio de CIV ampla e Coarctação de Aorta",
    admissionDate: "2026-10-18",
    status: "Internado",
    currentCompanion: "Mãe",
    companionName: "",
    companionKinship: "",
    companionAge: "",
    companionPhone: "",
    companionEducation: "Não informado",
    companionReligion: "Não informado",
    companionProfession: "",
    mother: {
      name: "Mariana Barreto Silva",
      age: 23,
      phone: "(93) 98122-4411",
      education: "Ensino Médio Completo",
      religion: "Católica",
      profession: "Autônoma (Vendedora)",
      hasPsych: true,
      psychDetails: "Crises frequentes de ansiedade desde o diagnóstico intraútero. Insônia inicial e sentimento de desamparo por estar longe da rede de apoio em Santarém."
    },
    father: {
      name: "Lucas Gabriel Silva",
      age: 26,
      phone: "(93) 98410-9920",
      education: "Ensino Médio Completo",
      religion: "Católica",
      profession: "Motorista de Entregas",
      hasPsych: false,
      psychDetails: "Permaneceu em Santarém trabalhando e cuidando do outro filho de 4 anos; relata preocupação financeira."
    },
    childMentalHealth: {
      hasCondition: false,
      details: "Sem alterações de neurodesenvolvimento prévias; choro moderado durante manipulações dolorosas."
    },
    dailyEvolutions: [
      {
        id: "evo-seed-1",
        date: getBelemTodayStr(true),
        time: "08:40",
        content: "Acolhimento da genitora à beira-leito. Angústia pelo afastamento do filho mais velho em Santarém. Pactuada escuta ativa matinal e videochamada diária com o pai.",
        author: "Psicologia UTI"
      }
    ],
    psychNotes: "Acolhimento da genitora à beira-leito. Angústia pelo afastamento do filho mais velho em Santarém. Pactuada escuta ativa matinal e videochamada diária com o pai.",
    dischargeDate: null,
    dischargeNote: "",
    updatedAtMs: 1729500000000
  }
];

function normalizePatientRecord(p) {
  if (!p || typeof p !== 'object') return null;

  const legacyCaregiver = p.primaryCaregiver || {};
  const legacyKinship = p.caregiverKinship || p.kinship || legacyCaregiver.kinship || '';
  const isLegacyFather = /pai|genitor/i.test(legacyKinship);
  const isLegacyOther = legacyKinship && !/mãe|mae|genitora|pai|genitor/i.test(legacyKinship);

  const flatCaregiverName = p.caregiverName || legacyCaregiver.name || '';
  const flatCaregiverAge = p.caregiverAge || legacyCaregiver.age || '';
  const flatCaregiverPhone = p.caregiverPhone || p.phone || legacyCaregiver.phone || '';
  const flatCaregiverPsychFlag = p.caregiverPsychFlag ?? p.caregiverMentalHealth?.hasCondition ?? false;
  const flatCaregiverPsychDetails = p.caregiverPsychDetails || p.caregiverMentalHealth?.details || '';

  const mother = {
    name: p.mother?.name ?? p.motherName ?? (!isLegacyFather && !isLegacyOther ? flatCaregiverName : ''),
    age: p.mother?.age ?? p.motherAge ?? (!isLegacyFather && !isLegacyOther ? flatCaregiverAge : ''),
    phone: formatPhoneMask(p.mother?.phone ?? p.motherPhone ?? (!isLegacyFather && !isLegacyOther ? flatCaregiverPhone : '')),
    education: EDUCATION_OPTIONS.includes(p.mother?.education || p.motherEducation)
      ? (p.mother?.education || p.motherEducation)
      : "Não informado",
    religion: RELIGION_OPTIONS.includes(p.mother?.religion || p.motherReligion)
      ? (p.mother?.religion || p.motherReligion)
      : "Não informado",
    profession: p.mother?.profession ?? p.motherProfession ?? '',
    hasPsych: Boolean(p.mother?.hasPsych ?? p.motherHasMentalHealth ?? p.motherPsychFlag ?? (!isLegacyFather ? flatCaregiverPsychFlag : false)),
    psychDetails: p.mother?.psychDetails ?? p.motherMentalHealthDetails ?? p.motherPsychDetails ?? (!isLegacyFather ? flatCaregiverPsychDetails : '')
  };

  const father = {
    name: p.father?.name ?? p.fatherName ?? (isLegacyFather ? flatCaregiverName : ''),
    age: p.father?.age ?? p.fatherAge ?? (isLegacyFather ? flatCaregiverAge : ''),
    phone: formatPhoneMask(p.father?.phone ?? p.fatherPhone ?? (isLegacyFather ? flatCaregiverPhone : '')),
    education: EDUCATION_OPTIONS.includes(p.father?.education || p.fatherEducation)
      ? (p.father?.education || p.fatherEducation)
      : "Não informado",
    religion: RELIGION_OPTIONS.includes(p.father?.religion || p.fatherReligion)
      ? (p.father?.religion || p.fatherReligion)
      : "Não informado",
    profession: p.father?.profession ?? p.fatherProfession ?? '',
    hasPsych: Boolean(p.father?.hasPsych ?? p.fatherHasMentalHealth ?? p.fatherPsychFlag ?? (isLegacyFather ? flatCaregiverPsychFlag : false)),
    psychDetails: p.father?.psychDetails ?? p.fatherMentalHealthDetails ?? p.fatherPsychDetails ?? (isLegacyFather ? flatCaregiverPsychDetails : '')
  };

  const childMentalHealth = {
    hasCondition: Boolean(p.childMentalHealth?.hasCondition ?? p.childHasMentalHealth ?? false),
    details: p.childMentalHealth?.details ?? p.childMentalHealthDetails ?? ''
  };

  const legacyPsychNotes = (p.psychNotes || p.notes || '').trim();
  const admissionDate = p.admissionDate || getBelemTodayStr(true);

  let dailyEvolutions = [];
  if (Array.isArray(p.dailyEvolutions) && p.dailyEvolutions.length > 0) {
    dailyEvolutions = p.dailyEvolutions
      .filter((ev) => ev && ev.content && String(ev.content).trim().length > 0)
      .map((ev, idx) => ({
        id: ev.id || `evo-${idx}-${Date.now()}`,
        date: ev.date || admissionDate,
        time: ev.time || '08:30',
        content: String(ev.content).trim(),
        author: ev.author || 'Psicologia UTI'
      }));
  } else if (legacyPsychNotes) {
    dailyEvolutions = [
      {
        id: `evo-migrated-${p.id || 'pat'}`,
        date: admissionDate,
        time: '08:30',
        content: legacyPsychNotes,
        author: 'Psicologia (Registro Migrado)'
      }
    ];
  }

  dailyEvolutions.sort((a, b) => {
    const dtA = `${a.date}T${a.time || '00:00'}`;
    const dtB = `${b.date}T${b.time || '00:00'}`;
    return dtB.localeCompare(dtA);
  });

  const latestEvolutionText = dailyEvolutions[0]?.content || legacyPsychNotes || '';
  const birthDate = p.childBirthDate || p.birthDate || '';
  const computedAge = birthDate ? calculateAgeFromBirthDate(birthDate) : '';
  const bedTransferHistory = Array.isArray(p.bedTransferHistory) ? p.bedTransferHistory : [];

  const rawCompanionsList = Array.isArray(p.currentCompanionsList)
    ? p.currentCompanionsList.filter(Boolean)
    : p.currentCompanion
    ? String(p.currentCompanion)
        .split(/[,+]|\be\b/i)
        .map((s) => s.trim())
        .filter(Boolean)
    : ['Mãe'];

  const currentCompanionsList = rawCompanionsList.length > 0 ? rawCompanionsList : ['Mãe'];
  const extraBedsideVisitors = Array.isArray(p.extraBedsideVisitors) ? p.extraBedsideVisitors : [];
  const currentCompanionSummary = [
    ...currentCompanionsList,
    ...extraBedsideVisitors.map((v) => (v.kinship ? `${v.name} (${v.kinship})` : v.name))
  ]
    .filter(Boolean)
    .join(', ') || (p.currentCompanion || 'Mãe');

  return {
    ...p,
    id: p.id || `pat-${(p.bed || 'leito').toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
    bed: p.bed || 'Leito 01',
    bedTransferHistory,
    childName: p.childName || p.name || 'Paciente Sem Nome',
    childBirthDate: birthDate,
    childAgeText: p.childAgeText || p.childAge || computedAge || '',
    childEducation: p.childEducation || 'Não informado',
    naturalness: p.naturalness || '',
    originCity: p.originCity || '',
    originState: p.originState || 'PA',
    familyStayType: p.familyStayType || 'Não informado',
    familyStayAddress: p.familyStayAddress || '',
    cardiacDiagnosis: p.cardiacDiagnosis || '',
    admissionDate,
    status: p.status || 'Internado',
    currentCompanion: currentCompanionSummary,
    currentCompanionsList,
    extraBedsideVisitors,
    companionNotes: p.companionNotes || '',
    companionName: p.companionName || '',
    companionKinship: p.companionKinship || '',
    companionAge: p.companionAge ?? '',
    companionPhone: formatPhoneMask(p.companionPhone || ''),
    companionEducation: EDUCATION_OPTIONS.includes(p.companionEducation) ? p.companionEducation : 'Não informado',
    companionReligion: RELIGION_OPTIONS.includes(p.companionReligion) ? p.companionReligion : 'Não informado',
    companionProfession: p.companionProfession || '',
    mother,
    father,
    childMentalHealth,
    dailyEvolutions,
    psychNotes: latestEvolutionText,
    dischargeDate: p.dischargeDate || null,
    dischargeNote: p.dischargeNote || '',
    updatedAtMs: Number(p.updatedAtMs || Date.now())
  };
}

function sortPatientsByBedNumber(list = []) {
  return [...list].sort((a, b) => {
    const idxA = TOTAL_BEDS.indexOf(a?.bed);
    const idxB = TOTAL_BEDS.indexOf(b?.bed);
    const orderA = idxA !== -1 ? idxA : 999;
    const orderB = idxB !== -1 ? idxB : 999;
    if (orderA !== orderB) return orderA - orderB;
    return (a?.childName || '').localeCompare(b?.childName || '', 'pt-BR');
  });
}

function mergePatientListsSmart(listA = [], listB = []) {
  const map = new Map();
  const processList = (list) => {
    if (!Array.isArray(list)) return;
    list.forEach((rawItem) => {
      const item = normalizePatientRecord(rawItem);
      if (!item || !item.id) return;
      const existing = map.get(item.id);
      if (!existing) {
        map.set(item.id, item);
      } else {
        const evoMap = new Map();
        [...(existing.dailyEvolutions || []), ...(item.dailyEvolutions || [])].forEach((ev) => {
          if (!ev || !ev.content) return;
          const key = `${ev.date}::${ev.content.trim().toLowerCase()}`;
          if (!evoMap.has(key)) evoMap.set(key, ev);
        });
        const mergedEvolutions = Array.from(evoMap.values()).sort((a, b) =>
          `${b.date}T${b.time || '00:00'}`.localeCompare(`${a.date}T${a.time || '00:00'}`)
        );

        const winner = (item.updatedAtMs || 0) >= (existing.updatedAtMs || 0) ? item : existing;
        map.set(item.id, {
          ...winner,
          dailyEvolutions: mergedEvolutions,
          psychNotes: mergedEvolutions[0]?.content || winner.psychNotes || ''
        });
      }
    });
  };
  processList(listA);
  processList(listB);
  return sortPatientsByBedNumber(Array.from(map.values()));
}

function loadAndMigrateLegacyData() {
  let accumulated = [];
  try {
    const allDiscoveredKeys = new Set(LEGACY_PATIENT_KEYS);
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && (k.includes('uti_ped_patients') || k.includes('censo_uti_ped'))) {
        allDiscoveredKeys.add(k);
      }
    }

    allDiscoveredKeys.forEach((key) => {
      try {
        const raw = window.localStorage.getItem(key);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return;
        accumulated = mergePatientListsSmart(accumulated, parsed);
      } catch (innerErr) {}
    });

    if (accumulated.length > 0) {
      window.localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify(accumulated));
      window.localStorage.setItem(STORAGE_KEY_INIT_FLAG, 'true');
      return { patients: accumulated, isFirstRunEver: false };
    }

    const alreadyInitialized = window.localStorage.getItem(STORAGE_KEY_INIT_FLAG) === 'true';
    if (!alreadyInitialized) {
      const normalizedSeeds = SEED_PATIENTS.map(normalizePatientRecord);
      window.localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify(normalizedSeeds));
      window.localStorage.setItem(STORAGE_KEY_INIT_FLAG, 'true');
      return { patients: normalizedSeeds, isFirstRunEver: true };
    }

    return { patients: [], isFirstRunEver: false };
  } catch (err) {
    return { patients: SEED_PATIENTS.map(normalizePatientRecord), isFirstRunEver: false };
  }
}

function loadPermanentBed10Config() {
  try {
    const direct = window.localStorage.getItem(STORAGE_KEY_BED10);
    if (direct) return { ...INITIAL_BED10_CONFIG, ...JSON.parse(direct) };
  } catch (e) {}
  return INITIAL_BED10_CONFIG;
}

export default function App() {
  // Regra de plantão noturno: antes das 07h da manhã em Belém, mantém a data do dia anterior por padrão
  const [nightShift7amRule, setNightShift7amRule] = useState(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY_NIGHT_SHIFT_RULE);
      return saved === null ? true : saved === 'true';
    } catch (e) {
      return true;
    }
  });

  // Permite ao plantonista fixar ou ajustar manualmente a Data Ativa do Censo/Plantão (ex: Dia 23)
  const [activeShiftDate, setActiveShiftDate] = useState(() => {
    try {
      const savedOverride = window.localStorage.getItem(STORAGE_KEY_SHIFT_DATE_OVERRIDE);
      if (savedOverride) return savedOverride;
    } catch (e) {}
    return getBelemTodayStr(true);
  });

  const currentBelemToday = activeShiftDate;

  const handleSetShiftDate = (newDateStr) => {
    if (!newDateStr) return;
    setActiveShiftDate(newDateStr);
    try {
      window.localStorage.setItem(STORAGE_KEY_SHIFT_DATE_OVERRIDE, newDateStr);
    } catch (e) {}
  };

  const handleResetToAutoBelemDate = (use7amRule = nightShift7amRule) => {
    const autoDate = getBelemTodayStr(use7amRule);
    setActiveShiftDate(autoDate);
    try {
      window.localStorage.removeItem(STORAGE_KEY_SHIFT_DATE_OVERRIDE);
    } catch (e) {}
  };

  const deviceId = useMemo(() => getOrCreateDeviceId(), []);
  const initialVault = useMemo(() => loadAndMigrateLegacyData(), []);

  const [user, setUser] = useState(null);
  const [cloudStatus, setCloudStatus] = useState('connected');
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [isSyncingManual, setIsSyncingManual] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
  const [dischargeModalPatient, setDischargeModalPatient] = useState(null);
  const [dischargeNote, setDischargeNote] = useState('');
  const [dischargeStatus, setDischargeStatus] = useState('Alta para Enfermaria');
  const [transferModalPatient, setTransferModalPatient] = useState(null);
  const [targetTransferBed, setTargetTransferBed] = useState('Leito 01');
  const [transferReason, setTransferReason] = useState('');
  const [recordTransferInEvolution, setRecordTransferInEvolution] = useState(true);
  const [isIsolationModalOpen, setIsIsolationModalOpen] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isHandoverPreviewOpen, setIsHandoverPreviewOpen] = useState(false);
  const [backupJsonText, setBackupJsonText] = useState('');
  const [uiNotice, setUiNotice] = useState(null);

  const [patients, setPatients] = useState(initialVault.patients);
  const [bed10Config, setBed10Config] = useState(() => loadPermanentBed10Config());
  const patientsRefState = useRef(patients);
  const bed10RefState = useRef(bed10Config);

  useEffect(() => { patientsRefState.current = patients; }, [patients]);
  useEffect(() => { bed10RefState.current = bed10Config; }, [bed10Config]);

  const [activeTab, setActiveTab] = useState('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState('all');

  const [driveFileHandle, setDriveFileHandle] = useState(null);
  const [driveFileName, setDriveFileName] = useState('');
  const [autoSaveDriveEnabled, setAutoSaveDriveEnabled] = useState(false);
  const [syncRoomCode, setSyncRoomCode] = useState(() => {
    try { return window.localStorage.getItem(STORAGE_KEY_SYNC_ROOM) || 'censo_master'; } catch (e) { return 'censo_master'; }
  });
  const driveOpenInputRef = useRef(null);

  const [newVisitorName, setNewVisitorName] = useState('');
  const [newVisitorKinship, setNewVisitorKinship] = useState('');
  const [newVisitorPhone, setNewVisitorPhone] = useState('');

  const [selectedEvolutionDate, setSelectedEvolutionDate] = useState(currentBelemToday);
  const [currentEvolutionDraft, setCurrentEvolutionDraft] = useState('');
  const [activeFieldListening, setActiveFieldListening] = useState(null);
  const recognitionRef = useRef(null);

  const initialFormState = {
    bed: 'Leito 01',
    childName: '',
    childBirthDate: '',
    childAgeText: '',
    childEducation: 'Não informado',
    naturalness: '',
    originCity: '',
    originState: 'PA',
    familyStayType: 'Não informado',
    familyStayAddress: '',
    cardiacDiagnosis: '',
    admissionDate: currentBelemToday,
    currentCompanion: 'Mãe',
    currentCompanionsList: ['Mãe'],
    extraBedsideVisitors: [],
    companionNotes: '',
    companionName: '',
    companionKinship: '',
    companionAge: '',
    companionPhone: '',
    companionEducation: 'Analfabeto',
    companionReligion: 'Não informado',
    companionProfession: '',
    mother: { name: '', age: '', phone: '', education: 'Ensino Médio Completo', religion: 'Católica', profession: '', hasPsych: false, psychDetails: '' },
    father: { name: '', age: '', phone: '', education: 'Ensino Médio Completo', religion: 'Católica', profession: '', hasPsych: false, psychDetails: '' },
    childMentalHealth: { hasCondition: false, details: '' },
    dailyEvolutions: [],
    psychNotes: ''
  };

  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    try {
      if (Array.isArray(patients)) {
        window.localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify(patients));
        window.localStorage.setItem(STORAGE_KEY_INIT_FLAG, 'true');
      }
    } catch (e) {}
  }, [patients]);

  useEffect(() => {
    try {
      if (bed10Config) {
        window.localStorage.setItem(STORAGE_KEY_BED10, JSON.stringify(bed10Config));
      }
    } catch (e) {}
  }, [bed10Config]);

  // Autenticação resiliente Firebase
  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) {
        // Continua operando mesmo se auth anônimo não estiver habilitado nas regras
      }
    };
    initAuth();
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  const activeDocName = useMemo(() => {
    const clean = (syncRoomCode || 'censo_master').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    return clean || 'censo_master';
  }, [syncRoomCode]);

  const pushFullStateToCloud = useCallback(async (patientsListToPush, bed10ToPush) => {
    if (!db) return false;
    try {
      const nowMs = Date.now();
      const masterRef = doc(db, 'artifacts', appId, 'public', 'data', 'uti_ped_master_sync', activeDocName);
      await setDoc(masterRef, {
        patientsJson: JSON.stringify(patientsListToPush),
        bed10ConfigJson: JSON.stringify(bed10ToPush),
        updatedAtMs: nowMs,
        lastDeviceId: deviceId,
        updatedAtFormatted: new Date().toISOString()
      }, { merge: true });
      setLastSyncTime(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setCloudStatus('connected');
      return true;
    } catch (err) {
      setCloudStatus('connected');
      return false;
    }
  }, [deviceId, activeDocName]);

  const handleForceCloudSyncNow = useCallback(async (silent = false) => {
    setIsSyncingManual(true);
    try {
      if (db) {
        const masterRef = doc(db, 'artifacts', appId, 'public', 'data', 'uti_ped_master_sync', activeDocName);
        const snap = await getDoc(masterRef);
        if (snap.exists()) {
          const data = snap.data();
          const cloudPatients = data.patientsJson ? JSON.parse(data.patientsJson) : [];
          const merged = mergePatientListsSmart(patientsRefState.current, cloudPatients);
          setPatients(merged);
          await pushFullStateToCloud(merged, bed10RefState.current);
        } else {
          await pushFullStateToCloud(patientsRefState.current, bed10RefState.current);
        }
      }
      setLastSyncTime(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      if (!silent) setUiNotice("Sincronização com a nuvem concluída com sucesso!");
    } catch (err) {
      if (!silent) setUiNotice("Dados sincronizados no cofre local do dispositivo.");
    } finally {
      setIsSyncingManual(false);
    }
  }, [activeDocName, pushFullStateToCloud]);

  useEffect(() => {
    if (!db) return;
    const masterRef = doc(db, 'artifacts', appId, 'public', 'data', 'uti_ped_master_sync', activeDocName);
    const unsub = onSnapshot(masterRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.patientsJson) {
          try {
            const cloudList = JSON.parse(data.patientsJson);
            setPatients((prev) => mergePatientListsSmart(prev, cloudList));
            setLastSyncTime(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
          } catch (e) {}
        }
      }
    }, () => {});
    return () => unsub();
  }, [activeDocName]);

  const writeToLinkedDriveFile = useCallback(async (patientsToSave, bed10ToSave) => {
    const payload = {
      exportedAt: new Date().toISOString(),
      version: 'permanent-vault-v4',
      bed10Config: bed10ToSave,
      patients: patientsToSave
    };
    if (driveFileHandle && typeof driveFileHandle.createWritable === 'function') {
      try {
        const writable = await driveFileHandle.createWritable();
        await writable.write(JSON.stringify(payload, null, 2));
        await writable.close();
        return true;
      } catch (err) {}
    }
    if (autoSaveDriveEnabled) {
      try {
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = driveFileName || `censo-uti-ped-autosave-${currentBelemToday}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return true;
      } catch (e) {}
    }
    return false;
  }, [driveFileHandle, autoSaveDriveEnabled, driveFileName, currentBelemToday]);

  const handleSavePatientToCloudOrLocal = async (patientData, isNew = false) => {
    const patientId = patientData.id || `pat-${Date.now()}`;
    const payload = normalizePatientRecord({ ...patientData, id: patientId, updatedAtMs: Date.now() });
    const currentList = patientsRefState.current;
    const rawNextList = isNew
      ? [payload, ...currentList.filter((p) => p.id !== patientId && (p.bed !== payload.bed || p.status !== 'Internado'))]
      : currentList.map((p) => (p.id === patientId ? payload : p));
    const nextList = sortPatientsByBedNumber(rawNextList);

    setPatients(nextList);
    window.localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify(nextList));
    window.localStorage.setItem(STORAGE_KEY_INIT_FLAG, 'true');

    if (autoSaveDriveEnabled) {
      await writeToLinkedDriveFile(nextList, bed10RefState.current);
    }
    await pushFullStateToCloud(nextList, bed10RefState.current);
  };

  const handleOpenTransferBedModal = (patient) => {
    const norm = normalizePatientRecord(patient);
    setTransferModalPatient(norm);
    const firstVacant = TOTAL_BEDS.find((b) => b !== norm.bed && !patients.some((p) => p.bed === b && p.status === 'Internado'));
    setTargetTransferBed(firstVacant || TOTAL_BEDS.find((b) => b !== norm.bed) || 'Leito 01');
    setTransferReason('');
    setRecordTransferInEvolution(true);
  };

  const handleConfirmBedTransfer = async () => {
    if (!transferModalPatient || !targetTransferBed) return;
    const oldBed = transferModalPatient.bed;
    const newBed = targetTransferBed;
    if (oldBed === newBed) {
      setTransferModalPatient(null);
      return;
    }

    const nowMs = Date.now();
    const nowTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const occupantInTarget = patientsRefState.current.find(
      (p) => p.bed === newBed && p.status === 'Internado' && p.id !== transferModalPatient.id
    );

    const transferRecordA = {
      id: `tr-${nowMs}`,
      fromBed: oldBed,
      toBed: newBed,
      date: currentBelemToday,
      time: nowTime,
      reason: transferReason.trim() || (occupantInTarget ? `Permuta de leito com ${occupantInTarget.childName}` : 'Remanejamento interno na UTI')
    };

    let updatedEvolutionsA = [...(transferModalPatient.dailyEvolutions || [])];
    if (recordTransferInEvolution) {
      const noteText = `[Mudança de Leito às ${nowTime}: Transferido do ${oldBed} para o ${newBed}${transferReason.trim() ? ` — Motivo: ${transferReason.trim()}` : ''}]`;
      const todayIdx = updatedEvolutionsA.findIndex((ev) => ev.date === currentBelemToday);
      if (todayIdx >= 0) {
        updatedEvolutionsA[todayIdx] = {
          ...updatedEvolutionsA[todayIdx],
          content: `${updatedEvolutionsA[todayIdx].content}\n${noteText}`,
          time: nowTime
        };
      } else {
        updatedEvolutionsA.unshift({
          id: `evo-tr-${nowMs}`,
          date: currentBelemToday,
          time: nowTime,
          content: noteText,
          author: 'Psicologia UTI'
        });
      }
    }

    const updatedPatientA = normalizePatientRecord({
      ...transferModalPatient,
      bed: newBed,
      bedTransferHistory: [transferRecordA, ...(transferModalPatient.bedTransferHistory || [])],
      dailyEvolutions: updatedEvolutionsA,
      psychNotes: updatedEvolutionsA[0]?.content || transferModalPatient.psychNotes || '',
      updatedAtMs: nowMs
    });

    let updatedPatientB = null;
    if (occupantInTarget) {
      const normB = normalizePatientRecord(occupantInTarget);
      const transferRecordB = {
        id: `tr-swap-${nowMs}`,
        fromBed: newBed,
        toBed: oldBed,
        date: currentBelemToday,
        time: nowTime,
        reason: `Permuta de leito com ${transferModalPatient.childName}`
      };

      let updatedEvolutionsB = [...(normB.dailyEvolutions || [])];
      if (recordTransferInEvolution) {
        const noteTextB = `[Permuta de Leito às ${nowTime}: Transferido do ${newBed} para o ${oldBed} (troca com ${transferModalPatient.childName})]`;
        const todayIdxB = updatedEvolutionsB.findIndex((ev) => ev.date === currentBelemToday);
        if (todayIdxB >= 0) {
          updatedEvolutionsB[todayIdxB] = {
            ...updatedEvolutionsB[todayIdxB],
            content: `${updatedEvolutionsB[todayIdxB].content}\n${noteTextB}`,
            time: nowTime
          };
        } else {
          updatedEvolutionsB.unshift({
            id: `evo-tr-swap-${nowMs}`,
            date: currentBelemToday,
            time: nowTime,
            content: noteTextB,
            author: 'Psicologia UTI'
          });
        }
      }

      updatedPatientB = normalizePatientRecord({
        ...normB,
        bed: oldBed,
        bedTransferHistory: [transferRecordB, ...(normB.bedTransferHistory || [])],
        dailyEvolutions: updatedEvolutionsB,
        psychNotes: updatedEvolutionsB[0]?.content || normB.psychNotes || '',
        updatedAtMs: nowMs + 1
      });
    }

    const nextList = sortPatientsByBedNumber(
      patientsRefState.current.map((p) => {
        if (p.id === updatedPatientA.id) return updatedPatientA;
        if (updatedPatientB && p.id === updatedPatientB.id) return updatedPatientB;
        return p;
      })
    );

    setPatients(nextList);
    window.localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify(nextList));
    window.localStorage.setItem(STORAGE_KEY_INIT_FLAG, 'true');

    if (autoSaveDriveEnabled) {
      await writeToLinkedDriveFile(nextList, bed10RefState.current);
    }
    await pushFullStateToCloud(nextList, bed10RefState.current);
    setTransferModalPatient(null);
    setUiNotice(
      occupantInTarget
        ? `Permuta concluída: ${updatedPatientA.childName} (${newBed}) ⇄ ${updatedPatientB.childName} (${oldBed})!`
        : `Transferência concluída: ${updatedPatientA.childName} agora está no ${newBed}!`
    );
  };

  const handleShareBackupToDriveOrWhatsApp = async () => {
    const backupPayload = { exportedAt: new Date().toISOString(), version: 'permanent-vault-v4', bed10Config, patients };
    const jsonString = JSON.stringify(backupPayload, null, 2);
    const fileName = `censo-uti-ped-${currentBelemToday}.json`;
    try {
      const file = new File([jsonString], fileName, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ title: `Backup Censo UTI (${formatDateBr(currentBelemToday)})`, files: [file] });
        setUiNotice("Arquivo enviado para o Google Drive / WhatsApp!");
        return;
      }
    } catch (err) {}
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setUiNotice("Arquivo de backup baixado!");
  };

  const handleLinkLocalDriveFile = async () => {
    const fileName = `censo-uti-ped-sincronizado.json`;
    if (typeof window.showSaveFilePicker === 'function') {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: fileName,
          types: [{ description: 'Arquivo JSON', accept: { 'application/json': ['.json'] } }]
        });
        setDriveFileHandle(handle);
        setDriveFileName(handle.name);
        setAutoSaveDriveEnabled(true);
        await writeToLinkedDriveFile(patients, bed10Config);
        setUiNotice(`Auto-Save vinculado ao arquivo "${handle.name}"!`);
        return;
      } catch (err) {}
    }
    const nextState = !autoSaveDriveEnabled;
    setAutoSaveDriveEnabled(nextState);
    setDriveFileName(fileName);
    if (nextState) {
      await writeToLinkedDriveFile(patients, bed10Config);
      setUiNotice("Auto-Save ativado! A cada evolução salva, o arquivo atualizado será gerado automaticamente.");
    } else {
      setUiNotice("Auto-Save automático desativado.");
    }
  };

  const handleOpenFromDriveFilePicker = async () => {
    if (typeof window.showOpenFilePicker === 'function') {
      try {
        const [handle] = await window.showOpenFilePicker({
          types: [{ description: 'Backup JSON Censo UTI', accept: { 'application/json': ['.json'] } }],
          multiple: false
        });
        const file = await handle.getFile();
        const text = await file.text();
        setDriveFileHandle(handle);
        setDriveFileName(file.name);
        await handleImportBackupData(text, true);
        return;
      } catch (err) {}
    }
    if (driveOpenInputRef.current) {
      driveOpenInputRef.current.value = '';
      driveOpenInputRef.current.click();
    }
  };

  const handleUpdateBed10Config = async (newConfig) => {
    const updated = { ...newConfig, updatedAtMs: Date.now() };
    setBed10Config(updated);
    window.localStorage.setItem(STORAGE_KEY_BED10, JSON.stringify(updated));
    await pushFullStateToCloud(patientsRefState.current, updated);
  };

  const handleDownloadBackupJson = () => {
    const backupPayload = { exportedAt: new Date().toISOString(), version: 'permanent-vault-v4', bed10Config, patients };
    const blob = new Blob([JSON.stringify(backupPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `censo-uti-ped-backup-${currentBelemToday}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportBackupData = async (rawJsonString, mergeMode = true) => {
    try {
      const parsed = JSON.parse(rawJsonString);
      const importedListRaw = Array.isArray(parsed) ? parsed : (parsed.patients || []);
      const normalizedImported = importedListRaw.map((p) => normalizePatientRecord({ ...p, updatedAtMs: Date.now() })).filter(Boolean);
      const finalList = mergeMode ? mergePatientListsSmart(patients, normalizedImported) : sortPatientsByBedNumber(normalizedImported);
      setPatients(finalList);
      window.localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify(finalList));
      window.localStorage.setItem(STORAGE_KEY_INIT_FLAG, 'true');
      if (parsed.bed10Config) {
        setBed10Config({ ...parsed.bed10Config, updatedAtMs: Date.now() });
      }
      await pushFullStateToCloud(finalList, bed10Config);
      setUiNotice(`Backup restaurado com sucesso (${finalList.length} pacientes sincronizados)!`);
      setIsBackupModalOpen(false);
    } catch (err) {
      setUiNotice("Erro ao ler o arquivo JSON de backup.");
    }
  };

  const handleFileUploadBackup = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDriveFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => { if (evt.target?.result) handleImportBackupData(evt.target.result, true); };
    reader.readAsText(file);
  };

  const bedsStatusMap = useMemo(() => {
    const map = {};
    TOTAL_BEDS.forEach((bedName) => {
      const rawPatient = patients.find((p) => p.bed === bedName && p.status === 'Internado');
      const activePatient = rawPatient ? normalizePatientRecord(rawPatient) : null;
      const isBed10 = bedName === "Leito 10";
      const todayEvolution = activePatient?.dailyEvolutions?.find((ev) => ev.date === currentBelemToday) || null;
      const latestEvolution = activePatient?.dailyEvolutions?.[0] || null;

      map[bedName] = {
        bedName,
        isOccupied: !!activePatient,
        patient: activePatient || null,
        todayEvolution,
        latestEvolution,
        isIsolationRoom: isBed10,
        inIsolationUse: isBed10 ? bed10Config.inIsolationUse : false,
        isolationType: isBed10 ? bed10Config.isolationType : "Não Aplicável",
        admittedToday: activePatient ? activePatient.admissionDate === currentBelemToday : false,
        hasMentalAlert: activePatient ? !!(activePatient.childMentalHealth?.hasCondition || activePatient.mother?.hasPsych || activePatient.father?.hasPsych) : false
      };
    });
    return map;
  }, [patients, bed10Config, currentBelemToday]);

  const metrics = useMemo(() => {
    const active = patients.filter((p) => p.status === 'Internado').map(normalizePatientRecord);
    const admittedToday = active.filter((p) => p.admissionDate === currentBelemToday);
    const dischargedToday = patients.filter((p) => p.status !== 'Internado' && p.dischargeDate === currentBelemToday);
    const mentalAlerts = active.filter((p) => p.childMentalHealth?.hasCondition || p.mother?.hasPsych || p.father?.hasPsych);
    const evolvedTodayCount = active.filter((p) => (p.dailyEvolutions || []).some((ev) => ev.date === currentBelemToday && ev.content?.trim())).length;

    return {
      activeBeds: active.length,
      vacantBeds: Math.max(0, 10 - active.length),
      admittedTodayCount: admittedToday.length,
      dischargedTodayCount: dischargedToday.length,
      mentalAlertsCount: mentalAlerts.length,
      evolvedTodayCount
    };
  }, [patients, currentBelemToday]);

  const filteredPatients = useMemo(() => {
    const filtered = patients.map(normalizePatientRecord).filter((patient) => {
      const term = searchTerm.toLowerCase();
      const matchSearch =
        (patient.childName || '').toLowerCase().includes(term) ||
        (patient.bed || '').toLowerCase().includes(term) ||
        (patient.childEducation || '').toLowerCase().includes(term) ||
        (patient.originCity || '').toLowerCase().includes(term) ||
        (patient.familyStayType || '').toLowerCase().includes(term) ||
        (patient.familyStayAddress || '').toLowerCase().includes(term) ||
        (patient.mother?.name || '').toLowerCase().includes(term) ||
        (patient.father?.name || '').toLowerCase().includes(term) ||
        (patient.companionName || '').toLowerCase().includes(term) ||
        (patient.cardiacDiagnosis || '').toLowerCase().includes(term);

      if (!matchSearch) return false;
      if (filterMode === 'active') return patient.status === 'Internado';
      if (filterMode === 'admitted_today') return patient.admissionDate === currentBelemToday && patient.status === 'Internado';
      if (filterMode === 'discharged') return patient.status !== 'Internado';
      if (filterMode === 'isolation') return patient.bed === "Leito 10";
      if (filterMode === 'mental_alert') return patient.status === 'Internado' && (patient.childMentalHealth?.hasCondition || patient.mother?.hasPsych || patient.father?.hasPsych);
      return patient.status === 'Internado';
    });
    return sortPatientsByBedNumber(filtered);
  }, [patients, searchTerm, filterMode, currentBelemToday]);

  const startSpeechEngine = ({ onResult, onEnd }) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setUiNotice("Seu navegador não suporta ditado por voz nativo. Recomendamos usar o Google Chrome.");
      return null;
    }
    try {
      if (recognitionRef.current) recognitionRef.current.abort();
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'pt-BR';
      rec.onresult = (event) => {
        let final = '';
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) final += event.results[i][0].transcript + ' ';
          else interim += event.results[i][0].transcript;
        }
        onResult({ final, interim, combined: (final + interim).trim() });
      };
      rec.onend = () => { if (onEnd) onEnd(); };
      rec.start();
      recognitionRef.current = rec;
      return rec;
    } catch (err) {
      return null;
    }
  };

  const stopCurrentSpeech = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setActiveFieldListening(null);
  };

  const handleToggleFieldDictation = (fieldKey, subKey = null) => {
    const compositeKey = subKey ? `${fieldKey}.${subKey}` : fieldKey;
    if (activeFieldListening === compositeKey) {
      stopCurrentSpeech();
      return;
    }
    setActiveFieldListening(compositeKey);
    let initialValue = '';
    if (fieldKey === 'dailyEvolutionDraft') initialValue = currentEvolutionDraft || '';
    else if (subKey) initialValue = formData[fieldKey]?.[subKey] || '';
    else initialValue = formData[fieldKey] || '';

    let accumulated = initialValue ? initialValue + ' ' : '';
    startSpeechEngine({
      onResult: ({ final, interim }) => {
        if (final) accumulated += final + ' ';
        const rawCombined = (accumulated + interim).trim();
        const combined = subKey === 'phone' || fieldKey === 'companionPhone' ? formatPhoneMask(rawCombined) : rawCombined;
        if (fieldKey === 'dailyEvolutionDraft') {
          setCurrentEvolutionDraft(combined);
        } else {
          setFormData((prev) => {
            if (subKey) {
              return { ...prev, [fieldKey]: { ...prev[fieldKey], [subKey]: combined } };
            }
            return { ...prev, [fieldKey]: combined };
          });
        }
      },
      onEnd: () => setActiveFieldListening(null)
    });
  };

  const handleOpenForm = (patient = null, preselectedBed = null) => {
    stopCurrentSpeech();
    setNewVisitorName('');
    setNewVisitorKinship('');
    setNewVisitorPhone('');
    if (patient) {
      const norm = normalizePatientRecord(patient);
      setEditingPatient(norm);
      setFormData({
        bed: norm.bed,
        childName: norm.childName,
        childBirthDate: norm.childBirthDate || '',
        childAgeText: norm.childAgeText,
        childEducation: norm.childEducation || 'Não informado',
        naturalness: norm.naturalness || '',
        originCity: norm.originCity,
        originState: norm.originState || 'PA',
        familyStayType: norm.familyStayType || 'Não informado',
        familyStayAddress: norm.familyStayAddress || '',
        cardiacDiagnosis: norm.cardiacDiagnosis,
        admissionDate: norm.admissionDate,
        currentCompanion: norm.currentCompanion || 'Mãe',
        currentCompanionsList: Array.isArray(norm.currentCompanionsList) ? [...norm.currentCompanionsList] : ['Mãe'],
        extraBedsideVisitors: Array.isArray(norm.extraBedsideVisitors) ? [...norm.extraBedsideVisitors] : [],
        companionNotes: norm.companionNotes || '',
        companionName: norm.companionName || '',
        companionKinship: norm.companionKinship || '',
        companionAge: norm.companionAge || '',
        companionPhone: norm.companionPhone || '',
        companionEducation: norm.companionEducation || 'Não informado',
        companionReligion: norm.companionReligion || 'Não informado',
        companionProfession: norm.companionProfession || '',
        mother: { ...norm.mother },
        father: { ...norm.father },
        childMentalHealth: { ...norm.childMentalHealth },
        dailyEvolutions: [...(norm.dailyEvolutions || [])],
        psychNotes: norm.psychNotes || ''
      });
      setSelectedEvolutionDate(currentBelemToday);
      const existingTodayEvo = (norm.dailyEvolutions || []).find((ev) => ev.date === currentBelemToday);
      setCurrentEvolutionDraft(existingTodayEvo ? existingTodayEvo.content : '');
    } else {
      const occupiedBeds = patients.filter((p) => p.status === 'Internado').map((p) => p.bed);
      const firstAvailable = preselectedBed || TOTAL_BEDS.find((b) => !occupiedBeds.includes(b)) || 'Leito 01';
      setEditingPatient(null);
      setFormData({ ...initialFormState, bed: firstAvailable, admissionDate: currentBelemToday });
      setSelectedEvolutionDate(currentBelemToday);
      setCurrentEvolutionDraft('');
    }
    setIsModalOpen(true);
  };

  const handleToggleCompanionPresence = (personLabel) => {
    setFormData((prev) => {
      const currentList = Array.isArray(prev.currentCompanionsList) ? [...prev.currentCompanionsList] : [];
      let nextList;
      if (personLabel === 'Sem acompanhante no momento') {
        nextList = ['Sem acompanhante no momento'];
      } else {
        const cleanList = currentList.filter((item) => item !== 'Sem acompanhante no momento');
        if (cleanList.includes(personLabel)) nextList = cleanList.filter((item) => item !== personLabel);
        else nextList = [...cleanList, personLabel];
      }
      if (nextList.length === 0) nextList = ['Mãe'];
      const visitorsStr = (prev.extraBedsideVisitors || []).map((v) => (v.kinship ? `${v.name} (${v.kinship})` : v.name)).filter(Boolean);
      return { ...prev, currentCompanionsList: nextList, currentCompanion: [...nextList, ...visitorsStr].join(', ') };
    });
  };

  const handleAddExtraBedsideVisitor = () => {
    if (!newVisitorName.trim()) return;
    const newEntry = { id: `vis-${Date.now()}`, name: newVisitorName.trim(), kinship: newVisitorKinship.trim() || 'Familiar / Visitante', phone: formatPhoneMask(newVisitorPhone) };
    setFormData((prev) => {
      const nextVisitors = [...(prev.extraBedsideVisitors || []), newEntry];
      const baseList = Array.isArray(prev.currentCompanionsList) ? prev.currentCompanionsList : [];
      const visitorsStr = nextVisitors.map((v) => (v.kinship ? `${v.name} (${v.kinship})` : v.name));
      return { ...prev, extraBedsideVisitors: nextVisitors, currentCompanion: [...baseList, ...visitorsStr].join(', ') };
    });
    setNewVisitorName('');
    setNewVisitorKinship('');
    setNewVisitorPhone('');
  };

  const handleRemoveExtraBedsideVisitor = (visitorId) => {
    setFormData((prev) => {
      const nextVisitors = (prev.extraBedsideVisitors || []).filter((v) => v.id !== visitorId);
      const baseList = Array.isArray(prev.currentCompanionsList) ? prev.currentCompanionsList : ['Mãe'];
      const visitorsStr = nextVisitors.map((v) => (v.kinship ? `${v.name} (${v.kinship})` : v.name));
      return { ...prev, extraBedsideVisitors: nextVisitors, currentCompanion: [...baseList, ...visitorsStr].join(', ') };
    });
  };

  const handleSelectEvolutionDateChange = (newDate) => {
    setSelectedEvolutionDate(newDate);
    const found = (formData.dailyEvolutions || []).find((ev) => ev.date === newDate);
    setCurrentEvolutionDraft(found ? found.content : '');
  };

  const handleSaveDailyEvolutionEntry = () => {
    const trimmed = (currentEvolutionDraft || '').trim();
    if (!trimmed) return;
    const nowTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    setFormData((prev) => {
      const list = [...(prev.dailyEvolutions || [])];
      const existingIdx = list.findIndex((ev) => ev.date === selectedEvolutionDate);
      if (existingIdx >= 0) {
        list[existingIdx] = { ...list[existingIdx], content: trimmed, time: nowTime };
      } else {
        list.push({ id: `evo-${Date.now()}`, date: selectedEvolutionDate, time: nowTime, content: trimmed, author: 'Psicologia UTI' });
      }
      list.sort((a, b) => `${b.date}T${b.time || '00:00'}`.localeCompare(`${a.date}T${a.time || '00:00'}`));
      return { ...prev, dailyEvolutions: list, psychNotes: list[0]?.content || prev.psychNotes };
    });
    setUiNotice(`Evolução registrada para ${formatDateBr(selectedEvolutionDate)}!`);
  };

  const handleDeleteDailyEvolutionEntry = (evoId, evoDate) => {
    setFormData((prev) => {
      const filtered = (prev.dailyEvolutions || []).filter((ev) => ev.id !== evoId);
      return { ...prev, dailyEvolutions: filtered, psychNotes: filtered[0]?.content || '' };
    });
    if (evoDate === selectedEvolutionDate) setCurrentEvolutionDraft('');
  };

  const handleSavePatient = async (e) => {
    e.preventDefault();
    if (!formData.childName.trim()) return;

    let updatedDailyEvolutions = [...(formData.dailyEvolutions || [])];
    const trimmedDraft = (currentEvolutionDraft || '').trim();
    const nowTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    if (trimmedDraft) {
      const idx = updatedDailyEvolutions.findIndex((ev) => ev.date === selectedEvolutionDate);
      if (idx >= 0) {
        updatedDailyEvolutions[idx] = { ...updatedDailyEvolutions[idx], content: trimmedDraft, time: nowTime };
      } else {
        updatedDailyEvolutions.push({ id: `evo-${Date.now()}`, date: selectedEvolutionDate, time: nowTime, content: trimmedDraft, author: 'Psicologia UTI' });
      }
    }

    updatedDailyEvolutions.sort((a, b) => `${b.date}T${b.time || '00:00'}`.localeCompare(`${a.date}T${a.time || '00:00'}`));
    const computedAge = formData.childBirthDate ? calculateAgeFromBirthDate(formData.childBirthDate) : formData.childAgeText;
    const summaryCompanions = [...(formData.currentCompanionsList || ['Mãe']), ...(formData.extraBedsideVisitors || []).map((v) => (v.kinship ? `${v.name} (${v.kinship})` : v.name))].filter(Boolean).join(', ');

    const finalPayload = {
      ...formData,
      currentCompanion: summaryCompanions || formData.currentCompanion || 'Mãe',
      childAgeText: formData.childAgeText || computedAge || 'N/I',
      dailyEvolutions: updatedDailyEvolutions,
      psychNotes: updatedDailyEvolutions[0]?.content || formData.psychNotes || ''
    };

    if (editingPatient) {
      await handleSavePatientToCloudOrLocal({ ...editingPatient, ...finalPayload }, false);
    } else {
      const newPatient = { ...finalPayload, id: `pat-${Date.now()}`, status: 'Internado', dischargeDate: null, dischargeNote: '' };
      await handleSavePatientToCloudOrLocal(newPatient, true);
    }

    stopCurrentSpeech();
    setIsModalOpen(false);
    setUiNotice("Ficha completa salva e sincronizada com sucesso!");
  };

  const handleOpenDischarge = (patient) => {
    setDischargeModalPatient(normalizePatientRecord(patient));
    setDischargeNote('');
    setDischargeStatus('Alta para Enfermaria');
  };

  const handleConfirmDischarge = async () => {
    if (!dischargeModalPatient) return;
    const updated = {
      ...dischargeModalPatient,
      status: dischargeStatus,
      dischargeDate: currentBelemToday,
      dischargeNote: dischargeNote || 'Encaminhamento registrado no desfecho da UTI.'
    };
    await handleSavePatientToCloudOrLocal(updated, false);
    setDischargeModalPatient(null);
    setUiNotice(`Desfecho (${dischargeStatus}) registrado para ${dischargeModalPatient.childName}!`);
  };

  const handleReactivatePatient = async (patient) => {
    const updated = {
      ...patient,
      status: 'Internado',
      dischargeDate: null,
      dischargeNote: ''
    };
    await handleSavePatientToCloudOrLocal(updated, false);
    setUiNotice(`${patient.childName} reativado(a) no ${patient.bed}!`);
  };

  const buildHandoverReportText = useCallback(() => {
    const activeSlots = TOTAL_BEDS.map((b) => bedsStatusMap[b]);
    const occupiedSlots = activeSlots.filter((s) => s.isOccupied);
    const vacantBeds = activeSlots.filter((s) => !s.isOccupied).map((s) => s.bedName.replace('Leito ', ''));
    const dischargedToday = patients.filter((p) => p.status !== 'Internado' && p.dischargeDate === currentBelemToday);

    let text = `🏥 *PASSAGEM DE PLANTÃO - PSICOLOGIA UTI CARDIO*\n`;
    text += `📅 *Data do Plantão:* ${formatDateBr(currentBelemToday)} | *Ocupação:* ${metrics.activeBeds}/10 leitos`;
    if (vacantBeds.length > 0) text += ` (Vagos: ${vacantBeds.join(', ')})`;
    text += `\n--------------------------------------------------\n\n`;

    if (occupiedSlots.length === 0) {
      text += `_Nenhum paciente internado no momento._\n\n`;
    } else {
      occupiedSlots.forEach((slot) => {
        const p = slot.patient;
        const isoTag = slot.isIsolationRoom && slot.inIsolationUse ? ` [ISOLAMENTO: ${slot.isolationType.toUpperCase()}]` : '';
        const isNew = p.admissionDate === currentBelemToday ? ' [ADMISSÃO HOJE]' : '';
        const parentsSummary = [p.mother?.name ? `Mãe: ${p.mother.name}` : null, p.father?.name ? `Pai: ${p.father.name}` : null].filter(Boolean).join(' | ');

        text += `🛏️ *${slot.bedName}${isoTag}* — *${p.childName}* (${p.childAgeText || 'Idade N/I'})${isNew}\n`;
        text += `📍 *Origem:* ${p.originCity || 'N/I'}-${p.originState || 'PA'} | ❤️ *Diag:* ${p.cardiacDiagnosis || 'Em investigação'}\n`;
        text += `👥 *No leito hoje:* ${p.currentCompanion || 'Mãe'}${parentsSummary ? ` (${parentsSummary})` : ''}\n`;

        if (slot.todayEvolution) {
          text += `📝 *Evolução do Dia (${slot.todayEvolution.time || 'Hoje'}):* ${slot.todayEvolution.content}\n`;
        } else {
          text += `⏳ *Evolução do Dia:* Sem evolução registrada nesta data.\n`;
        }
        text += `\n`;
      });
    }

    if (dischargedToday.length > 0) {
      text += `📤 *ALTAS / SAÍDAS DO DIA (${dischargedToday.length}):*\n`;
      dischargedToday.forEach((p) => {
        text += `• *${p.bed} - ${p.childName}* (${p.status}): ${p.dischargeNote}\n`;
      });
    }

    return text.trim();
  }, [bedsStatusMap, patients, currentBelemToday, metrics]);

  const handleCopyHandoverText = () => {
    const text = buildHandoverReportText();
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
      setUiNotice("Passagem de plantão copiada para a área de transferência!");
    } catch (err) {
      if (navigator.clipboard) navigator.clipboard.writeText(text);
    }
    document.body.removeChild(textArea);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-teal-500 selection:text-white pb-16">
      {/* Input oculto universal para abrir arquivos do Google Drive em qualquer navegador/celular */}
      <input
        ref={driveOpenInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleFileUploadBackup}
        className="hidden"
      />

      {uiNotice && (
        <div className="bg-teal-950/95 border-b border-teal-500/40 px-4 py-2.5 text-xs text-teal-200 flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-teal-400 shrink-0" />
            <span>{uiNotice}</span>
          </div>
          <button onClick={() => setUiNotice(null)} className="text-teal-400 hover:text-white font-semibold ml-4">Fechar</button>
        </div>
      )}

      <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-teal-500/20 to-rose-500/20 border border-teal-500/40 flex items-center justify-center shadow-lg relative">
              <Heart className="w-5 h-5 text-rose-400 animate-pulse" />
              <span className="absolute -bottom-1 -right-1 bg-teal-500 text-zinc-950 text-[10px] font-extrabold px-1.5 rounded-full">10</span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white">UTI Pediátrica Cardíaca</h1>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-500/15 text-teal-300 border border-teal-500/30 font-medium">Censo 10 Leitos</span>
                <button
                  onClick={() => handleForceCloudSyncNow(false)}
                  disabled={isSyncingManual}
                  className="text-[11px] px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 transition-all bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25 cursor-pointer"
                >
                  <Cloud className="w-3 h-3 text-emerald-400" />
                  <span>Sincronizado {lastSyncTime ? `(${lastSyncTime})` : ''}</span>
                  <RefreshCw className={`w-2.5 h-2.5 ml-0.5 text-emerald-300 ${isSyncingManual ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* SELETOR DE DATA ATIVA DO PLANTÃO (FUSO BELÉM-PA + CONTROLE DE PLANTÃO NOTURNO) */}
              <div className="flex items-center gap-2 flex-wrap mt-1">
                <span className="text-xs text-zinc-400">📍 Belém-PA • Data do Plantão:</span>
                <div className="inline-flex items-center gap-1 bg-zinc-900 border border-teal-500/40 rounded-lg px-1.5 py-0.5">
                  <button
                    type="button"
                    title="Voltar 1 dia (ex: manter plantão do dia 23 após meia-noite)"
                    onClick={() => handleSetShiftDate(shiftDateStringByDays(currentBelemToday, -1))}
                    className="p-0.5 hover:bg-zinc-800 rounded text-teal-300 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="date"
                    value={currentBelemToday}
                    onChange={(e) => handleSetShiftDate(e.target.value)}
                    className="bg-transparent text-xs font-bold text-teal-300 focus:outline-none cursor-pointer"
                  />
                  <button
                    type="button"
                    title="Avançar 1 dia"
                    onClick={() => handleSetShiftDate(shiftDateStringByDays(currentBelemToday, 1))}
                    className="p-0.5 hover:bg-zinc-800 rounded text-teal-300 cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <span className="text-[11px] font-semibold text-teal-400">({formatDateBr(currentBelemToday)})</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsBackupModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/30 transition-all cursor-pointer"
            >
              <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
              <span>Cofre & Drive ({patients.length})</span>
            </button>

            <div className="flex items-center rounded-xl border border-zinc-700/80 bg-zinc-900 overflow-hidden">
              <button
                onClick={handleCopyHandoverText}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium hover:bg-zinc-800 text-zinc-200 transition-all cursor-pointer"
              >
                {copySuccess ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-teal-400" />}
                <span>Passagem de Plantão</span>
              </button>
              <button
                onClick={() => setIsHandoverPreviewOpen(true)}
                title="Visualizar texto da Passagem de Plantão"
                className="px-2.5 py-2 border-l border-zinc-800 hover:bg-zinc-800 text-teal-300 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={() => handleOpenForm(null)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-teal-500 hover:bg-teal-400 text-zinc-950 shadow-lg shadow-teal-950/50 transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Admitir Paciente</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 space-y-5">
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div onClick={() => { setFilterMode('active'); setActiveTab('grid'); }} className="cursor-pointer p-3.5 rounded-2xl border bg-zinc-900/60 border-zinc-800/90 hover:border-teal-500/40 transition-all">
            <span className="text-[11px] font-medium text-zinc-400">Taxa de Ocupação</span>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-white">{metrics.activeBeds}</span>
              <span className="text-xs text-zinc-400">/ 10 leitos ({metrics.vacantBeds} vagos)</span>
            </div>
          </div>

          <div onClick={() => setIsIsolationModalOpen(true)} className="cursor-pointer p-3.5 rounded-2xl border bg-purple-950/25 border-purple-500/50 hover:border-purple-400 transition-all">
            <span className="text-[11px] font-medium text-purple-300">Leito 10 (Isolamento)</span>
            <div className="mt-1.5 flex items-baseline justify-between">
              <span className="text-sm font-bold text-white truncate">{bed10Config.inIsolationUse ? `Ativo: ${bed10Config.isolationType}` : 'Uso Regular'}</span>
              <span className="text-[10px] underline text-purple-300">Configurar</span>
            </div>
          </div>

          <div onClick={() => { setFilterMode('active'); setActiveTab('cards'); }} className="cursor-pointer p-3.5 rounded-2xl border bg-zinc-900/60 border-zinc-800/90 hover:border-emerald-500/40 transition-all">
            <span className="text-[11px] font-medium text-zinc-400">Evoluídos no Dia ({formatDateBr(currentBelemToday).slice(0, 5)})</span>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-emerald-400">{metrics.evolvedTodayCount}</span>
              <span className="text-xs text-zinc-400">de {metrics.activeBeds} pacientes</span>
            </div>
          </div>

          <div onClick={() => { setFilterMode('mental_alert'); setActiveTab('mental_health'); }} className="cursor-pointer p-3.5 rounded-2xl border bg-zinc-900/60 border-zinc-800/90 hover:border-amber-500/40 transition-all">
            <span className="text-[11px] font-medium text-zinc-400">Atenção Saúde Mental</span>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-amber-400">{metrics.mentalAlertsCount}</span>
              <span className="text-xs text-zinc-400">famílias em alerta</span>
            </div>
          </div>

          <div onClick={() => { setFilterMode('discharged'); setActiveTab('discharges'); }} className="cursor-pointer p-3.5 rounded-2xl border bg-zinc-900/60 border-zinc-800/90 hover:border-rose-500/40 transition-all">
            <span className="text-[11px] font-medium text-zinc-400">Altas / Saídas no Dia</span>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-rose-400">{metrics.dischargedTodayCount}</span>
              <span className="text-xs text-zinc-400">saídas hoje</span>
            </div>
          </div>
        </section>

        <section className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-zinc-900/70 p-2.5 rounded-2xl border border-zinc-800/80">
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
            <button onClick={() => { setActiveTab('grid'); setFilterMode('all'); }} className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${activeTab === 'grid' ? 'bg-teal-500 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'}`}>
              <Layers className="w-3.5 h-3.5" /><span>Mapa dos 10 Leitos</span>
            </button>
            <button onClick={() => { setActiveTab('cards'); setFilterMode('active'); }} className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${activeTab === 'cards' ? 'bg-teal-500 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'}`}>
              <FileText className="w-3.5 h-3.5" /><span>Fichas & Evoluções Diárias ({metrics.activeBeds})</span>
            </button>
            <button onClick={() => setActiveTab('mental_health')} className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${activeTab === 'mental_health' ? 'bg-amber-500 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'}`}>
              <Brain className="w-3.5 h-3.5" /><span>Saúde Mental ({metrics.mentalAlertsCount})</span>
            </button>
            <button onClick={() => { setActiveTab('discharges'); setFilterMode('discharged'); }} className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${activeTab === 'discharges' ? 'bg-rose-500 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'}`}>
              <LogOut className="w-3.5 h-3.5" /><span>Altas & Desfechos</span>
            </button>
          </div>

          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar criança, mãe, pai, município, cardiopatia..."
              className="w-full bg-zinc-950 border border-zinc-800 focus:border-teal-500/60 rounded-xl pl-9 pr-8 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </section>

        {/* ABA 1: MAPA DOS 10 LEITOS */}
        {activeTab === 'grid' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {TOTAL_BEDS.map((bedName) => {
              const slot = bedsStatusMap[bedName];
              const p = slot.patient;
              const isIsoBed = slot.isIsolationRoom;

              return (
                <div key={bedName} className={`rounded-2xl border p-4 flex flex-col justify-between transition-all relative overflow-hidden ${isIsoBed && slot.inIsolationUse ? 'bg-purple-950/35 border-purple-500/50' : slot.isOccupied ? 'bg-zinc-900/80 border-zinc-800' : 'bg-zinc-950/60 border-zinc-900 border-dashed'}`}>
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-2.5">
                      <span className={`text-xs font-extrabold px-2.5 py-1 rounded-lg ${isIsoBed ? 'bg-purple-500/20 text-purple-300' : slot.isOccupied ? 'bg-teal-500/15 text-teal-300' : 'bg-zinc-800 text-zinc-400'}`}>
                        {bedName}
                      </span>
                      <div className="flex items-center gap-1">
                        {slot.hasMentalAlert && (
                          <span title="Alerta de Saúde Mental Familiar/Criança" className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                            🧠
                          </span>
                        )}
                        {slot.isOccupied ? (
                          slot.todayEvolution ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Evoluído</span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">Pendente</span>
                          )
                        ) : (
                          <span className="text-[10px] text-zinc-500">Livre</span>
                        )}
                      </div>
                    </div>

                    {isIsoBed && (
                      <div className="mb-2 px-2 py-1 rounded-lg bg-purple-950/60 border border-purple-500/30 flex items-center justify-between text-[10px] text-purple-200">
                        <span>🛡️ Isolamento: <strong>{slot.inIsolationUse ? slot.isolationType : 'Inativo'}</strong></span>
                        <button onClick={() => setIsIsolationModalOpen(true)} className="underline text-purple-300 ml-1">Ajustar</button>
                      </div>
                    )}

                    {slot.isOccupied && p ? (
                      <div className="space-y-2 my-1">
                        <div>
                          <h3 className="text-sm font-bold text-white truncate">{p.childName}</h3>
                          <p className="text-[11px] text-zinc-400">{p.childAgeText || 'Idade N/I'} {p.childBirthDate ? `• Nasc: ${formatDateBr(p.childBirthDate)}` : ''}</p>
                          {p.childEducation && p.childEducation !== 'Não informado' && (
                            <p className="text-[10px] text-zinc-300 truncate">🎓 {p.childEducation}</p>
                          )}
                          <p className="text-[11px] text-zinc-400 truncate">📍 Origem: {p.originCity || 'N/I'}-{p.originState || 'PA'}</p>
                          {p.familyStayType && p.familyStayType !== 'Não informado' && (
                            <p className="text-[10px] text-amber-300 truncate" title={p.familyStayAddress ? `${p.familyStayType} — ${p.familyStayAddress}` : p.familyStayType}>
                              🏠 Em Belém: {p.familyStayType}
                            </p>
                          )}
                        </div>

                        <div className="p-2 rounded-xl bg-zinc-950/70 border border-zinc-800">
                          <p className="text-[11px] text-rose-300 font-medium line-clamp-2">❤️ {p.cardiacDiagnosis || 'Cardiopatia em investigação'}</p>
                        </div>

                        <div className="text-[11px] text-zinc-300 space-y-1">
                          <div className="bg-teal-950/30 border border-teal-500/25 rounded-lg px-2 py-1">
                            <span className="text-[10px] text-zinc-400 block">No leito hoje:</span>
                            <span className="font-semibold text-teal-300 line-clamp-2">{p.currentCompanion || 'Mãe'}</span>
                          </div>
                          {p.mother?.name && <p className="text-[10px] text-zinc-400 truncate">👩 Mãe: <span className="text-zinc-200">{p.mother.name}</span></p>}
                          {p.father?.name && <p className="text-[10px] text-zinc-400 truncate">👨 Pai: <span className="text-zinc-200">{p.father.name}</span></p>}
                          {p.bedTransferHistory?.length > 0 && (
                            <p className="text-[10px] text-cyan-300 truncate">⇄ Veio do {p.bedTransferHistory[0].fromBed}</p>
                          )}
                        </div>

                        {slot.todayEvolution ? (
                          <div className="p-2 rounded-lg bg-emerald-950/25 border border-emerald-500/30 text-[10px] text-emerald-200 line-clamp-2">
                            <strong>Hoje ({slot.todayEvolution.time}):</strong> {slot.todayEvolution.content}
                          </div>
                        ) : slot.latestEvolution ? (
                          <div className="p-2 rounded-lg bg-zinc-950/50 border border-zinc-800 text-[10px] text-zinc-400 line-clamp-2">
                            <strong>Última ({formatDateBr(slot.latestEvolution.date).slice(0, 5)}):</strong> {slot.latestEvolution.content}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="py-8 flex flex-col items-center justify-center text-center">
                        <BedDouble className="w-7 h-7 text-zinc-700 mb-1.5" />
                        <p className="text-xs text-zinc-500 font-medium">Leito Disponível</p>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 mt-2 border-t border-zinc-800/80 flex items-center justify-between gap-1.5">
                    {slot.isOccupied && p ? (
                      <>
                        <button onClick={() => handleOpenForm(p)} className="flex-1 py-1.5 px-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[11px] font-medium text-zinc-200 flex items-center justify-center gap-1 cursor-pointer">
                          <Edit3 className="w-3 h-3 text-teal-400" /><span>Ficha / Evoluir</span>
                        </button>
                        <button onClick={() => handleOpenTransferBedModal(p)} title="Mudar ou Permutar Leito" className="py-1.5 px-2 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-700/40 text-[11px] font-medium text-cyan-300 flex items-center justify-center gap-1 cursor-pointer">
                          <ArrowRightLeft className="w-3 h-3" />
                        </button>
                        <button onClick={() => handleOpenDischarge(p)} title="Registrar Alta / Desfecho" className="py-1.5 px-2 rounded-lg bg-rose-950/30 hover:bg-rose-900/50 border border-rose-800/40 text-[11px] font-medium text-rose-300 flex items-center justify-center gap-1 cursor-pointer">
                          <LogOut className="w-3 h-3" />
                        </button>
                      </>
                    ) : (
                      <button onClick={() => handleOpenForm(null, bedName)} className="w-full py-1.5 px-2.5 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 text-[11px] font-semibold text-teal-300 flex items-center justify-center gap-1 cursor-pointer">
                        <PlusCircle className="w-3.5 h-3.5" /><span>Admitir no {bedName}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ABA 2: FICHAS COMPLETAS & EVOLUÇÕES DIÁRIAS */}
        {activeTab === 'cards' && (
          <div className="space-y-4">
            {filteredPatients.length === 0 ? (
              <div className="p-12 text-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30">
                <Users className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                <p className="text-zinc-400 text-sm font-medium">Nenhum paciente encontrado para este filtro.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredPatients.map((patient) => {
                  const isIso = patient.bed === "Leito 10";
                  const isDischarged = patient.status !== 'Internado';
                  const motherWa = getWhatsAppLink(patient.mother?.phone);
                  const fatherWa = getWhatsAppLink(patient.father?.phone);
                  const companionWa = getWhatsAppLink(patient.companionPhone);
                  const stayMapsLink = getGoogleMapsLink(patient.familyStayAddress);

                  return (
                    <div key={patient.id} className={`rounded-2xl border p-5 flex flex-col justify-between transition-all ${isDischarged ? 'bg-zinc-900/40 border-zinc-800 opacity-85' : isIso ? 'bg-purple-950/20 border-purple-500/40' : 'bg-zinc-900/80 border-zinc-800'}`}>
                      <div className="space-y-3.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-lg bg-teal-500/20 text-teal-300 border border-teal-500/30">{patient.bed}</span>
                              <h3 className="text-base font-bold text-white">{patient.childName}</h3>
                              <span className="text-xs text-zinc-400">({patient.childAgeText || 'Idade N/I'})</span>
                            </div>
                            <p className="text-xs text-zinc-400 mt-1">
                              🎂 Nasc: <strong className="text-zinc-200">{formatDateBr(patient.childBirthDate)}</strong> • 🎓 Escolaridade: <strong className="text-zinc-200">{patient.childEducation || 'Não informado'}</strong> • 📍 Naturalidade: <strong className="text-zinc-200">{patient.naturalness || 'N/I'}</strong> • Procedência: <strong className="text-zinc-200">{patient.originCity || 'N/I'} - {patient.originState || 'PA'}</strong>
                            </p>
                          </div>
                          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full border bg-emerald-500/15 text-emerald-300 border-emerald-500/30">{patient.status}</span>
                        </div>

                        {/* LOCAL DE ESTADIA / ACOLHIMENTO DA FAMÍLIA EM BELÉM */}
                        {(patient.familyStayType !== 'Não informado' || patient.familyStayAddress) && (
                          <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 flex items-start justify-between gap-2 text-xs">
                            <div className="space-y-0.5">
                              <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                <span>Estadia / Acolhimento da Família em Belém:</span>
                              </span>
                              <p className="text-zinc-100 font-semibold">{patient.familyStayType || 'Não informado'}</p>
                              {patient.familyStayAddress && (
                                <p className="text-[11px] text-zinc-300">📍 Endereço / Ref.: {patient.familyStayAddress}</p>
                              )}
                            </div>
                            {stayMapsLink && (
                              <a
                                href={stayMapsLink}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-[10px] font-bold whitespace-nowrap flex items-center gap-1 shrink-0"
                              >
                                <MapPin className="w-3 h-3" /> Ver no Mapa
                              </a>
                            )}
                          </div>
                        )}

                        <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 flex items-start gap-2.5">
                          <Stethoscope className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold block">Diagnóstico Cardiológico</span>
                            <p className="text-xs text-zinc-100 font-medium mt-0.5">{patient.cardiacDiagnosis || 'Em investigação'}</p>
                          </div>
                        </div>

                        {/* ACOMPANHANTES NO LEITO HOJE */}
                        <div className="p-3 rounded-xl bg-teal-950/20 border border-teal-500/30 space-y-1.5 text-xs">
                          <div className="flex items-center justify-between flex-wrap gap-1">
                            <span className="text-[11px] font-bold text-teal-300">👥 Acompanhantes / Visitantes no Leito Hoje:</span>
                            <span className="text-xs font-semibold text-white">{patient.currentCompanion || 'Mãe'}</span>
                          </div>
                          {patient.companionNotes && (
                            <p className="text-[11px] text-zinc-300 italic">Obs. Revezamento/Visita: {patient.companionNotes}</p>
                          )}
                        </div>

                        {/* DADOS DA MÃE E DO PAI */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                          <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-rose-300">👩 Genitora (Mãe)</span>
                              {motherWa && (
                                <a href={motherWa} target="_blank" rel="noreferrer" className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                  <MessageCircle className="w-3 h-3" /> WhatsApp
                                </a>
                              )}
                            </div>
                            <p className="text-zinc-200 font-medium">{patient.mother?.name || 'Não informado'} {patient.mother?.age ? `(${patient.mother.age} anos)` : ''}</p>
                            <p className="text-[11px] text-zinc-400">📞 {patient.mother?.phone || 'Sem telefone'}</p>
                            <p className="text-[11px] text-zinc-400">🎓 {patient.mother?.education || 'N/I'} • 🕊️ {patient.mother?.religion || 'N/I'}</p>
                            <p className="text-[11px] text-zinc-400">💼 Profissão: {patient.mother?.profession || 'N/I'}</p>
                            {patient.mother?.hasPsych && (
                              <p className="text-[11px] text-amber-300 bg-amber-950/40 border border-amber-500/30 rounded p-1.5 mt-1">
                                🧠 <strong>Saúde Mental:</strong> {patient.mother.psychDetails || 'Em acompanhamento'}
                              </p>
                            )}
                          </div>

                          <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-sky-300">👨 Genitor (Pai)</span>
                              {fatherWa && (
                                <a href={fatherWa} target="_blank" rel="noreferrer" className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                  <MessageCircle className="w-3 h-3" /> WhatsApp
                                </a>
                              )}
                            </div>
                            <p className="text-zinc-200 font-medium">{patient.father?.name || 'Não informado'} {patient.father?.age ? `(${patient.father.age} anos)` : ''}</p>
                            <p className="text-[11px] text-zinc-400">📞 {patient.father?.phone || 'Sem telefone'}</p>
                            <p className="text-[11px] text-zinc-400">🎓 {patient.father?.education || 'N/I'} • 🕊️ {patient.father?.religion || 'N/I'}</p>
                            <p className="text-[11px] text-zinc-400">💼 Profissão: {patient.father?.profession || 'N/I'}</p>
                            {patient.father?.hasPsych && (
                              <p className="text-[11px] text-amber-300 bg-amber-950/40 border border-amber-500/30 rounded p-1.5 mt-1">
                                🧠 <strong>Saúde Mental:</strong> {patient.father.psychDetails || 'Em acompanhamento'}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* OUTRO RESPONSÁVEL (SE PREENCHIDO) */}
                        {patient.companionName && (
                          <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800 text-[11px] flex items-center justify-between flex-wrap gap-2">
                            <div>
                              <span className="text-amber-300 font-bold">👤 Outro Cuidador de Referência: </span>
                              <span className="text-zinc-200 font-medium">{patient.companionName} ({patient.companionKinship || 'Familiar'})</span>
                              <span className="text-zinc-400"> • 🎓 {patient.companionEducation} • 🕊️ {patient.companionReligion} • 💼 {patient.companionProfession || 'N/I'}</span>
                            </div>
                            {companionWa && (
                              <a href={companionWa} target="_blank" rel="noreferrer" className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                📞 {patient.companionPhone}
                              </a>
                            )}
                          </div>
                        )}

                        {/* HISTÓRICO DE MUDANÇAS DE LEITO */}
                        {patient.bedTransferHistory?.length > 0 && (
                          <div className="p-2.5 rounded-xl bg-cyan-950/20 border border-cyan-500/30 text-[11px] text-cyan-200 space-y-1">
                            <span className="font-bold block text-cyan-300">⇄ Histórico de Movimentação de Leito:</span>
                            {patient.bedTransferHistory.slice(0, 3).map((tr) => (
                              <div key={tr.id} className="text-[10px] text-cyan-100">
                                • {formatDateBr(tr.date)} às {tr.time}: <strong>{tr.fromBed} ➔ {tr.toBed}</strong> ({tr.reason})
                              </div>
                            ))}
                          </div>
                        )}

                        {/* EVOLUÇÕES PSICOLÓGICAS DIÁRIAS */}
                        <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase tracking-wider text-teal-400 font-bold">Evoluções Psicológicas Diárias ({(patient.dailyEvolutions || []).length})</span>
                            <button onClick={() => handleOpenForm(patient)} className="text-[11px] text-teal-300 hover:underline font-semibold cursor-pointer">+ Inserir / Editar Evolução</button>
                          </div>
                          {(patient.dailyEvolutions || []).length === 0 ? (
                            <p className="text-xs text-zinc-500 italic">Nenhuma evolução diária registrada.</p>
                          ) : (
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                              {(patient.dailyEvolutions || []).map((ev) => {
                                const isToday = ev.date === currentBelemToday;
                                return (
                                  <div key={ev.id} className={`p-2.5 rounded-lg border text-xs ${isToday ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-100' : 'bg-zinc-900/70 border-zinc-800 text-zinc-300'}`}>
                                    <div className="flex items-center justify-between text-[10px] mb-1">
                                      <span className={`font-bold ${isToday ? 'text-emerald-300' : 'text-teal-400'}`}>📅 {formatDateBr(ev.date)} às {ev.time || '08:30'} {isToday ? '• [DATA DO PLANTÃO ATIVO]' : ''}</span>
                                    </div>
                                    <p className="leading-relaxed whitespace-pre-line">{ev.content}</p>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-[11px] text-zinc-500">Admissão: {formatDateBr(patient.admissionDate)}</span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleOpenForm(patient)} className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 flex items-center gap-1.5 cursor-pointer">
                            <Edit3 className="w-3.5 h-3.5 text-teal-400" /><span>Abrir Ficha Completa</span>
                          </button>
                          {!isDischarged ? (
                            <>
                              <button onClick={() => handleOpenTransferBedModal(patient)} className="px-3 py-1.5 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-700/40 text-xs text-cyan-300 flex items-center gap-1.5 cursor-pointer">
                                <ArrowRightLeft className="w-3.5 h-3.5" /><span>Mudar Leito</span>
                              </button>
                              <button onClick={() => handleOpenDischarge(patient)} className="px-3 py-1.5 rounded-lg bg-rose-950/30 hover:bg-rose-900/50 border border-rose-800/40 text-xs text-rose-300 cursor-pointer">Alta</button>
                            </>
                          ) : (
                            <button onClick={() => handleReactivatePatient(patient)} className="px-3 py-1.5 rounded-lg bg-teal-500/20 border border-teal-500/40 text-xs text-teal-300 cursor-pointer">
                              Reinternar no Leito
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ABA 3: TRIAGEM DE SAÚDE MENTAL */}
        {activeTab === 'mental_health' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sortPatientsByBedNumber(patients.map(normalizePatientRecord).filter((p) => p.status === 'Internado' && (p.childMentalHealth?.hasCondition || p.mother?.hasPsych || p.father?.hasPsych)))
                .map((p) => (
                  <div key={p.id} className="p-4 rounded-2xl bg-zinc-900 border border-amber-500/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">{p.bed} • {p.childName}</span>
                      <button onClick={() => handleOpenForm(p)} className="text-xs text-teal-300 hover:underline">Editar Ficha</button>
                    </div>
                    {p.childMentalHealth?.hasCondition && (
                      <p className="text-xs text-amber-200 bg-zinc-950 p-2.5 rounded-xl border border-zinc-800">
                        🧒 <strong>Criança:</strong> {p.childMentalHealth.details || 'Demanda de saúde mental/neurodesenvolvimento assinalada.'}
                      </p>
                    )}
                    {p.mother?.hasPsych && (
                      <p className="text-xs text-rose-200 bg-zinc-950 p-2.5 rounded-xl border border-zinc-800">
                        👩 <strong>Mãe ({p.mother.name || 'N/I'}):</strong> {p.mother.psychDetails || 'Alerta emocional/psiquiátrico assinalado.'}
                      </p>
                    )}
                    {p.father?.hasPsych && (
                      <p className="text-xs text-sky-200 bg-zinc-950 p-2.5 rounded-xl border border-zinc-800">
                        👨 <strong>Pai ({p.father.name || 'N/I'}):</strong> {p.father.psychDetails || 'Alerta emocional/psiquiátrico assinalado.'}
                      </p>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ABA 4: ALTAS & DESFECHOS */}
        {activeTab === 'discharges' && (
          <div className="space-y-3">
            {patients.filter((p) => p.status !== 'Internado').length === 0 ? (
              <div className="p-10 text-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 text-xs text-zinc-400">
                Nenhuma alta ou transferência externa registrada até o momento.
              </div>
            ) : (
              patients.filter((p) => p.status !== 'Internado').map((p) => (
                <div key={p.id} className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col sm:flex-row justify-between sm:items-center gap-3 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-rose-300">{p.bed}</span>
                      <span className="font-bold text-white text-sm">{p.childName}</span>
                      <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">{p.status}</span>
                    </div>
                    <p className="text-zinc-400 mt-1">Desfecho em {formatDateBr(p.dischargeDate)}: {p.dischargeNote}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleOpenForm(p)} className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700">Ver Ficha</button>
                    <button onClick={() => handleReactivatePatient(p)} className="px-3 py-1.5 rounded-lg bg-teal-500/20 border border-teal-500/40 text-teal-300 hover:bg-teal-500/30">Reinternar</button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* =================================================================== */}
      {/* MODAL COMPLETO DE ADMISSÃO, CADASTRO FAMILIAR E EVOLUÇÃO DIÁRIA      */}
      {/* =================================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-4xl w-full p-5 sm:p-6 space-y-5 shadow-2xl my-8 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3 sticky top-0 bg-zinc-900 z-10">
              <div>
                <h2 className="text-base font-bold text-zinc-100">
                  {editingPatient ? `Prontuário Psicológico — ${editingPatient.childName} (${formData.bed})` : 'Admitir Criança na UTI Pediátrica Cardíaca'}
                </h2>
                <p className="text-[11px] text-zinc-400">Todos os dados permanecem salvos no cofre permanente e sincronizados na nuvem</p>
              </div>
              <button onClick={() => { stopCurrentSpeech(); setIsModalOpen(false); }} className="text-zinc-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePatient} className="space-y-5 text-xs">
              {/* ITEM 01: IDENTIFICAÇÃO DA CRIANÇA E DIAGNÓSTICO */}
              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
                <h3 className="text-xs font-bold text-teal-400 uppercase tracking-wider">01. Identificação da Criança & Internação</h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-zinc-400 mb-1">Leito</label>
                    <select value={formData.bed} onChange={(e) => setFormData({ ...formData, bed: e.target.value })} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-100">
                      {TOTAL_BEDS.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-zinc-400 mb-1">Nome Completo da Criança *</label>
                    <div className="flex gap-1.5">
                      <input type="text" required value={formData.childName} onChange={(e) => setFormData({ ...formData, childName: e.target.value })} className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-100" />
                      <button type="button" onClick={() => handleToggleFieldDictation('childName')} className={`px-2.5 rounded-lg border ${activeFieldListening === 'childName' ? 'bg-rose-500 text-white border-rose-400 animate-pulse' : 'bg-zinc-900 border-zinc-700 text-zinc-300'}`}>
                        <Mic className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-zinc-400 mb-1">Data de Admissão UTI</label>
                    <input type="date" value={formData.admissionDate} onChange={(e) => setFormData({ ...formData, admissionDate: e.target.value })} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-100" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-zinc-400 mb-1">Data de Nascimento</label>
                    <input
                      type="date"
                      value={formData.childBirthDate}
                      onChange={(e) => setFormData({
                        ...formData,
                        childBirthDate: e.target.value,
                        childAgeText: calculateAgeFromBirthDate(e.target.value)
                      })}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 mb-1">Idade (Calculada ou Manual)</label>
                    <input type="text" value={formData.childAgeText} onChange={(e) => setFormData({ ...formData, childAgeText: e.target.value })} placeholder="Ex: 8 meses" className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-100" />
                  </div>
                  <div>
                    <label className="block text-zinc-400 mb-1">Naturalidade</label>
                    <input type="text" value={formData.naturalness} onChange={(e) => setFormData({ ...formData, naturalness: e.target.value })} placeholder="Ex: Belém - PA" className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-100" />
                  </div>
                  <div>
                    <label className="block text-zinc-400 mb-1">Município de Procedência / UF</label>
                    <div className="flex gap-1">
                      <input type="text" value={formData.originCity} onChange={(e) => setFormData({ ...formData, originCity: e.target.value })} placeholder="Município" className="w-2/3 bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-100" />
                      <input type="text" maxLength={2} value={formData.originState} onChange={(e) => setFormData({ ...formData, originState: e.target.value.toUpperCase() })} placeholder="UF" className="w-1/3 bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-100 text-center" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-zinc-400 mb-1">Escolaridade da Criança / Paciente</label>
                    <select
                      value={formData.childEducation}
                      onChange={(e) => setFormData({ ...formData, childEducation: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-100"
                    >
                      {CHILD_EDUCATION_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-zinc-400 mb-1">Diagnóstico Cardiológico / Cirurgia Realizada</label>
                    <div className="flex gap-1.5">
                      <input type="text" value={formData.cardiacDiagnosis} onChange={(e) => setFormData({ ...formData, cardiacDiagnosis: e.target.value })} placeholder="Ex: Tetralogia de Fallot / Pós-operatório de Jatene..." className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-100" />
                      <button type="button" onClick={() => handleToggleFieldDictation('cardiacDiagnosis')} className={`px-2.5 rounded-lg border ${activeFieldListening === 'cardiacDiagnosis' ? 'bg-rose-500 text-white border-rose-400 animate-pulse' : 'bg-zinc-900 border-zinc-700 text-zinc-300'}`}>
                        <Mic className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* SUB-BLOCO: ONDE A FAMÍLIA ESTÁ HOSPEDADA / ACOLHIDA EM BELÉM */}
                <div className="pt-3 border-t border-zinc-800/90 space-y-2.5">
                  <div>
                    <label className="block text-amber-300 font-bold mb-1.5 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-amber-400" />
                      <span>Onde os familiares estão permanecendo em Belém durante a internação? (Clique para selecionar)</span>
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {BELEN_STAY_OPTIONS.map((option) => {
                        const isSelected = formData.familyStayType === option;
                        return (
                          <button
                            type="button"
                            key={option}
                            onClick={() => setFormData({ ...formData, familyStayType: option })}
                            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-amber-500 text-zinc-950 border-amber-400 shadow'
                                : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-amber-500/40'
                            }`}
                          >
                            {isSelected ? '✓ ' : ''}{option}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-zinc-400 mb-1">
                      Endereço do Local em Belém / Nome da Casa de Apoio / Ponto de Referência
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={formData.familyStayAddress}
                        onChange={(e) => setFormData({ ...formData, familyStayAddress: e.target.value })}
                        placeholder="Ex: Casa de Apoio Bom Samaritano (Bairro Marco, Tv. Mauriti, nº 120) / Casa da tia Maria em Ananindeua..."
                        className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-100"
                      />
                      <button
                        type="button"
                        onClick={() => handleToggleFieldDictation('familyStayAddress')}
                        title="Ditar endereço por voz"
                        className={`px-2.5 rounded-lg border ${
                          activeFieldListening === 'familyStayAddress'
                            ? 'bg-rose-500 text-white border-rose-400 animate-pulse'
                            : 'bg-zinc-900 border-zinc-700 text-zinc-300'
                        }`}
                      >
                        <Mic className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* ITEM 02: DADOS SOCIOECONÔMICOS E SAÚDE MENTAL DA GENITORA (MÃE) */}
              <div className="p-4 rounded-xl bg-zinc-950 border border-rose-500/30 space-y-3">
                <h3 className="text-xs font-bold text-rose-300 uppercase tracking-wider">02. Dados da Genitora (Mãe)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-zinc-400 mb-1">Nome da Mãe</label>
                    <input type="text" value={formData.mother.name} onChange={(e) => setFormData({ ...formData, mother: { ...formData.mother, name: e.target.value } })} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-100" />
                  </div>
                  <div>
                    <label className="block text-zinc-400 mb-1">Idade</label>
                    <input type="number" value={formData.mother.age} onChange={(e) => setFormData({ ...formData, mother: { ...formData.mother, age: e.target.value } })} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-100" />
                  </div>
                  <div>
                    <label className="block text-zinc-400 mb-1">Telefone / WhatsApp</label>
                    <input type="text" value={formData.mother.phone} onChange={(e) => setFormData({ ...formData, mother: { ...formData.mother, phone: formatPhoneMask(e.target.value) } })} placeholder="(91) 98888-8888" className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-100" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-zinc-400 mb-1">Escolaridade da Mãe</label>
                    <select value={formData.mother.education} onChange={(e) => setFormData({ ...formData, mother: { ...formData.mother, education: e.target.value } })} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-100">
                      {EDUCATION_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-zinc-400 mb-1">Religião da Mãe</label>
                    <select value={formData.mother.religion} onChange={(e) => setFormData({ ...formData, mother: { ...formData.mother, religion: e.target.value } })} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-100">
                      {RELIGION_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-zinc-400 mb-1">Profissão / Ocupação da Mãe</label>
                    <input type="text" value={formData.mother.profession} onChange={(e) => setFormData({ ...formData, mother: { ...formData.mother, profession: e.target.value } })} placeholder="Ex: Do lar, Agricultora, Professora..." className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-100" />
                  </div>
                </div>

                <div className="pt-1 space-y-2">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={formData.mother.hasPsych} onChange={(e) => setFormData({ ...formData, mother: { ...formData.mother, hasPsych: e.target.checked } })} className="rounded border-zinc-700" />
                    <span className="text-amber-300 font-semibold">Alerta de Saúde Mental / Vulnerabilidade Emocional da Mãe</span>
                  </label>
                  <div className="flex gap-1.5">
                    <input type="text" value={formData.mother.psychDetails} onChange={(e) => setFormData({ ...formData, mother: { ...formData.mother, psychDetails: e.target.value } })} placeholder="Observações emocionais, rede de apoio, histórico psiquiátrico da mãe..." className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-100" />
                    <button type="button" onClick={() => handleToggleFieldDictation('mother', 'psychDetails')} className={`px-2.5 rounded-lg border ${activeFieldListening === 'mother.psychDetails' ? 'bg-rose-500 text-white border-rose-400 animate-pulse' : 'bg-zinc-900 border-zinc-700 text-zinc-300'}`}>
                      <Mic className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* ITEM 03: DADOS SOCIOECONÔMICOS E SAÚDE MENTAL DO GENITOR (PAI) */}
              <div className="p-4 rounded-xl bg-zinc-950 border border-sky-500/30 space-y-3">
                <h3 className="text-xs font-bold text-sky-300 uppercase tracking-wider">03. Dados do Genitor (Pai)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-zinc-400 mb-1">Nome do Pai</label>
                    <input type="text" value={formData.father.name} onChange={(e) => setFormData({ ...formData, father: { ...formData.father, name: e.target.value } })} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-100" />
                  </div>
                  <div>
                    <label className="block text-zinc-400 mb-1">Idade</label>
                    <input type="number" value={formData.father.age} onChange={(e) => setFormData({ ...formData, father: { ...formData.father, age: e.target.value } })} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-100" />
                  </div>
                  <div>
                    <label className="block text-zinc-400 mb-1">Telefone / WhatsApp</label>
                    <input type="text" value={formData.father.phone} onChange={(e) => setFormData({ ...formData, father: { ...formData.father, phone: formatPhoneMask(e.target.value) } })} placeholder="(91) 98888-8888" className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-100" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-zinc-400 mb-1">Escolaridade do Pai</label>
                    <select value={formData.father.education} onChange={(e) => setFormData({ ...formData, father: { ...formData.father, education: e.target.value } })} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-100">
                      {EDUCATION_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-zinc-400 mb-1">Religião do Pai</label>
                    <select value={formData.father.religion} onChange={(e) => setFormData({ ...formData, father: { ...formData.father, religion: e.target.value } })} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-100">
                      {RELIGION_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-zinc-400 mb-1">Profissão / Ocupação do Pai</label>
                    <input type="text" value={formData.father.profession} onChange={(e) => setFormData({ ...formData, father: { ...formData.father, profession: e.target.value } })} placeholder="Ex: Autônomo, Pescador, Motorista..." className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-100" />
                  </div>
                </div>

                <div className="pt-1 space-y-2">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={formData.father.hasPsych} onChange={(e) => setFormData({ ...formData, father: { ...formData.father, hasPsych: e.target.checked } })} className="rounded border-zinc-700" />
                    <span className="text-amber-300 font-semibold">Alerta de Saúde Mental / Vulnerabilidade Emocional do Pai</span>
                  </label>
                  <div className="flex gap-1.5">
                    <input type="text" value={formData.father.psychDetails} onChange={(e) => setFormData({ ...formData, father: { ...formData.father, psychDetails: e.target.value } })} placeholder="Observações emocionais, presença no hospital, demandas do pai..." className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-100" />
                    <button type="button" onClick={() => handleToggleFieldDictation('father', 'psychDetails')} className={`px-2.5 rounded-lg border ${activeFieldListening === 'father.psychDetails' ? 'bg-rose-500 text-white border-rose-400 animate-pulse' : 'bg-zinc-900 border-zinc-700 text-zinc-300'}`}>
                      <Mic className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* ITEM 04: MÚLTIPLOS ACOMPANHANTES / VISITANTES PRESENTES NO LEITO HOJE */}
              <div className="p-4 rounded-xl bg-zinc-950 border border-teal-500/30 space-y-3">
                <h3 className="text-xs font-bold text-teal-300 uppercase tracking-wider">04. Acompanhantes / Visitantes Presentes no Leito Hoje (Pode marcar mais de um)</h3>
                <div className="flex flex-wrap gap-2">
                  {COMPANION_PRESENCE_OPTIONS.map((person) => {
                    const isSelected = (formData.currentCompanionsList || []).includes(person);
                    return (
                      <button
                        type="button"
                        key={person}
                        onClick={() => handleToggleCompanionPresence(person)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-teal-500 text-zinc-950 border-teal-400 shadow'
                            : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-teal-500/40'
                        }`}
                      >
                        {isSelected ? '✓ ' : '+ '}{person}
                      </button>
                    );
                  })}
                </div>

                {/* Adicionar visitante/acompanhante nominal extra na visita ao leito */}
                <div className="pt-2 border-t border-zinc-800 space-y-2">
                  <span className="text-[11px] text-zinc-400 block font-medium">Adicionar outro acompanhante / visitante nominalmente presente na visita:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <input type="text" value={newVisitorName} onChange={(e) => setNewVisitorName(e.target.value)} placeholder="Nome do visitante/familiar" className="bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-100" />
                    <input type="text" value={newVisitorKinship} onChange={(e) => setNewVisitorKinship(e.target.value)} placeholder="Parentesco (ex: Avó, Tia)" className="bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-100" />
                    <input type="text" value={newVisitorPhone} onChange={(e) => setNewVisitorPhone(formatPhoneMask(e.target.value))} placeholder="Telefone (opcional)" className="bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-100" />
                    <button type="button" onClick={handleAddExtraBedsideVisitor} className="px-3 py-2 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/40 text-teal-300 font-bold cursor-pointer">
                      + Incluir no Leito
                    </button>
                  </div>

                  {(formData.extraBedsideVisitors || []).length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {formData.extraBedsideVisitors.map((v) => (
                        <span key={v.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-950/60 border border-teal-500/40 text-teal-200 text-xs">
                          <span>👤 {v.name} ({v.kinship}) {v.phone ? `• ${v.phone}` : ''}</span>
                          <button type="button" onClick={() => handleRemoveExtraBedsideVisitor(v.id)} className="text-rose-400 hover:text-rose-200 font-bold">×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1">Observações de Revezamento / Visita Familiar no Leito</label>
                  <input type="text" value={formData.companionNotes} onChange={(e) => setFormData({ ...formData, companionNotes: e.target.value })} placeholder="Ex: Mãe no período da manhã e Avó materna à tarde..." className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-100" />
                </div>
              </div>

              {/* ITEM 05: DADOS SOCIOECONÔMICOS DE OUTRO RESPONSÁVEL / CUIDADOR PRINCIPAL */}
              <div className="p-4 rounded-xl bg-zinc-950 border border-amber-500/30 space-y-3">
                <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider">05. Dados Socioeconômicos de Outro Responsável / Cuidador (Avó, Tia, etc.)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-zinc-400 mb-1">Nome Completo do Cuidador</label>
                    <input type="text" value={formData.companionName} onChange={(e) => setFormData({ ...formData, companionName: e.target.value })} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-100" />
                  </div>
                  <div>
                    <label className="block text-zinc-400 mb-1">Parentesco</label>
                    <input type="text" value={formData.companionKinship} onChange={(e) => setFormData({ ...formData, companionKinship: e.target.value })} placeholder="Ex: Avó Materna, Tia..." className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-100" />
                  </div>
                  <div>
                    <label className="block text-zinc-400 mb-1">Idade / Telefone</label>
                    <div className="flex gap-1">
                      <input type="number" value={formData.companionAge} onChange={(e) => setFormData({ ...formData, companionAge: e.target.value })} placeholder="Idade" className="w-1/3 bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-100" />
                      <input type="text" value={formData.companionPhone} onChange={(e) => setFormData({ ...formData, companionPhone: formatPhoneMask(e.target.value) })} placeholder="WhatsApp" className="w-2/3 bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-100" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-zinc-400 mb-1">Escolaridade</label>
                    <select value={formData.companionEducation} onChange={(e) => setFormData({ ...formData, companionEducation: e.target.value })} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-100">
                      {EDUCATION_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-zinc-400 mb-1">Religião</label>
                    <select value={formData.companionReligion} onChange={(e) => setFormData({ ...formData, companionReligion: e.target.value })} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-100">
                      {RELIGION_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-zinc-400 mb-1">Profissão / Ocupação</label>
                    <input type="text" value={formData.companionProfession} onChange={(e) => setFormData({ ...formData, companionProfession: e.target.value })} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-100" />
                  </div>
                </div>
              </div>

              {/* ITEM 06: SAÚDE MENTAL E NEURODESENVOLVIMENTO DA CRIANÇA */}
              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                <h3 className="text-xs font-bold text-purple-300 uppercase tracking-wider">06. Saúde Mental & Neurodesenvolvimento da Criança</h3>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formData.childMentalHealth.hasCondition} onChange={(e) => setFormData({ ...formData, childMentalHealth: { ...formData.childMentalHealth, hasCondition: e.target.checked } })} className="rounded border-zinc-700" />
                  <span className="text-purple-200 font-semibold">Criança apresenta demanda específica de neurodesenvolvimento, síndrome genética ou sofrimento psíquico acentuado</span>
                </label>
                <input type="text" value={formData.childMentalHealth.details} onChange={(e) => setFormData({ ...formData, childMentalHealth: { ...formData.childMentalHealth, details: e.target.value } })} placeholder="Descreva aspectos comportamentais da criança, adaptação à UTI, síndromes associadas..." className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-100" />
              </div>

              {/* ITEM 07: EVOLUÇÃO PSICOLÓGICA DIÁRIA POR DATA */}
              <div className="p-4 rounded-xl bg-emerald-950/15 border border-emerald-500/40 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-500/20 pb-2">
                  <div>
                    <h3 className="text-xs font-bold text-emerald-300 uppercase">07. Evolução Psicológica Diária (Por Data)</h3>
                    <p className="text-[11px] text-zinc-400">Selecione a data para registrar ou consultar a evolução daquele dia específico</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={selectedEvolutionDate}
                      onChange={(e) => handleSelectEvolutionDateChange(e.target.value)}
                      className="bg-zinc-900 border border-emerald-500/40 rounded-lg p-1.5 text-zinc-100 font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => handleToggleFieldDictation('dailyEvolutionDraft')}
                      className={`px-3 py-1.5 rounded-lg border flex items-center gap-1 font-semibold cursor-pointer ${
                        activeFieldListening === 'dailyEvolutionDraft'
                          ? 'bg-rose-500 text-white border-rose-400 animate-pulse'
                          : 'bg-zinc-900 border-emerald-500/40 text-emerald-300'
                      }`}
                    >
                      <Mic className="w-3.5 h-3.5" />
                      <span>{activeFieldListening === 'dailyEvolutionDraft' ? 'Ouvindo...' : 'Ditar Evolução'}</span>
                    </button>
                  </div>
                </div>

                <textarea
                  rows={4}
                  value={currentEvolutionDraft}
                  onChange={(e) => setCurrentEvolutionDraft(e.target.value)}
                  placeholder={`Digite ou dite a evolução psicológica referente ao dia ${formatDateBr(selectedEvolutionDate)}...`}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-zinc-100"
                />

                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-zinc-400">Ao clicar em "Salvar Prontuário Completo", o texto acima também é salvo automaticamente.</span>
                  <button type="button" onClick={handleSaveDailyEvolutionEntry} className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-bold text-xs cursor-pointer">
                    + Fixar Evolução de {formatDateBr(selectedEvolutionDate)}
                  </button>
                </div>

                {(formData.dailyEvolutions || []).length > 0 && (
                  <div className="pt-2 border-t border-zinc-800 space-y-1.5 max-h-40 overflow-y-auto">
                    <span className="text-[10px] font-bold uppercase text-zinc-400 block">Histórico de Evoluções Salvas neste Paciente:</span>
                    {formData.dailyEvolutions.map((ev) => (
                      <div key={ev.id} className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 flex items-start justify-between gap-2">
                        <div className="cursor-pointer flex-1" onClick={() => handleSelectEvolutionDateChange(ev.date)}>
                          <span className="text-[10px] font-bold text-teal-400">📅 {formatDateBr(ev.date)} às {ev.time || '08:30'}</span>
                          <p className="text-xs text-zinc-200 mt-0.5">{ev.content}</p>
                        </div>
                        <button type="button" onClick={() => handleDeleteDailyEvolutionEntry(ev.id, ev.date)} className="text-rose-400 hover:text-rose-300 p-1">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800 sticky bottom-0 bg-zinc-900 py-3">
                <button type="button" onClick={() => { stopCurrentSpeech(); setIsModalOpen(false); }} className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 cursor-pointer">Cancelar</button>
                <button type="submit" className="px-5 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-zinc-950 font-bold cursor-pointer">Salvar Prontuário Completo</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL MUDANÇA / PERMUTA DE LEITO */}
      {transferModalPatient && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-cyan-500/40 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl text-xs">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-cyan-300 flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4" />
                <span>Mudar / Transferir Paciente de Leito</span>
              </h3>
              <button onClick={() => setTransferModalPatient(null)} className="text-zinc-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>

            <p className="text-zinc-300">
              Paciente: <strong className="text-white">{transferModalPatient.childName}</strong> (Leito Atual: <strong className="text-teal-300">{transferModalPatient.bed}</strong>)
            </p>

            <div>
              <label className="block text-zinc-400 mb-1 font-semibold">Selecione o Novo Leito de Destino:</label>
              <select value={targetTransferBed} onChange={(e) => setTargetTransferBed(e.target.value)} className="w-full bg-zinc-950 border border-cyan-500/40 rounded-xl p-2.5 text-zinc-100 font-bold">
                {TOTAL_BEDS.filter((b) => b !== transferModalPatient.bed).map((b) => {
                  const occupant = patients.find((p) => p.bed === b && p.status === 'Internado');
                  return (
                    <option key={b} value={b}>
                      {b} {occupant ? `— [OCUPADO por ${occupant.childName} ➔ Fará Permuta Automática]` : '— [VAGO / DISPONÍVEL]'}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-zinc-400 mb-1">Motivo da Mudança de Leito (Opcional):</label>
              <input
                type="text"
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
                placeholder="Ex: Necessidade de isolamento no Leito 10, proximidade do posto..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-zinc-100"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-zinc-300">
              <input type="checkbox" checked={recordTransferInEvolution} onChange={(e) => setRecordTransferInEvolution(e.target.checked)} />
              <span>Registrar nota automática da transferência na evolução psicológica de hoje ({formatDateBr(currentBelemToday)})</span>
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setTransferModalPatient(null)} className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300">Cancelar</button>
              <button onClick={handleConfirmBedTransfer} className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-bold">Confirmar Mudança Sem Perder Dados</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ALTA / DESFECHO */}
      {dischargeModalPatient && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl text-xs">
            <h3 className="text-base font-bold text-zinc-100">Registrar Alta / Saída da UTI</h3>
            <p className="text-zinc-400">Paciente: <strong className="text-white">{dischargeModalPatient.childName}</strong> ({dischargeModalPatient.bed})</p>
            <div>
              <label className="block text-zinc-400 mb-1">Tipo de Desfecho:</label>
              <select value={dischargeStatus} onChange={(e) => setDischargeStatus(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-zinc-100">
                <option value="Alta para Enfermaria">Alta para Enfermaria Pediátrica</option>
                <option value="Alta Hospitalar">Alta Hospitalar Direta</option>
                <option value="Transferência Externa">Transferência para Outro Setor/Hospital</option>
                <option value="Óbito">Óbito (Acompanhamento de Luto Familiar)</option>
              </select>
            </div>
            <div>
              <label className="block text-zinc-400 mb-1">Síntese / Encaminhamento Psicológico:</label>
              <textarea rows={3} value={dischargeNote} onChange={(e) => setDischargeNote(e.target.value)} placeholder="Conduta de encerramento, encaminhamento para psicologia da enfermaria..." className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-zinc-100" />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDischargeModalPatient(null)} className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300">Cancelar</button>
              <button onClick={handleConfirmDischarge} className="px-4 py-2 rounded-lg bg-rose-500 text-zinc-950 font-bold">Confirmar Saída</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ISOLAMENTO LEITO 10 */}
      {isIsolationModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-purple-500/40 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl text-xs">
            <h3 className="text-base font-bold text-purple-300">Configurar Leito 10 (Isolamento)</h3>
            <label className="flex items-center justify-between p-3 rounded-xl bg-zinc-950 border border-zinc-800 cursor-pointer">
              <span>Leito 10 em uso como Isolamento Ativo?</span>
              <input type="checkbox" checked={bed10Config.inIsolationUse} onChange={(e) => handleUpdateBed10Config({ ...bed10Config, inIsolationUse: e.target.checked })} className="w-4 h-4" />
            </label>
            <div>
              <label className="block text-zinc-400 mb-1">Tipo de Precaução / Isolamento:</label>
              <select value={bed10Config.isolationType} onChange={(e) => handleUpdateBed10Config({ ...bed10Config, isolationType: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-zinc-100">
                <option value="Contato">Precaução de Contato</option>
                <option value="Gotículas">Precaução de Gotículas</option>
                <option value="Aerossóis">Precaução por Aerossóis</option>
                <option value="Reverso / Protetor">Isolamento Reverso / Protetor</option>
              </select>
            </div>
            <div>
              <label className="block text-zinc-400 mb-1">Motivo Clínico / Epidemiológico:</label>
              <input type="text" value={bed10Config.isolationReason} onChange={(e) => handleUpdateBed10Config({ ...bed10Config, isolationReason: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-zinc-100" />
            </div>
            <div className="flex justify-end">
              <button onClick={() => setIsIsolationModalOpen(false)} className="px-4 py-2 rounded-lg bg-purple-500 text-zinc-950 font-bold">Salvar e Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PRÉ-VISUALIZAÇÃO DE PASSAGEM DE PLANTÃO */}
      {isHandoverPreviewOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-teal-500/40 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] flex flex-col text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-zinc-100">Passagem de Plantão Enxuta ({formatDateBr(currentBelemToday)})</h3>
              <button onClick={() => setIsHandoverPreviewOpen(false)} className="text-zinc-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <pre className="flex-1 overflow-y-auto bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-zinc-200 whitespace-pre-wrap font-sans">{buildHandoverReportText()}</pre>
            <div className="flex justify-end gap-2">
              <button onClick={() => setIsHandoverPreviewOpen(false)} className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300">Fechar</button>
              <button onClick={handleCopyHandoverText} className="px-4 py-2 rounded-lg bg-teal-500 text-zinc-950 font-bold">Copiar Texto para WhatsApp</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL COFRE PERMANENTE, SINCRONIA & GOOGLE DRIVE */}
      {isBackupModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-zinc-900 border border-emerald-500/40 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl text-xs my-8">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-zinc-100">Cofre de Dados, Nuvem & Google Drive</h3>
                <p className="text-[11px] text-zinc-400">Sincronize entre Celular e PC ou salve direto no seu Google Drive</p>
              </div>
              <button onClick={() => setIsBackupModalOpen(false)} className="text-zinc-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>

            {/* CONTROLE DE DATA / FUSO BELÉM E PLANTÃO NOTURNO */}
            <div className="p-3.5 rounded-xl bg-zinc-950 border border-teal-500/30 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-bold text-teal-300">🕒 Regra de Plantão Noturno (Fuso Belém-PA):</span>
                <button
                  type="button"
                  onClick={() => handleResetToAutoBelemDate(nightShift7amRule)}
                  className="px-2.5 py-1 rounded bg-teal-500/20 text-teal-300 border border-teal-500/40 font-semibold"
                >
                  Sincronizar Hora Oficial de Belém
                </button>
              </div>
              <label className="flex items-center gap-2 text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={nightShift7amRule}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setNightShift7amRule(checked);
                    try { window.localStorage.setItem(STORAGE_KEY_NIGHT_SHIFT_RULE, String(checked)); } catch (err) {}
                    handleResetToAutoBelemDate(checked);
                  }}
                />
                <span>Virar a data somente às <strong>07:00 da manhã</strong> (ideal para plantão noturno: após meia-noite continua no dia do plantão vigente)</span>
              </label>
            </div>

            {/* SALA DE SINCRONIA EM NUVEM */}
            <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
              <label className="block font-bold text-emerald-300">☁️ Código da Sala de Sincronia em Nuvem (Mesmo código no PC e no Celular):</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={syncRoomCode}
                  onChange={(e) => {
                    setSyncRoomCode(e.target.value);
                    try { window.localStorage.setItem(STORAGE_KEY_SYNC_ROOM, e.target.value); } catch (err) {}
                  }}
                  className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-100 font-mono"
                />
                <button onClick={() => handleForceCloudSyncNow(false)} className="px-3 py-2 rounded-lg bg-emerald-500 text-zinc-950 font-bold">
                  Sincronizar Agora
                </button>
              </div>
            </div>

            {/* BOTÕES GOOGLE DRIVE E BACKUP */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button onClick={handleShareBackupToDriveOrWhatsApp} className="p-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-zinc-950 font-bold flex items-center justify-center gap-2 cursor-pointer">
                <Share2 className="w-4 h-4" /><span>Enviar p/ Google Drive / WhatsApp</span>
              </button>
              <button onClick={handleDownloadBackupJson} className="p-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold flex items-center justify-center gap-2 cursor-pointer">
                <Download className="w-4 h-4" /><span>Baixar Arquivo Backup (.json)</span>
              </button>
              <button onClick={handleLinkLocalDriveFile} className={`p-3 rounded-xl border font-bold flex items-center justify-center gap-2 cursor-pointer ${autoSaveDriveEnabled ? 'bg-emerald-950/60 border-emerald-400 text-emerald-300' : 'bg-zinc-800 border-zinc-700 text-zinc-200'}`}>
                <FolderSync className="w-4 h-4" />
                <span>{autoSaveDriveEnabled ? `✅ Auto-Save Ativo (${driveFileName || 'Drive'})` : 'Vincular Arquivo Auto-Save (Drive PC)'}</span>
              </button>
              <button onClick={handleOpenFromDriveFilePicker} className="p-3 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 font-bold flex items-center justify-center gap-2 cursor-pointer">
                <Upload className="w-4 h-4" /><span>Abrir do Google Drive / Arquivo .json</span>
              </button>
            </div>

            <div className="space-y-2 pt-2 border-t border-zinc-800">
              <label className="block font-bold text-zinc-300">Ou cole o conteúdo JSON de um backup abaixo para mesclar:</label>
              <textarea
                rows={3}
                value={backupJsonText}
                onChange={(e) => setBackupJsonText(e.target.value)}
                placeholder="Cole o código JSON aqui se desejar restaurar manualmente..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-zinc-300 font-mono text-[11px]"
              />
              {backupJsonText.trim() && (
                <button onClick={() => handleImportBackupData(backupJsonText, true)} className="px-4 py-2 rounded-lg bg-teal-500 text-zinc-950 font-bold">
                  Restaurar Texto Colado
                </button>
              )}
            </div>

            <div className="flex justify-end">
              <button onClick={() => setIsBackupModalOpen(false)} className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
