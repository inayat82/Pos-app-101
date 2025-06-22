import { NextRequest, NextResponse } from 'next/server';
import { firebaseAdmin } from '@/lib/firebase/firebaseAdmin';
import { getStorage } from 'firebase-admin/storage';

export async function POST(request: NextRequest) {
  console.log('🔵 Upload API called');
  
  try {
    console.log('🔵 Parsing form data...');
    const formData = await request.formData();
    console.log('🔵 Form data parsed successfully');
    
    const file = formData.get('file') as File;
    const adminId = formData.get('adminId') as string;
    const uploadType = formData.get('uploadType') as string;

    console.log('🔵 Form fields:', {
      fileName: file?.name,
      fileSize: file?.size,
      fileType: file?.type,
      adminId,
      uploadType
    });

    if (!file) {
      console.log('❌ No file provided');
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      console.log('❌ Invalid file type:', file.type);
      return NextResponse.json({ 
        error: 'Invalid file type. Please upload an image file (JPEG, PNG, GIF, or WebP).' 
      }, { status: 400 });
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      console.log('❌ File too large:', file.size);
      return NextResponse.json({ 
        error: 'File too large. Please upload an image smaller than 10MB.' 
      }, { status: 400 });
    }

    console.log('🔵 Converting file to buffer...');
    const buffer = Buffer.from(await file.arrayBuffer());
    console.log('🔵 Buffer created, size:', buffer.length);    console.log('🔵 Getting Firebase storage...');
    const storage = getStorage(firebaseAdmin.app());
      // Use the configured bucket name
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'app-101-45e45.firebasestorage.app';
    const bucket = storage.bucket(bucketName);
    
    console.log('🔵 Storage bucket acquired:', bucket.name);
    
    // Check if bucket exists, if not create it
    try {
      const [exists] = await bucket.exists();
      if (!exists) {
        console.log('🔵 Bucket does not exist, creating...');
        await bucket.create();
        console.log('🔵 Bucket created successfully');
      }    } catch (createError: any) {
      console.log('⚠️  Could not check/create bucket, proceeding anyway:', createError.message);
    }

    // Generate unique filename
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop();
    const folder = uploadType || 'uploads';
    const fileName = `${adminId}/${folder}/${timestamp}_${Math.random().toString(36).substring(2)}.${fileExtension}`;
    
    console.log('🔵 Generated filename:', fileName);

    // Upload file to Firebase Storage
    const fileUpload = bucket.file(fileName);
    
    console.log('🔵 Uploading to Firebase Storage...');
    await fileUpload.save(buffer, {
      metadata: {
        contentType: file.type,
        metadata: {
          originalName: file.name,
          uploadedAt: new Date().toISOString(),
        }
      }
    });
    console.log('🔵 File uploaded successfully');

    console.log('🔵 Making file public...');
    await fileUpload.makePublic();
    console.log('🔵 File made public');

    // Generate public URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    console.log('🔵 Generated public URL:', publicUrl);

    return NextResponse.json({ 
      success: true, 
      imageUrl: publicUrl,
      storagePath: fileName 
    });
  } catch (error: any) {
    console.error('❌ Upload error:', error);
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      // Check if it's a bucket not found error
    if (error.message && error.message.includes('bucket does not exist')) {
      return NextResponse.json({ 
        error: 'Firebase Storage is not properly configured. Please follow these steps:\n\n1. Go to Firebase Console (https://console.firebase.google.com)\n2. Select your project (app-101-45e45)\n3. Go to Storage in the left menu\n4. Click "Get started"\n5. Choose "Start in test mode"\n6. Select a location (us-central1 recommended)\n7. Click "Done"\n\nAfter enabling Storage, try uploading again.' 
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      error: 'Failed to upload image. Please try again.' 
    }, { status: 500 });
  }
}
