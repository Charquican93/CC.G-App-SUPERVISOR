import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, Text } from 'react-native';
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { API_URL } from '../config';

export default function MapScreen() {
  const navigation = useNavigation<any>();
  const [guardias, setGuardias] = useState<any[]>([]);

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
              // Usamos onCalloutPress para navegar al perfil
              onCalloutPress={() => navigation.navigate('GuardiaProfileScreen', { guardia })}
            >
              <View style={styles.markerContainer}>
                 <View style={[styles.markerCircle, { backgroundColor: color, borderColor: color }]}>
                    <MaterialIcons name="security" size={16} color="#FFF" />
                 </View>
              </View>
              
              <Callout tooltip>
                <View style={styles.calloutContainer}>
                  <Text style={styles.calloutTitle}>{guardia.nombre} {guardia.apellido}</Text>
                  <Text style={styles.calloutStatus}>{status}</Text>
                  <View style={styles.calloutBtn}>
                    <Text style={styles.calloutBtnText}>Ver Perfil</Text>
                  </View>
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>
      
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <MaterialIcons name="arrow-back" size={24} color="#FFF" />
      </TouchableOpacity>
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
  calloutBtnText: { color: 'white', fontSize: 12, fontWeight: 'bold', textAlign: 'center' }
});