import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

type WorkspaceContextType = {
  selectedWorkspaceId: string | null;
  setSelectedWorkspaceId: (id: string | null) => void;
};

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [selectedWorkspaceId, setSelectedWorkspaceIdState] = useState<string | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('selectedWorkspaceId');
    if (saved) {
      setSelectedWorkspaceIdState(saved);
    }
  }, []);

  const setSelectedWorkspaceId = (id: string | null) => {
    setSelectedWorkspaceIdState(id);
    if (id) {
      localStorage.setItem('selectedWorkspaceId', id);
    } else {
      localStorage.removeItem('selectedWorkspaceId');
    }
  };

  return (
    <WorkspaceContext.Provider value={{ selectedWorkspaceId, setSelectedWorkspaceId }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspaceContext() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspaceContext must be used within WorkspaceProvider');
  }
  return context;
}
