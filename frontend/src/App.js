import React, { useState, useEffect, useMemo, useRef } from 'react';
import { LANGUAGES, LOCALES, makeT } from './i18n';
import Reports from './Reports';
import {
  halfUnit, actStartUnit, actEndUnit, actDurationDays, dayPartOf,
  addWorkingDays, countWorkingDays, calendarDays, toInputDate, activitiesOverlap,
} from './dateUtils';
import { Calendar, Users, Briefcase, Activity, LogOut, ChevronDown, ChevronRight, Edit2, Trash2, Plus, Save, Clock, User, Phone, Mail, Award } from 'lucide-react';
import axios from 'axios';

const API_URL = '/api';

// Paesi EMEA raggruppati per area. Codici ISO 3166-1 alpha-2: sono ordinabili,
// si convertono in bandierina senza librerie e restano validi per integrazioni future.
const EMEA_COUNTRIES = [
  { group: 'Europa occidentale', items: [
    ['IT', 'Italia'], ['FR', 'Francia'], ['DE', 'Germania'], ['ES', 'Spagna'],
    ['PT', 'Portogallo'], ['GB', 'Regno Unito'], ['IE', 'Irlanda'], ['NL', 'Paesi Bassi'],
    ['BE', 'Belgio'], ['LU', 'Lussemburgo'], ['CH', 'Svizzera'], ['AT', 'Austria'],
    ['MC', 'Monaco'], ['MT', 'Malta'], ['CY', 'Cipro'],
  ]},
  { group: 'Europa settentrionale', items: [
    ['SE', 'Svezia'], ['NO', 'Norvegia'], ['DK', 'Danimarca'], ['FI', 'Finlandia'],
    ['IS', 'Islanda'], ['EE', 'Estonia'], ['LV', 'Lettonia'], ['LT', 'Lituania'],
  ]},
  { group: 'Europa centro-orientale', items: [
    ['PL', 'Polonia'], ['CZ', 'Rep. Ceca'], ['SK', 'Slovacchia'], ['HU', 'Ungheria'],
    ['RO', 'Romania'], ['BG', 'Bulgaria'], ['SI', 'Slovenia'], ['HR', 'Croazia'],
    ['RS', 'Serbia'], ['BA', 'Bosnia-Erzegovina'], ['ME', 'Montenegro'], ['MK', 'Macedonia del Nord'],
    ['AL', 'Albania'], ['GR', 'Grecia'], ['UA', 'Ucraina'], ['MD', 'Moldavia'],
    ['BY', 'Bielorussia'], ['RU', 'Russia'], ['TR', 'Turchia'],
  ]},
  { group: 'Medio Oriente', items: [
    ['AE', 'Emirati Arabi Uniti'], ['SA', 'Arabia Saudita'], ['QA', 'Qatar'], ['KW', 'Kuwait'],
    ['BH', 'Bahrein'], ['OM', 'Oman'], ['IL', 'Israele'], ['JO', 'Giordania'],
    ['LB', 'Libano'], ['IQ', 'Iraq'], ['IR', 'Iran'], ['YE', 'Yemen'],
  ]},
  { group: 'Africa settentrionale', items: [
    ['MA', 'Marocco'], ['DZ', 'Algeria'], ['TN', 'Tunisia'], ['LY', 'Libia'],
    ['EG', 'Egitto'], ['SD', 'Sudan'],
  ]},
  { group: 'Africa occidentale', items: [
    ['NG', 'Nigeria'], ['GH', 'Ghana'], ['CI', "Costa d'Avorio"], ['SN', 'Senegal'],
    ['ML', 'Mali'], ['BF', 'Burkina Faso'], ['GN', 'Guinea'], ['CM', 'Camerun'],
  ]},
  { group: 'Africa orientale', items: [
    ['KE', 'Kenya'], ['ET', 'Etiopia'], ['TZ', 'Tanzania'], ['UG', 'Uganda'],
    ['RW', 'Ruanda'], ['MZ', 'Mozambico'], ['MU', 'Mauritius'], ['MG', 'Madagascar'],
  ]},
  { group: 'Africa australe', items: [
    ['ZA', 'Sudafrica'], ['AO', 'Angola'], ['ZM', 'Zambia'], ['ZW', 'Zimbabwe'],
    ['BW', 'Botswana'], ['NA', 'Namibia'],
  ]},
];

// Mappa codice -> nome, per mostrare l'etichetta estesa nei filtri
const COUNTRY_NAMES = EMEA_COUNTRIES.reduce((acc, g) => {
  g.items.forEach(([code, name]) => { acc[code] = name; });
  return acc;
}, {});

const App = () => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [showLogin, setShowLogin] = useState(!token);
  const [currentView, setCurrentView] = useState('dashboard');
  const [viewMode, setViewMode] = useState('week');
  const [currentDates, setCurrentDates] = useState(getWeekDates(new Date()));
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [projects, setProjects] = useState([]);
  const [activities, setActivities] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [showAbsenceModal, setShowAbsenceModal] = useState(false);
  const [editingAbsence, setEditingAbsence] = useState(null);
  const [absenceTech, setAbsenceTech] = useState(null);
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [deviceTech, setDeviceTech] = useState(null);
  const [devices, setDevices] = useState([]);
  const [newInvite, setNewInvite] = useState(null);
  const [mailEnabled, setMailEnabled] = useState(false);
  const [appVersion, setAppVersion] = useState('');
  const [latestRelease, setLatestRelease] = useState(null);
  const [license, setLicense] = useState(null);
  const [licenseKey, setLicenseKey] = useState('');
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMsg, setForgotMsg] = useState('');
  const [resetToken, setResetToken] = useState(null);
  const [resetPwd, setResetPwd] = useState('');
  const [auditRows, setAuditRows] = useState([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(0);
  const [restoring, setRestoring] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null); 
  const [selectedTechnicians, setSelectedTechnicians] = useState([]);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [showTechnicianModal, setShowTechnicianModal] = useState(false);
  const [editingTechnician, setEditingTechnician] = useState(null);
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [groupBy, setGroupBy] = useState('project');
  const [expandedTechs, setExpandedTechs] = useState([]);
  const [filterCountries, setFilterCountries] = useState([]);
  const [filterText, setFilterText] = useState('');
  const [onlyConflicts, setOnlyConflicts] = useState(false);
  const [filterTechIds, setFilterTechIds] = useState([]);
  const [expandedConflictTechs, setExpandedConflictTechs] = useState([]);
  const [inverted, setInverted] = useState(() => {
    try { return localStorage.getItem('inverted') === '1'; } catch { return false; }
  });
  // L'interfaccia mostra il recupero password solo se il server ha un SMTP:
  // meglio non offrire una funzione che poi fallisce.
  useEffect(() => {
    axios.get(`${API_URL}/config`)
      .then(r => {
        setMailEnabled(Boolean(r.data?.mailEnabled));
        setAppVersion(r.data?.version || '');
      })
      .catch(() => setMailEnabled(false));
    const t = new URLSearchParams(window.location.search).get('reset');
    if (t) setResetToken(t);
  }, []);

  // Controllo automatico degli aggiornamenti, al massimo una volta al giorno
  useEffect(() => {
    if (user?.role !== 'admin' || !appVersion) return;
    let ultimo = 0;
    try { ultimo = Number(localStorage.getItem('lastUpdateCheck') || 0); } catch {}
    if (Date.now() - ultimo < 86400000) return;
    try { localStorage.setItem('lastUpdateCheck', String(Date.now())); } catch {}
    checkUpdates(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, appVersion]);

  // Il registro si popola entrando nella pagina: un pulsante "carica" accanto
  // a "ripristina backup" era ambiguo, sembrava riferirsi a un file.
  useEffect(() => {
    if (currentView === 'system' && user?.role === 'admin') fetchAudit(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView, user]);

  useEffect(() => {
    try { localStorage.setItem('inverted', inverted ? '1' : '0'); } catch {}
    // Le variabili vivono su :root cosi' valgono anche per gli stili inline,
    // che in React accettano var() senza problemi.
    const r = document.documentElement.style;
    const th = inverted
      ? { bg:'#121212', fg:'#f5f5f5', surface:'#1c1c1c', surface2:'#252525',
          border:'#3a3a3a', muted:'#9e9e9e', barBg:'#f5f5f5', barFg:'#121212',
          rowAlt:'#1a1a1a', shadow:'rgba(0,0,0,0.5)',
          accent:'#f5f5f5', accentFg:'#121212' }
      : { bg:'#f2f2f2', fg:'#121212', surface:'#ffffff', surface2:'#f7f7f7',
          border:'#d9d9d9', muted:'#6b6b6b', barBg:'#000000', barFg:'#ffffff',
          rowAlt:'#fafafa', shadow:'rgba(0,0,0,0.12)',
          accent:'#000000', accentFg:'#ffffff' };
    Object.entries(th).forEach(([k, v]) => r.setProperty('--' + k, v));
    document.body.style.backgroundColor = th.bg;
    document.body.style.color = th.fg;
  }, [inverted]);

  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem('lang') || 'it'; } catch { return 'it'; }
  });
  const t = useMemo(() => makeT(lang), [lang]);
  const locale = LOCALES[lang] || 'it-IT';
  useEffect(() => {
    try { localStorage.setItem('lang', lang); } catch {}
  }, [lang]);
  const [conflictSearch, setConflictSearch] = useState('');

  // L'altezza del Gantt era fissata a calc(100vh - 240px): un valore stimato che
  // non teneva conto della barra filtri, cosi' il contenitore sforava lo schermo
  // e la barra di scorrimento orizzontale finiva sotto il bordo visibile.
  // Qui la posizione reale viene misurata e l'altezza adattata di conseguenza.
  const ganttRef = useRef(null);
  const [ganttHeight, setGanttHeight] = useState(500);

  useEffect(() => {
    const measure = () => {
      if (!ganttRef.current) return;
      const top = ganttRef.current.getBoundingClientRect().top;
      const reserved = 24; // solo il margine inferiore: legenda e filtri
                           // stanno nel flusso e occupano l'altezza che serve
      const h = Math.max(280, window.innerHeight - top - reserved);
      setGanttHeight(prev => Math.abs(prev - h) > 2 ? h : prev);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  });

  const [activityPage, setActivityPage] = useState(0);
  const [expandedActProjects, setExpandedActProjects] = useState([]);
  const [activitySearch, setActivitySearch] = useState('');
  const [activityCountries, setActivityCountries] = useState([]);
  const PROJECTS_PER_PAGE = 25;
  const [formStart, setFormStart] = useState('');
  const [formEnd, setFormEnd] = useState('');
  const [formDayPart, setFormDayPart] = useState('FULL');
  const [formWorkDays, setFormWorkDays] = useState('');
  const [techSearch, setTechSearch] = useState('');
  const [holidays, setHolidays] = useState([]);
  const [weekendMap, setWeekendMap] = useState({});
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [newUser, setNewUser] = useState({ email: '', password: '', name: '', role: 'viewer', phone: '', countries: [] });

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUserData();
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      fetchProjects();
      fetchTechnicians();
      fetchAbsences();
      fetchLicense();
      fetchHolidays();
      fetchActivities();
      if (user.role === 'admin') {
        fetchUsers();
      }
    }
  }, [user]);

  function getWeekDates(date) {
    const startOfWeek = new Date(date);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const current = new Date(startOfWeek);
      current.setDate(startOfWeek.getDate() + i);
      dates.push(current);
    }
    return dates;
  }

  function getMonthDates(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const dates = [];
    for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d));
    }
    return dates;
  }

  const fetchUserData = async () => {
    try {
      const response = await axios.get(`${API_URL}/auth/me`);
      setUser(response.data);
    } catch (error) {
      console.error('Error fetching user data:', error);
      localStorage.removeItem('token');
      setToken(null);
      setShowLogin(true);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await axios.get(`${API_URL}/projects`);
      setProjects(response.data.map(p => ({ ...p, expanded: false })));
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const fetchActivities = async () => {
    try {
      const response = await axios.get(`${API_URL}/activities`);
      setActivities(response.data);
    } catch (error) {
      console.error('Error fetching activities:', error);
    }
  };

  const fetchTechnicians = async () => {
    try {
      const response = await axios.get(`${API_URL}/technicians`);
      setTechnicians(response.data);
    } catch (error) {
      console.error('Error fetching technicians:', error);
    }
  };

  const fetchAudit = async (page = 0) => {
    try {
      const res = await axios.get(`${API_URL}/audit`, { params: { limit: 50, offset: page * 50 } });
      setAuditRows(res.data.rows);
      setAuditTotal(res.data.total);
      setAuditPage(page);
    } catch (error) {
      console.error('Error fetching audit:', error);
    }
  };

  const handleBackup = async () => {
    try {
      const res = await axios.get(`${API_URL}/admin/backup`);
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `progetto-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      alert(error.response?.data?.message || 'Errore durante il backup');
    }
  };

  const handleRestore = async (file) => {
    if (!file) return;
    // Doppia conferma: il ripristino sostituisce tutto, e non basta un clic
    // distratto per farlo.
    if (!window.confirm(t('restoreWarning'))) return;
    const typed = window.prompt(t('restoreType'));
    if (typed !== 'RESTORE') {
      if (typed !== null) alert(t('restoreAborted'));
      return;
    }
    setRestoring(true);
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const res = await axios.post(`${API_URL}/admin/restore`, payload);
      alert(`${t('restoreDone')} (${res.data.rows})`);
      fetchProjects(); fetchActivities(); fetchTechnicians(); fetchAbsences();
    } catch (error) {
      alert(error.response?.data?.message || 'Errore durante il ripristino');
    } finally {
      setRestoring(false);
    }
  };

  const handleDuplicateProject = async (project) => {
    const shift = window.prompt(t('shiftDaysPrompt'), '0');
    if (shift === null) return;
    try {
      const res = await axios.post(`${API_URL}/projects/${project.id}/duplicate`, {
        shift_days: parseInt(shift) || 0,
      });
      fetchProjects(); fetchActivities();
      alert(`${t('duplicated')}: ${res.data.project.code} (${res.data.activities})`);
    } catch (error) {
      alert(error.response?.data?.message || 'Errore durante la duplicazione');
    }
  };

  // Il confronto lo fa il browser contattando GitHub: il backend sta su una
  // rete isolata e non vede Internet. Nessun dato lascia il server.
  const fetchLicense = async () => {
    try {
      const r = await axios.get(`${API_URL}/license`);
      setLicense(r.data);
    } catch { setLicense({ licensed: false }); }
  };

  const saveLicense = async () => {
    try {
      const r = await axios.post(`${API_URL}/license`, { key: licenseKey.trim() });
      alert(`${t('licenseRegistered')}: ${r.data.to}`);
      setLicenseKey('');
      fetchLicense();
    } catch (err) {
      alert(err.response?.data?.message || t('licenseInvalid'));
    }
  };

  const removeLicense = async () => {
    if (!window.confirm(t('licenseRemoveConfirm'))) return;
    try {
      await axios.delete(`${API_URL}/license`);
      fetchLicense();
    } catch { alert('Errore'); }
  };

  const versionCompare = (a, b) => {
    const pa = String(a).replace(/^v/, '').split('.').map(Number);
    const pb = String(b).replace(/^v/, '').split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      if ((pa[i] || 0) > (pb[i] || 0)) return 1;
      if ((pa[i] || 0) < (pb[i] || 0)) return -1;
    }
    return 0;
  };

  const checkUpdates = async (silent) => {
    try {
      const r = await fetch('https://api.github.com/repos/robertobenassi/progetto.io/releases/latest');
      if (!r.ok) throw new Error('non disponibile');
      const d = await r.json();
      setLatestRelease({
        tag: d.tag_name, name: d.name, body: d.body,
        url: d.html_url, published: d.published_at,
      });
    } catch {
      if (!silent) alert(t('updateCheckFailed'));
      setLatestRelease(null);
    }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setForgotMsg('...');
    try {
      const r = await axios.post(`${API_URL}/auth/forgot-password`, { email: forgotEmail });
      setForgotMsg(r.data.message);
    } catch (err) {
      setForgotMsg(err.response?.data?.message || 'Errore');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/auth/reset-password`, { token: resetToken, password: resetPwd });
      alert(t('passwordUpdated'));
      window.location.href = window.location.pathname;
    } catch (err) {
      alert(err.response?.data?.message || 'Errore');
    }
  };

  const sendInviteEmail = async () => {
    try {
      const r = await axios.post(`${API_URL}/technicians/${deviceTech.id}/invite-email`,
        { code: newInvite.code });
      alert(r.data.message);
    } catch (err) {
      alert(err.response?.data?.message || 'Invio non riuscito');
    }
  };

  const openDevices = async (tech) => {
    setDeviceTech(tech);
    setNewInvite(null);
    setShowDeviceModal(true);
    try {
      const res = await axios.get(`${API_URL}/technicians/${tech.id}/devices`);
      setDevices(res.data);
    } catch (error) {
      setDevices([]);
    }
  };

  const createInvite = async () => {
    try {
      const res = await axios.post(`${API_URL}/technicians/${deviceTech.id}/invite`);
      // Il codice arriva in chiaro solo qui: sul server resta l'hash
      setNewInvite(res.data);
    } catch (error) {
      alert(error.response?.data?.message || 'Errore durante la creazione dell\'invito');
    }
  };

  const revokeDevice = async (id) => {
    if (!window.confirm(t('revokeConfirm'))) return;
    try {
      await axios.delete(`${API_URL}/tech-devices/${id}`);
      const res = await axios.get(`${API_URL}/technicians/${deviceTech.id}/devices`);
      setDevices(res.data);
    } catch (error) {
      alert(error.response?.data?.message || 'Errore durante la revoca');
    }
  };

  const fetchHolidays = async () => {
    try {
      const r = await axios.get(`${API_URL}/holidays`);
      setHolidays(r.data.holidays || []);
      setWeekendMap(r.data.weekend || {});
    } catch { setHolidays([]); }
  };

  const fetchAbsences = async () => {
    try {
      const res = await axios.get(`${API_URL}/absences`);
      setAbsences(res.data);
    } catch (error) {
      console.error('Error fetching absences:', error);
    }
  };

  const handleSaveAbsence = async (data) => {
    try {
      if (editingAbsence?.id) await axios.put(`${API_URL}/absences/${editingAbsence.id}`, data);
      else await axios.post(`${API_URL}/absences`, data);
      fetchAbsences();
      setShowAbsenceModal(false);
      setEditingAbsence(null);
    } catch (error) {
      alert(error.response?.data?.message || 'Errore durante il salvataggio');
    }
  };

  const handleDeleteAbsence = async (id) => {
    if (!window.confirm(t('confirmDelete'))) return;
    try {
      await axios.delete(`${API_URL}/absences/${id}`);
      fetchAbsences();
    } catch (error) {
      alert(error.response?.data?.message || 'Errore durante l\'eliminazione');
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API_URL}/users`);
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await axios.post(`${API_URL}/auth/login`, loginData);
      const { token: newToken, user: userData } = response.data;
      localStorage.setItem('token', newToken);
      setToken(newToken);
      setUser(userData);
      setShowLogin(false);
    } catch (error) {
      setError(error.response?.data?.message || 'Errore durante il login');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setShowLogin(true);
  };

  const toggleProject = (projectId) => {
    setProjects(projects.map(p => 
      p.id === projectId ? { ...p, expanded: !p.expanded } : p
    ));
  };

  // Agisce solo sui progetti che superano i filtri attivi: se e' selezionata
  // una sola nazione, apre e chiude soltanto quelli.
  const toggleAllVisibleProjects = () => {
    const ids = new Set(visibleProjects.map(p => p.id));
    const allOpen = visibleProjects.length > 0 && visibleProjects.every(p => p.expanded);
    setProjects(projects.map(p => ids.has(p.id) ? { ...p, expanded: !allOpen } : p));
  };

  const toggleAllVisibleTechs = () => {
    const ids = visibleTechnicians.map(t => t.id);
    const allOpen = ids.length > 0 && ids.every(id => expandedTechs.includes(id));
    setExpandedTechs(allOpen ? [] : ids);
  };


const handleSaveActivity = async (activityData) => {
  try {
    // Assicurati che technician_ids sia un array
    const dataToSend = {
      ...activityData,
      technician_ids: Array.isArray(activityData.technician_ids) 
        ? activityData.technician_ids 
        : activityData.technician_ids ? [activityData.technician_ids] : []
    };
    
    if (editingActivity?.id) {
      await axios.put(`${API_URL}/activities/${editingActivity.id}`, dataToSend);
    } else {
      await axios.post(`${API_URL}/activities`, dataToSend);
    }
      fetchActivities();
      setShowActivityModal(false);
      setShowEditModal(false);
      setEditingActivity(null);
      setSelectedTechnicians([]);
    } catch (error) {
      console.error('Error saving activity:', error);
      alert('Errore durante il salvataggio dell\'attività');
    }
  };

  const handleDeleteActivity = async (activityId) => {
    if (!window.confirm('Sei sicuro di voler eliminare questa attività?')) return;
    try {
      await axios.delete(`${API_URL}/activities/${activityId}`);
      fetchActivities();
    } catch (error) {
      console.error('Error deleting activity:', error);
      alert('Errore durante l\'eliminazione dell\'attività');
    }
  };

  const handleSaveProject = async (e) => {
    e.preventDefault();
    try {
      if (editingProject.id) {
        await axios.put(`${API_URL}/projects/${editingProject.id}`, editingProject);
      } else {
        await axios.post(`${API_URL}/projects`, editingProject);
      }
      fetchProjects();
      setShowProjectModal(false);
      setEditingProject(null);
    } catch (error) {
      console.error('Error saving project:', error);
      alert('Errore durante il salvataggio del progetto');
    }
  };

  const handleDeleteProject = async (projectId) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo progetto?')) return;
    try {
      await axios.delete(`${API_URL}/projects/${projectId}`);
      fetchProjects();
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Errore durante l\'eliminazione del progetto');
    }
  };

  const handleSaveTechnician = async (e) => {
    e.preventDefault();
    try {
      if (editingTechnician.id) {
        await axios.put(`${API_URL}/technicians/${editingTechnician.id}`, editingTechnician);
      } else {
        await axios.post(`${API_URL}/technicians`, editingTechnician);
      }
      fetchTechnicians();
      setShowTechnicianModal(false);
      setEditingTechnician(null);
    } catch (error) {
      console.error('Error saving technician:', error);
      alert('Errore durante il salvataggio del tecnico');
    }
  };

  const handleDeleteTechnician = async (technicianId) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo tecnico?')) return;
    try {
      await axios.delete(`${API_URL}/technicians/${technicianId}`);
      fetchTechnicians();
    } catch (error) {
      console.error('Error deleting technician:', error);
      alert('Errore durante l\'eliminazione del tecnico');
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        // Modifica utente esistente
        const userData = {
          name: editingUser.name,
          email: editingUser.email,
          phone: editingUser.phone || null,
          role: editingUser.role,
          // Le aree valgono solo per gli editor: cambiando ruolo si azzerano,
          // altrimenti resterebbero permessi invisibili su un utente admin o viewer.
          countries: editingUser.role === 'editor' ? (editingUser.countries || []) : []
        };
        await axios.put(`${API_URL}/users/${editingUser.id}`, userData);
      } else {
        await axios.post(`${API_URL}/users`, {
          ...newUser,
          phone: newUser.phone || null,
          countries: newUser.role === 'editor' ? newUser.countries : []
        });
      }
      fetchUsers();
      setShowUserModal(false);
      setEditingUser(null);
      setNewUser({ email: '', password: '', name: '', role: 'viewer', phone: '', countries: [] });
    } catch (error) {
      console.error('Error saving user:', error);
      alert(error.response?.data?.message || 'Errore durante il salvataggio dell\'utente');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo utente?')) return;
    try {
      await axios.delete(`${API_URL}/users/${userId}`);
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Errore durante l\'eliminazione dell\'utente');
    }
  };
  
  // Un conflitto = un PERIODO di sovrapposizione per tecnico, con tutte le attivita'
  // coinvolte. La versione precedente creava una scheda per ogni singolo giorno,
  // producendo migliaia di righe quasi identiche.
  const detectedConflicts = useMemo(() => {
    const conflicts = [];
    const byTech = new Map();

    activities.forEach(a => {
      (a.technicians || []).forEach(t => {
        if (!byTech.has(t.id)) byTech.set(t.id, { name: t.name, list: [] });
        byTech.get(t.id).list.push(a);
      });
    });

    byTech.forEach((entry, techId) => {
      const sorted = [...entry.list].sort((x, y) => new Date(x.start_date) - new Date(y.start_date));
      if (sorted.length < 2) return;

      // Solo le attivita' realmente in conflitto entrano nei gruppi
      const inConflitto = sorted.filter(a =>
        sorted.some(b => b !== a && activitiesOverlap(a, b)));
      if (inConflitto.length < 2) return;

      let cluster = [inConflitto[0]];
      let maxEnd = new Date(inConflitto[0].end_date);

      const flush = () => {
        if (cluster.length < 2) return;
        const starts = cluster.map(a => new Date(a.start_date));
        const ends = cluster.map(a => new Date(a.end_date));
        conflicts.push({
          technicianId: techId,
          technicianName: entry.name,
          startDate: new Date(Math.max(...starts)).toISOString().split('T')[0],
          endDate: new Date(Math.min(...ends)).toISOString().split('T')[0],
          periodStart: new Date(Math.min(...starts)).toISOString().split('T')[0],
          periodEnd: new Date(Math.max(...ends)).toISOString().split('T')[0],
          activities: cluster,
        });
      };

      for (let i = 1; i < inConflitto.length; i++) {
        const cur = inConflitto[i];
        if (new Date(cur.start_date) <= maxEnd) {
          cluster.push(cur);
          if (new Date(cur.end_date) > maxEnd) maxEnd = new Date(cur.end_date);
        } else {
          flush();
          cluster = [cur];
          maxEnd = new Date(cur.end_date);
        }
      }
      flush();
    });

    return conflicts;
  }, [activities]);


  const formatDate = (date) => {
    return date.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' });
  };

  const formatDateForInput = (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatMonthYear = (date) => {
    return date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  };

  // ---- Gestione date attività ----
  const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

  const addDays = (dateStr, n) => {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + n);
    return formatDateForInput(d);
  };

  // Cambiando l'inizio, la fine trasla della stessa durata (come MS Project / Jira).
  // Cambiando la fine, l'inizio resta fermo: e' cosi' che si accorcia o allunga.

  const projectsById = useMemo(() => {
    const m = new Map();
    projects.forEach(p => m.set(p.id, p));
    return m;
  }, [projects]);

  // Nazione del progetto selezionato: decide festivi e giorni di riposo
  const formCountry = useMemo(() => {
    const pid = editingActivity?.project_id;
    return projectsById.get(pid)?.country || 'IT';
  }, [editingActivity, projectsById]);

  const handleStartChange = (value) => {
    if (!value) { setFormStart(value); return; }
    setFormStart(value);
    // Se e' stata indicata una durata, la fine si ricalcola sui giorni
    // lavorativi della nazione del progetto.
    if (formWorkDays) {
      setFormEnd(addWorkingDays(value, formWorkDays, formCountry, holidays, weekendMap));
    } else if (formStart && formEnd) {
      const dur = daysBetween(formStart, formEnd);
      if (dur >= 0) setFormEnd(addDays(value, dur));
    } else if (!formEnd) {
      setFormEnd(value);
    }
  };

  const handleWorkDaysChange = (value) => {
    setFormWorkDays(value);
    if (value && formStart) {
      setFormEnd(addWorkingDays(formStart, value, formCountry, holidays, weekendMap));
    }
  };

  // Modificando la fine a mano il vincolo dei giorni lavorativi decade:
  // e' il modo per forzare un intervento nel fine settimana o in un festivo.
  const handleEndChange = (value) => {
    setFormEnd(value);
    setFormWorkDays('');
  };

  const dateError = Boolean(formStart && formEnd && new Date(formEnd) < new Date(formStart));
  const giorniCalendario = (formStart && formEnd && !dateError)
    ? calendarDays({ start_date: formStart, end_date: formEnd }) : null;
  const durationDays = giorniCalendario
    ? giorniCalendario * (formDayPart === 'FULL' ? 1 : 0.5) : null;
  const giorniLavorativi = (formStart && formEnd && !dateError)
    ? countWorkingDays(formStart, formEnd, formCountry, holidays, weekendMap) : null;
  // Segnalazione, non blocco: negli impianti si interviene proprio nei fermi
  const includeNonLavorativi = Boolean(giorniCalendario && giorniLavorativi !== null
    && giorniLavorativi < giorniCalendario);

  useEffect(() => {
    if (showActivityModal || showEditModal) {
      setFormStart(editingActivity?.start_date ? formatDateForInput(editingActivity.start_date) : '');
      setFormEnd(editingActivity?.end_date ? formatDateForInput(editingActivity.end_date) : '');
      setFormDayPart(editingActivity ? dayPartOf(editingActivity) : 'FULL');
      setFormWorkDays('');
      setTechSearch('');
    }
  }, [showActivityModal, showEditModal, editingActivity]);

  const isDateInRange = (date, startDate, endDate) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);
    return d >= start && d <= end;
  };

  const getTechnicianConflicts = (technicianId, date) => {
  const dateStr = date.toISOString().split('T')[0];
  const techActivities = activities.filter(a => {
    // Controlla se il tecnico è tra quelli assegnati all'attività
    const hasTechnician = a.technicians && a.technicians.some(t => t.id === technicianId);
    return hasTechnician && isDateInRange(dateStr, a.start_date, a.end_date);
  });
  return techActivities.length > 1;
};

  // Indici per evitare scansioni annidate: senza questi, ogni progetto e ogni
  // tecnico riscorrerebbe l'intero elenco attivita' a ogni render (O(n*m)).
  const activitiesByProject = useMemo(() => {
    const m = new Map();
    activities.forEach(a => {
      if (!m.has(a.project_id)) m.set(a.project_id, []);
      m.get(a.project_id).push(a);
    });
    return m;
  }, [activities]);

  const activitiesByTech = useMemo(() => {
    const m = new Map();
    activities.forEach(a => {
      (a.technicians || []).forEach(t => {
        if (!m.has(t.id)) m.set(t.id, []);
        m.get(t.id).push(a);
      });
    });
    return m;
  }, [activities]);

  // Conflitti precalcolati una volta sola: con migliaia di attivita' il confronto
  // a coppie a ogni render sarebbe insostenibile. Il calcolo resta GLOBALE, mai
  // filtrato: un tecnico impegnato in Spagna deve risultare occupato anche
  // guardando solo l'Italia.
  const conflictingActivityIds = useMemo(() => {
    const byTech = new Map();
    activities.forEach(a => {
      (a.technicians || []).forEach(t => {
        if (!byTech.has(t.id)) byTech.set(t.id, []);
        byTech.get(t.id).push(a);
      });
    });
    const ids = new Set();
    byTech.forEach(list => {
      // Confronto a coppie invece dello scorrimento lineare: con le fasce
      // orarie la sovrapposizione non e' piu' transitiva — mattina e
      // pomeriggio dello stesso giorno non sono in conflitto fra loro.
      // Il costo resta contenuto perche' si confrontano solo le attivita'
      // dello stesso tecnico, non tutte fra loro.
      const sorted = [...list].sort((x, y) => new Date(x.start_date) - new Date(y.start_date));
      for (let i = 0; i < sorted.length; i++) {
        for (let j = i + 1; j < sorted.length; j++) {
          // Ordinate per data: appena una inizia dopo la fine della prima,
          // le successive non possono sovrapporsi.
          if (new Date(sorted[j].start_date) > new Date(sorted[i].end_date)) break;
          if (activitiesOverlap(sorted[i], sorted[j])) {
            ids.add(sorted[i].id);
            ids.add(sorted[j].id);
          }
        }
      }
    });
    return ids;
  }, [activities]);



  // Un'attivita' assegnata a un tecnico durante una sua assenza e' un conflitto,
  // ma di natura diversa dalla doppia assegnazione: va segnalato, mai impedito.
  // Capita di richiamare qualcuno dalle ferie.
  const absenceConflicts = useMemo(() => {
    const m = new Map();
    if (!absences.length) return m;
    const byTech = new Map();
    absences.forEach(x => {
      if (!byTech.has(x.technician_id)) byTech.set(x.technician_id, []);
      byTech.get(x.technician_id).push(x);
    });
    activities.forEach(a => {
      (a.technicians || []).forEach(tc => {
        (byTech.get(tc.id) || []).forEach(ab => {
          if (activitiesOverlap(a, ab)) {
            if (!m.has(a.id)) m.set(a.id, []);
            m.get(a.id).push({ tech: tc.name, type: ab.type, from: ab.start_date, to: ab.end_date });
          }
        });
      });
    });
    return m;
  }, [activities, absences]);

  // Attivita' che ricadono su un'assenza del tecnico, raggruppate per persona
  const absenceIssues = useMemo(() => {
    const byTech = new Map();
    absenceConflicts.forEach((list, actId) => {
      const act = activities.find(a => a.id === actId);
      if (!act) return;
      list.forEach(x => {
        if (!byTech.has(x.tech)) byTech.set(x.tech, []);
        byTech.get(x.tech).push({ activity: act, absence: x });
      });
    });
    return byTech;
  }, [absenceConflicts, activities]);

  const availableCountries = useMemo(
    () => [...new Set(projects.map(p => p.country).filter(Boolean))].sort(),
    [projects]
  );

  const countryFlag = (cc) => {
    if (!cc || cc.length !== 2) return '';
    return String.fromCodePoint(...[...cc.toUpperCase()].map(ch => 127397 + ch.charCodeAt(0)));
  };

  const visibleProjects = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    const techSet = new Set(filterTechIds);
    return projects.filter(p => {
      if (filterCountries.length && !filterCountries.includes(p.country)) return false;
      if (q && !`${p.code} ${p.name}`.toLowerCase().includes(q)) return false;
      const acts = activitiesByProject.get(p.id) || [];
      if (techSet.size && !acts.some(a => (a.technicians || []).some(t => techSet.has(t.id)))) return false;
      if (onlyConflicts && !acts.some(a => conflictingActivityIds.has(a.id))) return false;
      return true;
    });
  }, [projects, activitiesByProject, filterCountries, filterText, filterTechIds, onlyConflicts, conflictingActivityIds]);

  const visibleTechnicians = useMemo(() => {
    const projIds = new Set(
      projects.filter(p => !filterCountries.length || filterCountries.includes(p.country)).map(p => p.id)
    );
    const q = filterText.trim().toLowerCase();
    const techSet = new Set(filterTechIds);
    return technicians.filter(t => {
      if (techSet.size && !techSet.has(t.id)) return false;
      const acts = (activitiesByTech.get(t.id) || []).filter(a => projIds.has(a.project_id));
      if (acts.length === 0) return false;
      if (q && !t.name.toLowerCase().includes(q)) return false;
      if (onlyConflicts && !acts.some(a => conflictingActivityIds.has(a.id))) return false;
      return true;
    });
  }, [technicians, projects, activitiesByTech, filterCountries, filterText, filterTechIds, onlyConflicts, conflictingActivityIds]);

  const toggleCountry = (cc) => {
    setFilterCountries(prev => prev.includes(cc) ? prev.filter(x => x !== cc) : [...prev, cc]);
  };

  const resetFilters = () => {
    setFilterCountries([]);
    setFilterText('');
    setOnlyConflicts(false);
    setFilterTechIds([]);
  };

  const toggleTech = (techId) => {
    setExpandedTechs(prev =>
      prev.includes(techId) ? prev.filter(id => id !== techId) : [...prev, techId]
    );
  };

  const renderGanttChart = () => {
    const dates  = viewMode === 'week' ? currentDates : getMonthDates(currentMonth);
    const DAY_W  = viewMode === 'week' ? 100 : 46;
    const LEFT_W = 300;
    const ROW_H  = 48;
    const gridW  = dates.length * DAY_W;

    // Sfondo griglia disegnato in CSS: 1 nodo invece di N celle per riga
    const gridBg = {
      backgroundImage: `repeating-linear-gradient(to right, var(--border) 0 1px, transparent 1px ${DAY_W}px)`,
      backgroundSize: `${DAY_W}px 100%`,
    };

    // Posizione della barra dell'attivita' nel periodo visibile
    // Posizione in MEZZE CELLE: chi lavora solo il pomeriggio parte a meta' cella,
    // chi finisce a mezzogiorno si ferma a meta'.
    const HALF = DAY_W / 2;
    const barPos = (activity) => {
      if (!activity.start_date || !activity.end_date) return null;
      const first = new Date(dates[0]);                     first.setHours(0,0,0,0);
      const last  = new Date(dates[dates.length - 1]);      last.setHours(0,0,0,0);
      const s = new Date(activity.start_date);              s.setHours(0,0,0,0);
      const e = new Date(activity.end_date);                e.setHours(0,0,0,0);
      if (e < first || s > last) return null;

      const dayMs = 86400000;
      const rawStart = Math.round((s - first) / dayMs);
      const rawEnd   = Math.round((e - first) / dayMs);

      // La barra copre i giorni interi: la fascia oraria si rende con un
      // motivo a mezze celle, non accorciando gli estremi. Con "solo mattina"
      // su cinque giorni servono cinque mezze barrette, non una barra continua
      // che finisce a meta' dell'ultimo giorno.
      let left  = rawStart * DAY_W;
      let right = rawEnd   * DAY_W + DAY_W;

      const maxRight = dates.length * DAY_W;
      const tagliatoASinistra = left < 0;
      if (left < 0) left = 0;
      if (right > maxRight) right = maxRight;
      if (right <= left) return null;

      return { left, width: right - left, clippedLeft: tagliatoASinistra };
    };

    // Motivo a mezze celle per le attivita' di sola mattina o solo pomeriggio.
    // Un unico elemento con un gradiente ripetuto: nessun costo aggiuntivo
    // rispetto a una barra piena.
    const halfDayPattern = (activity, colore) => {
      const dp = dayPartOf(activity);
      if (dp === 'FULL') return undefined;
      return dp === 'AM'
        ? `repeating-linear-gradient(to right, ${colore} 0 ${HALF}px, transparent ${HALF}px ${DAY_W}px)`
        : `repeating-linear-gradient(to right, transparent 0 ${HALF}px, ${colore} ${HALF}px ${DAY_W}px)`;
    };

    // Giorni occupati nel periodo visibile. Conta in mezze giornate: chi lavora
    // solo le mattine occupa mezza unita' per ogni giorno.
    const loadDays = (acts) => {
      const busy = new Set();
      acts.forEach(a => {
        const p = barPos(a);
        if (!p) return;
        const dp = dayPartOf(a);
        const primaCella = Math.round(p.left / DAY_W);
        const celle = Math.round(p.width / DAY_W);
        for (let i = 0; i < celle; i++) {
          const giorno = primaCella + i;
          if (dp === 'FULL') { busy.add(giorno * 2); busy.add(giorno * 2 + 1); }
          else if (dp === 'AM') busy.add(giorno * 2);
          else busy.add(giorno * 2 + 1);
        }
      });
      return busy.size / 2;
    };

    const isToday = (d) => new Date().toDateString() === d.toDateString();

    // ---- Cella sinistra sticky ----
    const LeftCell = ({ children, bg, onClick, indent }) => (
      <div
        onClick={onClick}
        style={{
          position: 'sticky', left: 0, zIndex: 5,
          width: LEFT_W, minWidth: LEFT_W,
          padding: indent ? '0 8px 0 28px' : '0 8px',
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          backgroundColor: bg,
          borderRight: '2px solid var(--border)',
          cursor: onClick ? 'pointer' : 'default',
          overflow: 'hidden',
        }}>
        {children}
      </div>
    );

    // ---- Riga attivita' (usata da entrambe le viste) ----
    const ActivityRow = ({ activity, label, sub, color, barText }) => {
      const pos = barPos(activity);
      const techs = activity.technicians || [];
      // Usa il set precalcolato: getTechnicianConflicts riscansionava tutte le attivita'
      // per ogni barra, e controllava solo il primo giorno invece dell'intero periodo.
      const overlap = conflictingActivityIds.has(activity.id);
      const onLeave = absenceConflicts.has(activity.id);
      const conflict = overlap || onLeave;
      return (
        <div style={{ display: 'flex', height: ROW_H, borderBottom: '1px solid var(--border)', backgroundColor: 'var(--rowAlt)' }}>
          <LeftCell bg="var(--rowAlt)" indent>
            <div style={{ fontSize: 13, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{label}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{sub}</div>
          </LeftCell>
          <div style={{ width: gridW, minWidth: gridW, position: 'relative', ...gridBg }}>
            {pos && (
              <div
                onClick={() => {
                  setEditingActivity(activity);
                  setSelectedTechnicians(techs.map(t => t.id));
                  setShowEditModal(true);
                }}
                title={`${onLeave ? '⚠ ' + t('duringAbsence') + ': ' + absenceConflicts.get(activity.id).map(x => `${x.tech} (${t('abs_' + x.type)})`).join(', ') + '\n' : ''}${overlap ? '⚠ ' + t('doubleBooking') + '\n' : ''}${activity.name} — ${activity.start_date} → ${activity.end_date}${dayPartOf(activity) === 'AM' ? ' — ' + t('onlyMorning') : dayPartOf(activity) === 'PM' ? ' — ' + t('onlyAfternoon') : ''} — ${actDurationDays(activity)} ${t('calendarDays')}`}
                style={{
                  position: 'absolute', top: 8, height: ROW_H - 16,
                  left: pos.left, width: pos.width,
                  // Il conflitto non usa piu' il rosso pieno: era indistinguibile
                  // da un tecnico che ha scelto il rosso come proprio colore.
                  // Striature diagonali e bordo marcato funzionano con qualsiasi
                  // colore e restano leggibili anche a chi non distingue i rossi.
                  // Fascia oraria come motivo a mezze celle; il conflitto come
                  // striature diagonali sopra. I due livelli convivono.
                  backgroundColor: dayPartOf(activity) === 'FULL' ? (color || '#555555') : 'transparent',
                  backgroundImage: [
                    conflict ? 'repeating-linear-gradient(45deg, rgba(0,0,0,0.55) 0 5px, rgba(255,255,255,0.30) 5px 10px)' : null,
                    halfDayPattern(activity, color || '#555555'),
                  ].filter(Boolean).join(', ') || undefined,
                  borderRadius: 4, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, color: 'white', fontWeight: 500,
                  border: conflict ? '2px solid #ef4444'
                        : (dayPartOf(activity) === 'FULL' ? '1px solid var(--border)' : 'none'),
                  boxSizing: 'border-box',
                  overflow: 'hidden', whiteSpace: 'nowrap',
                }}>
                <span style={{
                  overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 6px',
                  textShadow: conflict ? '0 1px 3px rgba(0,0,0,0.9)' : undefined,
                  position: 'relative',
                }}>
                  {conflict ? '⚠ ' : ''}{barText || (activity.progress != null ? `${activity.progress}%` : '')}
                </span>
              </div>
            )}
          </div>
        </div>
      );
    };

    return (
      <div ref={ganttRef} style={{
        height: ganttHeight,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}>
        {/* Barra filtri */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center',
          padding: '10px 12px', marginBottom: 12,
          backgroundColor: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8,
        }}>
          {/* Nazioni */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{t('country')}:</span>
            {availableCountries.map(cc => {
              const on = filterCountries.includes(cc);
              return (
                <button key={cc} onClick={() => toggleCountry(cc)} title={COUNTRY_NAMES[cc] || cc}
                  style={{
                    padding: '4px 10px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                    border: on ? '1px solid var(--accent)' : '1px solid var(--border)',
                    backgroundColor: on ? 'var(--accent)' : 'var(--surface)',
                    color: on ? 'var(--accentFg)' : 'var(--fg)',
                  }}>
                  {countryFlag(cc)} {cc}
                </button>
              );
            })}
          </div>

          {/* Ricerca */}
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder={groupBy === 'project' ? t('searchProject') : t('searchTechnician')}
            style={{
              padding: '5px 10px', fontSize: 13, minWidth: 190,
              border: '1px solid var(--border)', borderRadius: 5,
              backgroundColor: 'var(--surface)', color: 'var(--fg)',
            }}
          />

          {/* Tecnici */}
          <select
            value=""
            onChange={(e) => {
              const id = parseInt(e.target.value);
              if (id && !filterTechIds.includes(id)) setFilterTechIds([...filterTechIds, id]);
            }}
            style={{ padding: '5px 8px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 5, maxWidth: 170, backgroundColor: 'var(--surface)', color: 'var(--fg)' }}
          >
            <option value="" style={{ color: 'var(--fg)', backgroundColor: 'var(--surface)' }}>{t('filterTechnician')}</option>
            {technicians
              .filter(t => !filterTechIds.includes(t.id))
              .map(t => <option key={t.id} value={t.id} style={{ color: 'var(--fg)', backgroundColor: 'var(--surface)' }}>{t.name}</option>)}
          </select>

          {filterTechIds.map(id => {
            const tech = technicians.find(x => x.id === id);
            if (!tech) return null;
            return (
              <span key={id}
                onClick={() => setFilterTechIds(filterTechIds.filter(x => x !== id))}
                title={t('clearFilters')}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '3px 8px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                  backgroundColor: tech.color || '#555555', color: 'white',
                }}>
                {tech.name} <strong>×</strong>
              </span>
            );
          })}

          {/* Solo conflitti */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={onlyConflicts} onChange={(e) => setOnlyConflicts(e.target.checked)} />
            {t('onlyConflicts')}
          </label>

          {/* Espandi / chiudi tutto */}
          <button
            onClick={groupBy === 'project' ? toggleAllVisibleProjects : toggleAllVisibleTechs}
            style={{
              padding: '5px 12px', fontSize: 12, cursor: 'pointer',
              border: '1px solid var(--border)', borderRadius: 5,
              backgroundColor: 'var(--surface)', color: 'var(--fg)', whiteSpace: 'nowrap',
            }}>
            {(groupBy === 'project'
              ? (visibleProjects.length > 0 && visibleProjects.every(p => p.expanded))
              : (visibleTechnicians.length > 0 && visibleTechnicians.every(x => expandedTechs.includes(x.id)))
            ) ? `▾ ${t('collapseAll')}` : `▸ ${t('expandAll')}`}
          </button>

          {/* Contatore + reset */}
          <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 'auto' }}>
            {groupBy === 'project'
              ? `${visibleProjects.length} ${t('projectsOf')} ${projects.length}`
              : `${visibleTechnicians.length} ${t('techniciansOf')} ${technicians.length}`}
          </span>
          {(filterCountries.length > 0 || filterText || onlyConflicts) && (
            <button onClick={resetFilters}
              style={{
                padding: '4px 10px', fontSize: 12, cursor: 'pointer',
                border: '1px solid var(--border)', borderRadius: 5, backgroundColor: 'var(--surface)', color: 'var(--fg)',
              }}>
              {t('clearFilters')}
            </button>
          )}
        </div>

        {/* Toggle raggruppamento */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {[['project', t('byProject')], ['technician', t('byTechnician')]].map(([key, label]) => (
            <button key={key} onClick={() => setGroupBy(key)}
              style={{
                padding: '6px 14px', borderRadius: 5, border: 'none', cursor: 'pointer', fontSize: 13,
                backgroundColor: groupBy === key ? 'var(--accent)' : 'var(--surface2)',
                color: groupBy === key ? 'var(--accentFg)' : 'var(--fg)',
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* UN SOLO contenitore scorrevole: la colonna sinistra e' sticky, non puo' sfasarsi */}
        <div style={{
          overflow: 'auto',
          flex: 1,
          minHeight: 0,
          border: '1px solid var(--border)',
          borderRadius: 8,
        }}>
          <div style={{ width: LEFT_W + gridW, position: 'relative' }}>

            {/* HEADER date */}
            <div style={{
              position: 'sticky', top: 0, zIndex: 15,
              display: 'flex', height: ROW_H,
              backgroundColor: 'var(--surface2)',
              borderBottom: '2px solid var(--border)',
            }}>
              <div style={{
                position: 'sticky', left: 0, zIndex: 20,
                width: LEFT_W, minWidth: LEFT_W,
                padding: '0 12px',
                display: 'flex', alignItems: 'center',
                fontWeight: 700, fontSize: 13,
                backgroundColor: 'var(--surface2)',
                borderRight: '2px solid var(--border)',
              }}>
                {groupBy === 'project' ? t('projectActivity') : t('technicianTasks')}
              </div>
              {dates.map((date, i) => (
                <div key={i} style={{
                  width: DAY_W, minWidth: DAY_W,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  borderRight: '1px solid var(--border)',
                  backgroundColor: isToday(date) ? 'var(--surface2)' : 'transparent',
                }}>
                  <div style={{ fontSize: viewMode === 'week' ? 13 : 11, fontWeight: 700 }}>{formatDate(date)}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                    {date.toLocaleDateString(locale, { weekday: 'short' })}
                  </div>
                </div>
              ))}
            </div>

            {/* ===== VISTA PER PROGETTO ===== */}
            {groupBy === 'project' && visibleProjects.map(project => {
              const techSet = new Set(filterTechIds);
              const acts = (activitiesByProject.get(project.id) || []).filter(a =>
                (!onlyConflicts || conflictingActivityIds.has(a.id)) &&
                (!techSet.size || (a.technicians || []).some(t => techSet.has(t.id)))
              );
              return (
                <div key={project.id}>
                  <div style={{ display: 'flex', height: ROW_H, borderBottom: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}>
                    <LeftCell bg="#ffffff" onClick={() => toggleProject(project.id)}>
                      <div style={{ display: 'flex', alignItems: 'center', fontWeight: 600, fontSize: 13 }}>
                        {project.expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        <span style={{ marginLeft: 8, color: project.color || '#555555', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                          {countryFlag(project.country)} {project.code} - {project.name}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: onlyConflicts ? '#ef4444' : 'var(--muted)', marginLeft: 24 }}>
                        {acts.length} {onlyConflicts ? t('inConflict') : t('activityCount')}
                      </div>
                    </LeftCell>
                    <div style={{ width: gridW, minWidth: gridW, ...gridBg }} />
                  </div>

                  {project.expanded && acts.map(activity => (
                    <ActivityRow
                      key={activity.id}
                      activity={activity}
                      label={activity.name}
                      sub={(activity.technicians || []).map(x => x.name).join(', ') || t('unassigned')}
                      color={project.color}
                      barText={`${project.code} · ${activity.name} · ${activity.progress ?? 0}%`}
                    />
                  ))}
                </div>
              );
            })}

            {/* ===== VISTA PER TECNICO ===== */}
            {groupBy === 'technician' && visibleTechnicians.map(tech => {
              const techAbsences = absences.filter(x => x.technician_id === tech.id);
              const visibleIds = new Set(visibleProjects.map(p => p.id));
              const acts = (activitiesByTech.get(tech.id) || []).filter(a =>
                visibleIds.has(a.project_id) &&
                (!onlyConflicts || conflictingActivityIds.has(a.id))
              );
              const expanded = expandedTechs.includes(tech.id);
              const busy = loadDays(acts);
              const pct  = Math.round((busy / dates.length) * 100);

              return (
                <div key={tech.id}>
                  <div style={{ display: 'flex', height: ROW_H, borderBottom: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}>
                    <LeftCell bg="#ffffff" onClick={() => toggleTech(tech.id)}>
                      <div style={{ display: 'flex', alignItems: 'center', fontWeight: 600, fontSize: 13 }}>
                        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        <span style={{
                          marginLeft: 8, width: 10, height: 10, borderRadius: '50%',
                          backgroundColor: tech.color || '#555555', display: 'inline-block', flexShrink: 0,
                        }} />
                        <span style={{ marginLeft: 8, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                          {tech.name}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 24 }}>
                        {t('workload')}: {busy}/{dates.length} {t('days')} ({pct}%)
                      </div>
                    </LeftCell>

                    {/* Barre compatte anche a gruppo chiuso: sovrapposizioni = conflitto */}
                    <div style={{ width: gridW, minWidth: gridW, position: 'relative', ...gridBg }}>
                      {/* Assenze: fasce tratteggiate sotto le barre, mai cliccabili */}
                      {techAbsences.map(ab => {
                        const p = barPos(ab);
                        if (!p) return null;
                        return (
                          <div key={'ab' + ab.id}
                            title={`${t('absence')}: ${t('abs_' + ab.type)}${ab.note ? ' — ' + ab.note : ''}`}
                            style={{
                              position: 'absolute', top: 0, bottom: 0,
                              left: p.left, width: p.width,
                              backgroundImage: 'repeating-linear-gradient(45deg, var(--muted) 0 3px, transparent 3px 8px)',
                              opacity: 0.45, pointerEvents: 'none', zIndex: 1,
                            }} />
                        );
                      })}
                      {!expanded && acts.map(a => {
                        const p = barPos(a);
                        if (!p) return null;
                        const prj = projects.find(pr => pr.id === a.project_id);
                        return (
                          <div key={a.id}
                            title={`${prj ? prj.code + ' — ' : ''}${a.name}`}
                            style={{
                              position: 'absolute', top: 14, height: 20,
                              left: p.left, width: p.width,
                              backgroundColor: dayPartOf(a) === 'FULL' ? (prj?.color || '#555555') : 'transparent',
                              backgroundImage: halfDayPattern(a, prj?.color || '#555555'),
                              borderRadius: 3, opacity: 0.85,
                              fontSize: 10, color: 'white',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              overflow: 'hidden', whiteSpace: 'nowrap',
                            }}>
                            {prj?.code || ''}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {expanded && acts.map(activity => {
                    const prj = projects.find(pr => pr.id === activity.project_id);
                    return (
                      <ActivityRow
                        key={activity.id}
                        activity={activity}
                        label={activity.name}
                        sub={prj ? `${countryFlag(prj.country)} ${prj.code} - ${prj.name}` : 'Progetto sconosciuto'}
                        color={prj?.color}
                        barText={`${prj ? prj.code + ' · ' : ''}${activity.name} · ${activity.progress ?? 0}%`}
                      />
                    );
                  })}
                </div>
              );
            })}

          </div>
        </div>

        {((groupBy === 'project' && visibleProjects.length === 0) ||
          (groupBy === 'technician' && visibleTechnicians.length === 0)) && (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)', fontSize: 14, flexShrink: 0 }}>
            {t('noResults')}
          </div>
        )}
      </div>
    );
  };

  if (resetToken) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', backgroundColor: 'var(--barBg)',
      }}>
        <div style={{
          backgroundColor: 'var(--surface)', color: 'var(--fg)', padding: '2rem',
          borderRadius: 10, width: '100%', maxWidth: 400,
        }}>
          <h2 style={{ textAlign: 'center', marginTop: 0 }}>{t('newPassword')}</h2>
          <form onSubmit={handleResetPassword}>
            <input
              type="password"
              value={resetPwd}
              onChange={(e) => setResetPwd(e.target.value)}
              placeholder={t('newPassword')}
              minLength={8}
              required
              style={{
                width: '100%', padding: 12, marginBottom: 8, borderRadius: 5,
                border: '1px solid var(--border)', boxSizing: 'border-box',
                backgroundColor: 'var(--surface)', color: 'var(--fg)',
              }}
            />
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
              {t('passwordMin')}
            </div>
            <button type="submit" style={{
              width: '100%', padding: 12, borderRadius: 5, border: 'none',
              backgroundColor: 'var(--accent)', color: 'var(--accentFg)',
              fontSize: 16, fontWeight: 600, cursor: 'pointer',
            }}>{t('save')}</button>
          </form>
          <button
            onClick={() => { setResetToken(null); window.history.replaceState(null,'',window.location.pathname); }}
            style={{
              width: '100%', marginTop: 10, padding: 10, borderRadius: 5,
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--fg)', cursor: 'pointer',
            }}>{t('cancel')}</button>
        </div>
      </div>
    );
  }

  if (showLogin) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--barBg)'
      }}>
        <div style={{
          backgroundColor: 'var(--surface)',
          padding: '2rem',
          borderRadius: '10px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          width: '100%',
          maxWidth: '400px'
        }}>
          <h2 style={{ textAlign: 'center', marginBottom: '1.5rem', color: 'var(--fg)' }}>
            Progetto.io
          </h2>
          <form onSubmit={handleLogin}>
            <input
              type="email"
              placeholder={t('email')}
              value={loginData.email}
              onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
              required
              style={{
                width: '100%',
                padding: '12px',
                marginBottom: '1rem',
                border: '1px solid var(--border)',
                borderRadius: '5px',
                fontSize: '1rem',
                boxSizing: 'border-box'
              }}
            />
            <input
              type="password"
              placeholder={t('password')}
              value={loginData.password}
              onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
              required
              style={{
                width: '100%',
                padding: '12px',
                marginBottom: '1rem',
                border: '1px solid var(--border)',
                borderRadius: '5px',
                fontSize: '1rem',
                boxSizing: 'border-box'
              }}
            />
            {error && (
              <div style={{
                padding: '10px',
                marginBottom: '1rem',
                backgroundColor: '#fee',
                color: '#c33',
                borderRadius: '5px',
                fontSize: '0.9rem'
              }}>
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: 'var(--accent)',
                color: 'var(--accentFg)',
                border: 'none',
                borderRadius: '5px',
                fontSize: '1rem',
                fontWeight: 'bold',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? t('signingIn') : t('signIn')}
            </button>
          </form>

          {/* Compare solo se il server ha un SMTP configurato */}
          {mailEnabled && !showForgot && (
            <button
              onClick={() => { setShowForgot(true); setForgotMsg(''); }}
              style={{
                width: '100%', marginTop: 12, padding: 8, background: 'transparent',
                border: 'none', color: 'var(--muted)', cursor: 'pointer',
                fontSize: 13, textDecoration: 'underline',
              }}>
              {t('forgotPassword')}
            </button>
          )}

          {mailEnabled && showForgot && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>
                {t('forgotHint')}
              </div>
              <form onSubmit={handleForgot}>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder={t('email')}
                  required
                  style={{
                    width: '100%', padding: 10, marginBottom: 8, borderRadius: 5,
                    border: '1px solid var(--border)', boxSizing: 'border-box',
                    backgroundColor: 'var(--surface)', color: 'var(--fg)',
                  }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" style={{
                    flex: 1, padding: 10, borderRadius: 5, border: 'none',
                    backgroundColor: 'var(--accent)', color: 'var(--accentFg)',
                    cursor: 'pointer', fontSize: 14,
                  }}>{t('send')}</button>
                  <button type="button" onClick={() => setShowForgot(false)} style={{
                    padding: '10px 14px', borderRadius: 5, border: '1px solid var(--border)',
                    background: 'transparent', color: 'var(--fg)', cursor: 'pointer', fontSize: 14,
                  }}>{t('cancel')}</button>
                </div>
              </form>
              {forgotMsg && (
                <div style={{ marginTop: 10, fontSize: 13, color: 'var(--fg)' }}>{forgotMsg}</div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Navigazione: la voce attiva si distingue con una banda sotto, non con un
  // riempimento — su una barra piena il riempimento sporcherebbe il contrasto.
  const navStyle = (view) => ({
    background: 'transparent',
    color: 'var(--barFg)',
    border: 'none',
    borderBottom: `3px solid ${currentView === view ? 'var(--barFg)' : 'transparent'}`,
    padding: '0 0.75rem',
    margin: 0,
    height: 48,
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: currentView === view ? 700 : 400,
    opacity: currentView === view ? 1 : 0.72,
    transition: 'opacity 0.15s',
    whiteSpace: 'nowrap',
  });
  const navHover = {
    onMouseEnter: (e) => { e.currentTarget.style.opacity = 1; },
    onMouseLeave: (e) => {
      const v = e.currentTarget.getAttribute('data-view');
      e.currentTarget.style.opacity = currentView === v ? 1 : 0.72;
    },
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)', color: 'var(--fg)' }}>
      {/* Header — barra piena, senza ombra: la separazione la fa il contrasto */}
      <div style={{
        backgroundColor: 'var(--barBg)',
        padding: '0 1rem',
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'space-between',
        minHeight: 48,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h1 style={{
            color: 'var(--barFg)', margin: 0, fontSize: '1.05rem',
            fontWeight: 700, letterSpacing: '0.02em',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            Progetto.io
            {license && !license.licensed && (
              <span title={t('licenseNonCommercial')} style={{
                fontSize: 10, fontWeight: 400, padding: '1px 7px', borderRadius: 10,
                border: '1px solid var(--barFg)', opacity: 0.65, whiteSpace: 'nowrap',
              }}>
                {t('nonCommercial')}
              </span>
            )}
          </h1>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            title={t('language')}
            style={{
              padding: '0.25rem 0.4rem',
              borderRadius: 4,
              border: '1px solid var(--barFg)',
              backgroundColor: 'transparent',
              color: 'var(--barFg)',
              cursor: 'pointer',
              fontSize: '0.8rem',
              alignSelf: 'center',
            }}
          >
            {LANGUAGES.map(l => (
              <option key={l.code} value={l.code} style={{ color: '#121212', backgroundColor: 'var(--surface)' }}>
                {l.flag} {l.code.toUpperCase()}
              </option>
            ))}
          </select>

          <button
            onClick={() => setInverted(v => !v)}
            title={t('invertColors')}
            style={{
              alignSelf: 'center',
              width: 26, height: 26, padding: 0,
              borderRadius: '50%',
              border: '1px solid var(--barFg)',
              cursor: 'pointer',
              background: 'linear-gradient(90deg, var(--barFg) 0 50%, var(--barBg) 50% 100%)',
            }}
          />

          <button
            onClick={() => setCurrentView('dashboard')}
            style={navStyle('dashboard')}
            data-view="dashboard"
            {...navHover}
          >
            📊 {t('dashboard')}
          </button>

          <button
            onClick={() => setCurrentView('projects')}
            style={navStyle('projects')}
            data-view="projects"
            {...navHover}
          >
            📁 {t('projects')}
          </button>

          <button
            onClick={() => setCurrentView('activities')}
            style={navStyle('activities')}
            data-view="activities"
            {...navHover}
          >
            ✅ {t('activities')}
          </button>

          <button
            onClick={() => setCurrentView('technicians')}
            style={navStyle('technicians')}
            data-view="technicians"
            {...navHover}
          >
            👥 {t('technicians')}
          </button>

	{(user?.role === 'admin' || user?.role === 'editor') && (
          <button
            onClick={() => setCurrentView('conflicts')}
            style={navStyle('conflicts')}
            data-view="conflicts"
            {...navHover}
          >
            ⚠️ {t('conflicts')}
          </button>
        )}

          <button
            onClick={() => setCurrentView('reports')}
            style={navStyle('reports')}
            data-view="reports"
            {...navHover}
          >
            📄 {t('reports')}
          </button>

          {user?.role === 'admin' && (
            <button
              onClick={() => setCurrentView('system')}
              style={navStyle('system')}
              data-view="system"
              {...navHover}
            >
              🗄 {t('maintenance')}
            </button>
          )}

          {user?.role === 'admin' && (
            <button
              onClick={() => setCurrentView('users')}
              style={navStyle('users')}
              data-view="users"
              {...navHover}
            >
              🔐 {t('users')}
            </button>
          )}

          <span style={{ color: 'var(--barFg)', fontWeight: 600, fontSize: '0.85rem', alignSelf: 'center' }}>
            {user?.name} ({user?.role})
          </span>

          <button
            onClick={handleLogout}
            style={{
              background: 'transparent',
              color: 'var(--barFg)',
              border: '1px solid var(--barFg)',
              padding: '0.3rem 0.7rem',
              borderRadius: 5,
              cursor: 'pointer',
              alignSelf: 'center',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* Contenuto Principale */}
      <div style={{ padding: '0.75rem 1rem' }}>
        {currentView === 'dashboard' && (
          <div>
            {/* Controlli Vista */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.6rem',
              backgroundColor: 'var(--surface)',
              padding: '0.5rem 0.75rem',
              borderRadius: 6,
              border: '1px solid var(--border)'
            }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <button
                  onClick={() => setViewMode('week')}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: viewMode === 'week' ? 'var(--accent)' : 'var(--surface2)',
                    color: viewMode === 'week' ? 'var(--accentFg)' : 'var(--fg)',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  {t('week')}
                </button>
                <button
                  onClick={() => setViewMode('month')}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: viewMode === 'month' ? 'var(--accent)' : 'var(--surface2)',
                    color: viewMode === 'month' ? 'var(--accentFg)' : 'var(--fg)',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  {t('month')}
                </button>
              </div>

              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <button
                  onClick={() => {
                    if (viewMode === 'week') {
                      const newDate = new Date(currentDates[0]);
                      newDate.setDate(newDate.getDate() - 7);
                      setCurrentDates(getWeekDates(newDate));
                    } else {
                      const newMonth = new Date(currentMonth);
                      newMonth.setMonth(newMonth.getMonth() - 1);
                      setCurrentMonth(newMonth);
                    }
                  }}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accentFg)',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer'
                  }}
                >
                  ◀ {t('previous')}
                </button>

                <span style={{ fontWeight: '600', minWidth: '200px', textAlign: 'center' }}>
                  {viewMode === 'week' 
                    ? `${formatDate(currentDates[0])} - ${formatDate(currentDates[6])}`
                    : formatMonthYear(currentMonth)
                  }
                </span>

                <button
                  onClick={() => {
                    if (viewMode === 'week') {
                      const newDate = new Date(currentDates[0]);
                      newDate.setDate(newDate.getDate() + 7);
                      setCurrentDates(getWeekDates(newDate));
                    } else {
                      const newMonth = new Date(currentMonth);
                      newMonth.setMonth(newMonth.getMonth() + 1);
                      setCurrentMonth(newMonth);
                    }
                  }}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accentFg)',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer'
                  }}
                >
                  {t('next')} ▶
                </button>

                <button
                  onClick={() => {
                    if (viewMode === 'week') {
                      setCurrentDates(getWeekDates(new Date()));
                    } else {
                      setCurrentMonth(new Date());
                    }
                  }}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  {t('today')}
                </button>
              </div>
            </div>

            {/* Gantt Chart */}
            <div style={{
              backgroundColor: 'var(--surface)',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              overflow: 'hidden'
            }}>
              {renderGanttChart()}
            </div>
          </div>
        )}

        {currentView === 'projects' && (
          <div style={{
            backgroundColor: 'var(--surface)',
            padding: '2rem',
            borderRadius: '8px',
            border: '1px solid var(--border)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0 }}>{t('manageProjects')}</h2>
              {(user?.role === 'admin' || user?.role === 'editor') && (
                <button
                  onClick={() => {
                    setEditingProject({ code: '', name: '', color: '#555555' });
                    setShowProjectModal(true);
                  }}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accentFg)',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <Plus size={18} /> {t('newProject')}
                </button>
              )}
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--surface2)' }}>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>{t('code')}</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>{t('name')}</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>{t('color')}</th>
                  {(user?.role === 'admin' || user?.role === 'editor') && (
                    <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid var(--border)' }}>{t('actions')}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {projects.map(project => (
                  <tr key={project.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px' }}>{project.code}</td>
                    <td style={{ padding: '12px' }}>{project.name}</td>
                    <td style={{ padding: '12px' }}>
                      <div style={{
                        width: '30px',
                        height: '30px',
                        backgroundColor: project.color,
                        borderRadius: '5px',
                        border: '1px solid var(--border)'
                      }} />
                    </td>
                    {(user?.role === 'admin' || user?.role === 'editor') && (
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <button
                          onClick={() => handleDuplicateProject(project)}
                          title={t('duplicate')}
                          style={{
                            padding: '0.5rem 0.7rem', backgroundColor: 'transparent',
                            color: 'var(--fg)', border: '1px solid var(--border)',
                            borderRadius: '5px', cursor: 'pointer', marginRight: '0.5rem',
                            fontSize: '0.8rem',
                          }}
                        >
                          ⧉
                        </button>
                        <button
                          onClick={() => {
                            setEditingProject(project);
                            setShowProjectModal(true);
                          }}
                          style={{
                            padding: '0.5rem',
                            backgroundColor: 'var(--muted)',
                            color: 'var(--accentFg)',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            marginRight: '0.5rem'
                          }}
                        >
                          <Edit2 size={16} />
                        </button>
                        {user?.role === 'admin' && (
                          <button
                            onClick={() => handleDeleteProject(project.id)}
                            style={{
                              padding: '0.5rem',
                              backgroundColor: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '5px',
                              cursor: 'pointer'
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {currentView === 'activities' && (
          <div style={{
            backgroundColor: 'var(--surface)',
            padding: '2rem',
            borderRadius: '8px',
            border: '1px solid var(--border)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0 }}>
                {t('manageActivities')}
                <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--muted)', marginLeft: 10 }}>
                  {activities.length} {t('activityCount')}
                </span>
              </h2>
              {(user?.role === 'admin' || user?.role === 'editor') && (
                <button
                  onClick={() => {
                    setEditingActivity(null);
		    setSelectedTechnicians([]);
                    setShowActivityModal(true);
                  }}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accentFg)',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <Plus size={18} /> {t('newActivity')}
                </button>
              )}
            </div>

            {/* Filtri */}
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center',
              padding: '8px 10px', marginBottom: '1rem',
              backgroundColor: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6,
            }}>
              <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{t('country')}:</span>
              {availableCountries.map(cc => {
                const on = activityCountries.includes(cc);
                return (
                  <button key={cc}
                    title={COUNTRY_NAMES[cc] || cc}
                    onClick={() => {
                      setActivityCountries(prev => prev.includes(cc) ? prev.filter(x => x !== cc) : [...prev, cc]);
                      setActivityPage(0);
                    }}
                    style={{
                      padding: '4px 10px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                      border: on ? '1px solid var(--accent)' : '1px solid var(--border)',
                      backgroundColor: on ? 'var(--accent)' : 'var(--surface)',
                      color: on ? 'var(--accentFg)' : 'var(--fg)',
                    }}>
                    {countryFlag(cc)} {cc}
                  </button>
                );
              })}

              <input
                type="text"
                value={activitySearch}
                onChange={(e) => { setActivitySearch(e.target.value); setActivityPage(0); }}
                placeholder={t('searchProject')}
                style={{
                  flex: 1, minWidth: 200, maxWidth: 320,
                  padding: '5px 10px', fontSize: 13, borderRadius: 5,
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--surface)', color: 'var(--fg)',
                }}
              />

              {(activityCountries.length > 0 || activitySearch) && (
                <button
                  onClick={() => { setActivityCountries([]); setActivitySearch(''); setActivityPage(0); }}
                  style={{
                    padding: '4px 10px', fontSize: 12, cursor: 'pointer',
                    border: '1px solid var(--border)', borderRadius: 5,
                    backgroundColor: 'var(--surface)', color: 'var(--fg)',
                  }}>
                  {t('clearFilters')}
                </button>
              )}
            </div>

            {(() => {
              // Raggruppate per progetto: con migliaia di attivita' un elenco
              // piatto non dice a cosa appartiene ciascuna riga.
              const q = activitySearch.trim().toLowerCase();
              const withActs = projects
                .map(p => ({ project: p, acts: activitiesByProject.get(p.id) || [] }))
                .filter(g => g.acts.length > 0)
                .filter(g => !activityCountries.length || activityCountries.includes(g.project.country))
                .filter(g => !q || `${g.project.code} ${g.project.name}`.toLowerCase().includes(q)
                          || g.acts.some(a => a.name.toLowerCase().includes(q)))
                .sort((a, b) => (a.project.country || '').localeCompare(b.project.country || '')
                              || a.project.code.localeCompare(b.project.code));

              const totalPages = Math.ceil(withActs.length / PROJECTS_PER_PAGE);
              const page = withActs.slice(activityPage * PROJECTS_PER_PAGE, (activityPage + 1) * PROJECTS_PER_PAGE);
              const canEdit = user?.role === 'admin' || user?.role === 'editor';

              if (!withActs.length) {
                return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>{t('noResults')}</div>;
              }

              return (
                <>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                    {page.map(({ project, acts }) => {
                      const open = expandedActProjects.includes(project.id);
                      return (
                        <div key={project.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          {/* Riga progetto */}
                          <div
                            onClick={() => setExpandedActProjects(prev =>
                              prev.includes(project.id) ? prev.filter(x => x !== project.id) : [...prev, project.id])}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: '10px 12px', cursor: 'pointer',
                              backgroundColor: open ? 'var(--surface2)' : 'var(--surface)',
                            }}>
                            {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            <span style={{
                              width: 10, height: 10, borderRadius: 2, flexShrink: 0,
                              backgroundColor: project.color || '#555555',
                            }} />
                            <strong style={{ fontSize: 13, minWidth: 90 }}>
                              {countryFlag(project.country)} {project.code}
                            </strong>
                            <span style={{ fontSize: 13 }}>{project.name}</span>
                            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)' }}>
                              {acts.length} {t('activityCount')}
                            </span>
                          </div>

                          {/* Attività del progetto */}
                          {open && (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                              <thead>
                                <tr style={{ backgroundColor: 'var(--surface2)' }}>
                                  {[t('activity'), t('technician'), t('startDate'), t('endDate'), t('progress')].map((h, i) => (
                                    <th key={i} style={{
                                      textAlign: 'left', padding: '7px 12px', fontSize: 12,
                                      borderBottom: '1px solid var(--border)',
                                      paddingLeft: i === 0 ? 40 : 12,
                                    }}>{h}</th>
                                  ))}
                                  {canEdit && <th style={{ borderBottom: '1px solid var(--border)' }} />}
                                </tr>
                              </thead>
                              <tbody>
                                {[...acts]
                                  .sort((a, b) => actStartUnit(a) - actStartUnit(b))
                                  .map(activity => {
                                    const techs = activity.technicians || [];
                                    const inConflict = conflictingActivityIds.has(activity.id)
                                                    || absenceConflicts.has(activity.id);
                                    return (
                                      <tr key={activity.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '7px 12px 7px 40px' }}>
                                          {inConflict && <span title={t('conflict')} style={{ marginRight: 6 }}>⚠</span>}
                                          {activity.name}
                                        </td>
                                        <td style={{ padding: '7px 12px', color: techs.length ? 'var(--fg)' : 'var(--muted)' }}>
                                          {techs.length ? techs.map(x => x.name).join(', ') : t('unassigned')}
                                        </td>
                                        <td style={{ padding: '7px 12px', whiteSpace: 'nowrap' }}>
                                          {new Date(activity.start_date).toLocaleDateString(locale)}
                                        </td>
                                        <td style={{ padding: '7px 12px', whiteSpace: 'nowrap' }}>
                                          {new Date(activity.end_date).toLocaleDateString(locale)}
                                          {dayPartOf(activity) !== 'FULL' && (
                                            <span style={{ color: 'var(--muted)', fontSize: 11 }}>
                                              {' '}({dayPartOf(activity) === 'AM' ? t('onlyMorning') : t('onlyAfternoon')})
                                            </span>
                                          )}
                                        </td>
                                        <td style={{ padding: '7px 12px', whiteSpace: 'nowrap' }}>
                                          <span style={{
                                            display: 'inline-block', width: 46, height: 6, borderRadius: 3,
                                            backgroundColor: 'var(--border)', verticalAlign: 'middle', marginRight: 6,
                                          }}>
                                            <span style={{
                                              display: 'block', height: '100%', borderRadius: 3,
                                              width: `${activity.progress || 0}%`,
                                              backgroundColor: project.color || '#555555',
                                            }} />
                                          </span>
                                          {activity.progress || 0}%
                                        </td>
                                        {canEdit && (
                                          <td style={{ padding: '7px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                            <button
                                              onClick={() => {
                                                setEditingActivity(activity);
                                                setSelectedTechnicians(techs.map(x => x.id));
                                                setShowEditModal(true);
                                              }}
                                              style={{
                                                background: 'transparent', border: '1px solid var(--border)',
                                                borderRadius: 4, color: 'var(--fg)', cursor: 'pointer',
                                                padding: '3px 7px', marginRight: 4,
                                              }}>
                                              <Edit2 size={13} />
                                            </button>
                                            <button
                                              onClick={() => handleDeleteActivity(activity.id)}
                                              style={{
                                                background: 'transparent', border: '1px solid var(--border)',
                                                borderRadius: 4, color: '#ef4444', cursor: 'pointer',
                                                padding: '3px 7px',
                                              }}>
                                              <Trash2 size={13} />
                                            </button>
                                          </td>
                                        )}
                                      </tr>
                                    );
                                  })}
                              </tbody>
                            </table>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {totalPages > 1 && (
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                      padding: '1rem 0 0 0',
                    }}>
                      <button onClick={() => setActivityPage(Math.max(0, activityPage - 1))}
                        disabled={activityPage === 0}
                        style={{
                          padding: '6px 14px', borderRadius: 5, fontSize: 13,
                          border: '1px solid var(--border)', backgroundColor: 'var(--surface)',
                          cursor: activityPage === 0 ? 'not-allowed' : 'pointer',
                          color: activityPage === 0 ? 'var(--muted)' : 'var(--fg)',
                        }}>{t('previousPage')}</button>
                      <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                        {activityPage * PROJECTS_PER_PAGE + 1}–
                        {Math.min((activityPage + 1) * PROJECTS_PER_PAGE, withActs.length)} {t('of')} {withActs.length}
                      </span>
                      <button onClick={() => setActivityPage(activityPage + 1)}
                        disabled={activityPage + 1 >= totalPages}
                        style={{
                          padding: '6px 14px', borderRadius: 5, fontSize: 13,
                          border: '1px solid var(--border)', backgroundColor: 'var(--surface)',
                          cursor: activityPage + 1 >= totalPages ? 'not-allowed' : 'pointer',
                          color: activityPage + 1 >= totalPages ? 'var(--muted)' : 'var(--fg)',
                        }}>{t('nextPage')}</button>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {currentView === 'technicians' && (
          <div style={{
            backgroundColor: 'var(--surface)',
            padding: '2rem',
            borderRadius: '8px',
            border: '1px solid var(--border)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0 }}>{t('manageTechnicians')}</h2>
              {(user?.role === 'admin' || user?.role === 'editor') && (
                <button
                  onClick={() => {
                    setEditingTechnician({ name: '', email: '', phone: '', specialization: '', color: '#555555' });
                    setShowTechnicianModal(true);
                  }}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accentFg)',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <Plus size={18} /> {t('newTechnician')}
                </button>
              )}
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--surface2)' }}>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>{t('name')}</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>{t('email')}</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>{t('phone')}</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>{t('specialization')}</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>{t('color')}</th>
                  {(user?.role === 'admin' || user?.role === 'editor') && (
                    <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid var(--border)' }}>{t('actions')}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {technicians.map(tech => (
                  <tr key={tech.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px' }}>{tech.name}</td>
                    <td style={{ padding: '12px' }}>{tech.email}</td>
                    <td style={{ padding: '12px' }}>{tech.phone}</td>
                    <td style={{ padding: '12px' }}>{tech.specialization}</td>
                    <td style={{ padding: '12px' }}>
                      <div style={{
                        width: '30px',
                        height: '30px',
                        backgroundColor: tech.color,
                        borderRadius: '5px',
                        border: '1px solid var(--border)'
                      }} />
                    </td>
                    {(user?.role === 'admin' || user?.role === 'editor') && (
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <button
                          onClick={() => openDevices(tech)}
                          title={t('deviceAccess')}
                          style={{
                            padding: '0.5rem 0.7rem', backgroundColor: 'transparent',
                            color: 'var(--fg)', border: '1px solid var(--border)',
                            borderRadius: '5px', cursor: 'pointer', marginRight: '0.5rem',
                            fontSize: '0.8rem',
                          }}
                        >
                          📱
                        </button>
                        <button
                          onClick={() => { setAbsenceTech(tech); setEditingAbsence(null); setShowAbsenceModal(true); }}
                          title={t('absences')}
                          style={{
                            padding: '0.5rem 0.7rem',
                            backgroundColor: 'transparent',
                            color: 'var(--fg)',
                            border: '1px solid var(--border)',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            marginRight: '0.5rem',
                            fontSize: '0.8rem',
                          }}
                        >
                          🏖 {absences.filter(x => x.technician_id === tech.id).length || ''}
                        </button>
                        <button
                          onClick={() => {
                            setEditingTechnician(tech);
                            setShowTechnicianModal(true);
                          }}
                          style={{
                            padding: '0.5rem',
                            backgroundColor: 'var(--muted)',
                            color: 'var(--accentFg)',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            marginRight: '0.5rem'
                          }}
                        >
                          <Edit2 size={16} />
                        </button>
                        {user?.role === 'admin' && (
                          <button
                            onClick={() => handleDeleteTechnician(tech.id)}
                            style={{
                              padding: '0.5rem',
                              backgroundColor: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '5px',
                              cursor: 'pointer'
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {currentView === 'users' && user?.role === 'admin' && (
          <div style={{
            backgroundColor: 'var(--surface)',
            padding: '2rem',
            borderRadius: '8px',
            border: '1px solid var(--border)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0 }}>{t('manageUsers')}</h2>
              <button
                onClick={() => setShowUserModal(true)}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accentFg)',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <Plus size={18} /> Nuovo Utente
              </button>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--surface2)' }}>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>{t('name')}</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>{t('email')}</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>{t('phone')}</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>{t('role')}</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>{t('assignedAreas')}</th>
                  <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid var(--border)' }}>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px' }}>{u.name}</td>
                    <td style={{ padding: '12px' }}>{u.email}</td>
                    <td style={{ padding: '12px' }}>{u.phone}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '12px',
                        fontSize: '0.85rem',
                        fontWeight: '600',
                        backgroundColor: u.role === 'admin' ? 'var(--surface2)' : u.role === 'editor' ? 'var(--surface2)' : 'var(--surface2)',
                        color: u.role === 'admin' ? 'var(--fg)' : u.role === 'editor' ? 'var(--fg)' : 'var(--fg)'
                      }}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ padding: '12px', fontSize: '0.85rem' }}>
                      {u.role === 'admin'
                        ? <span style={{ color: 'var(--muted)' }}>{t('allCountries')}</span>
                        : u.role === 'viewer'
                          ? <span style={{ color: 'var(--muted)' }}>—</span>
                          : (u.countries && u.countries.length)
                            ? <span>{u.countries.map(cc => `${countryFlag(cc)} ${cc}`).join('  ')}</span>
                            : <span style={{ color: '#dc3545', fontWeight: 600 }}>{t('noAreas')}</span>}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
  			<button
			    onClick={() => {
			      setEditingUser(u);
			      setShowUserModal(true);
			    }}
			    style={{
			      padding: '0.5rem',
			      backgroundColor: 'var(--muted)',
			      color: 'var(--accentFg)',
			      border: 'none',
			      borderRadius: '5px',
			      cursor: 'pointer',
			      marginRight: '0.5rem'
			    }}
			  >
			    <Edit2 size={16} />
			  </button>
			  <button
			    onClick={() => handleDeleteUser(u.id)}
			    style={{
			      padding: '0.5rem',
			      backgroundColor: '#ef4444',
			      color: 'white',
			      border: 'none',
			      borderRadius: '5px',
			      cursor: 'pointer'
			    }}
			  >
			    <Trash2 size={16} />
			  </button>
			</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
	
        {currentView === 'reports' && (
          <Reports
            projects={projects}
            activities={activities}
            technicians={technicians}
            absences={absences}
            t={t}
            locale={locale}
            canEdit={user?.role === 'admin' || user?.role === 'editor'}
            onActivityClick={(activity) => {
              setEditingActivity(activity);
              setSelectedTechnicians(activity.technicians?.map(x => x.id) || []);
              setShowEditModal(true);
            }}
          />
        )}

	{currentView === 'conflicts' && (
          <div style={{
            backgroundColor: 'var(--surface)',
            padding: '2rem',
            borderRadius: '8px',
            border: '1px solid var(--border)'
          }}>
            <h2 style={{ marginBottom: '1rem', color: '#dc3545' }}>
              <i>⚠️</i> {t('conflictsTitle')}
            </h2>

            {(() => {
              const byTech = new Map();
              detectedConflicts.forEach(cf => {
                if (!byTech.has(cf.technicianId)) {
                  byTech.set(cf.technicianId, { id: cf.technicianId, name: cf.technicianName, conflicts: [] });
                }
                byTech.get(cf.technicianId).conflicts.push(cf);
              });

              const q = conflictSearch.trim().toLowerCase();
              const list = [...byTech.values()]
                .filter(t => !q || t.name.toLowerCase().includes(q))
                .sort((a, b) => b.conflicts.length - a.conflicts.length);

              if (byTech.size === 0 && absenceIssues.size === 0) {
                return (
                  <div style={{
                    backgroundColor: 'var(--surface2)', border: '1px solid var(--border)',
                    borderRadius: 5, padding: '1rem', color: 'var(--fg)'
                  }}>
                    ✅ {t('noConflicts')}
                  </div>
                );
              }

              return (
                <>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      value={conflictSearch}
                      onChange={(e) => setConflictSearch(e.target.value)}
                      placeholder={t('searchTechnician')}
                      style={{ padding: '6px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 5, minWidth: 200 }}
                    />
                    <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                      {list.length} {t('techWithOverlaps')}
                    </span>
                    <button
                      onClick={() => setExpandedConflictTechs(
                        expandedConflictTechs.length ? [] : list.map(t => t.id)
                      )}
                      style={{
                        padding: '5px 12px', fontSize: 12, cursor: 'pointer',
                        border: '1px solid var(--border)', borderRadius: 5, backgroundColor: 'var(--surface)',
                      }}>
                      {expandedConflictTechs.length ? t('collapseAll') : t('expandAll')}
                    </button>
                  </div>

                  {/* Assenze sovrapposte ad attivita': elenco separato, il problema
                      e' di natura diversa dalla doppia assegnazione */}
                  {absenceIssues.size > 0 && (
                    <div style={{
                      border: '1px solid #f59e0b', borderRadius: 8,
                      backgroundColor: 'var(--surface2)', padding: '10px 14px', marginBottom: '1rem',
                    }}>
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: '#f59e0b' }}>
                        🏖 {t('assignedDuringAbsence')}
                      </div>
                      {[...absenceIssues.entries()].map(([techName, items]) => (
                        <div key={techName} style={{ marginBottom: 6, fontSize: 13 }}>
                          <strong>{techName}</strong>
                          <span style={{ color: 'var(--muted)' }}> — {items.length} {t('activitiesCol').toLowerCase()}</span>
                          <div style={{ marginLeft: 14, fontSize: 12, color: 'var(--muted)' }}>
                            {items.map((it, i) => (
                              <div key={i}>
                                {it.activity.name} · {new Date(it.activity.start_date).toLocaleDateString(locale)}
                                {' — '}{t('abs_' + it.absence.type)}{' '}
                                {new Date(it.absence.from).toLocaleDateString(locale)}
                                {' → '}{new Date(it.absence.to).toLocaleDateString(locale)}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Elenco scorrevole: un tecnico per riga, si apre al clic */}
                  <div style={{ maxHeight: 'calc(100vh - 320px)', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                    {list.map(tech => {
                      const open = expandedConflictTechs.includes(tech.id);
                      const totAct = new Set(tech.conflicts.flatMap(cf => cf.activities.map(a => a.id))).size;
                      return (
                        <div key={tech.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          {/* Intestazione tecnico */}
                          <div
                            onClick={() => setExpandedConflictTechs(prev =>
                              prev.includes(tech.id) ? prev.filter(x => x !== tech.id) : [...prev, tech.id]
                            )}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: '12px 16px', cursor: 'pointer',
                              backgroundColor: open ? 'var(--surface2)' : 'var(--surface)',
                            }}>
                            {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            <strong style={{ color: '#dc3545' }}>{tech.name}</strong>
                            <span style={{
                              backgroundColor: '#dc3545', color: 'white',
                              padding: '2px 10px', borderRadius: 12, fontSize: 12,
                            }}>
                              {tech.conflicts.length} {t('periods')}
                            </span>
                            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                              {totAct} {t('involvedActivities')}
                            </span>
                          </div>

                          {/* Dettaglio */}
                          {open && (
                            <div style={{ padding: '0 16px 16px 40px', backgroundColor: 'var(--surface2)' }}>
                              {tech.conflicts.map((cf, idx) => (
                                <div key={idx} style={{
                                  border: '1px solid #f0d0d0', borderRadius: 5,
                                  padding: '12px', marginBottom: 10, backgroundColor: 'var(--surface)',
                                }}>
                                  <div style={{ fontSize: 13, color: '#dc3545', fontWeight: 600, marginBottom: 8 }}>
                                    📅 dal {new Date(cf.periodStart).toLocaleDateString(locale)} al {new Date(cf.periodEnd).toLocaleDateString(locale)}
                                    <span style={{ marginLeft: 8, fontWeight: 400, color: 'var(--muted)' }}>
                                      ({cf.activities.length} {t('overlappingActivities')})
                                    </span>
                                  </div>

                                  {cf.activities.map(act => {
                                    const prj = projectsById.get(act.project_id);
                                    return (
                                      <div key={act.id}
                                        onClick={() => {
                                          setEditingActivity(act);
                                          setSelectedTechnicians(act.technicians?.map(t => t.id) || []);
                                          setShowActivityModal(true);
                                        }}
                                        title={t('clickToEdit')}
                                        style={{
                                          display: 'flex', alignItems: 'center', gap: 10,
                                          padding: '8px 10px', marginBottom: 6,
                                          border: '1px solid var(--border)', borderRadius: 5,
                                          backgroundColor: 'var(--surface2)', cursor: 'pointer',
                                          borderLeft: `4px solid ${prj?.color || '#555555'}`,
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--surface2)'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--surface2)'; }}
                                      >
                                        <span style={{
                                          fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                                          backgroundColor: prj?.color || '#555555', color: 'white', whiteSpace: 'nowrap',
                                        }}>
                                          {countryFlag(prj?.country)} {prj?.code || '—'}
                                        </span>
                                        <span style={{ flex: 1, fontSize: 13 }}>
                                          <strong>{act.name}</strong>
                                          <span style={{ color: 'var(--muted)' }}> · {prj?.name || 'Progetto sconosciuto'}</span>
                                        </span>
                                        <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                                          {new Date(act.start_date).toLocaleDateString(locale)} → {new Date(act.end_date).toLocaleDateString(locale)}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        )}
	
	</div>

      {/* Modal Progetti */}
      {showProjectModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'var(--surface)',
            padding: '2rem',
            borderRadius: '10px',
            width: '90%',
            maxWidth: '500px'
          }}>
            <h3 style={{ marginTop: 0 }}>{editingProject?.id ? t('editProject') : t('newProject')}</h3>
            <form onSubmit={handleSaveProject}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>{t('code')}</label>
                <input
                  type="text"
                  value={editingProject?.code || ''}
                  onChange={(e) => setEditingProject({ ...editingProject, code: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid var(--border)',
                    borderRadius: '5px',
                    boxSizing: 'border-box',
                    backgroundColor: 'var(--surface)',
                    color: 'var(--fg)'
                  }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>{t('name')}</label>
                <input
                  type="text"
                  value={editingProject?.name || ''}
                  onChange={(e) => setEditingProject({ ...editingProject, name: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid var(--border)',
                    borderRadius: '5px',
                    boxSizing: 'border-box',
                    backgroundColor: 'var(--surface)',
                    color: 'var(--fg)'
                  }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>{t('country')}</label>
                <select
                  value={editingProject?.country || 'IT'}
                  onChange={(e) => setEditingProject({ ...editingProject, country: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid var(--border)',
                    borderRadius: '5px',
                    boxSizing: 'border-box',
                    backgroundColor: 'var(--surface)'
                  }}
                >
                  {EMEA_COUNTRIES.map(g => (
                    <optgroup key={g.group} label={g.group}>
                      {g.items.map(([code, name]) => (
                        <option key={code} value={code} style={{ color: 'var(--fg)', backgroundColor: 'var(--surface)' }}>{countryFlag(code)} {name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>{t('color')}</label>
                <input
                  type="color"
                  value={editingProject?.color || '#555555'}
                  onChange={(e) => setEditingProject({ ...editingProject, color: e.target.value })}
                  style={{
                    width: '100%',
                    height: '50px',
                    border: '1px solid var(--border)',
                    borderRadius: '5px',
                    cursor: 'pointer'
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accentFg)',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  {t('save')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowProjectModal(false);
                    setEditingProject(null);
                  }}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    backgroundColor: 'var(--muted)',
                    color: 'var(--accentFg)',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  {t('cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tecnici */}
      {showTechnicianModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'var(--surface)',
            padding: '2rem',
            borderRadius: '10px',
            width: '90%',
            maxWidth: '500px'
          }}>
            <h3 style={{ marginTop: 0 }}>{editingTechnician?.id ? t('editTechnician') : t('newTechnician')}</h3>
            <form onSubmit={handleSaveTechnician}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>{t('name')}</label>
                <input
                  type="text"
                  value={editingTechnician?.name || ''}
                  onChange={(e) => setEditingTechnician({ ...editingTechnician, name: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid var(--border)',
                    borderRadius: '5px',
                    boxSizing: 'border-box',
                    backgroundColor: 'var(--surface)',
                    color: 'var(--fg)'
                  }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>{t('email')}</label>
                <input
                  type="email"
                  value={editingTechnician?.email || ''}
                  onChange={(e) => setEditingTechnician({ ...editingTechnician, email: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid var(--border)',
                    borderRadius: '5px',
                    boxSizing: 'border-box',
                    backgroundColor: 'var(--surface)',
                    color: 'var(--fg)'
                  }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>{t('phone')}</label>
                <input
                  type="tel"
                  value={editingTechnician?.phone || ''}
                  onChange={(e) => setEditingTechnician({ ...editingTechnician, phone: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid var(--border)',
                    borderRadius: '5px',
                    boxSizing: 'border-box',
                    backgroundColor: 'var(--surface)',
                    color: 'var(--fg)'
                  }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>{t('specialization')}</label>
                <input
                  type="text"
                  value={editingTechnician?.specialization || ''}
                  onChange={(e) => setEditingTechnician({ ...editingTechnician, specialization: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid var(--border)',
                    borderRadius: '5px',
                    boxSizing: 'border-box',
                    backgroundColor: 'var(--surface)',
                    color: 'var(--fg)'
                  }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>{t('color')}</label>
                <input
                  type="color"
                  value={editingTechnician?.color || '#555555'}
                  onChange={(e) => setEditingTechnician({ ...editingTechnician, color: e.target.value })}
                  style={{
                    width: '100%',
                    height: '50px',
                    border: '1px solid var(--border)',
                    borderRadius: '5px',
                    cursor: 'pointer'
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accentFg)',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  {t('save')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowTechnicianModal(false);
                    setEditingTechnician(null);
                  }}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    backgroundColor: 'var(--muted)',
                    color: 'var(--accentFg)',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  {t('cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Attività - CON DATE PRECOMPILATE */}
      {(showActivityModal || showEditModal) && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'var(--surface)',
            padding: '1.25rem 1.5rem',
            borderRadius: 10,
            width: '95%',
            maxWidth: 860,
            maxHeight: '92vh',
            overflowY: 'auto',
            border: '1px solid var(--border)',
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '0.9rem' }}>
              {editingActivity?.id ? t('editActivity') : t('newActivity')}
            </h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (dateError) return;
              const formData = new FormData(e.target);
              handleSaveActivity({
                name: formData.get('name'),
                project_id: parseInt(formData.get('project_id')),
                technician_ids: selectedTechnicians,
                start_date: formStart,
                end_date: formEnd,
                day_part: formDayPart,
                progress: parseInt(formData.get('progress'))
              });
            }}>
              {/* Due colonne: su un portatile la disposizione verticale usciva
                  dallo schermo. La griglia collassa a una colonna sotto i 700px. */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '0 1.5rem',
                alignItems: 'start',
              }}>

              <div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>{t('activityName')}</label>
                <input
                  name="name"
                  type="text"
                  defaultValue={editingActivity?.name || ''}
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid var(--border)',
                    borderRadius: '5px',
                    boxSizing: 'border-box',
                    backgroundColor: 'var(--surface)',
                    color: 'var(--fg)'
                  }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>{t('project')}</label>
                <select
                  name="project_id"
                  defaultValue={editingActivity?.project_id || ''}
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid var(--border)',
                    borderRadius: '5px',
                    boxSizing: 'border-box',
                    backgroundColor: 'var(--surface)',
                    color: 'var(--fg)'
                  }}
                >
                  <option value="" style={{ color: 'var(--fg)', backgroundColor: 'var(--surface)' }}>{t('selectProject')}</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id} style={{ color: 'var(--fg)', backgroundColor: 'var(--surface)' }}>{p.code} - {p.name}</option>
                  ))}
                </select>
              </div>




              <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 150 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>{t('startDate')}</label>
                  <input
                    name="start_date"
                    type="date"
                    value={formStart}
                    onChange={(e) => handleStartChange(e.target.value)}
                    required
                    style={{
                      width: '100%', padding: '0.5rem', borderRadius: '5px',
                      border: '1px solid var(--border)', boxSizing: 'border-box',
                      backgroundColor: 'var(--surface)', color: 'var(--fg)',
                    }}
                  />
                </div>

                <div style={{ width: 110 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                    {t('workDays')}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formWorkDays}
                    onChange={(e) => handleWorkDaysChange(e.target.value)}
                    placeholder="—"
                    title={t('workDaysHint')}
                    style={{
                      width: '100%', padding: '0.5rem', borderRadius: '5px',
                      border: '1px solid var(--border)', boxSizing: 'border-box',
                      backgroundColor: 'var(--surface)', color: 'var(--fg)',
                    }}
                  />
                </div>

                <div style={{ flex: 1, minWidth: 150 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>{t('endDate')}</label>
                  <input
                    name="end_date"
                    type="date"
                    value={formEnd}
                    min={formStart || undefined}
                    onChange={(e) => handleEndChange(e.target.value)}
                    required
                    style={{
                      width: '100%', padding: '0.5rem', borderRadius: '5px',
                      border: dateError ? '2px solid #ef4444' : '1px solid var(--border)',
                      boxSizing: 'border-box',
                      backgroundColor: dateError ? 'var(--surface2)' : 'var(--surface)',
                      color: 'var(--fg)',
                    }}
                  />
                </div>
              </div>

              {/* Fascia oraria: vale per tutta la durata dell'attivita'.
                  Le due caselle si escludono a vicenda; nessuna spuntata
                  significa giornata intera. */}
              <div style={{ display: 'flex', gap: 18, marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formDayPart === 'AM'}
                    onChange={(e) => setFormDayPart(e.target.checked ? 'AM' : 'FULL')}
                  />
                  {t('onlyMorning')}
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formDayPart === 'PM'}
                    onChange={(e) => setFormDayPart(e.target.checked ? 'PM' : 'FULL')}
                  />
                  {t('onlyAfternoon')}
                </label>
              </div>

              <div style={{ marginBottom: '1rem', minHeight: '20px' }}>
                {dateError ? (
                  <span style={{ color: '#ef4444', fontSize: '0.85rem' }}>
                    {t('dateErrorMsg')}
                  </span>
                ) : durationDays ? (
                  <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                    {t('duration')}: {durationDays} {durationDays === 1 ? t('oneDay') : t('calendarDays')}
                    {giorniLavorativi !== null && (
                      <> · {giorniLavorativi} {t('workingDays')}</>
                    )}
                    {includeNonLavorativi && (
                      <span style={{ color: '#f59e0b', marginLeft: 8 }}>
                        ⚠ {t('includesNonWorking')}
                      </span>
                    )}
                  </span>
                ) : null}
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>{t('progress')} (%)</label>
                <input
                  name="progress"
                  type="number"
                  min="0"
                  max="100"
                  defaultValue={editingActivity?.progress || 0}
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid var(--border)',
                    borderRadius: '5px',
                    boxSizing: 'border-box',
                    backgroundColor: 'var(--surface)',
                    color: 'var(--fg)'
                  }}
                />
              </div>
              </div>

              <div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                  {t('technicians')}
                  {selectedTechnicians.length > 0 && (
                    <span style={{ fontWeight: 400, color: 'var(--muted)', marginLeft: 8, fontSize: '0.85rem' }}>
                      {selectedTechnicians.length} {t('selected')}
                    </span>
                  )}
                </label>

                {/* Chi e' gia' selezionato resta sempre visibile: con molti
                    tecnici, scorrere l'elenco per capire chi si e' scelto
                    e' il momento in cui si sbaglia. */}
                {selectedTechnicians.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {selectedTechnicians.map(id => {
                      const tc = technicians.find(x => x.id === id);
                      if (!tc) return null;
                      return (
                        <span key={id}
                          onClick={() => setSelectedTechnicians(selectedTechnicians.filter(x => x !== id))}
                          title={t('removeFromSelection')}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '3px 9px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                            backgroundColor: tc.color || '#555555', color: 'white',
                          }}>
                          {tc.name} <strong>×</strong>
                        </span>
                      );
                    })}
                  </div>
                )}

                <input
                  type="text"
                  value={techSearch}
                  onChange={(e) => setTechSearch(e.target.value)}
                  placeholder={t('searchTechnician')}
                  style={{
                    width: '100%', padding: '0.45rem 0.6rem', marginBottom: 6,
                    borderRadius: 5, border: '1px solid var(--border)', boxSizing: 'border-box',
                    backgroundColor: 'var(--surface)', color: 'var(--fg)', fontSize: 13,
                  }}
                />

                <div style={{
                  border: '1px solid var(--border)', borderRadius: 5,
                  padding: 8, maxHeight: 170, overflowY: 'auto',
                  backgroundColor: 'var(--surface)',
                }}>
                  {(() => {
                    const q = techSearch.trim().toLowerCase();
                    const elenco = technicians
                      .filter(tc => !q
                        || tc.name.toLowerCase().includes(q)
                        || (tc.specialization || '').toLowerCase().includes(q))
                      // I selezionati in cima: restano a portata anche cercando
                      .sort((a, b) => {
                        const sa = selectedTechnicians.includes(a.id) ? 0 : 1;
                        const sb = selectedTechnicians.includes(b.id) ? 0 : 1;
                        return sa - sb || a.name.localeCompare(b.name);
                      });

                    if (!elenco.length) {
                      return <div style={{ fontSize: 13, color: 'var(--muted)', padding: '4px 2px' }}>
                        {t('noResults')}
                      </div>;
                    }

                    return elenco.map(tech => {
                      const sel = selectedTechnicians.includes(tech.id);
                      return (
                        <label key={tech.id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '4px 6px', borderRadius: 4, cursor: 'pointer',
                            backgroundColor: sel ? 'var(--surface2)' : 'transparent',
                          }}>
                          <input
                            type="checkbox"
                            name="technician_ids"
                            value={tech.id}
                            checked={sel}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedTechnicians([...selectedTechnicians, tech.id]);
                              else setSelectedTechnicians(selectedTechnicians.filter(id => id !== tech.id));
                            }}
                          />
                          <span style={{
                            width: 9, height: 9, borderRadius: '50%', flexShrink: 0,
                            backgroundColor: tech.color || '#555555',
                          }} />
                          <span style={{ fontSize: 14 }}>{tech.name}</span>
                          {tech.home_country && (
                            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                              {countryFlag(tech.home_country)}
                            </span>
                          )}
                          {tech.specialization && (
                            <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>
                              {tech.specialization}
                            </span>
                          )}
                        </label>
                      );
                    });
                  })()}
                </div>
              </div>
              </div>

              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  type="submit"
                  disabled={dateError}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    backgroundColor: dateError ? 'var(--muted)' : 'var(--accent)',
                    color: 'var(--accentFg)',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: dateError ? 'not-allowed' : 'pointer',
                    fontWeight: '600'
                  }}
                >
                  {t('save')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowActivityModal(false);
                    setShowEditModal(false);
                    setEditingActivity(null);
                    setSelectedTechnicians([]);
		  }}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    backgroundColor: 'var(--muted)',
                    color: 'var(--accentFg)',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  {t('cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Utenti */}
      {/* Manutenzione e registro — visibili solo agli admin */}
      {currentView === 'system' && user?.role === 'admin' && (
        <div style={{ padding: '0 1rem 1rem 1rem' }}>
          <h2 style={{ margin: '0 0 0.25rem 0' }}>🗄 {t('maintenance')}</h2>
          <p style={{ margin: '0 0 1rem 0', fontSize: 13, color: 'var(--muted)' }}>
            {t('maintenanceHint')}
          </p>

          {/* Licenza */}
          <div style={{
            backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '1rem', marginBottom: '1rem',
          }}>
            <h3 style={{ marginTop: 0, fontSize: '1rem' }}>🔑 {t('license')}</h3>

            {license?.licensed && !license?.expired && (
              <div style={{
                padding: '0.8rem', borderRadius: 6, marginBottom: 10,
                border: '1px solid var(--border)', backgroundColor: 'var(--surface2)',
              }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>✅ {t('licenseCommercial')}</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>
                  {t('licensedTo')}: <strong>{license.to}</strong>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  {license.expires
                    ? `${t('validUntil')} ${new Date(license.expires).toLocaleDateString(locale)}`
                    : t('perpetual')}
                  {license.seats ? ` · ${license.seats} ${t('seats')}` : ''}
                  {license.id ? ` · ${license.id}` : ''}
                </div>
              </div>
            )}

            {license?.licensed && license?.expired && (
              <div style={{
                padding: '0.8rem', borderRadius: 6, marginBottom: 10,
                border: '2px solid #f59e0b', backgroundColor: 'var(--surface2)',
              }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#f59e0b' }}>
                  ⚠ {t('licenseExpired')}
                </div>
                <div style={{ fontSize: 13, marginTop: 4 }}>
                  {license.to} — {t('expiredOn')} {new Date(license.expires).toLocaleDateString(locale)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                  {t('licenseExpiredHint')}
                </div>
              </div>
            )}

            {!license?.licensed && (
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>
                {t('licenseNonCommercial')}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                type="text"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                placeholder={t('licensePaste')}
                style={{
                  flex: 1, minWidth: 260, padding: '7px 10px', fontSize: 12,
                  fontFamily: 'monospace', borderRadius: 5,
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--surface)', color: 'var(--fg)',
                }}
              />
              <button onClick={saveLicense} disabled={!licenseKey.trim()}
                style={{
                  padding: '7px 14px', fontSize: 13, borderRadius: 5, border: 'none',
                  backgroundColor: licenseKey.trim() ? 'var(--accent)' : 'var(--border)',
                  color: 'var(--accentFg)', fontWeight: 600,
                  cursor: licenseKey.trim() ? 'pointer' : 'not-allowed',
                }}>
                {license?.licensed ? t('licenseReplace') : t('licenseActivate')}
              </button>
              {license?.licensed && (
                <button onClick={removeLicense}
                  style={{
                    padding: '7px 12px', fontSize: 13, borderRadius: 5,
                    border: '1px solid var(--border)', background: 'transparent',
                    color: '#ef4444', cursor: 'pointer',
                  }}>
                  {t('delete')}
                </button>
              )}
            </div>

            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
              {t('licenseHint')}
            </div>
          </div>

          {/* Aggiornamenti */}
          <div style={{
            backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '1rem', marginBottom: '1rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>⬆ {t('updates')}</h3>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                {t('installedVersion')}: <strong style={{ color: 'var(--fg)' }}>{appVersion || '—'}</strong>
              </span>
              <button onClick={() => checkUpdates(false)}
                style={{
                  padding: '4px 12px', fontSize: 12, cursor: 'pointer',
                  border: '1px solid var(--border)', borderRadius: 5,
                  background: 'transparent', color: 'var(--fg)',
                }}>
                ↻ {t('checkUpdates')}
              </button>
            </div>

            {latestRelease && versionCompare(appVersion, latestRelease.tag) < 0 && (
              <div style={{
                marginTop: 12, padding: '0.9rem', borderRadius: 6,
                border: '2px solid var(--accent)', backgroundColor: 'var(--surface2)',
              }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                  {t('updateAvailable')}: {latestRelease.tag}
                </div>
                {latestRelease.published && (
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
                    {new Date(latestRelease.published).toLocaleDateString(locale)}
                    {latestRelease.url && (
                      <> · <a href={latestRelease.url} target="_blank" rel="noreferrer"
                             style={{ color: 'var(--fg)' }}>{t('releaseNotes')}</a></>
                    )}
                  </div>
                )}
                {latestRelease.body && (
                  <pre style={{
                    fontSize: 12, color: 'var(--muted)', whiteSpace: 'pre-wrap',
                    maxHeight: 130, overflow: 'auto', margin: '0 0 10px 0',
                    fontFamily: 'inherit',
                  }}>{latestRelease.body.slice(0, 700)}</pre>
                )}

                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
                  {t('updateHowTo')}
                </div>
                <input
                  readOnly
                  value="cd ~/progetto.io && git pull && docker compose up -d --build"
                  onFocus={(e) => e.target.select()}
                  style={{
                    width: '100%', padding: '7px 9px', fontSize: 12, fontFamily: 'monospace',
                    border: '1px solid var(--border)', borderRadius: 5, boxSizing: 'border-box',
                    backgroundColor: 'var(--surface)', color: 'var(--fg)',
                  }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                  <button
                    onClick={() => navigator.clipboard?.writeText(
                      'cd ~/progetto.io && git pull && docker compose up -d --build'
                    ).then(() => alert(t('linkCopied')), () => {})}
                    style={{
                      padding: '5px 12px', fontSize: 12, cursor: 'pointer', borderRadius: 5,
                      border: 'none', backgroundColor: 'var(--accent)', color: 'var(--accentFg)',
                    }}>
                    {t('copyCommand')}
                  </button>
                  <span style={{ fontSize: 12, color: '#f59e0b' }}>⚠ {t('backupBeforeUpdate')}</span>
                </div>
              </div>
            )}

            {latestRelease && versionCompare(appVersion, latestRelease.tag) >= 0 && (
              <div style={{ marginTop: 10, fontSize: 13, color: 'var(--muted)' }}>
                ✅ {t('upToDate')}
              </div>
            )}
          </div>

          <div style={{
            backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '1rem',
          }}>
            <h3 style={{ marginTop: 0, fontSize: '1rem' }}>💾 {t('backupSection')}</h3>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <button onClick={handleBackup}
                style={{
                  padding: '7px 14px', backgroundColor: 'var(--accent)', color: 'var(--accentFg)',
                  border: 'none', borderRadius: 5, cursor: 'pointer', fontWeight: 600, fontSize: 13,
                }}>
                ⬇ {t('backupNow')}
              </button>

              <label style={{
                padding: '7px 14px', border: '1px solid #ef4444', color: '#ef4444',
                borderRadius: 5, cursor: restoring ? 'wait' : 'pointer', fontSize: 13,
              }}>
                ⬆ {restoring ? t('restoring') : t('restore')}
                <input type="file" accept="application/json" disabled={restoring}
                  onChange={(e) => { handleRestore(e.target.files?.[0]); e.target.value = ''; }}
                  style={{ display: 'none' }} />
              </label>

              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{t('backupHint')}</span>
            </div>
          </div>

          <div style={{
            backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '1rem', marginTop: '1rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>📝 {t('changeLog')}</h3>
              <button onClick={() => fetchAudit(auditPage)}
                title={t('refresh')}
                style={{
                  padding: '4px 12px', fontSize: 12, cursor: 'pointer',
                  border: '1px solid var(--border)', borderRadius: 5,
                  background: 'transparent', color: 'var(--fg)',
                }}>
                ↻ {t('refresh')}
              </button>
              {auditTotal > 0 && (
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {auditPage * 50 + 1}–{Math.min((auditPage + 1) * 50, auditTotal)} {t('of')} {auditTotal}
                </span>
              )}
            </div>

            {auditRows.length === 0 && (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                {t('noChanges')}
              </div>
            )}

            {auditRows.length > 0 && (
              <>
                <div style={{ maxHeight: 380, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 6 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr>
                        {[t('date'), t('user'), t('action'), t('entity'), t('details')].map((h, i) => (
                          <th key={i} style={{
                            textAlign: 'left', padding: '7px 10px', backgroundColor: 'var(--surface2)',
                            borderBottom: '2px solid var(--border)', position: 'sticky', top: 0,
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {auditRows.map(r => (
                        <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                            {new Date(r.created_at).toLocaleString(locale)}
                          </td>
                          <td style={{ padding: '6px 10px' }}>{r.user_name || '—'}</td>
                          <td style={{ padding: '6px 10px' }}>
                            <span style={{
                              padding: '1px 7px', borderRadius: 10, fontSize: 11,
                              border: '1px solid var(--border)',
                              color: r.action === 'delete' ? '#ef4444' : 'var(--fg)',
                            }}>{t('act_' + r.action) || r.action}</span>
                          </td>
                          <td style={{ padding: '6px 10px' }}>
                            {r.country ? countryFlag(r.country) + ' ' : ''}{r.entity_label || r.entity_type}
                          </td>
                          <td style={{ padding: '6px 10px', color: 'var(--muted)' }}>
                            {r.details ? Object.entries(r.details).map(([k, v]) =>
                              `${k}: ${Array.isArray(v) ? v.join(' → ') : v}`).join(' · ') : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button onClick={() => fetchAudit(Math.max(0, auditPage - 1))} disabled={auditPage === 0}
                    style={{
                      padding: '5px 12px', fontSize: 12, borderRadius: 5,
                      border: '1px solid var(--border)', background: 'transparent',
                      color: auditPage === 0 ? 'var(--muted)' : 'var(--fg)',
                      cursor: auditPage === 0 ? 'not-allowed' : 'pointer',
                    }}>{t('previousPage')}</button>
                  <button onClick={() => fetchAudit(auditPage + 1)}
                    disabled={(auditPage + 1) * 50 >= auditTotal}
                    style={{
                      padding: '5px 12px', fontSize: 12, borderRadius: 5,
                      border: '1px solid var(--border)', background: 'transparent',
                      color: (auditPage + 1) * 50 >= auditTotal ? 'var(--muted)' : 'var(--fg)',
                      cursor: (auditPage + 1) * 50 >= auditTotal ? 'not-allowed' : 'pointer',
                    }}>{t('nextPage')}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Accesso da telefono del tecnico */}
      {showDeviceModal && deviceTech && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: 'var(--surface)', color: 'var(--fg)',
            padding: '1.5rem', borderRadius: 8, width: '100%', maxWidth: 620,
            maxHeight: '86vh', overflowY: 'auto', border: '1px solid var(--border)',
          }}>
            <h3 style={{ marginTop: 0 }}>📱 {t('deviceAccess')} — {deviceTech.name}</h3>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 0 }}>{t('deviceHint')}</p>

            {/* Invito appena generato */}
            {newInvite && (
              <div style={{
                border: '2px solid var(--accent)', borderRadius: 6,
                padding: '0.9rem', marginBottom: '1rem', backgroundColor: 'var(--surface2)',
              }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
                  ⚠ {t('inviteOnce')}
                </div>
                <input
                  readOnly
                  value={`${window.location.origin}/technician/#${newInvite.code}`}
                  onFocus={(e) => e.target.select()}
                  style={{
                    width: '100%', padding: '7px 9px', fontSize: 12, fontFamily: 'monospace',
                    border: '1px solid var(--border)', borderRadius: 5, boxSizing: 'border-box',
                    backgroundColor: 'var(--surface)', color: 'var(--fg)',
                  }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                  <button
                    onClick={() => {
                      const link = `${window.location.origin}/technician/#${newInvite.code}`;
                      navigator.clipboard?.writeText(link).then(
                        () => alert(t('linkCopied')),
                        () => alert(link)
                      );
                    }}
                    style={{
                      padding: '5px 12px', fontSize: 12, cursor: 'pointer', borderRadius: 5,
                      border: 'none', backgroundColor: 'var(--accent)', color: 'var(--accentFg)',
                    }}>
                    {t('copyLink')}
                  </button>
                  {mailEnabled && deviceTech.email && (
                    <button onClick={sendInviteEmail}
                      style={{
                        padding: '5px 12px', fontSize: 12, cursor: 'pointer', borderRadius: 5,
                        border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg)',
                      }}>
                      ✉ {t('sendByEmail')}
                    </button>
                  )}
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {t('expiresOn')} {new Date(newInvite.expires_at).toLocaleString(locale)}
                  </span>
                </div>
              </div>
            )}

            <button onClick={createInvite}
              style={{
                padding: '7px 14px', marginBottom: '1rem',
                backgroundColor: newInvite ? 'transparent' : 'var(--accent)',
                color: newInvite ? 'var(--fg)' : 'var(--accentFg)',
                border: newInvite ? '1px solid var(--border)' : 'none',
                borderRadius: 5, cursor: 'pointer', fontWeight: 600, fontSize: 13,
              }}>
              {newInvite ? t('newInvite') : t('generateInvite')}
            </button>

            {/* Dispositivi */}
            <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem' }}>{t('activeDevices')}</h4>
            {devices.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>{t('noDevices')}</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    {[t('device'), t('activatedOn'), t('lastSeen'), ''].map((h, i) => (
                      <th key={i} style={{
                        textAlign: 'left', padding: '6px 8px', fontSize: 12,
                        backgroundColor: 'var(--surface2)', borderBottom: '2px solid var(--border)',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {devices.map(d => (
                    <tr key={d.id} style={{
                      borderBottom: '1px solid var(--border)',
                      opacity: d.revoked_at ? 0.5 : 1,
                    }}>
                      <td style={{ padding: '6px 8px' }}>
                        {d.device_name}
                        {d.revoked_at && (
                          <span style={{ color: '#ef4444', fontSize: 11, marginLeft: 6 }}>({t('revoked')})</span>
                        )}
                      </td>
                      <td style={{ padding: '6px 8px' }}>{new Date(d.activated_at).toLocaleDateString(locale)}</td>
                      <td style={{ padding: '6px 8px', color: 'var(--muted)' }}>
                        {d.last_seen ? new Date(d.last_seen).toLocaleString(locale) : '—'}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                        {!d.revoked_at && (
                          <button onClick={() => revokeDevice(d.id)}
                            style={{
                              background: 'transparent', border: '1px solid var(--border)',
                              borderRadius: 4, color: '#ef4444', cursor: 'pointer', padding: '2px 8px', fontSize: 12,
                            }}>
                            {t('revoke')}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div style={{ display: 'flex', marginTop: '1.2rem' }}>
              <button
                onClick={() => { setShowDeviceModal(false); setDeviceTech(null); setNewInvite(null); }}
                style={{
                  marginLeft: 'auto', padding: '7px 16px', background: 'transparent',
                  color: 'var(--fg)', border: '1px solid var(--border)', borderRadius: 5, cursor: 'pointer',
                }}>
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assenze del tecnico */}
      {showAbsenceModal && absenceTech && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: 'var(--surface)', color: 'var(--fg)',
            padding: '1.5rem', borderRadius: 8, width: '100%', maxWidth: 620,
            maxHeight: '86vh', overflowY: 'auto', border: '1px solid var(--border)',
          }}>
            <h3 style={{ marginTop: 0 }}>
              🏖 {t('absences')} — {absenceTech.name}
            </h3>

            {/* Elenco */}
            {absences.filter(x => x.technician_id === absenceTech.id).length === 0 ? (
              <div style={{ color: 'var(--muted)', fontSize: 13, margin: '1rem 0' }}>{t('noAbsences')}</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: '1rem' }}>
                <thead>
                  <tr>
                    {[t('period'), t('type'), t('daysCol'), ''].map((h, i) => (
                      <th key={i} style={{
                        textAlign: i === 2 ? 'right' : 'left', padding: '6px 8px',
                        backgroundColor: 'var(--surface2)', borderBottom: '2px solid var(--border)', fontSize: 12,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {absences
                    .filter(x => x.technician_id === absenceTech.id)
                    .sort((a, b) => new Date(b.start_date) - new Date(a.start_date))
                    .map(ab => (
                      <tr key={ab.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '6px 8px' }}>
                          {new Date(ab.start_date).toLocaleDateString(locale)}
                          {ab.start_half === 'PM' ? ` (${t('afternoon')})` : ''}
                          {' → '}
                          {new Date(ab.end_date).toLocaleDateString(locale)}
                          {ab.end_half === 'AM' ? ` (${t('morning')})` : ''}
                          {ab.note && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{ab.note}</div>}
                        </td>
                        <td style={{ padding: '6px 8px' }}>{t('abs_' + ab.type)}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right' }}>{actDurationDays(ab)}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button onClick={() => setEditingAbsence(ab)}
                            style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 4,
                                     color: 'var(--fg)', cursor: 'pointer', padding: '2px 6px', marginRight: 4 }}>
                            <Edit2 size={13} />
                          </button>
                          <button onClick={() => handleDeleteAbsence(ab.id)}
                            style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 4,
                                     color: '#ef4444', cursor: 'pointer', padding: '2px 6px' }}>
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}

            {/* Nuova o modifica */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <strong style={{ fontSize: 13 }}>
                {editingAbsence ? t('edit') : t('addAbsence')}
              </strong>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8, alignItems: 'flex-end' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--muted)' }}>{t('startDate')}</label>
                  <input type="date"
                    value={editingAbsence?.start_date ? formatDateForInput(editingAbsence.start_date) : (editingAbsence?.start_date || '')}
                    onChange={(e) => setEditingAbsence({ ...(editingAbsence || {}), start_date: e.target.value })}
                    style={{ padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 5,
                             backgroundColor: 'var(--surface)', color: 'var(--fg)' }} />
                  <select value={editingAbsence?.start_half || 'AM'}
                    onChange={(e) => setEditingAbsence({ ...(editingAbsence || {}), start_half: e.target.value })}
                    style={{ marginLeft: 4, padding: '5px', border: '1px solid var(--border)', borderRadius: 5,
                             backgroundColor: 'var(--surface)', color: 'var(--fg)' }}>
                    <option value="AM" style={{ color: 'var(--fg)', backgroundColor: 'var(--surface)' }}>{t('morning')}</option>
                    <option value="PM" style={{ color: 'var(--fg)', backgroundColor: 'var(--surface)' }}>{t('afternoon')}</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--muted)' }}>{t('endDate')}</label>
                  <input type="date"
                    value={editingAbsence?.end_date ? formatDateForInput(editingAbsence.end_date) : (editingAbsence?.end_date || '')}
                    onChange={(e) => setEditingAbsence({ ...(editingAbsence || {}), end_date: e.target.value })}
                    style={{ padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 5,
                             backgroundColor: 'var(--surface)', color: 'var(--fg)' }} />
                  <select value={editingAbsence?.end_half || 'PM'}
                    onChange={(e) => setEditingAbsence({ ...(editingAbsence || {}), end_half: e.target.value })}
                    style={{ marginLeft: 4, padding: '5px', border: '1px solid var(--border)', borderRadius: 5,
                             backgroundColor: 'var(--surface)', color: 'var(--fg)' }}>
                    <option value="AM" style={{ color: 'var(--fg)', backgroundColor: 'var(--surface)' }}>{t('morning')}</option>
                    <option value="PM" style={{ color: 'var(--fg)', backgroundColor: 'var(--surface)' }}>{t('afternoon')}</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--muted)' }}>{t('type')}</label>
                  <select value={editingAbsence?.type || 'vacation'}
                    onChange={(e) => setEditingAbsence({ ...(editingAbsence || {}), type: e.target.value })}
                    style={{ padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 5,
                             backgroundColor: 'var(--surface)', color: 'var(--fg)' }}>
                    {['vacation', 'sick', 'leave', 'training'].map(k => (
                      <option key={k} value={k} style={{ color: 'var(--fg)', backgroundColor: 'var(--surface)' }}>{t('abs_' + k)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <input type="text" placeholder={t('note')}
                value={editingAbsence?.note || ''}
                onChange={(e) => setEditingAbsence({ ...(editingAbsence || {}), note: e.target.value })}
                style={{ width: '100%', marginTop: 8, padding: '5px 8px', border: '1px solid var(--border)',
                         borderRadius: 5, backgroundColor: 'var(--surface)', color: 'var(--fg)', boxSizing: 'border-box' }} />

              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button
                  onClick={() => {
                    const a = editingAbsence || {};
                    if (!a.start_date || !a.end_date) { alert(t('dateRequired')); return; }
                    handleSaveAbsence({
                      technician_id: absenceTech.id,
                      start_date: a.start_date, end_date: a.end_date,
                      start_half: a.start_half || 'AM', end_half: a.end_half || 'PM',
                      type: a.type || 'vacation', note: a.note || null,
                    });
                  }}
                  style={{ padding: '7px 16px', backgroundColor: 'var(--accent)', color: 'var(--accentFg)',
                           border: 'none', borderRadius: 5, cursor: 'pointer', fontWeight: 600 }}>
                  {t('save')}
                </button>
                {editingAbsence && (
                  <button onClick={() => setEditingAbsence(null)}
                    style={{ padding: '7px 16px', background: 'transparent', color: 'var(--fg)',
                             border: '1px solid var(--border)', borderRadius: 5, cursor: 'pointer' }}>
                    {t('cancel')}
                  </button>
                )}
                <button
                  onClick={() => { setShowAbsenceModal(false); setEditingAbsence(null); setAbsenceTech(null); }}
                  style={{ marginLeft: 'auto', padding: '7px 16px', background: 'transparent', color: 'var(--fg)',
                           border: '1px solid var(--border)', borderRadius: 5, cursor: 'pointer' }}>
                  {t('close')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showUserModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'var(--surface)',
            padding: '2rem',
            borderRadius: '10px',
            width: '90%',
            maxWidth: '500px'
          }}>
            <h3 style={{ marginTop: 0 }}>{editingUser ? t('editUser') : t('newUser')}</h3>
            <form onSubmit={handleCreateUser}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>{t('name')}</label>
                <input
                  type="text"
                  value={editingUser ? editingUser.name : newUser.name}
                  onChange={(e) => editingUser ? setEditingUser({ ...editingUser, name: e.target.value }) : setNewUser({ ...newUser, name: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid var(--border)',
                    borderRadius: '5px',
                    boxSizing: 'border-box',
                    backgroundColor: 'var(--surface)',
                    color: 'var(--fg)'
                  }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>{t('email')}</label>
                <input
                  type="email"
                  value={editingUser ? editingUser.email : newUser.email}
                  onChange={(e) => editingUser ? setEditingUser({ ...editingUser, email: e.target.value }) : setNewUser({ ...newUser, email: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid var(--border)',
                    borderRadius: '5px',
                    boxSizing: 'border-box',
                    backgroundColor: 'var(--surface)',
                    color: 'var(--fg)'
                  }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                  Telefono <span style={{ fontWeight: 400, color: 'var(--muted)' }}>({t('optional')})</span>
                </label>
                <input
                  type="tel"
                  value={(editingUser ? editingUser.phone : newUser.phone) || ''}
                  onChange={(e) => editingUser ? setEditingUser({ ...editingUser, phone: e.target.value }) : setNewUser({ ...newUser, phone: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid var(--border)',
                    borderRadius: '5px',
                    boxSizing: 'border-box',
                    backgroundColor: 'var(--surface)',
                    color: 'var(--fg)'
                  }}
                />
              </div>
              {!editingUser && (
		<div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>{t('password')}</label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  required
                  minLength="6"
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid var(--border)',
                    borderRadius: '5px',
                    boxSizing: 'border-box',
                    backgroundColor: 'var(--surface)',
                    color: 'var(--fg)'
                  }}
                />
              </div>
		)}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>{t('role')}</label>
                <select
                  value={editingUser ? editingUser.role : newUser.role}
                  onChange={(e) => editingUser ? setEditingUser({ ...editingUser, role: e.target.value }) : setNewUser({ ...newUser, role: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid var(--border)',
                    borderRadius: '5px',
                    boxSizing: 'border-box',
                    backgroundColor: 'var(--surface)',
                    color: 'var(--fg)'
                  }}
                >
                  <option value="viewer" style={{ color: 'var(--fg)', backgroundColor: 'var(--surface)' }}>Viewer</option>
                  <option value="editor" style={{ color: 'var(--fg)', backgroundColor: 'var(--surface)' }}>Editor</option>
                  <option value="admin" style={{ color: 'var(--fg)', backgroundColor: 'var(--surface)' }}>Admin</option>
                </select>
              </div>

              {/* Aree assegnate: solo per gli editor. Gli admin scrivono ovunque,
                  i viewer non scrivono affatto, quindi per loro il campo non ha senso. */}
              {(editingUser ? editingUser.role : newUser.role) === 'editor' && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                    {t('assignedAreas')}
                  </label>
                  <div style={{
                    border: '1px solid var(--border)', borderRadius: 5, padding: '0.6rem',
                    maxHeight: 240, overflowY: 'auto', backgroundColor: 'var(--surface2)',
                  }}>
                    {EMEA_COUNTRIES.map(g => {
                      // Tutte le nazioni EMEA, non solo quelle con progetti esistenti:
                      // serve poter assegnare un'area prima che ci lavori qualcuno.
                      // Un puntino segnala dove ci sono gia' progetti.
                      return (
                        <div key={g.group} style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{g.group}</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {g.items.map(([cc, label]) => {
                              const sel = (editingUser ? (editingUser.countries || []) : newUser.countries).includes(cc);
                              return (
                                <button key={cc} type="button"
                                  onClick={() => {
                                    const cur = editingUser ? (editingUser.countries || []) : newUser.countries;
                                    const next = sel ? cur.filter(x => x !== cc) : [...cur, cc];
                                    if (editingUser) setEditingUser({ ...editingUser, countries: next });
                                    else setNewUser({ ...newUser, countries: next });
                                  }}
                                  title={label + (availableCountries.includes(cc) ? '' : ' — nessun progetto')}
                                  style={{
                                    padding: '4px 10px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                                    border: sel ? '1px solid var(--accent)' : '1px solid var(--border)',
                                    backgroundColor: sel ? 'var(--accent)' : 'var(--surface)',
                                    color: sel ? 'var(--accentFg)' : 'var(--fg)',
                                    opacity: sel || availableCountries.includes(cc) ? 1 : 0.55,
                                  }}>
                                  {countryFlag(cc)} {cc}{availableCountries.includes(cc) ? ' •' : ''}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
                    {((editingUser ? (editingUser.countries || []) : newUser.countries).length === 0)
                      ? t('noAreasWarning')
                      : t('areasHint')}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accentFg)',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  {editingUser ? 'Salva Modifiche' : 'Crea Utente'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowUserModal(false);
                    setNewUser({ email: '', password: '', name: '', role: 'viewer', phone: '' });
                  }}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    backgroundColor: 'var(--muted)',
                    color: 'var(--accentFg)',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  {t('cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>

      )}
    </div>
  );
};

export default App;
