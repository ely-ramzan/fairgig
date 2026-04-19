import { Link, useLocation } from 'react-router-dom';
import { useTheme }          from '../../theme/ThemeContext';
import { useCurrentUser }    from '../../stores/authStore';
import { useLogout }         from '../../hooks/useAuth';
import { SKIP_AUTH_FOR_TESTING } from '../../config/testAuth';

interface NavLink {
  to:    string;
  label: string;
  roles: string[];
}

const NAV_LINKS: NavLink[] = [
  { to: '/dashboard',  label: 'Dashboard',    roles: ['worker'] },
  { to: '/shifts',     label: 'Shifts',       roles: ['worker'] },
  { to: '/certificate', label: 'Certificate', roles: ['worker'] },
  { to: '/community',  label: 'Community',    roles: ['worker', 'advocate'] },
  { to: '/verify',     label: 'Verify Queue', roles: ['verifier'] },
  { to: '/analytics',  label: 'Analytics',    roles: ['advocate'] },
];

export function AppNav() {
  const { toggle, isDark } = useTheme();
  const user               = useCurrentUser();
  const logout             = useLogout();
  const location           = useLocation();

  const visibleLinks = NAV_LINKS.filter(
    (l) => user?.role && l.roles.includes(user.role),
  );

  return (
    <header className="sticky top-0 z-50 bg-surface border-b border-border">
      <nav
        className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between"
        aria-label="Main navigation"
      >
        {/* Brand */}
        <div className="flex items-center gap-3">
          <Link
            to={SKIP_AUTH_FOR_TESTING ? '/dev' : '/'}
            className="font-mono text-[11px] tracking-[0.2em] uppercase text-t1 hover:text-amber transition-colors"
          >
            FAIR<span className="text-amber">GIG</span>
          </Link>
          {SKIP_AUTH_FOR_TESTING && (
            <Link
              to="/dev"
              className="font-mono text-[9px] tracking-widest uppercase text-t4 hover:text-amber transition-colors hidden sm:inline"
            >
              Screens
            </Link>
          )}
        </div>

        {/* Links */}
        <ul className="hidden md:flex items-center gap-1 list-none m-0 p-0">
          {visibleLinks.map((link) => {
            const active = location.pathname === link.to;
            return (
              <li key={link.to}>
                <Link
                  to={link.to}
                  className={`px-3 py-1.5 rounded font-sans text-sm transition-colors ${
                    active
                      ? 'text-t1 bg-elevated'
                      : 'text-t2 hover:text-t1 hover:bg-elevated'
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <Link
            to="/settings/services"
            title="Service settings"
            className="hidden sm:inline font-mono text-[9px] tracking-widest uppercase text-t3 hover:text-amber transition-colors px-2 py-1 rounded"
          >
            Services
          </Link>

          {/* Theme toggle */}
          <button
            onClick={toggle}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="w-8 h-8 flex items-center justify-center rounded text-t3 hover:text-t1 hover:bg-elevated transition-colors"
          >
            {isDark ? '○' : '●'}
          </button>

          {/* User badge + logout */}
          {user && (
            <>
              <span className="font-mono text-[10px] text-t3 tracking-wide hidden sm:block">
                {user.displayName}
              </span>
              <button
                onClick={logout}
                className="font-mono text-[10px] tracking-widest uppercase text-t3 hover:text-rust transition-colors px-2 py-1 rounded"
              >
                OUT
              </button>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
