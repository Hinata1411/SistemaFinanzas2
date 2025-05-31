// src/Home.js
import React from 'react';
import MyCalendar from './MyCalendar';
import './Home.css';

function Home() {
  return (
    <div className="home-welcome">
      <h1>Bienvenido a Sistema de Finanzas</h1>
      <div className="calendar">
        <MyCalendar />
      </div>
    </div>
  );
}

export default Home;
