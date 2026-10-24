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
  History
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

// Inicialização híbrida: usa seu banco censo-uti-pediatica em produção (PWA/Android/PC)
// e mantém compatibilidade caso rode dentro do preview
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
  isolationType: "Contato", // 'Contato' | 'Gotículas' | 'Aerossóis' | 'Protetor / Neutropenia'
  isolationReason: "Precaução de contato por vigilância epidemiológica pós-drenagem torácica",
  updatedAtMs: 1700000000000
};

// Utilitário de Máscara Automática para Telefone Brasileiro (XX) 9XXXX-XXXX
function formatPhoneMask(raw) {
  if (!raw) return '';
  const digits = String(raw).replace(/\D/g, '').slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

// Gerador de Link Direto para WhatsApp
function getWhatsAppLink(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length < 10) return null;
  const fullNumber = digits.startsWith('55') ? digits : `55${digits}`;
  return `https://wa.me/${fullNumber}`;
}

// Cálculo automático de idade detalhada a partir da Data de Nascimento (YYYY-MM-DD)
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

// Formata data YYYY-MM-DD para DD/MM/YYYY
function formatDateBr(dateStr) {
  if (!dateStr) return 'N/I';
  const parts = String(dateStr).split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

// Casos clínicos iniciais realistas do Estado do Pará
const SEED_PATIENTS = [
  {
    id: "pat-leito-01",
    bed: "Leito 01",
    childName: "Arthur Gabriel Barreto Silva",
    childBirthDate: "2025-06-15",
    childAgeText: "1 ano e 4 meses",
    naturalness: "Santarém - PA",
    originCity: "Santarém",
    originState: "PA",
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
        date: new Date().toISOString().split('T')[0],
        time: "08:40",
        content: "Acolhimento da genitora à beira-leito. Angústia pelo afastamento do filho mais velho em Santarém. Pactuada escuta ativa matinal e videochamada diária com o pai.",
        author: "Psicologia UTI"
      }
    ],
    psychNotes: "Acolhimento da genitora à beira-leito. Angústia pelo afastamento do filho mais velho em Santarém. Pactuada escuta ativa matinal e videochamada diária com o pai.",
    dischargeDate: null,
    dischargeNote: "",
    updatedAtMs: 1729500000000
  },
  {
    id: "pat-leito-02",
    bed: "Leito 02",
    childName: "Sophia Helena de Oliveira Santos",
    childBirthDate: "2021-09-10",
    childAgeText: "5 anos e 1 mês",
    naturalness: "Belém - PA",
    originCity: "Belém",
    originState: "PA",
    cardiacDiagnosis: "Tetralogia de Fallot (aguardando correção cirúrgica definitiva)",
    admissionDate: "2026-10-21",
    status: "Internado",
    currentCompanion: "Avó Materna",
    companionName: "Raimunda Nonata de Oliveira",
    companionKinship: "Avó Materna",
    companionAge: 58,
    companionPhone: "(91) 99874-2130",
    companionEducation: "Ensino Fundamental Completo",
    companionReligion: "Católica",
    companionProfession: "Costureira Aposentada",
    mother: {
      name: "Camila de Oliveira Santos",
      age: 29,
      phone: "(91) 98812-3344",
      education: "Ensino Superior Completo",
      religion: "Evangélica / Protestante",
      profession: "Professora da Educação Infantil",
      hasPsych: true,
      psychDetails: "Em acompanhamento regular no CAPS por Transtorno de Pânico (uso de Escitalopram 15mg); reveza turnos no hospital com a avó materna."
    },
    father: {
      name: "Rodrigo Ferreira Santos",
      age: 32,
      phone: "(91) 98755-6012",
      education: "Ensino Médio Completo",
      religion: "Evangélica / Protestante",
      profession: "Técnico em Refrigeração",
      hasPsych: false,
      psychDetails: "Sem histórico psiquiátrico prévio. Comparece nas visitas vespertinas após o expediente."
    },
    childMentalHealth: {
      hasCondition: true,
      details: "TEA Nível 1 de suporte pré-diagnosticado. Hiper-reatividade sensorial a ruídos de bombas de infusão e luz branca intensa."
    },
    dailyEvolutions: [
      {
        id: "evo-seed-2",
        date: new Date().toISOString().split('T')[0],
        time: "09:15",
        content: "Admissão da manhã. Orientada equipe multiprofissional sobre manejo sensorial no leito e permitido objeto transicional da criança.",
        author: "Psicologia UTI"
      }
    ],
    psychNotes: "Admissão da manhã. Orientada equipe multiprofissional sobre manejo sensorial no leito e permitido objeto transicional da criança.",
    dischargeDate: null,
    dischargeNote: "",
    updatedAtMs: 1729500001000
  },
  {
    id: "pat-leito-03",
    bed: "Leito 03",
    childName: "Davi Lucas Mendes Pereira",
    childBirthDate: "2026-02-14",
    childAgeText: "8 meses",
    naturalness: "Belém - PA",
    originCity: "Abaetetuba",
    originState: "PA",
    cardiacDiagnosis: "Transposição das Grandes Artérias (Pós-op Cirurgia de Jatene D+4)",
    admissionDate: "2026-10-14",
    status: "Internado",
    currentCompanion: "Pai",
    companionName: "",
    companionKinship: "",
    companionAge: "",
    companionPhone: "",
    companionEducation: "Não informado",
    companionReligion: "Não informado",
    companionProfession: "",
    mother: {
      name: "Juliana Mendes Pereira",
      age: 28,
      phone: "(91) 99120-5544",
      education: "Ensino Médio Incompleto",
      religion: "Evangélica / Protestante",
      profession: "Do Lar / Agricultora Familiar",
      hasPsych: true,
      psychDetails: "Puerpério tardio permeado por luto gestacional anterior e sintomas depressivos moderados."
    },
    father: {
      name: "Carlos Eduardo Pereira",
      age: 31,
      phone: "(91) 99144-8899",
      education: "Ensino Fundamental Completo",
      religion: "Católica",
      profession: "Carpinteiro Naval",
      hasPsych: true,
      psychDetails: "Histórico de Depressão Maior em uso contínuo de Sertralina 50mg. Sobrecarga emocional intensa."
    },
    childMentalHealth: {
      hasCondition: false,
      details: "Lactente em desmame progressivo de sedoanalgesia, sem achados psicopatológicos."
    },
    dailyEvolutions: [
      {
        id: "evo-seed-3",
        date: new Date().toISOString().split('T')[0],
        time: "09:50",
        content: "Genitor acompanhando hoje pela manhã. Verbaliza medo intenso de intercorrências no desmame ventilatório. Realizada intervenção de suporte e validação emocional.",
        author: "Psicologia UTI"
      }
    ],
    psychNotes: "Genitor acompanhando hoje pela manhã. Verbaliza medo intenso de intercorrências no desmame ventilatório. Realizada intervenção de suporte e validação emocional.",
    dischargeDate: null,
    dischargeNote: "",
    updatedAtMs: 1729500002000
  },
  {
    id: "pat-leito-05",
    bed: "Leito 05",
    childName: "Maria Flor Pinheiro Lobato",
    childBirthDate: "2022-09-12",
    childAgeText: "4 anos e 1 mês",
    naturalness: "Marabá - PA",
    originCity: "Marabá",
    originState: "PA",
    cardiacDiagnosis: "Defeito do Septo Atrioventricular Total (Pós-operatório D+2)",
    admissionDate: "2026-10-19",
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
      name: "Fernanda Pinheiro Lobato",
      age: 34,
      phone: "(94) 98115-2200",
      education: "Pós-Graduação",
      religion: "Espírita",
      profession: "Contadora",
      hasPsych: false,
      psychDetails: "Boa organização psíquica e enfrentamento adaptativo até o momento."
    },
    father: {
      name: "Marcelo Lobato",
      age: 37,
      phone: "(94) 98119-3300",
      education: "Ensino Superior Completo",
      religion: "Católica",
      profession: "Analista Administrativo",
      hasPsych: false,
      psychDetails: "Sem queixas psiquiátricas; presente nas visitas e suporte à esposa."
    },
    childMentalHealth: {
      hasCondition: true,
      details: "Síndrome de Down (T21). Ansiedade de separação acentuada quando a mãe se ausenta brevemente."
    },
    dailyEvolutions: [
      {
        id: "evo-seed-5",
        date: new Date().toISOString().split('T')[0],
        time: "10:20",
        content: "Realizado preparo lúdico para retirada de dreno mediastinal e fortalecimento do vínculo mãe-equipe.",
        author: "Psicologia UTI"
      }
    ],
    psychNotes: "Realizado preparo lúdico para retirada de dreno mediastinal e fortalecimento do vínculo mãe-equipe.",
    dischargeDate: null,
    dischargeNote: "",
    updatedAtMs: 1729500003000
  },
  {
    id: "pat-leito-10",
    bed: "Leito 10",
    childName: "Enzo Miguel Costa Farias",
    childBirthDate: "2024-03-10",
    childAgeText: "2 anos e 7 meses",
    naturalness: "Bragança - PA",
    originCity: "Bragança",
    originState: "PA",
    cardiacDiagnosis: "Anomalia de Ebstein + Pós-operatório de Glenn Bidirecional",
    admissionDate: "2026-10-16",
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
      name: "Patrícia Costa Farias",
      age: 25,
      phone: "(91) 98433-1020",
      education: "Ensino Fundamental Incompleto",
      religion: "Católica",
      profession: "Marisqueira / Pescadora",
      hasPsych: true,
      psychDetails: "Exaustão emocional severa pelo confinamento em quarto de isolamento; queixa de choro fácil e claustrofobia."
    },
    father: {
      name: "Antônio Marcos Farias",
      age: 29,
      phone: "(91) 98455-7080",
      education: "Ensino Fundamental Incompleto",
      religion: "Católica",
      profession: "Pescador Artesanal",
      hasPsych: false,
      psychDetails: "Pescador artesanal em Bragança; dificuldade de deslocamento até a capital."
    },
    childMentalHealth: {
      hasCondition: false,
      details: "Irritabilidade reativa à restrição no box de isolamento."
    },
    dailyEvolutions: [
      {
        id: "evo-seed-10",
        date: new Date().toISOString().split('T')[0],
        time: "11:00",
        content: "Atendimento psicológico paramentado no Leito 10 (Isolamento). Pactuado rodízio assistido para que a mãe possa sair 20 minutos para respirar e tomar café.",
        author: "Psicologia UTI"
      }
    ],
    psychNotes: "Atendimento psicológico paramentado no Leito 10 (Isolamento). Pactuado rodízio assistido para que a mãe possa sair 20 minutos para respirar e tomar café.",
    dischargeDate: null,
    dischargeNote: "",
    updatedAtMs: 1729500004000
  }
];

// Normalizador de registros para garantir retrocompatibilidade total e migração de evoluções diárias
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
    hasCondition: Boolean(
      p.childMentalHealth?.hasCondition ??
      p.childHasMentalHealth ??
      p.childPsychFlag ??
      p.hasChildPsych ??
      false
    ),
    details:
      p.childMentalHealth?.details ??
      p.childMentalHealthDetails ??
      p.childPsychDetails ??
      p.childMentalDetails ??
      ''
  };

  const legacyPsychNotes = (p.psychNotes || p.notes || '').trim();
  const admissionDate = p.admissionDate || new Date().toISOString().split('T')[0];

  // Normaliza e migra evoluções diárias separadas por data
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
    childAgeText: p.childAgeText || p.childAge || p.age || computedAge || '',
    naturalness: p.naturalness || (p.originCity ? `${p.originCity} - ${p.originState || 'PA'}` : ''),
    originCity: p.originCity || p.city || '',
    originState: p.originState || p.state || 'PA',
    cardiacDiagnosis: p.cardiacDiagnosis || p.diagnosis || '',
    admissionDate,
    status: p.status || 'Internado',
    currentCompanion: currentCompanionSummary,
    currentCompanionsList,
    extraBedsideVisitors,
    companionNotes: p.companionNotes || '',
    companionName: p.companionName || (isLegacyOther ? flatCaregiverName : ''),
    companionKinship: p.companionKinship || (isLegacyOther ? legacyKinship : ''),
    companionAge: p.companionAge ?? (isLegacyOther ? flatCaregiverAge : ''),
    companionPhone: formatPhoneMask(p.companionPhone || (isLegacyOther ? flatCaregiverPhone : '')),
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
    updatedAtMs: Number(p.updatedAtMs || p.updatedAt || Date.now())
  };
}

// Ordenador canônico por número do leito (Leito 01 -> Leito 10)
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

// Mescla duas listas de pacientes de forma determinística
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
          if (!evoMap.has(key)) {
            evoMap.set(key, ev);
          }
        });
        const mergedEvolutions = Array.from(evoMap.values()).sort((a, b) =>
          `${b.date}T${b.time || '00:00'}`.localeCompare(`${a.date}T${a.time || '00:00'}`)
        );

        const transferMap = new Map();
        [...(existing.bedTransferHistory || []), ...(item.bedTransferHistory || [])].forEach((tr) => {
          if (!tr) return;
          const tKey = `${tr.date || ''}-${tr.time || ''}-${tr.fromBed || ''}-${tr.toBed || ''}`;
          if (!transferMap.has(tKey)) transferMap.set(tKey, tr);
        });
        const mergedTransfers = Array.from(transferMap.values());

        const winner = (item.updatedAtMs || 0) >= (existing.updatedAtMs || 0) ? item : existing;
        map.set(item.id, {
          ...winner,
          dailyEvolutions: mergedEvolutions,
          bedTransferHistory: mergedTransfers,
          psychNotes: mergedEvolutions[0]?.content || winner.psychNotes || ''
        });
      }
    });
  };

  processList(listA);
  processList(listB);

  return sortPatientsByBedNumber(Array.from(map.values()));
}

// ============================================================================
// MOTOR DE MIGRAÇÃO E CONSOLIDAÇÃO AUTOMÁTICA DE DADOS SALVOS (ZERO PERDA)
// ============================================================================
function loadAndMigrateLegacyData() {
  let accumulated = [];
  let migratedFromLegacyCount = 0;

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
        if (key !== STORAGE_KEY_PATIENTS) migratedFromLegacyCount += parsed.length;
        accumulated = mergePatientListsSmart(accumulated, parsed);
      } catch (innerErr) {
        console.warn(`Aviso ao ler chave ${key}:`, innerErr);
      }
    });

    if (accumulated.length > 0) {
      window.localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify(accumulated));
      window.localStorage.setItem(STORAGE_KEY_INIT_FLAG, 'true');
      return {
        patients: accumulated,
        migratedCount: migratedFromLegacyCount,
        isFirstRunEver: false
      };
    }

    const alreadyInitialized = window.localStorage.getItem(STORAGE_KEY_INIT_FLAG) === 'true';
    if (!alreadyInitialized) {
      const normalizedSeeds = SEED_PATIENTS.map(normalizePatientRecord);
      window.localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify(normalizedSeeds));
      window.localStorage.setItem(STORAGE_KEY_INIT_FLAG, 'true');
      return {
        patients: normalizedSeeds,
        migratedCount: 0,
        isFirstRunEver: true
      };
    }

    return {
      patients: [],
      migratedCount: 0,
      isFirstRunEver: false
    };
  } catch (err) {
    console.error("Erro na migração preventiva:", err);
    return {
      patients: SEED_PATIENTS.map(normalizePatientRecord),
      migratedCount: 0,
      isFirstRunEver: false
    };
  }
}

function loadPermanentBed10Config() {
  try {
    const direct = window.localStorage.getItem(STORAGE_KEY_BED10);
    if (direct) return { ...INITIAL_BED10_CONFIG, ...JSON.parse(direct) };
  } catch (e) {
    console.warn("Aviso ao carregar config Leito 10:", e);
  }
  return INITIAL_BED10_CONFIG;
}

function matchSpokenEducation(segment) {
  if (!segment) return null;
  const s = segment.toLowerCase();
  if (s.includes('pós-graduação') || s.includes('pos-graduacao') || s.includes('pós graduação') || s.includes('especialização') || s.includes('mestrado')) {
    return "Pós-Graduação";
  }
  if (s.includes('superior incompleto') || s.includes('faculdade incompleta')) return "Ensino Superior Incompleto";
  if (s.includes('superior completo') || s.includes('ensino superior') || s.includes('graduada') || s.includes('graduado') || s.includes('faculdade completa')) {
    return "Ensino Superior Completo";
  }
  if (s.includes('médio incompleto') || s.includes('medio incompleto')) return "Ensino Médio Incompleto";
  if (s.includes('médio completo') || s.includes('medio completo') || s.includes('ensino médio') || s.includes('segundo grau')) {
    return "Ensino Médio Completo";
  }
  if (s.includes('fundamental incompleto') || s.includes('primeiro grau incompleto')) return "Ensino Fundamental Incompleto";
  if (s.includes('fundamental completo') || s.includes('ensino fundamental')) return "Ensino Fundamental Completo";
  if (s.includes('analfabeto') || s.includes('analfabeta') || s.includes('sem escolaridade')) return "Analfabeto";
  return null;
}

function matchSpokenReligion(segment) {
  if (!segment) return null;
  const s = segment.toLowerCase();
  if (s.includes('católic') || s.includes('catolic')) return "Católica";
  if (s.includes('evangélic') || s.includes('evangelic') || s.includes('protestante') || s.includes('assembleia') || s.includes('batista') || s.includes('universal') || s.includes('pentecostal') || s.includes('crente')) {
    return "Evangélica / Protestante";
  }
  if (s.includes('espírita') || s.includes('espirita') || s.includes('kardecista')) return "Espírita";
  if (s.includes('umbanda') || s.includes('umbandista')) return "Umbanda";
  if (s.includes('candomblé') || s.includes('candomble') || s.includes('matriz africana')) return "Candomblé / Matriz Africana";
  if (s.includes('testemunha de jeová') || s.includes('testemunhas de jeová') || s.includes('testemunha de jeova')) return "Testemunhas de Jeová";
  if (s.includes('adventista')) return "Adventista";
  if (s.includes('mórmon') || s.includes('mormon') || s.includes('santos dos últimos dias')) return "Mórmon (Santos dos Últimos Dias)";
  if (s.includes('judaic') || s.includes('judeu') || s.includes('judia')) return "Judaica";
  if (s.includes('budista') || s.includes('budismo')) return "Budista";
  if (s.includes('islâmic') || s.includes('islamic') || s.includes('muçulman')) return "Islâmica";
  if (s.includes('indígena') || s.includes('indigena')) return "Tradições Indígenas";
  if (s.includes('sem religião') || s.includes('ateu') || s.includes('ateia') || s.includes('agnóstic')) return "Sem Religião (Agnóstico / Ateu)";
  return null;
}

// Parser heurístico de linguagem natural para ditado por voz em Português (pt-BR)
function parseMedicalSpeech(rawText) {
  if (!rawText || typeof rawText !== 'string') return {};
  const text = rawText.trim();
  const lower = text.toLowerCase();
  const parsed = {
    mother: {},
    father: {}
  };

  if (/leito\s*(?:de\s*)?isolamento|quarto\s*(?:de\s*)?isolamento|box\s*de\s*isolamento|isolamento|leito\s*dez/i.test(lower)) {
    parsed.bed = "Leito 10";
  } else {
    const bedWordMap = {
      'um': '01', 'dois': '02', 'três': '03', 'tres': '03', 'quatro': '04',
      'cinco': '05', 'seis': '06', 'sete': '07', 'oito': '08', 'nove': '09', 'dez': '10'
    };
    const bedMatch = text.match(/(?:leito|box|cama|vaga)\s*(?:nº|número|de\s*número)?\s*([0-9]{1,2}|zero\s*[0-9]|[a-zçãõ]+)/i);
    if (bedMatch) {
      const matchWord = bedMatch[1].toLowerCase().replace(/zero\s*/i, '');
      if (bedWordMap[matchWord]) {
        parsed.bed = `Leito ${bedWordMap[matchWord]}`;
      } else if (!isNaN(parseInt(matchWord, 10))) {
        const num = Math.min(10, Math.max(1, parseInt(matchWord, 10)));
        parsed.bed = `Leito ${num.toString().padStart(2, '0')}`;
      }
    }
  }

  const childNameMatch = text.match(/(?:criança|paciente|menino|menina|bebê|bebe|lactente)\s*(?:chamado|chamada|de\s+nome|nome)?\s*:?\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+(?:\s+(?:de|da|do|dos|das|e)?\s*[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+){1,5})/i);
  if (childNameMatch) {
    parsed.childName = childNameMatch[1].replace(/\s+(?:com|idade|nascido|nascida|natural|procedente|vindo|diagnóstico|mãe|pai)$/i, '').trim();
  }

  const birthMatch = text.match(/(?:nascid[oa]\s+em|data\s+de\s+nascimento)\s*:?\s*([0-3]?[0-9])[\/\-]([0-1]?[0-9])[\/\-]([12][0-9]{3})/i);
  if (birthMatch) {
    const d = birthMatch[1].padStart(2, '0');
    const m = birthMatch[2].padStart(2, '0');
    const y = birthMatch[3];
    parsed.childBirthDate = `${y}-${m}-${d}`;
    parsed.childAgeText = calculateAgeFromBirthDate(parsed.childBirthDate);
  }

  const childAgeMatch = text.match(/(?:idade da criança|criança com|criança tem|com idade de|idade de)\s*([0-9]{1,2}\s*(?:anos?|meses|mês|dias?)(?:\s*(?:e\s*)?[0-9]{1,2}\s*(?:meses|mês|dias?))?)/i);
  if (childAgeMatch) {
    parsed.childAgeText = childAgeMatch[1].trim();
  } else if (!parsed.childAgeText) {
    const generalAgeMatch = text.match(/([0-9]{1,2}\s*(?:anos?|meses|mês)(?:\s*e\s*[0-9]{1,2}\s*(?:meses|mês))?)/i);
    if (generalAgeMatch) {
      parsed.childAgeText = generalAgeMatch[1].trim();
    }
  }

  const natMatch = text.match(/(?:natural\s+de|naturalidade)\s*:?\s*([A-Za-zÀ-ÖØ-öø-ÿ\s]+?)(?:,|-|\.|;|procedente|residente|mãe|pai|diagnóstico)/i);
  if (natMatch) {
    parsed.naturalness = natMatch[1].trim();
  }

  const originMatch = text.match(/(?:procedente(?:s)? de|vindos? de|residente em|origem|município de|cidade de)\s*([A-Za-zÀ-ÖØ-öø-ÿ\s]+?)(?:,|-|\s+no|\s+estado|\s+pará|\s+pa|\s+amapá|\s+ap|\s+maranhão|\s+ma|\.|;)/i);
  if (originMatch) {
    parsed.originCity = originMatch[1].trim().replace(/\s+(pa|pará|ap|amapá|ma|maranhão)$/i, '');
  } else {
    const commonCities = [
      'Belém', 'Ananindeua', 'Santarém', 'Marabá', 'Abaetetuba', 'Castanhal', 'Barcarena',
      'Altamira', 'Tucuruí', 'Paragominas', 'Bragança', 'Cametá', 'Breves', 'Capanema',
      'Redenção', 'Itaituba', 'Salinópolis', 'Tailândia', 'Parauapebas', 'Macapá', 'Imperatriz'
    ];
    for (const city of commonCities) {
      if (lower.includes(city.toLowerCase())) {
        parsed.originCity = city;
        break;
      }
    }
  }

  if (/amapá|\bap\b/i.test(lower)) {
    parsed.originState = 'AP';
  } else if (/maranhão|\bma\b/i.test(lower)) {
    parsed.originState = 'MA';
  } else if (/amazonas|\bam\b/i.test(lower)) {
    parsed.originState = 'AM';
  } else {
    parsed.originState = 'PA';
  }

  const motherNameMatch = text.match(/(?:mãe|mae|genitora)\s*(?:chamada|de\s+nome|nome)?\s*:?\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+(?:\s+(?:de|da|do|dos|das)?\s*[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+){1,4})/i);
  if (motherNameMatch) {
    parsed.mother.name = motherNameMatch[1].replace(/\s+(?:com|tem|idade|telefone|profissão|escolaridade|relata|apresenta)$/i, '').trim();
  }
  const motherAgeMatch = text.match(/(?:mãe|mae|genitora)[^.;]{0,45}?\b([1-6][0-9])\s*anos/i);
  if (motherAgeMatch) parsed.mother.age = motherAgeMatch[1];

  const motherPhoneMatch = text.match(/(?:telefone da mãe|celular da mãe|whatsapp da mãe|contato da mãe|mãe[^.;]{0,35}?(?:telefone|celular|whatsapp|contato|fone))\s*:?\s*((?:\(?0?[1-9]{2}\)?\s*)?9?\s*[0-9]{4}[-\s]?[0-9]{4})/i);
  if (motherPhoneMatch) parsed.mother.phone = formatPhoneMask(motherPhoneMatch[1]);

  const motherProfMatch = text.match(/(?:profissão da mãe|ocupação da mãe|mãe trabalha como|mãe é)\s*:?\s*([^,.;]+)/i);
  if (motherProfMatch) parsed.mother.profession = motherProfMatch[1].trim();

  const motherEduSegment = text.match(/(?:escolaridade da mãe|mãe possui|mãe com)\s*([^,.;]+)/i);
  if (motherEduSegment) {
    const edu = matchSpokenEducation(motherEduSegment[1]);
    if (edu) parsed.mother.education = edu;
  }

  const motherRelSegment = text.match(/(?:religião da mãe|mãe de religião|mãe é)\s*([^,.;]+)/i);
  if (motherRelSegment) {
    const rel = matchSpokenReligion(motherRelSegment[1]);
    if (rel) parsed.mother.religion = rel;
  }

  const fatherNameMatch = text.match(/(?:pai|genitor)\s*(?:chamado|de\s+nome|nome)?\s*:?\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+(?:\s+(?:de|da|do|dos|das)?\s*[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+){1,4})/i);
  if (fatherNameMatch) {
    parsed.father.name = fatherNameMatch[1].replace(/\s+(?:com|tem|idade|telefone|profissão|escolaridade|relata|apresenta)$/i, '').trim();
  }
  const fatherAgeMatch = text.match(/(?:pai|genitor)[^.;]{0,45}?\b([1-7][0-9])\s*anos/i);
  if (fatherAgeMatch) parsed.father.age = fatherAgeMatch[1];

  const fatherPhoneMatch = text.match(/(?:telefone do pai|celular do pai|whatsapp do pai|contato do pai|pai[^.;]{0,35}?(?:telefone|celular|whatsapp|contato|fone))\s*:?\s*((?:\(?0?[1-9]{2}\)?\s*)?9?\s*[0-9]{4}[-\s]?[0-9]{4})/i);
  if (fatherPhoneMatch) parsed.father.phone = formatPhoneMask(fatherPhoneMatch[1]);

  const fatherProfMatch = text.match(/(?:profissão do pai|ocupação do pai|pai trabalha como|pai é)\s*:?\s*([^,.;]+)/i);
  if (fatherProfMatch) parsed.father.profession = fatherProfMatch[1].trim();

  const fatherEduSegment = text.match(/(?:escolaridade do pai|pai possui|pai com)\s*([^,.;]+)/i);
  if (fatherEduSegment) {
    const edu = matchSpokenEducation(fatherEduSegment[1]);
    if (edu) parsed.father.education = edu;
  }

  const fatherRelSegment = text.match(/(?:religião do pai|pai de religião|pai é)\s*([^,.;]+)/i);
  if (fatherRelSegment) {
    const rel = matchSpokenReligion(fatherRelSegment[1]);
    if (rel) parsed.father.religion = rel;
  }

  const cardiacMatch = text.match(/(?:diagnóstico|cardiopatia|quadro cardiológico|pós-operatório de|portador de)\s*:?\s*([^.;]+)/i);
  if (cardiacMatch) {
    parsed.cardiacDiagnosis = cardiacMatch[1].trim();
  }

  const motherMentalMatch = text.match(/(?:mãe|mae|genitora)\s*(?:relata|apresenta|possui|com histórico de|com diagnóstico de|em tratamento para|faz uso de)\s*([^.;]+)/i);
  if (motherMentalMatch && !/nega|sem queixas/i.test(motherMentalMatch[1])) {
    parsed.mother.hasPsych = true;
    parsed.mother.psychDetails = motherMentalMatch[1].trim();
  }

  const fatherMentalMatch = text.match(/(?:pai|genitor)\s*(?:relata|apresenta|possui|com histórico de|com diagnóstico de|em tratamento para|faz uso de)\s*([^.;]+)/i);
  if (fatherMentalMatch && !/nega|sem queixas/i.test(fatherMentalMatch[1])) {
    parsed.father.hasPsych = true;
    parsed.father.psychDetails = fatherMentalMatch[1].trim();
  }

  const psychMatch = text.match(/(?:acolhimento|conduta|intervenção|evolução|escuta|observação)\s*:?\s*([^.]+)/i);
  if (psychMatch) {
    parsed.todayEvolutionContent = psychMatch[0].trim();
  }

  return parsed;
}

export default function App() {
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const deviceId = useMemo(() => getOrCreateDeviceId(), []);

  const initialVault = useMemo(() => loadAndMigrateLegacyData(), []);

  // Estados de Autenticação e Sincronia na Nuvem
  const [user, setUser] = useState(null);
  const [cloudStatus, setCloudStatus] = useState('syncing');
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isSyncingManual, setIsSyncingManual] = useState(false);

  // Estados de Modais de Sistema
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
  const [isAiVoiceModalOpen, setIsAiVoiceModalOpen] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isHandoverPreviewOpen, setIsHandoverPreviewOpen] = useState(false);
  const [backupJsonText, setBackupJsonText] = useState('');
  const [confirmRestoreSeeds, setConfirmRestoreSeeds] = useState(false);
  const [uiNotice, setUiNotice] = useState(
    initialVault.migratedCount > 0
      ? `Cofre de Dados Ativo: ${initialVault.patients.length} registros recuperados e protegidos contra perda de atualização.`
      : null
  );

  // Conexão automática com o Firestore (funciona com ou sem login anônimo graças às regras públicas do seu projeto)
  useEffect(() => {
    if (!db) {
      setCloudStatus('offline_demo');
      return;
    }
    if (!isPreviewEnv) {
      setUser({ uid: `pwa-user-${deviceId}` });
      setCloudStatus('connected');
    }
    if (!auth) return;

    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        // Caso o login anônimo esteja desativado no console, opera diretamente via Firestore
        if (!isPreviewEnv) {
          setUser({ uid: `pwa-user-${deviceId}` });
          setCloudStatus('connected');
        } else {
          setCloudStatus('offline_demo');
        }
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setCloudStatus('connected');
      }
    });
    return () => unsubscribe();
  }, [deviceId]);

  // Estados de Pacientes e Configuração do Leito 10
  const [patients, setPatients] = useState(initialVault.patients);
  const [bed10Config, setBed10Config] = useState(() => loadPermanentBed10Config());
  const patientsRefState = useRef(patients);
  const bed10RefState = useRef(bed10Config);

  useEffect(() => {
    patientsRefState.current = patients;
  }, [patients]);

  useEffect(() => {
    bed10RefState.current = bed10Config;
  }, [bed10Config]);

  // Estados de Navegação e Busca
  const [activeTab, setActiveTab] = useState('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState('all');

  // Estados de Sincronia Direta com Arquivo no Google Drive / Dispositivo
  const [driveFileHandle, setDriveFileHandle] = useState(null);
  const [driveFileName, setDriveFileName] = useState('');
  const [autoSaveDriveEnabled, setAutoSaveDriveEnabled] = useState(false);
  const [syncRoomCode, setSyncRoomCode] = useState(() => {
    try {
      return window.localStorage.getItem(STORAGE_KEY_SYNC_ROOM) || 'censo_master';
    } catch (e) {
      return 'censo_master';
    }
  });
  const driveOpenInputRef = useRef(null);

  // Estados para adicionar acompanhante/visitante extra nominal no leito
  const [newVisitorName, setNewVisitorName] = useState('');
  const [newVisitorKinship, setNewVisitorKinship] = useState('');
  const [newVisitorPhone, setNewVisitorPhone] = useState('');

  // Estados de Evoluções Diárias no Formulário
  const [selectedEvolutionDate, setSelectedEvolutionDate] = useState(todayStr);
  const [currentEvolutionDraft, setCurrentEvolutionDraft] = useState('');

  // Estados de Comando de Voz (Web Speech API)
  const recognitionRef = useRef(null);
  const [isListeningGlobal, setIsListeningGlobal] = useState(false);
  const [activeFieldListening, setActiveFieldListening] = useState(null);
  const [voiceLiveTranscript, setVoiceLiveTranscript] = useState('');
  const [aiDictationSummary, setAiDictationSummary] = useState(null);

  // Estado Inicial do Formulário Completo
  const initialFormState = {
    bed: 'Leito 01',
    childName: '',
    childBirthDate: '',
    childAgeText: '',
    naturalness: '',
    originCity: '',
    originState: 'PA',
    cardiacDiagnosis: '',
    admissionDate: todayStr,
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
    mother: {
      name: '',
      age: '',
      phone: '',
      education: 'Ensino Médio Completo',
      religion: 'Católica',
      profession: '',
      hasPsych: false,
      psychDetails: ''
    },
    father: {
      name: '',
      age: '',
      phone: '',
      education: 'Ensino Médio Completo',
      religion: 'Católica',
      profession: '',
      hasPsych: false,
      psychDetails: ''
    },
    childMentalHealth: {
      hasCondition: false,
      details: ''
    },
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
    } catch (e) {
      console.error("Erro ao gravar no cofre permanente:", e);
    }
  }, [patients]);

  useEffect(() => {
    try {
      if (bed10Config) {
        window.localStorage.setItem(STORAGE_KEY_BED10, JSON.stringify(bed10Config));
      }
    } catch (e) {
      console.error("Erro ao gravar Leito 10 no cofre:", e);
    }
  }, [bed10Config]);

  // ============================================================================
  // MOTOR DE SINCRONIZAÇÃO ATÔMICA (MASTER_SYNC + SALA COMPARTILHADA)
  // ============================================================================
  const activeDocName = useMemo(() => {
    const clean = (syncRoomCode || 'censo_master').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    return clean || 'censo_master';
  }, [syncRoomCode]);

  const pushFullStateToCloud = useCallback(async (patientsListToPush, bed10ToPush) => {
    if (!db || (isPreviewEnv && !user)) return false;
    try {
      setPendingSyncCount((c) => c + 1);
      const nowMs = Date.now();
      const masterRef = doc(db, 'artifacts', appId, 'public', 'data', 'uti_ped_master_sync', activeDocName);

      await setDoc(
        masterRef,
        {
          patientsJson: JSON.stringify(patientsListToPush),
          bed10ConfigJson: JSON.stringify(bed10ToPush),
          updatedAtMs: nowMs,
          lastDeviceId: deviceId,
          updatedAtFormatted: new Date().toISOString()
        },
        { merge: true }
      );

      setLastSyncTime(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setCloudStatus('connected');
      setPendingSyncCount((c) => Math.max(0, c - 1));
      return true;
    } catch (err) {
      console.error("Erro no push para nuvem:", err);
      setCloudStatus('error');
      setPendingSyncCount((c) => Math.max(0, c - 1));
      return false;
    }
  }, [user, deviceId, activeDocName]);

  const handleForceCloudSyncNow = useCallback(async (silent = false) => {
    if (!db || (isPreviewEnv && !user)) {
      if (!silent) setUiNotice("Modo Local ativo. Verifique a conexão com a internet.");
      return;
    }

    setIsSyncingManual(true);
    setCloudStatus('syncing');

    try {
      const masterRef = doc(db, 'artifacts', appId, 'public', 'data', 'uti_ped_master_sync', activeDocName);
      const snap = await getDoc(masterRef);

      const currentLocalRaw = window.localStorage.getItem(STORAGE_KEY_PATIENTS);
      const currentLocalList = currentLocalRaw
        ? JSON.parse(currentLocalRaw).map(normalizePatientRecord).filter(Boolean)
        : patientsRefState.current;

      let mergedPatients = currentLocalList;
      let mergedBed10 = bed10RefState.current;

      if (snap.exists()) {
        const data = snap.data();
        const cloudPatients = data.patientsJson ? JSON.parse(data.patientsJson) : [];
        const cloudBed10 = data.bed10ConfigJson ? JSON.parse(data.bed10ConfigJson) : null;

        mergedPatients = mergePatientListsSmart(currentLocalList, cloudPatients);
        if (cloudBed10 && (cloudBed10.updatedAtMs || 0) > (mergedBed10.updatedAtMs || 0)) {
          mergedBed10 = cloudBed10;
        }
      } else {
        const legacyColRef = collection(db, 'artifacts', appId, 'public', 'data', 'uti_ped_patients');
        const legacyDocs = await getDocs(legacyColRef);
        if (!legacyDocs.empty) {
          const fromLegacyCol = legacyDocs.docs.map((d) => d.data());
          mergedPatients = mergePatientListsSmart(mergedPatients, fromLegacyCol);
        }
      }

      setPatients(mergedPatients);
      setBed10Config(mergedBed10);
      window.localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify(mergedPatients));
      window.localStorage.setItem(STORAGE_KEY_BED10, JSON.stringify(mergedBed10));

      await pushFullStateToCloud(mergedPatients, mergedBed10);

      if (!silent) {
        setUiNotice("Sincronização completa! Todos os 10 leitos e evoluções diárias estão atualizados entre seus dispositivos.");
      }
    } catch (err) {
      console.error("Erro ao forçar sincronia:", err);
      setCloudStatus('error');
    } finally {
      setIsSyncingManual(false);
    }
  }, [user, pushFullStateToCloud, activeDocName]);

  useEffect(() => {
    if (!db || (isPreviewEnv && !user)) return;

    const masterRef = doc(db, 'artifacts', appId, 'public', 'data', 'uti_ped_master_sync', activeDocName);

    const unsubMaster = onSnapshot(
      masterRef,
      (docSnap) => {
        const localRaw = window.localStorage.getItem(STORAGE_KEY_PATIENTS);
        const localList = localRaw ? JSON.parse(localRaw).map(normalizePatientRecord).filter(Boolean) : [];

        if (!docSnap.exists()) {
          const initialList = localList.length > 0 ? localList : SEED_PATIENTS.map(normalizePatientRecord);
          pushFullStateToCloud(initialList, bed10RefState.current);
          return;
        }

        const data = docSnap.data();
        let cloudList = [];
        try {
          if (data.patientsJson) {
            cloudList = JSON.parse(data.patientsJson).map(normalizePatientRecord).filter(Boolean);
          }
        } catch (e) {
          console.warn("Erro ao decodificar lista da nuvem:", e);
        }

        const merged = mergePatientListsSmart(localList, cloudList);
        setPatients(merged);
        window.localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify(merged));

        if (data.bed10ConfigJson) {
          try {
            const parsedBed10 = JSON.parse(data.bed10ConfigJson);
            if ((parsedBed10.updatedAtMs || 0) >= (bed10RefState.current?.updatedAtMs || 0)) {
              setBed10Config(parsedBed10);
              window.localStorage.setItem(STORAGE_KEY_BED10, JSON.stringify(parsedBed10));
            }
          } catch (e) {}
        }

        setCloudStatus('connected');
        setLastSyncTime(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      },
      (err) => {
        console.error("Aviso no listener em tempo real:", err);
        setCloudStatus('offline_demo');
      }
    );

    const onVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        handleForceCloudSyncNow(true);
      }
    };

    window.addEventListener('focus', onVisibilityOrFocus);
    document.addEventListener('visibilitychange', onVisibilityOrFocus);

    return () => {
      unsubMaster();
      window.removeEventListener('focus', onVisibilityOrFocus);
      document.removeEventListener('visibilitychange', onVisibilityOrFocus);
    };
  }, [user, pushFullStateToCloud, handleForceCloudSyncNow, activeDocName]);

  useEffect(() => {
    if (!db || (isPreviewEnv && !user)) return;
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        handleForceCloudSyncNow(true);
      }
    }, 25000);
    return () => clearInterval(interval);
  }, [user, handleForceCloudSyncNow]);

  const writeToLinkedDriveFile = useCallback(async (patientsToSave, bed10ToSave) => {
    const payload = {
      exportedAt: new Date().toISOString(),
      version: 'permanent-vault-v4-multi-companions-drive',
      bed10Config: bed10ToSave,
      patients: patientsToSave
    };

    if (driveFileHandle && typeof driveFileHandle.createWritable === 'function') {
      try {
        const writable = await driveFileHandle.createWritable();
        await writable.write(JSON.stringify(payload, null, 2));
        await writable.close();
        return true;
      } catch (err) {
        console.warn("Aviso ao gravar no handle de arquivo:", err);
      }
    }

    if (autoSaveDriveEnabled) {
      try {
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = driveFileName || `censo-uti-ped-autosave-${todayStr}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return true;
      } catch (e) {
        return false;
      }
    }
    return false;
  }, [driveFileHandle, autoSaveDriveEnabled, driveFileName, todayStr]);

  const handleSavePatientToCloudOrLocal = async (patientData, isNew = false) => {
    const patientId = patientData.id || `pat-${Date.now()}`;
    const nowMs = Date.now();
    const payload = normalizePatientRecord({
      ...patientData,
      id: patientId,
      updatedAtMs: nowMs
    });

    const currentList = patientsRefState.current;
    const rawNextList = isNew
      ? [payload, ...currentList.filter((p) => p.id !== patientId && (p.bed !== payload.bed || p.status !== 'Internado'))]
      : currentList.map((p) => (p.id === patientId ? payload : p));
    const nextList = sortPatientsByBedNumber(rawNextList);

    setPatients(nextList);
    try {
      window.localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify(nextList));
      window.localStorage.setItem(STORAGE_KEY_INIT_FLAG, 'true');
    } catch (err) {
      console.error("Erro ao persistir paciente localmente:", err);
    }

    if (autoSaveDriveEnabled && driveFileHandle) {
      await writeToLinkedDriveFile(nextList, bed10RefState.current);
    }

    await pushFullStateToCloud(nextList, bed10RefState.current);
    if (db && (!isPreviewEnv || user)) {
      try {
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'uti_ped_patients', patientId);
        await setDoc(docRef, payload, { merge: true });
      } catch (e) {}
    }
  };

  // ============================================================================
  // MUDANÇA / TRANSFERÊNCIA OU PERMUTA DE LEITO (SEM PERDA DE DADOS)
  // ============================================================================
  const handleOpenTransferBedModal = (patient) => {
    const norm = normalizePatientRecord(patient);
    setTransferModalPatient(norm);
    const firstVacant = TOTAL_BEDS.find(
      (b) => b !== norm.bed && !patients.some((p) => p.bed === b && p.status === 'Internado')
    );
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
      date: todayStr,
      time: nowTime,
      reason: transferReason.trim() || (occupantInTarget ? `Permuta de leito com ${occupantInTarget.childName}` : 'Remanejamento interno na UTI')
    };

    let updatedEvolutionsA = [...(transferModalPatient.dailyEvolutions || [])];
    if (recordTransferInEvolution) {
      const noteText = `[Mudança de Leito às ${nowTime}: Transferido do ${oldBed} para o ${newBed}${transferReason.trim() ? ` — Motivo: ${transferReason.trim()}` : ''}]`;
      const todayIdx = updatedEvolutionsA.findIndex((ev) => ev.date === todayStr);
      if (todayIdx >= 0) {
        updatedEvolutionsA[todayIdx] = {
          ...updatedEvolutionsA[todayIdx],
          content: `${updatedEvolutionsA[todayIdx].content}\n${noteText}`,
          time: nowTime
        };
      } else {
        updatedEvolutionsA.unshift({
          id: `evo-tr-${nowMs}`,
          date: todayStr,
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
        date: todayStr,
        time: nowTime,
        reason: `Permuta de leito com ${transferModalPatient.childName}`
      };

      let updatedEvolutionsB = [...(normB.dailyEvolutions || [])];
      if (recordTransferInEvolution) {
        const noteTextB = `[Permuta de Leito às ${nowTime}: Transferido do ${newBed} para o ${oldBed} (troca com ${transferModalPatient.childName})]`;
        const todayIdxB = updatedEvolutionsB.findIndex((ev) => ev.date === todayStr);
        if (todayIdxB >= 0) {
          updatedEvolutionsB[todayIdxB] = {
            ...updatedEvolutionsB[todayIdxB],
            content: `${updatedEvolutionsB[todayIdxB].content}\n${noteTextB}`,
            time: nowTime
          };
        } else {
          updatedEvolutionsB.unshift({
            id: `evo-tr-swap-${nowMs}`,
            date: todayStr,
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

    if (autoSaveDriveEnabled && driveFileHandle) {
      await writeToLinkedDriveFile(nextList, bed10RefState.current);
    }

    await pushFullStateToCloud(nextList, bed10RefState.current);

    if (db && (!isPreviewEnv || user)) {
      try {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'uti_ped_patients', updatedPatientA.id), updatedPatientA, { merge: true });
        if (updatedPatientB) {
          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'uti_ped_patients', updatedPatientB.id), updatedPatientB, { merge: true });
        }
      } catch (e) {}
    }

    setTransferModalPatient(null);
    setUiNotice(
      updatedPatientB
        ? `Permuta concluída! ${updatedPatientA.childName} foi para o ${newBed} e ${updatedPatientB.childName} foi para o ${oldBed} (100% dos dados preservados).`
        : `Mudança de leito concluída! ${updatedPatientA.childName} foi transferido(a) do ${oldBed} para o ${newBed} mantendo todo o histórico.`
    );
  };

  // ============================================================================
  // ESTRATÉGIAS DE INTEGRAÇÃO COM GOOGLE DRIVE E COMPARTILHAMENTO NATIVO
  // ============================================================================
  const handleShareBackupToDriveOrWhatsApp = async () => {
    const backupPayload = {
      exportedAt: new Date().toISOString(),
      version: 'permanent-vault-v4-multi-companions-drive',
      bed10Config,
      patients
    };
    const jsonString = JSON.stringify(backupPayload, null, 2);
    const fileName = `censo-uti-ped-${todayStr}.json`;

    try {
      const file = new File([jsonString], fileName, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `Backup Censo UTI Pediátrica (${formatDateBr(todayStr)})`,
          text: `Cópia de segurança com ${patients.length} fichas clínicas e evoluções diárias.`,
          files: [file]
        });
        setUiNotice("Menu de compartilhamento aberto! Escolha 'Salvar no Drive' ou 'WhatsApp'.");
        return;
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
    }

    handleDownloadBackupJson();
  };

  const handleLinkLocalDriveFile = async () => {
    const fileName = `censo-uti-ped-sincronizado.json`;

    if (typeof window.showSaveFilePicker === 'function') {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: fileName,
          types: [
            {
              description: 'Arquivo de Sincronia Censo UTI (.json)',
              accept: { 'application/json': ['.json'] }
            }
          ]
        });
        setDriveFileHandle(handle);
        setDriveFileName(handle.name);
        setAutoSaveDriveEnabled(true);
        await writeToLinkedDriveFile(patients, bed10Config);
        setUiNotice(`Arquivo "${handle.name}" vinculado com sucesso! Toda alteração será salva automaticamente nele.`);
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }

    setDriveFileHandle(null);
    setDriveFileName(fileName);
    setAutoSaveDriveEnabled((prev) => {
      const nextState = !prev;
      if (nextState) {
        const backupPayload = {
          exportedAt: new Date().toISOString(),
          version: 'permanent-vault-v4-multi-companions-drive',
          bed10Config,
          patients
        };
        const blob = new Blob([JSON.stringify(backupPayload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setUiNotice("Auto-Save Drive PC ATIVADO! O arquivo base foi gerado e toda nova alteração baixará a versão atualizada automaticamente.");
      } else {
        setUiNotice("Auto-Save Drive PC desativado.");
      }
      return nextState;
    });
  };

  const handleOpenFromDriveFilePicker = async () => {
    if (typeof window.showOpenFilePicker === 'function') {
      try {
        const [handle] = await window.showOpenFilePicker({
          types: [
            {
              description: 'Arquivo de Sincronia Censo UTI (.json)',
              accept: { 'application/json': ['.json'] }
            }
          ]
        });
        const file = await handle.getFile();
        const text = await file.text();
        setDriveFileHandle(handle);
        setDriveFileName(file.name);
        setAutoSaveDriveEnabled(true);
        await handleImportBackupData(text, true);
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
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
    const backupPayload = {
      exportedAt: new Date().toISOString(),
      version: 'permanent-vault-v2-daily-evolutions',
      bed10Config,
      patients
    };
    const blob = new Blob([JSON.stringify(backupPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `censo-uti-ped-backup-${todayStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setUiNotice("Arquivo de backup (.json) baixado com sucesso!");
  };

  const handleCopyBackupString = () => {
    const backupPayload = {
      exportedAt: new Date().toISOString(),
      version: 'permanent-vault-v2-daily-evolutions',
      bed10Config,
      patients
    };
    const rawStr = JSON.stringify(backupPayload, null, 2);
    setBackupJsonText(rawStr);
    const textArea = document.createElement("textarea");
    textArea.value = rawStr;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      setUiNotice("Código de backup copiado para a área de transferência!");
    } catch (e) {
      if (navigator.clipboard) navigator.clipboard.writeText(rawStr);
    }
    document.body.removeChild(textArea);
  };

  const handleImportBackupData = async (rawJsonString, mergeMode = true) => {
    try {
      const parsed = JSON.parse(rawJsonString);
      const importedListRaw = Array.isArray(parsed) ? parsed : (parsed.patients || []);
      if (!Array.isArray(importedListRaw) || importedListRaw.length === 0) {
        setUiNotice("Formato inválido ou lista de pacientes vazia no backup informado.");
        return;
      }

      const normalizedImported = importedListRaw.map((p) => normalizePatientRecord({ ...p, updatedAtMs: Date.now() })).filter(Boolean);
      const finalList = mergeMode ? mergePatientListsSmart(patients, normalizedImported) : normalizedImported;

      setPatients(finalList);
      window.localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify(finalList));
      window.localStorage.setItem(STORAGE_KEY_INIT_FLAG, 'true');

      let nextBed10 = bed10Config;
      if (parsed.bed10Config) {
        nextBed10 = { ...parsed.bed10Config, updatedAtMs: Date.now() };
        setBed10Config(nextBed10);
      }

      await pushFullStateToCloud(finalList, nextBed10);
      setUiNotice(`Sucesso! ${normalizedImported.length} registros restaurados e sincronizados com a nuvem.`);
      setIsBackupModalOpen(false);
    } catch (err) {
      setUiNotice("Erro ao ler o JSON de backup. Verifique se o texto ou arquivo está completo.");
    }
  };

  const handleFileUploadBackup = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      if (evt.target?.result) {
        handleImportBackupData(evt.target.result, true);
      }
    };
    reader.readAsText(file);
  };

  // Mapeamento em tempo real dos 10 leitos
  const bedsStatusMap = useMemo(() => {
    const map = {};
    TOTAL_BEDS.forEach((bedName) => {
      const rawPatient = patients.find((p) => p.bed === bedName && p.status === 'Internado');
      const activePatient = rawPatient ? normalizePatientRecord(rawPatient) : null;
      const isBed10 = bedName === "Leito 10";

      const todayEvolution = activePatient?.dailyEvolutions?.find((ev) => ev.date === todayStr) || null;
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
        isolationReason: isBed10 ? bed10Config.isolationReason : "",
        admittedToday: activePatient ? activePatient.admissionDate === todayStr : false,
        hasMentalAlert: activePatient
          ? !!(activePatient.childMentalHealth?.hasCondition || activePatient.mother?.hasPsych || activePatient.father?.hasPsych)
          : false
      };
    });
    return map;
  }, [patients, bed10Config, todayStr]);

  // Indicadores Superiores do Censo
  const metrics = useMemo(() => {
    const active = patients.filter((p) => p.status === 'Internado').map(normalizePatientRecord);
    const admittedToday = active.filter((p) => p.admissionDate === todayStr);
    const dischargedToday = patients.filter((p) => p.status !== 'Internado' && p.dischargeDate === todayStr);
    const mentalAlerts = active.filter(
      (p) => p.childMentalHealth?.hasCondition || p.mother?.hasPsych || p.father?.hasPsych
    );
    const evolvedTodayCount = active.filter((p) =>
      (p.dailyEvolutions || []).some((ev) => ev.date === todayStr && ev.content?.trim())
    ).length;

    return {
      activeBeds: active.length,
      vacantBeds: Math.max(0, 10 - active.length),
      admittedTodayCount: admittedToday.length,
      dischargedTodayCount: dischargedToday.length,
      mentalAlertsCount: mentalAlerts.length,
      evolvedTodayCount
    };
  }, [patients, todayStr]);

  // Filtro de busca sempre ordenado do Leito 01 ao Leito 10
  const filteredPatients = useMemo(() => {
    const filtered = patients.map(normalizePatientRecord).filter((patient) => {
      const term = searchTerm.toLowerCase();
      const matchSearch =
        (patient.childName || '').toLowerCase().includes(term) ||
        (patient.bed || '').toLowerCase().includes(term) ||
        (patient.naturalness || '').toLowerCase().includes(term) ||
        (patient.originCity || '').toLowerCase().includes(term) ||
        (patient.mother?.name || '').toLowerCase().includes(term) ||
        (patient.father?.name || '').toLowerCase().includes(term) ||
        (patient.mother?.profession || '').toLowerCase().includes(term) ||
        (patient.father?.profession || '').toLowerCase().includes(term) ||
        (patient.mother?.religion || '').toLowerCase().includes(term) ||
        (patient.father?.religion || '').toLowerCase().includes(term) ||
        (patient.mother?.phone || '').toLowerCase().includes(term) ||
        (patient.father?.phone || '').toLowerCase().includes(term) ||
        (patient.cardiacDiagnosis || '').toLowerCase().includes(term);

      if (!matchSearch) return false;

      if (filterMode === 'active') return patient.status === 'Internado';
      if (filterMode === 'admitted_today') return patient.admissionDate === todayStr && patient.status === 'Internado';
      if (filterMode === 'discharged') return patient.status !== 'Internado';
      if (filterMode === 'isolation') return patient.bed === "Leito 10";
      if (filterMode === 'mental_alert') {
        return (
          patient.status === 'Internado' &&
          (patient.childMentalHealth?.hasCondition || patient.mother?.hasPsych || patient.father?.hasPsych)
        );
      }
      return patient.status === 'Internado';
    });

    return sortPatientsByBedNumber(filtered);
  }, [patients, searchTerm, filterMode, todayStr]);

  // Motor Web Speech API (pt-BR)
  const startSpeechEngine = ({ onResult, onEnd }) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setUiNotice("Seu navegador não possui suporte ao reconhecimento de voz nativo. Recomendamos usar o Google Chrome.");
      return null;
    }

    try {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }

      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'pt-BR';

      rec.onresult = (event) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript + ' ';
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        onResult({ final, interim, combined: (final + interim).trim() });
      };

      rec.onerror = (err) => {
        console.error("Aviso no reconhecimento de voz:", err);
      };

      rec.onend = () => {
        if (onEnd) onEnd();
      };

      rec.start();
      recognitionRef.current = rec;
      return rec;
    } catch (err) {
      console.error("Falha ao iniciar microfone:", err);
      return null;
    }
  };

  const stopCurrentSpeech = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListeningGlobal(false);
    setActiveFieldListening(null);
  };

  const handleToggleGlobalVoiceDictation = () => {
    if (isListeningGlobal) {
      stopCurrentSpeech();
      return;
    }

    setIsAiVoiceModalOpen(true);
    setIsListeningGlobal(true);
    setVoiceLiveTranscript('');
    setAiDictationSummary(null);

    let accumulatedFinal = '';

    startSpeechEngine({
      onResult: ({ final, interim }) => {
        if (final) {
          accumulatedFinal += final + ' ';
        }
        const currentTranscript = (accumulatedFinal + interim).trim();
        setVoiceLiveTranscript(currentTranscript);
        const parsed = parseMedicalSpeech(currentTranscript);
        setAiDictationSummary(parsed);
      },
      onEnd: () => {
        setIsListeningGlobal(false);
      }
    });
  };

  const handleApplyVoiceToForm = () => {
    const parsed = aiDictationSummary || parseMedicalSpeech(voiceLiveTranscript);
    const evoContent = parsed.todayEvolutionContent || voiceLiveTranscript;

    setFormData((prev) => ({
      ...prev,
      bed: parsed.bed || prev.bed || 'Leito 01',
      childName: parsed.childName || prev.childName,
      childBirthDate: parsed.childBirthDate || prev.childBirthDate,
      childAgeText: parsed.childAgeText || prev.childAgeText,
      naturalness: parsed.naturalness || prev.naturalness,
      originCity: parsed.originCity || prev.originCity,
      originState: parsed.originState || prev.originState,
      cardiacDiagnosis: parsed.cardiacDiagnosis || prev.cardiacDiagnosis,
      mother: {
        ...prev.mother,
        name: parsed.mother?.name || prev.mother.name,
        age: parsed.mother?.age || prev.mother.age,
        phone: parsed.mother?.phone || prev.mother.phone,
        education: parsed.mother?.education || prev.mother.education,
        religion: parsed.mother?.religion || prev.mother.religion,
        profession: parsed.mother?.profession || prev.mother.profession,
        hasPsych: parsed.mother?.hasPsych ?? prev.mother.hasPsych,
        psychDetails: parsed.mother?.psychDetails || prev.mother.psychDetails
      },
      father: {
        ...prev.father,
        name: parsed.father?.name || prev.father.name,
        age: parsed.father?.age || prev.father.age,
        phone: parsed.father?.phone || prev.father.phone,
        education: parsed.father?.education || prev.father.education,
        religion: parsed.father?.religion || prev.father.religion,
        profession: parsed.father?.profession || prev.father.profession,
        hasPsych: parsed.father?.hasPsych ?? prev.father.hasPsych,
        psychDetails: parsed.father?.psychDetails || prev.father.psychDetails
      },
      childMentalHealth: {
        hasCondition: parsed.childMentalHealth?.hasCondition ?? prev.childMentalHealth.hasCondition,
        details: parsed.childMentalHealth?.details || prev.childMentalHealth.details
      }
    }));

    if (evoContent) {
      setSelectedEvolutionDate(todayStr);
      setCurrentEvolutionDraft((prevDraft) => (prevDraft ? `${prevDraft}\n${evoContent}` : evoContent));
    }

    stopCurrentSpeech();
    setIsAiVoiceModalOpen(false);
    setIsModalOpen(true);
  };

  const handleToggleFieldDictation = (fieldKey, subKey = null) => {
    const compositeKey = subKey ? `${fieldKey}.${subKey}` : fieldKey;
    if (activeFieldListening === compositeKey) {
      stopCurrentSpeech();
      return;
    }

    setActiveFieldListening(compositeKey);
    let initialValue = '';
    if (fieldKey === 'dailyEvolutionDraft') {
      initialValue = currentEvolutionDraft || '';
    } else if (subKey) {
      initialValue = formData[fieldKey]?.[subKey] || '';
    } else {
      initialValue = formData[fieldKey] || '';
    }

    let accumulated = initialValue ? initialValue + ' ' : '';

    startSpeechEngine({
      onResult: ({ final, interim }) => {
        if (final) {
          accumulated += final + ' ';
        }
        const rawCombined = (accumulated + interim).trim();
        const combined = subKey === 'phone' || fieldKey === 'companionPhone'
          ? formatPhoneMask(rawCombined)
          : rawCombined;

        if (fieldKey === 'dailyEvolutionDraft') {
          setCurrentEvolutionDraft(combined);
        } else {
          setFormData((prev) => {
            if (subKey) {
              return {
                ...prev,
                [fieldKey]: {
                  ...prev[fieldKey],
                  [subKey]: combined
                }
              };
            }
            return {
              ...prev,
              [fieldKey]: combined
            };
          });
        }
      },
      onEnd: () => {
        setActiveFieldListening(null);
      }
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
        naturalness: norm.naturalness || '',
        originCity: norm.originCity,
        originState: norm.originState || 'PA',
        cardiacDiagnosis: norm.cardiacDiagnosis,
        admissionDate: norm.admissionDate,
        currentCompanion: norm.currentCompanion || 'Mãe',
        currentCompanionsList: Array.isArray(norm.currentCompanionsList) && norm.currentCompanionsList.length > 0
          ? [...norm.currentCompanionsList]
          : ['Mãe'],
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

      setSelectedEvolutionDate(todayStr);
      const existingTodayEvo = (norm.dailyEvolutions || []).find((ev) => ev.date === todayStr);
      setCurrentEvolutionDraft(existingTodayEvo ? existingTodayEvo.content : '');
    } else {
      const occupiedBeds = patients.filter((p) => p.status === 'Internado').map((p) => p.bed);
      const firstAvailable = preselectedBed || TOTAL_BEDS.find((b) => !occupiedBeds.includes(b)) || 'Leito 01';
      setEditingPatient(null);
      setFormData({
        ...initialFormState,
        bed: firstAvailable,
        admissionDate: todayStr
      });
      setSelectedEvolutionDate(todayStr);
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
        if (cleanList.includes(personLabel)) {
          nextList = cleanList.filter((item) => item !== personLabel);
        } else {
          nextList = [...cleanList, personLabel];
        }
      }
      if (nextList.length === 0) nextList = ['Mãe'];

      const visitorsStr = (prev.extraBedsideVisitors || [])
        .map((v) => (v.kinship ? `${v.name} (${v.kinship})` : v.name))
        .filter(Boolean);

      return {
        ...prev,
        currentCompanionsList: nextList,
        currentCompanion: [...nextList, ...visitorsStr].join(', ')
      };
    });
  };

  const handleAddExtraBedsideVisitor = () => {
    if (!newVisitorName.trim()) return;
    const newEntry = {
      id: `vis-${Date.now()}`,
      name: newVisitorName.trim(),
      kinship: newVisitorKinship.trim() || 'Familiar / Visitante',
      phone: formatPhoneMask(newVisitorPhone)
    };
    setFormData((prev) => {
      const nextVisitors = [...(prev.extraBedsideVisitors || []), newEntry];
      const baseList = Array.isArray(prev.currentCompanionsList) ? prev.currentCompanionsList : [];
      const visitorsStr = nextVisitors.map((v) => (v.kinship ? `${v.name} (${v.kinship})` : v.name));
      return {
        ...prev,
        extraBedsideVisitors: nextVisitors,
        currentCompanion: [...baseList, ...visitorsStr].join(', ')
      };
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
      return {
        ...prev,
        extraBedsideVisitors: nextVisitors,
        currentCompanion: [...baseList, ...visitorsStr].join(', ')
      };
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
        list[existingIdx] = {
          ...list[existingIdx],
          content: trimmed,
          time: nowTime
        };
      } else {
        list.push({
          id: `evo-${Date.now()}`,
          date: selectedEvolutionDate,
          time: nowTime,
          content: trimmed,
          author: 'Psicologia UTI'
        });
      }
      list.sort((a, b) => `${b.date}T${b.time || '00:00'}`.localeCompare(`${a.date}T${a.time || '00:00'}`));
      return {
        ...prev,
        dailyEvolutions: list,
        psychNotes: list[0]?.content || prev.psychNotes
      };
    });
    setUiNotice(`Evolução do dia ${formatDateBr(selectedEvolutionDate)} registrada na linha do tempo!`);
  };

  const handleDeleteDailyEvolutionEntry = (evoId, evoDate) => {
    setFormData((prev) => {
      const filtered = (prev.dailyEvolutions || []).filter((ev) => ev.id !== evoId);
      return {
        ...prev,
        dailyEvolutions: filtered,
        psychNotes: filtered[0]?.content || ''
      };
    });
    if (evoDate === selectedEvolutionDate) {
      setCurrentEvolutionDraft('');
    }
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
        updatedDailyEvolutions[idx] = {
          ...updatedDailyEvolutions[idx],
          content: trimmedDraft,
          time: nowTime
        };
      } else {
        updatedDailyEvolutions.push({
          id: `evo-${Date.now()}`,
          date: selectedEvolutionDate,
          time: nowTime,
          content: trimmedDraft,
          author: 'Psicologia UTI'
        });
      }
    }

    updatedDailyEvolutions.sort((a, b) =>
      `${b.date}T${b.time || '00:00'}`.localeCompare(`${a.date}T${a.time || '00:00'}`)
    );

    const computedAge = formData.childBirthDate
      ? calculateAgeFromBirthDate(formData.childBirthDate)
      : formData.childAgeText;

    const summaryCompanions = [
      ...(formData.currentCompanionsList || ['Mãe']),
      ...(formData.extraBedsideVisitors || []).map((v) => (v.kinship ? `${v.name} (${v.kinship})` : v.name))
    ]
      .filter(Boolean)
      .join(', ');

    const finalPayload = {
      ...formData,
      currentCompanion: summaryCompanions || formData.currentCompanion || 'Mãe',
      childAgeText: formData.childAgeText || computedAge || 'N/I',
      dailyEvolutions: updatedDailyEvolutions,
      psychNotes: updatedDailyEvolutions[0]?.content || formData.psychNotes || ''
    };

    if (editingPatient) {
      await handleSavePatientToCloudOrLocal(
        {
          ...editingPatient,
          ...finalPayload
        },
        false
      );
    } else {
      const newPatient = {
        ...finalPayload,
        id: `pat-${Date.now()}`,
        status: 'Internado',
        dischargeDate: null,
        dischargeNote: ''
      };
      await handleSavePatientToCloudOrLocal(newPatient, true);
    }

    stopCurrentSpeech();
    setIsModalOpen(false);
    setUiNotice("Ficha e evolução diária salvas e sincronizadas com sucesso!");
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
      dischargeDate: todayStr,
      dischargeNote: dischargeNote || 'Encaminhamento registrado no desfecho da UTI.'
    };

    await handleSavePatientToCloudOrLocal(updated, false);
    setDischargeModalPatient(null);
  };

  // Construtor do Texto de Passagem de Plantão Enxuto e Focado no Dia
  const buildHandoverReportText = useCallback(() => {
    const activeSlots = TOTAL_BEDS.map((b) => bedsStatusMap[b]);
    const occupiedSlots = activeSlots.filter((s) => s.isOccupied);
    const vacantBeds = activeSlots.filter((s) => !s.isOccupied).map((s) => s.bedName.replace('Leito ', ''));
    const dischargedToday = patients.filter((p) => p.status !== 'Internado' && p.dischargeDate === todayStr);

    let text = `🏥 *PASSAGEM DE PLANTÃO - PSICOLOGIA UTI CARDIO*\n`;
    text += `📅 *Data:* ${formatDateBr(todayStr)} | *Ocupação:* ${metrics.activeBeds}/10 leitos`;
    if (vacantBeds.length > 0) {
      text += ` (Vagos: ${vacantBeds.join(', ')})`;
    }
    text += `\n--------------------------------------------------\n\n`;

    if (occupiedSlots.length === 0) {
      text += `_Nenhum paciente internado no momento._\n\n`;
    } else {
      occupiedSlots.forEach((slot) => {
        const p = slot.patient;
        const isoTag = slot.isIsolationRoom && slot.inIsolationUse ? ` [ISOLAMENTO: ${slot.isolationType.toUpperCase()}]` : '';
        const isNew = p.admissionDate === todayStr ? ' [ADMISSÃO HOJE]' : '';
        
        const parentsSummary = [
          p.mother?.name ? `Mãe: ${p.mother.name}` : null,
          p.father?.name ? `Pai: ${p.father.name}` : null,
          p.companionName ? `${p.companionKinship || 'Resp.'}: ${p.companionName}` : null
        ].filter(Boolean).join(' | ');

        text += `🛏️ *${slot.bedName}${isoTag}* — *${p.childName}* (${p.childAgeText || 'Idade N/I'})${isNew}\n`;
        text += `📍 *Origem:* ${p.originCity || 'N/I'}-${p.originState || 'PA'} | ❤️ *Diag:* ${p.cardiacDiagnosis || 'Em investigação'}\n`;
        text += `👥 *No leito hoje:* ${p.currentCompanion || 'Mãe'}${parentsSummary ? ` (${parentsSummary})` : ''}\n`;

        const alerts = [];
        if (p.childMentalHealth?.hasCondition) alerts.push(`Criança: ${p.childMentalHealth.details}`);
        if (p.mother?.hasPsych) alerts.push(`Mãe: ${p.mother.psychDetails}`);
        if (p.father?.hasPsych) alerts.push(`Pai: ${p.father.psychDetails}`);
        if (alerts.length > 0) {
          text += `🧠 *Alerta Saúde Mental:* ${alerts.join(' | ')}\n`;
        }

        if (slot.todayEvolution) {
          text += `📝 *Evolução do Dia (${slot.todayEvolution.time || 'Hoje'}):* ${slot.todayEvolution.content}\n`;
        } else {
          text += `⏳ *Evolução do Dia:* Sem evolução registrada hoje.\n`;
        }
        text += `\n`;
      });
    }

    if (dischargedToday.length > 0) {
      text += `📤 *ALTAS / SAÍDAS DE HOJE (${dischargedToday.length}):*\n`;
      dischargedToday.forEach((p) => {
        text += `• *${p.bed} - ${p.childName}* (${p.status}): ${p.dischargeNote}\n`;
      });
    }

    return text.trim();
  }, [bedsStatusMap, patients, todayStr, metrics]);

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
      setUiNotice("Passagem de Plantão (com destaque para as evoluções de hoje) copiada!");
    } catch (err) {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 3000);
      }
    }
    document.body.removeChild(textArea);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-teal-500 selection:text-white pb-16">
      
      {uiNotice && (
        <div className="bg-teal-950/95 border-b border-teal-500/40 px-4 py-2.5 text-xs text-teal-200 flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-teal-400 shrink-0" />
            <span>{uiNotice}</span>
          </div>
          <button onClick={() => setUiNotice(null)} className="text-teal-400 hover:text-white font-semibold ml-4">
            Fechar
          </button>
        </div>
      )}

      {/* CABEÇALHO CLÍNICO E STATUS DE SINCRONIZAÇÃO */}
      <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-teal-500/20 to-rose-500/20 border border-teal-500/40 flex items-center justify-center shadow-lg shadow-teal-950/50 relative">
              <Heart className="w-5 h-5 text-rose-400 animate-pulse" />
              <span className="absolute -bottom-1 -right-1 bg-teal-500 text-zinc-950 text-[10px] font-extrabold px-1.5 rounded-full">
                10
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                  UTI Pediátrica Cardíaca
                </h1>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-500/15 text-teal-300 border border-teal-500/30 font-medium">
                  Censo 10 Leitos & Psicologia
                </span>

                <button
                  onClick={() => handleForceCloudSyncNow(false)}
                  disabled={isSyncingManual}
                  className={`text-[11px] px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 transition-all cursor-pointer ${
                    cloudStatus === 'connected'
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25'
                      : cloudStatus === 'syncing' || isSyncingManual
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                      : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:border-teal-500/50'
                  }`}
                  title="Clique para forçar a sincronização imediata entre Celular, Tablet e PC"
                >
                  {cloudStatus === 'connected' && !isSyncingManual ? (
                    <>
                      <Cloud className="w-3 h-3 text-emerald-400" />
                      <span>Sincronizado {lastSyncTime ? `(${lastSyncTime})` : ''}</span>
                      <RefreshCw className="w-2.5 h-2.5 ml-0.5 text-emerald-300" />
                    </>
                  ) : cloudStatus === 'syncing' || isSyncingManual ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                      <span>Sincronizando Dispositivos...</span>
                    </>
                  ) : (
                    <>
                      <CloudOff className="w-3 h-3 text-zinc-400" />
                      <span>Sincronizar Nuvem</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                9 Leitos Regulares + Leito 10 (Isolamento) • Evoluções Diárias • Mudança de Leito Segura
              </p>
            </div>
          </div>

          {/* Botões de Ação Rápida */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleToggleGlobalVoiceDictation}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                isListeningGlobal
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 animate-pulse shadow-lg shadow-rose-950/50'
                  : 'bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border-purple-500/30'
              }`}
            >
              {isListeningGlobal ? (
                <>
                  <Radio className="w-4 h-4 text-rose-400 animate-ping" />
                  <span>Ouvindo Relato...</span>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 text-purple-400" />
                  <span>Ditado por Voz (IA)</span>
                </>
              )}
            </button>

            <button
              onClick={() => setIsBackupModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/30 transition-all"
              title="Cofre de Dados Permanente, Google Drive e Backup JSON"
            >
              <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
              <span>Cofre & Drive ({patients.length})</span>
            </button>

            <div className="flex items-center rounded-xl border border-zinc-700/80 bg-zinc-900 overflow-hidden">
              <button
                onClick={handleCopyHandoverText}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium hover:bg-zinc-800 text-zinc-200 transition-all"
                title="Copiar Passagem de Plantão com destaque para a evolução de hoje"
              >
                {copySuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Plantão Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-teal-400" />
                    <span>Passagem de Plantão</span>
                  </>
                )}
              </button>
              <button
                onClick={() => setIsHandoverPreviewOpen(true)}
                className="px-2.5 py-2 border-l border-zinc-800 hover:bg-zinc-800 text-teal-300 transition-colors"
                title="Visualizar Relatório de Passagem de Plantão antes de copiar"
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
        
        {/* PAINEL DE INDICADORES DOS 10 LEITOS */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div
            onClick={() => { setFilterMode('active'); setActiveTab('grid'); }}
            className="cursor-pointer p-3.5 rounded-2xl border bg-zinc-900/60 border-zinc-800/90 hover:border-teal-500/40 transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-zinc-400">Taxa de Ocupação</span>
              <BedDouble className="w-4 h-4 text-teal-400" />
            </div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-white">{metrics.activeBeds}</span>
              <span className="text-xs text-zinc-400">/ 10 leitos ({metrics.vacantBeds} vagos)</span>
            </div>
          </div>

          <div
            onClick={() => setIsIsolationModalOpen(true)}
            className={`cursor-pointer p-3.5 rounded-2xl border transition-all ${
              bed10Config.inIsolationUse
                ? 'bg-purple-950/25 border-purple-500/50'
                : 'bg-zinc-900/60 border-zinc-800/90 hover:border-zinc-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-purple-300">Leito 10 (Isolamento)</span>
              <ShieldAlert className={`w-4 h-4 ${bed10Config.inIsolationUse ? 'text-purple-400' : 'text-zinc-500'}`} />
            </div>
            <div className="mt-1.5 flex items-baseline justify-between gap-1">
              <span className="text-sm font-bold text-white truncate">
                {bed10Config.inIsolationUse ? `Ativo: ${bed10Config.isolationType}` : 'Uso Regular'}
              </span>
              <span className="text-[10px] underline text-purple-300 shrink-0">Configurar</span>
            </div>
          </div>

          <div
            onClick={() => { setFilterMode('active'); setActiveTab('cards'); }}
            className="cursor-pointer p-3.5 rounded-2xl border bg-zinc-900/60 border-zinc-800/90 hover:border-emerald-500/40 transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-zinc-400">Evoluídos Hoje ({formatDateBr(todayStr)})</span>
              <Clock className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-emerald-400">{metrics.evolvedTodayCount}</span>
              <span className="text-xs text-zinc-400">de {metrics.activeBeds} internados</span>
            </div>
          </div>

          <div
            onClick={() => { setFilterMode('mental_alert'); setActiveTab('mental_health'); }}
            className="cursor-pointer p-3.5 rounded-2xl border bg-zinc-900/60 border-zinc-800/90 hover:border-amber-500/40 transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-zinc-400">Demanda Saúde Mental</span>
              <Brain className="w-4 h-4 text-amber-400" />
            </div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-amber-400">{metrics.mentalAlertsCount}</span>
              <span className="text-xs text-zinc-400">famílias/crianças</span>
            </div>
          </div>

          <div
            onClick={() => { setFilterMode('discharged'); setActiveTab('discharges'); }}
            className="cursor-pointer p-3.5 rounded-2xl border bg-zinc-900/60 border-zinc-800/90 hover:border-rose-500/40 transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-zinc-400">Altas / Desfechos Hoje</span>
              <LogOut className="w-4 h-4 text-rose-400" />
            </div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-rose-400">{metrics.dischargedTodayCount}</span>
              <span className="text-xs text-zinc-400">saídas</span>
            </div>
          </div>
        </section>

        {/* BARRA DE NAVEGAÇÃO DE ABAS E PESQUISA */}
        <section className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-zinc-900/70 p-2.5 rounded-2xl border border-zinc-800/80">
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
            <button
              onClick={() => { setActiveTab('grid'); setFilterMode('all'); }}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'grid'
                  ? 'bg-teal-500 text-zinc-950 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Mapa dos 10 Leitos</span>
            </button>
            <button
              onClick={() => { setActiveTab('cards'); setFilterMode('active'); }}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'cards'
                  ? 'bg-teal-500 text-zinc-950 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Fichas & Evoluções Diárias ({metrics.activeBeds})</span>
            </button>
            <button
              onClick={() => setActiveTab('mental_health')}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'mental_health'
                  ? 'bg-amber-500 text-zinc-950 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              <Brain className="w-3.5 h-3.5" />
              <span>Saúde Mental Pais & Criança ({metrics.mentalAlertsCount})</span>
            </button>
            <button
              onClick={() => { setActiveTab('discharges'); setFilterMode('discharged'); }}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'discharges'
                  ? 'bg-rose-500 text-zinc-950 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Altas & Desfechos</span>
            </button>
          </div>

          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar criança, mãe, pai, profissão, cidade, cardiopatia..."
              className="w-full bg-zinc-950 border border-zinc-800 focus:border-teal-500/60 rounded-xl pl-9 pr-8 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </section>

        {/* ===================================================================== */}
        {/* ABA 1: MAPA VISUAL DOS 10 LEITOS NOMINAIS */}
        {/* ===================================================================== */}
        {activeTab === 'grid' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
              {TOTAL_BEDS.map((bedName) => {
                const slot = bedsStatusMap[bedName];
                const p = slot.patient;
                const isIsoBed = slot.isIsolationRoom;

                return (
                  <div
                    key={bedName}
                    className={`rounded-2xl border p-4 flex flex-col justify-between transition-all relative overflow-hidden ${
                      isIsoBed
                        ? slot.inIsolationUse
                          ? 'bg-gradient-to-b from-purple-950/35 to-zinc-900/90 border-purple-500/50 shadow-lg shadow-purple-950/20'
                          : 'bg-zinc-900/80 border-purple-500/30'
                        : slot.isOccupied
                        ? 'bg-zinc-900/80 border-zinc-800 hover:border-teal-500/40'
                        : 'bg-zinc-950/60 border-zinc-900 border-dashed hover:border-zinc-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-2.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-xs font-extrabold px-2.5 py-1 rounded-lg ${
                              isIsoBed
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                                : slot.isOccupied
                                ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30'
                                : 'bg-zinc-800/80 text-zinc-400'
                            }`}
                          >
                            {bedName}
                          </span>
                          {isIsoBed && (
                            <button
                              onClick={() => setIsIsolationModalOpen(true)}
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                                slot.inIsolationUse
                                  ? 'bg-purple-500 text-zinc-950 border-purple-400'
                                  : 'bg-zinc-800 text-purple-300 border-purple-500/30'
                              }`}
                            >
                              {slot.inIsolationUse ? `Isol.: ${slot.isolationType}` : 'Isol. Inativo'}
                            </button>
                          )}
                        </div>

                        {slot.isOccupied ? (
                          slot.todayEvolution ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
                              Evoluído Hoje
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              Pendente Hoje
                            </span>
                          )
                        ) : (
                          <span className="text-[10px] text-zinc-500 font-medium uppercase">Livre</span>
                        )}
                      </div>

                      {slot.isOccupied && p ? (
                        <div className="space-y-2 my-1">
                          <div>
                            <h3 className="text-sm font-bold text-white leading-snug line-clamp-1">
                              {p.childName}
                            </h3>
                            <p className="text-[11px] text-zinc-400">
                              {p.childAgeText || 'Idade N/I'}
                              {p.childBirthDate ? ` • DN: ${formatDateBr(p.childBirthDate)}` : ''}
                            </p>
                            <p className="text-[11px] text-zinc-400 truncate">
                              📍 Procedência: {p.originCity || 'N/I'}/{p.originState || 'PA'}
                            </p>
                          </div>

                          <div className="p-2 rounded-xl bg-zinc-950/70 border border-zinc-800/80">
                            <p className="text-[11px] text-rose-300 font-medium line-clamp-2 leading-relaxed">
                              ❤️ {p.cardiacDiagnosis || 'Cardiopatia em investigação'}
                            </p>
                          </div>

                          <div className="text-[11px] text-zinc-300 space-y-1 pt-0.5">
                            <div className="bg-teal-950/30 border border-teal-500/25 rounded-lg px-2 py-1">
                              <span className="text-[10px] text-zinc-400 block">No leito / visita hoje:</span>
                              <span className="font-semibold text-teal-300 line-clamp-2">{p.currentCompanion || 'Mãe'}</span>
                            </div>

                            {p.mother?.name && (
                              <div className="bg-zinc-950/50 px-2 py-1 rounded border border-zinc-800/60">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="truncate text-zinc-300 font-medium">👩 {p.mother.name}</span>
                                  {p.mother.phone && (
                                    <a
                                      href={`tel:${p.mother.phone.replace(/\D/g, '')}`}
                                      className="text-teal-400 hover:underline shrink-0 font-mono text-[10px]"
                                    >
                                      {p.mother.phone}
                                    </a>
                                  )}
                                </div>
                                <div className="text-[10px] text-zinc-400 truncate">
                                  {p.mother.education} • {p.mother.religion} • {p.mother.profession || 'Prof. N/I'}
                                </div>
                              </div>
                            )}

                            {p.father?.name && (
                              <div className="bg-zinc-950/50 px-2 py-1 rounded border border-zinc-800/60">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="truncate text-zinc-300 font-medium">👨 {p.father.name}</span>
                                  {p.father.phone && (
                                    <a
                                      href={`tel:${p.father.phone.replace(/\D/g, '')}`}
                                      className="text-teal-400 hover:underline shrink-0 font-mono text-[10px]"
                                    >
                                      {p.father.phone}
                                    </a>
                                  )}
                                </div>
                                <div className="text-[10px] text-zinc-400 truncate">
                                  {p.father.education} • {p.father.religion} • {p.father.profession || 'Prof. N/I'}
                                </div>
                              </div>
                            )}
                          </div>

                          {slot.todayEvolution ? (
                            <div className="p-2 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-[10px] text-emerald-200 line-clamp-2">
                              <strong className="text-emerald-400">Hoje ({slot.todayEvolution.time}):</strong> {slot.todayEvolution.content}
                            </div>
                          ) : slot.latestEvolution ? (
                            <div className="p-2 rounded-lg bg-zinc-950/60 border border-zinc-800 text-[10px] text-zinc-400 line-clamp-2">
                              <strong>Última ({formatDateBr(slot.latestEvolution.date)}):</strong> {slot.latestEvolution.content}
                            </div>
                          ) : null}

                          {slot.hasMentalAlert && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {p.childMentalHealth?.hasCondition && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-medium">
                                  🧠 Criança
                                </span>
                              )}
                              {p.mother?.hasPsych && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-medium">
                                  🧠 Mãe
                                </span>
                              )}
                              {p.father?.hasPsych && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-medium">
                                  🧠 Pai
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="py-8 flex flex-col items-center justify-center text-center">
                          <BedDouble className="w-7 h-7 text-zinc-700 mb-1.5" />
                          <p className="text-xs text-zinc-500 font-medium">Leito Disponível</p>
                          {isIsoBed && (
                            <p className="text-[10px] text-purple-400/80 mt-1">
                              Box de Isolamento ({slot.isolationType})
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="pt-3 mt-2 border-t border-zinc-800/80 flex items-center justify-between gap-1.5">
                      {slot.isOccupied && p ? (
                        <>
                          <button
                            onClick={() => handleOpenForm(p)}
                            className="flex-1 py-1.5 px-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[11px] font-medium text-zinc-200 flex items-center justify-center gap-1 transition-colors"
                          >
                            <Edit3 className="w-3 h-3 text-teal-400" />
                            <span>Evoluir</span>
                          </button>
                          <button
                            onClick={() => handleOpenTransferBedModal(p)}
                            className="py-1.5 px-2 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-700/40 text-[11px] font-medium text-cyan-300 flex items-center justify-center gap-1 transition-colors"
                            title="Mudar / Transferir criança de leito sem perder dados"
                          >
                            <ArrowRightLeft className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleOpenDischarge(p)}
                            className="py-1.5 px-2 rounded-lg bg-rose-950/30 hover:bg-rose-900/40 border border-rose-800/40 text-[11px] font-medium text-rose-300 flex items-center justify-center gap-1 transition-colors"
                            title="Registrar Alta ou Transferência Externa"
                          >
                            <LogOut className="w-3 h-3" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleOpenForm(null, bedName)}
                          className="w-full py-1.5 px-2.5 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 text-[11px] font-semibold text-teal-300 flex items-center justify-center gap-1 transition-all"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>Admitir no {bedName}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* ABA 2: FICHAS CLÍNICAS E EVOLUÇÕES DIÁRIAS */}
        {/* ===================================================================== */}
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

                  return (
                    <div
                      key={patient.id}
                      className={`rounded-2xl border p-5 flex flex-col justify-between transition-all ${
                        isDischarged
                          ? 'bg-zinc-900/40 border-zinc-800/70 opacity-85'
                          : isIso
                          ? 'bg-gradient-to-br from-purple-950/20 via-zinc-900 to-zinc-900 border-purple-500/40'
                          : 'bg-zinc-900/80 border-zinc-800'
                      }`}
                    >
                      <div className="space-y-3.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-lg bg-teal-500/20 text-teal-300 border border-teal-500/30">
                                {patient.bed}
                              </span>
                              {patient.bedTransferHistory && patient.bedTransferHistory.length > 0 && (
                                <span className="text-[10px] px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-semibold flex items-center gap-1">
                                  <History className="w-3 h-3" />
                                  Veio do {patient.bedTransferHistory[0].fromBed}
                                </span>
                              )}
                              <h3 className="text-base font-bold text-white">{patient.childName}</h3>
                              <span className="text-xs text-zinc-400">
                                ({patient.childAgeText || 'Idade N/I'})
                              </span>
                            </div>
                            <p className="text-xs text-zinc-400 mt-1 flex items-center gap-2 flex-wrap">
                              <span>🎂 DN: <strong className="text-zinc-200">{formatDateBr(patient.childBirthDate)}</strong></span>
                              <span>•</span>
                              <span>🌱 Naturalidade: <strong className="text-zinc-200">{patient.naturalness || 'N/I'}</strong></span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-teal-400" />
                                Procedência: <strong className="text-zinc-200">{patient.originCity || 'N/I'} - {patient.originState || 'PA'}</strong>
                              </span>
                            </p>
                          </div>

                          <span
                            className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
                              isDischarged
                                ? 'bg-zinc-800 text-zinc-300 border-zinc-700'
                                : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            }`}
                          >
                            {patient.status}
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/90 flex items-start gap-2.5">
                          <Stethoscope className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold block">
                              Diagnóstico Cardiológico / Cirúrgico
                            </span>
                            <p className="text-xs text-zinc-100 font-medium mt-0.5">
                              {patient.cardiacDiagnosis || 'Em investigação diagnóstica'}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-teal-300">
                                👩 Mãe {patient.mother?.age ? `(${patient.mother.age} anos)` : ''}
                              </span>
                              {patient.mother?.phone && (
                                <div className="flex items-center gap-1">
                                  <a
                                    href={`tel:${patient.mother.phone.replace(/\D/g, '')}`}
                                    className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-teal-300 text-[10px] flex items-center gap-1"
                                    title="Ligar para a Mãe"
                                  >
                                    <Phone className="w-2.5 h-2.5" />
                                    <span>{patient.mother.phone}</span>
                                  </a>
                                  {motherWa && (
                                    <a
                                      href={motherWa}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="px-1.5 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-semibold flex items-center gap-0.5"
                                    >
                                      <MessageCircle className="w-2.5 h-2.5" />
                                      <span>WA</span>
                                    </a>
                                  )}
                                </div>
                              )}
                            </div>
                            <p className="text-xs font-semibold text-zinc-100">
                              {patient.mother?.name || 'Não informado'}
                            </p>
                            <div className="text-[11px] text-zinc-400 space-y-0.5">
                              <div className="flex items-center gap-1">
                                <GraduationCap className="w-3 h-3 text-teal-400 shrink-0" />
                                <span>Esc.: <strong className="text-zinc-200">{patient.mother?.education || 'Não informado'}</strong></span>
                              </div>
                              <div className="flex items-center gap-1">
                                <BookOpen className="w-3 h-3 text-teal-400 shrink-0" />
                                <span>Religião: <strong className="text-zinc-200">{patient.mother?.religion || 'Não informado'}</strong></span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Briefcase className="w-3 h-3 text-teal-400 shrink-0" />
                                <span>Prof.: <strong className="text-zinc-200">{patient.mother?.profession || 'Não informada'}</strong></span>
                              </div>
                            </div>
                            {patient.mother?.hasPsych && (
                              <p className="text-[11px] text-amber-300 bg-amber-950/30 border border-amber-500/30 rounded-lg p-1.5 mt-1">
                                🧠 {patient.mother.psychDetails || 'Demanda psicológica materna ativa'}
                              </p>
                            )}
                          </div>

                          <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-cyan-300">
                                👨 Pai {patient.father?.age ? `(${patient.father.age} anos)` : ''}
                              </span>
                              {patient.father?.phone && (
                                <div className="flex items-center gap-1">
                                  <a
                                    href={`tel:${patient.father.phone.replace(/\D/g, '')}`}
                                    className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-cyan-300 text-[10px] flex items-center gap-1"
                                    title="Ligar para o Pai"
                                  >
                                    <Phone className="w-2.5 h-2.5" />
                                    <span>{patient.father.phone}</span>
                                  </a>
                                  {fatherWa && (
                                    <a
                                      href={fatherWa}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="px-1.5 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-semibold flex items-center gap-0.5"
                                    >
                                      <MessageCircle className="w-2.5 h-2.5" />
                                      <span>WA</span>
                                    </a>
                                  )}
                                </div>
                              )}
                            </div>
                            <p className="text-xs font-semibold text-zinc-100">
                              {patient.father?.name || 'Não informado'}
                            </p>
                            <div className="text-[11px] text-zinc-400 space-y-0.5">
                              <div className="flex items-center gap-1">
                                <GraduationCap className="w-3 h-3 text-cyan-400 shrink-0" />
                                <span>Esc.: <strong className="text-zinc-200">{patient.father?.education || 'Não informado'}</strong></span>
                              </div>
                              <div className="flex items-center gap-1">
                                <BookOpen className="w-3 h-3 text-cyan-400 shrink-0" />
                                <span>Religião: <strong className="text-zinc-200">{patient.father?.religion || 'Não informado'}</strong></span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Briefcase className="w-3 h-3 text-cyan-400 shrink-0" />
                                <span>Prof.: <strong className="text-zinc-200">{patient.father?.profession || 'Não informada'}</strong></span>
                              </div>
                            </div>
                            {patient.father?.hasPsych && (
                              <p className="text-[11px] text-amber-300 bg-amber-950/30 border border-amber-500/30 rounded-lg p-1.5 mt-1">
                                🧠 {patient.father.psychDetails || 'Demanda psicológica paterna ativa'}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-1.5 text-xs">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-teal-300 uppercase tracking-wider flex items-center gap-1">
                              <UserCheck className="w-3.5 h-3.5" />
                              Acompanhante(s) / Visitante(s) no Leito Hoje:
                            </span>
                            <span className="text-xs font-semibold text-zinc-100">
                              {patient.currentCompanion || 'Mãe'}
                            </span>
                          </div>
                          {patient.companionNotes && (
                            <p className="text-[11px] text-zinc-400">
                              Obs. de revezamento/visita: <span className="text-zinc-200">{patient.companionNotes}</span>
                            </p>
                          )}
                          {patient.companionName && (
                            <div className="pt-1.5 mt-1.5 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-300">
                              <div>
                                <strong className="text-purple-300">🤝 Outro Responsável ({patient.companionKinship || 'Familiar'}):</strong>{' '}
                                {patient.companionName} {patient.companionAge ? `(${patient.companionAge} anos)` : ''} • Esc.: {patient.companionEducation} • Rel.: {patient.companionReligion} • Prof.: {patient.companionProfession || 'N/I'}
                              </div>
                              {patient.companionPhone && (
                                <a
                                  href={`tel:${patient.companionPhone.replace(/\D/g, '')}`}
                                  className="text-teal-400 hover:underline font-mono"
                                >
                                  📞 {patient.companionPhone}
                                </a>
                              )}
                            </div>
                          )}
                        </div>

                        {patient.childMentalHealth?.hasCondition && (
                          <div className="p-2.5 rounded-xl bg-amber-950/25 border border-amber-500/30 text-xs text-amber-200">
                            <strong className="font-semibold">🧠 Saúde Mental / Neurodesenvolvimento (Criança):</strong>{' '}
                            {patient.childMentalHealth.details}
                          </div>
                        )}

                        <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase tracking-wider text-teal-400 font-bold flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Evoluções Psicológicas Diárias ({(patient.dailyEvolutions || []).length})
                            </span>
                            <button
                              onClick={() => handleOpenForm(patient)}
                              className="text-[11px] text-teal-300 hover:underline font-semibold"
                            >
                              + Inserir / Editar Evolução de Hoje
                            </button>
                          </div>

                          {(patient.dailyEvolutions || []).length === 0 ? (
                            <p className="text-xs text-zinc-500 italic">Nenhuma evolução diária registrada ainda.</p>
                          ) : (
                            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                              {(patient.dailyEvolutions || []).map((ev) => {
                                const isToday = ev.date === todayStr;
                                return (
                                  <div
                                    key={ev.id}
                                    className={`p-2.5 rounded-lg border text-xs ${
                                      isToday
                                        ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-100'
                                        : 'bg-zinc-900/70 border-zinc-800 text-zinc-300'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between text-[10px] mb-1">
                                      <span className={`font-bold ${isToday ? 'text-emerald-300' : 'text-teal-400'}`}>
                                        📅 {formatDateBr(ev.date)} às {ev.time || '08:30'} {isToday ? '• [EVOLUÇÃO DO DIA / HOJE]' : ''}
                                      </span>
                                      <span className="text-zinc-400">{ev.author || 'Psicologia UTI'}</span>
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
                        <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Admissão: {formatDateBr(patient.admissionDate)}
                        </span>
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => handleOpenForm(patient)}
                            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 flex items-center gap-1.5 transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-teal-400" />
                            <span>Editar / Evoluir Dia</span>
                          </button>
                          {!isDischarged && (
                            <>
                              <button
                                onClick={() => handleOpenTransferBedModal(patient)}
                                className="px-3 py-1.5 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-700/40 text-xs font-medium text-cyan-300 flex items-center gap-1.5 transition-colors"
                                title="Mudar criança de leito preservando toda a ficha e evoluções"
                              >
                                <ArrowRightLeft className="w-3.5 h-3.5 text-cyan-400" />
                                <span>Mudar Leito</span>
                              </button>
                              <button
                                onClick={() => handleOpenDischarge(patient)}
                                className="px-3 py-1.5 rounded-lg bg-rose-950/30 hover:bg-rose-900/40 border border-rose-800/40 text-xs font-medium text-rose-300 flex items-center gap-1 transition-colors"
                              >
                                <LogOut className="w-3.5 h-3.5 text-rose-400" />
                                <span>Dar Alta</span>
                              </button>
                            </>
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

        {/* ===================================================================== */}
        {/* ABA 3: TRIAGEM DE SAÚDE MENTAL (CRIANÇA, MÃE E PAI) */}
        {/* ===================================================================== */}
        {activeTab === 'mental_health' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/30 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <Brain className="w-6 h-6 text-amber-400 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-amber-200">
                    Monitoramento Ativo de Psicopatologia e Risco Psíquico (Criança, Mãe e Pai)
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Listagem das famílias internadas com demandas de saúde mental identificadas na admissão ou evolução.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sortPatientsByBedNumber(
                patients
                  .map(normalizePatientRecord)
                  .filter(
                    (p) =>
                      p.status === 'Internado' &&
                      (p.childMentalHealth?.hasCondition || p.mother?.hasPsych || p.father?.hasPsych)
                  )
              )
                .map((p) => (
                  <div
                    key={p.id}
                    className="p-4 rounded-2xl bg-zinc-900 border border-amber-500/30 space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          {p.bed} • {p.childName}
                        </span>
                        <span className="text-[11px] text-zinc-400">
                          {p.originCity}/{p.originState}
                        </span>
                      </div>

                      {p.childMentalHealth?.hasCondition && (
                        <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-500/30 text-xs">
                          <strong className="text-amber-300 block mb-0.5">
                            🧒 Criança ({p.childAgeText}):
                          </strong>
                          <p className="text-zinc-200">{p.childMentalHealth.details}</p>
                        </div>
                      )}

                      {p.mother?.hasPsych && (
                        <div className="p-2.5 rounded-xl bg-teal-950/30 border border-teal-500/30 text-xs">
                          <strong className="text-teal-300 block mb-0.5">
                            👩 Mãe ({p.mother.name || 'N/I'} • {p.mother.education} • {p.mother.religion} • {p.mother.profession || 'Prof. N/I'}):
                          </strong>
                          <p className="text-zinc-200">{p.mother.psychDetails}</p>
                        </div>
                      )}

                      {p.father?.hasPsych && (
                        <div className="p-2.5 rounded-xl bg-cyan-950/30 border border-cyan-500/30 text-xs">
                          <strong className="text-cyan-300 block mb-0.5">
                            👨 Pai ({p.father.name || 'N/I'} • {p.father.education} • {p.father.religion} • {p.father.profession || 'Prof. N/I'}):
                          </strong>
                          <p className="text-zinc-200">{p.father.psychDetails}</p>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-zinc-800 flex justify-end gap-2">
                      <button
                        onClick={() => handleOpenTransferBedModal(p)}
                        className="px-3 py-1.5 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-700/40 text-xs text-cyan-300 flex items-center gap-1"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        <span>Mudar Leito</span>
                      </button>
                      <button
                        onClick={() => handleOpenForm(p)}
                        className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-teal-300 font-medium flex items-center gap-1.5"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Atualizar Acompanhamento</span>
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* ABA 4: HISTÓRICO DE ALTAS E DESFECHOS */}
        {/* ===================================================================== */}
        {activeTab === 'discharges' && (
          <div className="space-y-3">
            {patients.filter((p) => p.status !== 'Internado').length === 0 ? (
              <div className="p-12 text-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30">
                <LogOut className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                <p className="text-zinc-400 text-sm">Nenhuma alta ou transferência externa registrada ainda.</p>
              </div>
            ) : (
              sortPatientsByBedNumber(
                patients
                  .filter((p) => p.status !== 'Internado')
                  .map(normalizePatientRecord)
              )
                .map((p) => (
                  <div
                    key={p.id}
                    className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                          {p.bed}
                        </span>
                        <h4 className="text-sm font-bold text-zinc-100">{p.childName}</h4>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30">
                          {p.status}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400">
                        Data do Desfecho: {formatDateBr(p.dischargeDate)} • Síntese: {p.dischargeNote}
                      </p>
                    </div>
                    <button
                      onClick={() => handleOpenForm(p)}
                      className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 self-start sm:self-center"
                    >
                      Reabrir / Ver Ficha
                    </button>
                  </div>
                ))
            )}
          </div>
        )}
      </main>

      {/* ===================================================================== */}
      {/* MODAL DE ADMISSÃO, CADASTRO FAMILIAR E EVOLUÇÕES DIÁRIAS POR DATA */}
      {/* ===================================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-4xl w-full p-5 sm:p-6 space-y-5 shadow-2xl my-8 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3 sticky top-0 bg-zinc-900 z-10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-teal-500/15 text-teal-400 border border-teal-500/30">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-zinc-100">
                    {editingPatient ? `Ficha Clínica & Evolução Diária — ${editingPatient.childName}` : 'Admitir Criança na UTI Pediátrica Cardíaca'}
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Dados da Criança (DN, Naturalidade e Procedência), Mãe, Pai (Escolaridade, Religião e Profissão) e Evolução por Data
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  stopCurrentSpeech();
                  setIsModalOpen(false);
                }}
                className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePatient} className="space-y-5 text-xs">
              
              {/* BLOCO 1: DADOS DA CRIANÇA */}
              <div className="p-4 rounded-xl bg-zinc-950/90 border border-zinc-800 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
                  <BedDouble className="w-4 h-4" />
                  1. Identificação da Criança, Naturalidade, Procedência e Cardiopatia
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-zinc-400 mb-1 font-medium">Leito Nominal *</label>
                    <select
                      value={formData.bed}
                      onChange={(e) => setFormData({ ...formData, bed: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:border-teal-500 focus:outline-none"
                    >
                      {TOTAL_BEDS.map((b) => (
                        <option key={b} value={b}>
                          {b} {b === 'Leito 10' ? '(Isolamento)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-zinc-400 mb-1 font-medium">Nome Completo da Criança *</label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        required
                        placeholder="Ex.: Arthur Gabriel Barreto Silva"
                        value={formData.childName}
                        onChange={(e) => setFormData({ ...formData, childName: e.target.value })}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:border-teal-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleToggleFieldDictation('childName')}
                        className={`px-2.5 rounded-lg border transition-colors ${
                          activeFieldListening === 'childName'
                            ? 'bg-rose-500/20 border-rose-500 text-rose-300 animate-pulse'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-teal-300'
                        }`}
                        title="Ditar nome da criança por voz"
                      >
                        <Mic className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-zinc-400 mb-1 font-medium">Data de Nascimento</label>
                    <input
                      type="date"
                      value={formData.childBirthDate}
                      onChange={(e) => {
                        const newBirth = e.target.value;
                        const autoAge = calculateAgeFromBirthDate(newBirth);
                        setFormData({
                          ...formData,
                          childBirthDate: newBirth,
                          childAgeText: autoAge || formData.childAgeText
                        });
                      }}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-2 text-zinc-100 focus:border-teal-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-zinc-400 mb-1 font-medium">Idade (Calculada ou Manual)</label>
                    <input
                      type="text"
                      placeholder="Ex.: 1 ano e 4 meses"
                      value={formData.childAgeText}
                      onChange={(e) => setFormData({ ...formData, childAgeText: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:border-teal-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-400 mb-1 font-medium">Naturalidade (Onde nasceu)</label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="Ex.: Belém - PA"
                        value={formData.naturalness}
                        onChange={(e) => setFormData({ ...formData, naturalness: e.target.value })}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:border-teal-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleToggleFieldDictation('naturalness')}
                        className={`px-2.5 rounded-lg border ${
                          activeFieldListening === 'naturalness'
                            ? 'bg-rose-500/20 border-rose-500 text-rose-300 animate-pulse'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                        }`}
                        title="Ditar naturalidade"
                      >
                        <Mic className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-zinc-400 mb-1 font-medium">Município de Origem/Procedência</label>
                    <input
                      type="text"
                      placeholder="Ex.: Santarém, Abaetetuba..."
                      value={formData.originCity}
                      onChange={(e) => setFormData({ ...formData, originCity: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:border-teal-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-zinc-400 mb-1 font-medium">UF</label>
                      <input
                        type="text"
                        maxLength={2}
                        value={formData.originState}
                        onChange={(e) => setFormData({ ...formData, originState: e.target.value.toUpperCase() })}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-2 text-zinc-100 uppercase"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-400 mb-1 font-medium">Admissão</label>
                      <input
                        type="date"
                        value={formData.admissionDate}
                        onChange={(e) => setFormData({ ...formData, admissionDate: e.target.value })}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-2 text-zinc-100"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Diagnóstico Cardiológico / Cirurgia / Pós-Operatório</label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="Ex.: Pós-operatório de Tetralogia de Fallot D+3..."
                      value={formData.cardiacDiagnosis}
                      onChange={(e) => setFormData({ ...formData, cardiacDiagnosis: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:border-teal-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleToggleFieldDictation('cardiacDiagnosis')}
                      className={`px-2.5 rounded-lg border ${
                        activeFieldListening === 'cardiacDiagnosis'
                          ? 'bg-rose-500/20 border-rose-500 text-rose-300 animate-pulse'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-teal-300'
                      }`}
                    >
                      <Mic className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* BLOCO 2: DADOS DA MÃE */}
              <div className="p-4 rounded-xl bg-teal-950/15 border border-teal-500/30 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-teal-300 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-teal-400" />
                  2. Dados da Mãe (Nome, Idade, Telefone, Escolaridade, Religião, Profissão e Saúde Mental)
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-zinc-400 mb-1 font-medium">Nome Completo da Mãe</label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="Ex.: Mariana Barreto Silva"
                        value={formData.mother.name}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            mother: { ...formData.mother, name: e.target.value }
                          })
                        }
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100"
                      />
                      <button
                        type="button"
                        onClick={() => handleToggleFieldDictation('mother', 'name')}
                        className={`px-2.5 rounded-lg border ${
                          activeFieldListening === 'mother.name'
                            ? 'bg-rose-500/20 border-rose-500 text-rose-300 animate-pulse'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                        }`}
                      >
                        <Mic className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-zinc-400 mb-1 font-medium">Idade da Mãe</label>
                    <input
                      type="number"
                      placeholder="Ex.: 26"
                      value={formData.mother.age}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          mother: { ...formData.mother, age: e.target.value }
                        })
                      }
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-400 mb-1 font-medium">Telefone / WhatsApp da Mãe</label>
                    <input
                      type="text"
                      placeholder="(91) 98888-7777"
                      value={formData.mother.phone}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          mother: { ...formData.mother, phone: formatPhoneMask(e.target.value) }
                        })
                      }
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-zinc-400 mb-1 font-medium flex items-center gap-1">
                      <GraduationCap className="w-3.5 h-3.5 text-teal-400" />
                      Escolaridade da Mãe (Selecione)
                    </label>
                    <select
                      value={formData.mother.education}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          mother: { ...formData.mother, education: e.target.value }
                        })
                      }
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:border-teal-500 focus:outline-none"
                    >
                      {EDUCATION_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-zinc-400 mb-1 font-medium flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5 text-teal-400" />
                      Religião da Mãe (Selecione)
                    </label>
                    <select
                      value={formData.mother.religion}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          mother: { ...formData.mother, religion: e.target.value }
                        })
                      }
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:border-teal-500 focus:outline-none"
                    >
                      {RELIGION_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-zinc-400 mb-1 font-medium flex items-center gap-1">
                      <Briefcase className="w-3.5 h-3.5 text-teal-400" />
                      Profissão / Ocupação da Mãe
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="Ex.: Professora, Autônoma, Do Lar, Pescadora..."
                        value={formData.mother.profession}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            mother: { ...formData.mother, profession: e.target.value }
                          })
                        }
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100"
                      />
                      <button
                        type="button"
                        onClick={() => handleToggleFieldDictation('mother', 'profession')}
                        className={`px-2.5 rounded-lg border ${
                          activeFieldListening === 'mother.profession'
                            ? 'bg-rose-500/20 border-rose-500 text-rose-300 animate-pulse'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                        }`}
                        title="Ditar profissão da mãe"
                      >
                        <Mic className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-1 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-zinc-200 font-medium">
                    <input
                      type="checkbox"
                      checked={formData.mother.hasPsych}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          mother: { ...formData.mother, hasPsych: e.target.checked }
                        })
                      }
                      className="rounded border-zinc-700 text-teal-500 focus:ring-teal-500 w-4 h-4 accent-teal-500"
                    />
                    <span>Mãe apresenta demanda de Saúde Mental / Psicopatologia / Sofrimento Psíquico Agudo</span>
                  </label>

                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="Detalhe histórico psiquiátrico, ansiedade, medicações ou rede de apoio da mãe..."
                      value={formData.mother.psychDetails}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          mother: { ...formData.mother, psychDetails: e.target.value }
                        })
                      }
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100"
                    />
                    <button
                      type="button"
                      onClick={() => handleToggleFieldDictation('mother', 'psychDetails')}
                      className={`px-2.5 rounded-lg border ${
                        activeFieldListening === 'mother.psychDetails'
                          ? 'bg-rose-500/20 border-rose-500 text-rose-300 animate-pulse'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                      }`}
                    >
                      <Mic className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* BLOCO 3: DADOS DO PAI */}
              <div className="p-4 rounded-xl bg-cyan-950/15 border border-cyan-500/30 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-cyan-400" />
                  3. Dados do Pai (Nome, Idade, Telefone, Escolaridade, Religião, Profissão e Saúde Mental)
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-zinc-400 mb-1 font-medium">Nome Completo do Pai</label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="Ex.: Lucas Gabriel Silva"
                        value={formData.father.name}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            father: { ...formData.father, name: e.target.value }
                          })
                        }
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100"
                      />
                      <button
                        type="button"
                        onClick={() => handleToggleFieldDictation('father', 'name')}
                        className={`px-2.5 rounded-lg border ${
                          activeFieldListening === 'father.name'
                            ? 'bg-rose-500/20 border-rose-500 text-rose-300 animate-pulse'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                        }`}
                      >
                        <Mic className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-zinc-400 mb-1 font-medium">Idade do Pai</label>
                    <input
                      type="number"
                      placeholder="Ex.: 30"
                      value={formData.father.age}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          father: { ...formData.father, age: e.target.value }
                        })
                      }
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-400 mb-1 font-medium">Telefone / WhatsApp do Pai</label>
                    <input
                      type="text"
                      placeholder="(91) 98444-5555"
                      value={formData.father.phone}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          father: { ...formData.father, phone: formatPhoneMask(e.target.value) }
                        })
                      }
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-zinc-400 mb-1 font-medium flex items-center gap-1">
                      <GraduationCap className="w-3.5 h-3.5 text-cyan-400" />
                      Escolaridade do Pai (Selecione)
                    </label>
                    <select
                      value={formData.father.education}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          father: { ...formData.father, education: e.target.value }
                        })
                      }
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:border-cyan-500 focus:outline-none"
                    >
                      {EDUCATION_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-zinc-400 mb-1 font-medium flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
                      Religião do Pai (Selecione)
                    </label>
                    <select
                      value={formData.father.religion}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          father: { ...formData.father, religion: e.target.value }
                        })
                      }
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:border-cyan-500 focus:outline-none"
                    >
                      {RELIGION_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-zinc-400 mb-1 font-medium flex items-center gap-1">
                      <Briefcase className="w-3.5 h-3.5 text-cyan-400" />
                      Profissão / Ocupação do Pai
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="Ex.: Motorista, Carpinteiro, Agricultor..."
                        value={formData.father.profession}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            father: { ...formData.father, profession: e.target.value }
                          })
                        }
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100"
                      />
                      <button
                        type="button"
                        onClick={() => handleToggleFieldDictation('father', 'profession')}
                        className={`px-2.5 rounded-lg border ${
                          activeFieldListening === 'father.profession'
                            ? 'bg-rose-500/20 border-rose-500 text-rose-300 animate-pulse'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                        }`}
                        title="Ditar profissão do pai"
                      >
                        <Mic className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-1 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-zinc-200 font-medium">
                    <input
                      type="checkbox"
                      checked={formData.father.hasPsych}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          father: { ...formData.father, hasPsych: e.target.checked }
                        })
                      }
                      className="rounded border-zinc-700 text-cyan-500 focus:ring-cyan-500 w-4 h-4 accent-cyan-500"
                    />
                    <span>Pai apresenta demanda de Saúde Mental / Psicopatologia / Sofrimento Psíquico Agudo</span>
                  </label>

                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="Detalhe histórico psiquiátrico, sobrecarga emocional ou observações sobre o pai..."
                      value={formData.father.psychDetails}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          father: { ...formData.father, psychDetails: e.target.value }
                        })
                      }
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100"
                    />
                    <button
                      type="button"
                      onClick={() => handleToggleFieldDictation('father', 'psychDetails')}
                      className={`px-2.5 rounded-lg border ${
                        activeFieldListening === 'father.psychDetails'
                          ? 'bg-rose-500/20 border-rose-500 text-rose-300 animate-pulse'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                      }`}
                    >
                      <Mic className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* BLOCO 4: ACOMPANHANTES E VISITANTES PRESENTES NO LEITO HOJE (MÚLTIPLOS) */}
              <div className="p-4 rounded-xl bg-zinc-950/90 border border-teal-500/30 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-teal-300 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-teal-400" />
                    4. Acompanhantes / Visitantes Presentes no Leito Hoje (Selecione 1 ou mais)
                  </h3>
                  <span className="text-[11px] text-zinc-400">
                    Selecionados: <strong className="text-teal-300">{formData.currentCompanion || 'Mãe'}</strong>
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {COMPANION_PRESENCE_OPTIONS.map((option) => {
                    const isSelected = (formData.currentCompanionsList || []).includes(option);
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => handleToggleCompanionPresence(option)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-teal-500 text-zinc-950 border-teal-400 shadow-sm'
                            : 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:border-teal-500/50'
                        }`}
                      >
                        <div
                          className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${
                            isSelected ? 'border-zinc-950 bg-zinc-950/20' : 'border-zinc-600'
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5 text-zinc-950 stroke-[3]" />}
                        </div>
                        <span>{option}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-2.5">
                  <span className="text-[11px] font-semibold text-zinc-300 block">
                    + Adicionar Acompanhante / Visitante Nominal em Visita ao Leito (quando houver mais pessoas):
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <input
                      type="text"
                      placeholder="Nome do acompanhante/visitante"
                      value={newVisitorName}
                      onChange={(e) => setNewVisitorName(e.target.value)}
                      className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-zinc-100"
                    />
                    <input
                      type="text"
                      placeholder="Parentesco (Ex.: Tia, Avô, Irmã)"
                      value={newVisitorKinship}
                      onChange={(e) => setNewVisitorKinship(e.target.value)}
                      className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-zinc-100"
                    />
                    <input
                      type="text"
                      placeholder="Telefone (opcional)"
                      value={newVisitorPhone}
                      onChange={(e) => setNewVisitorPhone(formatPhoneMask(e.target.value))}
                      className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-zinc-100"
                    />
                    <button
                      type="button"
                      onClick={handleAddExtraBedsideVisitor}
                      className="px-3 py-1.5 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 font-bold text-xs flex items-center justify-center gap-1"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Incluir no Leito</span>
                    </button>
                  </div>

                  {(formData.extraBedsideVisitors || []).length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {formData.extraBedsideVisitors.map((vis) => (
                        <div
                          key={vis.id}
                          className="px-2.5 py-1 rounded-lg bg-teal-950/40 border border-teal-500/40 text-teal-200 text-xs flex items-center gap-2"
                        >
                          <span>
                            👥 <strong>{vis.name}</strong> ({vis.kinship}){vis.phone ? ` • ${vis.phone}` : ''}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveExtraBedsideVisitor(vis.id)}
                            className="text-zinc-400 hover:text-rose-400"
                            title="Remover acompanhante"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1">
                    Observações sobre Revezamento / Visitas no Leito Hoje (opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex.: Mãe permanece pela manhã; Pai e Avó Materna presentes durante a visita vespertina..."
                    value={formData.companionNotes || ''}
                    onChange={(e) => setFormData({ ...formData, companionNotes: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100"
                  />
                </div>
              </div>

              {/* BLOCO 5: DADOS DE OUTRO RESPONSÁVEL / CUIDADOR PRINCIPAL */}
              <div className="p-4 rounded-xl bg-purple-950/15 border border-purple-500/30 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-purple-400" />
                  5. Dados de Outro Responsável / Cuidador Principal (Avó, Tia, Tutor Legal, etc.)
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-zinc-400 mb-1">Nome Completo (Outro Responsável)</label>
                    <input
                      type="text"
                      placeholder="Ex.: Raimunda Nonata de Oliveira"
                      value={formData.companionName}
                      onChange={(e) => setFormData({ ...formData, companionName: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-400 mb-1">Grau de Parentesco / Vínculo</label>
                    <input
                      type="text"
                      placeholder="Ex.: Avó Materna, Tia, Madrinha..."
                      value={formData.companionKinship}
                      onChange={(e) => setFormData({ ...formData, companionKinship: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-400 mb-1">Idade (Outro Responsável)</label>
                    <input
                      type="number"
                      placeholder="Ex.: 58"
                      value={formData.companionAge}
                      onChange={(e) => setFormData({ ...formData, companionAge: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-zinc-400 mb-1">Escolaridade (Outro Resp.)</label>
                    <select
                      value={formData.companionEducation}
                      onChange={(e) => setFormData({ ...formData, companionEducation: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100"
                    >
                      {EDUCATION_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-zinc-400 mb-1">Religião (Outro Resp.)</label>
                    <select
                      value={formData.companionReligion}
                      onChange={(e) => setFormData({ ...formData, companionReligion: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100"
                    >
                      {RELIGION_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-zinc-400 mb-1">Profissão (Outro Resp.)</label>
                    <input
                      type="text"
                      placeholder="Ex.: Costureira, Aposentada..."
                      value={formData.companionProfession}
                      onChange={(e) => setFormData({ ...formData, companionProfession: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-400 mb-1">Telefone / WhatsApp (Outro Resp.)</label>
                    <input
                      type="text"
                      placeholder="(91) 99999-0000"
                      value={formData.companionPhone}
                      onChange={(e) => setFormData({ ...formData, companionPhone: formatPhoneMask(e.target.value) })}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100"
                    />
                  </div>
                </div>
              </div>

              {/* BLOCO 6: SAÚDE MENTAL DA CRIANÇA */}
              <div className="p-4 rounded-xl bg-amber-950/15 border border-amber-500/30 space-y-2.5">
                <label className="flex items-center gap-2 cursor-pointer text-amber-200 font-bold">
                  <input
                    type="checkbox"
                    checked={formData.childMentalHealth.hasCondition}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        childMentalHealth: { ...formData.childMentalHealth, hasCondition: e.target.checked }
                      })
                    }
                    className="rounded border-zinc-700 w-4 h-4 accent-amber-500"
                  />
                  <span>6. Criança apresenta condição neuropsiquiátrica / TEA / T21 ou demanda psicológica específica</span>
                </label>

                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="Ex.: TEA Nível 1, Síndrome de Down, ansiedade de separação acentuada..."
                    value={formData.childMentalHealth.details}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        childMentalHealth: { ...formData.childMentalHealth, details: e.target.value }
                      })
                    }
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100"
                  />
                  <button
                    type="button"
                    onClick={() => handleToggleFieldDictation('childMentalHealth', 'details')}
                    className={`px-2.5 rounded-lg border ${
                      activeFieldListening === 'childMentalHealth.details'
                        ? 'bg-rose-500/20 border-rose-500 text-rose-300 animate-pulse'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                    }`}
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* BLOCO 7: EVOLUÇÕES PSICOLÓGICAS SEPARADAS POR DATA (DIÁRIAS) */}
              <div className="p-4 rounded-xl bg-emerald-950/15 border border-emerald-500/40 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-500/20 pb-2">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-emerald-400" />
                      7. Evolução Psicológica Diária (Separada por Data)
                    </h3>
                    <p className="text-[11px] text-zinc-400">
                      A evolução com a data de <strong>Hoje ({formatDateBr(todayStr)})</strong> será destacada automaticamente na Passagem de Plantão.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-[11px] text-emerald-300 font-semibold">Data da Evolução:</label>
                    <input
                      type="date"
                      value={selectedEvolutionDate}
                      onChange={(e) => handleSelectEvolutionDateChange(e.target.value)}
                      className="bg-zinc-900 border border-emerald-500/40 rounded-lg px-2.5 py-1.5 text-zinc-100 font-semibold"
                    />
                    {selectedEvolutionDate !== todayStr && (
                      <button
                        type="button"
                        onClick={() => handleSelectEvolutionDateChange(todayStr)}
                        className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold"
                      >
                        Ir p/ Hoje
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-zinc-300 font-semibold">
                      Texto da Evolução do Dia ({formatDateBr(selectedEvolutionDate)}):
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleFieldDictation('dailyEvolutionDraft')}
                        className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1 ${
                          activeFieldListening === 'dailyEvolutionDraft'
                            ? 'bg-rose-500/20 border-rose-500 text-rose-300 animate-pulse'
                            : 'bg-zinc-800 border-zinc-700 text-teal-300 hover:bg-zinc-700'
                        }`}
                      >
                        <Mic className="w-3.5 h-3.5" />
                        <span>{activeFieldListening === 'dailyEvolutionDraft' ? 'Ouvindo Evolução...' : 'Ditar Evolução do Dia'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleSaveDailyEvolutionEntry}
                        className="px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold flex items-center gap-1"
                      >
                        <Send className="w-3 h-3" />
                        <span>Registrar na Linha do Tempo</span>
                      </button>
                    </div>
                  </div>

                  <textarea
                    rows={3}
                    placeholder={`Descreva o atendimento psicológico realizado em ${formatDateBr(selectedEvolutionDate)}...`}
                    value={currentEvolutionDraft}
                    onChange={(e) => setCurrentEvolutionDraft(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-zinc-100 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                {(formData.dailyEvolutions || []).length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-zinc-800/80 max-h-44 overflow-y-auto">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                      Histórico Diário Registrado ({formData.dailyEvolutions.length} dias):
                    </span>
                    {formData.dailyEvolutions.map((ev) => {
                      const isEvoToday = ev.date === todayStr;
                      return (
                        <div
                          key={ev.id}
                          className={`p-2.5 rounded-lg border flex items-start justify-between gap-2 ${
                            isEvoToday
                              ? 'bg-emerald-950/30 border-emerald-500/40'
                              : 'bg-zinc-900/70 border-zinc-800'
                          }`}
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className={`text-[11px] font-bold ${isEvoToday ? 'text-emerald-300' : 'text-teal-400'}`}>
                                📅 {formatDateBr(ev.date)} às {ev.time} {isEvoToday ? '(HOJE)' : ''}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleSelectEvolutionDateChange(ev.date)}
                                className="text-[10px] text-zinc-400 hover:text-white underline"
                              >
                                Editar esta data
                              </button>
                            </div>
                            <p className="text-zinc-200 text-xs whitespace-pre-line">{ev.content}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteDailyEvolutionEntry(ev.id, ev.date)}
                            className="p-1 text-zinc-500 hover:text-rose-400"
                            title="Remover evolução desta data"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    stopCurrentSpeech();
                    setIsModalOpen(false);
                  }}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-zinc-950 font-bold shadow-lg shadow-teal-950/50 flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Salvar Ficha & Sincronizar Dispositivos</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL DE MUDANÇA / TRANSFERÊNCIA OU PERMUTA DE LEITO (ZERO PERDA) */}
      {/* ===================================================================== */}
      {transferModalPatient && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-cyan-500/40 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-100">
                    Mudar / Transferir Criança de Leito
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Preserva 100% dos dados dos pais, psicopatologia e evoluções diárias
                  </p>
                </div>
              </div>
              <button onClick={() => setTransferModalPatient(null)} className="text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Paciente selecionado:</span>
                <span className="px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 font-bold">
                  Atual: {transferModalPatient.bed}
                </span>
              </div>
              <p className="text-sm font-bold text-zinc-100">{transferModalPatient.childName}</p>
              <p className="text-[11px] text-zinc-400">
                {(transferModalPatient.dailyEvolutions || []).length} evolução(ões) diária(s) e cadastro familiar serão transferidos intactos.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-300 font-semibold mb-1.5">
                  Selecione o Novo Leito de Destino:
                </label>
                <select
                  value={targetTransferBed}
                  onChange={(e) => setTargetTransferBed(e.target.value)}
                  className="w-full bg-zinc-950 border border-cyan-500/40 rounded-xl px-3 py-2.5 text-zinc-100 font-semibold focus:border-cyan-400 focus:outline-none"
                >
                  {TOTAL_BEDS.filter((b) => b !== transferModalPatient.bed).map((bedName) => {
                    const occupant = patients.find((p) => p.bed === bedName && p.status === 'Internado');
                    return (
                      <option key={bedName} value={bedName}>
                        {bedName} {bedName === 'Leito 10' ? '(Box Isolamento)' : ''} —{' '}
                        {occupant ? `🔄 PERMUTAR COM: ${occupant.childName}` : '✅ LEITO VAGO'}
                      </option>
                    );
                  })}
                </select>
              </div>

              {(() => {
                const occupant = patients.find(
                  (p) => p.bed === targetTransferBed && p.status === 'Internado' && p.id !== transferModalPatient.id
                );
                if (!occupant) return null;
                return (
                  <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/40 text-amber-200 space-y-1">
                    <strong className="flex items-center gap-1.5 text-amber-300">
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      Permuta Automática Segura Detectada:
                    </strong>
                    <p className="text-[11px] leading-relaxed">
                      O <strong>{targetTransferBed}</strong> está ocupado por <strong>{occupant.childName}</strong>. Ao confirmar, os dois pacientes trocarão de leito automaticamente (<strong>{transferModalPatient.childName}</strong> vai para o {targetTransferBed} e <strong>{occupant.childName}</strong> vai para o {transferModalPatient.bed}) sem perder nenhum dado!
                    </p>
                  </div>
                );
              })()}

              <div>
                <label className="block text-zinc-400 mb-1">
                  Motivo da mudança de leito (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex.: Necessidade de isolamento no Leito 10 / Reorganização de enfermagem..."
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={recordTransferInEvolution}
                  onChange={(e) => setRecordTransferInEvolution(e.target.checked)}
                  className="w-4 h-4 accent-cyan-500 rounded"
                />
                <span className="text-zinc-300">
                  Registrar nota automática da mudança de leito na evolução de hoje ({formatDateBr(todayStr)})
                </span>
              </label>

              {transferModalPatient.bedTransferHistory && transferModalPatient.bedTransferHistory.length > 0 && (
                <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-zinc-400 block">
                    Histórico Anterior de Leitos desta Criança:
                  </span>
                  {transferModalPatient.bedTransferHistory.map((tr, i) => (
                    <div key={tr.id || i} className="text-[11px] text-zinc-300">
                      • {formatDateBr(tr.date)} às {tr.time}: <strong>{tr.fromBed}</strong> ➔ <strong>{tr.toBed}</strong> ({tr.reason})
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setTransferModalPatient(null)}
                className="px-4 py-2 rounded-lg bg-zinc-800 text-xs text-zinc-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmBedTransfer}
                className="px-5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-cyan-950/50"
              >
                <ArrowRightLeft className="w-4 h-4" />
                <span>Confirmar Mudança para {targetTransferBed}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL DE ALTA E DESFECHO */}
      {/* ===================================================================== */}
      {dischargeModalPatient && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <LogOut className="w-5 h-5 text-rose-400" />
                Registrar Alta / Saída do {dischargeModalPatient.bed}
              </h3>
              <button onClick={() => setDischargeModalPatient(null)} className="text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-300">
              Paciente: <strong className="text-white">{dischargeModalPatient.childName}</strong>
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1">Tipo de Desfecho</label>
                <select
                  value={dischargeStatus}
                  onChange={(e) => setDischargeStatus(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100"
                >
                  <option value="Alta para Enfermaria">Alta para Enfermaria Pediátrica</option>
                  <option value="Alta Hospitalar">Alta Hospitalar (Domicílio)</option>
                  <option value="Transferência Externa">Transferência Externa</option>
                  <option value="Óbito">Óbito (Acompanhamento de Luto)</option>
                </select>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">Síntese Psicológica de Desfecho / Encaminhamento</label>
                <textarea
                  rows={3}
                  placeholder="Ex.: Genitora orientada para seguimento psicológico na enfermaria..."
                  value={dischargeNote}
                  onChange={(e) => setDischargeNote(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-zinc-100"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDischargeModalPatient(null)}
                className="px-4 py-2 rounded-lg bg-zinc-800 text-xs text-zinc-300"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDischarge}
                className="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-400 text-zinc-950 font-bold text-xs"
              >
                Confirmar Saída e Liberar Leito
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL DO LEITO 10 (CONFIGURAÇÃO DE ISOLAMENTO) */}
      {/* ===================================================================== */}
      {isIsolationModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-purple-500/40 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-purple-300 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-purple-400" />
                Protocolo do Leito 10 (Box de Isolamento)
              </h3>
              <button onClick={() => setIsIsolationModalOpen(false)} className="text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <label className="flex items-center justify-between p-3 rounded-xl bg-zinc-950 border border-zinc-800 cursor-pointer">
                <span className="font-semibold text-zinc-200">Leito 10 em uso ativo como Isolamento?</span>
                <input
                  type="checkbox"
                  checked={bed10Config.inIsolationUse}
                  onChange={(e) => handleUpdateBed10Config({ ...bed10Config, inIsolationUse: e.target.checked })}
                  className="w-4 h-4 accent-purple-500"
                />
              </label>

              <div>
                <label className="block text-zinc-400 mb-1">Tipo de Precaução</label>
                <select
                  value={bed10Config.isolationType}
                  onChange={(e) => handleUpdateBed10Config({ ...bed10Config, isolationType: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100"
                >
                  <option value="Contato">Precaução de Contato</option>
                  <option value="Gotículas">Precaução de Gotículas</option>
                  <option value="Aerossóis">Precaução de Aerossóis</option>
                  <option value="Protetor / Neutropenia">Isolamento Protetor</option>
                </select>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">Justificativa Clínica / Observação Ambiental</label>
                <textarea
                  rows={2}
                  value={bed10Config.isolationReason}
                  onChange={(e) => handleUpdateBed10Config({ ...bed10Config, isolationReason: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-zinc-100"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsIsolationModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-400 text-zinc-950 font-bold text-xs"
              >
                Concluir e Sincronizar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL DE DITADO INTELIGENTE POR VOZ (IA HEURÍSTICA PT-BR) */}
      {/* ===================================================================== */}
      {isAiVoiceModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-purple-500/40 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-zinc-100">Ditado Inteligente por Voz (pt-BR)</h3>
              </div>
              <button
                onClick={() => {
                  stopCurrentSpeech();
                  setIsAiVoiceModalOpen(false);
                }}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Dite naturalmente: <em>&ldquo;Leito 4, criança Pedro Henrique, nascido em 10/05/2024, natural de Belém, procedente de Castanhal, diagnóstico Tetralogia de Fallot. Mãe Ana Maria com 27 anos, escolaridade da mãe ensino médio completo, religião da mãe católica, profissão da mãe vendedora, telefone da mãe 91 98888-1111. Pai João Pedro com 30 anos, evolução acolhimento realizado...&rdquo;</em>
            </p>

            <textarea
              rows={4}
              value={voiceLiveTranscript}
              onChange={(e) => {
                setVoiceLiveTranscript(e.target.value);
                setAiDictationSummary(parseMedicalSpeech(e.target.value));
              }}
              placeholder="A transcrição da sua fala aparecerá aqui em tempo real..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-100"
            />

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleToggleGlobalVoiceDictation}
                className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 ${
                  isListeningGlobal
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'bg-zinc-800 text-zinc-200'
                }`}
              >
                {isListeningGlobal ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                <span>{isListeningGlobal ? 'Pausar Microfone' : 'Retomar Microfone'}</span>
              </button>

              <button
                type="button"
                onClick={handleApplyVoiceToForm}
                className="px-5 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5"
              >
                <Wand2 className="w-4 h-4" />
                <span>Preencher Ficha com estes Dados</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL DE PRÉ-VISUALIZAÇÃO DA PASSAGEM DE PLANTÃO (DESTAQUE DO DIA) */}
      {/* ===================================================================== */}
      {isHandoverPreviewOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-teal-500/40 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-teal-400" />
                  Relatório Enxuto de Passagem de Plantão ({formatDateBr(todayStr)})
                </h3>
                <p className="text-xs text-zinc-400">
                  Focado na identificação essencial do paciente e exclusivamente na evolução registrada hoje.
                </p>
              </div>
              <button onClick={() => setIsHandoverPreviewOpen(false)} className="text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <pre className="flex-1 overflow-y-auto bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-xs text-zinc-200 whitespace-pre-wrap font-sans leading-relaxed">
              {buildHandoverReportText()}
            </pre>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                onClick={() => setIsHandoverPreviewOpen(false)}
                className="px-4 py-2 rounded-lg bg-zinc-800 text-xs text-zinc-300"
              >
                Fechar
              </button>
              <button
                onClick={handleCopyHandoverText}
                className="px-5 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5"
              >
                <Copy className="w-4 h-4" />
                <span>{copySuccess ? 'Relatório Copiado!' : 'Copiar para WhatsApp / Prontuário'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL DE STATUS DE SINCRONIZAÇÃO MULTIPLATAFORMA */}
      {/* ===================================================================== */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Cloud className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-zinc-100">Sincronização Multiplataforma Atômica</h3>
              </div>
              <button onClick={() => setIsConfigModalOpen(false)} className="text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-xs text-emerald-200 space-y-1.5">
              <div className="font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Conectado ao Projeto: censo-uti-pediatica</span>
              </div>
              <p className="text-zinc-300 leading-relaxed">
                Todas as alterações feitas no celular, tablet ou computador são consolidadas instantaneamente no seu banco Firebase próprio.
              </p>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => handleForceCloudSyncNow(false)}
                className="px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncingManual ? 'animate-spin' : ''}`} />
                <span>Forçar Sincronia Agora</span>
              </button>
              <button
                type="button"
                onClick={() => setIsConfigModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-zinc-800 text-xs text-zinc-300"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL COFRE DE DADOS, GOOGLE DRIVE & BACKUP SEGURO */}
      {/* ===================================================================== */}
      {isBackupModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-zinc-900 border border-emerald-500/40 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-100">Cofre de Dados Permanente & Conexão Google Drive</h3>
                  <p className="text-xs text-zinc-400">
                    Estratégias diretas para salvar e sincronizar seus plantões entre celular, tablet e computador sem falha
                  </p>
                </div>
              </div>
              <button onClick={() => setIsBackupModalOpen(false)} className="text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <input
              ref={driveOpenInputRef}
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setDriveFileName(file.name);
                handleFileUploadBackup(e);
              }}
              className="hidden"
            />

            <div className="p-4 rounded-xl bg-gradient-to-br from-teal-950/40 via-zinc-950 to-zinc-950 border border-teal-500/40 space-y-3 text-xs">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-bold text-teal-300 flex items-center gap-2 text-sm">
                  <FolderSync className="w-4 h-4 text-teal-400" />
                  Integração Direta com Google Drive / WhatsApp (Funciona em PC e Celular)
                </span>
                {autoSaveDriveEnabled && (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                    ✅ Auto-Save Ativo ({driveFileName || 'censo-uti-ped.json'})
                  </span>
                )}
              </div>
              <p className="text-zinc-300 leading-relaxed">
                Use os botões abaixo para salvar ou abrir seus dados diretamente da sua pasta do <strong>Google Drive</strong> (no computador ou no celular) ou enviar para o <strong>WhatsApp</strong>:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleShareBackupToDriveOrWhatsApp}
                  className="p-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                >
                  <Share2 className="w-4 h-4 shrink-0" />
                  <span>Enviar p/ Google Drive ou WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={handleLinkLocalDriveFile}
                  className={`p-2.5 rounded-xl border font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    autoSaveDriveEnabled
                      ? 'bg-emerald-500/25 text-emerald-200 border-emerald-400 shadow-md'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-teal-300 border-teal-500/30'
                  }`}
                  title="Ativa o salvamento automático em arquivo a cada alteração realizada no plantão"
                >
                  <HardDrive className="w-4 h-4 shrink-0" />
                  <span>{autoSaveDriveEnabled ? 'Auto-Save Ativo (Clique p/ Desativar)' : 'Vincular Arquivo Auto-Save (Drive PC)'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenFromDriveFilePicker}
                  className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-cyan-300 border border-cyan-500/30 font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Upload className="w-4 h-4 shrink-0" />
                  <span>Abrir do Google Drive</span>
                </button>
              </div>

              <div className="pt-2 mt-2 border-t border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[11px] font-bold text-zinc-200 block">
                    Código da Sala de Sincronia em Nuvem (Mesmo código no Celular e no PC):
                  </span>
                  <span className="text-[10px] text-zinc-400">
                    Garante que todos os seus aparelhos leiam exatamente o mesmo banco em tempo real.
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={syncRoomCode}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSyncRoomCode(val);
                      try {
                        window.localStorage.setItem(STORAGE_KEY_SYNC_ROOM, val);
                      } catch (err) {}
                    }}
                    placeholder="censo_master"
                    className="bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-teal-300 font-mono w-36"
                  />
                  <button
                    type="button"
                    onClick={() => handleForceCloudSyncNow(false)}
                    className="px-3 py-1.5 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/30 font-bold text-xs flex items-center gap-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Sincronizar</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-950/25 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-300 font-bold">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Chave Fixa Imutável Ativa ({STORAGE_KEY_PATIENTS})</span>
                </div>
                <p className="text-zinc-300">
                  Seus registros, mudanças de leito e evoluções diárias são mesclados automaticamente sem perda entre dispositivos.
                </p>
              </div>
              <div className="px-3 py-2 rounded-lg bg-zinc-950 border border-emerald-500/30 text-center shrink-0">
                <span className="block text-lg font-bold text-emerald-400">{patients.length}</span>
                <span className="text-[10px] text-zinc-400">Fichas no Cofre</span>
              </div>
            </div>

            <div className="space-y-2.5">
              <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                1. Exportar Cópia de Segurança
              </h4>
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={handleDownloadBackupJson}
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs flex items-center gap-2 shadow-md"
                >
                  <Download className="w-4 h-4" />
                  <span>Baixar Arquivo de Backup (.json)</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyBackupString}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs flex items-center gap-2 border border-zinc-700"
                >
                  <Copy className="w-4 h-4 text-teal-400" />
                  <span>Copiar Dados em Texto</span>
                </button>
              </div>
            </div>

            <div className="space-y-2.5 pt-3 border-t border-zinc-800">
              <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                2. Restaurar ou Mesclar Dados de Backup
              </h4>
              <div className="flex items-center gap-3 flex-wrap">
                <label className="px-4 py-2 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/30 font-semibold text-xs flex items-center gap-2 cursor-pointer">
                  <Upload className="w-4 h-4" />
                  <span>Carregar Arquivo .json</span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileUploadBackup}
                    className="hidden"
                  />
                </label>
              </div>

              <textarea
                rows={4}
                value={backupJsonText}
                onChange={(e) => setBackupJsonText(e.target.value)}
                placeholder="Cole aqui um backup JSON salvo anteriormente..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-[11px] font-mono text-zinc-300 focus:border-emerald-500 focus:outline-none"
              />

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleImportBackupData(backupJsonText, true)}
                    className="px-3.5 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-zinc-950 font-bold text-xs"
                  >
                    Mesclar com Dados Atuais
                  </button>
                  <button
                    type="button"
                    onClick={() => handleImportBackupData(backupJsonText, false)}
                    className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-xs border border-zinc-700"
                  >
                    Substituir Tudo pelo Backup
                  </button>
                </div>

                {!confirmRestoreSeeds ? (
                  <button
                    type="button"
                    onClick={() => setConfirmRestoreSeeds(true)}
                    className="text-[11px] text-zinc-500 hover:text-amber-400 flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Restaurar casos de exemplo</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2 bg-amber-950/40 border border-amber-500/40 px-2.5 py-1 rounded-lg">
                    <span className="text-[11px] text-amber-200">Adicionar exemplos?</span>
                    <button
                      type="button"
                      onClick={() => {
                        handleImportBackupData(JSON.stringify(SEED_PATIENTS), true);
                        setConfirmRestoreSeeds(false);
                      }}
                      className="text-[11px] font-bold text-amber-300 hover:underline"
                    >
                      Confirmar
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmRestoreSeeds(false)}
                      className="text-[11px] text-zinc-400"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setIsBackupModalOpen(false)}
                className="px-5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs"
              >
                Fechar Cofre
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
