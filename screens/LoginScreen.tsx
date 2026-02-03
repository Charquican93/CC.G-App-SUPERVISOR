import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { API_URL } from '../config';

export default function LoginScreen() {
  const navigation = useNavigation<any>();
  const [rut, setRut] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const formatRut = (value: string) => {
    // Limpiar el valor de cualquier caracter que no sea número o k/K
    const cleanValue = value.replace(/[^0-9kK]/g, '').toUpperCase();
    
    if (cleanValue.length <= 1) return cleanValue;
    
    // Separar cuerpo y dígito verificador
    const body = cleanValue.slice(0, -1);
    const dv = cleanValue.slice(-1);
    
    // Formatear el cuerpo con puntos
    const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    
    return `${formattedBody}-${dv}`;
  };

  const handleLogin = async () => {
    if (!rut || !password) {
      Alert.alert('Error', 'Por favor ingresa RUT y contraseña');
      return;
    }

    setLoading(true);
    try {
      console.log('Conectando a:', `${API_URL}/supervisor/login`);
      const response = await fetch(`${API_URL}/supervisor/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rut, password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Login exitoso, pasamos los datos del supervisor al Dashboard
        navigation.replace('Dashboard', { supervisor: data.supervisor });
      } else {
        Alert.alert('Acceso Denegado', data.error || 'Credenciales inválidas');
      }
    } catch (error) {
      console.error('Error de red:', error);
      Alert.alert('Error de Conexión', `No se pudo conectar a:\n${API_URL}\n\nVerifica que tu PC y celular estén en la misma red y que la IP en config.ts sea la correcta.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <View style={styles.header}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>S</Text>
        </View>
        <Text style={styles.title}>CentroControl.Supervisor</Text>
        <Text style={styles.subtitle}>Gestión y Monitoreo</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>RUT</Text>
          <TextInput
            style={styles.input}
            placeholder="12.345.678-9"
            placeholderTextColor="#A0A0A0"
            value={rut}
            onChangeText={(text) => setRut(formatRut(text))}
            autoCapitalize="none"
            keyboardType="default"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#A0A0A0"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        <TouchableOpacity 
          style={styles.button} 
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>INGRESAR</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1E293B', justifyContent: 'center', padding: 20 },
  header: { alignItems: 'center', marginBottom: 40 },
  logoCircle: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#3B82F6',
    justifyContent: 'center', alignItems: 'center', marginBottom: 15,
    shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 10
  },
  logoText: { color: '#fff', fontSize: 40, fontWeight: 'bold' },
  title: { fontSize: 32, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 16, color: '#94A3B8', marginTop: 5 },
  
  card: {
    backgroundColor: '#fff', borderRadius: 20, padding: 25,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 5
  },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, color: '#475569', marginBottom: 8, fontWeight: '600' },
  input: {
    backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10,
    padding: 15, fontSize: 16, color: '#1E293B'
  },
  button: {
    backgroundColor: '#3B82F6', padding: 18, borderRadius: 10, alignItems: 'center', marginTop: 10,
    shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 5
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },
});