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