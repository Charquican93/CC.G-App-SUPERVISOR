import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { NavType } from '../types';

interface BottomNavProps {
  activeNav: NavType;
  onNavChange: (nav: NavType) => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ activeNav, onNavChange }) => {
  const navItems: { id: NavType; icon: keyof typeof MaterialIcons.glyphMap; label: string }[] = [
    { id: 'inicio', icon: 'home', label: 'Inicio' },
    { id: 'mapa', icon: 'map', label: 'Mapa' },
    { id: 'historial', icon: 'history', label: 'Historial' },
    { id: 'perfil', icon: 'person', label: 'Perfil' },
  ];

  return (
    <View className="flex-row justify-between items-center bg-white border-t border-slate-200 px-6 py-3 pb-5 shadow-lg">
      {navItems.map((item) => (
        <TouchableOpacity
          key={item.id}
          onPress={() => onNavChange(item.id)}
          className="items-center justify-center gap-1"
        >
          <MaterialIcons 
            name={item.icon} 
            size={26} 
            color={activeNav === item.id ? '#3b82f6' : '#94a3b8'} 
          />
          <Text 
            className={`text-[10px] font-semibold ${
              activeNav === item.id ? 'text-primary' : 'text-slate-400'
            }`}
          >
            {item.label}
          </Text>
          {activeNav === item.id && (
            <View className="absolute -bottom-2 w-1 h-1 bg-primary rounded-full" />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
};

export default BottomNav;
