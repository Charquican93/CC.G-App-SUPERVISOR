import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, Text, Modal, ScrollView } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { API_URL } from '../config';

export default function MapScreen() {
  const navigation = useNavigation<any>();
  const [guardias, setGuardias] = useState<any[]>([]);
  const [selectedGuardia, setSelectedGuardia] = useState<any>(null);

  const fetchGuardias = async () => {
    try {
      const response = await fetch(`${API_URL}/supervisor/guardias`);
      const data = await response.json();
      if (response.ok) {
        // Solo guardias con ubicación válida
        setGuardias(data.filter((g: any) => g.ultimaUbicacion && g.ultimaUbicacion.latitud));
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchGuardias();
    const interval = setInterval(fetchGuardias, 10000); // Actualizar cada 10s
    return () => clearInterval(interval);
  }, []);

  const getMarkerStatus = (fecha: string) => {
    if (!fecha) return { color: '#EF4444', status: 'Sin señal' }; // Rojo
    
    const lastUpdate = new Date(fecha).getTime();
    const now = new Date().getTime();
    const diffMinutes = (now - lastUpdate) / 1000 / 60;

    if (diffMinutes < 5) return { color: '#10B981', status: 'Activo' }; // Verde (< 5 min)
    if (diffMinutes < 30) return { color: '#F59E0B', status: 'Inactivo' }; // Amarillo (5-30 min)
    return { color: '#EF4444', status: 'Sin señal' }; // Rojo (> 30 min)
  };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: -34.9854, // Curicó
          longitude: -71.2394,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {guardias.map((guardia) => {
          const { color, status } = getMarkerStatus(guardia.ultimaUbicacion.fecha);
          return (
            <Marker
              key={guardia.id_guardia}
              coordinate={{
                latitude: parseFloat(guardia.ultimaUbicacion.latitud),
                longitude: parseFloat(guardia.ultimaUbicacion.longitud),
              }}
              onPress={() => setSelectedGuardia(guardia)}
            >
              <View style={styles.markerContainer}>
                 <View style={[styles.markerCircle, { backgroundColor: color, borderColor: color }]}>
                    <MaterialIcons name="security" size={16} color="#FFF" />
                 </View>
              </View>
            </Marker>
          );
        })}
      </MapView>
      
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <MaterialIcons name="arrow-back" size={24} color="#FFF" />
      </TouchableOpacity>

      {/* Modal de Perfil Flotante */}
      <Modal
        visible={!!selectedGuardia}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedGuardia(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detalle del Guardia</Text>
              <TouchableOpacity onPress={() => setSelectedGuardia(null)}>
                <MaterialIcons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            {selectedGuardia && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.profileInfo}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {selectedGuardia.nombre?.charAt(0)}{selectedGuardia.apellido?.charAt(0)}
                    </Text>
                  </View>
                  <Text style={styles.nameText}>{selectedGuardia.nombre} {selectedGuardia.apellido}</Text>
                  <Text style={styles.rutText}>{selectedGuardia.rut}</Text>
                  
                  <View style={[styles.statusBadge, { backgroundColor: selectedGuardia.activo ? '#DCFCE7' : '#F1F5F9' }]}>
                    <Text style={[styles.statusText, { color: selectedGuardia.activo ? '#166534' : '#64748B' }]}>
                      {selectedGuardia.activo ? 'ACTIVO' : 'INACTIVO'}
                    </Text>
                  </View>
                </View>

                <View style={styles.infoSection}>
                  <Text style={styles.label}>Última Ubicación:</Text>
                  <Text style={styles.value}>{new Date(selectedGuardia.ultimaUbicacion.fecha).toLocaleString()}</Text>
                </View>

                {selectedGuardia.progreso && (
                  <View style={styles.infoSection}>
                    <Text style={styles.label}>Ronda Actual:</Text>
                    <Text style={styles.value}>{selectedGuardia.progreso.texto}</Text>
                    <View style={styles.progressBarBg}>
                      <View style={[styles.progressBarFill, { width: `${selectedGuardia.progreso.porcentaje}%` }]} />
                    </View>
                  </View>
                )}

                <TouchableOpacity 
                  style={styles.fullProfileBtn}
                  onPress={() => {
                    const g = selectedGuardia;
                    setSelectedGuardia(null);
                    navigation.navigate('GuardiaProfileScreen', { guardia: g });
                  }}
                >
                  <Text style={styles.fullProfileBtnText}>Ver Historial Completo</Text>
                  <MaterialIcons name="arrow-forward" size={16} color="#FFF" />
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: '100%', height: '100%' },
  backButton: {
    position: 'absolute', top: 50, left: 20,
    backgroundColor: '#1E293B', padding: 12, borderRadius: 30,
    elevation: 5, shadowColor: '#000', shadowOffset: {width:0, height:2}, shadowOpacity:0.3, shadowRadius:3
  },
  markerContainer: { alignItems: 'center' },
  markerCircle: {
    width: 30, height: 30, borderRadius: 15, 
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, elevation: 4, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 2
  },
  calloutContainer: {
    backgroundColor: 'white', borderRadius: 8, padding: 10, width: 150, alignItems: 'center',
    elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, marginBottom: 5
  },
  calloutTitle: { fontWeight: 'bold', fontSize: 14, color: '#1E293B', marginBottom: 2, textAlign: 'center' },
  calloutStatus: { fontSize: 10, color: '#64748B', marginBottom: 8 },
  calloutBtn: {
    backgroundColor: '#3B82F6', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 4, width: '100%'
  },
  calloutBtnText: { color: 'white', fontSize: 12, fontWeight: 'bold', textAlign: 'center' },

  // Estilos del Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '60%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E293B' },
  
  profileInfo: { alignItems: 'center', marginBottom: 20 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  avatarText: { fontSize: 24, fontWeight: 'bold', color: '#475569' },
  nameText: { fontSize: 20, fontWeight: 'bold', color: '#1E293B' },
  rutText: { fontSize: 14, color: '#64748B', marginBottom: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: 'bold' },

  infoSection: { marginBottom: 16, width: '100%' },
  label: { fontSize: 12, color: '#94A3B8', fontWeight: 'bold', marginBottom: 4 },
  value: { fontSize: 14, color: '#334155', fontWeight: '500' },
  progressBarBg: { height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, marginTop: 6, width: '100%' },
  progressBarFill: { height: 6, backgroundColor: '#3B82F6', borderRadius: 3 },

  fullProfileBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#3B82F6', padding: 14, borderRadius: 12, gap: 8, marginTop: 10 },
  fullProfileBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 }
});