import { useState, useRef, useEffect } from 'react';
import { UserCircle2, ChevronDown, LogOut } from 'lucide-react';

type ProfileDropdownProps = {
  user: {
    id: string;
    name: string;
    email: string;
    title?: string;
  } | null;
  onLogout: () => void;
};

export function ProfileDropdown({ user, onLogout }: ProfileDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  if (!user) return null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg border border-ink/10 px-3 py-2 text-sm hover:bg-ink/5 transition"
      >
        <UserCircle2 size={16} />
        <span className="hidden sm:inline">{user.name}</span>
        <ChevronDown size={14} className={`transition ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-lg border border-ink/10 bg-white shadow-lg z-50">
          <div className="border-b border-ink/10 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-aqua/10 p-2">
                <UserCircle2 size={24} className="text-aqua" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-ink truncate">{user.name}</p>
                <p className="text-xs text-ink/60 truncate">{user.email}</p>
              </div>
            </div>
          </div>

          <div className="space-y-2 p-3 border-b border-ink/10">
            {user.title && (
              <div>
                <p className="text-xs uppercase tracking-wide text-ink/50">Title</p>
                <p className="text-sm font-medium text-ink">{user.title}</p>
              </div>
            )}
            
          </div>

          <div className="p-3">
            <button
              onClick={() => {
                setIsOpen(false);
                onLogout();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink hover:bg-ink/5 transition"
            >
              <LogOut size={14} />
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
