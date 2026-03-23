import React, { useState, useEffect } from 'react';

function GanttChart({ projects, activities, technicians, onActivityClick, canEdit }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  // Genera i giorni del mese
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];
    
    for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d));
    }
    return days;
  };

  const days = getDaysInMonth(currentMonth);
  
  // Naviga tra i mesi
  const goToPrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };
  
  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  // Calcola la posizione e larghezza di un'attività
  const getActivityPosition = (activity, days) => {
    const startDate = new Date(activity.startDate);
    const endDate = new Date(activity.endDate);
    const firstDay = days[0];
    const lastDay = days[days.length - 1];
    
    if (endDate < firstDay || startDate > lastDay) {
      return null; // L'attività non è visibile questo mese
    }
    
    const displayStart = startDate < firstDay ? firstDay : startDate;
    const displayEnd = endDate > lastDay ? lastDay : endDate;
    
    const startIndex = days.findIndex(d => 
      d.toDateString() === displayStart.toDateString()
    );
    const endIndex = days.findIndex(d => 
      d.toDateString() === displayEnd.toDateString()
    );
    
    if (startIndex === -1 || endIndex === -1) return null;
    
    const left = (startIndex / days.length) * 100;
    const width = ((endIndex - startIndex + 1) / days.length) * 100;
    
    return { left: `${left}%`, width: `${width}%` };
  };

  // Verifica conflitti
  const hasConflict = (activity) => {
    return activities.some(a => 
      a.id !== activity.id &&
      a.technicianId === activity.technicianId &&
      new Date(a.startDate) <= new Date(activity.endDate) &&
      new Date(a.endDate) >= new Date(activity.startDate)
    );
  };

  const monthNames = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
  ];

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      {/* Controlli navigazione */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <button 
          onClick={goToPrevMonth}
          style={{ padding: '8px 16px', backgroundColor: '#6B7280', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
        >
          ← Mese Precedente
        </button>
        <h3 style={{ margin: 0 }}>
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </h3>
        <button 
          onClick={goToNextMonth}
          style={{ padding: '8px 16px', backgroundColor: '#6B7280', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
        >
          Mese Successivo →
        </button>
      </div>

      {/* Gantt Chart */}
      <div style={{ minWidth: '1200px', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
        {/* Header con giorni */}
        <div style={{ display: 'flex', backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
          <div style={{ width: '250px', padding: '10px', fontWeight: 'bold', borderRight: '2px solid #e5e7eb' }}>
            Progetto / Attività
          </div>
          <div style={{ flex: 1, display: 'flex' }}>
            {days.map((day, idx) => (
              <div 
                key={idx}
                style={{ 
                  flex: 1, 
                  padding: '5px 2px', 
                  textAlign: 'center', 
                  borderRight: '1px solid #e5e7eb',
                  fontSize: '11px',
                  backgroundColor: day.getDay() === 0 || day.getDay() === 6 ? '#f3f4f6' : 'transparent'
                }}
              >
                <div style={{ fontWeight: 'bold' }}>{day.getDate()}</div>
                <div style={{ fontSize: '9px', color: '#6B7280' }}>
                  {['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'][day.getDay()]}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Progetti e Attività */}
        {projects.map(project => (
          <div key={project.id}>
            {/* Riga Progetto */}
            <div style={{ display: 'flex', backgroundColor: '#EBF8FF', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ 
                width: '250px', 
                padding: '12px', 
                fontWeight: 'bold',
                borderRight: '2px solid #e5e7eb',
                backgroundColor: '#DBEAFE'
              }}>
                {project.projectNumber} - {project.name}
                <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>
                  Manager: {project.manager}
                </div>
              </div>
              <div style={{ flex: 1, position: 'relative', minHeight: '50px' }}>
                {days.map((day, idx) => (
                  <div 
                    key={idx}
                    style={{ 
                      position: 'absolute',
                      left: `${(idx / days.length) * 100}%`,
                      width: `${100 / days.length}%`,
                      height: '100%',
                      borderRight: '1px solid #e5e7eb',
                      backgroundColor: day.getDay() === 0 || day.getDay() === 6 ? '#f9fafb' : 'transparent'
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Righe Attività */}
            {activities
              .filter(a => a.projectId === project.id)
              .map(activity => {
                const technician = technicians.find(t => t.id === activity.technicianId);
                const position = getActivityPosition(activity, days);
                const conflict = hasConflict(activity);
                
                return (
                  <div key={activity.id} style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
                    <div style={{ 
                      width: '250px', 
                      padding: '8px 8px 8px 24px',
                      borderRight: '2px solid #e5e7eb',
                      backgroundColor: '#f9fafb'
                    }}>
                      → {activity.name}
                      <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '2px' }}>
                        {technician?.name || 'Non assegnato'}
                      </div>
                    </div>
                    <div style={{ flex: 1, position: 'relative', height: '45px' }}>
                      {/* Griglia di sfondo */}
                      {days.map((day, idx) => (
                        <div 
                          key={idx}
                          style={{ 
                            position: 'absolute',
                            left: `${(idx / days.length) * 100}%`,
                            width: `${100 / days.length}%`,
                            height: '100%',
                            borderRight: '1px solid #f3f4f6',
                            backgroundColor: day.getDay() === 0 || day.getDay() === 6 ? '#fafafa' : 'transparent'
                          }}
                        />
                      ))}
                      
                      {/* Barra attività */}
                      {position && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '8px',
                            height: '28px',
                            left: position.left,
                            width: position.width,
                            backgroundColor: conflict ? '#EF4444' : 
                              activity.status === 'completed' ? '#10B981' :
                              activity.status === 'in_progress' ? '#3B82F6' : '#8B5CF6',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            padding: '0 8px',
                            color: 'white',
                            fontSize: '11px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                            cursor: 'pointer',
                            transition: 'transform 0.2s',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap'
                          }}
                          onMouseEnter={(e) => e.target.style.transform = 'scale(1.02)'}
                          onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                          title={`${activity.name} - ${technician?.name} (${activity.startDate} - ${activity.endDate})`}
                        >
                          {activity.progress > 0 && (
                            <div style={{
                              position: 'absolute',
                              left: 0,
                              top: 0,
                              bottom: 0,
                              width: `${activity.progress}%`,
                              backgroundColor: 'rgba(0,0,0,0.2)',
                              borderRadius: '4px 0 0 4px'
                            }} />
                          )}
                          <span style={{ position: 'relative', zIndex: 1 }}>
                            {activity.progress}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        ))}
      </div>

      {/* Legenda */}
      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
        <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Legenda:</h4>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '20px', height: '12px', backgroundColor: '#8B5CF6', borderRadius: '2px' }}></div>
            <span>Pianificata</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '20px', height: '12px', backgroundColor: '#3B82F6', borderRadius: '2px' }}></div>
            <span>In Corso</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '20px', height: '12px', backgroundColor: '#10B981', borderRadius: '2px' }}></div>
            <span>Completata</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '20px', height: '12px', backgroundColor: '#EF4444', borderRadius: '2px' }}></div>
            <span>Conflitto (tecnico su più progetti)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GanttChart;
