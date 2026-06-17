import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Eye, EyeOff } from 'lucide-react-native';

export default function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!username.trim() || !password) { 
      setError('Ingresa usuario y contraseña'); 
      return; 
    }
    try {
      setSubmitting(true);
      setError('');
      
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.100:3000';
      console.log('[LoginScreen] Intentando iniciar sesión...');
      console.log('[LoginScreen] URL del backend:', `${apiUrl}/api/auth/login`);
      console.log('[LoginScreen] Usuario:', username.trim());
      
      const res = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      
      console.log('[LoginScreen] Código de respuesta HTTP:', res.status);
      
      let data;
      try { 
        data = await res.json(); 
        console.log('[LoginScreen] Respuesta del servidor:', data);
      }
      catch (jsonErr) { 
        console.log('[LoginScreen] Error al decodificar JSON de la respuesta:', jsonErr);
        throw new Error('El servidor no responde con un JSON válido. Verifica la IP en el .env'); 
      }
      
      if (!res.ok) throw new Error(data?.error || 'No se pudo iniciar sesión');
      
      if (onLogin) onLogin(data);
      else alert('¡Login exitoso!');
      
    } catch (err) {
      console.error('[LoginScreen] Error capturado durante login:', err);
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LinearGradient
      colors={['#0b1628', '#0f2010', '#0b1628']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            
            {/* Branding Top */}
            <View style={styles.brandTop}>
              <View style={styles.brandOrbit}>
                <Text style={styles.brandRobotIcon}>🤖</Text>
              </View>
              <Text style={styles.brandName}>DRAKO</Text>
              <Text style={styles.brandTagline}>Sistema Autónomo de{'\n'}Control IoT</Text>
            </View>

            {/* Form Panel */}
            <View style={styles.formPanel}>
              <View style={styles.formHeader}>
                <Text style={styles.formTitle}>Iniciar Sesión</Text>
                <Text style={styles.formSub}>Accede al panel de control</Text>
              </View>

              <View style={styles.form}>
                <View style={styles.field}>
                  <Text style={styles.label}>Usuario</Text>
                  <TextInput
                    style={styles.input}
                    value={username}
                    onChangeText={setUsername}
                    placeholder="Ej. admin_drako"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Contraseña</Text>
                  <View style={styles.passWrap}>
                    <TextInput
                      style={[styles.input, { paddingRight: 50 }]}
                      value={password}
                      onChangeText={setPassword}
                      placeholder="••••••••"
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      secureTextEntry={!showPass}
                    />
                    <TouchableOpacity 
                      style={styles.eyeBtn}
                      onPress={() => setShowPass(!showPass)}
                      activeOpacity={0.7}
                    >
                      {showPass ? <EyeOff color="rgba(255,255,255,0.4)" size={20} /> : <Eye color="rgba(255,255,255,0.4)" size={20} />}
                    </TouchableOpacity>
                  </View>
                </View>

                {error ? (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>⚠ {error}</Text>
                  </View>
                ) : null}

                <TouchableOpacity 
                  style={[styles.submitBtn, submitting && styles.submitBtnDisabled]} 
                  onPress={handleSubmit}
                  disabled={submitting}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#78ba49', '#5a9e2f']}
                    style={styles.gradientBtn}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    {submitting ? (
                      <ActivityIndicator color="#fff" style={{ marginRight: 8 }} />
                    ) : null}
                    <Text style={styles.submitBtnText}>
                      {submitting ? 'Validando…' : 'Acceder al Sistema'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>

              </View>
              <Text style={styles.formHint}>Robot Autónomo Drako · v2.0</Text>
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  brandTop: {
    alignItems: 'center',
    marginBottom: 40,
  },
  brandOrbit: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1.5,
    borderColor: 'rgba(120, 186, 73, 0.3)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  brandRobotIcon: {
    fontSize: 40,
  },
  brandName: {
    fontSize: 36,
    fontWeight: '900',
    color: '#78ba49',
    letterSpacing: 6,
    marginBottom: 4,
  },
  brandTagline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    lineHeight: 20,
    letterSpacing: 0.5,
  },
  formPanel: {
    backgroundColor: 'rgba(15,23,42,0.6)',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  formHeader: {
    marginBottom: 24,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  formSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.45)',
  },
  form: {
    gap: 20,
  },
  field: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    color: '#fff',
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  passWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  eyeBtn: {
    position: 'absolute',
    right: 16,
    height: '100%',
    justifyContent: 'center',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: 8,
    padding: 12,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 13,
  },
  submitBtn: {
    marginTop: 8,
    borderRadius: 10,
    overflow: 'hidden',
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  gradientBtn: {
    flexDirection: 'row',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  formHint: {
    marginTop: 24,
    fontSize: 12,
    color: 'rgba(255,255,255,0.2)',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
});
