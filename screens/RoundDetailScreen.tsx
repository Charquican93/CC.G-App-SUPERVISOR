import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { API_URL } from '../config';

export default function RoundDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { rondaId, guardiaNombre } = route.params;
  const [puntos, setPuntos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPuntos = async () => {
    try {
      const res = await fetch(`${API_URL}/rondas/${rondaId}/puntos`);
      const data = await res.json();
      setPuntos(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Actualizar automáticamente cada 5 segundos mientras la pantalla está activa
  useFocusEffect(
    useCallback(() => {
      fetchPuntos();
      const interval = setInterval(fetchPuntos, 5000);
      return () => clearInterval(interval);
    }, [rondaId])
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Detalle de Ronda</Text>
          <Text style={styles.headerSubtitle}>{guardiaNombre}</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#3B82F6" style={{marginTop: 50}} />
      ) : (
        <FlatList
          data={puntos}
          keyExtractor={(item) => item.id_punto.toString()}
          contentContainerStyle={{ padding: 20 }}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={() => { setRefreshing(true); fetchPuntos(); }} 
            />
          }
          renderItem={({ item }) => (
            <View style={styles.item}>
              <View style={[styles.iconBox, { backgroundColor: item.marcado ? '#DCFCE7' : '#F1F5F9' }]}>
                <MaterialIcons 
                  name={item.marcado ? "check" : "schedule"} 
                  size={24} 
                  color={item.marcado ? "#10B981" : "#94A3B8"} 
                />
              </View>
              <View style={{ marginLeft: 15, flex: 1 }}>
                <Text style={styles.pointName}>{item.nombre}</Text>
                <Text style={styles.pointDesc}>{item.descripcion}</Text>
                <Text style={[styles.pointTime, { color: item.marcado ? '#10B981' : '#64748B' }]}>
                  {item.marcado ? `Marcado: ${new Date(item.hora_marcaje).toLocaleTimeString()}` : 'Pendiente'}
                </Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    backgroundColor: '#1E293B', padding: 20, paddingTop: 50,
    flexDirection: 'row', alignItems: 'center', gap: 15
  },
  backBtn: { padding: 8 },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  headerSubtitle: { color: '#94A3B8', fontSize: 14 },
  item: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF',
    padding: 16, borderRadius: 16, marginBottom: 12, elevation: 1,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5
  },
  iconBox: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  pointName: { fontSize: 16, fontWeight: 'bold', color: '#334155' },
  pointDesc: { fontSize: 12, color: '#94A3B8', marginBottom: 4 },
  pointTime: { fontSize: 12, fontWeight: '600' }
});