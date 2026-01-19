import { useState } from 'react';
import { Search, BookMarked } from 'lucide-react';
import UMLSSearch from './components/UMLSSearch';

function App() {
  const [view, setView] = useState<'search' | 'saved'>('search');

  // For local development - skip authentication
  // Will add back when ready to deploy with Supabase

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">UMLS Code Set Builder</h1>
          <div className="flex items-center gap-4">
            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Local Dev Mode</span>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-4">
            <button
              onClick={() => setView('search')}
              className={`px-4 py-3 border-b-2 transition-colors ${
                view === 'search'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4" />
                Search & Build
              </div>
            </button>
            <button
              onClick={() => setView('saved')}
              className={`px-4 py-3 border-b-2 transition-colors ${
                view === 'saved'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <BookMarked className="w-4 h-4" />
                Saved Code Sets
              </div>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {view === 'search' ? (
          <UMLSSearch />
        ) : (
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Saved Code Sets</h2>
            <p className="text-gray-600">Saved code sets functionality coming soon...</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
