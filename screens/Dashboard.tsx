import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  FlatList, 
  StyleSheet, 
  Alert, 
  Modal, 
  TextInput, 
  RefreshControl,
  ActivityIndicator,
  ScrollView
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { API_URL } from '../config';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Tipos para los datos del supervisor y guardias
interface Supervisor {
  id_supervisor: number;
  nombre: string;
  apellido: string;
  rut: string;
  correo: string;
}

interface Puesto {
  id_puesto: number;
  puesto: string;
  instalaciones: string;
}

interface Guardia {
  id_guardia: number;
  nombre: string;
  apellido: string;
  rut: string;
  activo: number; // 1 o 0
  id_puesto?: number;
  ultimaUbicacion?: {
    latitud: number;
    longitud: number;
    fecha: string;
  };
  progreso?: {
    texto: string;
    porcentaje: number;
    id_ronda: number;
    estado?: string;
  };
}

export default function Dashboard() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const params = route.params as { supervisor: Supervisor } | undefined;
  const supervisor = params?.supervisor;

  // Si no hay supervisor, mostrar error o redirigir
  if (!supervisor) {
     return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>No se recibió información del supervisor.</Text>
        <TouchableOpacity onPress={() => navigation.replace('Login')} style={styles.retryButton}>
            <Text style={styles.retryText}>Volver al Login</Text>
        </TouchableOpacity>
      </View>
     );
  }

  const [guardias, setGuardias] = useState<Guardia[]>([]);
  const [puestos, setPuestos] = useState<Puesto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Estados para Modales
  const [selectedGuardia, setSelectedGuardia] = useState<Guardia | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [activeFilterPuestoId, setActiveFilterPuestoId] = useState<number | null>(null);
  const [notifMessage, setNotifMessage] = useState('');
  const [rondaPoints, setRondaPoints] = useState<any[]>([]);
  const [loadingPoints, setLoadingPoints] = useState(false);

  // Cargar lista de guardias
  const fetchData = async () => {
    try {
      // Cargar Guardias
      const guardiasRes = await fetch(`${API_URL}/supervisor/guardias`);
      
      // Verificación de seguridad: asegurar que la respuesta es JSON
      const contentType = guardiasRes.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") === -1) {
        const text = await guardiasRes.text();
        throw new Error(`Respuesta inválida del servidor (HTML): ${text.substring(0, 100)}...`);
      }

      const guardiasData = await guardiasRes.json();
      if (guardiasRes.ok) {
        setGuardias(guardiasData);
      } else {
        console.error('Error fetching guardias:', guardiasData);
      }

      // Cargar Puestos
      const puestosRes = await fetch(`${API_URL}/puestos`);
      const puestosData = await puestosRes.json();
      if (puestosRes.ok) {
        setPuestos(puestosData);
      }
    } catch (error) {
      console.error('Error de red:', error);
      Alert.alert('Error de Conexión', 'El servidor no responde correctamente. Revisa la consola para ver el error.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Actualizar datos cada vez que la pantalla se enfoca
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('userSession');
    navigation.replace('Login');
  };

  const handleSendNotification = async () => {
    if (!selectedGuardia || !notifMessage.trim()) return;

    try {
      const response = await fetch(`${API_URL}/supervisor/notificaciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_guardia: selectedGuardia.id_guardia,
          mensaje: notifMessage
        })
      });
      
      if (response.ok) {
        Alert.alert('Éxito', 'Notificación enviada correctamente');
        setNotifMessage('');
        setShowNotifModal(false);
      } else {
        Alert.alert('Error', 'No se pudo enviar la notificación');
      }
    } catch (e) {
      Alert.alert('Error', 'Fallo de conexión');
    }
  };

  const handleOpenGuardiaModal = async (guardia: Guardia) => {
    setSelectedGuardia(guardia);
    setShowProfileModal(true);
    setRondaPoints([]); // Limpiar puntos anteriores
    
    if (guardia.progreso?.id_ronda) {
      setLoadingPoints(true);
      try {
        const res = await fetch(`${API_URL}/rondas/${guardia.progreso.id_ronda}/puntos`);
        if (res.ok) {
          const data = await res.json();
          setRondaPoints(data);
        }
      } catch (e) {
        console.error("Error fetching points", e);
      } finally {
        setLoadingPoints(false);
      }
    }
  };

  const renderGuardiaItem = ({ item }: { item: Guardia }) => {
    const isActive = item.activo === 1;
    // Determinar color según estado de la ronda
    let progressColor = '#3B82F6'; // Azul por defecto (En Progreso)
    if (item.progreso) {
      if (['PENDIENTE', 'CREADA', 'PROGRAMADA'].includes(item.progreso.estado || '')) progressColor = '#F59E0B'; // Naranja (Por cumplir)
      else if (item.progreso.porcentaje >= 100) progressColor = '#10B981'; // Verde (Completado)
    }
    
    return (
      <TouchableOpacity 
        style={styles.card} 
        onPress={() => handleOpenGuardiaModal(item)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
                {item.nombre ? item.nombre.charAt(0) : ''}
                {item.apellido ? item.apellido.charAt(0) : ''}
            </Text>
            {isActive && <View style={styles.activeBadge} />}
          </View>
          <View style={styles.infoContainer}>
            <Text style={styles.nameText}>{item.nombre} {item.apellido}</Text>
            <Text style={styles.rutText}>{item.rut}</Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color="#CBD5E1" />
        </View>

        <View style={styles.divider} />

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>ESTADO</Text>
            <View style={[styles.statusPill, { backgroundColor: isActive ? '#DCFCE7' : '#F1F5F9' }]}>
              <Text style={[styles.statusText, { color: isActive ? '#166534' : '#64748B' }]}>
                {isActive ? 'EN TURNO' : 'INACTIVO'}
              </Text>
            </View>
          </View>

          <View style={styles.statItem}>
            <Text style={styles.statLabel}>RONDA ACTUAL</Text>
            <TouchableOpacity 
              disabled={!item.progreso}
              onPress={() => navigation.navigate('RoundDetailScreen', { rondaId: item.progreso?.id_ronda, guardiaNombre: `${item.nombre} ${item.apellido}` })}
            >
              <Text style={styles.progressText}>
                {item.progreso?.texto || (isActive ? 'Sin ronda' : '-')}
              </Text>
              {item.progreso && (
                <View style={styles.progressBarBg}>
                  <View 
                    style={[
                      styles.progressBarFill, 
                      { width: `${item.progreso.porcentaje}%`, backgroundColor: progressColor }
                    ]} 
                  />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Filtrar guardias según el puesto seleccionado
  const filteredGuardias = activeFilterPuestoId 
    ? guardias.filter(g => g.id_puesto === activeFilterPuestoId)
    : guardias;

  return (
    <View style={styles.container}>
      {/* Header Supervisor */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Panel de Control</Text>
          <Text style={styles.headerSubtitle}>Hola, {supervisor.nombre} {supervisor.apellido}</Text>
        </View>
        <View style={{flexDirection: 'row', gap: 10}}>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <MaterialIcons name="logout" size={24} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Sección Fija: Puestos de Guardia */}
      <View style={styles.fixedHeaderContainer}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Puestos de Guardia</Text>
        </View>
        <FlatList
          data={puestos}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 10 }}
          keyExtractor={(item) => item.id_puesto.toString()}
          renderItem={({ item }) => {
            const isSelected = activeFilterPuestoId === item.id_puesto;
            return (
            <TouchableOpacity 
              style={[styles.puestoChip, isSelected && styles.puestoChipSelected]}
              onPress={() => setActiveFilterPuestoId(isSelected ? null : item.id_puesto)}
            >
              <Text style={[styles.puestoChipText, isSelected && styles.puestoChipTextSelected]}>
                {item.puesto}
              </Text>
            </TouchableOpacity>
          )}}
        />
      </View>

      {/* Lista de Guardias */}
      <FlatList
        style={{flex: 1}}
        data={filteredGuardias}
        renderItem={renderGuardiaItem}
        keyExtractor={(item) => item.id_guardia.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Personal de Guardia</Text>
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>{activeFilterPuestoId ? 'No hay guardias en este puesto' : 'No hay guardias registrados'}</Text>
            </View>
          ) : <ActivityIndicator size="large" color="#3B82F6" style={{ marginTop: 50 }} />
        }
      />

      {/* Navegación Inferior con Tarjetas */}
      <View style={styles.bottomNavContainer}>
        <TouchableOpacity 
          style={styles.bottomNavCard} 
          onPress={() => navigation.navigate('MapScreen')}
        >
          <MaterialIcons name="map" size={32} color="#3B82F6" />
          <Text style={styles.bottomNavText}>Mapa General</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.bottomNavCard} 
          onPress={() => navigation.navigate('HistoryScreen')}>
          <MaterialIcons name="history" size={32} color="#3B82F6" />
          <Text style={styles.bottomNavText}>Eventos</Text>
        </TouchableOpacity>
      </View>

      {/* Modal Perfil Guardia */}
      <Modal
        visible={showProfileModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowProfileModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedGuardia && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Perfil del Guardia</Text>
                  <TouchableOpacity onPress={() => setShowProfileModal(false)}>
                    <MaterialIcons name="close" size={24} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.profileInfo}>
                  <View style={styles.largeAvatar}>
                    <Text style={styles.largeAvatarText}>
                      {selectedGuardia.nombre.charAt(0)}{selectedGuardia.apellido.charAt(0)}
                    </Text>
                  </View>
                  <Text style={styles.profileName}>{selectedGuardia.nombre} {selectedGuardia.apellido}</Text>
                  <Text style={styles.profileRut}>{selectedGuardia.rut}</Text>
                </View>

                {/* MINIMAPA SATELITAL */}
                <View style={styles.miniMapContainer}>
                  {selectedGuardia.ultimaUbicacion ? (
                    <MapView
                      style={styles.miniMap}
                      provider={PROVIDER_GOOGLE}
                      mapType="hybrid" // Vista Satélite
                      initialRegion={{
                        latitude: parseFloat(selectedGuardia.ultimaUbicacion.latitud as any),
                        longitude: parseFloat(selectedGuardia.ultimaUbicacion.longitud as any),
                        latitudeDelta: 0.002, // Zoom muy cercano para detalle
                        longitudeDelta: 0.002,
                      }}
                    >
                      <Marker
                        coordinate={{
                          latitude: parseFloat(selectedGuardia.ultimaUbicacion.latitud as any),
                          longitude: parseFloat(selectedGuardia.ultimaUbicacion.longitud as any),
                        }}
                        title={selectedGuardia.nombre}
                      />
                    </MapView>
                  ) : (
                    <View style={styles.noMapContainer}>
                      <MaterialIcons name="location-off" size={32} color="#94A3B8" />
                      <Text style={styles.noMapText}>Sin ubicación reciente</Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity 
                  style={[styles.actionButton, { backgroundColor: '#F59E0B', marginBottom: 24 }]}
                  onPress={() => { setShowProfileModal(false); setShowNotifModal(true); }}
                >
                  <MaterialIcons name="notifications" size={20} color="#FFF" />
                  <Text style={styles.actionButtonText}>Enviar Notificación</Text>
                </TouchableOpacity>

                <View style={styles.lastActivity}>
                  <Text style={styles.modalSectionTitle}>Última Actividad</Text>
                  <Text style={styles.activityText}>
                    {selectedGuardia.ultimaUbicacion 
                      ? `Check realizado: ${new Date(selectedGuardia.ultimaUbicacion.fecha).toLocaleString()}`
                      : 'No hay registros recientes'}
                  </Text>
                </View>

                {/* Detalle de Ronda (Puntos de Control) */}
                {selectedGuardia.progreso && (
                  <View style={styles.rondaDetailsContainer}>
                    <Text style={styles.modalSectionTitle}>Ronda Asignada</Text>
                    <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10}}>
                        <Text style={styles.rondaStatusText}>Estado: <Text style={{fontWeight: 'bold'}}>{selectedGuardia.progreso.estado}</Text></Text>
                        <Text style={styles.rondaStatusText}>{selectedGuardia.progreso.texto}</Text>
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
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal Enviar Notificación */}
      <Modal
        visible={showNotifModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowNotifModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: 'auto' }]}>
            <Text style={styles.modalTitle}>Enviar Mensaje</Text>
            <Text style={styles.modalSubtitle}>Para: {selectedGuardia?.nombre} {selectedGuardia?.apellido}</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Escribe tu mensaje aquí..."
              multiline
              numberOfLines={4}
              value={notifMessage}
              onChangeText={setNotifMessage}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.cancelBtn]} 
                onPress={() => setShowNotifModal(false)}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.confirmBtn]} 
                onPress={handleSendNotification}
              >
                <Text style={styles.confirmBtnText}>Enviar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EEF2F6' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  errorText: { color: 'red', fontSize: 16, marginBottom: 20 },
  retryButton: { padding: 10, backgroundColor: '#3B82F6', borderRadius: 8 },
  retryText: { color: '#fff', fontWeight: 'bold' },
  
  bottomNavContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  bottomNavCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginHorizontal: 6,
    elevation: 2,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }
  },
  bottomNavText: { marginTop: 8, fontSize: 14, fontWeight: '600', color: '#1E293B' },

  header: {
    backgroundColor: '#1E293B',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTitle: { color: '#94A3B8', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' },
  headerSubtitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  logoutButton: { padding: 8, backgroundColor: '#334155', borderRadius: 10 },

  fixedHeaderContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: '#EEF2F6',
  },
  
  listContent: { padding: 16 },
  sectionHeader: { marginBottom: 12, marginTop: 4 },
  sectionTitle: { fontSize: 12, fontWeight: 'bold', color: '#94A3B8', textTransform: 'uppercase' },
  
  puestoChip: {
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  puestoChipSelected: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  puestoChipText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  puestoChipTextSelected: { color: '#FFF' },

  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  avatarContainer: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#E2E8F0',
    justifyContent: 'center', alignItems: 'center', marginRight: 12, position: 'relative'
  },
  avatarText: { fontSize: 18, fontWeight: 'bold', color: '#475569' },
  activeBadge: {
    position: 'absolute', bottom: 0, right: 0, width: 14, height: 14,
    borderRadius: 7, backgroundColor: '#10B981', borderWidth: 2, borderColor: '#FFF'
  },
  infoContainer: { flex: 1 },
  nameText: { fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
  rutText: { fontSize: 12, color: '#64748B' },
  
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 12 },
  
  statsContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  statItem: { flex: 1 },
  statLabel: { fontSize: 10, color: '#94A3B8', fontWeight: 'bold', marginBottom: 4 },
  statusPill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  statusText: { fontSize: 10, fontWeight: 'bold' },
  progressText: { fontSize: 12, fontWeight: '600', color: '#334155', marginBottom: 4 },
  progressBarBg: { height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, width: '90%' },
  progressBarFill: { height: 4, borderRadius: 2 },

  emptyContainer: { alignItems: 'center', marginTop: 50 },
  emptyText: { color: '#94A3B8', fontSize: 16 },

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, height: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1E293B' },
  modalSubtitle: { fontSize: 14, color: '#64748B', marginBottom: 16 },
  
  profileInfo: { alignItems: 'center', marginBottom: 24 },
  largeAvatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#F1F5F9',
    justifyContent: 'center', alignItems: 'center', marginBottom: 12
  },
  largeAvatarText: { fontSize: 32, fontWeight: 'bold', color: '#475569' },
  profileName: { fontSize: 22, fontWeight: 'bold', color: '#1E293B' },
  profileRut: { fontSize: 14, color: '#64748B' },

  miniMapContainer: { 
    height: 200, width: '100%', borderRadius: 16, overflow: 'hidden', marginBottom: 16,
    borderWidth: 1, borderColor: '#E2E8F0'
  },
  miniMap: { width: '100%', height: '100%' },
  noMapContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F1F5F9' },
  noMapText: { color: '#94A3B8', marginTop: 8, fontSize: 14 },

  actionButtons: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  actionButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: 14, borderRadius: 12, gap: 8
  },
  actionButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },

  lastActivity: { backgroundColor: '#F8FAFC', padding: 16, borderRadius: 12 },
  
  rondaDetailsContainer: { marginTop: 24, paddingBottom: 20 },
  rondaStatusText: { fontSize: 14, color: '#64748B' },
  pointItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, backgroundColor: '#F8FAFC', padding: 12, borderRadius: 8 },
  pointName: { fontSize: 14, fontWeight: '600', color: '#334155' },
  pointTime: { fontSize: 12, color: '#94A3B8' },

  modalSectionTitle: { fontSize: 12, fontWeight: 'bold', color: '#94A3B8', marginBottom: 8, textTransform: 'uppercase' },
  activityText: { fontSize: 14, color: '#334155' },

  input: {
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0',
    borderRadius: 12, padding: 12, fontSize: 16, textAlignVertical: 'top', marginBottom: 20
  },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
  cancelBtn: { backgroundColor: '#F1F5F9' },
  confirmBtn: { backgroundColor: '#3B82F6' },
  cancelBtnText: { color: '#64748B', fontWeight: 'bold' },
  confirmBtnText: { color: '#FFF', fontWeight: 'bold' },
});
