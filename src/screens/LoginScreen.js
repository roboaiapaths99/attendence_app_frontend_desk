import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import GlassCard from '../components/GlassCard';
import { Mail, Lock, ArrowRight } from 'lucide-react-native';
import { theme } from '../utils/theme';
import * as SecureStore from 'expo-secure-store';
import * as Application from 'expo-application';
import { loginUser } from '../utils/api';
import { getFriendlyErrorMessage } from '../utils/errorUtils';

const LoginScreen = ({ navigation }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const checkSavedCredentials = async () => {
            try {
                const savedEmail = await SecureStore.getItemAsync('userEmail');
                const savedPass = await SecureStore.getItemAsync('userPassword');
                if (savedEmail && savedPass) {
                    setEmail(savedEmail);
                    setPassword(savedPass);
                    // Pass directly to handleLogin to bypass state lag
                    performLogin(savedEmail, savedPass);
                }
            } catch (e) {
                console.log("[Login] Persistence check failed:", e);
            }
        };
        checkSavedCredentials();
    }, []);

    const performLogin = async (loginEmail, loginPass) => {
        if (!loginEmail || !loginPass) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }
        setLoading(true);
        try {
            const deviceId = Platform.OS === 'android' ?
                Application.androidId :
                await Application.getIosIdForVendorAsync();

            const data = await loginUser(loginEmail, loginPass, deviceId);

            // Save for future
            await SecureStore.setItemAsync('userEmail', loginEmail);
            await SecureStore.setItemAsync('userPassword', loginPass);
            await SecureStore.setItemAsync('userData', JSON.stringify(data.user));

            navigation.navigate('Home', {
                email: loginEmail,
                token: data.access_token,
                user: data.user
            });
        } catch (e) {
            const errorMsg = getFriendlyErrorMessage(e, "Check your internet and try again.");
            Alert.alert('Login Failed', errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = () => performLogin(email, password);

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <View style={styles.innerContainer}>
                <View style={styles.header}>
                    <Text style={styles.title}>OfficeFlow</Text>
                    <Text style={styles.subtitle}>AI-Powered Attendance</Text>
                </View>

                <GlassCard>
                    <Text style={styles.cardTitle}>Login</Text>

                    <View style={styles.inputContainer}>
                        <Mail size={20} color={theme.colors.primary} />
                        <TextInput
                            placeholder="Email Address"
                            placeholderTextColor={theme.colors.text.slate400}
                            style={styles.input}
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Lock size={20} color={theme.colors.primary} />
                        <TextInput
                            placeholder="Password"
                            placeholderTextColor={theme.colors.text.slate400}
                            style={styles.input}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                        />
                    </View>

                    <TouchableOpacity
                        style={[styles.button, loading && styles.buttonDisabled]}
                        onPress={handleLogin}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <>
                                <Text style={styles.buttonText}>Sign In</Text>
                                <ArrowRight size={20} color="white" />
                            </>
                        )}
                    </TouchableOpacity>
                </GlassCard>

                <TouchableOpacity
                    style={styles.footerLink}
                    onPress={() => navigation.navigate('Register')}
                >
                    <Text style={styles.footerText}>
                        Don't have an account? <Text style={styles.footerLinkHighlight}>Sign Up</Text>
                    </Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    innerContainer: {
        flex: 1,
        paddingHorizontal: theme.spacing.px6,
        justifyContent: 'center',
    },
    header: {
        marginBottom: theme.spacing.mb10,
    },
    title: {
        color: 'white',
        fontSize: 36,
        fontWeight: 'bold',
    },
    subtitle: {
        color: theme.colors.secondary,
        fontSize: 18,
        marginTop: theme.spacing.mt2,
    },
    cardTitle: {
        color: 'white',
        fontSize: 20,
        fontWeight: '600',
        marginBottom: theme.spacing.mb6,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(30, 41, 59, 0.5)',
        borderRadius: theme.roundness.xl,
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    input: {
        flex: 1,
        color: 'white',
        marginLeft: 12,
    },
    button: {
        backgroundColor: theme.colors.primary,
        paddingVertical: 16,
        borderRadius: theme.roundness.xl,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: theme.colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    buttonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 18,
        marginRight: 8,
    },
    footerLink: {
        marginTop: theme.spacing.mt8,
        alignSelf: 'center',
    },
    footerText: {
        color: theme.colors.text.slate400,
    },
    footerLinkHighlight: {
        color: theme.colors.secondary,
        fontWeight: 'bold',
    },
});

export default LoginScreen;
