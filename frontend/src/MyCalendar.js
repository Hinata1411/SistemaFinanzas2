// src/MyCalendar.js
import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/es';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './MyCalendar.css';

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
  status:       'Pendiente',
  visibility:   'all',
  branchId:     '',
  ownerEmail:   ''
};

// Helper para capitalizar la primera letra
const capitalize = str => str.charAt(0).toUpperCase() + str.slice(1);

// Toolbar personalizado de React Big Calendar
function MyToolbar({ label, onNavigate, onView, /* openModal, canAdd, */ showAddButton }) {
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
        {/* {canAdd && showAddButton && (
          <button className="btn btn-primary btn-sm" onClick={openModal}>➕ Agregar Actividad</button>
        )} */}
        {showAddButton ? null : null}
      </div>
    </div>
  );
}

const MyCalendar = forwardRef(({ showAddButton = true }, ref) => {
  const [events, setEvents]       = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editIndex, setEditIndex] = useState(null);
  const [newEvent, setNewEvent]   = useState(emptyEvent);

  // Rol y contexto actual
  const role = (localStorage.getItem('role') || 'viewer').toLowerCase();
  const isAdmin = role === 'admin';
  const currentEmail = localStorage.getItem('email') || '';
  // 👇 lee la sucursal activa que setea Finanzas (para filtrar y preseleccionar)
  const activeSucursalId = (localStorage.getItem('activeSucursalId') || '').toLowerCase();

  // Sucursales para el select (opcional, desde localStorage)
  let sucursales = [];
  try {
    const raw = localStorage.getItem('sucursales');
    if (raw) sucursales = JSON.parse(raw);
  } catch { /* noop */ }

  // Para almacenar referencias a los popups abiertos
  const popupRefs = useRef({}); // { [eventoId]: windowReference }

  // 1) Cargar eventos desde localStorage al montar
  useEffect(() => {
    const saved = localStorage.getItem('events');
    if (saved) {
      const parsed = JSON.parse(saved).map(evt => ({
        visibility: 'all',
        branchId: '',
        ownerEmail: '',
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
    if (!isAdmin) return; // viewers no agregan
    setIsEditing(false);
    setNewEvent({
      ...emptyEvent,
      ownerEmail: currentEmail,
      // si el filtro está en sucursal específica, la preseleccionamos
      branchId: (activeSucursalId && activeSucursalId !== 'all') ? activeSucursalId : ''
    });
    setModalOpen(true);
  };

  // Expone el método al padre
  useImperativeHandle(ref, () => ({
    openAddModal
  }));

  // 4) Abrir modal para editar (precarga datos)
  const openEditModal = (event, index) => {
    if (!isAdmin) return; // viewers no editan
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
      title, description, date, startTime, endTime, priority, alert,
      alertTime, frequency, category, status, visibility, branchId
    } = newEvent;

    if (!title || !date || !startTime || !endTime) {
      return window.alert('Completa título, fecha e horas');
    }
    // si la visibilidad es por sucursal y NO hay sucursal en el evento y el filtro global está en "all" ⇒ pedimos sucursal
    if (visibility === 'branch' && !branchId && (!activeSucursalId || activeSucursalId === 'all')) {
      return window.alert('Selecciona una sucursal para la visibilidad por sucursal.');
    }

    const start = new Date(`${date}T${startTime}`);
    const end   = new Date(`${date}T${endTime}`);

    // normalizamos branchId usando el filtro actual si aplica
    const normalizedBranchId =
      visibility === 'branch'
        ? (branchId || ((activeSucursalId && activeSucursalId !== 'all') ? activeSucursalId : ''))
        : '';

    const evt   = {
      ...newEvent,
      start,
      end,
      branchId: normalizedBranchId,
      ownerEmail: newEvent.ownerEmail || currentEmail
    };

    let eventoId;
    if (isEditing) {
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

    if (alert) {
      let alertDate = new Date(start);
      switch (alertTime) {
        case '10 minutos antes': alertDate.setMinutes(alertDate.getMinutes() - 10); break;
        case '1 hora antes':     alertDate.setHours(alertDate.getHours() - 1); break;
        case '1 día antes':      alertDate.setDate(alertDate.getDate() - 1); break;
        case '3 días antes':     alertDate.setDate(alertDate.getDate() - 3); break;
        default: break;
      }

      const now = Date.now();
      const diffMs = alertDate.getTime() - now;

      const showPopup = () => {
        const popupName = `popup_event_${eventoId}`;
        const width = 400;
        const height = 250;
        const left = window.screenX + (window.innerWidth - width) / 2;
        const top = window.screenY + (window.innerHeight - height) / 3;

        let popup;
        if (popupRefs.current[eventoId] && !popupRefs.current[eventoId].closed) {
          popup = popupRefs.current[eventoId];
        } else {
          popup = window.open('', popupName, `width=${width},height=${height},left=${left},top=${top}`);
          popupRefs.current[eventoId] = popup;
        }

        if (popup) {
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

          const closeBtn = popup.document.getElementById('closeBtn');
          closeBtn.onclick = () => popup.close();
          popup.focus();
        } else {
          window.alert(`🔔 Recordatorio: ${title}\n${description || ''}`);
        }
      };

      if (diffMs > 0) {
        setTimeout(showPopup, diffMs);
        console.log(`Popup programado para ${alertDate.toLocaleString()} (faltan ${diffMs} ms)`);
      } else {
        showPopup();
      }
    }
  };

  // 6) Eliminar evento en edición
  const handleDelete = () => {
    if (isEditing) {
      if (popupRefs.current[editIndex] && !popupRefs.current[editIndex].closed) {
        popupRefs.current[editIndex].close();
      }
      setEvents(evts => evts.filter((_, i) => i !== editIndex));
      setModalOpen(false);
    }
  };

  // === FILTRADO por sucursal/usuario (sin tocar layout) ===
  const filteredEvents = events.filter(evt => {
    const vis = (evt.visibility || 'all');
    const evtBranch = (evt.branchId || '').toLowerCase();

    // Filtro "todas" (o vacío)
    if (activeSucursalId === 'all' || activeSucursalId === '') {
      if (isAdmin) return true;                 // admin ve todo
      if (vis === 'all') return true;           // globales
      if (vis === 'branch') return true;        // todas las sucursales cuando filtro es "todas"
      if (vis === 'mine') return (evt.ownerEmail || '') === currentEmail;
      return false;
    }

    // Filtro en sucursal específica
    if (vis === 'all') return true;                         // globales
    if (vis === 'branch') return evtBranch === activeSucursalId; // sucursal coincide
    if (vis === 'mine') return (evt.ownerEmail || '') === currentEmail; // personales
    return false;
  });

  return (
    <div className="p-3">
      <div className="calendar-container">
        <Calendar
          localizer={localizer}
          events={filteredEvents}
          startAccessor="start"
          endAccessor="end"
          defaultView="month"
          views={['month', 'week', 'day', 'agenda']}
          style={{ height: 500 }}
          components={{
            toolbar: toolbarProps => (
              <MyToolbar
                {...toolbarProps}
                /* openModal={openAddModal}
                canAdd={isAdmin} */
                showAddButton={showAddButton}
              />
            )
          }}
          onSelectEvent={event => {
            if (!isAdmin) return;
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

                  {/* Visibilidad */}
                  <div className="mb-3">
                    <label className="form-label d-block">Visibilidad de actividad</label>

                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="visibility"
                        id="visMine"
                        value="mine"
                        checked={newEvent.visibility === 'mine'}
                        onChange={handleChange('visibility')}
                      />
                      <label className="form-check-label" htmlFor="visMine">
                        Solo para mi
                      </label>
                    </div>

                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="visibility"
                        id="visAll"
                        value="all"
                        checked={newEvent.visibility === 'all'}
                        onChange={handleChange('visibility')}
                      />
                      <label className="form-check-label" htmlFor="visAll">
                        Todos
                      </label>
                    </div>

                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="visibility"
                        id="visBranch"
                        value="branch"
                        checked={newEvent.visibility === 'branch'}
                        onChange={e => {
                          const val = e.target.value;
                          setNewEvent(evt => ({
                            ...evt,
                            visibility: val,
                            branchId: evt.branchId || (activeSucursalId && activeSucursalId !== 'all' ? activeSucursalId : '')
                          }));
                        }}
                      />
                      <label className="form-check-label" htmlFor="visBranch">
                        Por sucursal
                      </label>
                    </div>

                    {newEvent.visibility === 'branch' && (
                      <div className="mt-2">
                        <label className="form-label">Sucursal</label>
                        <select
                          className="form-select"
                          value={newEvent.branchId}
                          onChange={handleChange('branchId')}
                        >
                          <option value="">— Selecciona sucursal —</option>
                          {Array.isArray(sucursales) && sucursales.map(s => {
                            const labelNombre = s.nombre || s.name || s.id;
                            const labelUbi = s.ubicacion || s.location || '';
                            const label = labelUbi ? `${labelNombre} — ${labelUbi}` : labelNombre;
                            return (
                              <option key={s.id} value={s.id}>
                                {label}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    )}
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
});

export default MyCalendar;
