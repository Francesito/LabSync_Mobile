import { Tabs } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';

import { HapticTab } from '@/components/HapticTab';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

const LOADING_INDICATOR_COLOR = '#2563eb';

type RoleId = 1 | 2 | 3 | 4 | null;
type TabName =
  | 'solicitudes'
  | 'adeudos'
  | 'residuo'
  | 'prestamos'
  | 'chat'
  | 'reportes'
  | 'configuracion'
  | 'historial'
  | 'notificaciones';

const TAB_VISIBILITY_BY_ROLE: Record<TabName, RoleId[]> = {
  solicitudes: [1, 2, 3],
  adeudos: [1, 2],
  residuo: [1],
  prestamos: [3],
  chat: [1, 3],
  reportes: [3, 4],
  configuracion: [4],
  historial: [3, 4],
  notificaciones: [1, 2, 3],
};

const ALLOWED_ROLES = new Set<Exclude<RoleId, null>>([1, 2, 3, 4]);

export default function TabLayout() {
  const colorScheme = useColorScheme();
 const [roleId, setRoleId] = useState<RoleId>(null);
  const [isReady, setIsReady] = useState(false);

const loadRole = useCallback(async () => {
    try {
      const userStr = await SecureStore.getItemAsync('usuario');

      if (!userStr) {
        setRoleId(null);
         return;
      }

   const parsed = JSON.parse(userStr) as { rol_id?: number | string }; 
      const numericRole = Number(parsed.rol_id);
     const sanitizedRole: RoleId = ALLOWED_ROLES.has(
        numericRole as Exclude<RoleId, null>,
      )
        ? (numericRole as Exclude<RoleId, null>)
        : null;

      setRoleId(sanitizedRole);
    } catch (error) {
      console.error('Error parsing user data:', error);
      setRoleId(null);
    } finally {
      setIsReady(true);
    }
  }, []);

 useEffect(() => {
    void loadRole();
  }, [loadRole]);

    const canAccess = useCallback(
    (tab: TabName) => roleId !== null && TAB_VISIBILITY_BY_ROLE[tab].includes(roleId),
    [roleId],
  );

  const tabBarActiveTintColor = useMemo(
    () => Colors[colorScheme ?? 'light'].tint,
    [colorScheme],
  );

  if (!isReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
             <ActivityIndicator size="large" color={LOADING_INDICATOR_COLOR} />
      </View>
    );
  }

  return (
    <Tabs
      initialRouteName="catalogo"
      screenOptions={{
      tabBarActiveTintColor,
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
          href: canAccess('solicitudes') ? undefined : null,
          title: 'Solicitudes',
          tabBarIcon: ({ color }) => <Ionicons name="document-text" size={28} color={color} />,
        }}
      />

      <Tabs.Screen
        name="adeudos"
        options={{
          href: canAccess('adeudos') ? undefined : null,
          title: 'Adeudos',
          tabBarIcon: ({ color }) => <Ionicons name="alert-circle" size={28} color={color} />,
        }}
      />

      <Tabs.Screen
        name="residuo"
        options={{
             href: canAccess('residuo') ? undefined : null,
          title: 'Residuos',
          tabBarIcon: ({ color }) => <Ionicons name="trash" size={28} color={color} />,
        }}
      />

      <Tabs.Screen
        name="prestamos"
        options={{
          href: canAccess('prestamos') ? undefined : null,
          title: 'Préstamos',
          tabBarIcon: ({ color }) => <Ionicons name="swap-horizontal" size={28} color={color} />,
        }}
      />

      <Tabs.Screen
        name="chat"
        options={{
          href: canAccess('chat') ? undefined : null,
          title: 'Chat',
          tabBarIcon: ({ color }) => <Ionicons name="chatbubble-ellipses" size={28} color={color} />,
        }}
      />

      <Tabs.Screen
        name="reportes"
        options={{
          href: canAccess('reportes') ? undefined : null,
          title: 'Reportes',
          tabBarIcon: ({ color }) => <Ionicons name="bar-chart" size={28} color={color} />,
        }}
      />

      <Tabs.Screen
        name="configuracion"
        options={{
            href: canAccess('configuracion') ? undefined : null,
          title: 'Configuración',
          tabBarIcon: ({ color }) => <Ionicons name="settings" size={28} color={color} />,
        }}
      />

      <Tabs.Screen
        name="historial"
        options={{
          href: canAccess('historial') ? undefined : null,
          title: 'Historial',
          tabBarIcon: ({ color }) => <Ionicons name="time" size={28} color={color} />,
        }}
      />

      <Tabs.Screen
        name="notificaciones"
        options={{
          href: canAccess('notificaciones') ? undefined : null,
          title: 'Notificaciones',
             tabBarIcon: ({ color }) => <Ionicons name="notifications" size={28} color={color} />,
        }}
      />

      <Tabs.Screen
        name="logout"
        options={{
          title: 'Salir',
          tabBarIcon: ({ color }) => <Ionicons name="exit-outline" size={28} color={color} />,
        }}
      />
    </Tabs>
  );
}
