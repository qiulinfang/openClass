import { NavLink, Route, Routes } from 'react-router-dom'
import Home from './pages/Home.jsx'
import About from './pages/About.jsx'

export default function App() {
  return (
    <div className="app">
      <header className="header">
        <div className="brand">imates-react</div>
        <nav className="nav">
          <NavLink className={({ isActive }) => `navLink ${isActive ? 'active' : ''}`} to="/">
            首页
          </NavLink>
          <NavLink className={({ isActive }) => `navLink ${isActive ? 'active' : ''}`} to="/about">
            关于
          </NavLink>
        </nav>
      </header>

      <main className="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
        </Routes>
      </main>
    </div>
  )
}
