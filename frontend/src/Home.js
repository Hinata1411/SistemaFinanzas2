import React from 'react';
import MyCalendar from './MyCalendar';
import './Home.css';

export default function Home() {
  return (
    <div className="home-shell">
      <header className="home-header">
        <h1>Sistema Finanzas</h1>
      </header>

      <section className="home-calendar-card">
        <MyCalendar />
      </section>
    </div>
  );
}
