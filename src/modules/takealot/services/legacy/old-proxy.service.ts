import { webshareService } from '@/modules/webshare/services';

export interface TakealotProduct {
    id: string;
    title: string;
    price: number;
    currency: string;
    availability: string;
    url: string;
}

export interface TakealotSyncOptions {
    userId: string;
    syncType: 'manual' | 'cron';
    limit?: number;
}

export class TakealotProxyService {
    private static instance: TakealotProxyService;
    private baseUrl = 'https://api.takealot.com/rest/v-1-0-0';

    public static getInstance(): TakealotProxyService {
        if (!TakealotProxyService.instance) {
            TakealotProxyService.instance = new TakealotProxyService();
        }
        return TakealotProxyService.instance;
    }

    async fetchProducts(options: TakealotSyncOptions): Promise<TakealotProduct[]> {
        try {
            const url = `${this.baseUrl}/products`;
            
            const response = await webshareService.makeRequest({
                url,
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            // Note: This is a simplified example
            // You'll need to adapt this to match the actual Takealot API structure
            return response.data?.products || [];

        } catch (error: any) {
            console.error('Error fetching products via proxy:', error);
            throw new Error(`Failed to fetch products: ${error.message}`);
        }
    }

    async fetchSales(options: TakealotSyncOptions): Promise<any[]> {
        try {
            const url = `${this.baseUrl}/sales`;
            
            const response = await webshareService.makeRequest({
                url,
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            return response.data?.sales || [];

        } catch (error: any) {
            console.error('Error fetching sales via proxy:', error);
            throw new Error(`Failed to fetch sales: ${error.message}`);
        }
    }

    async fetchOffers(options: TakealotSyncOptions): Promise<any[]> {
        try {
            const url = `${this.baseUrl}/offers`;
            
            const response = await webshareService.makeRequest({
                url,
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            return response.data?.offers || [];

        } catch (error: any) {
            console.error('Error fetching offers via proxy:', error);
            throw new Error(`Failed to fetch offers: ${error.message}`);
        }
    }
}

export const takealotProxyService = TakealotProxyService.getInstance();
