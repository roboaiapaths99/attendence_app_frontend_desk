import React, { useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal, TextInput, ActivityIndicator, Image } from 'react-native';
import GlassCard from '../components/GlassCard';
import { User, Mail, Shield, ChevronRight, LogOut, ArrowLeft, Award, Settings, Lock } from 'lucide-react-native';
import { theme } from '../utils/theme';
import { updateFace } from '../utils/api';
import { getFriendlyErrorMessage } from '../utils/errorUtils';

const ProfileScreen = ({ route, navigation }) => {
    const { email } = route.params || {};
    const [isModalVisible, setModalVisible] = useState(false);
    const [password, setPassword] = useState('');
    const [updating, setUpdating] = useState(false);

    const [user, setUser] = useState(null);

    useEffect(() => {
        const loadUser = async () => {
            try {
                const savedUser = await SecureStore.getItemAsync('userData');
                if (savedUser) setUser(JSON.parse(savedUser));
            } catch (e) {
                console.log("[Profile] Failed to load user data", e);
            }
        };
        loadUser();
    }, []);

    const profileData = {
        name: user?.full_name || email?.split('@')[0] || 'User',
        email: user?.email || email || 'user@office.flow',
        id: user?.employee_id || '...',
        department: user?.department || '...',
        designation: user?.designation || '...',
        joined: user?.created_at ? new Date(user.created_at).toLocaleDateString() : '...'
    };

    const handleReenrollment = async () => {
        if (!password) {
            Alert.alert("Required", "Please enter your password to continue.");
            return;
        }

        setUpdating(true);
        try {
            // We verify the identity by asking for password. 
            // In a real app we might call a verify-password endpoint, 
            // but here we navigate to the scan screen with the verification info.
            setModalVisible(false);
            navigation.navigate('AttendanceScan', {
                email,
                intendedType: 'update-face',
                verificationPassword: password
            });
        } catch (e) {
            Alert.alert("Verification Failed", getFriendlyErrorMessage(e));
        } finally {
            setUpdating(false);
            setPassword('');
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ArrowLeft size={24} color="white" />
                </TouchableOpacity>
                <Text style={styles.title}>My Profile</Text>
                <TouchableOpacity style={styles.settingsButton}>
                    <Settings size={20} color="white" />
                </TouchableOpacity>
            </View>

            <View style={styles.profileHero}>
                <View style={styles.avatarContainer}>
                    <View style={styles.avatarInner}>
                        {user?.profile_image ? (
                            <Image
                                source={{ uri: `data:image/jpeg;base64,${user.profile_image}` }}
                                style={styles.avatarImage}
                            />
                        ) : (
                            <User size={60} color="white" strokeWidth={1.5} />
                        )}
                    </View>
                    <View style={styles.badgeContainer}>
                        <Shield size={16} color="white" />
                    </View>
                </View>
                <Text style={styles.userName}>{profileData.name.toUpperCase()}</Text>
                <Text style={styles.userRole}>{profileData.designation} • {profileData.department}</Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Employee Information</Text>
                <GlassCard style={styles.infoCard}>
                    <View style={styles.infoItem}>
                        <View style={styles.iconBox}>
                            <User size={18} color="#6366f1" />
                        </View>
                        <View style={styles.infoTextContainer}>
                            <Text style={styles.infoLabel}>Full Name</Text>
                            <Text style={styles.infoValue}>{profileData.name}</Text>
                        </View>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.infoItem}>
                        <View style={styles.iconBox}>
                            <Mail size={18} color="#6366f1" />
                        </View>
                        <View style={styles.infoTextContainer}>
                            <Text style={styles.infoLabel}>Email Address</Text>
                            <Text style={styles.infoValue}>{profileData.email}</Text>
                        </View>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.infoItem}>
                        <View style={styles.iconBox}>
                            <Award size={18} color="#6366f1" />
                        </View>
                        <View style={styles.infoTextContainer}>
                            <Text style={styles.infoLabel}>Employee ID</Text>
                            <Text style={styles.infoValue}>{profileData.id}</Text>
                        </View>
                    </View>
                </GlassCard>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Preferences & Security</Text>
                <GlassCard style={styles.optionsCard}>
                    <TouchableOpacity
                        style={styles.optionItem}
                        onPress={() => setModalVisible(true)}
                    >
                        <View style={styles.optionRow}>
                            <Lock size={18} color="#6366f1" style={{ marginRight: 12 }} />
                            <Text style={styles.optionText}>Face Re-enrollment</Text>
                        </View>
                        <ChevronRight size={18} color="#64748b" />
                    </TouchableOpacity>
                    <View style={styles.divider} />
                    <TouchableOpacity style={styles.optionItem}>
                        <Text style={styles.optionText}>Notifications</Text>
                        <ChevronRight size={18} color="#64748b" />
                    </TouchableOpacity>
                </GlassCard>
            </View>

            <TouchableOpacity
                style={styles.logoutButton}
                onPress={async () => {
                    try {
                        // Wipe all session data
                        await Promise.all([
                            SecureStore.deleteItemAsync('userEmail'),
                            SecureStore.deleteItemAsync('userPassword'),
                            SecureStore.deleteItemAsync('userData')
                        ]);
                        navigation.navigate('Login');
                    } catch (e) {
                        console.error("[Profile] Logout failed", e);
                        navigation.navigate('Login'); // Fallback
                    }
                }}
            >
                <LogOut size={20} color="#f43f5e" />
                <Text style={styles.logoutText}>Logout from Device</Text>
            </TouchableOpacity>

            <Text style={styles.versionText}>OfficeFlow v2.4.1 (Premium)</Text>

            <Modal
                animationType="slide"
                transparent={true}
                visible={isModalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <GlassCard style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Security Verification</Text>
                            <Text style={styles.modalSubtitle}>Enter your password to update face data</Text>
                        </View>

                        <TextInput
                            style={styles.input}
                            placeholder="Current Password"
                            placeholderTextColor="#64748b"
                            secureTextEntry
                            value={password}
                            onChangeText={setPassword}
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={() => {
                                    setModalVisible(false);
                                    setPassword('');
                                }}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.confirmButton]}
                                onPress={handleReenrollment}
                                disabled={updating}
                            >
                                {updating ? (
                                    <ActivityIndicator size="small" color="white" />
                                ) : (
                                    <Text style={styles.confirmButtonText}>Verify</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </GlassCard>
                </View>
            </Modal>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
    },
    content: {
        padding: 24,
        paddingTop: 64,
        paddingBottom: 40,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 32,
    },
    backButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        padding: 10,
        borderRadius: 12,
    },
    settingsButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        padding: 10,
        borderRadius: 12,
    },
    title: {
        color: 'white',
        fontSize: 20,
        fontWeight: '800',
    },
    profileHero: {
        alignItems: 'center',
        marginBottom: 40,
    },
    avatarContainer: {
        position: 'relative',
        marginBottom: 16,
    },
    avatarInner: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        borderWidth: 2,
        borderColor: '#6366f1',
        alignItems: 'center',
        justifyContent: 'center',
    },
    badgeContainer: {
        position: 'absolute',
        bottom: 5,
        right: 5,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#10b981',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: '#0f172a',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    userName: {
        color: 'white',
        fontSize: 24,
        fontWeight: '900',
        letterSpacing: 1,
    },
    userRole: {
        color: '#94a3b8',
        fontSize: 14,
        fontWeight: '500',
        marginTop: 4,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        color: '#94a3b8',
        fontSize: 13,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 12,
        marginLeft: 4,
    },
    infoCard: {
        padding: 16,
        borderRadius: 24,
    },
    infoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
    },
    iconBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    infoTextContainer: {
        flex: 1,
    },
    infoLabel: {
        color: '#64748b',
        fontSize: 11,
        fontWeight: '600',
        marginBottom: 2,
    },
    infoValue: {
        color: 'white',
        fontSize: 15,
        fontWeight: '700',
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        marginHorizontal: 4,
    },
    optionsCard: {
        borderRadius: 24,
        overflow: 'hidden',
    },
    optionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
    },
    optionText: {
        color: 'white',
        fontSize: 15,
        fontWeight: '600',
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 16,
        backgroundColor: 'rgba(244, 63, 94, 0.05)',
        paddingVertical: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(244, 63, 94, 0.1)',
    },
    logoutText: {
        color: '#f43f5e',
        fontWeight: '700',
        fontSize: 15,
        marginLeft: 12,
    },
    versionText: {
        color: '#334155',
        textAlign: 'center',
        marginTop: 32,
        fontSize: 12,
        fontWeight: '600',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        justifyContent: 'center',
        padding: 24,
    },
    modalContent: {
        padding: 24,
        borderRadius: 32,
    },
    modalHeader: {
        marginBottom: 24,
    },
    modalTitle: {
        color: 'white',
        fontSize: 20,
        fontWeight: '800',
        marginBottom: 8,
    },
    modalSubtitle: {
        color: '#94a3b8',
        fontSize: 14,
        lineHeight: 20,
    },
    input: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 16,
        padding: 16,
        color: 'white',
        fontSize: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        marginBottom: 24,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    modalButton: {
        flex: 1,
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    confirmButton: {
        backgroundColor: '#6366f1',
    },
    cancelButtonText: {
        color: '#94a3b8',
        fontWeight: '700',
    },
    confirmButtonText: {
        color: 'white',
        fontWeight: '700',
    },
});

export default ProfileScreen;
