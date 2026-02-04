import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { API_URL } from '../config';

export default function HistoryScreen() {
  const navigation = useNavigation<any>();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('ALL'); // Estado para el filtro

  const fetchLogs = async () => {
    try {
      const res = await fetch(`${API_URL}/supervisor/bitacoras`);
      
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") === -1) {
        throw new Error("El servidor devolvió HTML en lugar de JSON (posible error 500/404)");
      }

      const data = await res.json();
      if (res.ok) setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Actualizar automáticamente cada 10 segundos
  useFocusEffect(
    useCallback(() => {
      fetchLogs();
      const interval = setInterval(fetchLogs, 10000);
      return () => clearInterval(interval);
    }, [])
  );

  const getIcon = (type: string) => {
    switch(type) {
      case 'PANICO': return 'report-problem';
      case 'INCIDENCIA': return 'warning';
      case 'OBSERVACION': return 'visibility';
      default: return 'notifications';
    }
  };

  const getColor = (type: string) => {
    switch(type) {
      case 'PANICO': return '#DC2626'; // Rojo oscuro
      case 'INCIDENCIA': return '#EF4444';
      case 'OBSERVACION': return '#F59E0B';
      default: return '#3B82F6';
    }
  };

  // Filtrar los logs según la selección
  const filteredLogs = logs.filter(log => filter === 'ALL' || log.type === filter);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bitácora de Eventos</Text>
      </View>

      {/* Barra de Filtros */}
      <View style={styles.filterContainer}>
        {['ALL', 'PANICO', 'INCIDENCIA', 'OBSERVACION', 'NOTIFICACION'].map((f) => (
          <TouchableOpacity 
            key={f} 
            style={[styles.filterBtn, filter === f && styles.filterBtnActive, f === 'PANICO' && filter === f && { backgroundColor: '#DC2626' }]} 
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'ALL' ? 'Todo' : 
               f === 'PANICO' ? 'Pánico' : 
               f === 'NOTIFICACION' ? 'Notificación' : 
               f === 'OBSERVACION' ? 'Observación' : 
               f.charAt(0) + f.slice(1).toLowerCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#3B82F6" style={{marginTop: 50}} />
      ) : (
        <FlatList
          data={filteredLogs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20 }}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={() => { setRefreshing(true); fetchLogs(); }} 
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="history" size={48} color="#CBD5E1" />
              <Text style={styles.emptyText}>No hay registros recientes</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={[styles.iconBox, { backgroundColor: getColor(item.type) + '20' }]}>
                <MaterialIcons name={getIcon(item.type)} size={24} color={getColor(item.type)} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.cardHeaderRow}>
                  <Text style={[styles.type, { color: getColor(item.type) }]}>{item.type}</Text>
                  <Text style={styles.date}>{item.date} • {item.timestamp}</Text>
                </View>
                <Text style={styles.desc}>{item.description}</Text>
                <View style={styles.authorContainer}>
                  <MaterialIcons name="person" size={14} color="#64748B" />
                  <Text style={styles.author}>{item.author}</Text>
                </View>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EEF2F6' },
  header: {
    backgroundColor: '#1E293B', padding: 20, paddingTop: 50,
    flexDirection: 'row', alignItems: 'center', gap: 15
  },
  backBtn: { padding: 8 },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  card: {
    backgroundColor: '#FFF', padding: 16, borderRadius: 16, marginBottom: 12,
    flexDirection: 'row', gap: 15, elevation: 2,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }
  },
  iconBox: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' },
  type: { fontWeight: 'bold', fontSize: 12, textTransform: 'uppercase' },
  date: { fontSize: 11, color: '#94A3B8' },
  desc: { fontSize: 14, color: '#334155', marginBottom: 8, lineHeight: 20 },
  authorContainer: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F1F5F9', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  author: { fontSize: 12, color: '#475569', fontWeight: '600' },
  emptyContainer: { alignItems: 'center', marginTop: 50 },
  emptyText: { color: '#94A3B8', marginTop: 10, fontSize: 16 },
  filterContainer: { flexDirection: 'row', padding: 15, paddingBottom: 5, gap: 8 },
  filterBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, backgroundColor: '#E2E8F0', borderWidth: 1, borderColor: 'transparent' },
  filterBtnActive: { backgroundColor: '#3B82F6' },
  filterText: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  filterTextActive: { color: '#FFF' }
});