import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { router, Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import { TAB_ROUTES } from "@/navigation/tabs";
import { getLaunchRouteAsync } from "@/data/appLaunchService";

function TabBarIcon(props: {
  name: ComponentProps<typeof FontAwesome6>["name"];
  color: string;
}) {
  return <FontAwesome6 size={18} {...props} />;
}

export default function TabLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function guardTabs() {
      const route = await getLaunchRouteAsync();

      if (cancelled) {
        return;
      }

      if (route !== "/(tabs)") {
        router.replace(route);
        return;
      }

      setReady(true);
    }

    void guardTabs();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <View className="flex-1 items-center justify-center bg-[#eef4f1] px-5">
        <Text className="text-center text-sm font-semibold text-[#07110d]">Loading trip workspace...</Text>
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#07110d",
        tabBarInactiveTintColor: "#6b7280",
        tabBarStyle: {
          position: "absolute",
          bottom: 12,
          left: "5%",
          right: "5%",
          backgroundColor: "#ffffff",
          borderColor: "#eef4f1",
          borderRadius: 28,
          borderWidth: 1,
          height: 72,
          paddingBottom: 12,
          paddingTop: 10,
          shadowColor: "#10251d",
          shadowOpacity: 0.12,
          shadowRadius: 18
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600"
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: TAB_ROUTES[0].name,
          tabBarIcon: ({ color }) => <TabBarIcon name={TAB_ROUTES[0].icon} color={color} />
        }}
      />
      <Tabs.Screen
        name="lists"
        options={{
          title: TAB_ROUTES[1].name,
          tabBarIcon: ({ color }) => <TabBarIcon name={TAB_ROUTES[1].icon} color={color} />
        }}
      />
      <Tabs.Screen
        name="ledger"
        options={{
          title: TAB_ROUTES[2].name,
          tabBarIcon: ({ color }) => <TabBarIcon name={TAB_ROUTES[2].icon} color={color} />
        }}
      />
    </Tabs>
  );
}
