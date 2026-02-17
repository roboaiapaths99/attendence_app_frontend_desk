import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet, Dimensions, Image } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import GlassCard from '../components/GlassCard';
import { theme } from '../utils/theme';
import { getAnalytics } from '../utils/api';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import NetInfo from '@react-native-community/netinfo';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';
import { Scan, Wifi, MapPin, History, LogOut, TrendingUp, User, Clock as ClockIcon, RefreshCcw } from 'lucide-react-native';
import * as Reanimated from 'react-native-reanimated';
const {
    FadeInUp,
    FadeInDown,
    Layout,
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withSequence,
    withTiming,
    withRepeat
} = Reanimated;
const Animated = Reanimated.default || Reanimated;

const { width } = Dimensions.get('window');

const ProgressRing = ({ progress, size, strokeWidth, color }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (progress / 100) * circumference;

    return (
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={size} height={size}>
                <Circle
                    stroke="rgba(255,255,255,0.05)"
                    fill="none"
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    strokeWidth={strokeWidth}
                />
                <Circle
                    stroke={color}
                    fill="none"
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${circumference} ${circumference}`}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
            </Svg>
            <View style={{ position: 'absolute' }}>
                <Text style={{ color: 'white', fontSize: 18, fontWeight: '800' }}>{Math.round(progress)}%</Text>
            </View>
        </View>
    );
};

const HomeScreen = ({ route, navigation }) => {
    const email = route?.params?.email || '';
    const [user, setUser] = useState(route?.params?.user || null);
    const [location, setLocation] = useState(null);
    const [wifiConnected, setWifiConnected] = useState(false);
    const [wifiInfo, setWifiInfo] = useState({ ssid: '', bssid: '', strength: -50 });
    const [analytics, setAnalytics] = useState({
        today_hours: 0,
        week_total: 0,
        daily_breakdown: {},
        current_status: 'check-out' // Default: can check in
    });
    const [loadingAnalytics, setLoadingAnalytics] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [readableAddress, setReadableAddress] = useState('Locating...');

    const isFocused = useIsFocused();

    // Animation values
    const refreshRotation = useSharedValue(0);
    const activePulse = useSharedValue(1);

    // 1. Handle Pulse Animation on Mount
    useEffect(() => {
        activePulse.value = withRepeat(
            withSequence(
                withTiming(1.05, { duration: 1000 }),
                withTiming(1, { duration: 1000 })
            ),
            -1,
            true
        );
    }, []);

    // 2. Refresh Device State (WiFi/GPS)
    const refreshDeviceState = async () => {
        try {
            // Get WiFi Info
            const state = await NetInfo.fetch();
            if (state.type === 'wifi' && state.isConnected) {
                setWifiConnected(true);
                setWifiInfo({
                    ssid: state.details.ssid || 'CONNECTED',
                    bssid: state.details.bssid || '',
                    strength: state.details.strength || -50
                });
            } else {
                setWifiConnected(false);
            }

            // Get Location
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
                let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
                setLocation(loc);

                const reverse = await Location.reverseGeocodeAsync({
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude
                });
                if (reverse && reverse.length > 0) {
                    const item = reverse[0];
                    const locName = item.name || item.street || item.district || item.city || 'Verified Zone';
                    setReadableAddress(locName);
                }
            }
        } catch (err) {
            console.log("[Home] Device state refresh failed", err);
        }
    };

    // 3. Main Data Fetch & Focus Refresh
    useEffect(() => {
        if (isFocused) {
            fetchStats();
            refreshDeviceState();
        }
    }, [isFocused]);

    // Initial Load for User Data
    useEffect(() => {
        (async () => {
            if (!user) {
                try {
                    const savedUser = await SecureStore.getItemAsync('userData');
                    if (savedUser) setUser(JSON.parse(savedUser));
                } catch (e) {
                    console.log("[Home] Failed to load saved user", e);
                }
            }
        })();
    }, []);

    const fetchStats = async () => {
        setIsRefreshing(true);
        refreshRotation.value = withRepeat(
            withTiming(360, { duration: 1000 }),
            -1,
            false
        );

        try {
            const data = await getAnalytics(email);
            setAnalytics(data);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (err) {
            console.error("Failed to fetch analytics", err);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setLoadingAnalytics(false);
            setIsRefreshing(false);
            refreshRotation.value = withTiming(0);
        }
    };

    const animatedRefreshStyle = useAnimatedStyle(() => {
        return {
            transform: [{ rotate: `${refreshRotation.value}deg` }]
        };
    });

    const animatedActiveButtonStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: activePulse.value }]
        };
    });

    const OFFICE_SSID = analytics?.office_wifi_ssid || "";
    // If OFFICE_SSID is set, require a match. If not set, allow any WiFi for testing.
    const isOfficeWiFi = wifiConnected && (OFFICE_SSID === "" || wifiInfo.ssid === OFFICE_SSID);

    const handleScanPress = (type) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        if (!isOfficeWiFi && OFFICE_SSID !== "") {
            Alert.alert(
                "Unverified Network",
                `You are connected to "${wifiInfo.ssid || 'Unknown WiFi'}".\n\nOfficial Office WiFi is "${OFFICE_SSID}".\n\nProgess? verification may fail on the server.`,
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Continue Anyway", onPress: () => navigateToScan(type) }
                ]
            );
            return;
        }

        navigateToScan(type);
    };

    const navigateToScan = (type) => {
        navigation.navigate('AttendanceScan', {
            location,
            wifiInfo: {
                bssid: wifiInfo.bssid,
                wifi_ssid: wifiInfo.ssid,
                strength: wifiInfo.strength
            },
            email,
            intendedType: type
        });
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.profileButton}
                    onPress={() => {
                        Haptics.selectionAsync();
                        navigation.navigate('Profile', { email });
                    }}
                >
                    <View style={styles.avatarMini}>
                        {user?.profile_image ? (
                            <Image
                                source={{ uri: `data:image/jpeg;base64,${user.profile_image}` }}
                                style={styles.avatarImageMini}
                            />
                        ) : (
                            <User size={18} color="white" />
                        )}
                    </View>
                    <View>
                        <Text style={styles.greeting}>Welcome Back,</Text>
                        <Text style={styles.userEmail} numberOfLines={1}>{user?.full_name || email || 'Guest User'}</Text>
                    </View>
                </TouchableOpacity>

                <View style={styles.headerActions}>
                    <TouchableOpacity
                        style={styles.iconCircle}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            fetchStats();
                        }}
                    >
                        <Animated.View style={animatedRefreshStyle}>
                            <RefreshCcw size={20} color="#6366f1" />
                        </Animated.View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.logoutButton}
                        onPress={() => {
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                            navigation.navigate('Login');
                        }}
                    >
                        <LogOut size={20} color="#f43f5e" />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.statsContainer}>
                <Animated.View
                    entering={FadeInUp.delay(100).duration(600)}
                    style={styles.statCardWrapper}
                >
                    <GlassCard style={styles.statCard}>
                        <View style={[styles.iconBox, { backgroundColor: isOfficeWiFi ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)' }]}>
                            <Wifi size={24} color={isOfficeWiFi ? "#10b981" : "#f43f5e"} />
                        </View>
                        <Text style={styles.statTitle}>OFFICE WIFI</Text>
                        <Text style={[styles.statHighlight, { color: isOfficeWiFi ? '#10b981' : '#f43f5e' }]} numberOfLines={1}>
                            {wifiConnected ? (wifiInfo.ssid || 'CONNECTED') : 'OFFLINE'}
                        </Text>
                    </GlassCard>
                </Animated.View>

                <Animated.View
                    entering={FadeInUp.delay(200).duration(600)}
                    style={styles.statCardWrapper}
                >
                    <GlassCard style={styles.statCard}>
                        <View style={[styles.iconBox, { backgroundColor: location ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)' }]}>
                            <MapPin size={24} color={location ? "#10b981" : "#f43f5e"} />
                        </View>
                        <Text style={styles.statTitle}>GPS LOCATION</Text>
                        <Text style={[styles.statHighlight, { color: location ? '#10b981' : '#f43f5e' }]} numberOfLines={1}>
                            {location ? readableAddress : 'SEARCHING...'}
                        </Text>
                    </GlassCard>
                </Animated.View>
            </View>

            <View style={styles.analyticsSection}>
                <Animated.View entering={FadeInUp.delay(300).duration(700)}>
                    <GlassCard style={styles.analyticsCard}>
                        <View style={styles.analyticsHeader}>
                            <View style={styles.headerTitleRow}>
                                <ClockIcon size={18} color="#6366f1" />
                                <Text style={styles.analyticsTitle}>DAILY PROGRESS</Text>
                            </View>
                            <Text style={styles.goalText}>Goal: 8.0 hrs</Text>
                        </View>
                        <View style={styles.analyticsContent}>
                            <ProgressRing
                                progress={Math.min(100, (analytics.today_hours / 8) * 100)}
                                size={width > 380 ? 90 : 80}
                                strokeWidth={10}
                                color="#6366f1"
                            />
                            <View style={styles.analyticsDetails}>
                                <Text style={styles.hoursValue}>{analytics.today_hours.toFixed(1)} <Text style={styles.hoursUnit}>hrs</Text></Text>
                                <Text style={styles.hoursLabel}>WORKED TODAY</Text>
                                <View style={[styles.statusBadge, { backgroundColor: analytics.today_hours >= 8 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(99, 102, 241, 0.1)' }]}>
                                    <Text style={[styles.statusBadgeText, { color: analytics.today_hours >= 8 ? '#10b981' : '#6366f1' }]}>
                                        {analytics.today_hours >= 8 ? 'GOAL REACHED' : 'IN PROGRESS'}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </GlassCard>
                </Animated.View>

            </View>

            <Animated.View entering={FadeInDown.delay(500).duration(800)} style={styles.centerSection}>
                <View style={styles.buttonRow}>
                    <Animated.View style={[styles.actionButtonWrapper, analytics.current_status === 'check-out' && isOfficeWiFi && animatedActiveButtonStyle]}>
                        <TouchableOpacity
                            style={[
                                styles.actionButton,
                                styles.checkInButton,
                                (analytics.current_status === 'check-in' || !isOfficeWiFi) && styles.disabledButton
                            ]}
                            onPress={() => handleScanPress('check-in')}
                            disabled={analytics.current_status === 'check-in'}
                        >
                            <View style={styles.actionIconContainer}>
                                <Scan size={32} color="white" />
                            </View>
                            <Text style={styles.actionButtonText}>CHECK IN</Text>
                            <View style={styles.statusIndicator}>
                                {!isOfficeWiFi ? (
                                    <Text style={styles.lockText}>OFFICE WIFI ONLY</Text>
                                ) : analytics.current_status === 'check-in' ? (
                                    <Text style={styles.lockText}>ALREADY IN</Text>
                                ) : (
                                    <Text style={styles.activeText}>READY</Text>
                                )}
                            </View>
                        </TouchableOpacity>
                    </Animated.View>

                    <Animated.View style={[styles.actionButtonWrapper, analytics.current_status === 'check-in' && isOfficeWiFi && animatedActiveButtonStyle]}>
                        <TouchableOpacity
                            style={[
                                styles.actionButton,
                                styles.checkOutButton,
                                (analytics.current_status === 'check-out' || !isOfficeWiFi) && styles.disabledButton
                            ]}
                            onPress={() => handleScanPress('check-out')}
                            disabled={analytics.current_status === 'check-out'}
                        >
                            <View style={styles.actionIconContainer}>
                                <LogOut size={32} color="white" />
                            </View>
                            <Text style={styles.actionButtonText}>CHECK OUT</Text>
                            <View style={styles.statusIndicator}>
                                {!isOfficeWiFi ? (
                                    <Text style={styles.lockText}>OFFICE WIFI ONLY</Text>
                                ) : analytics.current_status === 'check-out' ? (
                                    <Text style={styles.lockText}>ALREADY OUT</Text>
                                ) : (
                                    <Text style={styles.activeText}>READY</Text>
                                )}
                            </View>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(600).duration(800)}>
                <TouchableOpacity
                    style={[styles.historyButton, !isOfficeWiFi && styles.disabledHistory]}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        if (!isOfficeWiFi) {
                            Alert.alert("WiFi Restricted", "Attendance logs are only accessible on the Office network.");
                            return;
                        }
                        navigation.navigate('History', { email });
                    }}
                >
                    <History size={20} color={isOfficeWiFi ? "#94a3b8" : "#475569"} />
                    <Text style={[styles.historyText, !isOfficeWiFi && { color: "#475569" }]}>ATTENDANCE HISTORY</Text>
                </TouchableOpacity>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
        paddingHorizontal: 24,
        paddingTop: 64,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 32,
        marginTop: 20,
    },
    profileButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        padding: 8,
        paddingRight: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    avatarMini: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#6366f1',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden', // Added to contain the image
        shadowColor: '#6366f1',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    avatarImageMini: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    greeting: {
        color: 'white',
        fontSize: 16,
        fontWeight: '800',
    },
    userEmail: {
        color: '#94a3b8',
        fontSize: 12,
        fontWeight: '500',
    },
    logoutButton: {
        backgroundColor: 'rgba(244, 63, 94, 0.1)',
        padding: 10,
        borderRadius: 14,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    iconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    statCardWrapper: {
        flex: 1,
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 40,
    },
    statCard: {
        flex: 1,
        marginHorizontal: 8,
        alignItems: 'center',
        padding: 20,
        borderRadius: 24,
    },
    iconBox: {
        padding: 12,
        borderRadius: 16,
        marginBottom: 10,
    },
    statTitle: {
        color: '#94a3b8',
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 1,
    },
    statHighlight: {
        fontSize: 14,
        marginTop: 4,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    analyticsSection: {
        marginBottom: 24,
    },
    analyticsCard: {
        padding: 24,
        borderRadius: 28,
    },
    analyticsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    analyticsTitle: {
        color: '#94a3b8',
        fontSize: 13,
        fontWeight: '800',
        letterSpacing: 1.5,
    },
    analyticsContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 20,
    },
    analyticsDetails: {
        flex: 1,
        alignItems: 'flex-start',
    },
    hoursValue: {
        color: 'white',
        fontSize: width > 380 ? 38 : 32,
        fontWeight: '900',
    },
    hoursUnit: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: '600',
    },
    hoursLabel: {
        color: '#64748b',
        fontSize: 12,
        fontWeight: '700',
        marginTop: 4,
    },
    goalText: {
        color: '#6366f1',
        fontSize: 11,
        fontWeight: '800',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusBadge: {
        marginTop: 16,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    statusBadgeText: {
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    weeklyValueContainer: {
        alignItems: 'flex-start',
    },
    weeklyValue: {
        color: 'white',
        fontSize: width > 380 ? 36 : 32,
        fontWeight: '900',
    },
    weeklyLabel: {
        color: '#94a3b8',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1,
        marginTop: -4,
    },
    miniChartContainer: {
        alignItems: 'flex-end',
        flex: 1,
    },
    miniChart: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 6,
        height: 50,
    },
    chartBar: {
        width: 10,
        borderRadius: 5,
    },
    chartLabel: {
        color: '#475569',
        fontSize: 10,
        fontWeight: '700',
        marginTop: 8,
    },
    centerSection: {
        marginVertical: 10,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 16,
    },
    actionButtonWrapper: {
        flex: 1,
    },
    actionButton: {
        height: 190,
        borderRadius: 36,
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 15,
    },
    checkInButton: {
        backgroundColor: '#6366f1',
        shadowColor: '#6366f1',
    },
    checkOutButton: {
        backgroundColor: '#f43f5e',
        shadowColor: '#f43f5e',
    },
    actionIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    actionButtonText: {
        color: 'white',
        fontWeight: '900',
        fontSize: 18,
        letterSpacing: 1,
    },
    statusIndicator: {
        marginTop: 12,
        backgroundColor: 'rgba(0,0,0,0.25)',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 10,
    },
    activeText: {
        color: 'rgba(255,255,255,1)',
        fontSize: 11,
        fontWeight: '900',
    },
    lockText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 9,
        fontWeight: '800',
        textAlign: 'center',
        letterSpacing: 0.5,
    },
    disabledButton: {
        opacity: 0.4,
        backgroundColor: '#1e293b',
    },
    historyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(30, 41, 59, 0.4)',
        paddingVertical: 20,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
        marginVertical: 20,
    },
    historyText: {
        color: '#94a3b8',
        fontWeight: '800',
        fontSize: 14,
        marginLeft: 12,
        letterSpacing: 1,
    },
    disabledHistory: {
        opacity: 0.5,
    },
});

export default HomeScreen;
