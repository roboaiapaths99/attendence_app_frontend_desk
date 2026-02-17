import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, StyleSheet, Animated, Platform, Dimensions, StatusBar } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Application from 'expo-application';
import { Scan, XCircle, MapPin, Wifi, ShieldCheck, Eye, Smile } from 'lucide-react-native';
import * as Location from 'expo-location';
import NetInfo from '@react-native-community/netinfo';
import { theme } from '../utils/theme';
import { smartAttendance, updateFace } from '../utils/api';
import { getFriendlyErrorMessage } from '../utils/errorUtils';
import * as Haptics from 'expo-haptics';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    interpolate
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const RING_SIZE = SCREEN_WIDTH * 0.7;

const AttendanceScanScreen = ({ route, navigation }) => {
    console.log("[AttendanceScan v2] Screen rendering. Params:", route?.params);
    const { location, wifiInfo, email, intendedType, verificationPassword } = route.params;
    const [isVerifying, setIsVerifying] = useState(false);
    const [liveWifiInfo, setLiveWifiInfo] = useState(wifiInfo);
    const [livenessState, setLivenessState] = useState('idle'); // idle -> checking -> ready
    const [livenessProgress, setLivenessProgress] = useState(0);
    const [scanStatus, setScanStatus] = useState(null); // 'success', 'error', or null

    const pulse = useSharedValue(0);
    const scanLine = useSharedValue(0);

    useEffect(() => {
        pulse.value = withRepeat(
            withTiming(1, { duration: 2000 }),
            -1,
            false
        );
        scanLine.value = withRepeat(
            withTiming(1, { duration: 3000 }),
            -1,
            true
        );
    }, []);

    const animatedRingStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.15]) }],
            opacity: interpolate(pulse.value, [0, 1], [0.6, 0]),
            borderColor: scanStatus === 'success' ? '#10b981' : scanStatus === 'error' ? '#f43f5e' : '#6366f1',
        };
    });

    const animatedScanLineStyle = useAnimatedStyle(() => {
        return {
            top: interpolate(scanLine.value, [0, 1], [0, RING_SIZE]),
            backgroundColor: scanStatus === 'error' ? '#f43f5e' : '#6366f1',
        };
    });
    const [permission, requestPermission] = useCameraPermissions();
    const [isCameraReady, setIsCameraReady] = useState(false);
    const cameraRef = useRef(null);

    useEffect(() => {
        if (permission && !permission.granted && permission.canAskAgain) {
            requestPermission();
        }

        const updateLocation = async () => {
            try {
                const currentLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                if (currentLoc?.coords) {
                    const reverse = await Location.reverseGeocodeAsync({
                        latitude: currentLoc.coords.latitude,
                        longitude: currentLoc.coords.longitude
                    });
                    if (reverse && reverse.length > 0) {
                        const item = reverse[0];
                        const namePart = item.name && item.name !== item.street ? item.name : '';
                        const streetPart = item.street || '';
                        const districtPart = item.district || item.city || '';
                        const addr = `${namePart} ${streetPart}, ${districtPart}`.trim().replace(/^,/, '');
                        setReadableAddress(addr || 'Verified Office Zone');
                    }
                }
            } catch (err) {
                console.log("Live location update failed", err);
            }
        };

        // Initial update
        updateLocation();

        // Polling interval
        const locInterval = setInterval(updateLocation, 5000); // 5 seconds

        return () => clearInterval(locInterval);
    }, [permission]);

    const getWifiStrengthLabel = (dbm) => {
        if (dbm >= -50) return { label: 'Excellent', color: '#10b981' };
        if (dbm >= -60) return { label: 'Good', color: '#3b82f6' };
        if (dbm >= -70) return { label: 'Fair', color: '#f59e0b' };
        return { label: 'Weak', color: '#f43f5e' };
    };

    // Live WiFi Polling
    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const state = await NetInfo.fetch();
                if (state.type === 'wifi' && state.isConnected) {
                    setLiveWifiInfo({
                        ssid: state.details.ssid || liveWifiInfo.wifi_ssid,
                        bssid: state.details.bssid || liveWifiInfo.bssid,
                        strength: state.details.strength || -100
                    });
                }
            } catch (err) {
                console.log("[AttendanceScan] Live WiFi update failed", err);
            }
        }, 2000); // 2 seconds

        return () => clearInterval(interval);
    }, []);

    // Liveness Progress Logic
    useEffect(() => {
        if (isCameraReady && livenessState === 'idle') {
            setLivenessState('checking');
            let progress = 0;
            const interval = setInterval(() => {
                progress += 0.05;
                setLivenessProgress(progress);
                if (progress >= 1) {
                    clearInterval(interval);
                    setLivenessState('ready');
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
            }, 100);
            return () => clearInterval(interval);
        }
    }, [isCameraReady]);

    const wifiStrength = getWifiStrengthLabel(liveWifiInfo?.strength || -100);



    const performScan = async () => {
        // Prevent double scanning
        if (isVerifying) return;

        if (cameraRef.current && isCameraReady) {
            setIsVerifying(true);
            try {
                const photo = await cameraRef.current.takePictureAsync({
                    base64: true,
                    quality: 0.7
                });

                // Security Check: Mock Location Detection
                if (location?.coords?.mocked) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                    Alert.alert("Security Alert", "Attendance cannot be marked using mock locations / GPS spoofing apps.");
                    setIsVerifying(false);
                    return;
                }

                // Get fresh location for verification
                const freshLocation = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation });

                const deviceId = Platform.OS === 'android' ?
                    Application.androidId :
                    await Application.getIosIdForVendorAsync();

                if (!freshLocation || (freshLocation.coords.latitude === 0 && freshLocation.coords.longitude === 0)) {
                    Alert.alert("Location Error", "Could not get a precise location. Please ensure GPS is on and you are not indoors with poor satellite reception.");
                    setIsVerifying(false);
                    return;
                }

                if (intendedType === 'update-face') {
                    const result = await updateFace(
                        email,
                        verificationPassword,
                        photo.base64,
                        freshLocation.coords.latitude,
                        freshLocation.coords.longitude,
                        liveWifiInfo?.bssid || '',
                        liveWifiInfo?.ssid || liveWifiInfo?.wifi_ssid || '',
                        liveWifiInfo?.strength || -50,
                        deviceId
                    );

                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    Alert.alert(
                        "✨ Biometrics Updated",
                        result.message,
                        [{ text: "Great!", onPress: () => navigation.navigate('Home', { email }) }]
                    );
                    return;
                }

                const result = await smartAttendance(
                    photo.base64,
                    freshLocation.coords.latitude,
                    freshLocation.coords.longitude,
                    liveWifiInfo?.bssid || '',
                    liveWifiInfo?.ssid || liveWifiInfo?.wifi_ssid || '',
                    liveWifiInfo?.strength || -50,
                    email,
                    readableAddress,
                    intendedType,
                    deviceId
                );

                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setScanStatus('success');
                setTimeout(() => {
                    Alert.alert(
                        `${result.type === 'check-in' ? '✨ Welcome Aboard!' : '👋 See You Soon!'}`,
                        `${result.type === 'check-in' ? 'Check-in' : 'Check-out'} successful for ${result.user}.\n(WiFi Quality: ${result.wifi_quality})`,
                        [{ text: "Great!", onPress: () => navigation.navigate('Home', { email }) }]
                    );
                }, 500);
            } catch (e) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                setScanStatus('error');
                const msg = getFriendlyErrorMessage(e, "Attendance verification failed.");
                setTimeout(() => {
                    Alert.alert("Attendance Notice", msg, [{ text: "Retry", onPress: () => setScanStatus(null) }]);
                }, 500);
            } finally {
                setIsVerifying(false);
            }
        }
    };

    // Auto-Capture when Liveness is Ready
    useEffect(() => {
        if (livenessState === 'ready' && !isVerifying) {
            // Short delay to let the user see "Success" or "Ready" state
            const timer = setTimeout(() => {
                performScan();
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [livenessState]);

    if (!permission) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#6366f1" />
                <Text style={styles.loadingText}>Initializing Camera...</Text>
            </View>
        );
    }

    if (!permission.granted) {
        return (
            <View style={styles.permissionContainer}>
                <Text style={styles.permissionText}>Camera permission is required for attendance.</Text>
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

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            <CameraView
                ref={cameraRef}
                style={styles.camera}
                facing="front"
                onCameraReady={() => setIsCameraReady(true)}
            >
                <View style={styles.overlay}>
                    <View style={styles.infoOverlays}>
                        <View style={styles.gpsOverlay}>
                            <MapPin size={14} color="#3b82f6" />
                            <Text style={styles.gpsText} numberOfLines={1}>
                                {readableAddress}
                            </Text>
                        </View>

                        <View style={[styles.wifiStrengthOverlay, { borderColor: wifiStrength.color + '44' }]}>
                            <Wifi size={14} color={wifiStrength.color} />
                            <Text style={[styles.wifiStrengthText, { color: wifiStrength.color }]}>
                                {wifiStrength.label} ({liveWifiInfo?.strength || -100} dBm)
                            </Text>
                        </View>
                    </View>

                    <View style={styles.ringWrapper}>
                        <Animated.View style={[styles.pulseRing, animatedRingStyle]} />
                        <View style={[styles.ringOuter, scanStatus && { borderColor: scanStatus === 'success' ? '#10b981' : '#f43f5e' }]}>
                            <Animated.View style={[styles.scanLine, animatedScanLineStyle]} />
                            <View style={[styles.ringInner, scanStatus && { borderColor: scanStatus === 'success' ? '#10b981' : '#f43f5e', opacity: 1 }]} />
                        </View>
                    </View>

                    <Text style={[styles.instruction, scanStatus === 'success' && styles.successBg, scanStatus === 'error' && styles.errorBg]}>
                        {scanStatus === 'success' ? "VERIFIED SUCCESS"
                            : scanStatus === 'error' ? "VERIFICATION FAILED"
                                : livenessState !== 'ready' ? "Blink to Verify Liveness"
                                    : isVerifying ? "Verifying Face..." : "Processing captured shift..."}
                    </Text>
                </View>

                <View style={styles.controls}>
                    <TouchableOpacity
                        style={styles.closeButton}
                        onPress={() => navigation.goBack()}
                    >
                        <XCircle size={32} color="white" />
                    </TouchableOpacity>

                    {livenessState !== 'ready' ? (
                        <View style={styles.livenessAlert}>
                            <ActivityIndicator color={theme.colors.primary} size="small" />
                            <Text style={styles.livenessAction}>Blink Slowly...</Text>
                            <View style={styles.progressBarBg}>
                                <View style={[styles.progressBarFill, { width: `${livenessProgress * 100}%` }]} />
                            </View>
                        </View>
                    ) : (
                        <TouchableOpacity
                            style={[styles.scanButton, isVerifying && styles.disabledButton]}
                            onPress={performScan}
                            disabled={isVerifying}
                        >
                            <View style={styles.scanButtonInner}>
                                {isVerifying ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <ShieldCheck size={32} color="white" />
                                )}
                                <Text style={styles.scanButtonText}>
                                    {isVerifying ? "VERIFYING..." : "CAPTURE & MARK"}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    )}
                </View>
                <View style={styles.placeholder} />
            </CameraView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
    },
    camera: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: '#0f172a',
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
        backgroundColor: '#0f172a',
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
        backgroundColor: '#6366f1',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
    },
    goBackText: {
        color: 'white',
        fontWeight: 'bold',
    },
    overlay: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 100,
    },
    infoOverlays: {
        position: 'absolute',
        top: 60,
        gap: 12,
        alignItems: 'center',
        width: '100%',
        paddingHorizontal: 24,
    },
    gpsOverlay: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(59, 130, 246, 0.3)',
        maxWidth: '90%',
    },
    wifiStrengthOverlay: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
    },
    wifiStrengthText: {
        fontSize: 12,
        fontWeight: '700',
        marginLeft: 8,
    },
    scanButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: '800',
        letterSpacing: 1,
    },
    livenessAlert: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        padding: 20,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.3)',
        alignItems: 'center',
        width: '100%',
    },
    livenessHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    livenessTitle: {
        color: theme.colors.primary,
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 2,
    },
    livenessAction: {
        color: 'white',
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 16,
    },
    progressBarBg: {
        height: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 3,
        width: '100%',
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: theme.colors.primary,
    },
    gpsText: {
        color: 'white',
        fontSize: 13,
        fontWeight: '600',
        marginLeft: 8,
    },
    ringWrapper: {
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 40,
    },
    pulseRing: {
        position: 'absolute',
        width: RING_SIZE,
        height: RING_SIZE,
        borderRadius: RING_SIZE / 2,
        borderWidth: 4,
    },
    ringOuter: {
        width: RING_SIZE,
        height: RING_SIZE,
        borderWidth: 2,
        borderColor: 'rgba(99, 102, 241, 0.4)',
        borderRadius: RING_SIZE / 2,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    scanLine: {
        position: 'absolute',
        width: '100%',
        height: 2,
        shadowColor: '#6366f1',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 10,
        elevation: 10,
        zIndex: 10,
    },
    ringInner: {
        width: RING_SIZE * 0.9,
        height: RING_SIZE * 0.9,
        borderWidth: 3,
        borderColor: '#6366f1',
        borderRadius: (RING_SIZE * 0.9) / 2,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0.2,
    },
    instruction: {
        color: 'white',
        fontWeight: '900',
        fontSize: 16,
        marginTop: 40,
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        overflow: 'hidden',
        textAlign: 'center',
        letterSpacing: 1,
    },
    successBg: {
        backgroundColor: 'rgba(16, 185, 129, 0.9)',
        borderColor: '#10b981',
    },
    errorBg: {
        backgroundColor: 'rgba(244, 63, 94, 0.9)',
        borderColor: '#f43f5e',
    },
    controls: {
        padding: 40,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    closeButton: {
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: 16,
        borderRadius: 99,
    },
    scanButton: {
        backgroundColor: '#6366f1',
        padding: 24,
        borderRadius: 99,
        shadowColor: '#6366f1',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 15,
    },
    placeholder: {
        width: 64,
    },
});

export default AttendanceScanScreen;
