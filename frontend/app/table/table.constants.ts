export const TABLE_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
export const TABLE_SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000';
export const TABLE_REVALIDATE_SECONDS = 300;
export const TABLE_ROUTE_PATH = '/table/[tableId]';