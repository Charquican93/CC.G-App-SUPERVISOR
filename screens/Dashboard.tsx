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
  Linking, 
  RefreshControl,
  ActivityIndicator
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
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
  // @ts-ignore
  const supervisor: Supervisor = route.params?.supervisor;

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
  const [selectedPuesto, setSelectedPuesto] = useState<Puesto | null>(null);
  const [showPuestoModal, setShowPuestoModal] = useState(false);
  const [notifMessage, setNotifMessage] = useState('');

  // Cargar lista de guardias
  const fetchData = async () => {
    try {
      // Cargar Guardias
      const guardiasRes = await fetch(`${API_URL}/supervisor/guardias`);
      
      // --- BLOQUE DE DEPURACIÓN ---
      const contentType = guardiasRes.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") === -1) {
        const text = await guardiasRes.text();
        console.error("⚠️ ERROR CRÍTICO: El servidor devolvió HTML en lugar de JSON:", text.substring(0, 500));
        throw new Error("El servidor está devolviendo una página de error (HTML). Revisa los logs de Railway.");
      }
      // ----------------------------

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

  const handleOpenMap = (lat: number, lon: number) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
    Linking.openURL(url);
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

  const renderGuardiaItem = ({ item }: { item: Guardia }) => {
    const isActive = item.activo === 1;
    // Determinar color según estado de la ronda
    let progressColor = '#3B82F6'; // Azul por defecto (En Progreso)
    if (item.progreso) {
      if (item.progreso.estado === 'PENDIENTE') progressColor = '#F59E0B'; // Naranja (Por cumplir)
      else if (item.progreso.porcentaje >= 100) progressColor = '#10B981'; // Verde (Completado)
    }
    
    return (
      <TouchableOpacity 
        style={styles.card} 
        onPress={() => { setSelectedGuardia(item); setShowProfileModal(true); }}
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
            <Text style={styles.progressText}>
              {isActive ? (item.progreso?.texto || 'Sin ronda') : '-'}
            </Text>
            {isActive && item.progreso && (
              <View style={styles.progressBarBg}>
                <View 
                  style={[
                    styles.progressBarFill, 
                    { width: `${item.progreso.porcentaje}%`, backgroundColor: progressColor }
                  ]} 
                />
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header Supervisor */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Panel de Control</Text>
          <Text style={styles.headerSubtitle}>Hola, {supervisor.nombre} {supervisor.apellido}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <MaterialIcons name="logout" size={24} color="#EF4444" />
        </TouchableOpacity>
      </View>

      {/* Lista de Guardias */}
      <FlatList
        data={guardias}
        renderItem={renderGuardiaItem}
        keyExtractor={(item) => item.id_guardia.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Puestos de Control</Text>
            </View>
            <FlatList
              data={puestos}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 16 }}
              keyExtractor={(item) => item.id_puesto.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.puestoCard}
                  onPress={() => { setSelectedPuesto(item); setShowPuestoModal(true); }}
                >
                  <View style={styles.puestoIconBg}>
                    <MaterialIcons name="business" size={24} color="#3B82F6" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.puestoName} numberOfLines={1}>{item.puesto}</Text>
                    <Text style={styles.puestoInfo} numberOfLines={1}>{item.instalaciones}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Personal de Guardia</Text>
            </View>
          </>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No hay guardias registrados</Text>
            </View>
          ) : <ActivityIndicator size="large" color="#3B82F6" style={{ marginTop: 50 }} />
        }
      />

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

                <View style={styles.profileInfo}>
                  <View style={styles.largeAvatar}>
                    <Text style={styles.largeAvatarText}>
                      {selectedGuardia.nombre.charAt(0)}{selectedGuardia.apellido.charAt(0)}
                    </Text>
                  </View>
                  <Text style={styles.profileName}>{selectedGuardia.nombre} {selectedGuardia.apellido}</Text>
                  <Text style={styles.profileRut}>{selectedGuardia.rut}</Text>
                </View>

                <View style={styles.actionButtons}>
                  <TouchableOpacity 
                    style={[styles.actionButton, { backgroundColor: '#3B82F6' }]}
                    onPress={() => {
                      if (selectedGuardia.ultimaUbicacion) {
                        handleOpenMap(selectedGuardia.ultimaUbicacion.latitud, selectedGuardia.ultimaUbicacion.longitud);
                      } else {
                        Alert.alert('Sin ubicación', 'Este guardia no ha registrado ubicación reciente.');
                      }
                    }}
                  >
                    <MaterialIcons name="map" size={20} color="#FFF" />
                    <Text style={styles.actionButtonText}>Ver Ubicación</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.actionButton, { backgroundColor: '#F59E0B' }]}
                    onPress={() => { setShowProfileModal(false); setShowNotifModal(true); }}
                  >
                    <MaterialIcons name="notifications" size={20} color="#FFF" />
                    <Text style={styles.actionButtonText}>Notificar</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.lastActivity}>
                  <Text style={styles.modalSectionTitle}>Última Actividad</Text>
                  <Text style={styles.activityText}>
                    {selectedGuardia.ultimaUbicacion 
                      ? `Check realizado: ${new Date(selectedGuardia.ultimaUbicacion.fecha).toLocaleString()}`
                      : 'No hay registros recientes'}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal Detalle Puesto (Guardias Asignados) */}
      <Modal
        visible={showPuestoModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPuestoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{selectedPuesto?.puesto}</Text>
                <Text style={styles.modalSubtitle}>{selectedPuesto?.instalaciones}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowPuestoModal(false)}>
                <MaterialIcons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSectionTitle}>Guardias en Turno</Text>

            <FlatList
              data={guardias.filter(g => g.id_puesto === selectedPuesto?.id_puesto && g.activo === 1)}
              keyExtractor={(item) => item.id_guardia.toString()}
              renderItem={renderGuardiaItem}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <MaterialIcons name="person-off" size={48} color="#E2E8F0" />
                  <Text style={[styles.emptyText, { marginTop: 10 }]}>
                    No hay guardias activos en este puesto actualmente.
                  </Text>
                </View>
              }
              contentContainerStyle={{ paddingBottom: 20 }}
            />
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
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  errorText: { color: 'red', fontSize: 16, marginBottom: 20 },
  retryButton: { padding: 10, backgroundColor: '#3B82F6', borderRadius: 8 },
  retryText: { color: '#fff', fontWeight: 'bold' },
  
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
  
  listContent: { padding: 16 },
  sectionHeader: { marginBottom: 12, marginTop: 4 },
  sectionTitle: { fontSize: 12, fontWeight: 'bold', color: '#94A3B8', textTransform: 'uppercase' },
  
  puestoCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 12,
    marginRight: 12,
    width: 220,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2
  },
  puestoIconBg: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  puestoName: { fontSize: 14, fontWeight: 'bold', color: '#1E293B' },
  puestoInfo: { fontSize: 12, color: '#64748B' },

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

  actionButtons: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  actionButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: 14, borderRadius: 12, gap: 8
  },
  actionButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },

  lastActivity: { backgroundColor: '#F8FAFC', padding: 16, borderRadius: 12 },
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
