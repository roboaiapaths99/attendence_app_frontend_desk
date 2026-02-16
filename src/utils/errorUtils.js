/**
 * Centralized error mapping to hide raw backend technical messages
 * from the end user and provide friendly, actionable feedback.
 */

export const getFriendlyErrorMessage = (error, defaultMsg = "Something went wrong") => {
    // 1. Check if it's an Axios/Network error with a backend detail
    const detail = error?.response?.data?.detail;
    const message = error?.message;

    console.log("[Error Mapping] Raw Detail:", detail, "Raw Message:", message);

    if (detail) {
        const detailStr = String(detail).toLowerCase();

        // Attendance / Scan Screen specific
        // Attendance / Scan Screen specific
        if (detailStr.includes("bssid mismatch") || detailStr.includes("office wifi")) {
            return "Please connect to the official office WiFi to verify you are in the office.";
        }
        if (detailStr.includes("location verification failed") || detailStr.includes("too far") || detailStr.includes("mock location")) {
            return "You seem to be outside the office premises or using a mock location. Please use your real GPS.";
        }
        if (detailStr.includes("face not recognized") || detailStr.includes("no face detected")) {
            return "Face not recognized. Please ensure you are in a well-lit area and looking directly at the camera.";
        }
        if (detailStr.includes("hardware id mismatch") || detailStr.includes("device_id") || detailStr.includes("bound to a different device")) {
            return "Security Alert: Attendance must be marked from your registered device.";
        }
        if (detailStr.includes("wifi signal too weak") || detailStr.includes("signal too weak")) {
            return "WiFi signal is too weak. Please move closer to the router for verification.";
        }

        // Auth / Login Screen
        if (detailStr.includes("invalid credentials") || detailStr.includes("incorrect password")) {
            return "Incorrect email or password. Please try again.";
        }
        if (detailStr.includes("user not found")) {
            return "No account found with this email. Please register first.";
        }
        if (detailStr.includes("already exists")) {
            return "An account with this email/ID already exists.";
        }

        // Generic technical errors
        if (detailStr.includes("database") || detailStr.includes("server error")) {
            return "Our servers are currently busy. Please try again in 1 minute.";
        }

        // If it's a string but doesn't match known patterns, return it if it looks "safe"
        // Otherwise return default
        if (detailStr.length < 100 && !detailStr.includes("error code") && !detailStr.includes("exception")) {
            return String(detail);
        }
    }

    // 2. Network / Connectivity issues
    if (message === "Network Error") {
        return "Connection failed. Please check if your Internet or WiFi is active.";
    }
    if (message?.includes("timeout")) {
        return "The request took too long. Please check your signal strength.";
    }

    return defaultMsg;
};
