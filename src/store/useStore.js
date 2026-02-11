import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useStore = create(
  persist(
    (set, get) => ({
      activeProjectId: null,
      activePage: 'projects',
      sidebarOpen: true,
      claudeApiKey: '',
      claudeModel: 'claude-opus-4-5-20251101',

      setActiveProject: (id) => set({ activeProjectId: id, activePage: 'requirements' }),
      clearActiveProject: () => set({ activeProjectId: null, activePage: 'projects' }),
      setActivePage: (page) => set({ activePage: page }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setClaudeApiKey: (key) => set({ claudeApiKey: key }),
      setClaudeModel: (model) => set({ claudeModel: model }),
    }),
    { name: 'agenticos-ui' }
  )
)
