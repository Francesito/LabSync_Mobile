import { Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
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
      if (userStr) {
        try {
          const parsed = JSON.parse(userStr);
          setRoleId(parsed.rol_id);
        } catch {
          setRoleId(null);
        }
      } else {
        setRoleId(null);
      }
    };
    loadRole();
  }, []);

  if (roleId === null) return null;

  return (
    <Tabs
     initialRouteName="catalogo"
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: {
            // Use a transparent background on iOS to show the blur effect
            position: 'absolute',
          },
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
    {[1, 2, 3].includes(roleId) && (
        <Tabs.Screen
        name="solicitudes"
          options={{
            title: 'Solicitudes',
            tabBarIcon: ({ color }) => <Ionicons name="document-text" size={28} color={color} />,
          }}
        />
      )}
      {[1, 2].includes(roleId) && (
        <Tabs.Screen
          name="adeudos"
          options={{
           title: 'Adeudos',
            tabBarIcon: ({ color }) => <Ionicons name="alert-circle" size={28} color={color} />,
          }}
        />
      )}
      {roleId === 1 && (
        <Tabs.Screen
          name="residuo"
          options={{
            title: 'Residuos',
            tabBarIcon: ({ color }) => <Ionicons name="trash" size={28} color={color} />,
          }}
        />
      )}
      {roleId === 3 && (
        <Tabs.Screen
          name="prestamo"
          options={{
            title: 'Préstamos',
            tabBarIcon: ({ color }) => <Ionicons name="swap-horizontal" size={28} color={color} />,
          }}
        />
      )}
      {[1, 3].includes(roleId) && (
        <Tabs.Screen
          name="chat"
          options={{
            title: 'Chat',
            tabBarIcon: ({ color }) => <Ionicons name="chatbubble-ellipses" size={28} color={color} />,
          }}
        />
      )}
      {[3, 4].includes(roleId) && (
        <Tabs.Screen
          key="reportes"
          name="reportes"
          options={{
            title: 'Reportes',
            tabBarIcon: ({ color }) => <Ionicons name="bar-chart" size={28} color={color} />,
          }}
        />
      )}
      {roleId === 4 && (
        <Tabs.Screen
          key="configuracion"
          name="configuracion"
          options={{
            title: 'Configuración',
            tabBarIcon: ({ color }) => <Ionicons name="settings" size={28} color={color} />,
          }}
        />
      )}
      {[3, 4].includes(roleId) && (
        <Tabs.Screen
          key="historial"
          name="historial"
          options={{
            title: 'Historial',
            tabBarIcon: ({ color }) => <Ionicons name="time" size={28} color={color} />,
          }}
        />
      )}
      {[1, 2, 3].includes(roleId) && (
        <Tabs.Screen
          name="notificaciones"
          options={{
            title: 'Notificaciones',
            tabBarIcon: ({ color }) => <Ionicons name="notifications" size={28} color={color} />,
          }}
        />
      )}
    </Tabs>
  );
}
