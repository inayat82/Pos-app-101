import { FieldValue, Timestamp } from 'firebase/firestore'; // Ensure Timestamp is imported

export interface UserProfile extends BaseUserProfile { // UserProfile now extends BaseUserProfile
  // uid, email, role, name, createdAt, phone are inherited
  displayName: string | null; // Kept for display purposes, can be derived or set explicitly
  adminId?: string; // For Sub-users, to link to their Admin
}

export enum UserRole {
  SuperAdmin = 'superadmin', // Fixed to match database value
  Admin = 'admin', // Changed to lowercase
  TakealotUser = 'TakealotUser',
  POSUser = 'POSUser',
}

// Specific role interfaces if they have unique properties beyond UserProfile
export interface SuperAdminProfile extends BaseUserProfile { // Ensure SuperAdminProfile also has base fields
  role: UserRole.SuperAdmin;
  // SuperAdmin specific fields can be added here if any
}

// Represents a user with the Admin role
export interface AdminUserProfile extends BaseUserProfile {
  role: UserRole.Admin;
  // teamId or similar if Admins manage a distinct group of sub-users and data
}

export interface TakealotUserProfile extends BaseUserProfile {
  role: UserRole.TakealotUser;
  adminId: string; // Belongs to an Admin
  // Specific fields for Takealot User, e.g., API keys, last sync date
}

export interface POSUserProfile extends BaseUserProfile {
  role: UserRole.POSUser;
  adminId: string; // Belongs to an Admin
  // Specific fields for POS User
}

// Union type for any user profile
export type AnyUserProfile = SuperAdminProfile | AdminUserProfile | TakealotUserProfile | POSUserProfile;

export interface BaseUserProfile {
  uid: string;
  email: string | null;
  role: UserRole;
  name?: string; // Full name, optional
  username?: string; // Optional username
  createdAt?: Timestamp; // Made optional and ensured it's Timestamp
  updatedAt?: Timestamp; // Add updatedAt here
  phone?: string; // Added optional phone
  // username is removed as 'name' can serve a similar purpose or be added if distinct
}
