import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Users, Briefcase, Activity, LogOut, ChevronDown, ChevronRight, Edit2, Trash2, Plus, Save, Clock, User, Phone, Mail, Award } from 'lucide-react';
import axios from 'axios';

const API_URL = '/api';

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
  const leftColumnRef = useRef(null);
  const timelineRef = useRef(null);
  const handleTimelineScroll = (e) => {
    if (leftColumnRef.current) {
      leftColumnRef.current.scrollTop = e.target.scrollTop;
    }
  };
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [newUser, setNewUser] = useState({ email: '', password: '', name: '', role: 'viewer', phone: '' });

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
          phone: editingUser.phone,
          role: editingUser.role
        };
        await axios.put(`${API_URL}/users/${editingUser.id}`, userData);
      } else {
        // Crea nuovo utente
        await axios.post(`${API_URL}/users`, newUser);
      }
      fetchUsers();
      setShowUserModal(false);
      setEditingUser(null);
      setNewUser({ email: '', password: '', name: '', role: 'viewer', phone: '' });
    } catch (error) {
      console.error('Error saving user:', error);
      alert('Errore durante il salvataggio dell\'utente');
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
  
  const detectConflicts = () => {
    const conflicts = [];
    const technicianActivities = {};

    activities.forEach(activity => {
      if (!activity.technicians || activity.technicians.length === 0) return;

      const startDate = new Date(activity.start_date);
      const endDate = new Date(activity.end_date);

      activity.technicians.forEach(tech => {
        if (!technicianActivities[tech.id]) {
          technicianActivities[tech.id] = { name: tech.name, conflicts: [] };
        }

        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().split('T')[0];
          if (!technicianActivities[tech.id][dateStr]) {
            technicianActivities[tech.id][dateStr] = [];
          }
          technicianActivities[tech.id][dateStr].push(activity);
        }
      });
    });

    Object.keys(technicianActivities).forEach(techId => {
      const tech = technicianActivities[techId];
      Object.keys(tech).forEach(date => {
        if (date === 'name' || date === 'conflicts') return;
        const activitiesOnDate = tech[date];
        if (activitiesOnDate.length > 1) {
          conflicts.push({
            technicianId: techId,
            technicianName: tech.name,
            date: date,
            activities: activitiesOnDate
          });
        }
      });
    });

    return conflicts;
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
  };

  const formatDateForInput = (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatMonthYear = (date) => {
    return date.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  };

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

  const renderGanttChart = () => {
    const dates = viewMode === 'week' ? currentDates : getMonthDates(currentMonth);
    
    return (
      <div style={{ display: 'flex', height: 'calc(100vh - 200px)', overflow: 'hidden' }}>
        {/* Colonna Fissa Progetti/Attività */}
        <div style={{
          width: '300px',
          borderRight: '2px solid #e5e7eb',
          backgroundColor: '#f9fafb',
          flexShrink: 0,
          overflow: 'hidden'
        }}>
          {/* Header Fisso */}
          <div style={{
            position: 'sticky',
            top: 0,
            backgroundColor: '#f3f4f6',
            fontWeight: 'bold',
            borderBottom: '2px solid #e5e7eb',
            zIndex: 10,
            height: '50px',
            display: 'flex',
            alignItems: 'center'
          }}>
            <div>Progetto / Attività</div>
          </div>
          
          {/* Lista Progetti - SENZA SCROLL PROPRIO */}
          <div ref={leftColumnRef} style={{ overflowY: 'auto', overflowX: 'hidden', height: 'calc(100vh - 200px)' }}>
            {projects.map(project => (
              <div key={project.id}>
                {/* Riga Progetto */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '6px 8px',
                  backgroundColor: '#ffffff',
                  borderBottom: '1px solid #e5e7eb',
                  cursor: 'pointer',
                  fontWeight: '600',
                  height: '48px'
                }}
                onClick={() => toggleProject(project.id)}>
                  {project.expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <span style={{ marginLeft: '8px', color: project.color || '#3b82f6' }}>
                    {project.code} - {project.name}
                  </span>
                </div>
                
                {/* Righe Attività */}
                {project.expanded && activities
                  .filter(a => a.project_id === project.id)
                  .map(activity => {
                    const activityTechnicians = activity.technicians || [];
                    return (
                      <div key={activity.id} style={{
                        padding: '6px 8px',
                        backgroundColor: '#fafafa',
                        borderBottom: '1px solid #f0f0f0',
                        fontSize: '0.9rem',
                        height: '48px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center'
                      }}>
                        <div>{activity.name}</div>
			<div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '4px' }}>
  {activityTechnicians.length > 0 ? activityTechnicians.map(t => t.name).join(', ') : 'Non assegnato'}
</div>                        
                      </div>
                    );
                  })}
              </div>
            ))}
          </div>
        </div>

        {/* Area Scrollabile Gantt - CON SCROLL VERTICALE */}
        <div ref={timelineRef} onScroll={handleTimelineScroll} style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', height: 'calc(100vh - 200px)' }}>
          <div style={{ minWidth: `${dates.length * 100}px` }}>
            {/* Header Date - STICKY */}
            <div style={{
              position: 'sticky',
              top: 0,
              display: 'flex',
              backgroundColor: '#f3f4f6',
              borderBottom: '2px solid #e5e7eb',
              zIndex: 10
            }}>
              {dates.map((date, index) => (
                <div key={index} style={{
                  width: '100px',
                  textAlign: 'center',
                  fontWeight: 'bold',
                  borderRight: '1px solid #e5e7eb',
                  fontSize: '0.85rem',
                  height: '48px',
		  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  }}>
                  <div>{formatDate(date)}</div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                    {date.toLocaleDateString('it-IT', { weekday: 'short' })}
                  </div>
                </div>
              ))}
            </div>

            {/* Righe Gantt */}
            {projects.map(project => (
              <div key={project.id}>
                {/* Riga Progetto */}
                <div style={{
                  display: 'flex',
                  height: '48px',
                  backgroundColor: '#ffffff',
                  borderBottom: '1px solid #e5e7eb'
                }}>
                  {dates.map((date, index) => (
                    <div key={index} style={{
                      width: '100px',
                      borderRight: '1px solid #f0f0f0',
                      position: 'relative'
                    }} />
                  ))}
                </div>

                {/* Righe Attività */}
                {project.expanded && activities
                  .filter(a => a.project_id === project.id)
                  .map(activity => {
                    const activityTechnicians = activity.technicians || [];
                    return (
                      <div key={activity.id} style={{
                        display: 'flex',
                        height: '48px',
                        backgroundColor: '#fafafa',
                        borderBottom: '1px solid #f0f0f0',
                        position: 'relative'
                      }}>
                        {dates.map((date, index) => {
                          const dateStr = date.toISOString().split('T')[0];
                          const isInRange = isDateInRange(dateStr, activity.start_date, activity.end_date);
                          const hasConflict = activityTechnicians.some(tech => getTechnicianConflicts(tech.id, date));
                          
                          return (
                            <div key={index} style={{
                              width: '100px',
                              borderRight: '1px solid #f0f0f0',
                              position: 'relative',
                              padding: '8px 4px'
                            }}>
                              {isInRange && (
                                <div
                                  onClick={() => {
  setEditingActivity(activity);
  setSelectedTechnicians(activity.technicians?.map(t => t.id) || []);
  setShowEditModal(true);
}}
                                  style={{
                                    height: '32px',
                                    backgroundColor: hasConflict ? '#ef4444' : (project.color || '#3b82f6'),
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.75rem',
                                    color: 'white',
                                    fontWeight: '500',
                                    transition: 'all 0.2s',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'scale(1.05)';
                                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'scale(1)';
                                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                                  }}
                                  
                                >
                                  {activity.progress}%
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  if (showLogin) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '2rem',
          borderRadius: '10px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          width: '100%',
          maxWidth: '400px'
        }}>
          <h2 style={{ textAlign: 'center', marginBottom: '1.5rem', color: '#333' }}>
            Progetto.io - Login
          </h2>
          <form onSubmit={handleLogin}>
            <input
              type="email"
              placeholder="Email"
              value={loginData.email}
              onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
              required
              style={{
                width: '100%',
                padding: '12px',
                marginBottom: '1rem',
                border: '1px solid #ddd',
                borderRadius: '5px',
                fontSize: '1rem',
                boxSizing: 'border-box'
              }}
            />
            <input
              type="password"
              placeholder="Password"
              value={loginData.password}
              onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
              required
              style={{
                width: '100%',
                padding: '12px',
                marginBottom: '1rem',
                border: '1px solid #ddd',
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
                backgroundColor: '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                fontSize: '1rem',
                fontWeight: 'bold',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? 'Accesso in corso...' : 'Accedi'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '1rem',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h1 style={{ color: 'white', margin: 0, fontSize: '1.5rem' }}>Progetto.io</h1>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button
            onClick={() => setCurrentView('dashboard')}
            style={{
              background: currentView === 'dashboard' ? 'rgba(255,255,255,0.3)' : 'transparent',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              transition: 'all 0.3s'
            }}
          >
            📊 Dashboard
          </button>

          <button
            onClick={() => setCurrentView('projects')}
            style={{
              background: currentView === 'projects' ? 'rgba(255,255,255,0.3)' : 'transparent',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              transition: 'all 0.3s'
            }}
          >
            📁 Progetti
          </button>

          <button
            onClick={() => setCurrentView('activities')}
            style={{
              background: currentView === 'activities' ? 'rgba(255,255,255,0.3)' : 'transparent',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              transition: 'all 0.3s'
            }}
          >
            ✅ Attività
          </button>

          <button
            onClick={() => setCurrentView('technicians')}
            style={{
              background: currentView === 'technicians' ? 'rgba(255,255,255,0.3)' : 'transparent',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              transition: 'all 0.3s'
            }}
          >
            👥 Tecnici
          </button>

	{(user?.role === 'admin' || user?.role === 'editor') && (
          <button
            onClick={() => setCurrentView('conflicts')}
	style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: currentView === 'conflicts' ? 'rgba(220, 53, 69, 0.2)' : 'transparent',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = 'rgba(255,255,255,0.1)';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'transparent';
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#fef2f2';
              e.target.style.color = '#dc3545';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'white';
              e.target.style.color = '#374151';
            }}
          >
            ⚠️ Conflitti
          </button>
        )}

          {user?.role === 'admin' && (
            <button
              onClick={() => setCurrentView('users')}
              style={{
                background: currentView === 'users' ? 'rgba(255,255,255,0.3)' : 'transparent',
                color: 'white',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                transition: 'all 0.3s'
              }}
            >
              🔐 Utenti
            </button>
          )}

          <span style={{ color: 'white', fontWeight: '600' }}>
            {user?.name} ({user?.role})
          </span>

          <button
            onClick={handleLogout}
            style={{
              background: 'rgba(255,255,255,0.2)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.3)',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* Contenuto Principale */}
      <div style={{ padding: '2rem' }}>
        {currentView === 'dashboard' && (
          <div>
            {/* Controlli Vista */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
              backgroundColor: 'white',
              padding: '1rem',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <button
                  onClick={() => setViewMode('week')}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: viewMode === 'week' ? '#667eea' : '#e5e7eb',
                    color: viewMode === 'week' ? 'white' : '#333',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  Settimana
                </button>
                <button
                  onClick={() => setViewMode('month')}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: viewMode === 'month' ? '#667eea' : '#e5e7eb',
                    color: viewMode === 'month' ? 'white' : '#333',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  Mese
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
                    backgroundColor: '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer'
                  }}
                >
                  ◀ Precedente
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
                    backgroundColor: '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer'
                  }}
                >
                  Successivo ▶
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
                  Oggi
                </button>
              </div>
            </div>

            {/* Gantt Chart */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              overflow: 'hidden'
            }}>
              {renderGanttChart()}
            </div>
          </div>
        )}

        {currentView === 'projects' && (
          <div style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0 }}>Gestione Progetti</h2>
              {(user?.role === 'admin' || user?.role === 'editor') && (
                <button
                  onClick={() => {
                    setEditingProject({ code: '', name: '', color: '#3b82f6' });
                    setShowProjectModal(true);
                  }}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <Plus size={18} /> Nuovo Progetto
                </button>
              )}
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f3f4f6' }}>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Codice</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Nome</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Colore</th>
                  {(user?.role === 'admin' || user?.role === 'editor') && (
                    <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>Azioni</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {projects.map(project => (
                  <tr key={project.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '12px' }}>{project.code}</td>
                    <td style={{ padding: '12px' }}>{project.name}</td>
                    <td style={{ padding: '12px' }}>
                      <div style={{
                        width: '30px',
                        height: '30px',
                        backgroundColor: project.color,
                        borderRadius: '5px',
                        border: '1px solid #ddd'
                      }} />
                    </td>
                    {(user?.role === 'admin' || user?.role === 'editor') && (
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <button
                          onClick={() => {
                            setEditingProject(project);
                            setShowProjectModal(true);
                          }}
                          style={{
                            padding: '0.5rem',
                            backgroundColor: '#3b82f6',
                            color: 'white',
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
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0 }}>Gestione Attività</h2>
              {(user?.role === 'admin' || user?.role === 'editor') && (
                <button
                  onClick={() => {
                    setEditingActivity(null);
		    setSelectedTechnicians([]);
                    setShowActivityModal(true);
                  }}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <Plus size={18} /> Nuova Attività
                </button>
              )}
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f3f4f6' }}>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Nome</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Progetto</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Tecnico</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Data Inizio</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Data Fine</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Progresso</th>
                  {(user?.role === 'admin' || user?.role === 'editor') && (
                    <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>Azioni</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {activities.map(activity => {
                  const project = projects.find(p => p.id === activity.project_id);
                  const activityTechs = activity.technicians || [];
                  return (
                    <tr key={activity.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '12px' }}>{activity.name}</td>
                      <td style={{ padding: '12px' }}>{project?.name || '-'}</td>
                      <td style={{ padding: '12px' }}>{activityTechs.length > 0 ? activityTechs.map(t => t.name).join(', ') : '-'}</td>
                      <td style={{ padding: '12px' }}>{new Date(activity.start_date).toLocaleDateString('it-IT')}</td>
                      <td style={{ padding: '12px' }}>{new Date(activity.end_date).toLocaleDateString('it-IT')}</td>
                      <td style={{ padding: '12px' }}>{activity.progress}%</td>
                      {(user?.role === 'admin' || user?.role === 'editor') && (
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <button
                            onClick={() => {
                              setEditingActivity(activity);
                              setSelectedTechnicians(activity.technicians?.map(t => t.id) || []);
			      setShowActivityModal(true);
                            }}
                            style={{
                              padding: '0.5rem',
                              backgroundColor: '#3b82f6',
                              color: 'white',
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
                              onClick={() => handleDeleteActivity(activity.id)}
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {currentView === 'technicians' && (
          <div style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0 }}>Gestione Tecnici</h2>
              {(user?.role === 'admin' || user?.role === 'editor') && (
                <button
                  onClick={() => {
                    setEditingTechnician({ name: '', email: '', phone: '', specialization: '', color: '#3b82f6' });
                    setShowTechnicianModal(true);
                  }}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <Plus size={18} /> Nuovo Tecnico
                </button>
              )}
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f3f4f6' }}>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Nome</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Email</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Telefono</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Specializzazione</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Colore</th>
                  {(user?.role === 'admin' || user?.role === 'editor') && (
                    <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>Azioni</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {technicians.map(tech => (
                  <tr key={tech.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
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
                        border: '1px solid #ddd'
                      }} />
                    </td>
                    {(user?.role === 'admin' || user?.role === 'editor') && (
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <button
                          onClick={() => {
                            setEditingTechnician(tech);
                            setShowTechnicianModal(true);
                          }}
                          style={{
                            padding: '0.5rem',
                            backgroundColor: '#3b82f6',
                            color: 'white',
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
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0 }}>Gestione Utenti</h2>
              <button
                onClick={() => setShowUserModal(true)}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#667eea',
                  color: 'white',
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
                <tr style={{ backgroundColor: '#f3f4f6' }}>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Nome</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Email</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Telefono</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Ruolo</th>
                  <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '12px' }}>{u.name}</td>
                    <td style={{ padding: '12px' }}>{u.email}</td>
                    <td style={{ padding: '12px' }}>{u.phone}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '12px',
                        fontSize: '0.85rem',
                        fontWeight: '600',
                        backgroundColor: u.role === 'admin' ? '#fef3c7' : u.role === 'editor' ? '#dbeafe' : '#f3f4f6',
                        color: u.role === 'admin' ? '#92400e' : u.role === 'editor' ? '#1e40af' : '#374151'
                      }}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
  			<button
			    onClick={() => {
			      setEditingUser(u);
			      setShowUserModal(true);
			    }}
			    style={{
			      padding: '0.5rem',
			      backgroundColor: '#3b82f6',
			      color: 'white',
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
	
	{currentView === 'conflicts' && (
          <div style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <h2 style={{ marginBottom: '1.5rem', color: '#dc3545' }}>
              <i>⚠️</i> Conflitti Tecnici
            </h2>
            
            <div style={{
              backgroundColor: '#fff3cd',
              border: '1px solid #ffc107',
              borderRadius: '5px',
              padding: '1rem',
              marginBottom: '1.5rem'
            }}>
              <strong>ℹ️ Info:</strong> Questa pagina mostra i tecnici assegnati a più attività negli stessi giorni.
            </div>

            {(() => {
              const conflicts = detectConflicts();
              const byTechnician = {};
              
              conflicts.forEach(c => {
                if (!byTechnician[c.technicianId]) {
                  byTechnician[c.technicianId] = { name: c.technicianName, conflicts: [] };
                }
                byTechnician[c.technicianId].conflicts.push(c);
              });

              if (conflicts.length === 0) {
                return (
                  <div style={{
                    backgroundColor: '#d4edda',
                    border: '1px solid #c3e6cb',
                    borderRadius: '5px',
                    padding: '1rem',
                    color: '#155724'
                  }}>
                    ✅ Nessun conflitto trovato! Tutti i tecnici hanno assegnazioni coerenti.
                  </div>
                );
              }

              return Object.values(byTechnician).map(tech => (
                <div key={tech.name} style={{
                  border: '1px solid #dc3545',
                  borderLeft: '4px solid #dc3545',
                  borderRadius: '5px',
                  padding: '1.5rem',
                  marginBottom: '1.5rem',
                  backgroundColor: '#fff5f5'
                }}>
                  <h4 style={{ color: '#dc3545', marginBottom: '1rem' }}>
                    👤 {tech.name} 
                    <span style={{
                      marginLeft: '1rem',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '12px',
                      fontSize: '0.85rem'
                    }}>
                      {tech.conflicts.length} conflitt{tech.conflicts.length > 1 ? 'i' : 'o'}
                    </span>
                  </h4>
                  
                  {tech.conflicts.map((conflict, idx) => (
                    <div key={idx} style={{
                      border: '1px solid #ddd',
                      borderRadius: '5px',
                      padding: '1rem',
                      marginBottom: '1rem',
                      backgroundColor: 'white'
                    }}>
                      <h6 style={{ color: '#dc3545', marginBottom: '0.5rem' }}>
                        📅 {new Date(conflict.date).toLocaleDateString('it-IT', { 
                          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
                        })}
                      </h6>
                      <p style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Attività in conflitto:</p>
                      <ul style={{ listStyle: 'none', padding: 0 }}>
                        {conflict.activities.map(act => (
                          <li key={act.id} style={{
                            padding: '0.75rem',
                            marginBottom: '0.5rem',
                            border: '1px solid #e5e7eb',
                            borderRadius: '5px',
                            backgroundColor: '#f9fafb',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                          onClick={() => {
                            setEditingActivity(act);
                            setSelectedTechnicians(act.technicians?.map(t => t.id) || []);
                            setShowActivityModal(true);
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#e5e7eb';
                            e.currentTarget.style.borderColor = '#3b82f6';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#f9fafb';
                            e.currentTarget.style.borderColor = '#e5e7eb';
                          }}>
                            <strong>{act.name}</strong><br/>
                            <small style={{ color: '#6b7280' }}>
                              {new Date(act.start_date).toLocaleDateString('it-IT')} - 
                              {new Date(act.end_date).toLocaleDateString('it-IT')}
                            </small>
                            <span style={{
                              marginLeft: '0.5rem',
                              color: '#3b82f6',
                              fontSize: '0.85rem'
                            }}>
                              ✏️ Clicca per modificare
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ));
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
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '10px',
            width: '90%',
            maxWidth: '500px'
          }}>
            <h3 style={{ marginTop: 0 }}>{editingProject?.id ? 'Modifica Progetto' : 'Nuovo Progetto'}</h3>
            <form onSubmit={handleSaveProject}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Codice</label>
                <input
                  type="text"
                  value={editingProject?.code || ''}
                  onChange={(e) => setEditingProject({ ...editingProject, code: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ddd',
                    borderRadius: '5px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Nome</label>
                <input
                  type="text"
                  value={editingProject?.name || ''}
                  onChange={(e) => setEditingProject({ ...editingProject, name: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ddd',
                    borderRadius: '5px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Colore</label>
                <input
                  type="color"
                  value={editingProject?.color || '#3b82f6'}
                  onChange={(e) => setEditingProject({ ...editingProject, color: e.target.value })}
                  style={{
                    width: '100%',
                    height: '50px',
                    border: '1px solid #ddd',
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
                    backgroundColor: '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  Salva
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
                    backgroundColor: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  Annulla
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
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '10px',
            width: '90%',
            maxWidth: '500px'
          }}>
            <h3 style={{ marginTop: 0 }}>{editingTechnician?.id ? 'Modifica Tecnico' : 'Nuovo Tecnico'}</h3>
            <form onSubmit={handleSaveTechnician}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Nome</label>
                <input
                  type="text"
                  value={editingTechnician?.name || ''}
                  onChange={(e) => setEditingTechnician({ ...editingTechnician, name: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ddd',
                    borderRadius: '5px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Email</label>
                <input
                  type="email"
                  value={editingTechnician?.email || ''}
                  onChange={(e) => setEditingTechnician({ ...editingTechnician, email: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ddd',
                    borderRadius: '5px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Telefono</label>
                <input
                  type="tel"
                  value={editingTechnician?.phone || ''}
                  onChange={(e) => setEditingTechnician({ ...editingTechnician, phone: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ddd',
                    borderRadius: '5px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Specializzazione</label>
                <input
                  type="text"
                  value={editingTechnician?.specialization || ''}
                  onChange={(e) => setEditingTechnician({ ...editingTechnician, specialization: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ddd',
                    borderRadius: '5px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Colore</label>
                <input
                  type="color"
                  value={editingTechnician?.color || '#3b82f6'}
                  onChange={(e) => setEditingTechnician({ ...editingTechnician, color: e.target.value })}
                  style={{
                    width: '100%',
                    height: '50px',
                    border: '1px solid #ddd',
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
                    backgroundColor: '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  Salva
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
                    backgroundColor: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  Annulla
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
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '10px',
            width: '90%',
            maxWidth: '600px'
          }}>
            <h3 style={{ marginTop: 0 }}>{editingActivity?.id ? 'Modifica Attività' : 'Nuova Attività'}</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              handleSaveActivity({
                name: formData.get('name'),
                project_id: parseInt(formData.get('project_id')),
                technician_ids: selectedTechnicians,
                start_date: formData.get('start_date'),
                end_date: formData.get('end_date'),
                progress: parseInt(formData.get('progress'))
              });
            }}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Nome Attività</label>
                <input
                  name="name"
                  type="text"
                  defaultValue={editingActivity?.name || ''}
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ddd',
                    borderRadius: '5px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Progetto</label>
                <select
                  name="project_id"
                  defaultValue={editingActivity?.project_id || ''}
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ddd',
                    borderRadius: '5px',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="">Seleziona un progetto</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                  ))}
                </select>
              </div>




		<div style={{ marginBottom: '1rem' }}>
  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Tecnici</label>
  <div style={{ border: '1px solid #ddd', borderRadius: '5px', padding: '10px', maxHeight: '150px', overflowY: 'auto' }}>
    {technicians.map(tech => (
      <div key={tech.id} style={{ marginBottom: '5px' }}>
        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
          <input
  type="checkbox"
  name="technician_ids"
  value={tech.id}
  checked={selectedTechnicians.includes(tech.id)}
  onChange={(e) => {
    if (e.target.checked) {
      setSelectedTechnicians([...selectedTechnicians, tech.id]);
    } else {
      setSelectedTechnicians(selectedTechnicians.filter(id => id !== tech.id));
    }
  }}
  style={{ marginRight: '8px' }}
/>
          {tech.name}
        </label>
      </div>
    ))}
  </div>
</div>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Data Inizio</label>
                  <input
                    name="start_date"
                    type="date"
                    defaultValue={editingActivity?.start_date ? formatDateForInput(editingActivity.start_date) : ''}
                    required
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #ddd',
                      borderRadius: '5px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Data Fine</label>
                  <input
                    name="end_date"
                    type="date"
                    defaultValue={editingActivity?.end_date ? formatDateForInput(editingActivity.end_date) : ''}
                    required
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #ddd',
                      borderRadius: '5px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Progresso (%)</label>
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
                    border: '1px solid #ddd',
                    borderRadius: '5px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    backgroundColor: '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  Salva
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
                    backgroundColor: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  Annulla
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Utenti */}
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
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '10px',
            width: '90%',
            maxWidth: '500px'
          }}>
            <h3 style={{ marginTop: 0 }}>{editingUser ? 'Modifica Utente' : 'Nuovo Utente'}</h3>
            <form onSubmit={handleCreateUser}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Nome</label>
                <input
                  type="text"
                  value={editingUser ? editingUser.name : newUser.name}
                  onChange={(e) => editingUser ? setEditingUser({ ...editingUser, name: e.target.value }) : setNewUser({ ...newUser, name: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ddd',
                    borderRadius: '5px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Email</label>
                <input
                  type="email"
                  value={editingUser ? editingUser.email : newUser.email}
                  onChange={(e) => editingUser ? setEditingUser({ ...editingUser, email: e.target.value }) : setNewUser({ ...newUser, email: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ddd',
                    borderRadius: '5px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Telefono</label>
                <input
                  type="tel"
                  value={editingUser ? editingUser.phone : newUser.phone}
                  onChange={(e) => editingUser ? setEditingUser({ ...editingUser, phone: e.target.value }) : setNewUser({ ...newUser, phone: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ddd',
                    borderRadius: '5px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              {!editingUser && (
		<div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Password</label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  required
                  minLength="6"
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ddd',
                    borderRadius: '5px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
		)}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Ruolo</label>
                <select
                  value={editingUser ? editingUser.role : newUser.role}
                  onChange={(e) => editingUser ? setEditingUser({ ...editingUser, role: e.target.value }) : setNewUser({ ...newUser, role: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ddd',
                    borderRadius: '5px',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    backgroundColor: '#667eea',
                    color: 'white',
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
                    backgroundColor: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  Annulla
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
