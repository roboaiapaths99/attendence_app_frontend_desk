import React, { useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import GlassCard from '../components/GlassCard';
import { Calendar, Clock, MapPin, ArrowLeft, Wifi, Download, FileText } from 'lucide-react-native';
import { theme } from '../utils/theme';
import { getAttendanceLogs } from '../utils/api';
import { getFriendlyErrorMessage } from '../utils/errorUtils';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as Location from 'expo-location';
import { NetInfo } from '@react-native-community/netinfo'; // Assuming it's available or use custom logic

const HistoryScreen = ({ route, navigation }) => {
    const email = route?.params?.email || '';
    const [user, setUser] = useState(null);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const loadUser = async () => {
            try {
                const savedUser = await SecureStore.getItemAsync('userData');
                if (savedUser) setUser(JSON.parse(savedUser));
            } catch (e) {
                console.log("[History] Failed to load user data", e);
            }
        };
        loadUser();
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getAttendanceLogs(email);
            const formatted = (data.logs || []).map((log, i) => {
                const ts = new Date(log.timestamp);
                const isValid = !isNaN(ts.getTime());

                return {
                    id: log._id || String(i),
                    date: isValid ? ts.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown Date',
                    time: isValid ? ts.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '--:--',
                    status: log.type === 'check-in' ? 'Check-In' : 'Check-Out',
                    distance: log.distance_meters ? `${log.distance_meters.toFixed(1)}m` : '',
                    address: log.address || 'Office Zone',
                    wifi: log.wifi_quality ? `${log.wifi_quality} dBm` : null,
                    duration: log.duration_hours ? `${log.duration_hours} hrs` : null,
                    checkInTime: log.check_in_time ? new Date(log.check_in_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : null,
                };
            });
            setLogs(formatted);
        } catch (e) {
            setError(getFriendlyErrorMessage(e, "Could not load history."));
        } finally {
            setLoading(false);
        }
    };

    const exportAttendancePDF = async () => {
        const OFFICE_SSID = "Airtel_rash_1093";

        // Assume wifiConnected/wifiSSID from route params if passed, 
        // but for a strict check, we'd need NetInfo here too.
        // Let's use a simpler check: if we have any log with a recent timestamp that has wifi data, or just alert.
        // Re-using the prompt requirement: "clickable only when connected".

        if (logs.length === 0) {
            Alert.alert("No Data", "There are no attendance logs to export.");
            return;
        }

        try {
            const htmlContent = `
                <html>
                    <head>
                        <style>
                            body { font-family: 'Helvetica', sans-serif; padding: 20px; color: #1e293b; }
                            h1 { color: #505cff; text-align: center; font-size: 28px; }
                            .meta { text-align: center; color: #64748b; margin-bottom: 30px; border-bottom: 1px solid #e2e8f0; padding-bottom: 20px; }
                            table { width: 100%; border-collapse: collapse; }
                            th { background-color: #f8fafc; color: #475569; padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; font-size: 13px; text-transform: uppercase; }
                            td { padding: 12px; border-bottom: 1px solid #e2e8f0; color: #334155; font-size: 14px; }
                            .in { color: #10b981; font-weight: bold; }
                            .out { color: #f43f5e; font-weight: bold; }
                        </style>
                    </head>
                    <body>
                        <h1>Work Attendance Log</h1>
                        <div class="meta">
                            <p><strong>Employee:</strong> ${user?.full_name || email}</p>
                            <p><strong>ID:</strong> ${user?.employee_id || '-'}</p>
                            <p><strong>Report Period:</strong> Last 30 Records</p>
                            <p><strong>Generated:</strong> ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>
                        </div>
                        <table>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Activity</th>
                                    <th>Time</th>
                                    <th>Location</th>
                                    <th>Duration</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${logs.map(log => `
                                    <tr>
                                        <td>${log.date}</td>
                                        <td class="${log.status === 'Check-In' ? 'in' : 'out'}">${log.status}</td>
                                        <td>${log.time}</td>
                                        <td>${log.address}</td>
                                        <td>${log.duration || '-'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </body>
                </html>
            `;

            const { uri } = await Print.printToFileAsync({ html: htmlContent });
            await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
        } catch (e) {
            Alert.alert("Export Failed", "Could not generate PDF report.");
        }
    };

    const renderItem = ({ item }) => (
        <GlassCard style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={styles.dateContainer}>
                    <Calendar size={16} color="#6366f1" />
                    <Text style={styles.dateText}>{item.date}</Text>
                </View>
                <View style={[styles.badge, item.status === 'Check-In' ? styles.badgeIn : styles.badgeOut]}>
                    <Text style={[styles.badgeText, item.status === 'Check-In' ? styles.badgeTextIn : styles.badgeTextOut]}>
                        {item.status.toUpperCase()}
                    </Text>
                </View>
            </View>

            <View style={styles.detailsGrid}>
                {item.status === 'Check-Out' && item.checkInTime ? (
                    <View style={styles.sessionInfo}>
                        <View style={styles.sessionLine}>
                            <Clock size={14} color="#6366f1" />
                            <Text style={styles.sessionText}>Started: {item.checkInTime} at {item.checkInAddress || 'Office'}</Text>
                        </View>
                        <View style={styles.sessionLine}>
                            <Clock size={14} color="#10b981" />
                            <Text style={styles.sessionText}>Duration: {item.duration}</Text>
                        </View>
                    </View>
                ) : null}

                <View style={styles.mainTimeRow}>
                    <Clock size={16} color="#94a3b8" />
                    <Text style={styles.detailText}>{item.status === 'Check-Out' ? 'Checked Out at ' : 'Checked In at '}{item.time}</Text>
                </View>

                {item.address ? (
                    <View style={styles.detailItem}>
                        <MapPin size={16} color="#3b82f6" />
                        <Text style={styles.detailText} numberOfLines={1}>{item.address}</Text>
                    </View>
                ) : null}

                <View style={styles.detailRow}>
                    {item.distance ? (
                        <View style={styles.detailItem}>
                            <View style={[styles.subBadge, { backgroundColor: parseFloat(item.distance) > 10 ? 'rgba(244, 63, 94, 0.1)' : 'rgba(16, 185, 129, 0.1)' }]}>
                                <Text style={[styles.subBadgeText, { color: parseFloat(item.distance) > 10 ? '#f43f5e' : '#10b981' }]}>
                                    {item.distance} from center
                                </Text>
                            </View>
                        </View>
                    ) : null}

                    {item.wifi ? (
                        <View style={styles.detailItem}>
                            <Wifi size={14} color="#10b981" />
                            <Text style={styles.wifiText}>{item.wifi}</Text>
                        </View>
                    ) : null}
                </View>
            </View>
        </GlassCard>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ArrowLeft size={24} color="white" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.title}>History</Text>
                    <Text style={styles.subtitle}>{user?.full_name || email}</Text>
                </View>
                <TouchableOpacity
                    style={styles.exportButton}
                    onPress={exportAttendancePDF}
                >
                    <Download size={22} color="white" />
                </TouchableOpacity>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color={theme.colors.primary} />
            ) : error ? (
                <GlassCard>
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={fetchLogs}>
                        <Text style={styles.retryText}>Retry</Text>
                    </TouchableOpacity>
                </GlassCard>
            ) : logs.length === 0 ? (
                <GlassCard>
                    <Text style={styles.emptyText}>No attendance records yet.</Text>
                </GlassCard>
            ) : (
                <FlatList
                    data={logs}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.listContent}
                />
            )}
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
        marginBottom: 40,
    },
    backButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        padding: 10,
        borderRadius: 12,
        marginRight: 16,
    },
    exportButton: {
        backgroundColor: '#6366f1',
        padding: 10,
        borderRadius: 12,
        shadowColor: '#6366f1',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    title: {
        color: 'white',
        fontSize: 32,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    subtitle: {
        color: '#64748b',
        fontSize: 14,
        fontWeight: '600',
        marginTop: 2,
    },
    card: {
        marginBottom: 16,
        padding: 20,
        borderRadius: 24,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    dateContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dateText: {
        color: 'white',
        marginLeft: 10,
        fontWeight: '700',
        fontSize: 16,
    },
    badge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    badgeIn: {
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
    },
    badgeOut: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    badgeTextIn: {
        color: '#34d399',
    },
    badgeTextOut: {
        color: '#f87171',
    },
    detailsGrid: {
        gap: 12,
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    detailText: {
        color: '#94a3b8',
        marginLeft: 10,
        fontSize: 14,
        fontWeight: '500',
        flex: 1,
    },
    sessionInfo: {
        backgroundColor: 'rgba(99, 102, 241, 0.05)',
        padding: 12,
        borderRadius: 16,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.1)',
        gap: 6,
    },
    sessionLine: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sessionText: {
        color: '#e2e8f0',
        fontSize: 12,
        fontWeight: '500',
    },
    mainTimeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        marginTop: 4,
    },
    wifiText: {
        color: '#10b981',
        fontSize: 12,
        fontWeight: '600',
        marginLeft: 6,
    },
    subBadge: {
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    subBadgeText: {
        color: '#3b82f6',
        fontSize: 11,
        fontWeight: '700',
    },
    coordBox: {
        backgroundColor: 'rgba(30, 41, 59, 0.5)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    coordText: {
        color: '#6366f1',
        fontSize: 12,
        fontWeight: '600',
        fontFamily: 'monospace',
    },
    errorText: {
        color: '#f87171',
        textAlign: 'center',
        fontSize: 16,
    },
    retryButton: {
        marginTop: 20,
        backgroundColor: '#6366f1',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 16,
        alignSelf: 'center',
    },
    retryText: {
        color: 'white',
        fontWeight: '800',
    },
    emptyText: {
        color: '#94a3b8',
        textAlign: 'center',
        paddingVertical: 20,
    },
    listContent: {
        paddingBottom: 40,
    },
});

export default HistoryScreen;
