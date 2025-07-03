import { NextRequest, NextResponse } from 'next/server';
import { webshareService } from '@/modules/webshare/services';
import { verifyAuthToken } from '../../../../lib/firebase/authUtils';

export async function POST(request: NextRequest) {
    try {
        const authResult = await verifyAuthToken(request);
        
        if (!authResult.success || !authResult.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if user is superadmin
        if (authResult.user.role !== 'superadmin') {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        // Test the proxy service by making a request to a test endpoint
        const testUrl = 'https://httpbin.org/ip'; // This will show us which IP we're using
        
        const response = await webshareService.makeRequest({
            url: testUrl,
            method: 'GET'
        });

        return NextResponse.json({
            success: true,
            message: 'Proxy test successful',
            data: response.data,
            proxyUsed: response.proxyUsed,
            statusCode: response.status
        });

    } catch (error: any) {
        console.error('Proxy test error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Proxy test failed'
        }, { status: 500 });
    }
}
