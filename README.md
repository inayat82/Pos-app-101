# Point of Sale (POS) Application

This is a Next.js application designed as a Point of Sale system with a multi-tier user role architecture. It uses Firebase for authentication and data storage and is intended for deployment on Vercel.

## Project Overview

The application supports the following user roles:
-   **SuperAdmin**: Has complete control over the application and manages Admin accounts. (Manually assigned in Firestore).
-   **Admin**: Users who sign up via the application are automatically granted Admin privileges. Each Admin manages their own team of sub-users and a common set of POS data for their team.
-   **Sub-users** (created by an Admin via the Admin dashboard - no direct signup):
    -   **Takealot User**: Accesses their unique Takealot API data and the shared POS data from their Admin.
    -   **POS User**: Accesses only the shared POS data from their Admin.

## Key Technologies

-   Next.js (with App Router & TypeScript)
-   Tailwind CSS
-   Firebase (Authentication, Firestore)
-   Vercel (for deployment)

## Getting Started

### Prerequisites

-   Node.js (version 18.x or later recommended)
-   npm or yarn
-   A Firebase project (set up Authentication and Firestore)

### Setup

1.  **Clone the repository (if applicable) or ensure you are in the project directory `pos-app`**

2.  **Install dependencies:**
    ```bash
    npm install
    ```
    (If you prefer yarn: `yarn install`)

3.  **Configure Firebase:**
    -   Ensure your Firebase project configuration object is correctly placed in `src/lib/firebase/firebaseConfig.ts`.

4.  **Set up Initial User Roles in Firebase:**
    -   **SuperAdmin**: Manually create a user in Firebase Authentication. Then, in your Firestore `users` collection, create a document with this user's UID as the document ID and set the `role` field to `"SuperAdmin"`.
    -   **Admin**: Any user signing up through the `/signup` page will automatically have their `role` set to `"Admin"` in their Firestore user document.
    -   **Sub-users (TakealotUser, POSUser)**: These roles are intended to be created by an Admin user through the Admin dashboard. The functionality for Admins to create these users needs to be built.

### Running the Development Server

Navigate to the `pos-app` directory if you are not already in it:
```powershell
cd 'c:\Users\USER-PC\My Drive\Sync App\Ai\Project\App-101\pos-app'
npm run dev
```
Or if using yarn:
```powershell
cd 'c:\Users\USER-PC\My Drive\Sync App\Ai\Project\App-101\pos-app'
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Available Pages & Functionality (Current State)

-   `/`: Home page (shows login/signup or user info if logged in).
-   `/login`: User login page.
-   `/signup`: User registration page (new users become Admins).
-   `/admin/dashboard`: Placeholder dashboard for Admin users. Requires Admin role.
-   `/superadmin/dashboard`: Placeholder dashboard for SuperAdmin users. Requires SuperAdmin role.

## Next Steps & Future Development

-   **Implement Firestore Security Rules**: This is critical for data protection and enforcing role-based access.
-   **Build out Admin Dashboard**: 
    -   Functionality for Admins to create and manage their Sub-users (TakealotUser, POSUser).
    -   Interface for Admins to manage their common POS data.
    -   Interface for Admins to view Takealot data associated with their Takealot Users.
-   **Build out SuperAdmin Dashboard**: 
    -   Functionality for SuperAdmins to manage Admin accounts (e.g., view list, potentially disable/enable).
    -   Platform oversight tools.
-   **Develop Sub-user interfaces/views** based on their specific data access permissions (they will not have separate dashboards but will access data through Admin-controlled views or specific components).
-   **Integrate Takealot API**: Including secure API key management and cron jobs for automated data fetching.
-   **Enhance UI/UX** across the application.
-   **Error Handling and Validation**: Implement robust error handling and input validation.

## Deployment

This application is structured for deployment on [Vercel](https://vercel.com/). Connect your Git repository to Vercel. Environment variables for Firebase client-side configuration are already in `firebaseConfig.ts`. If you add Firebase Admin SDK for backend functions, you'll need to set up environment variables for the service account key in Vercel.
