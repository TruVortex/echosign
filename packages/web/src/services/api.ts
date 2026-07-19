// Base API client for backend communication
// Use relative URLs so Vite proxy handles /api routes in dev,
// and the same paths work in production behind a reverse proxy.
const API_BASE = import.meta.env.VITE_API_URL || '';

class APIError extends Error {
    constructor(public status: number, message: string) {
        super(message);
        this.name = 'APIError';
    }
}

async function fetchAPI<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE}${endpoint}`;

    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new APIError(response.status, error.error || `HTTP ${response.status}`);
    }

    return response.json();
}

export const api = {
    get: <T>(endpoint: string) => fetchAPI<T>(endpoint, { method: 'GET' }),

    post: <T>(endpoint: string, body?: unknown) =>
        fetchAPI<T>(endpoint, {
            method: 'POST',
            body: body ? JSON.stringify(body) : undefined,
        }),

    patch: <T>(endpoint: string, body?: unknown) =>
        fetchAPI<T>(endpoint, {
            method: 'PATCH',
            body: body ? JSON.stringify(body) : undefined,
        }),

    delete: <T>(endpoint: string) => fetchAPI<T>(endpoint, { method: 'DELETE' }),

    // Special multipart/form-data upload
    upload: async <T>(endpoint: string, formData: FormData): Promise<T> => {
        const url = `${API_BASE}${endpoint}`;
        const response = await fetch(url, {
            method: 'POST',
            body: formData,
            // Don't set Content-Type - let browser set it with boundary
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new APIError(response.status, error.error || `HTTP ${response.status}`);
        }

        return response.json();
    },
};

export { APIError };
