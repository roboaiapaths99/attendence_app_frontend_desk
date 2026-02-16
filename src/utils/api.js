import axios from 'axios';

// IMPORTANT: Change this to your computer's local IP address for testing on a real device.
// You can find your IP by running 'ipconfig' in PowerShell and looking for IPv4 Address.
// For emulators on the same machine, use 'localhost' or '10.0.2.2' (Android Emulator).
const API_BASE_URL = 'http://192.168.1.6:8001';

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000, // 30 seconds for face processing
    headers: {
        'Content-Type': 'application/json',
    },
});

// Debug interceptor - logs every request and response
api.interceptors.request.use(
    (config) => {
        console.log(`[API] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
        return config;
    },
    (error) => {
        console.error('[API] Request setup error:', error.message);
        return Promise.reject(error);
    }
);

api.interceptors.response.use(
    (response) => {
        console.log(`[API] Response ${response.status} from ${response.config.url}`);
        return response;
    },
    (error) => {
        if (error.response) {
            console.error(`[API] Server error ${error.response.status}:`, error.response.data);
        } else if (error.request) {
            console.error('[API] No response received. Is the server running at', API_BASE_URL, '?');
            console.error('[API] Error details:', error.message);
        } else {
            console.error('[API] Request error:', error.message);
        }
        return Promise.reject(error);
    }
);

// Call this on app start to verify connectivity
export const testConnection = async () => {
    try {
        const response = await api.get('/');
        console.log('[API] Connection test SUCCESS:', response.data);
        return true;
    } catch (e) {
        console.error('[API] Connection test FAILED:', e.message);
        return false;
    }
};

export const registerUser = async (fullName, email, password, employeeId, designation, department, faceImage, deviceId) => {
    const response = await api.post('/register', {
        full_name: fullName,
        email: email,
        password: password,
        employee_id: employeeId,
        designation: designation,
        department: department,
        face_image: faceImage,
        device_id: deviceId,
    });
    return response.data;
};

export const loginUser = async (email, password, deviceId) => {
    const response = await api.post('/login', { email, password, device_id: deviceId });
    return response.data;
};

export const getProfile = async (token) => {
    const response = await api.get(`/me?token=${token}`);
    return response.data;
};

export const verifyPresence = async (email, imageBase64, lat, long, wifiBssid, wifiSsid, wifiStrength, deviceId) => {
    const response = await api.post('/verify-presence', {
        email,
        image: imageBase64,
        lat,
        long,
        wifi_bssid: wifiBssid || '',
        wifi_ssid: wifiSsid || '',
        wifi_strength: wifiStrength || -50,
        device_id: deviceId,
    });
    return response.data;
};

export const smartAttendance = async (imageBase64, lat, long, wifiBssid, wifiSsid, wifiStrength, email = "smart@auto.com", address = null, intendedType = null, deviceId = null) => {
    // Note: 'email' is used as a hint for the backend to avoid misidentification.
    const response = await api.post('/smart-attendance', {
        email: email,
        image: imageBase64,
        lat,
        long,
        wifi_bssid: wifiBssid || '',
        wifi_ssid: wifiSsid || '',
        wifi_strength: wifiStrength || -50,
        address: address,
        intended_type: intendedType,
        device_id: deviceId
    });
    return response.data;
};

export const getAttendanceLogs = async (email) => {
    const response = await api.get(`/logs/${email}`);
    return response.data;
};

export const getAnalytics = async (email) => {
    const response = await api.get(`/analytics/${email}`);
    return response.data;
};

export const updateFace = async (email, password, faceImageBase64, lat, long, wifiBssid, wifiSsid, wifiStrength, deviceId) => {
    const response = await api.post('/update-face', {
        email,
        password,
        face_image: faceImageBase64,
        lat,
        long,
        wifi_bssid: wifiBssid || '',
        wifi_ssid: wifiSsid || '',
        wifi_strength: wifiStrength || -50,
        device_id: deviceId,
    });
    return response.data;
};

export default api;

