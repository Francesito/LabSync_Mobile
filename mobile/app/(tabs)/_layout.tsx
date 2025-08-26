import { Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';

import { HapticTab } from '@/components/HapticTab';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const [roleId, setRoleId] = useState<number | null>(null);

 useEffect(() => {
  const loadRole = async () => {
    const userStr = await SecureStore.getItemAsync('usuario');
    if (!userStr) return setRoleId(null);
    try {
      const parsed = JSON.parse(userStr);
      const role = Number(parsed.rol_id) || null;
      
      // AGREGAR ESTOS LOGS AQUÍ
      console.log('Usuario completo:', parsed);
      console.log('roleId extraído:', role);
      console.log('Should show prestamos tab:', role === 3);
      
      setRoleId(role);
    } catch {
      setRoleId(null);
    }
  };
  loadRole();
}, []);

  if (roleId === null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <Tabs
      initialRouteName="catalogo"
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: { position: 'absolute' },
          default: {},
        }),
      }}
    >
      <Tabs.Screen
        name="catalogo"
        options={{
          title: 'Catálogo',
          tabBarIcon: ({ color }) => <Ionicons name="book" size={28} color={color} />,
        }}
      />

      <Tabs.Screen
        name="solicitudes"
        options={{
          href: [1, 2, 3].includes(roleId) ? undefined : null,
          title: 'Solicitudes',
          tabBarIcon: ({ color }) => <Ionicons name="document-text" size={28} color={color} />,
        }}
      />

      <Tabs.Screen
        name="adeudos"
        options={{
          href: [1, 2].includes(roleId) ? undefined : null,
          title: 'Adeudos',
          tabBarIcon: ({ color }) => <Ionicons name="alert-circle" size={28} color={color} />,
        }}
      />

      <Tabs.Screen
        name="residuo"
        options={{
          href: roleId === 1 ? undefined : null,
          title: 'Residuos',
          tabBarIcon: ({ color }) => <Ionicons name="trash" size={28} color={color} />,
        }}
      />

      <Tabs.Screen
           name="prestamos"
        options={{
         href: roleId === 3 ? '/(tabs)/prestamos' : null,
          title: 'Préstamos',
          tabBarIcon: ({ color }) => <Ionicons name="swap-horizontal" size={28} color={color} />,
        }}
      />

      <Tabs.Screen
        name="chat"
        options={{
          href: [1, 3].includes(roleId) ? undefined : null,
          title: 'Chat',
          tabBarIcon: ({ color }) => <Ionicons name="chatbubble-ellipses" size={28} color={color} />,
        }}
      />

      <Tabs.Screen
        name="reportes"
        options={{
          href: [3, 4].includes(roleId) ? undefined : null,
          title: 'Reportes',
          tabBarIcon: ({ color }) => <Ionicons name="bar-chart" size={28} color={color} />,
        }}
      />

      <Tabs.Screen
        name="configuracion"
        options={{
          href: roleId === 4 ? undefined : null,
          title: 'Configuración',
          tabBarIcon: ({ color }) => <Ionicons name="settings" size={28} color={color} />,
        }}
      />

      <Tabs.Screen
        name="historial"
        options={{
          href: [3, 4].includes(roleId) ? undefined : null,
          title: 'Historial',
          tabBarIcon: ({ color }) => <Ionicons name="time" size={28} color={color} />,
        }}
      />

      <Tabs.Screen
        name="notificaciones"
        options={{
          href: [1, 2, 3].includes(roleId) ? undefined : null,
          title: 'Notificaciones',
          tabBarIcon: ({ color }) => <Ionicons name="notifications" size={28} color={color} />,
        }}
      />
    </Tabs>
  );
}
