// Placeholder for AddNewUserModal.tsx
import React, { useState, useEffect } from 'react';
import { UserRole } from '@/types/user';
import { FiEye, FiEyeOff, FiUserPlus } from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext'; // Import useAuth

interface AddNewUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserAdded: () => void; // Callback after successful user addition
  adminId: string; // ID of the admin creating this user
}

const AddNewUserModal: React.FC<AddNewUserModalProps> = ({ isOpen, onClose, onUserAdded, adminId }) => {
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [cellNumber, setCellNumber] = useState('');
  const [profilePicUrl, setProfilePicUrl] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.POSUser); // Default role
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { currentUser } = useAuth(); // Get currentUser from AuthContext

  useEffect(() => {
    // Reset form when modal opens or closes
    if (isOpen) {
      setUsername('');
      setFullName('');
      setEmail('');
      setCellNumber('');
      setProfilePicUrl('');
      setRole(UserRole.POSUser);
      setPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      setShowConfirmPassword(false);
      setError(null);
      setIsLoading(false);
    }
  }, [isOpen]);

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!currentUser) {
      setError("Not authenticated. Please log in again.");
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    // Basic email validation (can be more comprehensive)
    if (!email.includes('@')) {
        setError("Please enter a valid email address.");
        return;
    }
    if (!fullName.trim()) {
        setError("Full name is required.");
        return;
    }
     if (!username.trim()) { // Assuming username is also required
        setError("Username is required.");
        return;
    }


    setIsLoading(true);

    try {
      const token = await currentUser.getIdToken();
      console.log("Frontend: Retrieved token:", token); // <-- ADD THIS LOG

      if (!token) {
        setError("Authentication token not available. Please try logging in again.");
        setIsLoading(false);
        return;
      }

      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          parentAdminId: adminId, // Passed as prop
          username,
          fullName,
          email,
          cell: cellNumber, // API expects 'cell'
          profilePicUrl,
          role,
          password,
        })
      });
      
      const data = await response.json();
      console.log("Frontend: API Response data:", data); // <-- ADD THIS LOG

      if (!response.ok) {
        throw new Error(data.details || data.error || 'Failed to create user');
      }
      
      alert('User created successfully!'); // Or use a more sophisticated notification
      onUserAdded(); // Callback to refresh user list or give feedback
      onClose(); // Close modal

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
      console.error("Frontend: Error creating user:", errorMessage, err); // <-- ENHANCE LOG
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-start pt-10 sm:pt-20 px-4 overflow-y-auto">
      <div className="bg-white p-6 sm:p-8 rounded-lg shadow-2xl w-full max-w-2xl transform transition-all">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-slate-800 flex items-center">
            <FiUserPlus className="mr-3 text-indigo-600" /> Add New User
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
            aria-label="Close modal"
            disabled={isLoading}
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSaveUser} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-slate-700 mb-1">
                Username <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="e.g., @johndoe"
                required
                disabled={isLoading}
              />
            </div>
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-slate-700 mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="Enter user's full name"
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="user@example.com"
                required
                disabled={isLoading}
              />
            </div>
            <div>
              <label htmlFor="cellNumber" className="block text-sm font-medium text-slate-700 mb-1">
                Cell Number
              </label>
              <input
                type="tel"
                id="cellNumber"
                value={cellNumber}
                onChange={(e) => setCellNumber(e.target.value)}
                className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="082 XXX XXXX"
                disabled={isLoading}
              />
            </div>
          </div>

          <div>
            <label htmlFor="profilePicUrl" className="block text-sm font-medium text-slate-700 mb-1">
              Profile Picture URL (Optional)
            </label>
            <input
              type="url"
              id="profilePicUrl"
              value={profilePicUrl}
              onChange={(e) => setProfilePicUrl(e.target.value)}
              className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="https://example.com/image.png"
              disabled={isLoading}
            />
          </div>

          <div>
            <label htmlFor="role" className="block text-sm font-medium text-slate-700 mb-1">
              Assign Role <span className="text-red-500">*</span>
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              required
              disabled={isLoading}
            >
              <option value={UserRole.POSUser}>POS User</option>
              <option value={UserRole.TakealotUser}>Takealot User</option>
              {/* Add other sub-user roles here if any */}
            </select>
          </div>
          
          <div className="border-t border-slate-200 pt-6">
            <p className="text-sm font-medium text-slate-700 mb-1">Set Initial Password</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="relative">
                <label htmlFor="password"className="block text-sm font-medium text-slate-700 mb-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm pr-10"
                  placeholder="Min. 6 characters"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 top-6 pr-3 flex items-center text-sm leading-5 text-slate-500 hover:text-slate-700"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  disabled={isLoading}
                >
                  {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                </button>
              </div>
              <div className="relative">
                <label htmlFor="confirmPassword"className="block text-sm font-medium text-slate-700 mb-1">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm pr-10"
                  placeholder="Re-enter password"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 top-6 pr-3 flex items-center text-sm leading-5 text-slate-500 hover:text-slate-700"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  disabled={isLoading}
                >
                  {showConfirmPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-100 text-red-700 border border-red-300 rounded-md text-sm">
              <p>{error}</p>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition ease-in-out duration-150"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition ease-in-out duration-150 flex items-center"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Adding...
                </>
              ) : (
                <><FiUserPlus className="mr-2" /> Add User</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddNewUserModal;
