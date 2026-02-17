import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet, Dimensions } from 'react-native';
import GlassCard from '../components/GlassCard';
import { theme } from '../utils/theme';
import { getAnalytics } from '../utils/api';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import NetInfo from '@react-native-community/netinfo';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';
import { Scan, Wifi, MapPin, History, LogOut, TrendingUp, User, Clock as ClockIcon } from 'lucide-react-native';

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

    useEffect(() => {
        (async () => {
            // Fetch User Details if missing from route (for auto-login)
            if (!user) {
                try {
                    const savedUser = await SecureStore.getItemAsync('userData');
                    if (savedUser) setUser(JSON.parse(savedUser));
                } catch (e) {
                    console.log("[Home] Failed to load saved user", e);
                }
            }
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Location permission is required for attendance & WiFi verification.');
                return;
            }

            // Get Location
            let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
            setLocation(loc);

            // Get WiFi Info
            const state = await NetInfo.fetch();
            if (state.type === 'wifi' && state.isConnected) {
                setWifiConnected(true);
                setWifiInfo({
                    ssid: state.details.ssid || '',
                    bssid: state.details.bssid || '',
                    strength: state.details.strength || -50
                });
            } else {
                setWifiConnected(false);
            }

            // Fetch Analytics
            fetchStats();
        })();
    }, []);

    const fetchStats = async () => {
        try {
            const data = await getAnalytics(email);
            setAnalytics(data);
        } catch (err) {
            console.error("Failed to fetch analytics", err);
        } finally {
            setLoadingAnalytics(false);
        }
    };

    const isOfficeWiFi = wifiConnected && wifiInfo.ssid === "Airtel_rash_1093";

    const handleScanPress = (type) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const OFFICE_SSID = "Airtel_rash_1093";

        if (!isOfficeWiFi) {
            Alert.alert(
                "WiFi Required",
                `Please connect to the office WiFi (${OFFICE_SSID}) to perform check-in/out.`
            );
            return;
        }

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
                    onPress={() => navigation.navigate('Profile', { email })}
                >
                    <View style={styles.avatarMini}>
                        <User size={18} color="white" />
                    </View>
                    <View>
                        <Text style={styles.greeting}>Welcome Back,</Text>
                        <Text style={styles.userEmail} numberOfLines={1}>{user?.full_name || email || 'Guest User'}</Text>
                    </View>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.logoutButton}
                    onPress={() => navigation.navigate('Login')}
                >
                    <LogOut size={20} color="#f43f5e" />
                </TouchableOpacity>
            </View>

            <View style={styles.statsContainer}>
                <GlassCard style={styles.statCard}>
                    <View style={[styles.iconBox, { backgroundColor: wifiConnected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)' }]}>
                        <Wifi size={24} color={wifiConnected ? "#10b981" : "#f43f5e"} />
                    </View>
                    <Text style={styles.statTitle}>WiFi Status</Text>
                    <Text style={[styles.statSubtitle, { color: wifiConnected ? '#10b981' : '#f43f5e' }]}>
                        {wifiConnected ? (wifiInfo.ssid || 'Connected') : 'Disconnected'}
                    </Text>
                </GlassCard>
                <GlassCard style={styles.statCard}>
                    <View style={[styles.iconBox, { backgroundColor: location ? 'rgba(59, 130, 246, 0.1)' : 'rgba(244, 63, 94, 0.1)' }]}>
                        <MapPin size={24} color={location ? "#3b82f6" : "#f43f5e"} />
                    </View>
                    <Text style={styles.statTitle}>GPS Ready</Text>
                    <Text style={[styles.statSubtitle, { color: location ? '#3b82f6' : '#f43f5e' }]}>
                        {location ? 'Active' : 'Searching...'}
                    </Text>
                </GlassCard>
            </View>

            <View style={styles.analyticsSection}>
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

                <GlassCard style={styles.analyticsCard}>
                    <View style={styles.analyticsHeader}>
                        <View style={styles.headerTitleRow}>
                            <TrendingUp size={18} color="#10b981" />
                            <Text style={styles.analyticsTitle}>WEEKLY TOTAL</Text>
                        </View>
                        <Text style={styles.goalText}>This Week</Text>
                    </View>
                    <View style={styles.analyticsContent}>
                        <View style={styles.weeklyValueContainer}>
                            <Text style={styles.weeklyValue}>{analytics.week_total.toFixed(1)}</Text>
                            <Text style={styles.weeklyLabel}>TOTAL HOURS</Text>
                        </View>
                        <View style={styles.miniChartContainer}>
                            <View style={styles.miniChart}>
                                {Object.values(analytics.daily_breakdown).slice(-7).map((h, i) => (
                                    <View
                                        key={i}
                                        style={[
                                            styles.chartBar,
                                            {
                                                height: Math.max(4, (h / 12) * 50),
                                                backgroundColor: h >= 8 ? '#10b981' : 'rgba(16, 185, 129, 0.3)'
                                            }
                                        ]}
                                    />
                                ))}
                            </View>
                            <Text style={styles.chartLabel}>Last 7 Days</Text>
                        </View>
                    </View>
                </GlassCard>
            </View>

            <View style={styles.centerSection}>
                <View style={styles.buttonRow}>
                    <TouchableOpacity
                        style={[
                            styles.actionButton,
                            styles.checkInButton,
                            (analytics.current_status === 'check-in' || !isOfficeWiFi) && styles.disabledButton
                        ]}
                        onPress={() => handleScanPress('check-in')}
                        disabled={analytics.current_status === 'check-in'}
                    >
                        <Scan size={32} color="white" />
                        <Text style={styles.actionButtonText}>CHECK IN</Text>
                        {!isOfficeWiFi ? (
                            <Text style={styles.lockText}>OFFICE ONLY</Text>
                        ) : analytics.current_status === 'check-in' && (
                            <Text style={styles.lockText}>ALREADY IN</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.actionButton,
                            styles.checkOutButton,
                            (analytics.current_status === 'check-out' || !isOfficeWiFi) && styles.disabledButton
                        ]}
                        onPress={() => handleScanPress('check-out')}
                        disabled={analytics.current_status === 'check-out'}
                    >
                        <LogOut size={32} color="white" />
                        <Text style={styles.actionButtonText}>CHECK OUT</Text>
                        {!isOfficeWiFi ? (
                            <Text style={styles.lockText}>OFFICE ONLY</Text>
                        ) : analytics.current_status === 'check-out' && (
                            <Text style={styles.lockText}>ALREADY OUT</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            <TouchableOpacity
                style={[styles.historyButton, !isOfficeWiFi && styles.disabledHistory]}
                onPress={() => {
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
        shadowColor: '#6366f1',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
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
        padding: 12,
        borderRadius: 16,
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
        marginBottom: 12,
    },
    statTitle: {
        color: 'white',
        fontSize: 14,
        fontWeight: '700',
    },
    statSubtitle: {
        fontSize: 12,
        marginTop: 4,
        fontWeight: '500',
    },
    centerSection: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        gap: 16,
    },
    actionButton: {
        flex: 1,
        height: 160,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
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
    actionButtonText: {
        color: 'white',
        fontWeight: '900',
        fontSize: 16,
        marginTop: 12,
        letterSpacing: 1,
    },
    historyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(30, 41, 59, 0.5)',
        paddingVertical: 20,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
        marginBottom: 32,
    },
    historyText: {
        color: '#94a3b8',
        fontWeight: '700',
        fontSize: 15,
        marginLeft: 12,
        letterSpacing: 0.5,
    },
    analyticsSection: {
        flexDirection: 'column',
        gap: 16,
        marginBottom: 32,
    },
    analyticsCard: {
        padding: 20,
        borderRadius: 24,
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
        gap: 8,
    },
    analyticsTitle: {
        color: '#94a3b8',
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 1,
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
        fontSize: width > 380 ? 32 : 28,
        fontWeight: '900',
    },
    hoursUnit: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: '600',
    },
    hoursLabel: {
        color: '#64748b',
        fontSize: 10,
        fontWeight: '800',
        marginTop: -4,
        letterSpacing: 1,
    },
    goalText: {
        color: '#6366f1',
        fontSize: 11,
        fontWeight: '700',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusBadge: {
        marginTop: 12,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
    },
    statusBadgeText: {
        fontSize: 10,
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
    disabledButton: {
        opacity: 0.5,
        backgroundColor: '#1e293b',
        borderColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
    },
    disabledHistory: {
        opacity: 0.5,
    },
    lockText: {
        color: '#64748b',
        fontSize: 10,
        fontWeight: '700',
        marginTop: 4,
        letterSpacing: 1,
    },
});

export default HomeScreen;
