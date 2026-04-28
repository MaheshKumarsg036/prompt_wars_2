import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ElectionAssistant from './components/ElectionAssistant';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4">
        <Routes>
          <Route path="/" element={<ElectionAssistant />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
