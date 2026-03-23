import React, { useEffect, useRef } from 'react';

function GanttView({ projects, activities, technicians }) {
  const ganttContainer = useRef(null);

  useEffect(() => {
    if (ganttContainer.current) {
      // Pulisci il container
      ganttContainer.current.innerHTML = '';
      
      // Crea SVG per il Gantt
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '600');
      
      // Configura date
      const today = new Date();
      const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      const endDate = new Date(today.getFullYear(), today.getMonth() + 3, 0);
      const dayWidth = 30;
      const rowHeight = 40;
      const headerHeight = 60;
      
      // Calcola giorni totali
      const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
      
      // Disegna header con mesi e giorni
      for (let i = 0; i <= totalDays; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);
        
        // Linea verticale per ogni giorno
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', 250 + i * dayWidth);
        line.setAttribute('y1', 0);
        line.setAttribute('x2', 250 + i * dayWidth);
        line.setAttribute('y2', 600);
        line.setAttribute('stroke', '#e0e0e0');
        line.setAttribute('stroke-width', '1');
        svg.appendChild(line);
        
        // Numero del giorno
        if (i % 7 === 0) {
          const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          text.setAttribute('x', 250 + i * dayWidth + 15);
          text.setAttribute('y', 30);
          text.setAttribute('text-anchor', 'middle');
          text.setAttribute('font-size', '12');
          text.textContent = currentDate.getDate();
          svg.appendChild(text);
        }
      }
      
      // Disegna progetti e attività
      let yPosition = headerHeight;
      
      projects.forEach((project, projectIndex) => {
        // Riga del progetto
        const projectRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        projectRect.setAttribute('x', 0);
        projectRect.setAttribute('y', yPosition);
        projectRect.setAttribute('width', 250);
        projectRect.setAttribute('height', rowHeight);
        projectRect.setAttribute('fill', '#f0f0f0');
        projectRect.setAttribute('stroke', '#ccc');
        svg.appendChild(projectRect);
        
        // Nome progetto
        const projectText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        projectText.setAttribute('x', 10);
        projectText.setAttribute('y', yPosition + 25);
        projectText.setAttribute('font-weight', 'bold');
        projectText.setAttribute('font-size', '14');
        projectText.textContent = `${project.projectNumber} - ${project.name}`;
        svg.appendChild(projectText);
        
        yPosition += rowHeight;
        
        // Attività del progetto
        const projectActivities = activities.filter(a => a.projectId === project.id);
        
        projectActivities.forEach((activity) => {
          // Calcola posizione della barra
          const actStart = new Date(activity.startDate);
          const actEnd = new Date(activity.endDate);
          const startOffset = Math.max(0, Math.ceil((actStart - startDate) / (1000 * 60 * 60 * 24)));
          const duration = Math.ceil((actEnd - actStart) / (1000 * 60 * 60 * 24)) + 1;
          
          // Riga attività
          const activityRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          activityRect.setAttribute('x', 0);
          activityRect.setAttribute('y', yPosition);
          activityRect.setAttribute('width', 250);
          activityRect.setAttribute('height', rowHeight);
          activityRect.setAttribute('fill', 'white');
          activityRect.setAttribute('stroke', '#e0e0e0');
          svg.appendChild(activityRect);
          
          // Nome attività
          const activityText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          activityText.setAttribute('x', 20);
          activityText.setAttribute('y', yPosition + 25);
          activityText.setAttribute('font-size', '12');
          activityText.textContent = activity.name;
          svg.appendChild(activityText);
          
          // Barra Gantt
          const bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          bar.setAttribute('x', 250 + startOffset * dayWidth);
          bar.setAttribute('y', yPosition + 10);
          bar.setAttribute('width', duration * dayWidth);
          bar.setAttribute('height', 20);
          bar.setAttribute('fill', activity.status === 'completed' ? '#10B981' : '#3B82F6');
          bar.setAttribute('rx', '3');
          bar.setAttribute('cursor', 'pointer');
          svg.appendChild(bar);
          
          // Nome tecnico sulla barra
          const technician = technicians.find(t => t.id === activity.technicianId);
          if (technician) {
            const techText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            techText.setAttribute('x', 250 + startOffset * dayWidth + 5);
            techText.setAttribute('y', yPosition + 24);
            techText.setAttribute('font-size', '10');
            techText.setAttribute('fill', 'white');
            techText.setAttribute('pointer-events', 'none');
            techText.textContent = technician.name;
            svg.appendChild(techText);
          }
          
          yPosition += rowHeight;
        });
        
        // Spazio tra progetti
        yPosition += 10;
      });
      
      ganttContainer.current.appendChild(svg);
    }
  }, [projects, activities, technicians]);

  return (
    <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '20px', overflow: 'auto' }}>
      <div style={{ marginBottom: '20px' }}>
        <h3>Gantt Chart Interattivo</h3>
        <p style={{ color: '#666', fontSize: '14px' }}>
          Vista delle attività per i prossimi 3 mesi. Le barre blu sono in corso, quelle verdi sono completate.
        </p>
      </div>
      <div ref={ganttContainer} style={{ overflowX: 'auto', minHeight: '400px' }}></div>
    </div>
  );
}

export default GanttView;
