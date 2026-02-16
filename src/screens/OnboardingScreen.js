import React, { useState, useRef, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Application from 'expo-application';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, StyleSheet, Image, Platform } from 'react-native';
import GlassCard from '../components/GlassCard';
import { Camera as CameraIcon, CheckCircle, RefreshCcw } from 'lucide-react-native';
import { theme } from '../utils/theme';
import { registerUser } from '../utils/api';
import { getFriendlyErrorMessage } from '../utils/errorUtils';

const OnboardingScreen = ({ route, navigation }) => {
    console.log("[Onboarding v2] Screen rendering. Params:", route?.params);
    const { fullName, email, password, employeeId, designation, department } = route?.params || {};
    const [permission, requestPermission] = useCameraPermissions();
    const [facing, setFacing] = useState('front');
    const [isCapturing, setIsCapturing] = useState(false);
    const [photo, setPhoto] = useState(null);
    const [isRegistering, setIsRegistering] = useState(false);
    const [isCameraReady, setIsCameraReady] = useState(false);
    const cameraRef = useRef(null);

    useEffect(() => {
        if (permission && !permission.granted && permission.canAskAgain) {
            console.log("[Onboarding] Requesting camera permissions...");
            requestPermission();
        }
    }, [permission]);

    console.log("[Onboarding] Rendering screen. Permission state:", permission?.status, "photo present:", !!photo);

    // 1. Loading State
    if (!permission) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.loadingText}>Initializing Camera...</Text>
            </View>
        );
    }

    // 2. No Permission State
    if (!permission.granted) {
        return (
            <View style={styles.permissionContainer}>
                <Text style={styles.permissionText}>Camera permission is required for face enrollment.</Text>
                <TouchableOpacity
                    style={styles.goBackButton}
                    onPress={() => permission.canAskAgain ? requestPermission() : navigation.goBack()}
                >
                    <Text style={styles.goBackText}>
                        {permission.canAskAgain ? "Grant Permission" : "Go Back"}
                    </Text>
                </TouchableOpacity>
            </View>
        );
    }

    const takePicture = async () => {
        if (!cameraRef.current || !isCameraReady) {
            console.warn("[Onboarding] Camera not ready or ref null.");
            return;
        }

        console.log("[Onboarding] Starting takePictureAsync...");
        setIsCapturing(true);
        try {
            const data = await cameraRef.current.takePictureAsync({
                base64: true,
                quality: 0.5
            });
            console.log("[Onboarding] Picture captured. Base64 length:", data?.base64?.length);
            setPhoto(data.base64);
        } catch (e) {
            console.error("[Onboarding] Capture error:", e);
            Alert.alert("Error", "Failed to capture image: " + e.message);
        } finally {
            setIsCapturing(false);
            console.log("[Onboarding] takePicture finished.");
        }
    };

    const handleRegister = async () => {
        if (!photo) {
            Alert.alert("Error", "Please capture your face first.");
            return;
        }
        setIsRegistering(true);
        try {
            console.log("[Onboarding] Sending registration request for:", email);
            const deviceId = Platform.OS === 'android' ?
                Application.androidId :
                await Application.getIosIdForVendorAsync();

            const data = await registerUser(fullName, email, password, employeeId, designation, department, photo, deviceId);

            // Auto-login after registration
            await SecureStore.setItemAsync('userEmail', email);
            await SecureStore.setItemAsync('userPassword', password);
            await SecureStore.setItemAsync('userData', JSON.stringify(data.user));

            Alert.alert("Success", "Digital ID Created Successfully!", [
                {
                    text: "Start Working", onPress: () => navigation.navigate('Home', {
                        email: email,
                        token: data.access_token,
                        user: data.user
                    })
                }
            ]);
        } catch (e) {
            const errorMsg = getFriendlyErrorMessage(e, "Could not complete enrollment.");
            Alert.alert("Registration Failed", errorMsg);
        } finally {
            setIsRegistering(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Face Enrollment</Text>
            <Text style={styles.subtitle}>Position your face in the frame</Text>

            <View style={styles.cameraWrapper}>
                <CameraView
                    ref={cameraRef}
                    style={[styles.camera, !!photo && { display: 'none' }]}
                    facing={facing}
                    onCameraReady={() => setIsCameraReady(true)}
                />
                {photo && (
                    <View style={styles.capturedContainer}>
                        <Image
                            source={{ uri: `data:image/jpeg;base64,${photo}` }}
                            style={styles.capturedImage}
                        />
                        <View style={styles.capturedOverlay}>
                            <CheckCircle size={48} color="#10b981" />
                            <Text style={styles.capturedText}>Captured</Text>
                        </View>
                    </View>
                )}
            </View>

            <GlassCard style={styles.infoCard}>
                <Text style={styles.infoText}>
                    Your facial signature will be converted into a secure mathematical embedding. We don't store your actual photo.
                </Text>
            </GlassCard>

            {!photo ? (
                <TouchableOpacity
                    style={[styles.captureButton, isCapturing && styles.buttonDisabled]}
                    onPress={takePicture}
                    disabled={isCapturing}
                >
                    {isCapturing ? <ActivityIndicator color="white" /> : <CameraIcon size={24} color="white" />}
                    <Text style={styles.captureButtonText}>
                        {isCapturing ? 'Capturing...' : 'Capture Face'}
                    </Text>
                </TouchableOpacity>
            ) : (
                <View style={styles.actionRow}>
                    <TouchableOpacity
                        style={styles.retakeButton}
                        onPress={() => setPhoto(null)}
                    >
                        <RefreshCcw size={20} color="white" />
                        <Text style={styles.actionButtonText}>Retake</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.registerButton, isRegistering && styles.buttonDisabled]}
                        onPress={handleRegister}
                        disabled={isRegistering}
                    >
                        {isRegistering ? (
                            <ActivityIndicator color={theme.colors.background} />
                        ) : (
                            <>
                                <CheckCircle size={20} color={theme.colors.background} />
                                <Text style={styles.registerButtonText}>Register</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
        paddingHorizontal: 24,
        paddingVertical: 48,
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: theme.colors.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: 'white',
        marginTop: 16,
        fontSize: 16,
    },
    permissionContainer: {
        flex: 1,
        backgroundColor: theme.colors.background,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    permissionText: {
        color: '#f87171',
        fontSize: 18,
        textAlign: 'center',
    },
    goBackButton: {
        marginTop: 16,
        backgroundColor: theme.colors.primary,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
    },
    goBackText: {
        color: 'white',
        fontWeight: 'bold',
    },
    title: {
        color: 'white',
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    subtitle: {
        color: theme.colors.text.slate400,
        marginBottom: 32,
    },
    cameraWrapper: {
        width: 288,
        aspectRatio: 1,
        borderRadius: 144,
        overflow: 'hidden',
        borderWidth: 4,
        borderColor: 'rgba(99, 102, 241, 0.5)',
        marginBottom: 32,
        alignSelf: 'center',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0f172a',
    },
    camera: {
        width: '100%',
        height: '100%',
    },
    capturedContainer: {
        width: '100%',
        height: '100%',
        backgroundColor: '#0f172a',
    },
    capturedImage: {
        width: '100%',
        height: '100%',
        opacity: 0.6,
    },
    capturedOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
    },
    capturedText: {
        color: '#10b981',
        marginTop: 8,
        fontWeight: 'bold',
    },
    infoCard: {
        marginBottom: 24,
    },
    infoText: {
        color: 'rgba(255, 255, 255, 0.8)',
        textAlign: 'center',
        fontSize: 14,
        lineHeight: 20,
    },
    captureButton: {
        backgroundColor: theme.colors.primary,
        paddingVertical: 16,
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    captureButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 18,
        marginLeft: 8,
    },
    actionRow: {
        flexDirection: 'row',
    },
    retakeButton: {
        flex: 1,
        backgroundColor: '#334155',
        paddingVertical: 16,
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    registerButton: {
        flex: 1,
        backgroundColor: theme.colors.secondary,
        paddingVertical: 16,
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
    actionButtonText: {
        color: 'white',
        fontWeight: 'bold',
        marginLeft: 8,
    },
    registerButtonText: {
        color: theme.colors.background,
        fontWeight: 'bold',
        marginLeft: 8,
    },
    buttonDisabled: {
        opacity: 0.7,
    },
});

export default OnboardingScreen;
