import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, TextInput, Modal, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { API_URL } from '../config';

export default function GuardiaProfileScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { guardia } = route.params || {};
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [notifMessage, setNotifMessage] = useState('');
  const [rondaPoints, setRondaPoints] = useState<any[]>([]);
  const [loadingPoints, setLoadingPoints] = useState(false);

  useEffect(() => {
    if (guardia?.progreso?.id_ronda) {
      setLoadingPoints(true);
      fetch(`${API_URL}/rondas/${guardia.progreso.id_ronda}/puntos`)
        .then(res => res.json())
        .then(data => setRondaPoints(data))
        .catch(err => console.error("Error fetching points", err))
        .finally(() => setLoadingPoints(false));
    }
  }, [guardia]);

  if (!guardia) {
      return (
          <View style={styles.container}>
              <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                  <MaterialIcons name="arrow-back" size={24} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Perfil del Guardia</Text>
              </View>
              <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
                  <Text>No se especificó un guardia.</Text>
              </View>
          </View>
      );
  }

  const handleSendNotification = async () => {
    if (!notifMessage.trim()) return;
    try {
      const response = await fetch(`${API_URL}/supervisor/notificaciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_guardia: guardia.id_guardia, mensaje: notifMessage })
      });
      if (response.ok) {
        Alert.alert('Éxito', 'Notificación enviada');
        setNotifMessage('');
        setShowNotifModal(false);
      } else {
        Alert.alert('Error', 'No se pudo enviar');
      }
    } catch (e) {
      Alert.alert('Error', 'Fallo de conexión');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Perfil del Guardia</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.profileInfo}>
          <View style={styles.largeAvatar}>
            <Text style={styles.largeAvatarText}>
              {guardia.nombre?.charAt(0)}{guardia.apellido?.charAt(0)}
            </Text>
          </View>
          <Text style={styles.profileName}>{guardia.nombre} {guardia.apellido}</Text>
          <Text style={styles.profileRut}>{guardia.rut}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ubicación Actual</Text>
          <View style={styles.miniMapContainer}>
            {guardia.ultimaUbicacion ? (
              <MapView
                style={styles.miniMap}
                provider={PROVIDER_GOOGLE}
                mapType="hybrid"
                initialRegion={{
                  latitude: parseFloat(guardia.ultimaUbicacion.latitud),
                  longitude: parseFloat(guardia.ultimaUbicacion.longitud),
                  latitudeDelta: 0.002,
                  longitudeDelta: 0.002,
                }}
              >
                <Marker
                  coordinate={{
                    latitude: parseFloat(guardia.ultimaUbicacion.latitud),
                    longitude: parseFloat(guardia.ultimaUbicacion.longitud),
                  }}
                />
              </MapView>
            ) : (
              <View style={styles.noMapContainer}>
                <MaterialIcons name="location-off" size={32} color="#94A3B8" />
                <Text style={styles.noMapText}>Sin ubicación reciente</Text>
              </View>
            )}
          </View>
        </View>

        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => setShowNotifModal(true)}
        >
          <MaterialIcons name="notifications" size={20} color="#FFF" />
          <Text style={styles.actionButtonText}>Enviar Notificación</Text>
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Última Actividad</Text>
          <Text style={styles.activityText}>
            {guardia.ultimaUbicacion 
              ? `Reporte: ${new Date(guardia.ultimaUbicacion.fecha).toLocaleString()}`
              : 'Sin registros recientes'}
          </Text>
        </View>

        {/* Detalle de Ronda (Puntos de Control) */}
        {guardia.progreso && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ronda Asignada</Text>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10}}>
                <Text style={styles.rondaStatusText}>Estado: <Text style={{fontWeight: 'bold'}}>{guardia.progreso.estado}</Text></Text>
                <Text style={styles.rondaStatusText}>{guardia.progreso.texto}</Text>
            </View>
            
            {loadingPoints ? (
              <ActivityIndicator size="small" color="#3B82F6" style={{marginVertical: 20}} />
            ) : (
              rondaPoints.map((punto, index) => (
                <View key={index} style={styles.pointItem}>
                  <MaterialIcons 
                    name={punto.marcado ? "check-circle" : "radio-button-unchecked"} 
                    size={24} 
                    color={punto.marcado ? "#10B981" : "#CBD5E1"} 
                  />
                  <View style={{marginLeft: 12, flex: 1}}>
                    <Text style={[styles.pointName, punto.marcado && {color: '#166534'}]}>{punto.nombre}</Text>
                    <Text style={styles.pointTime}>
                      {punto.marcado ? `Marcado: ${new Date(punto.hora_marcaje).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` : 'Pendiente'}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Modal Notificación */}
      <Modal visible={showNotifModal} transparent animationType="fade" onRequestClose={() => setShowNotifModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Enviar Mensaje</Text>
            <TextInput
              style={styles.input}
              placeholder="Escribe el mensaje..."
              multiline
              value={notifMessage}
              onChangeText={setNotifMessage}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setShowNotifModal(false)} style={[styles.modalBtn, styles.cancelBtn]}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSendNotification} style={[styles.modalBtn, styles.confirmBtn]}>
                <Text style={styles.confirmText}>Enviar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { backgroundColor: '#1E293B', padding: 20, paddingTop: 50, flexDirection: 'row', alignItems: 'center', gap: 15 },
  backBtn: { padding: 8 },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  content: { padding: 20 },
  profileInfo: { alignItems: 'center', marginBottom: 24 },
  largeAvatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  largeAvatarText: { fontSize: 32, fontWeight: 'bold', color: '#475569' },
  profileName: { fontSize: 22, fontWeight: 'bold', color: '#1E293B' },
  profileRut: { fontSize: 14, color: '#64748B' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#94A3B8', marginBottom: 8, textTransform: 'uppercase' },
  miniMapContainer: { height: 200, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0' },
  miniMap: { width: '100%', height: '100%' },
  noMapContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F1F5F9' },
  noMapText: { color: '#94A3B8', marginTop: 8 },
  actionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F59E0B', padding: 14, borderRadius: 12, gap: 8, marginBottom: 24 },
  actionButtonText: { color: '#FFF', fontWeight: 'bold' },
  activityText: { fontSize: 14, color: '#334155' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#FFF', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  input: { backgroundColor: '#F1F5F9', borderRadius: 8, padding: 12, height: 100, textAlignVertical: 'top', marginBottom: 15 },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalBtn: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
  cancelBtn: { backgroundColor: '#F1F5F9' },
  confirmBtn: { backgroundColor: '#3B82F6' },
  cancelText: { color: '#64748B', fontWeight: 'bold' },
  confirmText: { color: '#FFF', fontWeight: 'bold' },

  rondaStatusText: { fontSize: 14, color: '#64748B' },
  pointItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, backgroundColor: '#FFF', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  pointName: { fontSize: 14, fontWeight: '600', color: '#334155' },
  pointTime: { fontSize: 12, color: '#94A3B8' },
});
