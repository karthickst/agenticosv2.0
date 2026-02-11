import React from 'react'
import {
  FolderOpen, Globe, FileText, FlaskConical,
  Database, GitBranch, Sparkles, Settings,
  ChevronLeft, ChevronRight, Cpu, LogOut, LayoutGrid
} from 'lucide-react'
import { useStore } from '../store/useStore.js'

const NAV = [
  { id: 'projects',    label: 'Projects',      icon: FolderOpen },
  { id: 'friday',      label: 'Friday',        icon: LayoutGrid,   dividerBefore: true },
  { id: 'domains',     label: 'Domains',       icon: Globe,        requiresProject: true, dividerBefore: true },
  { id: 'requirements',label: 'Requirements',  icon: FileText,     requiresProject: true },
  { id: 'testcases',   label: 'Test Cases',    icon: FlaskConical, requiresProject: true },
  { id: 'databags',    label: 'Data Bags',     icon: Database,     requiresProject: true },
  { id: 'simulation',  label: 'Simulation',    icon: GitBranch,    requiresProject: true },
  { id: 'specgen',     label: 'Spec Generator',icon: Sparkles,     requiresProject: true },
]

export default function Sidebar({ projectName }) {
  const { activePage, setActivePage, sidebarOpen, toggleSidebar, activeProjectId, currentUser, logout } = useStore()

  return (
    <aside className={`flex flex-col bg-gray-900 border-r border-gray-800 transition-all duration-200 ${sidebarOpen ? 'w-56' : 'w-14'}`}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-3 py-4 border-b border-gray-800 h-14">
        <div className="flex-shrink-0 w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
          <Cpu size={16} className="text-white" />
        </div>
        {sidebarOpen && (
          <div className="min-w-0">
            <div className="text-sm font-bold text-gray-100 leading-tight">AgenticOS</div>
            <div className="text-[10px] text-gray-500 leading-tight">goagenticos.com</div>
          </div>
        )}
      </div>

      {/* Project context */}
      {sidebarOpen && activeProjectId && (
        <div className="px-3 py-2 border-b border-gray-800">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Active Project</div>
          <div className="text-xs text-brand-400 font-medium truncate">{projectName || 'Loading...'}</div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {NAV.map(({ id, label, icon: Icon, requiresProject, dividerBefore }) => {
          const disabled = requiresProject && !activeProjectId
          const active = activePage === id
          const isFriday = id === 'friday'
          return (
            <React.Fragment key={id}>
              {dividerBefore && sidebarOpen && (
                <div className="border-t border-gray-800 my-1.5" />
              )}
              <button
                onClick={() => !disabled && setActivePage(id)}
                disabled={disabled}
                title={!sidebarOpen ? label : undefined}
                className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm transition-all duration-150
                  ${active
                    ? isFriday
                      ? 'bg-gradient-to-r from-blue-700 to-violet-700 text-white'
                      : 'bg-brand-600 text-white'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'}
                  ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <Icon size={16} className="flex-shrink-0" />
                {sidebarOpen && <span className="truncate">{label}</span>}
                {sidebarOpen && isFriday && !active && (
                  <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-900/60 text-blue-400 border border-blue-800/50">NEW</span>
                )}
              </button>
            </React.Fragment>
          )
        })}
      </nav>

      {/* Settings + collapse */}
      <div className="px-2 py-3 border-t border-gray-800 space-y-0.5">
        <button
          onClick={() => setActivePage('settings')}
          title={!sidebarOpen ? 'Settings' : undefined}
          className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm transition-all duration-150
            ${activePage === 'settings' ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'}
          `}
        >
          <Settings size={16} className="flex-shrink-0" />
          {sidebarOpen && <span>Settings</span>}
        </button>
        <button
          onClick={toggleSidebar}
          className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-all"
        >
          {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          {sidebarOpen && <span>Collapse</span>}
        </button>
      </div>

      {/* User info + logout */}
      {currentUser && (
        <div className={`px-2 py-3 border-t border-gray-800 ${sidebarOpen ? 'flex items-center gap-2' : 'flex flex-col items-center gap-1'}`}>
          <div className="w-7 h-7 flex-shrink-0 rounded-full bg-brand-700 flex items-center justify-center text-xs font-bold text-white uppercase">
            {currentUser.name?.[0] || currentUser.email?.[0] || '?'}
          </div>
          {sidebarOpen && (
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-gray-300 truncate">{currentUser.name}</div>
              <div className="text-[10px] text-gray-600 truncate">{currentUser.email}</div>
            </div>
          )}
          <button
            onClick={logout}
            title="Sign out"
            className="flex-shrink-0 p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-900/20 transition-colors"
          >
            <LogOut size={14} />
          </button>
        </div>
      )}
    </aside>
  )
}
