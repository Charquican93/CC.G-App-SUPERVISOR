import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';

const NotificationsScreen = () => {
  const navigation = useNavigation();

  return (
    <View className="flex-1 bg-white">
      <View className="flex-row items-center justify-between px-4 pt-12 pb-4 border-b border-slate-100 bg-white">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="w-10 h-10 items-center justify-center rounded-full bg-slate-50"
        >
          <MaterialIcons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-slate-900">Notificaciones</Text>
        <View className="w-10" />
      </View>
      
      <View className="flex-1 justify-center items-center p-8">
        <View className="w-24 h-24 bg-blue-50 rounded-full items-center justify-center mb-6">
          <MaterialIcons name="notifications-off" size={48} color="#3b82f6" />
        </View>
        <Text className="text-xl font-bold text-slate-900 mb-2">Sin novedades</Text>
        <Text className="text-slate-500 text-center leading-relaxed">
          Por el momento no tienes nuevas notificaciones para revisar.
        </Text>
      </View>
    </View>
  );
};

export default NotificationsScreen;