import { Link } from 'react-router-dom';
import { useAuth } from '../../features/auth/useAuth';

const Navbar = () => {
  const { user, isAuthenticated, logout, initiateOAuthLogin } = useAuth();

  return (
    <nav className="bg-gray-800 text-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-4">
            <Link to="/" className="font-bold text-xl">
              Modulo
            </Link>
            <Link to="/" className="hover:text-gray-300">
              Home
            </Link>
            {isAuthenticated && (
              <>
                <Link to="/dashboard" className="hover:text-gray-300">
                  Dashboard
                </Link>
                <Link to="/notes" className="hover:text-gray-300">
                  Notes
                </Link>
                <Link to="/notes-graph" className="hover:text-gray-300">
                  Graph
                </Link>
                <Link to="/contracts" className="hover:text-gray-300">
                  Contracts
                </Link>
                <Link to="/plugins" className="hover:text-gray-300">
                  Plugins
                </Link>
                <div className="relative group">
                  <Link to="/plugins/marketplace" className="hover:text-gray-300 flex items-center">
                    Marketplace
                    <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </Link>
                  <div className="absolute left-0 mt-2 w-48 bg-gray-700 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    <Link to="/plugins/marketplace" className="block px-4 py-2 text-sm hover:bg-gray-600 rounded-t-md">
                      Browse Marketplace
                    </Link>
                    <Link to="/plugins/submit" className="block px-4 py-2 text-sm hover:bg-gray-600">
                      Submit Plugin
                    </Link>
                    <Link to="/plugins/my-submissions" className="block px-4 py-2 text-sm hover:bg-gray-600 rounded-b-md">
                      My Submissions
                    </Link>
                  </div>
                </div>
              </>
            )}
            <Link to="/about" className="hover:text-gray-300">
              About
            </Link>
            <Link to="/settings" className="hover:text-gray-300">
              Settings
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <>
                <div className="flex items-center space-x-2">
                  {user?.picture && (
                    <img
                      src={user.picture}
                      alt="Profile"
                      className="w-8 h-8 rounded-full"
                    />
                  )}
                  <span>{user?.name}</span>
                </div>
                <button
                  onClick={logout}
                  className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded"
                >
                  Logout
                </button>
              </>
            ) : (
              <button
                onClick={() => initiateOAuthLogin('google')} // Default to Google, or add provider selection
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
              >
                Login
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;