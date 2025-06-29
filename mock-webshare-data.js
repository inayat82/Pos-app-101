// Mock Webshare API responses for testing the dashboard with correct data format
// This shows what the dashboard should look like with proper data

const mockWebshareData = {
  profile: {
    id: 123456,
    email: "inayat_patel2001@yahoo.com",
    first_name: "Inayat",
    last_name: "Patel",
    last_login: "2025-06-27T20:26:00Z",
    timezone: "UTC"
  },
  
  subscription: {
    id: "sub_12345",
    name: "500 Proxy Server",
    plan_name: "500 Proxy Server", 
    proxy_count: 500,
    bandwidth_gb: 250,
    expires_at: "2027-04-30T23:59:59Z",
    is_active: true,
    status: "active",
    usage_bandwidth: 0,
    usage_requests: 0,
    price: "$32.97/month"
  },
  
  usageStats: {
    timestamp: "2025-06-28T00:00:00Z",
    is_projected: false,
    bandwidth_total: 1048576, // 1 MB in bytes
    bandwidth_average: 524288, // 512 KB
    requests_total: 150,
    requests_successful: 145,
    requests_failed: 5,
    error_reasons: [],
    countries_used: {
      "ZA": 150 // South Africa
    },
    number_of_proxies_used: 10,
    protocols_used: {
      "http": 75,
      "https": 75
    },
    average_concurrency: 2.5,
    average_rps: 0.8,
    last_request_sent_at: "2025-06-27T15:30:00Z"
  },
  
  ipAuth: {
    authorized_ips: ["YOUR_IP_HERE"],
    current_ip: "YOUR_IP_HERE", 
    is_authorized: true
  },
  
  errors: []
};

console.log('📊 Mock Webshare Data Structure:');
console.log(JSON.stringify(mockWebshareData, null, 2));

console.log('\n🎯 Expected Dashboard Display:');
console.log('- Account: Inayat Patel (inayat_patel2001@yahoo.com)');
console.log('- Plan: 500 Proxy Server');  
console.log('- Status: Active (green)');
console.log('- Expires: Apr 30, 2027');
console.log('- Usage: 1 MB bandwidth, 150 requests');
console.log('- Success Rate: 96.7%');
console.log('- Countries: South Africa');
console.log('- IP Auth: Authorized');

console.log('\n💡 To test with this data:');
console.log('1. Temporarily modify the API route to return this mock data');
console.log('2. Or use this as reference for what correct API responses should look like');
console.log('3. Compare with actual API responses to identify format differences');
