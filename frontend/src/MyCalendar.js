// src/MyCalendar.js
import React, { useState, useEffect } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './calendar.css'; // tus estilos personalizados

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
  alertChannel: 'Notificación en pantalla',
  frequency:    'Nunca',
  category:     '',
  status:       'Pendiente'
};

const MyCalendar = () => {
  const [events, setEvents]       = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editIndex, setEditIndex] = useState(null);
  const [newEvent, setNewEvent]   = useState(emptyEvent);

  // Al montar, cargamos del localStorage
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

  // Al cambiar events, guardamos en localStorage
  useEffect(() => {
    localStorage.setItem('events',
      JSON.stringify(events.map(evt => ({
        ...evt,
        start: evt.start.toISOString(),
        end:   evt.end.toISOString()
      })))
    );
  }, [events]);

  // Maneja cambios de inputs
  const handleChange = field => e => {
    const val = e.target.type === 'checkbox'
      ? e.target.checked
      : e.target.value;
    setNewEvent(evt => ({ ...evt, [field]: val }));
  };

  // Abrir modal en modo "Agregar"
  const openAddModal = () => {
    setIsEditing(false);
    setNewEvent(emptyEvent);
    setModalOpen(true);
  };

  // Abrir modal en modo "Editar", precargando datos
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

  // Guardar evento nuevo o editado
  const handleSave = () => {
    const { title, date, startTime, endTime } = newEvent;
    if (!title || !date || !startTime || !endTime) {
      return alert('Completa título, fecha e horas');
    }
    const start = new Date(`${date}T${startTime}`);
    const end   = new Date(`${date}T${endTime}`);
    const evt   = { ...newEvent, start, end };

    if (isEditing) {
      setEvents(evts => {
        const copy = [...evts];
        copy[editIndex] = evt;
        return copy;
      });
    } else {
      setEvents(evts => ([...evts, evt]));
    }
    setModalOpen(false);
  };

  // Eliminar evento en edición
  const handleDelete = () => {
    if (isEditing) {
      setEvents(evts => evts.filter((_, i) => i !== editIndex));
      setModalOpen(false);
    }
  };

  return (
    <div className="p-3">
      {/* ➕ Agregar */}
      <button
        className="btn btn-primary mb-3"
        onClick={openAddModal}
      >
        ➕ Agregar Actividad
      </button>

      {/* Calendario con dayPropGetter para resaltar "hoy" */}
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        defaultView="month"
        views={['month','week','day','agenda']}
        style={{ height: 400 }}
        onSelectEvent={event => {
          const idx = events.findIndex(e =>
            e.start.getTime() === event.start.getTime() &&
            e.end.getTime()   === event.end.getTime()   &&
            e.title          === event.title
          );
          if (idx > -1) openEditModal(event, idx);
        }}
        dayPropGetter={date => {
          const today = new Date();
          if (
            date.getDate()    === today.getDate() &&
            date.getMonth()   === today.getMonth() &&
            date.getFullYear()=== today.getFullYear()
          ) {
            return { className: 'today-cell' };
          }
          return {};
        }}
      />

      {/* Modal de Bootstrap puro */}
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
                    <>
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
                      <div className="mb-2">
                        <label className="form-label">Canal alerta</label>
                        <select
                          className="form-select"
                          value={newEvent.alertChannel}
                          onChange={handleChange('alertChannel')}
                        >
                          <option value="Notificación en pantalla">
                            Notificación en pantalla
                          </option>
                          <option value="Correo electrónico">
                            Correo electrónico
                          </option>
                          <option value="WhatsApp">WhatsApp</option>
                        </select>
                      </div>
                    </>
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

                {/* Footer */}
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
