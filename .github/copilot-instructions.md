## Project Overview
This is a Next.js Point of Sale (POS) application with Firebase authentication and Vercel deployment in mind. It features a three-tier user role system: SuperAdmin, Admin, and Sub-users (Takealot User and POS User).

## Key Technologies
- Next.js (with App Router and TypeScript)
- Tailwind CSS
- Firebase (Authentication, Firestore for user roles and data)
- Vercel (for hosting)

## User Roles
- **SuperAdmin**: Single account with full control.
- **Admin**: Signs up, manages their own sub-users and shared POS data.
- **Sub-users**:
    - **Takealot User**: Accesses their unique Takealot data and shared POS data from their Admin.
    - **POS User**: Accesses shared POS data from their Admin.

## Development Guidelines
- Ensure all UI components are responsive and mobile-friendly.
- Follow Next.js best practices, especially for App Router, Server Components, and Client Components.
- Use Firebase SDK for all backend interactions (auth, database).
- Structure Firebase data to reflect the user role hierarchy and data sharing rules (e.g., Admins have separate data scopes, Sub-users inherit from their Admin).
- When adding new features, consider how they impact each user role.
- For API routes or server-side logic, ensure proper error handling and security (e.g., validating user roles before performing actions).
- Keep Vercel deployment considerations in mind (environment variables, serverless function limits if applicable).

## Firebase Setup (Placeholder - User will provide actual config)
- The Firebase configuration will be stored in `src/lib/firebase/firebaseConfig.ts` (or a similar path).
- Firestore will be used to store user profiles, roles, and POS/Takealot data links.

## Takealot API Integration
- This will be a core feature. Cron jobs will be used for data fetching.
- Securely store API keys and manage API request volume.

## Important Notes for Copilot
- When generating code, pay close attention to the user role definitions and their specific data access permissions.
- Remember that Admins operate in separate ecosystems.
- Sub-users' data access is tied to their parent Admin.
- The SuperAdmin has global oversight.
- Prefer creating files and then asking for edits, rather than trying to generate very large files in one go.
- When creating UI components, use Tailwind CSS for styling and ensure responsiveness.
- For state management, consider React Context or a lightweight library if needed, but start with simple prop drilling for smaller component trees.
