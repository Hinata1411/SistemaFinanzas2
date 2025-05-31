// src/MyCalendar.js
import React, { useState, useEffect, useRef } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/es';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './calendar.css';

moment.locale('es');
const localizer = momentLocalizer(moment);

const emptyEvent = {
  title:        '',
  description:  '',
  date:         '',
  startTime:    '',
  endTime:      '',
  priority:     'Media',
  alert:        false,
  alertTime:    'Al momento',
  alertChannel: 'Pestaña emergente',
  frequency:    'Nunca',
  category:     '',
  status:       'Pendiente'
};

// Helper para capitalizar la primera letra
const capitalize = str =>
  str.charAt(0).toUpperCase() + str.slice(1);

// Toolbar personalizado de React Big Calendar
function MyToolbar({ label, onNavigate, onView, openModal }) {
  const capitalizedLabel = capitalize(label);
  return (
    <div className="rbc-toolbar d-flex justify-content-between align-items-center mb-3">
      <div className="rbc-btn-group">
        <button className="btn btn-outline-secondary btn-sm me-1" onClick={() => onNavigate('PREV')}>‹</button>
        <button className="btn btn-outline-secondary btn-sm me-1" onClick={() => onNavigate('TODAY')}>Hoy</button>
        <button className="btn btn-outline-secondary btn-sm" onClick={() => onNavigate('NEXT')}>›</button>
      </div>
      <div className="rbc-toolbar-label fw-bold">{capitalizedLabel}</div>
      <div className="rbc-btn-group d-flex align-items-center">
        <button className="btn btn-outline-secondary btn-sm me-1" onClick={() => onView('month')}>Mes</button>
        <button className="btn btn-outline-secondary btn-sm me-1" onClick={() => onView('week')}>Semana</button>
        <button className="btn btn-outline-secondary btn-sm me-1" onClick={() => onView('day')}>Día</button>
        <button className="btn btn-outline-secondary btn-sm me-3" onClick={() => onView('agenda')}>Agenda</button>
        <button className="btn btn-primary btn-sm" onClick={openModal}>➕ Agregar Actividad</button>
      </div>
    </div>
  );
}

const MyCalendar = () => {
  const [events, setEvents]       = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editIndex, setEditIndex] = useState(null);
  const [newEvent, setNewEvent]   = useState(emptyEvent);

  // Para almacenar referencias a los popups abiertos
  const popupRefs = useRef({}); // { [eventoId]: windowReference }

  // 1) Cargar eventos desde localStorage al montar
  useEffect(() => {
    const saved = localStorage.getItem('events');
    if (saved) {
      const parsed = JSON.parse(saved).map(evt => ({
        ...evt,
        start: new Date(evt.start),
        end:   new Date(evt.end)
      }));
      setEvents(parsed);
    }
  }, []);

  // 2) Guardar eventos en localStorage cuando cambien
  useEffect(() => {
    localStorage.setItem(
      'events',
      JSON.stringify(
        events.map(evt => ({
          ...evt,
          start: evt.start.toISOString(),
          end:   evt.end.toISOString()
        }))
      )
    );
  }, [events]);

  // Maneja cambios en inputs del modal
  const handleChange = field => e => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setNewEvent(evt => ({ ...evt, [field]: val }));
  };

  // 3) Abrir modal para agregar
  const openAddModal = () => {
    setIsEditing(false);
    setNewEvent(emptyEvent);
    setModalOpen(true);
  };

  // 4) Abrir modal para editar (precarga datos)
  const openEditModal = (event, index) => {
    const date      = moment(event.start).format('YYYY-MM-DD');
    const startTime = moment(event.start).format('HH:mm');
    const endTime   = moment(event.end).format('HH:mm');

    setIsEditing(true);
    setEditIndex(index);
    setNewEvent({
      ...event,
      date,
      startTime,
      endTime
    });
    setModalOpen(true);
  };

  // 5) Guardar evento (nuevo o editado) + programar popup emergente
  const handleSave = () => {
    const {
      title,
      description,
      date,
      startTime,
      endTime,
      priority,
      alert,
      alertTime,
      frequency,
      category,
      status
    } = newEvent;

    if (!title || !date || !startTime || !endTime) {
      return window.alert('Completa título, fecha e horas');
    }

    // 5.1) Calcula start y end como Date
    const start = new Date(`${date}T${startTime}`);
    const end   = new Date(`${date}T${endTime}`);
    const evt   = { ...newEvent, start, end };

    // 5.2) Actualiza lista de eventos
    let eventoId;
    if (isEditing) {
      // Mantenemos el ID como el índice para referencia en popupRefs
      eventoId = editIndex;
      setEvents(evts => {
        const copy = [...evts];
        copy[editIndex] = evt;
        return copy;
      });
    } else {
      setEvents(evts => {
        const newList = [...evts, evt];
        eventoId = newList.length - 1;
        return newList;
      });
    }
    setModalOpen(false);

    // 5.3) Programar popup emergente si alert === true
    if (alert) {
      // Calcula fecha/hora de alerta según alertTime
      let alertDate = new Date(start);
      switch (alertTime) {
        case '10 minutos antes':
          alertDate.setMinutes(alertDate.getMinutes() - 10);
          break;
        case '1 hora antes':
          alertDate.setHours(alertDate.getHours() - 1);
          break;
        case '1 día antes':
          alertDate.setDate(alertDate.getDate() - 1);
          break;
        case '3 días antes':
          alertDate.setDate(alertDate.getDate() - 3);
          break;
        default:
          // 'Al momento'
          break;
      }

      const now = Date.now();
      const diffMs = alertDate.getTime() - now;

      // Función para abrir o actualizar el popup
      const showPopup = () => {
        const popupName = `popup_event_${eventoId}`;
        const width = 400;
        const height = 250;
        const left = window.screenX + (window.innerWidth - width) / 2;
        const top = window.screenY + (window.innerHeight - height) / 3;

        let popup;
        // Si ya existe un popup abierto para este evento y no está cerrado, reutilízalo
        if (popupRefs.current[eventoId] && !popupRefs.current[eventoId].closed) {
          popup = popupRefs.current[eventoId];
        } else {
          // Abre un nuevo popup en blanco
          popup = window.open(
            '',
            popupName,
            `width=${width},height=${height},left=${left},top=${top}`
          );
          popupRefs.current[eventoId] = popup;
        }

        // Si la ventana se pudo abrir, escribimos el contenido
        if (popup) {
          // Contenido HTML sencillo
          popup.document.title = `Recordatorio: ${title}`;
          popup.document.body.style.margin = '0';
          popup.document.body.style.fontFamily = 'Arial, sans-serif';
          popup.document.body.style.display = 'flex';
          popup.document.body.style.flexDirection = 'column';
          popup.document.body.style.justifyContent = 'center';
          popup.document.body.style.alignItems = 'center';
          popup.document.body.style.height = '100vh';
          popup.document.body.style.backgroundColor = '#f8f9fa';

          popup.document.body.innerHTML = `
            <div style="text-align:center; padding: 1rem;">
              <h2 style="margin-bottom: 0.5rem;">🔔 Recordatorio</h2>
              <h4 style="margin-top:0; margin-bottom:1rem;">${title}</h4>
              <p style="margin:0; font-size:1rem;">${description || ''}</p>
              <button id="closeBtn" style="
                margin-top: 1.5rem;
                padding: 8px 16px;
                font-size: 1rem;
                background-color: #007bff;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
              ">Cerrar</button>
            </div>
          `;

          // Botón “Cerrar” que cierra la ventana popup
          const closeBtn = popup.document.getElementById('closeBtn');
          closeBtn.onclick = () => popup.close();

          // Traer la ventana popup al frente
          popup.focus();
        } else {
          // Si no se pudo abrir (popup bloqueado), como fallback usamos un alert normal
          window.alert(`🔔 Recordatorio: ${title}\n${description || ''}`);
        }
      };

      if (diffMs > 0) {
        setTimeout(showPopup, diffMs);
        console.log(
          `Popup programado para ${alertDate.toLocaleString()} (faltan ${diffMs} ms)`
        );
      } else {
        // Si el momento ya pasó, mostrar popup de inmediato
        showPopup();
      }
    }
  };

  // 6) Eliminar evento en edición
  const handleDelete = () => {
    if (isEditing) {
      // Si existe un popup para este evento, ciérralo
      if (popupRefs.current[editIndex] && !popupRefs.current[editIndex].closed) {
        popupRefs.current[editIndex].close();
      }

      setEvents(evts => evts.filter((_, i) => i !== editIndex));
      setModalOpen(false);
    }
  };

  return (
    <div className="p-3">
      {/* Calendario con toolbar personalizado */}
      <div className="calendar-container">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          defaultView="month"
          views={['month', 'week', 'day', 'agenda']}
          style={{ height: 500 }}
          components={{
            toolbar: toolbarProps => (
              <MyToolbar {...toolbarProps} openModal={openAddModal} />
            )
          }}
          onSelectEvent={event => {
            const idx = events.findIndex(e =>
              e.start.getTime() === event.start.getTime() &&
              e.end.getTime()   === event.end.getTime() &&
              e.title          === event.title
            );
            if (idx > -1) openEditModal(event, idx);
          }}
          dayPropGetter={date => {
            const today = new Date();
            if (
              date.getDate()     === today.getDate() &&
              date.getMonth()    === today.getMonth() &&
              date.getFullYear() === today.getFullYear()
            ) {
              return { className: 'today-cell' };
            }
            return {};
          }}
          messages={{
            date: 'Fecha',
            time: 'Hora',
            event: 'Evento',
            previous: '‹',
            next: '›',
            today: 'Hoy',
            month: 'Mes',
            week: 'Semana',
            day: 'Día',
            agenda: 'Agenda',
            showMore: total => `+ ${total} más`
          }}
        />
      </div>

      {/* Modal de Bootstrap para agregar/editar */}
      {modalOpen && (
        <>
          <div className="modal-backdrop show"></div>
          <div className="modal d-block" tabIndex={-1} role="dialog">
            <div className="modal-dialog" role="document">
              <div className="modal-content">

                {/* Header */}
                <div className="modal-header">
                  <h5 className="modal-title">
                    {isEditing ? 'Editar Actividad' : 'Agregar Actividad'}
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setModalOpen(false)}
                  />
                </div>

                {/* Body */}
                <div className="modal-body">
                  {/* Título */}
                  <div className="mb-2">
                    <label className="form-label">Título</label>
                    <input
                      type="text"
                      className="form-control"
                      value={newEvent.title}
                      onChange={handleChange('title')}
                    />
                  </div>

                  {/* Descripción */}
                  <div className="mb-2">
                    <label className="form-label">Descripción</label>
                    <textarea
                      className="form-control"
                      rows={2}
                      value={newEvent.description}
                      onChange={handleChange('description')}
                    />
                  </div>

                  {/* Fecha / Horas */}
                  <div className="row mb-2">
                    <div className="col">
                      <label className="form-label">Fecha</label>
                      <input
                        type="date"
                        className="form-control"
                        value={newEvent.date}
                        onChange={handleChange('date')}
                      />
                    </div>
                    <div className="col">
                      <label className="form-label">Hora inicio – fin</label>
                      <div className="d-flex">
                        <input
                          type="time"
                          className="form-control"
                          value={newEvent.startTime}
                          onChange={handleChange('startTime')}
                        />
                        <span className="mx-2 align-self-center">–</span>
                        <input
                          type="time"
                          className="form-control"
                          value={newEvent.endTime}
                          onChange={handleChange('endTime')}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Prioridad */}
                  <div className="mb-2">
                    <label className="form-label">Prioridad</label>
                    <select
                      className="form-select"
                      value={newEvent.priority}
                      onChange={handleChange('priority')}
                    >
                      <option value="Alta">Alta 🔴</option>
                      <option value="Media">Media 🟠</option>
                      <option value="Baja">Baja 🟢</option>
                    </select>
                  </div>

                  {/* Alerta */}
                  <div className="form-check mb-2">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id="alertCheck"
                      checked={newEvent.alert}
                      onChange={handleChange('alert')}
                    />
                    <label className="form-check-label" htmlFor="alertCheck">
                      ¿Deseas recibir alerta?
                    </label>
                  </div>
                  {newEvent.alert && (
                    <div className="mb-2">
                      <label className="form-label">Momento alerta</label>
                      <select
                        className="form-select"
                        value={newEvent.alertTime}
                        onChange={handleChange('alertTime')}
                      >
                        <option value="Al momento">Al momento</option>
                        <option value="10 minutos antes">10 minutos antes</option>
                        <option value="1 hora antes">1 hora antes</option>
                        <option value="1 día antes">1 día antes</option>
                        <option value="3 días antes">3 días antes</option>
                      </select>
                    </div>
                  )}

                  {/* Frecuencia */}
                  <div className="mb-2">
                    <label className="form-label">Repetición</label>
                    <select
                      className="form-select"
                      value={newEvent.frequency}
                      onChange={handleChange('frequency')}
                    >
                      <option value="Nunca">Nunca</option>
                      <option value="Diario">Diario</option>
                      <option value="Semanal">Semanal</option>
                      <option value="Mensual">Mensual</option>
                    </select>
                  </div>

                  {/* Categoría */}
                  <div className="mb-2">
                    <label className="form-label">Categoría</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder='Ej. "Trabajo", "Personal"'
                      value={newEvent.category}
                      onChange={handleChange('category')}
                    />
                  </div>

                  {/* Estado */}
                  <div className="mb-2">
                    <label className="form-label">Estado</label>
                    <select
                      className="form-select"
                      value={newEvent.status}
                      onChange={handleChange('status')}
                    >
                      <option value="Pendiente">Pendiente</option>
                      <option value="En curso">En curso</option>
                      <option value="Completado">Completado</option>
                    </select>
                  </div>
                </div>

                {/* Footer del modal */}
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setModalOpen(false)}
                  >
                    Cancelar
                  </button>
                  {isEditing && (
                    <button
                      type="button"
                      className="btn btn-danger me-auto"
                      onClick={handleDelete}
                    >
                      🗑 Eliminar
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-success"
                    onClick={handleSave}
                  >
                    {isEditing ? 'Actualizar' : 'Guardar'}
                  </button>
                </div>

              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MyCalendar;
