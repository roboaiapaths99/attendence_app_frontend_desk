import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert, StyleSheet } from 'react-native';
import GlassCard from '../components/GlassCard';
import { User, Mail, Lock, ArrowRight, UserPlus, Briefcase, Building } from 'lucide-react-native';
import { theme } from '../utils/theme';

const RegisterScreen = ({ navigation }) => {
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [employeeId, setEmployeeId] = useState('');
    const [designation, setDesignation] = useState('');
    const [department, setDepartment] = useState('');

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <Text style={styles.title}>New ID</Text>
                    <Text style={styles.subtitle}>Create your digital presence</Text>
                </View>

                <GlassCard>
                    <Text style={styles.cardTitle}>Register</Text>

                    <View style={styles.inputContainer}>
                        <User size={20} color={theme.colors.primary} />
                        <TextInput
                            placeholder="Full Name"
                            placeholderTextColor={theme.colors.text.slate400}
                            style={styles.input}
                            value={fullName}
                            onChangeText={setFullName}
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <UserPlus size={20} color={theme.colors.primary} />
                        <TextInput
                            placeholder="Employee ID"
                            placeholderTextColor={theme.colors.text.slate400}
                            style={styles.input}
                            value={employeeId}
                            onChangeText={setEmployeeId}
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Briefcase size={20} color={theme.colors.primary} />
                        <TextInput
                            placeholder="Designation (e.g. Manager)"
                            placeholderTextColor={theme.colors.text.slate400}
                            style={styles.input}
                            value={designation}
                            onChangeText={setDesignation}
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Building size={20} color={theme.colors.primary} />
                        <TextInput
                            placeholder="Department (e.g. IT)"
                            placeholderTextColor={theme.colors.text.slate400}
                            style={styles.input}
                            value={department}
                            onChangeText={setDepartment}
                        />
                    </View>

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
                        style={styles.button}
                        onPress={() => {
                            console.log("[Register] Attempting navigation to Onboarding...");
                            if (!fullName || !email || !password || !employeeId || !designation || !department) {
                                Alert.alert("Missing Fields", "Please fill in all details before continuing.");
                                return;
                            }
                            navigation.navigate('Onboarding', {
                                fullName, email, password, employeeId, designation, department
                            });
                        }}
                    >
                        <Text style={styles.buttonText}>Continue to Face ID</Text>
                        <ArrowRight size={20} color="white" />
                    </TouchableOpacity>
                </GlassCard>

                <TouchableOpacity
                    style={styles.footerLink}
                    onPress={() => navigation.navigate('Login')}
                >
                    <Text style={styles.footerText}>
                        Already have an account? <Text style={styles.footerLinkHighlight}>Sign In</Text>
                    </Text>
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    header: {
        marginBottom: 32,
        marginTop: 40,
    },
    title: {
        color: 'white',
        fontSize: 36,
        fontWeight: 'bold',
    },
    subtitle: {
        color: theme.colors.secondary,
        fontSize: 18,
        marginTop: 8,
    },
    cardTitle: {
        color: 'white',
        fontSize: 20,
        fontWeight: '600',
        marginBottom: 24,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(30, 41, 59, 0.5)',
        borderRadius: 12,
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
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: theme.colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
    },
    buttonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 18,
        marginRight: 8,
    },
    footerLink: {
        marginTop: 32,
        marginBottom: 40,
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

export default RegisterScreen;
