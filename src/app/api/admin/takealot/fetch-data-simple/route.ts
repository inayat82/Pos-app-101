// src/app/api/admin/takealot/fetch-data-simple/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/lib/firebase/firebaseAdmin'; // Assuming auth is initialized here
// import { getFirestore } from 'firebase-admin/firestore';
// import { TakealotApi } from '@/lib/takealot/TakealotApi'; // Assuming TakealotApi class handles API interactions
// import { 판매보고서목록조회, 판매보고서상세조회, 주문상세정보조회 } from '@/lib/takealot/takealotUtils'; // API functions

// const firestore = getFirestore();

export async function POST(request: Request) {
  // const { integrationId, adminId } = await request.json();

  // if (!integrationId || !adminId) {
  //   return NextResponse.json({ error: 'Missing integrationId or adminId' }, { status: 400 });
  // }

  // const idToken = request.headers.get('Authorization')?.split('Bearer ')[1];
  // if (!idToken) {
  //   return NextResponse.json({ error: 'Unauthorized: No token provided' }, { status: 401 });
  // }

  // try {
  //   const decodedToken = await auth.verifyIdToken(idToken);
  //   if (decodedToken.uid !== adminId && decodedToken.role !== 'superadmin') { // Assuming 'role' is a custom claim
  //     return NextResponse.json({ error: 'Unauthorized: User mismatch or insufficient privileges' }, { status: 403 });
  //   }
  // } catch (error) {
  //   console.error('Error verifying token:', error);
  //   return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
  // }

  // console.log(\`POST /api/admin/takealot/fetch-data-simple called for integrationId: \${integrationId}, adminId: \${adminId}\`);
  
  // // Placeholder: Functionality removed
  // return NextResponse.json({ message: 'Manual data fetching functionality has been removed.' }, { status: 200 });

  // // All previous logic related to fetching data, pagination, and logging has been removed.
  // // This endpoint is no longer active for manual data fetching.

  return NextResponse.json({ message: 'This endpoint is currently disabled as the manual data fetching feature has been removed.' }, { status: 410 }); // 410 Gone
}

// // Optional: Add a GET handler if this route might be accessed via GET,
// // though POST is more typical for actions like data fetching.
// export async function GET(request: Request) {
//   // You can either disallow GET requests or provide a similar message.
//   return NextResponse.json({ message: 'This endpoint is currently disabled. Please use POST if applicable, though functionality is removed.' }, { status: 405 }); // 405 Method Not Allowed
// }

// // Helper function to log operation details to Firestore
// // This function is no longer needed here as the core functionality is removed.
// /*
// async function logOperation(
//   adminId: string,
//   integrationId: string,
//   status: 'started' | 'page_summary' | 'error' | 'operation_complete',
//   details: any,
//   phase?: string // e.g., '판매보고서목록조회', '주문상세정보조회', 'pagination_info', 'final_summary'
// ) {
//   try {
//     const logEntry = {
//       adminId,
//       integrationId,
//       timestamp: new Date(),
//       status,
//       details,
//       phase: phase || status, // Use phase if provided, otherwise status
//     };
//     // console.log(\`Logging operation (\${status} - \${phase || 'N/A'}): \`, JSON.stringify(details, null, 2));
//     await firestore.collection('integrations').doc(integrationId).collection('fetch_logs').add(logEntry);
//   } catch (error) {
//     console.error('Error logging operation to Firestore:', error, { adminId, integrationId, status, details, phase });
//   }
// }
// */

// // Helper function to get Takealot API key
// // This function is no longer needed here.
// /*
// async function getTakealotApiKey(adminId: string, integrationId: string): Promise<string | null> {
//   try {
//     const integrationDocRef = firestore.collection('integrations').doc(integrationId);
//     const integrationDoc = await integrationDocRef.get();

//     if (!integrationDoc.exists) {
//       console.error(\`Integration document \${integrationId} not found.\`);
//       return null;
//     }

//     const integrationData = integrationDoc.data();
//     if (integrationData?.ownerId !== adminId) {
//       console.error(\`Mismatch between integration owner (\${integrationData?.ownerId}) and requesting admin (\${adminId}).\`);
//       return null; // Security check
//     }
//     return integrationData?.apiKey || null;
//   } catch (error) {
//     console.error(\`Error fetching API key for integration \${integrationId}:\`, error);
//     return null;
//   }
// }
// */
